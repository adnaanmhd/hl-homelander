import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { db, schema } from '../../src/db/index.js';
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
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

// --- helpers -------------------------------------------------------------

async function createMultipart(key: string, contentType: string): Promise<string> {
  const mu = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
  );
  return mu.UploadId!;
}

async function uploadOnePart(key: string, uploadId: string, body: Buffer): Promise<string> {
  const r = await s3.send(
    new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: 1,
      Body: body,
    }),
  );
  return r.ETag!;
}

async function insertPendingRow(args: {
  recordingId: string;
  videoKey: string;
  imuKey: string;
  videoUploadId: string;
  qaStatus?: 'pending' | 'uploaded';
}): Promise<void> {
  await db.insert(schema.recordings).values({
    id: args.recordingId,
    userId: TEST_USER_ID,
    taskId: TEST_TASK_ID,
    practice: false,
    qaStatus: args.qaStatus ?? 'pending',
    durationMs: 1000,
    fileSizeBytes: 5 * 1024 * 1024,
    imuSizeBytes: 1024,
    s3KeyVideo: args.videoKey,
    s3KeyImu: args.imuKey,
    s3KeyMetadata: `recordings/${TEST_USER_ID}/${args.recordingId}/metadata.json`,
    capturedAt: new Date(),
    flavor: 'playStore',
    s3UploadId: args.videoUploadId,
    partsCount: 1,
  });
}

const FAKE_PART_BYTES = Buffer.alloc(5 * 1024 * 1024, 'x');
const FAKE_IMU_BYTES = Buffer.alloc(1024, 'y');

describe('POST /recordings/:id/finalize', () => {
  it('completes multipart upload + transitions state to uploaded (terminal)', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    const videoUploadId = await createMultipart(videoKey, 'video/mp4');
    const imuUploadId = await createMultipart(imuKey, 'text/csv');
    const v1 = await uploadOnePart(videoKey, videoUploadId, FAKE_PART_BYTES);
    const i1 = await uploadOnePart(imuKey, imuUploadId, FAKE_IMU_BYTES);
    await insertPendingRow({ recordingId, videoKey, imuKey, videoUploadId });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d71',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: v1 }],
        imuParts: [{ partNumber: 1, etag: i1 }],
        imuUploadId,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qaStatus).toBe('uploaded');
  }, 60_000);

  it('retry after the video multipart was already completed → 200 + uploaded (idempotent)', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    const videoUploadId = await createMultipart(videoKey, 'video/mp4');
    const imuUploadId = await createMultipart(imuKey, 'text/csv');
    const v1 = await uploadOnePart(videoKey, videoUploadId, FAKE_PART_BYTES);
    const i1 = await uploadOnePart(imuKey, imuUploadId, FAKE_IMU_BYTES);
    // Simulate the WR-01 scenario: a prior /finalize already consumed the video
    // multipart upload (the CompleteMultipartUpload landed the object) but then
    // failed before finalizing the row. The IMU multipart is still open.
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: videoKey,
        UploadId: videoUploadId,
        MultipartUpload: { Parts: [{ PartNumber: 1, ETag: v1 }] },
      }),
    );
    await insertPendingRow({ recordingId, videoKey, imuKey, videoUploadId });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': 'aa7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d72',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: v1 }],
        imuParts: [{ partNumber: 1, etag: i1 }],
        imuUploadId,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qaStatus).toBe('uploaded');
  }, 60_000);

  it('retry where the video object is also gone (multipart aborted) → propagates, row stays pending', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    const videoUploadId = await createMultipart(videoKey, 'video/mp4');
    const imuUploadId = await createMultipart(imuKey, 'text/csv');
    const v1 = await uploadOnePart(videoKey, videoUploadId, FAKE_PART_BYTES);
    const i1 = await uploadOnePart(imuKey, imuUploadId, FAKE_IMU_BYTES);
    // The multipart upload is gone AND no object exists at the key:
    // CompleteMultipartUpload → NoSuchUpload, HeadObject → NotFound → propagate.
    await s3.send(
      new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: videoKey, UploadId: videoUploadId }),
    );
    await insertPendingRow({ recordingId, videoKey, imuKey, videoUploadId });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': 'bb7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d73',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: v1 }],
        imuParts: [{ partNumber: 1, etag: i1 }],
        imuUploadId,
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    const [row] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId))
      .limit(1);
    expect(row?.qaStatus).toBe('pending');
    // cleanup the still-open IMU multipart so it doesn't linger
    await s3
      .send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: imuKey, UploadId: imuUploadId }))
      .catch(() => {});
  }, 60_000);

  it('/finalize on an already-uploaded row → 200, no CompleteMultipartUpload call', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    // No real multipart upload — the row is already 'uploaded', so /finalize
    // must short-circuit and never touch S3. A bogus uploadId proves it: if the
    // route tried to CompleteMultipartUpload it would throw NoSuchUpload then
    // HeadObject (also NotFound) → 500. It must return 200 without any S3 call.
    await insertPendingRow({
      recordingId,
      videoKey,
      imuKey,
      videoUploadId: 'bogus-upload-id-never-used',
      qaStatus: 'uploaded',
    });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': 'cc7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d74',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: '"x"' }],
        imuParts: [{ partNumber: 1, etag: '"y"' }],
        imuUploadId: 'bogus-imu-upload-id',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().qaStatus).toBe('uploaded');
  });

  it('/finalize on a verified row → 409', async () => {
    const recordingId = ulid();
    const videoKey = `recordings/${TEST_USER_ID}/${recordingId}/video.mp4`;
    const imuKey = `recordings/${TEST_USER_ID}/${recordingId}/imu.csv`;
    await db.insert(schema.recordings).values({
      id: recordingId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: 'verified',
      durationMs: 1000,
      fileSizeBytes: 1024,
      imuSizeBytes: 64,
      s3KeyVideo: videoKey,
      s3KeyImu: imuKey,
      s3KeyMetadata: `recordings/${TEST_USER_ID}/${recordingId}/metadata.json`,
      capturedAt: new Date(),
      flavor: 'playStore',
      s3UploadId: 'whatever',
      partsCount: 1,
    });
    const res = await app.inject({
      method: 'POST',
      url: `/recordings/${recordingId}/finalize`,
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': 'dd7e8f5c-8d2a-4b7f-9c1d-3e3a2b1c4d75',
      },
      payload: {
        videoParts: [{ partNumber: 1, etag: '"x"' }],
        imuParts: [{ partNumber: 1, etag: '"y"' }],
        imuUploadId: 'imu',
      },
    });
    expect(res.statusCode).toBe(409);
  });
});
