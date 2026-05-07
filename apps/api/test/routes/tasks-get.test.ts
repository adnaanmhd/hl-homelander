import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await db.delete(schema.tasks);
});

describe('GET /tasks/:id', () => {
  it('returns 200 + task on hit', async () => {
    const id = ulid();
    const fake = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
    await db.execute(sql`
      INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
      VALUES (${id}, 's', 'n', 'd', 'c', 'either'::task_setting, 'tea', '["a"]'::jsonb, ${fake}::vector(384))
    `);
    const r = await app.inject({ method: 'GET', url: `/tasks/${id}` });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.slug).toBe('s');
    expect(body.iconKey).toBe('tea');
    expect(body.instructions).toEqual(['a']);
  });

  it('returns 404 problem+json on miss', async () => {
    // Valid 26-char ULID-shaped id that does not exist in the DB.
    const r = await app.inject({ method: 'GET', url: '/tasks/01HVMISSING000000000000000' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(r.json().type).toBe('https://humyn-app.io/problems/not-found');
  });

  it('rejects malformed (non-26-char) id with 400', async () => {
    const r = await app.inject({ method: 'GET', url: '/tasks/not-a-ulid' });
    expect(r.statusCode).toBe(400);
  });
});
