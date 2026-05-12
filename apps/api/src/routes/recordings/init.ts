// POST /recordings/init — creates a recordings row in 'pending' state and
// mints AWS SDK v3 presigned multipart-upload URLs (video + IMU) plus a single
// presigned PUT for metadata.json. The API process never reads bytes
// (CLAUDE.md file-fidelity rule); it only orchestrates state.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
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
import { RecordingsInitRequestSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

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
      // says we surface a problem-detail rather than the generic Zod 400.
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

      // 1. Initiate two multipart uploads (video + IMU). Server never reads bytes.
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

      // 2. Presign every part URL — uniform partsCount applies to both video
      //    and IMU streams. If imuSizeBytes is small, imuPartUrls will mostly
      //    go unused (client uploads only the parts it needs).
      const expiresAt = new Date(Date.now() + PRESIGNED_TTL_SECONDS * 1000);
      const partUrls = await Promise.all(
        Array.from({ length: body.partsCount }, (_, i) => i + 1).map(async (n) => ({
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
        Array.from({ length: body.partsCount }, (_, i) => i + 1).map(async (n) => ({
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

      // 3. Single PUT for metadata.json (< 10 KB → multipart overhead is silly)
      const metadataUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys.metadata,
          ContentType: 'application/json',
        }),
        { expiresIn: PRESIGNED_TTL_SECONDS },
      );

      // 4. Insert recordings row in 'pending'. The s3UploadId column stores
      //    the VIDEO multipart upload-id (canonical for /finalize state-check).
      //    The IMU upload-id is returned to the client and echoed back in the
      //    /finalize body — we don't need to store both.
      await db
        .insert(schema.recordings)
        .values({
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
        })
        .onConflictDoNothing();

      return reply.status(201).send({
        recordingId: body.recordingId,
        uploadId: videoMu.UploadId,
        partsCount: body.partsCount,
        partUrls,
        imuUploadId: imuMu.UploadId,
        imuPartUrls,
        metadataUrl,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );
}
