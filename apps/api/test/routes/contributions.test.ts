// GET /contributions + GET /contributions/timeseries — API-10. Asserts the
// D-LEGAL-04 takedown filter, lifetime aggregate counts, per-task breakdown,
// and that the timeseries returns at least one bucket from the migration-0004
// trigger (which fires on recordings INSERT).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTCN0000000000000000000';
const TEST_TASK_ID = '01HVTCN0000000000000000T01';

function tok(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      integrity_verdict: 'passed',
      token_version: 1,
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-contrib',
      email: 'c@e.com',
      name: 'C',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(sql`
    INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
    VALUES (${TEST_TASK_ID}, 'cn-test', 'CnTest', 'd', 'C', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384))
    ON CONFLICT DO NOTHING
  `);

  // Insert two recordings — one verified, one takedown (filtered).
  await db.insert(schema.recordings).values([
    {
      id: ulid(),
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'verified',
      durationMs: 60000,
      fileSha256: 'a'.repeat(64),
      imuSha256: 'b'.repeat(64),
      fileSizeBytes: 1024,
      imuSizeBytes: 1024,
      s3KeyVideo: 'k1',
      s3KeyImu: 'k2',
      s3KeyMetadata: 'k3',
      capturedAt: new Date(),
      flavor: 'playStore',
    },
    {
      id: ulid(),
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'takedown',
      durationMs: 99999,
      fileSha256: 'c'.repeat(64),
      imuSha256: 'd'.repeat(64),
      fileSizeBytes: 1024,
      imuSizeBytes: 1024,
      s3KeyVideo: 'k4',
      s3KeyImu: 'k5',
      s3KeyMetadata: 'k6',
      capturedAt: new Date(),
      flavor: 'playStore',
    },
  ]);
});
afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.contributions).where(eq(schema.contributions.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

describe('GET /contributions + /contributions/timeseries', () => {
  it('lifetime aggregate excludes takedown rows (D-LEGAL-04)', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/contributions',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().recordingCount).toBe(1);
    expect(r.json().durationMs).toBe(60000);
    expect(r.json().taskCount).toBe(1);
    expect(r.json().perTask[0].taskId).toBe(TEST_TASK_ID);
  });

  it('timeseries returns at least one daily bucket (migration 0004 trigger)', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?range=30d',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    expect(Array.isArray(r.json().buckets)).toBe(true);
    expect(r.json().buckets.length).toBeGreaterThan(0);
    const today = r.json().buckets[r.json().buckets.length - 1];
    // Trigger filtered the takedown row, so today's bucket has recordingCount=1.
    expect(today.recordingCount).toBe(1);
  });

  it('rejects unauthenticated → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/contributions' });
    expect(r.statusCode).toBe(401);
  });
});
