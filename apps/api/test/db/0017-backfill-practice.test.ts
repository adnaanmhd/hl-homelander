// 0017_backfill_practice_completed — Bug 6 (2026-06-09).
//
// Runs the ACTUAL migration SQL (read from the .sql file, not a copy) against
// three seeded cohorts and asserts the backfill contract:
//   A — has a recording, practice NULL  → backfilled to A.created_at
//   B — no recording,    practice NULL  → stays NULL (never practiced/uploaded)
//   C — has a recording, practice SET   → preserved, NOT overwritten (COALESCE)
//
// The migration's UPDATE is intentionally GLOBAL (all users with >=1 recording),
// which is its production behavior. That is safe here: no other test asserts
// practice_completed_at for a user that has a recording (me-practice-complete's
// user has none), and COALESCE only fills NULLs — it never clobbers existing
// values. Re-running is a no-op (idempotency is asserted below).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../../src/db/index.js';

const USER_A = ulid();
const USER_B = ulid();
const USER_C = ulid();
const TASK_ID = ulid();
const REC_A = ulid();
const REC_C = ulid();
const C_PRACTICE_AT = new Date('2025-01-02T03:04:05.000Z');

const MIGRATION_URL = new URL(
  '../../src/db/migrations/0017_backfill_practice_completed.sql',
  import.meta.url,
);

let aCreatedAt: Date;

async function seedUser(id: string, label: string, practiceCompletedAt: Date | null) {
  await db
    .insert(schema.users)
    .values({
      id,
      googleSub: `g-0017-${label}`,
      email: `0017-${label}@e.test`,
      name: '0017',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      practiceCompletedAt,
    })
    .onConflictDoNothing();
}

async function seedRecording(id: string, userId: string) {
  await db
    .insert(schema.recordings)
    .values({
      id,
      userId,
      taskId: TASK_ID,
      practice: false,
      qaStatus: 'uploaded',
      durationMs: 1000,
      fileSizeBytes: 1024,
      imuSizeBytes: 64,
      s3KeyVideo: `recordings/${userId}/${id}/video.mp4`,
      s3KeyImu: `recordings/${userId}/${id}/imu.csv`,
      s3KeyMetadata: `recordings/${userId}/${id}/metadata.json`,
      capturedAt: new Date(),
      flavor: 'playStore',
    })
    .onConflictDoNothing();
}

async function practiceAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ p: schema.users.practiceCompletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row?.p ?? null;
}

async function runMigration() {
  const migrationSql = await readFile(MIGRATION_URL, 'utf8');
  await db.execute(sql.raw(migrationSql));
}

async function cleanup() {
  // recordings first (FK → users/tasks is ON DELETE RESTRICT); contributions
  // rows the insert-trigger created cascade on the user delete.
  await db.delete(schema.recordings).where(eq(schema.recordings.taskId, TASK_ID));
  for (const id of [USER_A, USER_B, USER_C]) {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
}

beforeAll(async () => {
  await cleanup();
  // tasks.embedding is a pgvector column drizzle can't insert directly — raw SQL.
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, ${`s-0017-${TASK_ID.slice(-6)}`}, '0017 Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await seedUser(USER_A, 'a', null);
  await seedUser(USER_B, 'b', null);
  await seedUser(USER_C, 'c', C_PRACTICE_AT);
  await seedRecording(REC_A, USER_A);
  await seedRecording(REC_C, USER_C);

  // Capture A.created_at BEFORE the migration so we can assert the backfilled
  // practice_completed_at equals it.
  const [a] = await db
    .select({ createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, USER_A));
  aCreatedAt = a!.createdAt;

  await runMigration();
});

afterAll(async () => {
  await cleanup();
});

describe('0017_backfill_practice_completed (Bug 6)', () => {
  it('backfills a user WITH a recording to created_at', async () => {
    const p = await practiceAt(USER_A);
    expect(p).not.toBeNull();
    expect(p!.getTime()).toBe(aCreatedAt.getTime());
  });

  it('leaves a user WITHOUT any recording NULL', async () => {
    expect(await practiceAt(USER_B)).toBeNull();
  });

  it('preserves an already-set practice_completed_at (non-destructive COALESCE)', async () => {
    const p = await practiceAt(USER_C);
    expect(p).not.toBeNull();
    expect(p!.getTime()).toBe(C_PRACTICE_AT.getTime());
  });

  it('is idempotent — re-running changes nothing', async () => {
    await runMigration();
    expect((await practiceAt(USER_A))!.getTime()).toBe(aCreatedAt.getTime());
    expect(await practiceAt(USER_B)).toBeNull();
    expect((await practiceAt(USER_C))!.getTime()).toBe(C_PRACTICE_AT.getTime());
  });
});
