// GET /recordings — paginated, range-filtered, takedown-excluded list of the
// authenticated user's recordings (API-08). Default range=30d, limit=20, max
// limit=100. Pagination is via opaque cursor (last seen recording_id), with
// stable ordering on (created_at DESC, id DESC).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import type { z } from 'zod';
import { RecordingsListQuerySchema, RecordingsListResponseSchema } from './schemas.js';

type RecordingsListResponse = z.infer<typeof RecordingsListResponseSchema>;

const RANGE_TO_INTERVAL: Record<'7d' | '30d' | '90d', string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

// D-03b — validate the optional Accept-Timezone header against IANA names by
// constructing an Intl.DateTimeFormat (which throws on unknown timezones).
// Unknown timezones surface a 400 problem-detail so the client can fix the
// header without leaking a 500 server crash.
function isValidIanaTimezone(tz: string): boolean {
  try {
    // Side-effect construction is the validity probe — Intl.DateTimeFormat
    // throws a RangeError on unknown timezone names. Calling `.resolvedOptions()`
    // forces the constructor to evaluate the timeZone option even if a future
    // engine deferred the check.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions();
    return true;
  } catch {
    return false;
  }
}

export default async function recordingsListRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings',
    {
      schema: {
        querystring: RecordingsListQuerySchema,
        // Pattern 22 (STATE.md) — response schema intentionally omitted. The
        // route returns 400 problem-detail on invalid Accept-Timezone (D-03b)
        // alongside the 200 happy path; declaring response.200 narrows
        // reply.code() to 200 and breaks the 400 send. Body shape on success
        // is still typed via the explicit `RecordingsListResponse` return type
        // below + the imported schema is reused by the test files.
      },
      preHandler: [app.requireAuth],
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      const { range, cursor, limit, start, end } = req.query;

      // D-03b — optional Accept-Timezone IANA name. Validated up-front; unknown
      // TZ → 400 problem-detail (does NOT crash the route). Drizzle's `sql`
      // template binds the tz string as a parameter via `AT TIME ZONE ${tz}`,
      // so no SQL-injection surface even before this validator (T-6.3-02).
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

      // WHERE clause:
      //   user_id = req.user.sub
      //   qa_status NOT 'takedown' (T-1.7-08)
      //   D-03 — explicit start/end (with Accept-Timezone) take precedence over
      //   the named-window `range`. Otherwise: created_at >= now() - INTERVAL <range>
      //   (skip when range==='all').
      //   (created_at, id) < cursor row's pair (when cursor present)
      const where: SQL[] = [
        eq(schema.recordings.userId, userId),
        ne(schema.recordings.qaStatus, 'takedown'),
      ];
      if (start && end) {
        // D-03 — explicit window. `start` = inclusive local-midnight,
        // `end` = exclusive next-day local-midnight (client sends end = day
        // AFTER the last-included day). When Accept-Timezone present, coerce
        // each YYYY-MM-DD::date to timestamptz at that zone's midnight; when
        // absent, PG defaults to the session TZ (UTC in our setup).
        if (tz) {
          where.push(sql`${schema.recordings.createdAt} >= (${start}::date AT TIME ZONE ${tz})`);
          where.push(sql`${schema.recordings.createdAt} <  (${end}::date AT TIME ZONE ${tz})`);
        } else {
          where.push(sql`${schema.recordings.createdAt} >= ${start}::date`);
          where.push(sql`${schema.recordings.createdAt} <  ${end}::date`);
        }
      } else if (range !== 'all') {
        where.push(
          sql`${schema.recordings.createdAt} >= now() - (${RANGE_TO_INTERVAL[range]})::interval`,
        );
      }
      if (cursor) {
        // cursor is the last seen recording_id; resolve its created_at to
        // build a stable tuple comparator. Forging a cursor for another
        // user's recording_id either yields nothing (no row found) or the
        // user_id gate above filters it out.
        const c = await db
          .select({
            createdAt: schema.recordings.createdAt,
            id: schema.recordings.id,
          })
          .from(schema.recordings)
          .where(eq(schema.recordings.id, cursor))
          .limit(1);
        if (c.length > 0) {
          const created = c[0]!.createdAt;
          where.push(
            sql`(${schema.recordings.createdAt}, ${schema.recordings.id}) < (${created.toISOString()}::timestamptz, ${cursor})`,
          );
        }
      }

      const rows = await db
        .select({
          id: schema.recordings.id,
          taskId: schema.recordings.taskId,
          qaStatus: schema.recordings.qaStatus,
          durationMs: schema.recordings.durationMs,
          createdAt: schema.recordings.createdAt,
        })
        .from(schema.recordings)
        .where(and(...where))
        .orderBy(desc(schema.recordings.createdAt), desc(schema.recordings.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
        recording_id: r.id,
        task_id: r.taskId,
        qa_status: r.qaStatus as 'pending' | 'uploaded' | 'verified' | 'hash-mismatch' | 'rejected',
        duration_ms: r.durationMs,
        created_at: r.createdAt.toISOString(),
      }));
      const body: RecordingsListResponse = {
        items,
        next_cursor: hasMore ? items[items.length - 1]!.recording_id : null,
      };
      return reply.send(body);
    },
  );
}
