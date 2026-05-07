// POST /recordings/:id/finalize — calls AWS SDK v3 CompleteMultipartUploadCommand
// for both the video and IMU multipart uploads, transitions qa_status from
// 'pending' → 'uploaded', and enqueues the row in recordings_to_verify so the
// Phase 5 hash-verify worker picks it up. AWS itself reassembles the bytes —
// the API process never reads file content (CLAUDE.md file-fidelity rule).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db, schema } from '../../db/index.js';
import { getS3Client, RECORDINGS_BUCKET, recordingKeys } from '../../lib/s3-client.js';
import { canTransition } from '../../lib/recording-state.js';
import { RecordingFinalizeSchema, RecordingSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const Params = z.object({ id: z.string().length(26) });
const PROBLEM_CT = 'application/problem+json';

// The body must include the IMU upload-id so the server can complete it. We
// extend the shared schema inline because the IMU upload-id is opaque +
// ephemeral, not a typed field consumers of @humyn/shared-types care about.
const FinalizeBodyExtended = RecordingFinalizeSchema.extend({
  imuUploadId: z.string().min(1),
});

type RecordingRow = typeof schema.recordings.$inferSelect;

function toRecordingResponse(r: RecordingRow): z.infer<typeof RecordingSchema> {
  return {
    id: r.id,
    recordingId: r.id,
    userId: r.userId,
    taskId: r.taskId,
    practice: r.practice,
    qaStatus: r.qaStatus,
    durationMs: r.durationMs,
    fileSha256: r.fileSha256,
    imuSha256: r.imuSha256,
    fileSizeBytes: r.fileSizeBytes,
    imuSizeBytes: r.imuSizeBytes,
    imuVideoDriftMaxMs: r.imuVideoDriftMaxMs,
    imuVideoDriftMeanMs: r.imuVideoDriftMeanMs,
    imuVideoDriftP99Ms: r.imuVideoDriftP99Ms,
    imuMinRateHzObservedP1: r.imuMinRateHzObservedP1,
    capturedAt: r.capturedAt.toISOString(),
    s3KeyVideo: r.s3KeyVideo,
    s3KeyImu: r.s3KeyImu,
    s3KeyMetadata: r.s3KeyMetadata,
    livenessScore: r.livenessScore,
    uploadStartedAt: r.uploadStartedAt?.toISOString() ?? null,
    uploadCompletedAt: r.uploadCompletedAt?.toISOString() ?? null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    ipAddress: null,
  };
}

export default async function finalizeRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/:id/finalize',
    {
      schema: {
        params: Params,
        body: FinalizeBodyExtended,
        // Response schema intentionally omitted — declaring response.200 with
        // RecordingSchema would narrow reply to 200 and break the 404/403/409
        // problem-detail returns (Pattern 22). Body validated at runtime via
        // toRecordingResponse() returning a typed shape.
      },
      preHandler: [app.requireAuth],
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      const rows = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, req.params.id))
        .limit(1);
      if (rows.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'Recording not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      const rec = rows[0]!;
      if (rec.userId !== userId) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.forbidden,
          title: 'Not your recording',
          status: 403,
          instance: req.id as string,
        });
        return reply.status(403).type(PROBLEM_CT).send(pd);
      }
      if (!canTransition(rec.qaStatus, 'uploaded')) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.conflict,
          title: `Cannot finalize from state ${rec.qaStatus}`,
          status: 409,
          instance: req.id as string,
        });
        return reply.status(409).type(PROBLEM_CT).send(pd);
      }
      if (!rec.s3UploadId) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.conflict,
          title: 'No video upload-id on row; was /init called?',
          status: 409,
          instance: req.id as string,
        });
        return reply.status(409).type(PROBLEM_CT).send(pd);
      }

      const s3 = getS3Client();
      const bucket = RECORDINGS_BUCKET();
      const keys = recordingKeys({ userId, recordingId: rec.id });

      // Server-side complete — AWS reassembles the parts. The API process
      // never reads bytes (CLAUDE.md file-fidelity rule).
      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: keys.video,
          UploadId: rec.s3UploadId,
          MultipartUpload: {
            Parts: req.body.videoParts.map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
          },
        }),
      );
      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: keys.imu,
          UploadId: req.body.imuUploadId,
          MultipartUpload: {
            Parts: req.body.imuParts.map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
          },
        }),
      );

      // Transition state and enqueue Phase 5 hash-verify worker (queue-stub write).
      const updated = await db.transaction(async (tx) => {
        await tx
          .update(schema.recordings)
          .set({ qaStatus: 'uploaded', uploadCompletedAt: new Date() })
          .where(eq(schema.recordings.id, rec.id));
        await tx
          .insert(schema.recordingsToVerify)
          .values({ recordingId: rec.id })
          .onConflictDoNothing();
        const after = await tx
          .select()
          .from(schema.recordings)
          .where(eq(schema.recordings.id, rec.id))
          .limit(1);
        return after[0]!;
      });

      return reply.send(toRecordingResponse(updated));
    },
  );
}
