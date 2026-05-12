// POST /recordings/init — creates a recordings row in 'pending' state and
// mints AWS SDK v3 presigned multipart-upload URLs (video + IMU) plus a single
// presigned PUT for metadata.json. The API process never reads bytes
// (CLAUDE.md file-fidelity rule); it only orchestrates state.
//
// Idempotent (CR-02): a `/init` for an existing `pending` row owned by the caller
// re-presigns video parts against the row's stored `s3UploadId` (NO second video
// `CreateMultipartUpload`) + a FRESH `CreateMultipartUpload` on the IMU stream
// only (its id isn't persisted on the row) → `200` with the SAME `uploadId`; an
// existing row in a non-`pending` state → `409`; an existing row owned by another
// user → `403` (carrying no row fields); only a brand-new `recordingId` →
// `CreateMultipartUpload`(video+IMU)+`INSERT`+`201`. `.onConflictDoNothing()`
// removed — the SELECT-first guard makes the conflict path unreachable for a new
// row; a genuine concurrent-INSERT race surfaces as a 500 (the client retries →
// hits the existing-row idempotent path), which is more honest than a silent
// `201` with a stale `s3UploadId`. This also self-heals the lost-`201` case: if
// the first `/init`'s `201` is lost before the client persists `row.uploadId`,
// the next drain re-calls `/init`, gets the existing `uploadId` back (the
// multipart upload it points at has zero uploaded parts at that moment) + a fresh
// `imuUploadId`, persists them, and proceeds — no infinite retry.
//
// `POST /recordings/:id/parts` is the coordinator's PREFERRED re-drain route
// (re-presigns video AND IMU against the existing ids, no `CreateMultipartUpload`
// of any kind) — preserves the already-uploaded VIDEO *and* IMU parts' ETags.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, schema } from '../../db/index.js';
import {
  getS3Client,
  RECORDINGS_BUCKET,
  recordingKeys,
  PRESIGNED_TTL_SECONDS,
  MAX_PARTS_PER_UPLOAD,
} from '../../lib/s3-client.js';
import { RecordingsInitRequestSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

type PartUrl = { partNumber: number; url: string };

/** Presign `partsCount` `UploadPartCommand`s against an EXISTING multipart upload-id. */
export async function presignVideoParts(
  s3: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  partsCount: number,
): Promise<PartUrl[]> {
  return Promise.all(
    Array.from({ length: partsCount }, (_, i) => i + 1).map(async (n) => ({
      partNumber: n,
      url: await getSignedUrl(
        s3,
        new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: n }),
        { expiresIn: PRESIGNED_TTL_SECONDS },
      ),
    })),
  );
}

/**
 * Initiate a FRESH multipart upload on the IMU stream and presign `partsCount`
 * part URLs against it. Used on the new-row path AND on the idempotent re-presign
 * path (the IMU upload-id is never persisted on the row — only the video one is —
 * so on a re-`/init` the IMU stream is the single stream that can't be re-presigned
 * and must be restarted; a fresh one orphans nothing because the video upload it
 * accompanies has zero uploaded parts at that point).
 */
export async function presignImuStream(
  s3: S3Client,
  bucket: string,
  imuKey: string,
  partsCount: number,
): Promise<{ imuUploadId: string; imuPartUrls: PartUrl[] }> {
  const imuMu = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: imuKey, ContentType: 'text/csv' }),
  );
  if (!imuMu.UploadId) throw new Error('s3_create_multipart_returned_no_upload_id');
  const imuPartUrls = await presignVideoParts(s3, bucket, imuKey, imuMu.UploadId, partsCount);
  return { imuUploadId: imuMu.UploadId, imuPartUrls };
}

/** Presign a single `PutObjectCommand` for the metadata.json PUT. */
export async function presignMetadata(
  s3: S3Client,
  bucket: string,
  metadataKey: string,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: metadataKey, ContentType: 'application/json' }),
    { expiresIn: PRESIGNED_TTL_SECONDS },
  );
}

