// verify-sweep — re-enqueues stale recordings_to_verify rows so nothing is lost
// if the EventBridge→SQS leg dropped a message (belt-and-suspenders for
// at-least-once). Mirrors cron/dsr-hard-delete.ts's timer shape.
//
// A row is "stale" if it's been sitting in recordings_to_verify longer than
// STALE_THRESHOLD_MS with attempts < MAX_ATTEMPTS. enqueueVerify uses
// jobId = recordingId so re-enqueuing a row already in the queue collapses to
// one BullMQ job (threat T-5-03-01) — the sweep is safe to run alongside the
// SQS poller.
//
// findStaleVerifyRows() is exported so tests can assert the query without driving the timer.

import { and, eq, lt, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { enqueueVerify } from '../lib/queue.js';

const SWEEP_INTERVAL_MS = 5 * 60_000; // run every 5 min
const STALE_THRESHOLD_MS = 10 * 60_000; // re-enqueue rows older than 10 min
const MAX_ATTEMPTS = 8; // give up after 8 sweeps (~80 min) — operator investigates

let _timer: NodeJS.Timeout | undefined;

export async function findStaleVerifyRows(): Promise<string[]> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);
  const rows = await db
    .select({ recordingId: schema.recordingsToVerify.recordingId })
    .from(schema.recordingsToVerify)
    .where(
      and(
        lt(schema.recordingsToVerify.enqueuedAt, cutoff),
        lt(schema.recordingsToVerify.attempts, MAX_ATTEMPTS),
      ),
    );
  return rows.map((r) => r.recordingId);
}

export interface CronLogger {
  info: (obj: unknown, msg?: string) => void;
}

export function startVerifySweep(logger: CronLogger): void {
  if (_timer) return;
  const tick = async (): Promise<void> => {
    try {
      const ids = await findStaleVerifyRows();
      for (const id of ids) {
        await enqueueVerify(id);
        await db
          .update(schema.recordingsToVerify)
          .set({ attempts: sql`${schema.recordingsToVerify.attempts} + 1` })
          .where(eq(schema.recordingsToVerify.recordingId, id));
      }
      if (ids.length) logger.info({ count: ids.length }, 'verify_sweep_re_enqueued_stale_rows');
    } catch (err) {
      logger.info({ err }, 'verify_sweep_tick_failed');
    }
  };
  // Run once at boot (so dev + tests can observe behaviour) + every interval after.
  void tick();
  _timer = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  _timer.unref?.();
}

export function stopVerifySweep(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = undefined;
  }
}
