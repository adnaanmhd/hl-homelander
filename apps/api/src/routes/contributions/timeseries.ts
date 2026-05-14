// GET /contributions/timeseries — daily-bucket time series from the pre-aggregated
// `contributions` table (populated by the trigger installed in migration 0004).
//
// Phase 1 surface: `range=7d|30d|90d` only, oldest-first daily buckets.
// Phase 6 plan 06-03 adds:
//   - optional `start`/`end` ISO dates (D-03) — take precedence over `range`
//   - optional `Accept-Timezone` IANA header (D-03b) — coerces the start/end
//     YYYY-MM-DD pair from device-local midnight to timestamptz when filtering
//   - optional `aggregate=true` (D-03a) — returns ONE summed bucket
//     (SUM duration_ms + COUNT(*) + COUNT(DISTINCT task_id)) from the
//     `recordings` table directly, because distinct-task counts cannot be
//     summed across daily buckets without double-counting tasks that recur
//     on multiple days.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import {
  ContributionsTimeseriesQuerySchema,
  ContributionsTimeseriesSchema,
} from '@humyn/shared-types';

const RANGE_DAYS: Record<'7d' | '30d' | '90d', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

interface BucketRow {
  bucket_date: string;
  duration_ms: string | number;
  recording_count: string | number;
  task_count: string | number;
}

interface AggregateRow {
  duration_ms: string | number;
  recording_count: number;
  task_count: number;
}

// D-03b — validate the optional Accept-Timezone header against IANA names.
function isValidIanaTimezone(tz: string): boolean {
  try {
    // Side-effect construction is the validity probe — Intl.DateTimeFormat
    // throws a RangeError on unknown timezone names. Calling `.resolvedOptions()`
    // forces the constructor to evaluate the timeZone option.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions();
    return true;
  } catch {
    return false;
  }
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
      const { range, start, end, aggregate } = req.query;

      // D-03b — optional Accept-Timezone IANA name. Unknown TZ → 400.
      const tz = req.headers['accept-timezone'] as string | undefined;
      if (tz !== undefined && !isValidIanaTimezone(tz)) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: 'Invalid Accept-Timezone',
          status: 400,
          detail: `Unknown IANA timezone: ${tz}`,
          instance: req.id as string,
        });
        return reply.status(400).type('application/problem+json').send(pd);
      }

      // D-03a — aggregate branch. ONE summed bucket from the recordings table
      // directly (so COUNT(DISTINCT task_id) is correct over the window).
      // Mirrors the lifetime aggregate in `contributions/list.ts` but windowed.
      if (aggregate) {
        const windowClauses: SQL[] = [];
        if (start && end) {
          // PG gotcha (see recordings/list.ts) — cast `::date::timestamp` so
          // `AT TIME ZONE tz` interprets the bare wall-clock AS IF in `tz`
          // and returns a timestamptz; `::date AT TIME ZONE tz` does the
          // OPPOSITE direction (renders via the session TZ first).
          if (tz) {
            windowClauses.push(
              sql`AND created_at >= (${start}::date::timestamp AT TIME ZONE ${tz})`,
            );
            windowClauses.push(sql`AND created_at <  (${end}::date::timestamp AT TIME ZONE ${tz})`);
          } else {
            windowClauses.push(sql`AND created_at >= ${start}::date`);
            windowClauses.push(sql`AND created_at <  ${end}::date`);
          }
        } else {
          const days = RANGE_DAYS[range];
          windowClauses.push(sql`AND created_at >= now() - (${days} || ' days')::interval`);
        }
        const aggResult = await db.execute(sql`
          SELECT
            COALESCE(SUM(duration_ms), 0)::bigint AS duration_ms,
            COALESCE(COUNT(*), 0)::int           AS recording_count,
            COALESCE(COUNT(DISTINCT task_id), 0)::int AS task_count
          FROM recordings
          WHERE user_id = ${sub}
            AND qa_status NOT IN ('takedown', 'rejected')
            ${sql.join(windowClauses, sql` `)}
        `);
        const aggRows = (aggResult as unknown as { rows: AggregateRow[] }).rows;
        const row = aggRows[0] ?? { duration_ms: 0, recording_count: 0, task_count: 0 };
        // Preserve the existing daily-bucket response shape — a single-element
        // array. `bucketDate` = the window's start anchor (or today when the
        // caller used `range` instead of explicit start/end).
        const bucketDate = start ?? new Date().toISOString().slice(0, 10);
        const body = ContributionsTimeseriesSchema.parse({
          buckets: [
            {
              bucketDate,
              durationMs: Number(row.duration_ms),
              recordingCount: Number(row.recording_count),
              taskCount: Number(row.task_count),
            },
          ],
        });
        return reply.send(body);
      }

      // Default — daily buckets path. Phase 1 surface, extended with the
      // optional start/end window. `bucket_date` is stored as YYYY-MM-DD text
      // in the contributions aggregate table; cutoff is text-comparable.
      let cutoffClause: SQL;
      let upperClause: SQL = sql``;
      if (start && end) {
        // Use the explicit window. Compare bucket_date as text (its native
        // representation in `contributions`). `start` is inclusive, `end` is
        // exclusive — same semantics as the recordings list. No tz coercion
        // needed for the bucket_date text comparison; the aggregate trigger
        // (migration 0004) writes UTC-relative bucket dates today, but the
        // aggregate-branch above is the timezone-correct path for tile math.
        cutoffClause = sql`AND bucket_date >= ${start}`;
        upperClause = sql`AND bucket_date <  ${end}`;
      } else {
        const days = RANGE_DAYS[range];
        cutoffClause = sql`AND bucket_date >= to_char((now() - (${days} || ' days')::interval)::date, 'YYYY-MM-DD')`;
      }

      const result = await db.execute(sql`
        SELECT bucket_date,
               duration_ms::text     AS duration_ms,
               recording_count::text AS recording_count,
               task_count::text      AS task_count
        FROM contributions
        WHERE user_id = ${sub}
          ${cutoffClause}
          ${upperClause}
        ORDER BY bucket_date ASC
      `);
      const rows = (result as unknown as { rows: BucketRow[] }).rows;
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
