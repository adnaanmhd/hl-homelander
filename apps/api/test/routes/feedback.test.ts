// POST /feedback (multipart) — API-12. Asserts the multipart happy path with
// a diagnostic JSON file lands an S3 key, the content-type allowlist (T-1.8-04)
// rejects text/plain, and the category enum rejects unknown values.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';
import FormData from 'form-data';

const TEST_USER_ID = '01HVTFB0000000000000000000';

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
  await db.delete(schema.feedback).where(eq(schema.feedback.userId, TEST_USER_ID));
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-feedback',
      email: 'fb@e.com',
      name: 'F',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  await db.delete(schema.feedback).where(eq(schema.feedback.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('POST /feedback (multipart)', () => {
  it('happy path with diagnostic JSON file → 201 + S3 key', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'It crashed when I tapped record');
    form.append(
      'diagnostic',
      Buffer.from(JSON.stringify({ os: 'Android 14', model: 'Pixel 7a' })),
      {
        filename: 'diag.json',
        contentType: 'application/json',
      },
    );
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc1',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(201);
    expect(typeof r.json().id).toBe('string');
    expect(typeof r.json().diagnosticS3Key).toBe('string');
    expect(r.json().diagnosticS3Key).toMatch(/^feedback\//);
  });

  it('rejects non-application/json diagnostic (text/plain) → 400 (T-1.8-04)', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'msg');
    form.append('diagnostic', Buffer.from('hi'), {
      filename: 'd.txt',
      contentType: 'text/plain',
    });
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc2',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(400);
  });

  it('rejects bad category → 400', async () => {
    const form = new FormData();
    form.append('category', 'arbitrary-category');
    form.append('message', 'msg');
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc3',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(400);
  });

  it('rejects unauthenticated → 401', async () => {
    const form = new FormData();
    form.append('category', 'app-crashed');
    form.append('message', 'msg');
    const r = await app.inject({
      method: 'POST',
      url: '/feedback',
      headers: {
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-8e3a2b1c4dc4',
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });
    expect(r.statusCode).toBe(401);
  });
});
