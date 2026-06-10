-- 0018 — Bug 2 (2026-06-10, IMPLEMENTATION-PLAN-260610 §4): backfill
-- practice_completed_at for ALL existing users (owner decision 2026-06-10).
--
-- 0017 stamped only users with >= 1 recordings row — a provable practice pass.
-- But staging's fleet spent a week with uploads broken (the stale-API
-- incident): users who completed practice could never create a recordings
-- row, so 0017's predicate misses them and they'd be re-gated through the
-- tutorial after the deploy. The owner chose breadth over proof: stamp EVERY
-- account that exists at migration time with created_at as the "completed
-- by" lower bound. Accepted trade-off: an existing account that genuinely
-- never finished practice skips it (they saw the tutorial at least once; the
-- practice clip never uploads anyway).
--
-- COALESCE keeps it idempotent + non-destructive: a non-null
-- practice_completed_at (set organically post-06-04, or by 0017) is preserved,
-- never overwritten; re-running is a no-op. created_at is NOT NULL
-- (defaultNow), so the backfilled value is always well-defined. Accounts
-- created AFTER this migration runs are untouched — they go through practice
-- normally and get stamped by POST /me/practice-complete.
--
-- Sequencing: 0017 stays as-is (already-applied environments see a
-- superset-safe sequence — 0017's subset stamp followed by 0018's full stamp).

UPDATE users
SET practice_completed_at = COALESCE(practice_completed_at, created_at);
