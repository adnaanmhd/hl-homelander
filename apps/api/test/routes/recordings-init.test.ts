import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTREC0000000000000000US';
const TEST_TASK_ID = '01HVTREC0000000000000000TK';

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
      googleSub: 'g-rec',
      email: 'r@r.com',
      name: 'R',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'rec-test', 'Rec Test', 'Test task for recordings', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});
afterAll(async () => {
  await db.delete(schema.recordingsToVerify);
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

const baseBody = (recordingId: string): Record<string, unknown> => ({
  recordingId,
  taskId: TEST_TASK_ID,
  practice: false,
  partsCount: 2,
  durationMs: 60000,
  fileSha256: 'a'.repeat(64),
  imuSha256: 'b'.repeat(64),
  fileSizeBytes: 1024 * 1024,
  imuSizeBytes: 16 * 1024,
  capturedAt: new Date().toISOString(),
});

describe('POST /recordings/init', () => {
  it('happy path → 201 with presigned URLs and pending row', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d51',
      },
      payload: baseBody(recordingId),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.recordingId).toBe(recordingId);
    expect(body.uploadId).toBeDefined();
    expect(body.partUrls).toHaveLength(2);
    expect(body.imuPartUrls).toHaveLength(2);
    expect(body.metadataUrl).toMatch(/^http/);

    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.qaStatus).toBe('pending');
    expect(rows[0]!.s3UploadId).toBe(body.uploadId);
    expect(rows[0]!.partsCount).toBe(2);
  });

  it('rejects partsCount > 1000', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d52',
      },
      payload: { ...baseBody(recordingId), partsCount: 1001 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { 'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d53' },
      payload: baseBody(recordingId),
    });
    expect(res.statusCode).toBe(401);
  });

  it('idempotency replay returns the same response', async () => {
    const recordingId = ulid();
    const headers = {
      authorization: `Bearer ${tok()}`,
      'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d54',
    };
    // Reuse the SAME body object across both injections — baseBody() builds a
    // fresh `capturedAt: new Date().toISOString()` per call, so calling it
    // twice would produce different request hashes and the second injection
    // would correctly trip the idempotency-key conflict.
    const payload = baseBody(recordingId);
    const r1 = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers,
      payload,
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers,
      payload,
    });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r1.json().uploadId).toBe(r2.json().uploadId);
    // Only one row created
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows).toHaveLength(1);
  });
});
