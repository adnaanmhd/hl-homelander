-- 0002_auth_nonces.sql — Phase 1 plan 05: nonce store for Play Integrity replay protection
-- Source: RESEARCH.md §2.6

CREATE TABLE IF NOT EXISTS auth_nonces (
  id varchar(26) PRIMARY KEY,
  nonce_sha256 varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_nonces_expires_idx ON auth_nonces (expires_at);
