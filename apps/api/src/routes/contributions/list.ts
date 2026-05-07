// GET /contributions — lifetime aggregate + top-10 per-task breakdown.
// Reads recordings directly (filter qa_status NOT IN takedown/rejected per
// D-LEGAL-04 + paying-user trust). The /contributions/timeseries endpoint
// reads the pre-aggregated `contributions` table populated by the trigger
// installed in migration 0004.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { ContributionsLifetimeSchema } from '@humyn/shared-types';

interface TotalsRow {
  duration_ms: string | number | null;
  recording_count: string | number | null;
  task_count: string | number | null;
}
interface PerTaskRow {
  task_id: string;
  task_name: string;
  recording_count: string | number;
  duration_ms: string | number;
}

export default async function contributionsListRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/contributions',
    {
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `user:${sub}`;
            } catch {
              /* fall-through */
            }
            return `ip:${req.ip}`;
          },
        },
      },
    },
    async (req, reply) => {
      const sub = (req.user as { sub: string }).sub;

      // Lifetime aggregate — direct from recordings (D-LEGAL-04 takedown filter).
      const totals = await db.execute(sql`
        SELECT
          COALESCE(SUM(duration_ms), 0)::bigint AS duration_ms,
          COALESCE(COUNT(*), 0)::int AS recording_count,
          COALESCE(COUNT(DISTINCT task_id), 0)::int AS task_count
        FROM recordings
        WHERE user_id = ${sub} AND qa_status NOT IN ('takedown', 'rejected')
      `);
      const totalRows = (totals as unknown as { rows: TotalsRow[] }).rows;
      const totalRow = totalRows[0] ?? {
        duration_ms: 0,
        recording_count: 0,
        task_count: 0,
      };

      // Top 10 tasks by recording count.
      const perTask = await db.execute(sql`
        SELECT
          r.task_id,
          t.name AS task_name,
          COUNT(*)::int AS recording_count,
          COALESCE(SUM(r.duration_ms), 0)::bigint AS duration_ms
        FROM recordings r JOIN tasks t ON t.id = r.task_id
        WHERE r.user_id = ${sub} AND r.qa_status NOT IN ('takedown', 'rejected')
        GROUP BY r.task_id, t.name
        ORDER BY recording_count DESC, r.task_id ASC
        LIMIT 10
      `);
      const perTaskRows = (perTask as unknown as { rows: PerTaskRow[] }).rows;

      const body = ContributionsLifetimeSchema.parse({
        durationMs: Number(totalRow.duration_ms ?? 0),
        recordingCount: Number(totalRow.recording_count ?? 0),
        taskCount: Number(totalRow.task_count ?? 0),
        perTask: perTaskRows.map((r) => ({
          taskId: r.task_id,
          taskName: r.task_name,
          recordingCount: Number(r.recording_count),
          durationMs: Number(r.duration_ms),
        })),
      });
      return reply.send(body);
    },
  );
}
