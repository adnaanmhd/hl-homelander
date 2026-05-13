// Idempotent canonical dev-task seed — runs via `pnpm --filter @humyn/api seed:dev-task`.
//
// Why this exists
// ---------------
// The `__DEV__` Tasks-tab long-press affordance (`TasksPlaceholderScreen.tsx`,
// added in Phase 4 plan 04-08 / D-NAV-02) pushes the Recording route with a
// hardcoded non-practice task so engineers — and the Phase-5 upload-smoke
// runbook §2 — can exercise the real recording + upload path without the full
// onboarding/practice flow. The upload coordinator's `POST /recordings/init`
// body is validated by `RecordingsInitRequestSchema` (`taskId: z.string().length(26)`)
// and `recordings.task_id` has an FK → `tasks.id ON DELETE RESTRICT`, so the
// debug task's `taskId` MUST be a 26-char `tasks.id` that actually exists in the
// DB. This script guarantees one with a FIXED ULID so the mobile constant can
// point at it deterministically (no coupling to whatever else is in the dev DB).
//
// The fixed ULID `01HVDEVSEEDTASK00000000000` is a valid 26-char ULID-shaped id
// (Crockford base32, no I/L/O/U) reserved for this dev seed. `DEBUG_TEST_TASK.taskId`
// in `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` MUST match it.
//
// Idempotent: `ON CONFLICT (id) DO UPDATE` rewrites every column on each run, so
// re-running is a no-op end-state. No embedding model is invoked — the dev task
// isn't meant to surface in task search, so it gets a zero vector(384) (the
// column is `NOT NULL`; a zero vector is a valid value and never beats a real
// task on cosine distance).
//
// NOT shipped to prod. This is a dev-only convenience; prod task data comes from
// `seed-tasks.ts` (the 65-row taxonomy seed). Guarded by DATABASE_URL like the
// other seed scripts — point it at the dev DB only.

import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

// The reserved canonical dev-task id — keep in lockstep with
// `DEBUG_TEST_TASK.taskId` in apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx.
export const DEV_TASK_ID = '01HVDEVSEEDTASK00000000000';

const ZERO_EMBEDDING = `[${Array.from({ length: 384 }, () => 0).join(',')}]`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[seed-dev-task] DATABASE_URL not set');
    process.exit(1);
  }

  await db.execute(sql`
    INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
    VALUES (
      ${DEV_TASK_ID},
      ${'dev-seed-chop-vegetables'},
      ${'Dev — Chop vegetables'},
      ${'Canonical dev/QA task used by the __DEV__ Tasks-tab long-press affordance and the Phase-5 upload-smoke runbook. Not a real taxonomy task.'},
      ${'cooking'},
      ${'indoor'}::task_setting,
      ${'chef-hat'},
      ${JSON.stringify(['This is the dev test task — record ≥60 s and stop to exercise the upload path.'])}::jsonb,
      ${ZERO_EMBEDDING}::vector(384)
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      setting = EXCLUDED.setting,
      icon_key = EXCLUDED.icon_key,
      instructions = EXCLUDED.instructions,
      embedding = EXCLUDED.embedding,
      updated_at = now()
  `);

  console.log(
    `[seed-dev-task] upserted canonical dev task id=${DEV_TASK_ID} slug=dev-seed-chop-vegetables`,
  );
}

main().catch((err) => {
  console.error('[seed-dev-task] failed', err);
  process.exit(1);
});
