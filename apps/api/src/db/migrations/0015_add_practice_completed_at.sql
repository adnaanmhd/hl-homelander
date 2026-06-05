-- 0015 — Bug 5 / D7 (2026-06-04): persist practice-tutorial completion.
--
-- Adds users.practice_completed_at — set once (idempotent) when the user
-- reaches PracticeComplete (POST /me/practice-complete). GET /me surfaces it so
-- a fresh install / new device skips the tutorial forever: the client seeds its
-- local ONB-08 flag (tutorial.practice_done.{sub}.v1) from this on the first
-- /me read. Independent of whether the practice clip uploads (D7).
--
-- Nullable: existing rows + users who haven't finished practice carry NULL.
-- IF NOT EXISTS keeps the ADD idempotent across reruns.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "practice_completed_at" timestamptz;
