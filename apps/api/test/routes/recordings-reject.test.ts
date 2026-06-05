import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTREC4000000000000000US';
const TEST_TASK_ID = '01HVTREC4000000000000000TK';
const BUCKET = process.env.RECORDINGS_BUCKET ?? 'humyn-recordings-dev';

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
      googleSub: 'g-rej',
      email: 'rej@e.com',
      name: 'R',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'rej-test', 'Rej Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});
afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

describe('POST /recordings/:id/reject', () => {
  it('aborts multipart upload + transitions state to rejected', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const mu = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: BUCKET,
        Key: videoKey,
        ContentType: 'video/mp4',
      }),
    );
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'pending',
      durationMs: 1000,
      fileSizeBytes: 1024,
      imuSizeBytes: 1024,
      s3KeyVideo: videoKey,
      s3KeyImu: 'k',
      s3KeyMetadata: 'k',
      capturedAt: new Date(),
      flavor: 'playStore',
      s3UploadId: mu.UploadId!,
      partsCount: 1,
    });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/reject`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-4e3a2b1c4d81',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.qaStatus).toBe('rejected');
  });

  it('returns 409 when state is verified (terminal)', async () => {
    const recordingId = ulid();
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'verified',
      durationMs: 1000,
      fileSizeBytes: 1024,
      imuSizeBytes: 1024,
      s3KeyVideo: 'k',
      s3KeyImu: 'k',
      s3KeyMetadata: 'k',
      capturedAt: new Date(),
      flavor: 'playStore',
    });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/reject`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-4e3a2b1c4d82',
      },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });
});
