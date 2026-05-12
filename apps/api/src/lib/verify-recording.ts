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
//
// TOCTOU-safe (WR-02 / VERIFY-03/04): the multi-second S3 re-hash window is
// long enough for an ops action (takedown / re-upload) to flip the row out from
// under us. So the `qa_status` UPDATE carries `AND qa_status='uploaded'` and the
// outbox event + the `recordings_to_verify` delete only happen if the UPDATE
// actually affected a row (`rowCount === 1`). A 0-row update means the row moved
// during the re-hash — log at `info` and return without side effects; a
// `takedown` stays `takedown`. (The dead `canTransition(rec.qaStatus, ...)`
// check — always `'uploaded'` because `rec` is a stale read — is no longer the
// guard; the SQL predicate is.)
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { recordingKeys } from './s3-client.js';
import { sha256OfS3Object } from './sha256-stream.js';
import { appendOutboxEvent } from './recording-events.js';

interface VerifyLogger {
  info: (obj: unknown, msg?: string) => void;
}

export async function verifyRecording(recordingId: string, log?: VerifyLogger): Promise<void> {
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
    if (match) {
      const res = await tx
        .update(schema.recordings)
        .set({ qaStatus: 'verified', verifiedAt: new Date() })
        .where(
          and(eq(schema.recordings.id, recordingId), eq(schema.recordings.qaStatus, 'uploaded')),
        );
      if ((res.rowCount ?? 0) === 1) {
        // userId comes from the DB row (the recording's true owner) — never from
        // the queue payload (threat T-5-03-03).
        await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 'verified' });
        await tx
          .delete(schema.recordingsToVerify)
          .where(eq(schema.recordingsToVerify.recordingId, recordingId));
      } else {
        // The row moved out of 'uploaded' during the re-hash (ops takedown /
        // re-upload). Don't resurrect it; don't emit; leave the queue row — the
        // verify-sweep cron reaps it after MAX_ATTEMPTS, and the row will never
        // return to 'uploaded' from takedown/rejected anyway.
        log?.info({ recordingId, currentQaStatus: 'moved' }, 'row moved during re-hash; skipping');
      }
    } else {
      const res = await tx
        .update(schema.recordings)
        .set({ qaStatus: 'hash-mismatch' })
        .where(
          and(eq(schema.recordings.id, recordingId), eq(schema.recordings.qaStatus, 'uploaded')),
        );
      if ((res.rowCount ?? 0) === 1) {
        await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 're-upload' });
        // hash-mismatch is terminal-until-re-uploaded — drop the queue row; a
        // re-upload runs a fresh /init → /finalize cycle (which re-inserts it).
        await tx
          .delete(schema.recordingsToVerify)
          .where(eq(schema.recordingsToVerify.recordingId, recordingId));
      } else {
        log?.info({ recordingId, currentQaStatus: 'moved' }, 'row moved during re-hash; skipping');
      }
    }
  });
}
