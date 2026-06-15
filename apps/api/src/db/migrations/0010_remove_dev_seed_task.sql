-- 0010 — Enh 2 / D8 (2026-06-04): remove the dev-affordance task.
--
-- The __DEV__ Tasks-tab long-press + DEBUG_TEST_TASK client affordance, the
-- scripts/seed-dev-task.ts seed, and the seed:dev-task / posttest re-seed hooks
-- are all deleted in the same change. This purges the row they created.
--
-- recordings.task_id -> tasks.id is ON DELETE RESTRICT, so any dev recordings
-- must be removed first; their dependents (recordings_to_verify,
-- recording_events_outbox — multipart-upload state lives as the s3_upload_id /
-- parts_count COLUMNS on recordings, not a child table) are ON DELETE CASCADE
-- and go with them. Idempotent: both DELETEs are no-ops on a DB that never ran the
-- dev seed (prod never did — the seed was dev-only). The idempotent migration
-- runner (apps/api/scripts/migrate.ts) applies this exactly once.

DELETE FROM recordings WHERE task_id = '01HVDEVSEEDTASK00000000000';
DELETE FROM tasks WHERE id = '01HVDEVSEEDTASK00000000000';
