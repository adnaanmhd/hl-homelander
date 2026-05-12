-- 0006 — Phase 5 plan 05-03
-- recording_events_outbox: server→client recording-status events for the
-- hash-verify worker. The worker appends a row inside the qa_status-flip
-- transaction ('verified' on a hash match, 're-upload' on a hash-mismatch);
-- the `events-outbox` onSend hook (plan 05-05) drains undelivered rows for the
-- authenticated user and attaches them to the response, then sets delivered_at.
-- The client de-dups on (recording_id, event_type).
--
-- The partial index `WHERE delivered_at IS NULL` keeps the drain query cheap
-- once the table accumulates delivered rows (Drizzle can't express partial
-- indexes, so it's hand-written here).
--
-- Idempotent — re-running on an already-migrated DB is a no-op: the enum CREATE
-- is wrapped in a DO block, the table/index use IF NOT EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recording_event_type') THEN
    CREATE TYPE recording_event_type AS ENUM ('verified', 're-upload');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS recording_events_outbox (
  id            varchar(26) PRIMARY KEY,
  user_id       varchar(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id  varchar(26) NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_type    recording_event_type NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at  timestamptz
);

CREATE INDEX IF NOT EXISTS recording_events_outbox_user_undelivered_idx
  ON recording_events_outbox (user_id) WHERE delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS recording_events_outbox_user_created_idx
  ON recording_events_outbox (user_id, created_at);
