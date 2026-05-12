// POST /recordings/init — UP-18: the server populates recordings.ip_address
// from req.ip (the client sends ip_address: null in the metadata bundle, never
// on /init). And /finalize's toRecordingResponse() returns that stored value.
// Requires LocalStack (CreateMultipartUpload presigns) — gated on AWS_ENDPOINT_URL.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../../src/db/index.js';
import { getQueue, getRedisConnection } from '../../../src/lib/queue.js';
import { buildApp } from '../../../src/app.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;

const USER_ID = '01HVTINITIPUSER0000000000U';
const TASK_ID = '01HVTINITIPTASK0000000000T';

function tok(): string {
  return jwt.sign(
    {
      sub: USER_ID,
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
let keyCounter = 0;
function idemKey(): string {
  keyCounter += 1;
  return `5a8e8f5c-8d2a-4b7f-9c1d-${String(keyCounter).padStart(12, '0')}`;
}

async function cleanup(): Promise<void> {
  await db
    .delete(schema.recordingsToVerify)
    .where(sql`recording_id IN (SELECT id FROM recordings WHERE user_id = ${USER_ID})`);
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, USER_ID));
}

beforeAll(async () => {
  app = await buildApp();
  await db
    .insert(schema.users)
    .values({
      id: USER_ID,
      googleSub: 'g-initip',
      email: 'initip@e.test',
      name: 'InitIP',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'init-ip-test', 'Init IP Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.users).where(eq(schema.users.id, USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
  await app.close();
  try {
    await getQueue().close();
  } catch {
    /* not opened */
  }
  try {
    getRedisConnection().disconnect();
  } catch {
    /* not opened */
  }
});

describeIf('POST /recordings/init — server-populated ip_address (UP-18)', () => {
  it('persists req.ip onto the recordings row (not null)', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
      payload: {
        recordingId,
        taskId: TASK_ID,
        practice: false,
        partsCount: 1,
        durationMs: 1000,
        fileSha256: 'a'.repeat(64),
        imuSha256: 'b'.repeat(64),
        fileSizeBytes: 1024,
        imuSizeBytes: 64,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
    const [row] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(row!.ipAddress).not.toBeNull();
    expect(typeof row!.ipAddress).toBe('string');
    // app.inject's default remoteAddress is 127.0.0.1.
    expect(row!.ipAddress).toBe('127.0.0.1');
  });
});
