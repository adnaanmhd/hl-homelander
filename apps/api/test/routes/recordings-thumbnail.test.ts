// Bug 6 / D5 (2026-06-04) — server-side poster thumbnails for cross-device History.
//
//   1. GET /recordings serves a signed `thumbnail_url` when the row has a server
//      poster (s3_key_thumbnail set), and `null` otherwise. Presigning is local
//      crypto, so this part needs no LocalStack/ffmpeg.
//   2. POST /recordings/:id/finalize derives the poster JPEG from the assembled
//      MP4 (ffmpeg seek ~1s) and stores it at thumb.jpg + sets s3_key_thumbnail.
//      That end-to-end leg needs LocalStack (real S3 multipart) AND ffmpeg.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { db, schema } from '../../src/db/index.js';
import { recordingKeys } from '../../src/lib/s3-client.js';
import { backfillThumbnails } from '../../src/lib/thumbnail-backfill.js';
import { buildApp } from '../../src/app.js';

const HAS_LOCALSTACK = !!process.env.AWS_ENDPOINT_URL;
const HAS_FFMPEG = (() => {
  try {
    return spawnSync('ffmpeg', ['-version']).status === 0;
  } catch {
    return false;
  }
})();
const BUCKET = process.env.RECORDINGS_BUCKET ?? 'humyn-recordings-dev';

const USER_ID = '01HVTTHUMBUSER000000000US';
const TASK_ID = '01HVTTHUMBTASK000000000TK';

function tok(): string {
  return jwt.sign(
    {
      sub: USER_ID,
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
let keyCounter = 0;
function idemKey(): string {
  keyCounter += 1;
  return `9d2e8f5c-8d2a-4b7f-9c1d-${String(keyCounter).padStart(12, '0')}`;
}

// BUG-3 (2026-06-09) — a tiny REAL HEVC MP4 (matches the device's libx265 /
// hvc1 output — the codec the capture pipeline actually emits), +faststart so
// the moov atom is up front for the ffmpeg seek over a presigned GET.
function makeHevcMp4(): Buffer {
  const mp4Path = join(tmpdir(), `thumb-hevc-${ulid()}.mp4`);
  const gen = spawnSync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=2:size=320x240:rate=15',
    '-c:v',
    'libx265',
    '-tag:v',
    'hvc1',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ]);
  if (gen.status !== 0) {
    throw new Error(`ffmpeg HEVC fixture gen failed: ${gen.stderr?.toString().slice(0, 300)}`);
  }
  const buf = readFileSync(mp4Path);
  rmSync(mp4Path, { force: true });
  return buf;
}

// BUG-3 — insert an 'uploaded' row whose video object is REALLY present in S3 (a
// single PutObject of `mp4`), with no server thumbnail. Used by the
// finalize-retry + backfill tests (both regenerate the poster from this object).
async function insertUploadedRowWithVideo(mp4: Buffer): Promise<{
  id: string;
  keys: ReturnType<typeof recordingKeys>;
}> {
  const id = ulid();
  const keys = recordingKeys({ userId: USER_ID, recordingId: id });
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: keys.video, Body: mp4, ContentType: 'video/mp4' }),
  );
  await db.insert(schema.recordings).values({
    id,
    userId: USER_ID,
    taskId: TASK_ID,
    practice: false,
    qaStatus: 'uploaded',
    durationMs: 2000,
    fileSizeBytes: mp4.byteLength,
    imuSizeBytes: 24,
    s3KeyVideo: keys.video,
    s3KeyImu: keys.imu,
    s3KeyMetadata: keys.metadata,
    s3KeyThumbnail: null,
    capturedAt: new Date(),
    flavor: 'playStore',
  });
  return { id, keys };
}

async function insertUploadedRow(opts: { withThumbnail: boolean }): Promise<string> {
  const id = ulid();
  const keys = recordingKeys({ userId: USER_ID, recordingId: id });
  await db.insert(schema.recordings).values({
    id,
    userId: USER_ID,
    taskId: TASK_ID,
    practice: false,
    qaStatus: 'uploaded',
    durationMs: 1000,
    fileSizeBytes: 1024,
    imuSizeBytes: 64,
    s3KeyVideo: keys.video,
    s3KeyImu: keys.imu,
    s3KeyMetadata: keys.metadata,
    s3KeyThumbnail: opts.withThumbnail ? keys.thumbnail : null,
    capturedAt: new Date(),
    flavor: 'playStore',
  });
  return id;
}

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
      id: USER_ID,
      googleSub: 'g-thumb',
      email: 'thumb@e.test',
      name: 'Thumb',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TASK_ID}, 'thumb-test', 'Thumb Test', 'Test', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, USER_ID));
});

afterAll(async () => {
  await db.delete(schema.recordings).where(eq(schema.recordings.userId, USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TASK_ID));
  await app.close();
});

