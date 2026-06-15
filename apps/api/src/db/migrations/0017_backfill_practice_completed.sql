-- 0017 — Bug 6 (2026-06-09): backfill practice_completed_at for existing users.
--
-- 0015 added users.practice_completed_at NULLABLE with NO backfill, so every
-- user who completed the practice tutorial BEFORE that feature shipped carries
-- NULL. On a reinstall/new-device their local ONB-08 flag is wiped and re-seeded
-- from GET /me — but a NULL seed forces them through practice ONE more time.
--
-- Anyone with >= 1 recording row provably passed practice: the only entry points
-- to a real-task recording (Home / Tasks) live inside MainTabs, which the client
-- boot gate reaches ONLY after practice completion (initialRoute.ts step 5); and
-- practice clips never enqueue an upload (guarded JS-side + native), so they never
-- create a row. (This is client-flow enforcement, not a server check in init.ts —
-- but the production population can only have rows for accounts that practiced.)
-- So we set practice_completed_at = created_at (a safe lower bound for "completed
-- by") for every user who has any recording.
--
-- COALESCE keeps it idempotent + non-destructive: a user who already has a
-- non-null practice_completed_at (finished practice post-feature) is preserved,
-- not overwritten. Re-running is a no-op. created_at is NOT NULL (defaultNow),
-- so the backfilled value is always well-defined. The runner applies this once
-- (apps/api/scripts/migrate.ts), but the statement is safe under reruns.
--
-- D-PRACTICE (owner, 2026-06-09): backfill users with >= 1 uploaded recording.
-- "Any recordings row" and ">= 1 upload" coincide — a row only exists post-/init,
-- reachable only after practice in the client flow. (recordings_user_captured_idx /
-- recordings_user_qa_idx already serve the DISTINCT scan; no new index needed.)

UPDATE users
SET practice_completed_at = COALESCE(practice_completed_at, created_at)
WHERE id IN (SELECT DISTINCT user_id FROM recordings);
