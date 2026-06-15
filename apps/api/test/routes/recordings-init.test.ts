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
      installationId: 'inst-test',
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
      currentInstallationId: 'inst-test',
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

  // ----------------------------------------------------------------
  // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — the calibration
  // jsonb column. The hash-verify worker is UNAFFECTED — it re-hashes the
  // MP4 + IMU CSV only; calibration lives in metadata.json + this column,
  // never in the worker's hashing path.
  // ----------------------------------------------------------------

  const calibratedBlock = {
    camera: {
      model: 'pinhole',
      resolution: [1920, 1080],
      params: { fx: 725.58, fy: 725.26, cx: 1006.06, cy: 506.9, skew: 0.0 },
      distortion_coeffs: [0.027, 0.017, -0.011, 0.002],
      intrinsics_source: 'camera2',
    },
    cam_imu_extrinsics: {
      T_cam_imu: [
        [1.0, 0.0, 0.0, 0.01],
        [0.0, 1.0, 0.0, -0.08],
        [0.0, 0.0, 1.0, -0.05],
        [0.0, 0.0, 0.0, 1.0],
      ],
      T_imu_cam: null,
      T_cam_imu_translation_mm: [10.0, -80.0, -50.0],
      timeshift_cam_imu_sec: 0.0,
      timeshift_meaning: 't_imu = t_cam + timeshift',
      clock_sync_note: 'camera + imu share the boottime (elapsedRealtimeNanos) clock',
      extrinsics_source: 'camera2',
    },
  };

  const uncalibratedBlock = {
    camera: {
      model: 'pinhole',
      resolution: null,
      params: { fx: null, fy: null, cx: null, cy: null, skew: null },
      distortion_coeffs: null,
      intrinsics_source: 'camera2_uncalibrated',
    },
    cam_imu_extrinsics: {
      T_cam_imu: null,
      T_imu_cam: null,
      T_cam_imu_translation_mm: null,
      timeshift_cam_imu_sec: 0.0,
      timeshift_meaning: 't_imu = t_cam + timeshift',
      clock_sync_note: 'camera timestamps not on the shared boottime clock',
      extrinsics_source: 'camera2_no_imu_reference',
    },
  };

  it('persists a full (calibrated) calibration block on the new-row INSERT', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d61',
      },
      payload: { ...baseBody(recordingId), calibration: calibratedBlock },
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.calibration).toEqual(calibratedBlock);
  });

  it('persists the uncalibrated-fallback calibration (null params tolerated)', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d62',
      },
      payload: { ...baseBody(recordingId), calibration: uncalibratedBlock },
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.calibration).toEqual(uncalibratedBlock);
  });

  it('column is null when no calibration is sent (backward compat)', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d63',
      },
      payload: baseBody(recordingId),
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.calibration).toBeNull();
  });

  // ----------------------------------------------------------------
  // Bug 3 / D3 (2026-06-04) — the precise-GPS `location` jsonb column. Mirrors
  // the metadata.json `capture_device_info.location` block (schema 1.5.0).
  // Persisted on the new-row INSERT, sibling to ip_address. Overrides the
  // formerly-LOCKED coarse-only constraint (sign-off D3; consent + DPIA is a
  // ship gate). Nullable + optional: a no-fix segment / pre-1.5.0 client → null.
  // ----------------------------------------------------------------

  const locationBlock = {
    lat: 12.9716,
    lng: 77.5946,
    accuracy_m: 8.5,
    provider: 'fused',
    captured_at: '2026-05-05T00:30:19.500+05:30',
    label: 'Bangalore, India',
  };

  it('persists a precise location block on the new-row INSERT', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d71',
      },
      payload: { ...baseBody(recordingId), location: locationBlock },
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.location).toEqual(locationBlock);
  });

  it('persists a location with a null label (no reverse-geocode)', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d72',
      },
      payload: { ...baseBody(recordingId), location: { ...locationBlock, label: null } },
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.location).toEqual({ ...locationBlock, label: null });
  });

  it('column is null when no location is sent (backward compat)', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d73',
      },
      payload: baseBody(recordingId),
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows[0]!.location).toBeNull();
  });

  it('rejects a malformed location (lat not a number) with 400', async () => {
    const recordingId = ulid();
    const res = await app.inject({
      method: 'POST',
      url: '/recordings/init',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-1e3a2b1c4d74',
      },
      payload: { ...baseBody(recordingId), location: { ...locationBlock, lat: 'nope' } },
    });
    expect(res.statusCode).toBe(400);
    const rows = await db
      .select()
      .from(schema.recordings)
      .where(eq(schema.recordings.id, recordingId));
    expect(rows.length).toBe(0);
  });
});
