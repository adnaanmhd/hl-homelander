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
import { recordingKeys } from '../../../src/lib/s3-client.js';
import { getQueue, getRedisConnection } from '../../../src/lib/queue.js';
import { buildApp } from '../../../src/app.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;

const USER_ID = '01HVTINITIPUSER0000000000U';
const OTHER_USER_ID = '01HVTINITIPUSERB000000000B';
const TASK_ID = '01HVTINITIPTASK0000000000T';

function tok(sub: string = USER_ID): string {
  return jwt.sign(
    {
      sub,
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
  for (const uid of [USER_ID, OTHER_USER_ID]) {
    await db
      .delete(schema.recordingsToVerify)
      .where(sql`recording_id IN (SELECT id FROM recordings WHERE user_id = ${uid})`);
    await db.delete(schema.recordings).where(eq(schema.recordings.userId, uid));
    await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, uid));
  }
}

const initPayload = (recordingId: string, partsCount = 1) => ({
  recordingId,
  taskId: TASK_ID,
  practice: false,
  partsCount,
  durationMs: 1000,
  fileSha256: 'a'.repeat(64),
  imuSha256: 'b'.repeat(64),
  fileSizeBytes: 1024,
  imuSizeBytes: 64,
  capturedAt: new Date().toISOString(),
});

beforeAll(async () => {
  app = await buildApp();
  for (const [uid, sub, email] of [
    [USER_ID, 'g-initip', 'initip@e.test'],
    [OTHER_USER_ID, 'g-initip-b', 'initip-b@e.test'],
  ] as const) {
    await db
      .insert(schema.users)
      .values({
        id: uid,
        googleSub: sub,
        email,
        name: 'InitIP',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
  }
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'init-ip-test', 'Init IP Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.users).where(eq(schema.users.id, USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, OTHER_USER_ID));
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

describeIf('POST /recordings/init — idempotency (CR-02)', () => {
  it('a duplicate /init for a pending row owned by the caller → 200 with the SAME uploadId + a FRESH imuUploadId; the DB s3UploadId is unchanged', async () => {
    const recordingId = ulid();
    const first = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
      payload: initPayload(recordingId, 3),
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();

    const second = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
      payload: initPayload(recordingId, 3),
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    // Video upload-id is UNCHANGED (the already-uploaded video parts' ETags survive).
    expect(secondBody.uploadId).toBe(firstBody.uploadId);
    // IMU upload-id is FRESH (the IMU id was never persisted → re-init restarts it).
    expect(secondBody.imuUploadId).not.toBe(firstBody.imuUploadId);
    expect(secondBody.partUrls).toHaveLength(3);
    expect(secondBody.imuPartUrls).toHaveLength(3);
    expect(secondBody.partsCount).toBe(3);
    expect(typeof secondBody.metadataUrl).toBe('string');
    expect(typeof secondBody.expiresAt).toBe('string');

    const [row] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    // Row was NOT mutated — s3UploadId still equals the FIRST response's uploadId.
    expect(row!.s3UploadId).toBe(firstBody.uploadId);
    expect(row!.qaStatus).toBe('pending');
  });

  it('a /init for a recordingId whose row is owned by a different user → 403 with no row fields in the body', async () => {
    const recordingId = ulid();
    const keys = recordingKeys({ userId: OTHER_USER_ID, recordingId });
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: OTHER_USER_ID,
      taskId: TASK_ID,
      practice: false,
      qaStatus: 'pending',
      durationMs: 1000,
      fileSha256: 'c'.repeat(64),
      imuSha256: 'd'.repeat(64),
      fileSizeBytes: 1024,
      imuSizeBytes: 64,
      s3KeyVideo: keys.video,
      s3KeyImu: keys.imu,
      s3KeyMetadata: keys.metadata,
      capturedAt: new Date(),
      flavor: 'playStore',
      s3UploadId: 'someone-elses-upload-id',
      partsCount: 1,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok(USER_ID)}`, 'idempotency-key': idemKey() },
      payload: initPayload(recordingId),
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.uploadId).toBeUndefined();
    expect(body.s3UploadId).toBeUndefined();
    expect(body.fileSha256).toBeUndefined();
    expect(body.imuSha256).toBeUndefined();
  });

  it('a /init for a recordingId whose row is in a non-pending state → 409 with "Cannot re-init from state <qaStatus>"', async () => {
    const recordingId = ulid();
    const keys = recordingKeys({ userId: USER_ID, recordingId });
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: USER_ID,
      taskId: TASK_ID,
      practice: false,
      qaStatus: 'uploaded',
      durationMs: 1000,
      fileSha256: 'a'.repeat(64),
      imuSha256: 'b'.repeat(64),
      fileSizeBytes: 1024,
      imuSizeBytes: 64,
      s3KeyVideo: keys.video,
      s3KeyImu: keys.imu,
      s3KeyMetadata: keys.metadata,
      capturedAt: new Date(),
      flavor: 'playStore',
      s3UploadId: 'an-upload-id',
      partsCount: 1,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok(USER_ID)}`, 'idempotency-key': idemKey() },
      payload: initPayload(recordingId),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().title).toBe('Cannot re-init from state uploaded');
  });

  it('a brand-new recordingId still returns 201', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
      payload: initPayload(recordingId, 2),
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.recordingId).toBe(recordingId);
    expect(body.partUrls).toHaveLength(2);
    expect(body.imuPartUrls).toHaveLength(2);
  });
});
