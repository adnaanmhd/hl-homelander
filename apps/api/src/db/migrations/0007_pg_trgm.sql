-- 0007 — Phase 6 plan 06-02 (D-02)
-- pg_trgm extension — fuzzy-fallback for /tasks/search when ts_vector returns
-- zero rows. Threshold is hard-coded to 0.3 in the route WHERE clause (NOT relying on
-- the session-level pg_trgm.similarity_threshold default — Pitfall 4 in 06-RESEARCH.md).
-- A GIN trigram index on tasks.name is OPTIONAL on a 65-row catalog; left out until
-- measured as a regression on the seeded prod-shape fixture.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optional, defer until measured:
-- CREATE INDEX IF NOT EXISTS tasks_name_trgm_idx
--   ON tasks USING gin (name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS tasks_desc_trgm_idx
--   ON tasks USING gin (description gin_trgm_ops);
