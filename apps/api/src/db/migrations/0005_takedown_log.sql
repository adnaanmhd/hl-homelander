-- 0005 — Phase 1 plan 11
-- takedown_log: ANPD/DPB takedown audit table per D-LEGAL-04.
-- dsr_log: DSR access/portability fulfillment audit per D-LEGAL-02 (mailto flow).
--
-- Both tables are append-only by code convention (no UPDATE/DELETE in any
-- backend handler at MVP). Counsel relies on these for regulator-side
-- response-window evidence + DSR audit trail. Phase 5+ may add a row-level
-- trigger to refuse mutation.
--
-- IF NOT EXISTS guards keep the migration idempotent — re-running on an
-- already-migrated DB is a no-op.

CREATE TABLE IF NOT EXISTS takedown_log (
  id varchar(26) PRIMARY KEY,
  request_received_at timestamptz NOT NULL,
  request_authority varchar(80) NOT NULL,
  affected_user_id varchar(26) REFERENCES users(id) ON DELETE SET NULL,
  affected_recording_ids jsonb NOT NULL,
  action_taken text NOT NULL,
  completed_at timestamptz,
  counsel_reviewer varchar(120),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS takedown_log_received_idx ON takedown_log (request_received_at);
CREATE INDEX IF NOT EXISTS takedown_log_user_idx ON takedown_log (affected_user_id);

CREATE TABLE IF NOT EXISTS dsr_log (
  id varchar(26) PRIMARY KEY,
  user_id varchar(26) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  request_type varchar(32) NOT NULL,
  request_received_at timestamptz NOT NULL,
  fulfilled_at timestamptz,
  ops_engineer varchar(120),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dsr_log_user_idx ON dsr_log (user_id);
