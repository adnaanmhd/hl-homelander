import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { sql } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { buildApp } from '../../src/app.js';
import { embed, buildEmbeddedText, preloadEmbedder } from '../../src/lib/embedder.js';

// Phase 6 plan 06-02 — lexical-only + pg_trgm fuzzy fallback.
// The pgvector / embedder helpers (`embed`, `buildEmbeddedText`, `preloadEmbedder`)
// are kept in test setup because the `tasks.embedding` column is `NOT NULL`
// (see 0001_init.sql:134). The route NEVER consumes the embedding — D-01 — but the
// seed path still has to satisfy the NOT NULL constraint. §v2 SEARCH-V2-01 revives
// the pgvector path; until then the column is dead-on-arrival.

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

async function hasExtension(name: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 AS ok FROM pg_extension WHERE extname = ${name}`);
  return (r as unknown as { rows: Array<{ ok: number }> }).rows.length > 0;
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

describe('GET /tasks/search — lexical-only + pg_trgm fuzzy fallback (Phase 6 D-01 + D-02)', () => {
  it('returns lexical hits when ts_vector matches', async () => {
    await seedTask(
      'sweep-floor',
      'Sweeping the floor',
      'Sweep dust and debris off the kitchen floor with a broom.',
      'Cleaning',
    );
    await seedTask(
      'fold-laundry',
      'Fold Laundry',
      'Sort and fold a basket of dry clothes.',
      'Cleaning',
    );
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=sweep&limit=5' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items as Array<{ name: string; lex_score: number }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].name.toLowerCase()).toMatch(/sweep/);
    expect(typeof items[0].lex_score).toBe('number');
    expect(items[0].lex_score).toBeGreaterThan(0);
  }, 60_000);

  it('falls back to pg_trgm when ts_vector returns zero', async () => {
    if (!(await hasExtension('pg_trgm'))) {
      // Skip rather than fail-by-omission if the dev DB doesn't have the
      // 0007_pg_trgm migration applied yet.
      return;
    }
    await seedTask(
      'sweep-floor',
      'Sweeping the floor',
      'Sweep dust and debris off the kitchen floor with a broom.',
      'Cleaning',
    );
    await seedTask(
      'fold-laundry',
      'Fold Laundry',
      'Sort and fold a basket of dry clothes.',
      'Cleaning',
    );
    // Intentional typo — "sweping" — to force ts_vector to miss and trigger pg_trgm fallback.
    // similarity('sweping', 'Sweeping the floor') ≈ 0.35 > 0.3 (threshold), confirmed
    // empirically; ts_vector's english stemmer does NOT recover this transposition.
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=sweping&limit=5' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items as Array<{ name: string; lex_score: number }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].name.toLowerCase()).toMatch(/sweep/);
    // pg_trgm similarity scores are in (0, 1] and our threshold gate is `> 0.3`.
    expect(items[0].lex_score).toBeGreaterThan(0.3);
  }, 60_000);

  it('returns empty items when both lexical and pg_trgm miss', async () => {
    await seedTask('make-tea', 'Make Tea', 'Boil water and brew a cup of black tea.', 'Cooking');
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=zzzzzzzz&limit=5' });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[] };
    expect(body.items).toEqual([]);
  }, 60_000);

  it('response items carry lex_score, never rrf_score', async () => {
    await seedTask('make-tea', 'Make Tea', 'Boil water and brew a cup of black tea.', 'Cooking');
    const r = await app.inject({ method: 'GET', url: '/tasks/search?q=tea&limit=5' });
    expect(r.statusCode).toBe(200);
    const items = r.json().items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('lex_score');
    expect(items[0]).not.toHaveProperty('rrf_score');
  }, 60_000);

  it('category filter narrows results', async () => {
    // Two tasks both match the query "make" — one Cooking, one Cleaning.
    await seedTask('make-tea', 'Make Tea', 'Boil water and brew a cup of black tea.', 'Cooking');
    await seedTask(
      'make-bed',
      'Make the Bed',
      'Make the bed by tucking in the sheets and arranging pillows.',
      'Cleaning',
    );
    const r = await app.inject({
      method: 'GET',
      url: `/tasks/search?q=make&category=${encodeURIComponent('Cooking')}&limit=5`,
    });
    expect(r.statusCode).toBe(200);
    const items = r.json().items as Array<{ slug: string; category: string }>;
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) expect(it.category).toBe('Cooking');
    expect(items.find((it) => it.slug === 'make-bed')).toBeUndefined();
  }, 60_000);

  // Existing safety nets — preserved from Phase 1 coverage. The RRF assertions
  // (`rrf_score`, "make tea wins on lexical match") are dropped per D-01a.

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
