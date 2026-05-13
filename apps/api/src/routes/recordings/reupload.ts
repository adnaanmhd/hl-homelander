// POST /recordings/:id/reupload — re-issue presigned multipart-upload URLs for
// a recording whose hashes the verify worker found mismatched (UP-16). The row
// and the deterministic S3 keys already exist; this resets qa_status back to
// 'pending' (the hash-mismatch → pending edge, Plan 05-03), mints FRESH
// CreateMultipartUpload + per-part UploadPart presigns + the metadata PUT, and
// overwrites s3UploadId / partsCount on the existing row (UPDATE, not INSERT —
// S3 versioning retains the bad object version). Returns the same shape as
// /recordings/init. There is intentionally NO server-side "dead-letter after N
// re-uploads" cap (D-04a — the upload path is uncapped per account at MVP; the
// client surfaces `chip-failed` after its own retry budget).
//
// The API process never reads bytes (CLAUDE.md file-fidelity rule).
//
// Re-upload boundary / BullMQ dedupe bridge: enqueueVerify (lib/queue.ts) uses
// `jobId = recordingId` to dedupe SQS-redelivery + sweep-cron double-enqueues
// (threat T-5-03-01). But the first verify ALWAYS completed for a re-upload
// chain (its hash-mismatch flip is what unlocked this route in the first
// place), so the prior jobId sits in `bull:verify:completed` and the
// post-/finalize re-enqueue silently no-ops. The /reupload handler is the one
// call site that knows a re-upload has just begun, so it explicitly removes the
// prior completed job before returning — the SQS poller + verify-sweep cron
// keep the T-5-03-01 dedupe intact. See debug session
// `.planning/debug/enqueue-verify-jobid-dedupe.md`.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, schema } from '../../db/index.js';
import {
  getS3Client,
  RECORDINGS_BUCKET,
  recordingKeys,
  PRESIGNED_TTL_SECONDS,
  MAX_PARTS_PER_UPLOAD,
} from '../../lib/s3-client.js';
import { canTransition } from '../../lib/recording-state.js';
import { getQueue } from '../../lib/queue.js';
import { RecordingReuploadRequestSchema } from '@humyn/shared-types';
import type { RecordingReuploadResponse } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const Params = z.object({ id: z.string().length(26) });
const PROBLEM_CT = 'application/problem+json';

