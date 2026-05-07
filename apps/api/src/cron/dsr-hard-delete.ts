// Phase 1 stub — runs daily; logs candidate user ids past their 30-day grace.
// Phase 5 swaps the body for actual hard-delete (S3 prefix purge + recordings
// row anonymization + users row delete). At MVP we don't delete; we surface
// the list so ops can verify the workflow before automating.
//
// findHardDeleteCandidates() is exported so tests can assert the query without
// driving the timer.

import { lt, isNotNull, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

const ONE_DAY_MS = 24 * 3600 * 1000;
let _timer: NodeJS.Timeout | undefined;

export async function findHardDeleteCandidates(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(isNotNull(schema.users.deleteGraceUntil), lt(schema.users.deleteGraceUntil, new Date())),
    );
  return rows.map((r) => r.id);
}

export interface CronLogger {
  info: (obj: unknown, msg?: string) => void;
}

export function startDsrCron(logger: CronLogger): void {
  if (_timer) return;
  const tick = async (): Promise<void> => {
    try {
      const ids = await findHardDeleteCandidates();
      logger.info({ candidate_count: ids.length, candidates: ids }, 'dsr_hard_delete_candidates');
      // Phase 5 will: for each id → delete S3 prefix, anonymize recordings.user_id,
      //   delete users row + cascade. Phase 1 is log-only.
    } catch (err) {
      logger.info({ err }, 'dsr_cron_failed');
    }
  };
  // Run once at boot (so dev + tests can observe behaviour) + daily after that.
  void tick();
  _timer = setInterval(() => {
    void tick();
  }, ONE_DAY_MS);
  _timer.unref?.();
}

export function stopDsrCron(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = undefined;
  }
}
