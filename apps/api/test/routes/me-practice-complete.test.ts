// POST /me/practice-complete — Bug 5 / D7. Idempotent stamp of
// users.practice_completed_at + surfaced on GET /me.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTPC0000000000000000000';

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
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    googleSub: 'g-me-practice',
    email: 'practice@e.com',
    name: 'P',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    currentInstallationId: 'inst-test',
    flavor: 'playStore',
    applicationId: 'ai.humynlabs.capture',
  });
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('POST /me/practice-complete (Bug 5 / D7)', () => {
  it('requires auth (401 without a bearer)', async () => {
    const r = await app.inject({ method: 'POST', url: '/me/practice-complete' });
    expect(r.statusCode).toBe(401);
  });

  it('first call stamps practice_completed_at and returns it; GET /me reflects it', async () => {
    // Precondition: GET /me shows null before completion.
    const before = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().practiceCompletedAt).toBeNull();

    const r = await app.inject({
      method: 'POST',
      url: '/me/practice-complete',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    const ts = r.json().practiceCompletedAt as string;
    expect(typeof ts).toBe('string');
    expect(Number.isNaN(Date.parse(ts))).toBe(false);

    const after = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(after.json().practiceCompletedAt).toBe(ts);
  });

  it('is idempotent — a second call returns the SAME timestamp (set-if-NULL)', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/me/practice-complete',
      headers: { authorization: `Bearer ${tok()}` },
    });
    const firstTs = first.json().practiceCompletedAt as string;
    const second = await app.inject({
      method: 'POST',
      url: '/me/practice-complete',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().practiceCompletedAt).toBe(firstTs);
  });
});
