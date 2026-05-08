// E2E idempotency-key edge cases — exercises the global idempotency hook
// (apps/api/src/plugins/idempotency.ts) at the wire level.
//
// 4 scenarios:
//   1. duplicate key + identical body            → replay (same response, no second row)
//   2. duplicate key + DIFFERENT body            → 409 idempotency-key-conflict
//   3. missing Idempotency-Key on POST           → 400 idempotency-key-invalid
//   4. malformed Idempotency-Key (not UUIDv4)    → 400 idempotency-key-invalid
//
// We use POST /events as the substrate because (a) it's authenticated, (b)
// the idempotency hook does the work BEFORE the route handler so the route
// itself is irrelevant — any auth'd POST works for these assertions.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { setupAuthMocks } from './helpers/mock-play-integrity.js';
import { truncateTestTables, signInTestUser } from './helpers/seed-fixtures.js';

setupAuthMocks();
import { buildApp } from '../../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await truncateTestTables();
});

describe('Idempotency-Key edge cases', () => {
  it('duplicate key + identical body → returns original response, no second row', async () => {
    const { token, userId } = await signInTestUser();
    const headers = {
      authorization: `Bearer ${token}`,
      'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-2e3a2b1c4d20',
    };
    const payload = {
      name: 'recording_started',
      properties: { x: '1' },
      occurredAt: new Date().toISOString(),
    };
    const r1 = await app.inject({ method: 'POST', url: '/events', headers, payload });
    const r2 = await app.inject({ method: 'POST', url: '/events', headers, payload });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    // Replay returns the SAME id (otherwise the events row was inserted twice).
    expect((r1.json() as { id: string }).id).toBe((r2.json() as { id: string }).id);
    const rows = await db.select().from(schema.events).where(eq(schema.events.userId, userId));
    expect(rows.length).toBe(1);
  });

  it('duplicate key + DIFFERENT body → 409 idempotency-key-conflict', async () => {
    const { token } = await signInTestUser();
    const headers = {
      authorization: `Bearer ${token}`,
      'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-2e3a2b1c4d21',
    };
    const r1 = await app.inject({
      method: 'POST',
      url: '/events',
      headers,
      payload: { name: 'app_started', properties: {}, occurredAt: new Date().toISOString() },
    });
    expect(r1.statusCode).toBe(201);
    const r2 = await app.inject({
      method: 'POST',
      url: '/events',
      headers,
      payload: { name: 'app_backgrounded', properties: {}, occurredAt: new Date().toISOString() },
    });
    expect(r2.statusCode).toBe(409);
    expect(r2.json().type).toBe('https://humyn-app.io/problems/idempotency-key-conflict');
  });

  it('missing Idempotency-Key on POST → 400 idempotency-key-invalid', async () => {
    const { token } = await signInTestUser();
    const r = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'app_started', properties: {}, occurredAt: new Date().toISOString() },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().type).toBe('https://humyn-app.io/problems/idempotency-key-invalid');
  });

  it('malformed Idempotency-Key (not UUIDv4) → 400 idempotency-key-invalid', async () => {
    const { token } = await signInTestUser();
    const r = await app.inject({
      method: 'POST',
      url: '/events',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'not-a-uuid' },
      payload: { name: 'app_started', properties: {}, occurredAt: new Date().toISOString() },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().type).toBe('https://humyn-app.io/problems/idempotency-key-invalid');
  });
});
