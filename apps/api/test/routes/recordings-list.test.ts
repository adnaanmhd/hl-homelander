import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTRECL000000000000000US';
const TEST_TASK_ID = '01HVTRECL00000000000000TSK';

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
      googleSub: 'g-list',
      email: 'l@e.com',
      name: 'L',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'list-test', 'List Test', 'desc', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});
afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});
beforeEach(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
});

async function seedRec(
  qaStatus: 'pending' | 'uploaded' | 'verified' | 'takedown' | 'rejected' = 'uploaded',
  daysAgo = 0,
): Promise<string> {
  const id = ulid();
  await db.execute(sql`
    INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_sha256, imu_sha256, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, created_at, flavor)
    VALUES (${id}, ${TEST_USER_ID}, ${TEST_TASK_ID}, false, ${qaStatus}::qa_status, 1000, ${'a'.repeat(64)}, ${'b'.repeat(64)}, 1024, 1024, 'k1', 'k2', 'k3', now(), now() - (${daysAgo} || ' days')::interval, 'playStore'::build_flavor)
  `);
  return id;
}

// Phase 6 plan 06-03 extension — seed at an explicit timestamptz so the
// start/end window tests can hit exact midnight boundaries deterministically.
async function seedRecAt(qaStatus: 'uploaded' | 'verified', createdAt: Date): Promise<string> {
  const id = ulid();
  await db.execute(sql`
    INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_sha256, imu_sha256, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, created_at, flavor)
    VALUES (${id}, ${TEST_USER_ID}, ${TEST_TASK_ID}, false, ${qaStatus}::qa_status, 1000, ${'a'.repeat(64)}, ${'b'.repeat(64)}, 1024, 1024, 'k1', 'k2', 'k3', ${createdAt.toISOString()}::timestamptz, ${createdAt.toISOString()}::timestamptz, 'playStore'::build_flavor)
  `);
  return id;
}

describe('GET /recordings', () => {
  it('empty state → items=[], next_cursor=null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/recordings',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], next_cursor: null });
  });

  it('excludes qa_status=takedown rows', async () => {
    await seedRec('uploaded');
    await seedRec('takedown');
    const res = await app.inject({
      method: 'GET',
      url: '/recordings',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].qa_status).toBe('uploaded');
  });

  it('range=7d filters out a 30-day-old recording', async () => {
    await seedRec('uploaded', 30); // 30 days ago — outside 7d window
    await seedRec('uploaded', 1); // 1 day ago — inside 7d window
    const res = await app.inject({
      method: 'GET',
      url: '/recordings?range=7d',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.json().items).toHaveLength(1);
  });

  it('pagination cursor round-trip — first page next_cursor → second page', async () => {
    for (let i = 0; i < 5; i++) await seedRec('uploaded', i); // 5 recordings, varying ages
    const r1 = await app.inject({
      method: 'GET',
      url: '/recordings?limit=2',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r1.json().items).toHaveLength(2);
    expect(r1.json().next_cursor).toBeTruthy();
    const r2 = await app.inject({
      method: 'GET',
      url: `/recordings?limit=2&cursor=${r1.json().next_cursor}`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r2.json().items).toHaveLength(2);
    // No id overlap between page 1 and page 2
    const ids1 = r1.json().items.map((x: { recording_id: string }) => x.recording_id);
    const ids2 = r2.json().items.map((x: { recording_id: string }) => x.recording_id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
  });

  it('rejects unauthenticated → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/recordings' });
    expect(res.statusCode).toBe(401);
  });

  // Phase 6 plan 06-03 — D-03 + D-03b (start/end + Accept-Timezone)
  describe('D-03 — start/end + Accept-Timezone', () => {
    it('start/end window filters by date precedence over range', async () => {
      // Seed three rows at known timestamps. Window: 2026-04-15 → 2026-04-20
      // (exclusive end). Only the middle one is in-window.
      await seedRecAt('uploaded', new Date('2026-04-10T12:00:00Z')); // out (before)
      await seedRecAt('uploaded', new Date('2026-04-17T12:00:00Z')); // IN
      await seedRecAt('uploaded', new Date('2026-04-20T00:00:00Z')); // out (== end → excluded)
      const res = await app.inject({
        method: 'GET',
        url: '/recordings?start=2026-04-15&end=2026-04-20&range=7d', // start/end takes precedence over range
        headers: { authorization: `Bearer ${tok()}` },
      });
      expect(res.statusCode).toBe(200);
      const items = res.json().items;
      expect(items).toHaveLength(1);
      expect(items[0].created_at).toMatch(/^2026-04-17T/);
    });

    it('invalid start=not-a-date → 400 (zod regex rejects)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/recordings?start=not-a-date&end=2026-04-20',
        headers: { authorization: `Bearer ${tok()}` },
      });
      expect(res.statusCode).toBe(400);
    });

    it('unknown Accept-Timezone → 400 problem-detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/recordings',
        headers: {
          authorization: `Bearer ${tok()}`,
          'accept-timezone': 'Made/Up_TZ',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      const body = res.json();
      expect(body.title).toMatch(/Invalid Accept-Timezone/);
      expect(body.detail).toMatch(/Made\/Up_TZ/);
    });

    it('Asia/Kolkata IST midnight boundaries filter correctly', async () => {
      // IST = UTC+5:30. A row at 2026-05-13T18:31:00Z is 2026-05-14T00:01:00 IST,
      // so a window of start=2026-05-14 end=2026-05-15 in IST INCLUDES it.
      // A row at 2026-05-13T18:29:00Z is 2026-05-13T23:59:00 IST, EXCLUDED.
      await seedRecAt('uploaded', new Date('2026-05-13T18:31:00Z')); // IN (2026-05-14 IST)
      await seedRecAt('uploaded', new Date('2026-05-13T18:29:00Z')); // OUT (2026-05-13 IST)
      const res = await app.inject({
        method: 'GET',
        url: '/recordings?start=2026-05-14&end=2026-05-15',
        headers: {
          authorization: `Bearer ${tok()}`,
          'accept-timezone': 'Asia/Kolkata',
        },
      });
      expect(res.statusCode).toBe(200);
      const items = res.json().items;
      expect(items).toHaveLength(1);
      expect(items[0].created_at).toBe('2026-05-13T18:31:00.000Z');
    });

    it('valid Accept-Timezone (UTC) with no start/end is a no-op', async () => {
      await seedRecAt('uploaded', new Date());
      const res = await app.inject({
        method: 'GET',
        url: '/recordings',
        headers: {
          authorization: `Bearer ${tok()}`,
          'accept-timezone': 'UTC',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toHaveLength(1);
    });
  });
});
