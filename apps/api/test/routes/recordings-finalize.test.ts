import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { db, schema } from '../../src/db/index.js';
import { getQueue, getRedisConnection } from '../../src/lib/queue.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTREC3000000000000000US';
const TEST_TASK_ID = '01HVTREC3000000000000000TK';
const BUCKET = process.env.RECORDINGS_BUCKET ?? 'humyn-recordings-dev';

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
let s3: S3Client;

beforeAll(async () => {
  app = await buildApp();
  s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-fin',
      email: 'fin@e.com',
      name: 'F',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'fin-test', 'Fin Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});
afterAll(async () => {
  await db.delete(schema.recordingsToVerify);
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
  // /finalize's LocalStack dev shim opens the BullMQ queue + ioredis singleton
  // (Plan 05-05) — close them so the test process exits cleanly.
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

describe('POST /recordings/:id/finalize', () => {
  it('completes multipart upload + transitions state to uploaded + enqueues for Phase 5', async () => {
    // 1. Init real multipart upload against LocalStack
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    const videoMu = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: videoKey,
        ContentType: 'video/mp4',
      }),
    );
    const imuMu = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: imuKey,
        ContentType: 'text/csv',
      }),
    );
    // 2. Upload one part to each. AWS S3 normally requires non-final parts to be
    //    >= 5 MB; LocalStack tolerates smaller parts in dev mode but we send 5 MB
    //    for the video part anyway to keep the test realistic.
    const fakeBytes = Buffer.alloc(5 * 1024 * 1024, 'x');
    const v1 = await s3.send(
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: videoKey,
        UploadId: videoMu.UploadId!,
        PartNumber: 1,
        Body: fakeBytes,
      }),
    );
    const i1 = await s3.send(
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: imuKey,
        UploadId: imuMu.UploadId!,
        PartNumber: 1,
        Body: Buffer.alloc(1024, 'y'),
      }),
    );
    // 3. Insert recordings row in 'pending' state with the real upload-id
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'pending',
      durationMs: 1000,
      fileSha256: 'a'.repeat(64),
      imuSha256: 'b'.repeat(64),
      fileSizeBytes: 5 * 1024 * 1024,
      imuSizeBytes: 1024,
      s3KeyVideo: videoKey,
      s3KeyImu: imuKey,
      s3KeyMetadata: `recordings/${TEST_USER_ID}/${recordingId}/metadata.json`,
      capturedAt: new Date(),
      flavor: 'playStore',
      s3UploadId: videoMu.UploadId!,
      partsCount: 1,
    });
    // 4. Call finalize
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d71',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: v1.ETag! }],
        imuParts: [{ partNumber: 1, etag: i1.ETag! }],
        imuUploadId: imuMu.UploadId!,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qaStatus).toBe('uploaded');
    // Verify queue stub written
    const queued = await db
      .select()
      .from(schema.recordingsToVerify)
      .where(eq(schema.recordingsToVerify.recordingId, recordingId));
    expect(queued).toHaveLength(1);
  }, 60_000);
});
