import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db, schema } from '../../src/db/index.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe('POST /auth/nonce', () => {
  it('returns {nonceId, nonce} and persists a row', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/nonce' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nonceId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(typeof body.nonce).toBe('string');
    const rows = await db
      .select()
      .from(schema.authNonces)
      .where(eq(schema.authNonces.id, body.nonceId));
    expect(rows.length).toBe(1);
    // Cleanup
    await db.delete(schema.authNonces).where(eq(schema.authNonces.id, body.nonceId));
  });
});
