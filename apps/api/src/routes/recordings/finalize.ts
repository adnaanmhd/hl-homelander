// POST /recordings/:id/finalize — calls AWS SDK v3 CompleteMultipartUploadCommand
// for both the video and IMU multipart uploads and transitions qa_status from
// 'pending' → 'uploaded' (the TERMINAL success state after Enh 3 / D1 removed the
// hash-verify flow). AWS itself reassembles the bytes — the API process never
// reads file content (CLAUDE.md file-fidelity rule).
//
// Retry-safe (WR-01): a /finalize retry where a CompleteMultipartUpload returns
// NoSuchUpload (the multipart upload was already completed on a prior attempt)
// HeadObject's the key and treats 'present' as success; a row already in
// qa_status='uploaded' short-circuits to a 200 (the prior finalize's response
// dropped on the wire). The row is only flipped to 'uploaded' once BOTH objects
// are confirmed present, so a half-finished /finalize never strands a row.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { CompleteMultipartUploadCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { db, schema } from '../../db/index.js';
import { getS3Client, RECORDINGS_BUCKET, recordingKeys } from '../../lib/s3-client.js';
import { generatePosterThumbnail } from '../../lib/thumbnail.js';
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
    createdAt: r.createdAt.toISOString(),
    // UP-18 — return the server-populated IP (set on /init), not a hard-coded null.
    ipAddress: r.ipAddress,
  };
}

// S3 surfaces "this multipart upload is gone" under a few different error
// `name`s depending on SDK version / endpoint (real AWS vs LocalStack).
const ALREADY_COMPLETED_ERROR_NAMES = new Set([
  'NoSuchUpload',
  'NoSuchMultipartUpload',
  'NoSuchUploadException',
]);

// Complete the multipart upload — but if S3 says the upload is already gone
// (we completed it on a prior /finalize attempt that then failed downstream, or
// it expired), HeadObject the key: "the object exists" ⇒ treat as success
// (idempotent retry). HeadObject throws NotFound/404 if the object isn't there
// → that error propagates (a genuine failure; the coordinator retries / it
// dead-letters). Any S3 error that is neither "already completed" nor a present
// object also propagates.
async function completeOrConfirm(
  s3: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
): Promise<void> {
  try {
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name && ALREADY_COMPLETED_ERROR_NAMES.has(name)) {
      // The multipart upload is gone — if the object is present, the prior
      // attempt's CompleteMultipartUpload already landed it. Treat as success.
      // (HeadObject throws NotFound/404 → propagates as a genuine failure.)
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }
    throw err;
  }
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
      // Idempotent retry (WR-01): a row already in 'uploaded' means a prior
      // /finalize flipped it but its response dropped on the wire. The objects
      // are present; just replay the 200. (verified / hash-mismatch / rejected /
      // takedown are post-finalize states the client shouldn't be re-finalizing
      // → still 409 below.)
      if (rec.qaStatus === 'uploaded') {
        // BUG-3 (2026-06-09) — forward fix on the idempotent-retry path. The
        // poster column is set in exactly ONE place (the terminal flip below),
        // which this short-circuit skips — so a row that finalized but never got
        // a poster (the thumbnail PUT failed, or it finalized before ffmpeg
        // shipped in the image) could otherwise NEVER recover one on a
        // re-finalize. When thumbless, attempt generation + persist before
        // replaying the 200. Best-effort: any failure leaves the column null
        // (client falls back to local ledger / gradient) and never blocks the
        // 200. (Most production recovery happens via the one-shot backfill
        // script, since the device drops a row after its first finalize-200 and
        // a same-key re-finalize replays the idempotency cache before this
        // handler even runs — this path covers a fresh-key/cache-expired retry.)
        if (rec.s3KeyThumbnail === null) {
          const s3 = getS3Client();
          const bucket = RECORDINGS_BUCKET();
          const keys = recordingKeys({ userId, recordingId: rec.id });
          try {
            await generatePosterThumbnail({
              s3,
              bucket,
              videoKey: rec.s3KeyVideo,
              thumbKey: keys.thumbnail,
            });
            await db
              .update(schema.recordings)
              .set({ s3KeyThumbnail: keys.thumbnail })
              .where(eq(schema.recordings.id, rec.id));
            // Phase 4 item 2 (2026-06-10) — success was silent; log the key so
            // CloudWatch can answer "are thumbnails being generated at all?".
            req.log.info(
              { recordingId: rec.id, thumbKey: keys.thumbnail },
              'poster thumbnail generated (finalize-retry recovery)',
            );
            return reply.send(toRecordingResponse({ ...rec, s3KeyThumbnail: keys.thumbnail }));
          } catch (err) {
            req.log.warn(
              { err, recordingId: rec.id },
              'finalize-retry poster thumbnail generation failed (non-fatal)',
            );
          }
        }
        return reply.send(toRecordingResponse(rec));
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

      // Server-side complete — AWS reassembles the parts. The API process never
      // reads bytes (CLAUDE.md file-fidelity rule). completeOrConfirm tolerates
      // a NoSuchUpload (already completed on a prior attempt) by HeadObject'ing
      // the key (WR-01).
      await completeOrConfirm(
        s3,
        bucket,
        keys.video,
        rec.s3UploadId,
        req.body.videoParts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      );
      await completeOrConfirm(
        s3,
        bucket,
        keys.imu,
        req.body.imuUploadId,
        req.body.imuParts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      );

      // Only flip the row to 'uploaded' once BOTH objects are confirmed present.
      // If either HeadObject throws NotFound, the row stays 'pending' and the
      // client retries — a half-finished /finalize never strands a row (WR-01).
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: keys.video }));
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: keys.imu }));

      // Bug 6 / D5 — best-effort server-side poster JPEG for cross-device History
      // thumbnails. Runs AFTER both objects are confirmed present; ANY failure
      // (ffmpeg missing / unreadable bytes / timeout) is swallowed so it never
      // blocks the terminal-success flip. NULL → the client falls back to its
      // local ledger thumb or the gradient placeholder.
      let thumbKey: string | null = null;
      try {
        await generatePosterThumbnail({
          s3,
          bucket,
          videoKey: keys.video,
          thumbKey: keys.thumbnail,
        });
        thumbKey = keys.thumbnail;
        // Phase 4 item 2 (2026-06-10) — success was silent; log the key so
        // CloudWatch can answer "are thumbnails being generated at all?".
        req.log.info({ recordingId: rec.id, thumbKey }, 'poster thumbnail generated');
      } catch (err) {
        req.log.warn(
          { err, recordingId: rec.id },
          'poster thumbnail generation failed (non-fatal)',
        );
      }

      // Enh 3 / D1 (2026-06-04): `uploaded` is the TERMINAL success state. The
      // hash-verify worker + recordings_to_verify queue were removed, so finalize
      // just flips the row to 'uploaded' once both objects are confirmed present.
      const updated = await db.transaction(async (tx) => {
        await tx
          .update(schema.recordings)
          .set({ qaStatus: 'uploaded', uploadCompletedAt: new Date(), s3KeyThumbnail: thumbKey })
          .where(eq(schema.recordings.id, rec.id));
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
