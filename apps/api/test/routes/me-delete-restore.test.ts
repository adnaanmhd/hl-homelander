// DELETE /me + POST /me/restore — API-03 (DSR erasure-only). Asserts the
// 30-day grace window, restore-in-window, restore-past-grace = 410, and the
// DSR cron's findHardDeleteCandidates() picks up past-grace users.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';
import { findHardDeleteCandidates } from '../../src/cron/dsr-hard-delete.js';

const TEST_USER_ID = '01HVTMD0000000000000000000';

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
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});
beforeEach(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  // Clear cached idempotency replays for this test user — UUIDs in this file
  // are deterministic so prior runs would otherwise replay stale 410s.
  await db.delete(schema.idempotencyKeys).where(eq(schema.idempotencyKeys.userId, TEST_USER_ID));
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    googleSub: 'g-md-deleterestore',
    email: 'md@e.com',
    name: 'M',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    flavor: 'playStore',
    applicationId: 'ai.humynlabs.capture',
  });
});

describe('DELETE /me + POST /me/restore', () => {
  it('DELETE without ?confirm=DELETE → 400', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/me',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(400);
  });

  it('DELETE with ?confirm=DELETE sets deletedAt + deleteGraceUntil = now+30d', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/me?confirm=DELETE',
      headers: { authorization: `Bearer ${tok()}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, TEST_USER_ID));
    expect(rows[0]!.deletedAt).not.toBeNull();
    expect(rows[0]!.deleteGraceUntil).not.toBeNull();
    const grace = rows[0]!.deleteGraceUntil!.getTime() - Date.now();
    expect(grace).toBeGreaterThan(29 * 24 * 3600 * 1000);
    expect(grace).toBeLessThan(31 * 24 * 3600 * 1000);
  });

  it('DELETE with an unregistered content-type + body → 200, not 415 (Bug 1 catch-all parser)', async () => {
    // Regression for Bug 1 (260604): RN/OkHttp attaches a content-type Fastify
    // had no parser for, throwing FST_ERR_CTP_INVALID_MEDIA_TYPE (415) before the
    // handler ran. The catch-all '*' parser in app.ts now drains + discards any
    // unregistered body so bodiless verbs reach their handler. (inject can't
    // replay OkHttp's exact default, so we force an unregistered type + a body.)
    const r = await app.inject({
      method: 'DELETE',
      url: '/me?confirm=DELETE',
      headers: {
        authorization: `Bearer ${tok()}`,
        'content-type': 'application/octet-stream',
      },
      payload: 'ignored-by-catch-all',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
  });

  it('POST /me/restore within grace clears deletedAt', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/me?confirm=DELETE',
      headers: { authorization: `Bearer ${tok()}` },
    });
    const r = await app.inject({
      method: 'POST',
      url: '/me/restore',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-6e3a2b1c4da1',
      },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, TEST_USER_ID));
    expect(rows[0]!.deletedAt).toBeNull();
    expect(rows[0]!.deleteGraceUntil).toBeNull();
  });

  it('POST /me/restore past grace → 410', async () => {
    await db
      .update(schema.users)
      .set({
        deletedAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        deleteGraceUntil: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      })
      .where(eq(schema.users.id, TEST_USER_ID));
    const r = await app.inject({
      method: 'POST',
      url: '/me/restore',
      headers: {
        authorization: `Bearer ${tok()}`,
        'idempotency-key': '4f7e8f5c-8d2a-4b7f-9c1d-6e3a2b1c4da2',
      },
    });
    expect(r.statusCode).toBe(410);
    expect(r.headers['content-type']).toContain('application/problem+json');
  });

  it('cron findHardDeleteCandidates includes past-grace user (T-1.8-10)', async () => {
    await db
      .update(schema.users)
      .set({
        deletedAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
        deleteGraceUntil: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      })
      .where(eq(schema.users.id, TEST_USER_ID));
    const candidates = await findHardDeleteCandidates();
    expect(candidates).toContain(TEST_USER_ID);
  });
});
