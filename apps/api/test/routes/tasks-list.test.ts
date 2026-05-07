import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { db, schema } from '../../src/db/index.js';
import { sql } from 'drizzle-orm';
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

async function insertTask(
  slug: string,
  category: string,
  setting: 'indoor' | 'outdoor' | 'either',
) {
  const id = ulid();
  const fakeEmbedding = `[${Array.from({ length: 384 }, () => 0.0).join(',')}]`;
  await db.execute(sql`
    INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
    VALUES (${id}, ${slug}, ${slug}, ${slug}, ${category}, ${setting}::task_setting, 'tea', '["a"]'::jsonb, ${fakeEmbedding}::vector(384))
  `);
  return id;
}

describe('GET /tasks', () => {
  it('paginates with cursor', async () => {
    for (let i = 0; i < 5; i++) await insertTask(`slug-${i}`, 'Cat', 'indoor');
    const r1 = await app.inject({ method: 'GET', url: '/tasks?limit=2' });
    expect(r1.statusCode).toBe(200);
    const b1 = r1.json();
    expect(b1.items).toHaveLength(2);
    expect(b1.nextCursor).not.toBeNull();
    const r2 = await app.inject({ method: 'GET', url: `/tasks?limit=2&cursor=${b1.nextCursor}` });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().items).toHaveLength(2);
  });

  it('returns nextCursor=null when fewer rows than limit', async () => {
    await insertTask('only', 'Cat', 'indoor');
    const r = await app.inject({ method: 'GET', url: '/tasks?limit=10' });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.items).toHaveLength(1);
    expect(b.nextCursor).toBeNull();
  });

  it('filters by category', async () => {
    await insertTask('a', 'Foo', 'indoor');
    await insertTask('b', 'Bar', 'indoor');
    const r = await app.inject({ method: 'GET', url: '/tasks?category=Foo' });
    expect(r.statusCode).toBe(200);
    expect(r.json().items).toHaveLength(1);
    expect(r.json().items[0].slug).toBe('a');
  });

  it('filters by setting', async () => {
    await insertTask('indoor-task', 'Cat', 'indoor');
    await insertTask('outdoor-task', 'Cat', 'outdoor');
    const r = await app.inject({ method: 'GET', url: '/tasks?setting=outdoor' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe('outdoor-task');
  });

  it('rejects limit > 100 via Zod schema validation', async () => {
    const r = await app.inject({ method: 'GET', url: '/tasks?limit=999' });
    expect(r.statusCode).toBe(400);
  });
});
