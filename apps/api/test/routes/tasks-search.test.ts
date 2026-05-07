import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';
import { embed, buildEmbeddedText, preloadEmbedder } from '../../src/lib/embedder.js';

let app: FastifyInstance;

async function seedTask(
  slug: string,
  name: string,
  description: string,
  category: string,
  setting: 'indoor' | 'outdoor' | 'either' = 'either',
) {
  const id = ulid();
  const text = buildEmbeddedText({ name, description, category });
  const e = await embed(text);
  await db.execute(sql`
    INSERT INTO tasks (id, slug, name, description, category, setting, icon_key, instructions, embedding)
    VALUES (${id}, ${slug}, ${name}, ${description}, ${category}, ${setting}::task_setting, 'tea', '["step"]'::jsonb, ${`[${e.join(',')}]`}::vector(384))
  `);
}

beforeAll(async () => {
  await preloadEmbedder(); // pay model load once
  app = await buildApp();
}, 120_000);
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await db.delete(schema.tasks);
});

describe('GET /tasks/search — RRF k=60 hybrid', () => {
  it('returns relevant tasks for "make tea" query (lexical match wins)', async () => {
    await seedTask('make-tea', 'Make Tea', 'Boil water and brew a cup of black tea.', 'Cooking');
    await seedTask(
      'fold-laundry',
      'Fold Laundry',
      'Sort and fold a basket of dry clothes.',
      'Cleaning',
    );
    await seedTask(
      'change-bulb',
      'Change Light Bulb',
      'Replace a burnt-out incandescent bulb.',
      'Maintenance',
    );
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=make+tea&limit=5' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].slug).toBe('make-tea');
    expect(typeof items[0].rrf_score).toBe('number');
  }, 60_000);

  it('returns relevant tasks for "fold laundry" query', async () => {
    await seedTask('make-tea', 'Make Tea', 'Boil water and brew a cup of black tea.', 'Cooking');
    await seedTask(
      'fold-laundry',
      'Fold Laundry',
      'Sort and fold a basket of dry clothes.',
      'Cleaning',
    );
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=fold+laundry&limit=5' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].slug).toBe('fold-laundry');
  }, 60_000);

  it('does not allow SQL injection via category param', async () => {
    await seedTask('a', 'A', 'A description.', 'Cooking');
    const r = await app.inject({
      method: 'GET',
      url: `/tasks/search?q=test&category=${encodeURIComponent("Cooking' OR 1=1 --")}`,
    });
    // The injected category is a literal string match; no row uses that
    // category, so the result list should NOT contain the seeded task.
    expect(r.statusCode).toBe(200);
    const items = r.json().items as Array<{ slug: string }>;
    expect(items.find((it) => it.slug === 'a')).toBeUndefined();
  }, 60_000);

  it('rejects limit > 50 via Zod schema validation', async () => {
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=anything&limit=999' });
    expect(r.statusCode).toBe(400);
  });

  it('rejects empty q via Zod schema validation', async () => {
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=' });
    expect(r.statusCode).toBe(400);
  });
});
