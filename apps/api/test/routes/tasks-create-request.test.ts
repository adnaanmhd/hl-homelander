import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { db, schema } from '../../src/db/index.js';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTREQ0000000000000000US';

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
  // Seed a user row so FK is satisfied
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-test-tasks-req',
      email: 't-tasks-req@e.com',
      name: 'T',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  await db.delete(schema.taskRequests).where(eq(schema.taskRequests.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});
beforeEach(async () => {
  await db.delete(schema.taskRequests).where(eq(schema.taskRequests.userId, TEST_USER_ID));
});

describe('POST /task-requests', () => {
  it('happy path → 201 + row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/task-requests',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-0e3a2b1c4d5e',
      },
      payload: {
        name: 'New Task',
        description: 'A new ten-character description',
        category: 'Other',
        setting: 'indoor',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('pending');
    expect(body.userId).toBe(TEST_USER_ID);
    expect(body.name).toBe('New Task');
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBe(26);
  });

  it('rejects setting=either', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/task-requests',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-0e3a2b1c4d5f',
      },
      payload: {
        name: 'New Task',
        description: 'A new ten-character description',
        category: 'Other',
        setting: 'either',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated request → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/task-requests',
      headers: { 'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-0e3a2b1c4d60' },
      // Valid body — we are testing the auth gate, not the validator.
      payload: {
        name: 'A valid name',
        description: 'A valid description that is ten chars or more',
        category: 'Other',
        setting: 'indoor',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing Idempotency-Key with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/task-requests',
      headers: { authorization: `Bearer ${tok()}` },
      // Valid body — we are testing the idempotency gate, not the validator.
      payload: {
        name: 'A valid name',
        description: 'A valid description that is ten chars or more',
        category: 'Other',
        setting: 'indoor',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe('https://humyn-app.io/problems/idempotency-key-invalid');
  });
});
