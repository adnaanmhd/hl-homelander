// E2E setup — runs once per vitest worker (singleFork, so once per `pnpm test:e2e` run).
//
// Responsibilities:
//   1. Sanity-check required env vars (DATABASE_URL, JWT_SIGNING_SECRET, AWS_*, RECORDINGS_BUCKET, FEEDBACK_BUCKET).
//   2. Pre-load the Hugging-Face embedder so the first /tasks/search call doesn't blow the per-test timeout
//      while the model is downloaded + warmed (~24 MB, 1-3s on Fargate t4g.medium).
//   3. Seed app_versions for /app/version (idempotent; skips on conflict).
//   4. Seed a small tasks fixture (4 rows) so /tasks/search has something to fuse over. Uses the exact same
//      embed() pipeline as scripts/seed-tasks.ts so HNSW recall stays consistent (Pattern 25).
//
// What we DO NOT do here:
//   - Apply migrations. Migrations are applied out-of-band by `pnpm db:migrate` in CI (see .github/workflows/api-ci.yml).
//   - Truncate per-test tables. That's per-test responsibility via helpers/seed-fixtures.ts#truncateTestTables().
//   - Build the Fastify app. Each test file calls buildApp() in its own beforeAll so vi.mock declarations are
//     scoped to that file.
// Per-worker e2e setup. Env vars are loaded in apps/api/test/e2e/global-setup.ts,
// which runs in the parent vitest process before any worker fork — workers
// inherit the env, so by the time this file's imports resolve, process.env
// already has DATABASE_URL / JWT_SIGNING_SECRET / AWS_* / etc.
//
// NODE_ENV=test gates the DSR cron (apps/api/src/app.ts) — without this, every
// buildApp() call in the e2e suite would spawn a background setInterval that
// keeps the worker alive past test completion + accumulates log noise.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

import { beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../../src/db/index.js';
import { seedAppVersions } from '../../src/routes/app-version/seed-initial.js';
import { preloadEmbedder, embed, buildEmbeddedText } from '../../src/lib/embedder.js';

beforeAll(async () => {
  // 1. Sanity-check required env vars. Missing any of these means the test will
  //    fail in unobvious ways (unauth'd S3 calls, JWT signing exceptions, etc.).
  const required = [
    'DATABASE_URL',
    'JWT_SIGNING_SECRET',
    'AWS_ENDPOINT_URL',
    'AWS_REGION',
    'RECORDINGS_BUCKET',
    'FEEDBACK_BUCKET',
  ];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`E2E setup: env var ${k} not set`);
  }

  // 2. Pre-load the embedder once. First test ran without this would hit the
  //    /tasks/search route → embed(query) → trigger model download (~24 MB) →
  //    likely exceed even the 120s testTimeout on a cold CI runner. Doing it here
  //    pays the cost up-front, inside the 120s hookTimeout.
  await preloadEmbedder();

  // 3. Seed app_versions (apkRollout, playStore, iosAppStore) idempotently.
  await seedAppVersions();

  // 4. Seed a small tasks fixture. Tests that exercise /tasks/search assert
  //    semantic results from these 4 rows. We delete + reinsert so this is
  //    deterministic across local + CI runs, even if a developer hand-loaded
  //    the full taxonomy via `pnpm seed:tasks`.
  await db.delete(schema.tasks);
  const fixtures = [
    {
      slug: 'make-tea',
      name: 'Make Tea',
      desc: 'Boil water and brew a cup of black tea.',
      cat: 'Cooking',
      setting: 'indoor' as const,
    },
    {
      slug: 'fold-laundry',
      name: 'Fold Laundry',
      desc: 'Sort and fold a basket of dry clothes.',
      cat: 'Cleaning',
      setting: 'indoor' as const,
    },
    {
      slug: 'change-bulb',
      name: 'Change Light Bulb',
      desc: 'Replace a burnt-out incandescent bulb.',
      cat: 'Maintenance',
      setting: 'indoor' as const,
    },
    {
      slug: 'water-plants',
      name: 'Water Plants',
      desc: 'Water indoor and balcony plants.',
      cat: 'Gardening',
      setting: 'either' as const,
    },
  ];
  for (const f of fixtures) {
    const e = await embed(
      buildEmbeddedText({ name: f.name, description: f.desc, category: f.cat }),
    );
    await db.execute(sql`
      INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
      VALUES (
        ${ulid()},
        ${f.slug},
        ${f.name},
        ${f.desc},
        ${f.cat},
        ${f.setting}::task_setting,
        'tea',
        '["step one"]'::jsonb,
        ${`[${e.join(',')}]`}::vector(384)
      )
    `);
  }
}, 120_000);

afterAll(async () => {
  // Best-effort cleanup. We tolerate any individual delete failing because the
  // worker may already be tearing down its DB pool.
  try {
    await db.delete(schema.recordingsToVerify);
    await db.delete(schema.recordings);
    await db.delete(schema.consentLog);
    await db.delete(schema.events);
    await db.delete(schema.feedback);
    await db.delete(schema.idempotencyKeys);
    await db.delete(schema.authNonces);
    await db.delete(schema.profiles);
    await db.delete(schema.users);
    await db.delete(schema.tasks);
  } catch {
    // ignore — pool may be closed
  }
});
