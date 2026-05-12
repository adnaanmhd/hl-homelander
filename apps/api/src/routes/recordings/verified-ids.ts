// GET /recordings/verified-ids?since=<cursor> — the app-launch reconciliation
// sweep surface (VERIFY-06). Returns the ids of the authenticated user's
// recordings whose `qa_status = 'verified'`, ordered (verified_at DESC, id
// DESC), cursor-paginated (mirrors list.ts's tuple comparator). The mobile
// client compares this against its local upload-queue to learn about any
// 'verified' events it missed (the events-outbox channel is at-least-once but
// can still drop on a connection failure). This route is also an `_events`
// carrier — its response schema includes the optional `_events` key.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { VerifiedIdsQuerySchema, VerifiedIdsResponseSchema } from '@humyn/shared-types';

const PAGE_LIMIT = 200;

export default async function recordingsVerifiedIdsRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings/verified-ids',
    {
      schema: {
        querystring: VerifiedIdsQuerySchema, // { since? }
        response: { 200: VerifiedIdsResponseSchema },
      },
      preHandler: [app.requireAuth],
    },
    async (req) => {
      const userId = (req.user as { sub: string }).sub;
      const since = req.query.since;

      const where: SQL[] = [
        eq(schema.recordings.userId, userId),
        eq(schema.recordings.qaStatus, 'verified'),
      ];
      if (since) {
        // Resolve the cursor recording_id to its (verified_at, id) tuple. A
        // cursor pointing at another user's row (or one that isn't verified)
        // resolves nothing → no extra filter, and the user_id gate above keeps
        // the result the caller's own rows regardless.
        const [c] = await db
          .select({ verifiedAt: schema.recordings.verifiedAt, id: schema.recordings.id })
          .from(schema.recordings)
          .where(eq(schema.recordings.id, since))
          .limit(1);
        if (c?.verifiedAt) {
          where.push(
            sql`(${schema.recordings.verifiedAt}, ${schema.recordings.id}) < (${c.verifiedAt.toISOString()}::timestamptz, ${since})`,
          );
        }
      }

      const rows = await db
        .select({ id: schema.recordings.id })
        .from(schema.recordings)
        .where(and(...where))
        .orderBy(desc(schema.recordings.verifiedAt), desc(schema.recordings.id))
        .limit(PAGE_LIMIT + 1);

      const hasMore = rows.length > PAGE_LIMIT;
      const items = hasMore ? rows.slice(0, PAGE_LIMIT) : rows;
      return {
        ids: items.map((r) => r.id),
        next_cursor: hasMore ? items[items.length - 1]!.id : null,
      };
    },
  );
}
