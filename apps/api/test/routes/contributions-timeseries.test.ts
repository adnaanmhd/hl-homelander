// GET /contributions/timeseries — Phase 6 plan 06-03 extensions (D-03 + D-03a).
//
// The Phase-1 happy-path daily-buckets coverage lives in contributions.test.ts;
// this file covers the new surface:
//   - aggregate=true → ONE summed bucket from recordings table directly
//   - aggregate=true correctly counts COUNT(DISTINCT task_id) (no double-count)
//   - aggregate=true windowed by start/end
//   - aggregate=false (default) still returns the daily-buckets shape

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTCNTS000000000000000US';
const TEST_TASK_ID_1 = '01HVTCNTS000000000000000T1';
const TEST_TASK_ID_2 = '01HVTCNTS000000000000000T2';

function tok(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
      integrity_verdict: 'passed',
      token_version: 1,
      installationId: 'inst-test',
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
      googleSub: 'g-cnts',
      email: 'cnts@e.com',
      name: 'CNTS',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  for (const tid of [TEST_TASK_ID_1, TEST_TASK_ID_2]) {
    await db.execute(sql`
      INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
      VALUES (${tid}, ${`cnts-${tid.slice(-2)}`}, 'CntsTask', 'd', 'C', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384))
      ON CONFLICT DO NOTHING
    `);
  }
});

afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.contributions).where(eq(schema.contributions.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  for (const tid of [TEST_TASK_ID_1, TEST_TASK_ID_2]) {
    await db.delete(schema.tasks).where(eq(schema.tasks.id, tid));
  }
  await app.close();
});

beforeEach(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.contributions).where(eq(schema.contributions.userId, TEST_USER_ID));
});

async function seedRec(opts: {
  taskId: string;
  qaStatus: 'verified' | 'uploaded' | 'takedown' | 'rejected';
  durationMs: number;
}): Promise<string> {
  const id = ulid();
  await db.insert(schema.recordings).values({
    id,
    userId: TEST_USER_ID,
    taskId: opts.taskId,
    practice: false,
    qaStatus: opts.qaStatus,
    durationMs: opts.durationMs,
    fileSizeBytes: 1024,
    imuSizeBytes: 1024,
    s3KeyVideo: 'k1',
    s3KeyImu: 'k2',
    s3KeyMetadata: 'k3',
    capturedAt: new Date(),
    flavor: 'playStore',
  });
  return id;
}

describe('GET /contributions/timeseries — D-03a aggregate variant', () => {
  it('aggregate=true&range=30d returns exactly ONE bucket', async () => {
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'verified', durationMs: 60_000 });
    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?aggregate=true&range=30d',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.buckets).toHaveLength(1);
    const b = body.buckets[0];
    expect(b).toHaveProperty('bucketDate');
    expect(b).toHaveProperty('durationMs');
    expect(b).toHaveProperty('recordingCount');
    expect(b).toHaveProperty('taskCount');
  });

  it('aggregate=true correctly counts COUNT(DISTINCT task_id) — 3 recordings, 2 tasks → taskCount=2', async () => {
    // 3 rows on 2 distinct tasks. Sum daily buckets would double-count tasks
    // recurring across days; aggregate=true queries recordings directly so
    // COUNT(DISTINCT task_id) is exact.
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'verified', durationMs: 60_000 });
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'uploaded', durationMs: 45_000 });
    await seedRec({ taskId: TEST_TASK_ID_2, qaStatus: 'verified', durationMs: 30_000 });
    // takedown / rejected are excluded by the WHERE NOT IN clause
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'takedown', durationMs: 99_999 });
    await seedRec({ taskId: TEST_TASK_ID_2, qaStatus: 'rejected', durationMs: 99_999 });

    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?aggregate=true&range=30d',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json().buckets[0];
    expect(b.recordingCount).toBe(3);
    expect(b.taskCount).toBe(2);
    expect(b.durationMs).toBe(60_000 + 45_000 + 30_000);
  });

  it('aggregate=false (default) returns the daily-buckets shape (Phase 1 surface unchanged)', async () => {
    // Insert recordings — the migration-0004 trigger writes the contributions
    // daily-buckets row. Read it back the Phase-1 way.
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'verified', durationMs: 60_000 });
    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?range=30d',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(Array.isArray(body.buckets)).toBe(true);
    expect(body.buckets.length).toBeGreaterThan(0);
    const today = body.buckets[body.buckets.length - 1];
    expect(today.recordingCount).toBe(1);
    expect(today.durationMs).toBe(60_000);
  });

  it('aggregate=true with explicit start/end narrows the window', async () => {
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'verified', durationMs: 60_000 });
    // Window in the FAR FUTURE excludes today's row → all zeros.
    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?aggregate=true&start=2099-01-01&end=2099-01-02',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json().buckets[0];
    expect(b.recordingCount).toBe(0);
    expect(b.taskCount).toBe(0);
    expect(b.durationMs).toBe(0);
    expect(b.bucketDate).toBe('2099-01-01'); // bucketDate anchors at `start`
  });

  it('aggregate=true honors Accept-Timezone for the window edges', async () => {
    await seedRec({ taskId: TEST_TASK_ID_1, qaStatus: 'verified', durationMs: 60_000 });
    // A window of yesterday→tomorrow in any TZ must include today's row.
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const fmt = (d: Date): string => d.toISOString().slice(0, 10);
    const r = await app.inject({
      method: 'GET',
      url: `/contributions/timeseries?aggregate=true&start=${fmt(yesterday)}&end=${fmt(tomorrow)}`,
      headers: { authorization: `Bearer ${tok()}`, 'accept-timezone': 'Asia/Kolkata' },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json().buckets[0];
    expect(b.recordingCount).toBe(1);
  });

  it('unknown Accept-Timezone → 400 problem-detail', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/contributions/timeseries?aggregate=true&range=30d',
      headers: { authorization: `Bearer ${tok()}`, 'accept-timezone': 'Made/Up_TZ' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(r.json().title).toMatch(/Invalid Accept-Timezone/);
  });
});
