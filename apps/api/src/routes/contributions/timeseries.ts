// GET /contributions/timeseries?range=7d|30d|90d — daily-bucket time series
// from the pre-aggregated `contributions` table (populated by the trigger
// installed in migration 0004). Oldest-first.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  ContributionsTimeseriesQuerySchema,
  ContributionsTimeseriesSchema,
} from '@humyn/shared-types';

const RANGE_DAYS: Record<'7d' | '30d' | '90d', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface Row {
  bucket_date: string;
  duration_ms: string | number;
  recording_count: string | number;
  task_count: string | number;
}

export default async function contributionsTimeseriesRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/contributions/timeseries',
    {
      schema: { querystring: ContributionsTimeseriesQuerySchema },
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
      const days = RANGE_DAYS[req.query.range];

      // bucket_date is stored as YYYY-MM-DD UTC text; we compare as text after
      // computing the cutoff with Postgres date arithmetic on the server clock.
      const result = await db.execute(sql`
        SELECT bucket_date,
               duration_ms::text AS duration_ms,
               recording_count::text AS recording_count,
               task_count::text AS task_count
        FROM contributions
        WHERE user_id = ${sub}
          AND bucket_date >= to_char((now() - (${days} || ' days')::interval)::date, 'YYYY-MM-DD')
        ORDER BY bucket_date ASC
      `);
      const rows = (result as unknown as { rows: Row[] }).rows;
      const body = ContributionsTimeseriesSchema.parse({
        buckets: rows.map((r) => ({
          bucketDate: r.bucket_date,
          durationMs: Number(r.duration_ms),
          recordingCount: Number(r.recording_count),
          taskCount: Number(r.task_count),
        })),
      });
      return reply.send(body);
    },
  );
}
