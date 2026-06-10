// Phase 1 item 4 (2026-06-10) — the idempotency plugin's onSend persist() is
// best-effort: a memoization WRITE failure must never turn an already-succeeded
// request into a 500 (this was one of the /feedback 500 paths). The store
// module is mocked so persist() always throws; the request must still 200.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

vi.mock('../../src/lib/idempotency-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/idempotency-store.js')>();
  return {
    ...actual,
    persist: vi.fn(async () => {
      throw new Error('simulated idempotency-store outage');
    }),
  };
});

import { buildApp } from '../../src/app.js';
import { db, schema } from '../../src/db/index.js';
import { persist } from '../../src/lib/idempotency-store.js';

const TEST_USER_ID = '01HVTEST00000000000000PERS';
const TEST_KEY = '7c9e6679-7425-40de-944b-e07fc1f90ae7'; // valid v4

function tok(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      integrity_verdict: 'bypassed_apk',
      token_version: 1,
      installationId: 'inst-persist-guard',
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  app.post('/_test/persist-guard', { preHandler: [app.requireAuth] }, async (_req, reply) =>
    reply.status(200).send({ ok: true }),
  );
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    googleSub: 'g-persist-guard-test',
    email: 'persist-guard@e.com',
    name: 'PersistGuard',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    currentInstallationId: 'inst-persist-guard',
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
  });
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('idempotency persist guard', () => {
  it('a failing persist() does not fail the (already succeeded) request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/_test/persist-guard',
      headers: { authorization: `Bearer ${tok()}`, 'idempotency-key': TEST_KEY },
      payload: { value: 'x' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(vi.mocked(persist)).toHaveBeenCalledTimes(1);
  });
});
