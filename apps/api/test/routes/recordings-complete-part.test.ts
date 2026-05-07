import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTREC2000000000000000US';
const TEST_TASK_ID = '01HVTREC2000000000000000TK';

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
      googleSub: 'g-cp',
      email: 'cp@e.com',
      name: 'CP',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'cp-test', 'CP Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});
afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

describe('POST /recordings/:id/parts/:n/complete', () => {
  it('returns 200 ok when state is pending', async () => {
    const id = ulid();
    await db.execute(sql`
      INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_sha256, imu_sha256, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, flavor)
      VALUES (${id}, ${TEST_USER_ID}, ${TEST_TASK_ID}, false, 'pending'::qa_status, 1000, ${'a'.repeat(64)}, ${'b'.repeat(64)}, 1024, 1024, 'k1', 'k2', 'k3', now(), 'playStore'::build_flavor)
    `);
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts/1/complete`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-2e3a2b1c4d61',
      },
      payload: { etag: 'fake-etag', channel: 'video' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 409 when state is rejected', async () => {
    const id = ulid();
    await db.execute(sql`
      INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_sha256, imu_sha256, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, flavor)
      VALUES (${id}, ${TEST_USER_ID}, ${TEST_TASK_ID}, false, 'rejected'::qa_status, 1000, ${'a'.repeat(64)}, ${'b'.repeat(64)}, 1024, 1024, 'k1', 'k2', 'k3', now(), 'playStore'::build_flavor)
    `);
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts/1/complete`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-2e3a2b1c4d62',
      },
      payload: { etag: 'fake-etag', channel: 'video' },
    });
    expect(res.statusCode).toBe(409);
  });
});
