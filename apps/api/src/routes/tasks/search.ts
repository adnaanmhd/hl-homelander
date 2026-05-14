import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { TasksSearchQuerySchema, TasksSearchResponseSchema } from '@humyn/shared-types';

// Phase 6 plan 06-02 (D-01 + D-02). Lexical-only + pg_trgm fuzzy-fallback search.
//
// Two-stage query:
//   1. ts_vector match on tasks.name_search (GIN-indexed from 0001_init.sql), ordered
//      by ts_rank DESC. This is the happy path.
//   2. When the ts_vector match returns zero rows, retry with pg_trgm similarity:
//        WHERE similarity(name, $q) > 0.3 OR similarity(description, $q) > 0.3
//      Ordered by GREATEST(similarity(name,$q), similarity(description,$q)) DESC.
//      The 0.3 threshold is pinned EXPLICITLY in the WHERE clause — never rely on
//      the session-level pg_trgm.similarity_threshold (Pitfall 4 in 06-RESEARCH.md).
//
// Drizzle's `sql` template parameterizes user-supplied `q`, `category`, `setting`
// (no SQL injection). `plainto_tsquery` itself rejects metacharacters; `similarity()`
// is a pure text function. See threat register T-6.2-01..06 in 06-02-PLAN.md.
//
// The route is intentionally public — no `app.requireAuth` preHandler; the
// anonymous-tier rate-limit applies. Matches the pre-existing posture (see Phase 1
// header convention).
//
// The pgvector / RRF / embedder code path is descoped from the MVP client surface
// (D-01) — `apps/api/src/lib/embedder.ts`, the 384-float `embedding` column, and
// the HNSW index in `0001_init.sql` remain on disk for §v2 SEARCH-V2-01 revival
// via git history.
export default async function tasksSearchRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/tasks/search',
    {
      schema: {
        querystring: TasksSearchQuerySchema,
        response: { 200: TasksSearchResponseSchema },
      },
    },
    async (req) => {
      const { q, category, setting, limit } = req.query;
      type TaskRow = {
        id: string;
        slug: string;
        name: string;
        description: string;
        category: string;
        setting: string;
        icon_key: string;
        instructions: string[];
        lex_score: number;
      };
      const result = await db.execute<TaskRow>(sql`
        WITH lex AS (
          SELECT
            t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
            t.icon_key, t.instructions,
            ts_rank(t.name_search, plainto_tsquery('english', ${q})) AS lex_score
          FROM tasks t
          WHERE
            t.name_search @@ plainto_tsquery('english', ${q})
            AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
            AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
          ORDER BY lex_score DESC
          LIMIT ${limit}
        )
        SELECT * FROM lex
      `);
      const rows = (result as unknown as { rows: TaskRow[] }).rows;
      if (rows.length === 0) {
        // D-02 — pg_trgm fuzzy fallback. Threshold pinned to 0.3 explicitly
        // (Pitfall 4 — session-level pg_trgm.similarity_threshold is not relied upon).
        const fuzzy = await db.execute<TaskRow>(sql`
          SELECT
            t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
            t.icon_key, t.instructions,
            GREATEST(similarity(t.name, ${q}), similarity(t.description, ${q})) AS lex_score
          FROM tasks t
          WHERE
            (similarity(t.name, ${q}) > 0.3 OR similarity(t.description, ${q}) > 0.3)
            AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null}::text)
            AND (${setting ?? null}::text IS NULL OR t.setting::text = ${setting ?? null}::text OR t.setting::text = 'either')
          ORDER BY lex_score DESC
          LIMIT ${limit}
        `);
        const fuzzyRows = (fuzzy as unknown as { rows: TaskRow[] }).rows;
        return { items: mapRows(fuzzyRows) };
      }
      return { items: mapRows(rows) };
    },
  );
}

function mapRows(
  rows: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    setting: string;
    icon_key: string;
    instructions: string[];
    lex_score: number;
  }>,
) {
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    setting: r.setting as 'indoor' | 'outdoor' | 'either',
    iconKey: r.icon_key,
    instructions: r.instructions,
    lex_score: Number(r.lex_score),
  }));
}
