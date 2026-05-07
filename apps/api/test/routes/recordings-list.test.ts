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
});
