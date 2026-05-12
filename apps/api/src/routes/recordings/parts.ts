// POST /recordings/:id/parts (UP-04) — re-presign per-part upload URLs against
// the EXISTING video + IMU multipart uploads. NO CreateMultipartUpload of any
// kind, NO INSERT, NO UPDATE, NO qa_status change — this is the upload
// coordinator's PREFERRED re-drain route (after a process-kill / a presigned-TTL
// expiry): it preserves the already-uploaded VIDEO *and* IMU parts' ETags
// (contrast `/init`'s idempotent path, which DOES issue a fresh
// CreateMultipartUpload on the IMU stream because it takes no `imuUploadId` in
// the body — `/parts` does, so it can re-presign IMU too). The server stores only
// the video upload-id on the row; the client supplies the IMU upload-id it got
// from the original `/init`.
//
// The API process never reads bytes (CLAUDE.md file-fidelity rule).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import {
  getS3Client,
  RECORDINGS_BUCKET,
  recordingKeys,
  PRESIGNED_TTL_SECONDS,
  MAX_PARTS_PER_UPLOAD,
} from '../../lib/s3-client.js';
import { RecordingRePresignRequestSchema } from '@humyn/shared-types';
import type { RecordingRePresignResponse } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { presignVideoParts, presignMetadata } from './init.js';

const Params = z.object({ id: z.string().length(26) });
const PROBLEM_CT = 'application/problem+json';

export default async function recordingsRePresignRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/:id/parts',
    {
      schema: {
        params: Params,
        body: RecordingRePresignRequestSchema, // { partsCount, imuUploadId }
        // Response schema intentionally omitted (Pattern 22 — STATE.md): declaring
        // response.200 would narrow reply.code() so the 400/404/403/409 problem-
        // detail returns trip the type checker. Happy-path shape enforced via the
        // typed RecordingRePresignResponse return-value contract documented inline.
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 30,
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
      const { partsCount, imuUploadId } = req.body;

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
        // No row fields leaked (same posture as reupload.ts / finalize.ts).
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
      if (rec.qaStatus !== 'pending') {
        return reply
          .status(409)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.conflict,
              title: `Cannot re-presign from state ${rec.qaStatus}`,
              status: 409,
              detail: `Re-presign only allowed while the upload is in progress; state is ${rec.qaStatus}`,
              instance: req.id as string,
            }),
          );
      }
      if (!rec.s3UploadId) {
        return reply
          .status(409)
          .type(PROBLEM_CT)
          .send(
            buildProblemDetail({
              slug: PROBLEM_SLUGS.conflict,
              title: 'No video upload-id on row',
              status: 409,
              detail: 'No video upload-id on row; was /init called?',
              instance: req.id as string,
            }),
          );
      }

      // Re-presign ONLY — no CreateMultipartUpload, no DB write, no state change.
      // The keys are server-derived from recordingKeys({ userId: caller, ... }) —
      // never from a client path; a forged imuUploadId yields a presigned PUT
      // against a non-existent multipart upload (harmless; S3 rejects it on use).
      const keys = recordingKeys({ userId, recordingId: id });
      const s3 = getS3Client();
      const bucket = RECORDINGS_BUCKET();

      const partUrls = await presignVideoParts(s3, bucket, keys.video, rec.s3UploadId, partsCount);
      const imuPartUrls = await presignVideoParts(s3, bucket, keys.imu, imuUploadId, partsCount);
      const metadataUrl = await presignMetadata(s3, bucket, keys.metadata);
      const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000);

      const body: RecordingRePresignResponse = {
        recordingId: id,
        uploadId: rec.s3UploadId,
        partsCount,
        partUrls,
        imuUploadId,
        imuPartUrls,
        metadataUrl,
        expiresAt: expiresAt.toISOString(),
      };
      return reply.status(200).send(body);
    },
  );
}
