// GET /recordings/:id/stream-url — D-08 (Phase 6 plan 06-03).
// 10-case behavior matrix from the plan:
//   1. verified, age<90d        → 200 archiveState='available' (CloudFront URL)
//   2. uploaded, age<90d        → 200 'available'
//   3. hash-mismatch, age<90d   → 200 'available' (D-08 only excludes takedown/rejected/pending)
//   4. pending                  → 200 'unavailable' / presignedUrl=null
//   5. takedown                 → 404 recording-not-found (T-1.7-10 no leak)
//   6. rejected                 → 404 recording-not-found
//   7. cross-user (right id, wrong sub) → 404 recording-not-found (T-1.7-10)
//   8. age > 90d                → 200 'deep-archive' / presignedUrl=null
//   9. unauthenticated          → 401
//  10. Pattern 28 — /recordings/:id/stream-url resolves to this route, NOT /:id
//
// (Rate-limit case is exercised by the per-route rate-limit pattern; not
// retested here since contributions/list.ts already covers the same path.)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { generateKeyPairSync } from 'node:crypto';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTRECS000000000000000US';
const OTHER_USER_ID = '01HVTRECS000000000000000XX';
const TEST_TASK_ID = '01HVTRECS00000000000000TSK';
const CF_BASE_URL = 'https://recordings-dev.humyn.ai';

function tok(sub = TEST_USER_ID): string {
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

beforeAll(async () => {
  // Generate a dev RSA keypair so the cloudfront-signer has a real PEM to
  // round-trip. The signed URL won't verify against any real CloudFront
  // distribution; we only assert the call succeeds and produces a URL whose
  // host matches CLOUDFRONT_RECORDINGS_BASE_URL + the recording's s3_key_video.
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY = privateKey;
  process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID = 'K123DEVKEYPAIRID';
  process.env.CLOUDFRONT_RECORDINGS_BASE_URL = CF_BASE_URL;

  app = await buildApp();
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-stru',
      email: 'su@e.com',
      name: 'SU',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: OTHER_USER_ID,
      googleSub: 'g-stro',
      email: 'so@e.com',
      name: 'SO',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'stru-test', 'Stru Test', 'desc', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
  );
});

afterAll(async () => {
  await db.delete(schema.recordings);
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, OTHER_USER_ID));
  await db.delete(schema.tasks).where(eq(schema.tasks.id, TEST_TASK_ID));
  await app.close();
});

beforeEach(async () => {
  await db.delete(schema.recordings);
});

// Insert directly via raw SQL so we can override `created_at` for the
// deep-archive case (Drizzle's defaultNow would otherwise force `now()`).
async function seedRec(opts: {
  userId: string;
  qaStatus: 'uploaded' | 'pending' | 'verified' | 'takedown' | 'rejected' | 'hash-mismatch';
  createdAtOverride?: Date;
}): Promise<string> {
  const id = ulid();
  const createdAt = opts.createdAtOverride ?? new Date();
  await db.execute(sql`
    INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, created_at, flavor)
    VALUES (${id}, ${opts.userId}, ${TEST_TASK_ID}, false, ${opts.qaStatus}::qa_status, 1000, 1024, 1024, ${`recordings/${opts.userId}/${id}/video.mp4`}, ${`recordings/${opts.userId}/${id}/imu.csv`}, ${`recordings/${opts.userId}/${id}/metadata.json`}, ${createdAt.toISOString()}::timestamptz, ${createdAt.toISOString()}::timestamptz, 'playStore'::build_flavor)
  `);
  return id;
}

describe('GET /recordings/:id/stream-url', () => {
  it('1. verified + age<90d → 200 archiveState=available, CloudFront-signed URL', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'verified' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.archiveState).toBe('available');
    expect(body.presignedUrl).toMatch(
      new RegExp(`^${CF_BASE_URL}/recordings/${TEST_USER_ID}/${id}/video\\.mp4\\?`),
    );
    expect(body.presignedUrl).toMatch(/Expires=/);
    // expiresAt = now + 5 min (allow ±30s slack for slow CI runs)
    const ttlMs = new Date(body.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(4.5 * 60 * 1000);
    expect(ttlMs).toBeLessThan(5.5 * 60 * 1000);
  });

  it('2. uploaded + age<90d → 200 archiveState=available', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().archiveState).toBe('available');
    expect(res.json().presignedUrl).toMatch(/^https:\/\//);
  });

  it('3. hash-mismatch + age<90d → 200 archiveState=available (D-08 only excludes takedown/rejected/pending)', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'hash-mismatch' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().archiveState).toBe('available');
  });

  it('4. pending → 200 archiveState=unavailable, presignedUrl=null', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'pending' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.archiveState).toBe('unavailable');
    expect(body.presignedUrl).toBeNull();
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('5. takedown → 404 recording-not-found (T-1.7-10 no existence leak)', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'takedown' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-found/);
  });

  it('6. rejected → 404 recording-not-found', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'rejected' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-found/);
  });

  it('7. cross-user (right id, wrong sub) → 404 recording-not-found', async () => {
    const id = await seedRec({ userId: OTHER_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok(TEST_USER_ID)}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-found/);
  });

  it('8. age > 90d → 200 archiveState=deep-archive, presignedUrl=null', async () => {
    const id = await seedRec({
      userId: TEST_USER_ID,
      qaStatus: 'verified',
      createdAtOverride: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.archiveState).toBe('deep-archive');
    expect(body.presignedUrl).toBeNull();
  });

  it('9. unauthenticated → 401', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('10. Pattern 28 — /recordings/:id/stream-url resolves to this route, NOT /recordings/:id', async () => {
    // The radix tree must route '/recordings/<id>/stream-url' to the new
    // route. If precedence were inverted, /recordings/:id would match with
    // id="<id>/stream-url", which violates the 26-char ULID schema and
    // surfaces a 400 instead of a 200/404 from this route.
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}/stream-url`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    // Expect the stream-url 200 envelope, not a /:id-shape body
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('archiveState');
    expect(res.json()).not.toHaveProperty('playback_url');
  });
});
