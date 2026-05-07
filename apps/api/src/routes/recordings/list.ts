// GET /recordings — paginated, range-filtered, takedown-excluded list of the
// authenticated user's recordings (API-08). Default range=30d, limit=20, max
// limit=100. Pagination is via opaque cursor (last seen recording_id), with
// stable ordering on (created_at DESC, id DESC).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { RecordingsListQuerySchema, RecordingsListResponseSchema } from './schemas.js';

const RANGE_TO_INTERVAL: Record<'7d' | '30d' | '90d', string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export default async function recordingsListRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings',
    {
      schema: {
        querystring: RecordingsListQuerySchema,
        response: { 200: RecordingsListResponseSchema },
      },
      preHandler: [app.requireAuth],
    },
    async (req) => {
      const userId = (req.user as { sub: string }).sub;
      const { range, cursor, limit } = req.query;

      // WHERE clause:
      //   user_id = req.user.sub
      //   qa_status NOT 'takedown' (T-1.7-08)
      //   created_at >= now() - INTERVAL <range> (skip when range==='all')
      //   (created_at, id) < cursor row's pair (when cursor present)
      const where: SQL[] = [
        eq(schema.recordings.userId, userId),
        ne(schema.recordings.qaStatus, 'takedown'),
      ];
      if (range !== 'all') {
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
      return {
        items,
        next_cursor: hasMore ? items[items.length - 1]!.recording_id : null,
      };
    },
  );
}
