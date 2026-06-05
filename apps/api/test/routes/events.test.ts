// POST /events — API-11. Asserts the allowlist enforcement (T-1.8-05) and
// that a happy-path call lands a row.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

const TEST_USER_ID = '01HVTEV0000000000000000000';

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
  await db.delete(schema.events).where(eq(schema.events.userId, TEST_USER_ID));
  // Clear cached idempotency replays — deterministic UUIDs in this file would
  // otherwise replay a prior 201 (skipping the actual insert) on re-runs.
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      googleSub: 'g-events',
      email: 'ev@e.com',
      name: 'E',
      consentVersion: '1.0.0',
      consentAcceptedAt: new Date(),
      currentInstallationId: 'inst-test',
      flavor: 'playStore',
      applicationId: 'ai.humynlabs.capture',
    })
    .onConflictDoNothing();
});
afterAll(async () => {
  await db.delete(schema.events).where(eq(schema.events.userId, TEST_USER_ID));
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});

describe('POST /events', () => {
  it('happy path → 201 + row inserted', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/events',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-7e3a2b1c4db1',
      },
      payload: {
        name: 'recording_started',
        properties: { taskId: 'T1' },
        occurredAt: new Date().toISOString(),
      },
    });
    expect(r.statusCode).toBe(201);
    expect(typeof r.json().id).toBe('string');
    const rows = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.userId, TEST_USER_ID));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.find((row) => row.name === 'recording_started')).toBeTruthy();
  });

  it('rejects unknown event name like arbitrary_event_name → 400', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/events',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-7e3a2b1c4db2',
      },
      payload: {
        name: 'arbitrary_event_name',
        properties: {},
        occurredAt: new Date().toISOString(),
      },
    });
    expect(r.statusCode).toBe(400);
  });

  it('rejects unauthenticated → 401', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { 'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-7e3a2b1c4db3' },
      payload: {
        name: 'app_started',
        properties: {},
        occurredAt: new Date().toISOString(),
      },
    });
    expect(r.statusCode).toBe(401);
  });
});