export default async function recordingsInitRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/init',
    {
      schema: {
        body: RecordingsInitRequestSchema,
        // Response schema intentionally omitted (Pattern 22 — STATE.md): declaring
        // response.201 narrows reply.code() so 400 problem-detail returns trip
        // the type checker. Happy-path shape is enforced manually via the typed
        // RecordingsInitResponseSchema return-value contract documented inline.
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          // Per-user keying — @fastify/rate-limit fires before route preHandlers
          // so the keyGenerator must do its own best-effort jwtVerify. Same
          // pattern as plan 04 idempotency hook + plan 06 tasks rate-limit.
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
      const userJwt = req.user as {
        sub: string;
        flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
      };
      const userId = userJwt.sub;
      const flavor = userJwt.flavor;
      const body = req.body;

      // Defensive: zod schema already enforces 1..1000, but planner contract
      // says we surface a problem-detail rather than the generic Zod 400. This
      // guard runs BEFORE the SELECT-first idempotency check.
      if (body.partsCount > MAX_PARTS_PER_UPLOAD) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: 'partsCount exceeds maximum',
          status: 400,
          detail: `Max ${MAX_PARTS_PER_UPLOAD} parts; got ${body.partsCount}`,
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }

      const keys = recordingKeys({ userId, recordingId: body.recordingId });
      const s3 = getS3Client();
      const bucket = RECORDINGS_BUCKET();

      // SELECT-first idempotency guard (CR-02). Runs BEFORE any video
      // CreateMultipartUpload so a duplicate /init never strands the row's
      // s3UploadId and never leaks a video multipart upload.
      const [existing] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, body.recordingId))
        .limit(1);
      if (existing) {
        if (existing.userId !== userId) {
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
        if (existing.qaStatus !== 'pending') {
          return reply
            .status(409)
            .type(PROBLEM_CT)
            .send(
              buildProblemDetail({
                slug: PROBLEM_SLUGS.conflict,
                title: `Cannot re-init from state ${existing.qaStatus}`,
                status: 409,
                instance: req.id as string,
              }),
            );
        }
        if (!existing.s3UploadId) {
          // Defensive: a pending row should always carry the video upload-id.
          return reply
            .status(409)
            .type(PROBLEM_CT)
            .send(
              buildProblemDetail({
                slug: PROBLEM_SLUGS.conflict,
                title: 'Pending row missing video upload-id',
                status: 409,
                detail: 'Row is pending but has no s3UploadId; this should not happen',
                instance: req.id as string,
              }),
            );
        }
        // Idempotent re-presign: keep existing.s3UploadId (the already-uploaded
        // video parts' ETags survive a re-drain) + a FRESH CreateMultipartUpload
        // on the IMU stream ONLY (its id was never persisted). Row is NOT mutated.
        // partsCount is non-null on any row /init created (the column is set on
        // INSERT) — fall back to the request value defensively.
        const rowParts = existing.partsCount ?? body.partsCount;
        const partUrls = await presignVideoParts(
          s3,
          bucket,
          keys.video,
          existing.s3UploadId,
          rowParts,
        );
        const { imuUploadId, imuPartUrls } = await presignImuStream(s3, bucket, keys.imu, rowParts);
        const metadataUrl = await presignMetadata(s3, bucket, keys.metadata);
        const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000);
        return reply.status(200).send({
          recordingId: body.recordingId,
          uploadId: existing.s3UploadId,
          partsCount: rowParts,
          partUrls,
          imuUploadId,
          imuPartUrls,
          metadataUrl,
          expiresAt: expiresAt.toISOString(),
        });
      }

      // ── New-row path ──────────────────────────────────────────────────────
      // 1. Initiate the VIDEO multipart upload (the IMU one is initiated by
      //    presignImuStream below). Server never reads bytes.
      const videoMu = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: keys.video,
          ContentType: 'video/mp4',
        }),
      );
      if (!videoMu.UploadId) {
        throw new Error('s3_create_multipart_returned_no_upload_id');
      }

      // 2. Presign every part URL — uniform partsCount applies to both video
      //    and IMU streams. If imuSizeBytes is small, imuPartUrls will mostly
      //    go unused (client uploads only the parts it needs).
      const partUrls = await presignVideoParts(
        s3,
        bucket,
        keys.video,
        videoMu.UploadId,
        body.partsCount,
      );
      const { imuUploadId, imuPartUrls } = await presignImuStream(
        s3,
        bucket,
        keys.imu,
        body.partsCount,
      );

      // 3. Single PUT for metadata.json (< 10 KB → multipart overhead is silly)
      const metadataUrl = await presignMetadata(s3, bucket, keys.metadata);
      const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000);

      // 4. Insert recordings row in 'pending'. The s3UploadId column stores
      //    the VIDEO multipart upload-id (canonical for /finalize state-check).
      //    The IMU upload-id is returned to the client and echoed back in the
      //    /finalize body — we don't need to store both. NO .onConflictDoNothing()
      //    — the SELECT-first guard above makes the conflict path unreachable for
      //    a new row; a genuine concurrent-INSERT race surfaces as a 500.
      await db.insert(schema.recordings).values({
        id: body.recordingId,
        userId,
        taskId: body.taskId,
        practice: body.practice,
        qaStatus: 'pending',
        durationMs: body.durationMs,
        fileSha256: body.fileSha256,
        imuSha256: body.imuSha256,
        fileSizeBytes: body.fileSizeBytes,
        imuSizeBytes: body.imuSizeBytes,
        s3KeyVideo: keys.video,
        s3KeyImu: keys.imu,
        s3KeyMetadata: keys.metadata,
        capturedAt: new Date(body.capturedAt),
        flavor,
        s3UploadId: videoMu.UploadId,
        partsCount: body.partsCount,
        // UP-18 — the client sends ip_address: null; the server populates it.
        // req.ip honors Fastify's trustProxy setting (a no-op until the prod
        // ALB is fronted with trustProxy configured to the proxy CIDR — until
        // then req.ip is the socket peer, correct in dev / direct connections).
        ipAddress: req.ip,
      });

      return reply.status(201).send({
        recordingId: body.recordingId,
        uploadId: videoMu.UploadId,
        partsCount: body.partsCount,
        partUrls,
        imuUploadId,
        imuPartUrls,
        metadataUrl,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );
}