describe('GET /recordings — thumbnail_url (Bug 6 / D5)', () => {
  it('serves a signed thumbnail_url for rows with a server poster, null otherwise', async () => {
    const withThumb = await insertUploadedRow({ withThumbnail: true });
    const noThumb = await insertUploadedRow({ withThumbnail: false });

    const res = await app.inject({
      method: 'GET',
      url: '/recordings',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ recording_id: string; thumbnail_url: string | null }>;

    const a = items.find((i) => i.recording_id === withThumb);
    const b = items.find((i) => i.recording_id === noThumb);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // The signed URL points at the row's thumb.jpg key.
    expect(a!.thumbnail_url).toContain(`${withThumb}/thumb.jpg`);
    expect(a!.thumbnail_url).toMatch(/X-Amz-Signature=/);
    // No server poster → null (client falls back to local ledger / gradient).
    expect(b!.thumbnail_url).toBeNull();
  });
});

const describeE2E = HAS_LOCALSTACK && HAS_FFMPEG ? describe : describe.skip;

describeE2E(
  'POST /recordings/:id/finalize — server poster generation (LocalStack + ffmpeg)',
  () => {
    it('derives a poster JPEG from the assembled MP4 → sets s3_key_thumbnail + writes thumb.jpg', async () => {
      // A tiny real H.264 MP4 (2s test pattern, +faststart so the moov atom is up
      // front for the ffmpeg seek over the presigned GET).
      const mp4Path = join(tmpdir(), `thumb-e2e-${ulid()}.mp4`);
      const gen = spawnSync('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=2:size=320x240:rate=15',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        mp4Path,
      ]);
      expect(gen.status).toBe(0);
      const mp4 = readFileSync(mp4Path);
      rmSync(mp4Path, { force: true });

      const recordingId = ulid();
      const keys = recordingKeys({ userId: USER_ID, recordingId });

      const videoUploadId = (
        await s3.send(
          new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: keys.video,
            ContentType: 'video/mp4',
          }),
        )
      ).UploadId!;
      const imuUploadId = (
        await s3.send(
          new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: keys.imu,
            ContentType: 'text/csv',
          }),
        )
      ).UploadId!;
      const v1 = (
        await s3.send(
          new UploadPartCommand({
            Bucket: BUCKET,
            Key: keys.video,
            UploadId: videoUploadId,
            PartNumber: 1,
            Body: mp4,
          }),
        )
      ).ETag!;
      const i1 = (
        await s3.send(
          new UploadPartCommand({
            Bucket: BUCKET,
            Key: keys.imu,
            UploadId: imuUploadId,
            PartNumber: 1,
            Body: Buffer.from('t_ns,ax,ay,az\n0,0,0,9.8\n'),
          }),
        )
      ).ETag!;

      await db.insert(schema.recordings).values({
        id: recordingId,
        userId: USER_ID,
        taskId: TASK_ID,
        practice: false,
        qaStatus: 'pending',
        durationMs: 2000,
        fileSizeBytes: mp4.byteLength,
        imuSizeBytes: 24,
        s3KeyVideo: keys.video,
        s3KeyImu: keys.imu,
        s3KeyMetadata: keys.metadata,
        capturedAt: new Date(),
        flavor: 'playStore',
        s3UploadId: videoUploadId,
        partsCount: 1,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/recordings/${recordingId}/finalize`,
        headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
        payload: {
          videoParts: [{ partNumber: 1, etag: v1 }],
          imuParts: [{ partNumber: 1, etag: i1 }],
          imuUploadId,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().qaStatus).toBe('uploaded');

      // The row carries the thumbnail key…
      const [row] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, recordingId));
      expect(row!.s3KeyThumbnail).toBe(keys.thumbnail);

      // …and the JPEG object actually exists in S3.
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: keys.thumbnail }));
      expect((head.ContentLength ?? 0) > 0).toBe(true);
    }, 60_000);

    it('finalize still succeeds (uploaded) + leaves s3_key_thumbnail null when the video is not decodable', async () => {
      // Fake (non-MP4) bytes → ffmpeg can't extract a frame → best-effort no-op.
      const recordingId = ulid();
      const keys = recordingKeys({ userId: USER_ID, recordingId });
      const videoUploadId = (
        await s3.send(
          new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: keys.video,
            ContentType: 'video/mp4',
          }),
        )
      ).UploadId!;
      const imuUploadId = (
        await s3.send(
          new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: keys.imu,
            ContentType: 'text/csv',
          }),
        )
      ).UploadId!;
      const v1 = (
        await s3.send(
          new UploadPartCommand({
            Bucket: BUCKET,
            Key: keys.video,
            UploadId: videoUploadId,
            PartNumber: 1,
            Body: Buffer.alloc(5 * 1024 * 1024, 'x'),
          }),
        )
      ).ETag!;
      const i1 = (
        await s3.send(
          new UploadPartCommand({
            Bucket: BUCKET,
            Key: keys.imu,
            UploadId: imuUploadId,
            PartNumber: 1,
            Body: Buffer.from('t_ns,ax\n0,0\n'),
          }),
        )
      ).ETag!;

      await db.insert(schema.recordings).values({
        id: recordingId,
        userId: USER_ID,
        taskId: TASK_ID,
        practice: false,
        qaStatus: 'pending',
        durationMs: 1000,
        fileSizeBytes: 5 * 1024 * 1024,
        imuSizeBytes: 10,
        s3KeyVideo: keys.video,
        s3KeyImu: keys.imu,
        s3KeyMetadata: keys.metadata,
        capturedAt: new Date(),
        flavor: 'playStore',
        s3UploadId: videoUploadId,
        partsCount: 1,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/recordings/${recordingId}/finalize`,
        headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
        payload: {
          videoParts: [{ partNumber: 1, etag: v1 }],
          imuParts: [{ partNumber: 1, etag: i1 }],
          imuUploadId,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().qaStatus).toBe('uploaded');
      const [row] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, recordingId));
      expect(row!.s3KeyThumbnail).toBeNull();
    }, 60_000);

    // BUG-3 (2026-06-09) — forward fix: a re-finalize that REACHES the handler
    // (fresh idempotency key, so it isn't an idempotency replay) for an
    // already-'uploaded' but THUMBLESS row regenerates the poster. Mirrors the
    // production gap where a row finalized before ffmpeg shipped in the image.
    it('a re-finalize of an uploaded but thumbless row regenerates the poster', async () => {
      const { id, keys } = await insertUploadedRowWithVideo(makeHevcMp4());
      // Sanity: it starts thumbless.
      const [before] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, id));
      expect(before!.s3KeyThumbnail).toBeNull();

      const res = await app.inject({
        method: 'POST',
        url: `/recordings/${id}/finalize`,
        headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': idemKey() },
        // The short-circuit returns before consuming these, but the body must
        // still satisfy FinalizeBodyExtended.
        payload: {
          videoParts: [{ partNumber: 1, etag: 'x' }],
          imuParts: [{ partNumber: 1, etag: 'y' }],
          imuUploadId: 'imu-upload-id',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().qaStatus).toBe('uploaded');

      const [after] = await db.select().from(schema.recordings).where(eq(schema.recordings.id, id));
      expect(after!.s3KeyThumbnail).toBe(keys.thumbnail);
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: keys.thumbnail }));
      expect((head.ContentLength ?? 0) > 0).toBe(true);
    }, 60_000);

    // BUG-3 (2026-06-09) — the one-shot backfill (PRIMARY recovery for the
    // existing thumbless fleet) generates posters for uploaded/thumbless rows,
    // leaves already-thumbed rows untouched, and is idempotent on re-run.
    it('backfillThumbnails posters thumbless uploaded rows, skips thumbed ones, is idempotent', async () => {
      // Isolate this user so the user-scoped thumbless count is deterministic.
      await db.delete(schema.recordings).where(eq(schema.recordings.userId, USER_ID));
      const mp4 = makeHevcMp4();
      const a = await insertUploadedRowWithVideo(mp4);
      const b = await insertUploadedRowWithVideo(mp4);
      // An already-thumbed row (with a real video) must NOT be a candidate.
      const c = await insertUploadedRowWithVideo(mp4);
      await db
        .update(schema.recordings)
        .set({ s3KeyThumbnail: c.keys.thumbnail })
        .where(eq(schema.recordings.id, c.id));

      const thumblessQuery = db
        .select({ id: schema.recordings.id })
        .from(schema.recordings)
        .where(
          and(
            eq(schema.recordings.userId, USER_ID),
            isNull(schema.recordings.s3KeyThumbnail),
            inArray(schema.recordings.qaStatus, ['uploaded', 'verified']),
          ),
        );
      expect((await thumblessQuery).length).toBe(2);

      const result = await backfillThumbnails({ concurrency: 2, log: () => {} });
      expect(result.generated).toBeGreaterThanOrEqual(2);

      // a + b now have posters; the objects exist.
      for (const r of [a, b]) {
        const [row] = await db
          .select()
          .from(schema.recordings)
          .where(eq(schema.recordings.id, r.id));
        expect(row!.s3KeyThumbnail).toBe(r.keys.thumbnail);
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: r.keys.thumbnail }),
        );
        expect((head.ContentLength ?? 0) > 0).toBe(true);
      }
      // c is untouched (still its pre-set thumbnail).
      const [cRow] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, c.id));
      expect(cRow!.s3KeyThumbnail).toBe(c.keys.thumbnail);
      // No thumbless candidates remain for this user.
      expect((await thumblessQuery).length).toBe(0);

      // Idempotent: a re-run finds nothing new for this user and leaves a/b intact.
      await backfillThumbnails({ concurrency: 2, log: () => {} });
      const [aAfter] = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, a.id));
      expect(aAfter!.s3KeyThumbnail).toBe(a.keys.thumbnail);
    }, 60_000);
  },
);
