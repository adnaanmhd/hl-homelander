// 0018_backfill_practice_all_users — Bug 2 (2026-06-10, owner decision:
// backfill ALL existing users, not just those with recordings).
//
// Runs the ACTUAL migration SQL (read from the .sql file) against seeded
// cohorts and asserts the contract:
//   D — NO recording, practice NULL → backfilled to D.created_at (the cohort
//       0017 missed — staging's broken-upload week meant practiced users had
//       zero recordings rows)
//   E — practice already SET → preserved, NOT overwritten (COALESCE)
//   idempotency — a re-run changes nothing.
//
// The UPDATE is global over `users` (its production behavior). Safe here: it
// only fills NULLs with the row's own created_at, and every other test that
// asserts a NULL practice_completed_at seeds its user AFTER this file ran
// (vitest singleFork runs files sequentially; rows created later are
// untouched).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../../src/db/index.js';

const USER_D = ulid();
const USER_E = ulid();
const E_PRACTICE_AT = new Date('2025-03-04T05:06:07.000Z');

const MIGRATION_URL = new URL(
  '../../src/db/migrations/0018_backfill_practice_all_users.sql',
  import.meta.url,
);

let dCreatedAt: Date;

async function seedUser(id: string, label: string, practiceCompletedAt: Date | null) {
  await db
    .insert(schema.users)
    .values({
      id,
      googleSub: `g-0018-${label}`,
      email: `0018-${label}@e.test`,
      name: '0018',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      practiceCompletedAt,
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

beforeAll(async () => {
  await seedUser(USER_D, 'd-no-rec-null', null);
  await seedUser(USER_E, 'e-preset', E_PRACTICE_AT);
  const [d] = await db
    .select({ c: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, USER_D));
  dCreatedAt = d!.c;
});

afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, USER_D));
  await db.delete(schema.users).where(eq(schema.users.id, USER_E));
});

describe('0018_backfill_practice_all_users (Bug 2, 2026-06-10)', () => {
  it('stamps EVERY null practice_completed_at — including zero-recording users — and preserves set values', async () => {
    const sqlText = await readFile(MIGRATION_URL, 'utf8');
    await db.execute(sql.raw(sqlText));

    // D (no recordings, was NULL — the 0017 gap) → stamped with created_at.
    const dAfter = await practiceAt(USER_D);
    expect(dAfter).not.toBeNull();
    expect(dAfter!.getTime()).toBe(dCreatedAt.getTime());

    // E (already set) → preserved verbatim.
    const eAfter = await practiceAt(USER_E);
    expect(eAfter!.getTime()).toBe(E_PRACTICE_AT.getTime());
  });

  it('is idempotent — a re-run changes nothing', async () => {
    const before = await practiceAt(USER_D);
    const sqlText = await readFile(MIGRATION_URL, 'utf8');
    await db.execute(sql.raw(sqlText));
    const after = await practiceAt(USER_D);
    expect(after!.getTime()).toBe(before!.getTime());
    const eAfter = await practiceAt(USER_E);
    expect(eAfter!.getTime()).toBe(E_PRACTICE_AT.getTime());
  });
});
