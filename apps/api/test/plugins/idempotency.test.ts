import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { db, schema } from '../../src/db/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const TEST_USER_ID = '01HVTEST00000000000000IDEM';
const TEST_KEY_OK = '4f7e8f5c-8d2a-4b7f-9c1d-0e3a2b1c4d5e'; // valid v4
const TEST_KEY_BAD = 'not-a-uuid';

function tok(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      integrity_verdict: 'bypassed_apk',
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
  app.post('/_test/echo-authed', { preHandler: [app.requireAuth] }, async (req, reply) => {
    return reply.status(200).send({ echoed: (req.body as { value?: unknown })?.value ?? null });
  });
  // Clean up any prior state, then seed the test user. Bug 4 / D2: requireAuth
  // now resolves users.current_installation_id, so an authed route 401s unless a
  // row exists whose binding matches the JWT's installationId.
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    googleSub: 'g-idem-test',
    email: 'idem@e.com',
    name: 'Idem',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    currentInstallationId: 'inst-test',
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
  });
});
afterAll(async () => {
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('idempotency plugin', () => {
  it('rejects missing Idempotency-Key with 400 idempotency-key-invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers: { authorization: `Bearer ${tok()}` },
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://humyn-app.io/problems/idempotency-key-invalid');
  });
  it('rejects malformed Idempotency-Key with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': TEST_KEY_BAD },
      payload: { value: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://humyn-app.io/problems/idempotency-key-invalid');
  });
  it('replays the same key+body and returns the original response', async () => {
    const headers = { authorization: `Bearer ${tok()}`, 'idempotency-key': TEST_KEY_OK };
    const r1 = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers,
      payload: { value: 'first' },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ echoed: 'first' });
    const r2 = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers,
      payload: { value: 'first' },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ echoed: 'first' });
  });
  it('rejects same key + different body with 409 idempotency-key-conflict', async () => {
    const headers = { authorization: `Bearer ${tok()}`, 'idempotency-key': TEST_KEY_OK };
    const r3 = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers,
      payload: { value: 'different' },
    });
    expect(r3.statusCode).toBe(409);
    expect(r3.json().type).toBe('https://humyn-app.io/problems/idempotency-key-conflict');
  });
});
