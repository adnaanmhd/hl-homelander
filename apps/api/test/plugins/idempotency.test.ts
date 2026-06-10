import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { db, schema } from '../../src/db/index.js';
import { persist, hashRequest } from '../../src/lib/idempotency-store.js';
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
let flakyCalls = 0;
beforeAll(async () => {
  app = await buildApp();
  app.post('/_test/echo-authed', { preHandler: [app.requireAuth] }, async (req, reply) => {
    return reply.status(200).send({ echoed: (req.body as { value?: unknown })?.value ?? null });
  });
  // Fails with a 4xx on the first call, succeeds afterwards — models a
  // transient client-side error (e.g. reauth-required 401) that must NOT be
  // memoized under the caller's never-rotated Idempotency-Key.
  app.post('/_test/flaky-authed', { preHandler: [app.requireAuth] }, async (_req, reply) => {
    flakyCalls += 1;
    if (flakyCalls === 1) {
      return reply.status(422).send({ error: 'transient client error' });
    }
    return reply.status(200).send({ calls: flakyCalls });
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

  // Phase 1 item 4 (2026-06-10, deploy-blocking): a 4xx must never be memoized.
  // Before the fix, the first post-deploy 401 from a legacy-JWT device was
  // cached under the upload row's fixed initIdempotencyKey and every Retry
  // replayed it for 24 h even after re-sign-in.
  it('does NOT memoize 4xx — a retry with the same key re-executes the handler', async () => {
    const key = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'; // fresh v4
    const headers = { authorization: `Bearer ${tok()}`, 'idempotency-key': key };
    const r1 = await app.inject({
      method: 'POST',
      url: '/_test/flaky-authed',
      headers,
      payload: { try: 1 },
    });
    expect(r1.statusCode).toBe(422);

    // The 422 must not have been persisted under (user, key).
    const cached = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key));
    expect(cached).toHaveLength(0);

    // Same key + same body → handler runs again and now succeeds.
    const r2 = await app.inject({
      method: 'POST',
      url: '/_test/flaky-authed',
      headers,
      payload: { try: 1 },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ calls: 2 });

    // The 2xx IS memoized: a third identical call replays without re-executing.
    const r3 = await app.inject({
      method: 'POST',
      url: '/_test/flaky-authed',
      headers,
      payload: { try: 1 },
    });
    expect(r3.statusCode).toBe(200);
    expect(r3.json()).toEqual({ calls: 2 }); // handler NOT invoked a third time
  });

  // Review hardening F3 (2026-06-10) — the READ-side guard. The >=400
  // write-guard keeps new error entries out, but an entry stored BEFORE that
  // guard deployed (or by any future regression) would otherwise pin its 4xx
  // for the 24 h TTL against the client's stable per-row keys. The plugin must
  // treat a stored error as a miss: purge it and re-execute the handler.
  it('a stale stored 4xx entry is purged + the handler re-executes (read-side guard)', async () => {
    const key = '7c9e6679-7425-40de-944b-e07fc1f90ae7'; // fresh v4
    const body = { value: 'after-purge' };
    // Seed the poisoned entry DIRECTLY via the store, bypassing the plugin's
    // write-guard — exactly what a pre-guard deploy would have left behind.
    // Same request hash, so without the guard this WOULD replay the 422.
    await persist({
      userId: TEST_USER_ID,
      key,
      method: 'POST',
      path: '/_test/echo-authed',
      requestHash: hashRequest('POST', '/_test/echo-authed', body),
      statusCode: 422,
      responseBody: { error: 'stale poisoned 4xx' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/_test/echo-authed',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': key },
      payload: body,
    });
    // The handler RAN (fresh 200) — the seeded 422 was NOT replayed.
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ echoed: 'after-purge' });

    // The poisoned entry is gone, replaced by the new success memo.
    const rows = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.statusCode).toBe(200);
  });
});
