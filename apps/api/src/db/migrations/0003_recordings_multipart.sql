-- 0003_recordings_multipart.sql — add multipart-upload tracking columns to recordings
-- and create the recordings_to_verify queue stub for Phase 5's hash-verify worker.
-- Also extends the qa_status enum with 'rejected' so /recordings/:id/reject can
-- transition rows when the client cancels a multipart upload (plan 01-07).

-- Extend qa_status enum with 'rejected'. Idempotent across re-runs; ordered
-- BEFORE the takedown sentinel since takedown is the terminal/legal disposition.
ALTER TYPE qa_status ADD VALUE IF NOT EXISTS 'rejected' BEFORE 'takedown';

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS s3_upload_id text,
  ADD COLUMN IF NOT EXISTS parts_count integer;

CREATE TABLE IF NOT EXISTS recordings_to_verify (
  recording_id varchar(26) PRIMARY KEY REFERENCES recordings(id) ON DELETE CASCADE,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