export default async function recordingsReuploadRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/:id/reupload',
    {
      schema: {
        params: Params,
        body: RecordingReuploadRequestSchema, // { partsCount }
        // Response schema intentionally omitted (Pattern 22 — STATE.md): declaring
        // response.200 would narrow reply.code() so the 404/403/409 problem-detail
        // returns trip the type checker. Happy-path shape enforced via the typed
        // RecordingReuploadResponse return-value contract documented inline.
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          // Per-user keying — @fastify/rate-limit fires before route preHandlers
          // so the keyGenerator does its own best-effort jwtVerify (mirror init.ts).
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `user:${sub}`;
            } catch {
              // Fall through to per-IP if no/invalid token.
            }
            return `ip:${req.ip}`;
          },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const userId = (req.user as { sub: string }).sub;
      const { partsCount } = req.body;

      if (partsCount > MAX_PARTS_PER_UPLOAD) {
        return reply
          .status(400)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.validation,
              title: 'partsCount exceeds maximum',
              status: 400,
              detail: `Max ${MAX_PARTS_PER_UPLOAD} parts; got ${partsCount}`,
              instance: req.id as string,
            }),
          );
      }

      const [rec] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, id))
        .limit(1);
      if (!rec) {
        return reply
          .status(404)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.notFound,
              title: 'Recording not found',
              status: 404,
              instance: req.id as string,
            }),
          );
      }
      if (rec.userId !== userId) {
        return reply
          .status(403)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.forbidden,
              title: 'Not your recording',
              status: 403,
              instance: req.id as string,
            }),
          );
      }
      // Re-upload is only legal from 'hash-mismatch'. canTransition encodes the
      // same edge (hash-mismatch → pending) — assert both for belt-and-braces.
      if (rec.qaStatus !== 'hash-mismatch' || !canTransition(rec.qaStatus, 'pending')) {
        return reply
          .status(409)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.conflict,
              title: `Cannot re-upload from state ${rec.qaStatus}`,
              status: 409,
              detail: 'Re-upload only allowed from hash-mismatch',
              instance: req.id as string,
            }),
          );
      }

      // Re-mint everything fresh. Same deterministic keys — S3 versioning keeps
      // the bad object version; the re-uploaded bytes become the latest version.
      const keys = recordingKeys({ userId, recordingId: id });
      const s3 = getS3Client();
      const bucket = RECORDINGS_BUCKET();

      const videoMu = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: keys.video,
          ContentType: 'video/mp4',
        }),
      );
      const imuMu = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: keys.imu,
          ContentType: 'text/csv',
        }),
      );
      if (!videoMu.UploadId || !imuMu.UploadId) {
        throw new Error('s3_create_multipart_returned_no_upload_id');
      }

      const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000);
      const partUrls = await Promise.all(
        Array.from({ length: partsCount }, (_, i) => i + 1).map(async (n) => ({
          partNumber: n,
          url: await getSignedUrl(
            s3,
            new UploadPartCommand({
              Bucket: bucket,
              Key: keys.video,
              UploadId: videoMu.UploadId!,
              PartNumber: n,
            }),
            { expiresIn: PRESIGNED_TTL_SECONDS },
          ),
        })),
      );
      const imuPartUrls = await Promise.all(
        Array.from({ length: partsCount }, (_, i) => i + 1).map(async (n) => ({
          partNumber: n,
          url: await getSignedUrl(
            s3,
            new UploadPartCommand({
              Bucket: bucket,
              Key: keys.imu,
              UploadId: imuMu.UploadId!,
              PartNumber: n,
            }),
            { expiresIn: PRESIGNED_TTL_SECONDS },
          ),
        })),
      );
      const metadataUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys.metadata,
          ContentType: 'application/json',
        }),
        { expiresIn: PRESIGNED_TTL_SECONDS },
      );

      // Reset the existing row back into the upload lifecycle. UPDATE not INSERT
      // — the row already exists; the same recordingKeys() are reused.
      await db
        .update(schema.recordings)
        .set({
          qaStatus: 'pending',
          s3UploadId: videoMu.UploadId,
          partsCount,
          uploadStartedAt: new Date(),
          uploadCompletedAt: null,
          verifiedAt: null,
        })
        .where(eq(schema.recordings.id, id));

      // Bridge the BullMQ dedupe across the re-upload boundary: the prior
      // verify completed (its hash-mismatch flip is what unlocked this route),
      // so its jobId=recordingId sits in bull:verify:completed and the
      // post-/finalize enqueueVerify(id) silently no-ops. Remove the prior
      // explicitly here — the SQS poller + verify-sweep cron's T-5-03-01
      // dedupe is unchanged. Best-effort: a Redis hiccup must not fail
      // /reupload (the verify-sweep cron is the durable backstop, and a
      // double-enqueue from the re-upload-then-finalize chain is itself
      // already protected by jobId dedupe). See debug session
      // `.planning/debug/enqueue-verify-jobid-dedupe.md` + the dev shim
      // `scripts/enqueue-verify-dev.ts` for the same prior.remove() pattern.
      try {
        const prior = await getQueue().getJob(id);
        if (prior) {
          const priorState = await prior.getState();
          await prior.remove();
          req.log.info(
            { recordingId: id, priorJobState: priorState },
            'reupload_removed_prior_verify_job',
          );
        }
      } catch (err) {
        req.log.warn(
          { err, recordingId: id },
          'reupload_remove_prior_verify_job_failed — verify-sweep cron is the backstop',
        );
      }

      const body: RecordingReuploadResponse = {
        recordingId: id,
        uploadId: videoMu.UploadId,
        partsCount,
        partUrls,
        imuUploadId: imuMu.UploadId,
        imuPartUrls,
        metadataUrl,
        expiresAt: expiresAt.toISOString(),
      };
      return reply.status(200).send(body);
    },
  );
}
