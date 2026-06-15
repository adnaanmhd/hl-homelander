// E2E recordings-list negatives — exercises GET /recordings filters that
// aren't covered in the golden path:
//
// 1. takedown rows are excluded from the list response (T-1.7-08, D-LEGAL-04)
// 2. pagination cursor round-trip — page 1 next_cursor maps to page 2 with
//    no row overlap
// 3. range=7d filters out a 30-day-old row
//
// We seed recordings via raw SQL because the route's /recordings/init flow
// is exercised in the golden path; here we just want rows in known states.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { setupAuthMocks } from './helpers/mock-play-integrity.js';
import { truncateTestTables, signInTestUser } from './helpers/seed-fixtures.js';

setupAuthMocks();
import { buildApp } from '../../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await truncateTestTables();
});

async function seedRec(opts: {
  userId: string;
  qaStatus: 'pending' | 'uploaded' | 'verified' | 'takedown' | 'rejected' | 'hash-mismatch';
  daysAgo?: number;
}): Promise<string> {
  const id = ulid();
  await db.execute(sql`
    INSERT INTO recordings (
      id, user_id, task_id, practice, qa_status, duration_ms,
      file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata,
      captured_at, created_at, flavor
    )
    VALUES (
      ${id},
      ${opts.userId},
      (SELECT id FROM tasks WHERE slug='make-tea' LIMIT 1),
      false,
      ${opts.qaStatus}::qa_status,
      1000,
      1024,
      1024,
      'k1',
      'k2',
      'k3',
      now(),
      now() - (${opts.daysAgo ?? 0} || ' days')::interval,
      'playStore'::build_flavor
    )
  `);
  return id;
}

describe('GET /recordings — negatives', () => {
  it('takedown row is excluded from the list response', async () => {
    const { token, userId } = await signInTestUser();
    await seedRec({ userId, qaStatus: 'uploaded' });
    await seedRec({ userId, qaStatus: 'takedown' });
    const r = await app.inject({
      method: 'GET',
      url: '/recordings',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ qa_status: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.qa_status).toBe('uploaded');
  });

  it('pagination cursor round-trip — page 1 next_cursor maps to page 2 with no overlap', async () => {
    const { token, userId } = await signInTestUser();
    for (let i = 0; i < 5; i++) await seedRec({ userId, qaStatus: 'uploaded', daysAgo: i });
    const r1 = await app.inject({
      method: 'GET',
      url: '/recordings?limit=2',
      headers: { authorization: `Bearer ${token}` },
    });
    const r1Body = r1.json() as {
      items: Array<{ recording_id: string }>;
      next_cursor: string | null;
    };
    expect(r1Body.items).toHaveLength(2);
    expect(r1Body.next_cursor).toBeTruthy();
    const r2 = await app.inject({
      method: 'GET',
      url: `/recordings?limit=2&cursor=${r1Body.next_cursor}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const r2Body = r2.json() as { items: Array<{ recording_id: string }> };
    expect(r2Body.items).toHaveLength(2);
    const ids1 = r1Body.items.map((x) => x.recording_id);
    const ids2 = r2Body.items.map((x) => x.recording_id);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
  });

  it('range=7d filters out a 30-day-old row', async () => {
    const { token, userId } = await signInTestUser();
    await seedRec({ userId, qaStatus: 'uploaded', daysAgo: 30 });
    await seedRec({ userId, qaStatus: 'uploaded', daysAgo: 1 });
    const r = await app.inject({
      method: 'GET',
      url: '/recordings?range=7d',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = r.json() as { items: Array<unknown> };
    expect(body.items).toHaveLength(1);
  });
});
