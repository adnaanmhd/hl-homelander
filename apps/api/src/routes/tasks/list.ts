import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gt, type SQL } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { TasksListQuerySchema, TasksListResponseSchema } from '@humyn/shared-types';

// Per-IP anonymous-tier rate limit applies pre-auth (plan 04). The route is
// intentionally public so signed-out users can browse the catalog.
export default async function tasksListRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/tasks',
    {
      schema: {
        querystring: TasksListQuerySchema,
        response: { 200: TasksListResponseSchema },
      },
    },
    async (req) => {
      const { cursor, limit, category, setting } = req.query;
      const filters: SQL[] = [];
      if (cursor) filters.push(gt(schema.tasks.id, cursor));
      if (category) filters.push(eq(schema.tasks.category, category));
      if (setting) filters.push(eq(schema.tasks.setting, setting));
      const rows = await db
        .select({
          id: schema.tasks.id,
          slug: schema.tasks.slug,
          name: schema.tasks.name,
          description: schema.tasks.description,
          category: schema.tasks.category,
          setting: schema.tasks.setting,
          iconKey: schema.tasks.iconKey,
          instructions: schema.tasks.instructions,
        })
        .from(schema.tasks)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(asc(schema.tasks.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (items[items.length - 1]!.id as string) : null;
      return { items, nextCursor };
    },
  );
}
