-- 0008 — Phase 6 manual-smoke discovery 2026-05-14
-- Regenerate tasks.name_search to include category alongside name + description.
--
-- The original Phase 1 generated column indexed only name + description, so a
-- search for `kitchen` returned only the 2 tasks with "kitchen" literally in
-- their name. Owner expectation (raised during 06-MANUAL-SMOKE §2): a search
-- term should ALSO match category, so `kitchen` returns all Kitchen-category
-- tasks (Setting a table, Clearing a table, Organizing spice rack, etc.).
--
-- This migration drops + recreates name_search with category appended. The
-- existing GIN index `tasks_name_search_gin_idx` is preserved automatically by
-- the generated-column re-add (Postgres re-stores all rows on column ADD with
-- GENERATED ALWAYS AS ... STORED, and indexes pointing at the column rebuild
-- transparently because the column name + type are identical).

ALTER TABLE tasks
  DROP COLUMN name_search;

ALTER TABLE tasks
  ADD COLUMN name_search tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english'::regconfig,
      COALESCE(name, ''::text)        || ' ' ||
      COALESCE(description, ''::text) || ' ' ||
      COALESCE(category, ''::varchar)::text
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS tasks_name_search_gin_idx
  ON tasks USING gin (name_search);
