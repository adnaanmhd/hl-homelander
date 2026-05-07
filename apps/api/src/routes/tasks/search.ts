import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { embed } from '../../lib/embedder.js';
import { TasksSearchQuerySchema, TasksSearchResponseSchema } from '@humyn/shared-types';

// RRF k=60 hybrid search — verbatim from RESEARCH §1.3.
// Drizzle's `sql` template parameterizes user-supplied `q`, `category`, `setting`
// as bound params (no SQL injection). The 384-float embedding literal is built
// from numerics-only join (also safe; T-1.6-02 in the threat model).
//
// `k = 60` is locked from upstream (see CONTEXT — `Locked from upstream`); do NOT
// tune at MVP without re-validating recall on the 65-task fixture.
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
      const queryEmbedding = await embed(q);
      // Embedding literal — built from numerics only; no injection vector
      const embeddingLiteral = `[${queryEmbedding.join(',')}]`;
      const k = 60; // RRF constant — locked at 60 per CONTEXT (Locked from upstream)
      const result = await db.execute<{
        id: string;
        slug: string;
        name: string;
        description: string;
        category: string;
        setting: string;
        icon_key: string;
        instructions: string[];
        rrf_score: number;
      }>(sql`
        WITH
          vector_ranks AS (
            SELECT
              id,
              ROW_NUMBER() OVER (ORDER BY embedding <=> ${embeddingLiteral}::vector(384)) AS rnk
            FROM tasks
            WHERE
              (${category ?? null}::text IS NULL OR category = ${category ?? null}::text)
              AND (${setting ?? null}::text IS NULL OR setting::text = ${setting ?? null}::text OR setting::text = 'either')
            ORDER BY embedding <=> ${embeddingLiteral}::vector(384)
            LIMIT 200
          ),
          lexical_ranks AS (
            SELECT
              id,
              ROW_NUMBER() OVER (
                ORDER BY ts_rank(name_search, plainto_tsquery('english', ${q})) DESC
              ) AS rnk
            FROM tasks
            WHERE
              name_search @@ plainto_tsquery('english', ${q})
              AND (${category ?? null}::text IS NULL OR category = ${category ?? null}::text)
              AND (${setting ?? null}::text IS NULL OR setting::text = ${setting ?? null}::text OR setting::text = 'either')
            ORDER BY ts_rank(name_search, plainto_tsquery('english', ${q})) DESC
            LIMIT 200
          ),
          fused AS (
            SELECT
              COALESCE(v.id, l.id) AS id,
              (
                COALESCE(1.0 / (${k}::numeric + v.rnk), 0)
                +
                COALESCE(1.0 / (${k}::numeric + l.rnk), 0)
              ) AS rrf_score
            FROM vector_ranks v
            FULL OUTER JOIN lexical_ranks l ON v.id = l.id
          )
        SELECT
          t.id, t.slug, t.name, t.description, t.category, t.setting::text AS setting,
          t.icon_key, t.instructions, f.rrf_score
        FROM fused f
        JOIN tasks t ON t.id = f.id
        ORDER BY f.rrf_score DESC
        LIMIT ${limit};
      `);
      // Drizzle's execute returns { rows: [...] } shape on node-postgres
      const rows = (
        result as unknown as {
          rows: Array<{
            id: string;
            slug: string;
            name: string;
            description: string;
            category: string;
            setting: string;
            icon_key: string;
            instructions: string[];
            rrf_score: number;
          }>;
        }
      ).rows;
      return {
        items: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          description: r.description,
          category: r.category,
          setting: r.setting as 'indoor' | 'outdoor' | 'either',
          iconKey: r.icon_key,
          instructions: r.instructions,
          rrf_score: Number(r.rrf_score),
        })),
      };
    },
  );
}
