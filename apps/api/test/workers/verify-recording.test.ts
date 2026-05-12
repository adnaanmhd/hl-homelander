// verify-recording.ts — the hash-verify worker's verify-one-recording service,
// against the pushed DB + LocalStack S3. Gated on AWS_ENDPOINT_URL so it skips
// cleanly in CI without the dev stack.
//
// Covers: match → qa_status='verified' + one outbox 'verified' row + the
// recordings_to_verify row deleted; idempotent re-run is a no-op; mismatch →
// qa_status='hash-mismatch' + outbox 're-upload' + queue row deleted;
// nonexistent recordingId → no throw, no row written.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db, schema } from '../../src/db/index.js';
import { recordingKeys } from '../../src/lib/s3-client.js';
import { verifyRecording } from '../../src/lib/verify-recording.js';
import {
  STUB_VIDEO_BYTES,
  STUB_VIDEO_SHA256,
  STUB_IMU_CSV_BYTES,
  STUB_IMU_SHA256,
  stubMetadataJsonBytes,
} from '../fixtures/stub-bundle.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const describeIf = HAS_LOCALSTACK ? describe : describe.skip;
const BUCKET = process.env.RECORDINGS_BUCKET ?? 'humyn-recordings-dev';

const TEST_USER_ID = '01HVTVERIFYUSER0000000000A'; // 26-char ULID-shaped fixture id
const TEST_TASK_ID = '01HVTVERIFYTASK0000000000B';

describeIf('lib/verify-recording (LocalStack + DB)', () => {
  let s3: S3Client;

  async function putBundle(userId: string, recordingId: string): Promise<void> {
    const keys = recordingKeys({ userId, recordingId });
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: keys.video, Body: STUB_VIDEO_BYTES }),
    );
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: keys.imu, Body: STUB_IMU_CSV_BYTES }),
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: keys.metadata,
        Body: stubMetadataJsonBytes(recordingId),
      }),
    );
  }

  async function insertRecording(args: {
    recordingId: string;
    fileSha256: string;
    imuSha256: string;
    qaStatus: 'pending' | 'uploaded';
  }): Promise<void> {
    const keys = recordingKeys({ userId: TEST_USER_ID, recordingId: args.recordingId });
    await db.insert(schema.recordings).values({
      id: args.recordingId,
      userId: TEST_USER_ID,
      taskId: TEST_TASK_ID,
      practice: false,
      qaStatus: args.qaStatus,
      durationMs: 1000,
      fileSha256: args.fileSha256,
      imuSha256: args.imuSha256,
      fileSizeBytes: STUB_VIDEO_BYTES.byteLength,
      imuSizeBytes: STUB_IMU_CSV_BYTES.byteLength,
      s3KeyVideo: keys.video,
      s3KeyImu: keys.imu,
      s3KeyMetadata: keys.metadata,
      capturedAt: new Date(),
      flavor: 'playStore',
    });
    await db.insert(schema.recordingsToVerify).values({ recordingId: args.recordingId });
  }

  async function cleanupRecordings(): Promise<void> {
    await db
      .delete(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.userId, TEST_USER_ID));
    await db
      .delete(schema.recordingsToVerify)
      .where(sql`recording_id IN (SELECT id FROM recordings WHERE user_id = ${TEST_USER_ID})`);
    await db.delete(schema.recordings).where(eq(schema.recordings.userId, TEST_USER_ID));
  }

  beforeAll(async () => {
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
        googleSub: 'g-verify',
        email: 'verify@e.com',
        name: 'V',
        consentVersion: '1.0.0',
        consentAcceptedAt: new Date(),
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
      })
      .onConflictDoNothing();
    const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
    await db.execute(
      sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'verify-test', 'Verify Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
    );
    await cleanupRecordings();
  });

  afterAll(async () => {
    await cleanupRecordings();
    await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
    await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  });

  it('match → verified + one outbox "verified" row + recordings_to_verify deleted; re-run is a no-op', async () => {
    const recordingId = ulid();
    await putBundle(TEST_USER_ID, recordingId);
    await insertRecording({
      recordingId,
      fileSha256: STUB_VIDEO_SHA256,
      imuSha256: STUB_IMU_SHA256,
      qaStatus: 'uploaded',
    });

    await verifyRecording(recordingId);

    const [rec] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId))
      .limit(1);
    expect(rec?.qaStatus).toBe('verified');
    expect(rec?.verifiedAt).toBeInstanceOf(Date);

    const outbox = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.recordingId, recordingId));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.eventType).toBe('verified');
    expect(outbox[0]?.userId).toBe(TEST_USER_ID);

    const queued = await db
      .select()
      .from(schema.recordingsToVerify)
      .where(eq(schema.recordingsToVerify.recordingId, recordingId));
    expect(queued).toHaveLength(0);

    // Idempotent re-run — the row is already 'verified', so no second outbox row.
    await verifyRecording(recordingId);
    const outboxAgain = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.recordingId, recordingId));
    expect(outboxAgain).toHaveLength(1);
  });

  it('hash-mismatch → hash-mismatch + outbox "re-upload" + queue row deleted', async () => {
    const recordingId = ulid();
    await putBundle(TEST_USER_ID, recordingId);
    await insertRecording({
      recordingId,
      fileSha256: 'f'.repeat(64), // deliberately wrong — won't match the stored video bytes
      imuSha256: STUB_IMU_SHA256,
      qaStatus: 'uploaded',
    });

    await verifyRecording(recordingId);

    const [rec] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId))
      .limit(1);
    expect(rec?.qaStatus).toBe('hash-mismatch');
    expect(rec?.verifiedAt).toBeNull();

    const outbox = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.recordingId, recordingId));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.eventType).toBe('re-upload');

    const queued = await db
      .select()
      .from(schema.recordingsToVerify)
      .where(eq(schema.recordingsToVerify.recordingId, recordingId));
    expect(queued).toHaveLength(0);
  });

  it('nonexistent recordingId → no throw, no row written', async () => {
    const ghost = ulid();
    await expect(verifyRecording(ghost)).resolves.toBeUndefined();
    const outbox = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.recordingId, ghost));
    expect(outbox).toHaveLength(0);
  });

  it('a row not in "uploaded" state → no-op (idempotent guard)', async () => {
    const recordingId = ulid();
    await putBundle(TEST_USER_ID, recordingId);
    await insertRecording({
      recordingId,
      fileSha256: STUB_VIDEO_SHA256,
      imuSha256: STUB_IMU_SHA256,
      qaStatus: 'pending', // not 'uploaded' — verifyRecording must early-return
    });
    await verifyRecording(recordingId);
    const [rec] = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId))
      .limit(1);
    expect(rec?.qaStatus).toBe('pending');
    const outbox = await db
      .select()
      .from(schema.recordingEventsOutbox)
      .where(eq(schema.recordingEventsOutbox.recordingId, recordingId));
    expect(outbox).toHaveLength(0);
  });
});
