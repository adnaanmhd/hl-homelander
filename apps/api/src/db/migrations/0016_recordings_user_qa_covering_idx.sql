-- 0016 — Bug 10 (2026-06-04): covering index for GET /contributions.
--
-- The two per-user aggregate scans in routes/contributions/list.ts filter
-- `WHERE user_id = ? AND qa_status NOT IN ('takedown','rejected')` and sum
-- duration_ms + count distinct task_id. Before this index the only usable index
-- was (user_id, captured_at), forcing a per-user heap scan that grows with a
-- heavy contributor's recording count. This covering index lets Postgres serve
-- both queries from an index-only scan (the INCLUDE payload carries duration_ms
-- + task_id so the heap is never touched).
--
-- Paired with pg pool connectionTimeoutMillis + statement_timeout (db/index.ts)
-- so a slow/contended query fails fast (5xx → client Retry) instead of hanging
-- past the client's 30s transport abort.
--
-- IF NOT EXISTS keeps the migration idempotent across reruns. Plain (not
-- CONCURRENTLY) so it runs inside the migration runner's transaction; the dev
-- table is small and prod builds this once at deploy.

CREATE INDEX IF NOT EXISTS "recordings_user_qa_idx"
  ON "recordings" ("user_id", "qa_status")
  INCLUDE ("duration_ms", "task_id");
