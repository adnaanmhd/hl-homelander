// verify-recording — the hash-verify worker's "verify one recording" service:
// re-hash the MP4 + IMU CSV from S3, compare to the recorded SHA-256s, flip
// qa_status, write the server→client outbox event — all in one transaction.
//
// Server reads recording bytes here and ONLY here — the byte-fidelity carve-out
// (CLAUDE.md). sha256-stream.ts streams the object; nothing is re-muxed or
// written back.
//
// Idempotent: a redelivered SQS message (or a double-enqueue, or the
// verify-sweep cron re-firing) re-runs this, and the early `qaStatus !== 'uploaded'`
// guard makes the re-run a no-op — the row already moved to verified / hash-mismatch
// / takedown. A transient S3 error propagates so BullMQ retries (the queue's
// attempts/backoff).
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { recordingKeys } from './s3-client.js';
import { sha256OfS3Object } from './sha256-stream.js';
import { canTransition } from './recording-state.js';
import { appendOutboxEvent } from './recording-events.js';

export async function verifyRecording(recordingId: string): Promise<void> {
  const [rec] = await db
    .select()
    .from(schema.recordings)
    .where(eq(schema.recordings.id, recordingId))
    .limit(1);
  if (!rec) return; // row gone — nothing to do
  if (rec.qaStatus !== 'uploaded') return; // already verified / hash-mismatch / rejected / takedown — idempotent

  const keys = recordingKeys({ userId: rec.userId, recordingId });
  // Streamed, memory-bounded re-hash of the actual stored bytes (idea-brief.md §7.3).
  const [videoSha, imuSha] = await Promise.all([
    sha256OfS3Object(keys.video),
    sha256OfS3Object(keys.imu),
  ]);
  const match = videoSha === rec.fileSha256 && imuSha === rec.imuSha256;

  await db.transaction(async (tx) => {
    if (match && canTransition(rec.qaStatus, 'verified')) {
      await tx
        .update(schema.recordings)
        .set({ qaStatus: 'verified', verifiedAt: new Date() })
        .where(eq(schema.recordings.id, recordingId));
      // userId comes from the DB row (the recording's true owner) — never from
      // the queue payload (threat T-5-03-03).
      await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 'verified' });
    } else {
      await tx
        .update(schema.recordings)
        .set({ qaStatus: 'hash-mismatch' })
        .where(eq(schema.recordings.id, recordingId));
      await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 're-upload' });
    }
    // hash-mismatch is terminal-until-re-uploaded — drop the queue row either
    // way; a re-upload runs a fresh /init → /finalize cycle (which re-inserts it).
    await tx
      .delete(schema.recordingsToVerify)
      .where(eq(schema.recordingsToVerify.recordingId, recordingId));
  });
}
