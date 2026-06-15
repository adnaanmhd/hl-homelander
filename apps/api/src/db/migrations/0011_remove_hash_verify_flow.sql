-- 0011 — Enh 3 / D1 (2026-06-04): remove the hash-verify flow + all upload hashing.
--
-- The server hash-verify worker, its BullMQ/Redis queue, the SQS poller, the
-- events-outbox plugin, and the verify-sweep cron were all deleted in code.
-- `uploaded` is now the TERMINAL success state. This migration drops the schema
-- objects they used:
--   * recordings_to_verify        — the verify queue stub (FK→recordings cascade)
--   * recording_events_outbox     — the server→client status-event outbox
--   * recording_event_type enum   — only used by recording_events_outbox
--   * recordings.file_sha256 / imu_sha256 — device+server upload hashing (D1)
--   * recordings.verified_at      — no verify step anymore
--
-- The qa_status enum KEEPS its legacy 'verified' / 'hash-mismatch' values —
-- Postgres can't cheaply drop enum values, and pre-existing rows in those states
-- are read as terminal-success synonyms. Nothing writes them after this.
--
-- Idempotent (IF EXISTS throughout). The custom runner (scripts/migrate.ts)
-- applies it exactly once. Drop the outbox table BEFORE the enum it depends on.

DROP TABLE IF EXISTS recording_events_outbox;
DROP TABLE IF EXISTS recordings_to_verify;
DROP TYPE IF EXISTS recording_event_type;

ALTER TABLE recordings DROP COLUMN IF EXISTS file_sha256;
ALTER TABLE recordings DROP COLUMN IF EXISTS imu_sha256;
ALTER TABLE recordings DROP COLUMN IF EXISTS verified_at;
