import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';
import { eq, sql } from 'drizzle-orm';
import { generateKeyPairSync } from 'node:crypto';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTRECG000000000000000US';
const OTHER_USER_ID = '01HVTRECG000000000000000XX';
const TEST_TASK_ID = '01HVTRECG00000000000000TSK';

function tok(sub = TEST_USER_ID): string {
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

let app: FastifyInstance;

beforeAll(async () => {
  // Generate a dev RSA keypair on the fly so the cloudfront-signer has a real
  // private key to round-trip. The signed URL won't actually verify against
  // any LocalStack S3 endpoint (CloudFront isn't a LocalStack service we use
  // here) — we just need the signing call to succeed and produce a URL with
  // the configured base.
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY = privateKey;
  process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID = 'K123DEVKEYPAIRID';
  process.env.CLOUDFRONT_RECORDINGS_BASE_URL = 'https://recordings-dev.humyn.ai';

  app = await buildApp();
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-getr',
      email: 'gr@e.com',
      name: 'GR',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: OTHER_USER_ID,
      googleSub: 'g-othr',
      email: 'ot@e.com',
      name: 'OT',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
  const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(
    sql`INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding) VALUES (${TEST_TASK_ID}, 'get-test', 'Get Test', 'desc', 'Test', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384)) ON CONFLICT DO NOTHING`,
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

async function seedRec(opts: {
  userId: string;
  qaStatus: 'uploaded' | 'pending' | 'verified' | 'takedown' | 'rejected' | 'hash-mismatch';
}): Promise<string> {
  const id = ulid();
  await db.execute(sql`
    INSERT INTO recordings (id, user_id, task_id, practice, qa_status, duration_ms, file_size_bytes, imu_size_bytes, s3_key_video, s3_key_imu, s3_key_metadata, captured_at, created_at, flavor)
    VALUES (${id}, ${opts.userId}, ${TEST_TASK_ID}, false, ${opts.qaStatus}::qa_status, 1000, 1024, 1024, 'video.mp4', 'imu.csv', 'metadata.json', now(), now(), 'playStore'::build_flavor)
  `);
  return id;
}

describe('GET /recordings/:id', () => {
  it('200 for owner with qa_status=uploaded — returns playback_url and playback_url_expires_at ~5 min in future', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recording_id).toBe(id);
    expect(body.qa_status).toBe('uploaded');
    expect(body.playback_url).toMatch(/^https:\/\/recordings-dev\.humyn\.ai\//);
    const ttlMs = new Date(body.playback_url_expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(4 * 60 * 1000);
    expect(ttlMs).toBeLessThan(6 * 60 * 1000);
  });

  it('404 recording-not-found on cross-user lookup', async () => {
    const id = await seedRec({ userId: OTHER_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}`,
      headers: { authorization: `Bearer ${tok(TEST_USER_ID)}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-found/);
  });

  it('404 recording-not-found on takedown row (never leaks existence)', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'takedown' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-found/);
  });

  it('404 recording-not-playable when qa_status=pending', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'pending' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-playable/);
  });

  it('404 recording-not-playable when qa_status=verified (Phase 5+ playable URL semantics deferred)', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'verified' });
    const res = await app.inject({
      method: 'GET',
      url: `/recordings/${id}`,
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().type).toMatch(/recording-not-playable/);
  });

  it('rejects unauthenticated → 401', async () => {
    const id = await seedRec({ userId: TEST_USER_ID, qaStatus: 'uploaded' });
    const res = await app.inject({ method: 'GET', url: `/recordings/${id}` });
    expect(res.statusCode).toBe(401);
  });
});
