// POST /recordings/:id/parts (UP-04) — re-presign part URLs against the EXISTING
// video + IMU multipart uploads (no CreateMultipartUpload of any kind, no DB
// write). Requires LocalStack (getSignedUrl needs AWS creds + endpoint) — gated
// on AWS_ENDPOINT_URL so it skips cleanly without the dev stack.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../../src/db/index.js';
import { recordingKeys } from '../../../src/lib/s3-client.js';
import { buildApp } from '../../../src/app.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;

const USER_A = '01HVTRPRESIGNUSERA000000A';
const USER_B = '01HVTRPRESIGNUSERB000000B';
const TASK_ID = '01HVTRPRESIGNTASK000000T0';

function tok(sub: string): string {
  return jwt.sign(
    {
      sub,
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

async function mkRecording(
  userId: string,
  qaStatus: 'pending' | 'uploaded',
  s3UploadId: string | null = 'video-upload-id-abc',
): Promise<string> {
  const id = ulid();
  const keys = recordingKeys({ userId, recordingId: id });
  await db.insert(schema.recordings).values({
    id,
    userId,
    taskId: TASK_ID,
    practice: false,
    qaStatus,
    durationMs: 1000,
    fileSizeBytes: 1024,
    imuSizeBytes: 64,
    s3KeyVideo: keys.video,
    s3KeyImu: keys.imu,
    s3KeyMetadata: keys.metadata,
    capturedAt: new Date(),
    flavor: 'playStore',
    s3UploadId,
    partsCount: 1,
  });
  return id;
}

let app: FastifyInstance;
let keyCounter = 0;
function idemKey(): string {
  keyCounter += 1;
  return `7c1e8f5c-8d2a-4b7f-9c1d-${String(keyCounter).padStart(12, '0')}`;
}

async function cleanup(): Promise<void> {
  for (const id of [USER_A, USER_B]) {
    await db.delete(schema.recordings).where(eq(schema.recordings.userId, id));
    await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, id));
  }
}

beforeAll(async () => {
  app = await buildApp();
  for (const id of [USER_A, USER_B]) {
    await db
      .insert(schema.users)
      .values({
        id,
        googleSub: `g-${id.slice(-8)}`,
        email: `${id.slice(-8)}@parts.test`,
        name: 'Parts',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        currentInstallationId: 'inst-test',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
  }
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'parts-test', 'Parts Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.users).where(eq(schema.users.id, USER_A));
  await db.delete(schema.users).where(eq(schema.users.id, USER_B));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
  await app.close();
});

describeIf('POST /recordings/:id/parts (LocalStack)', () => {
  it('pending row → 200; uploadId === row.s3UploadId (NOT a new id); partUrls/imuPartUrls have partsCount entries; imuUploadId is the supplied one; the DB row is UNCHANGED', async () => {
    const id = await mkRecording(USER_A, 'pending', 'video-upload-id-abc');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 4, imuUploadId: 'imu-upload-id-xyz' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recordingId).toBe(id);
    expect(body.uploadId).toBe('video-upload-id-abc');
    expect(body.partsCount).toBe(4);
    expect(body.partUrls).toHaveLength(4);
    expect(body.imuPartUrls).toHaveLength(4);
    expect(body.imuUploadId).toBe('imu-upload-id-xyz');
    expect(body.metadataUrl).toMatch(/^http/);
    expect(typeof body.expiresAt).toBe('string');

    const [row] = await db.select().from(schema.recordings).where(eq(schema.recordings.id, id));
    expect(row!.qaStatus).toBe('pending');
    expect(row!.s3UploadId).toBe('video-upload-id-abc');
  });

  it('missing recording id → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${ulid()}/parts`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2, imuUploadId: 'imu-x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it("another user's row → 403 (no row fields in the body)", async () => {
    const id = await mkRecording(USER_B, 'pending', 'video-upload-id-b');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2, imuUploadId: 'imu-x' },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.uploadId).toBeUndefined();
    expect(body.s3UploadId).toBeUndefined();
  });

  it('non-pending row (uploaded) → 409', async () => {
    const id = await mkRecording(USER_A, 'uploaded', 'video-upload-id-c');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 2, imuUploadId: 'imu-x' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('partsCount: 1001 → 400', async () => {
    const id = await mkRecording(USER_A, 'pending', 'video-upload-id-d');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts`,
      headers: { authorization: `Bearer ${tok(USER_A)}`, 'idempotency-key': idemKey() },
      payload: { partsCount: 1001, imuUploadId: 'imu-x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('unauthenticated → 401', async () => {
    const id = await mkRecording(USER_A, 'pending', 'video-upload-id-e');
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${id}/parts`,
      headers: { 'idempotency-key': idemKey() },
      payload: { partsCount: 2, imuUploadId: 'imu-x' },
    });
    expect(res.statusCode).toBe(401);
  });
});
