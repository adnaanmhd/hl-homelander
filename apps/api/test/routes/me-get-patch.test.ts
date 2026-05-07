// GET /me + PATCH /me — API-02 happy path + read-only field guard.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTME0000000000000000000';

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
beforeAll(async () => {
  app = await buildApp();
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-me-getpatch',
      email: 'me@e.com',
      name: 'M',
      age: 25,
      gender: 'F',
      avatarUrl: 'https://example.com/a.jpg',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('GET /me + PATCH /me', () => {
  it('GET returns the user', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().email).toBe('me@e.com');
    expect(r.json().avatarUrl).toBe('https://example.com/a.jpg');
    expect(r.json().flavor).toBe('playStore');
  });

  it('PATCH updates name + nullable gender', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-5e3a2b1c4d91',
      },
      payload: { name: 'Updated', gender: null },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().name).toBe('Updated');
    expect(r.json().gender).toBeNull();
  });

  it('PATCH does not let attacker change email (read-only field T-1.8-01)', async () => {
    const r = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-5e3a2b1c4d92',
      },
      payload: { email: 'evil@e.com', name: 'StillM' } as never,
    });
    // Either zod-strict 400 OR accepted-but-ignored — assert email never mutated.
    if (r.statusCode === 200) expect(r.json().email).toBe('me@e.com');
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, TEST_USER_ID));
    expect(rows[0]!.email).toBe('me@e.com');
  });

  it('GET without auth → 401', async () => {
    const r = await app.inject({ method: 'GET', url: '/me' });
    expect(r.statusCode).toBe(401);
  });
});
