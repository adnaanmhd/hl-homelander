import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const Params = z.object({ id: z.string().length(26) });
const PROBLEM_CT = 'application/problem+json';

// Response schema intentionally omitted from the type provider so reply.code(404)
// is not narrowed away (Pattern 22 from plan 01-05). The 200 happy-path payload
// is enforced by hand against TaskSchema's column shape.
export default async function tasksGetRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/tasks/:id', { schema: { params: Params } }, async (req, reply) => {
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
        .where(eq(schema.tasks.id, req.params.id))
        .limit(1);
      if (rows.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'Task not found',
          status: 404,
          detail: `id=${req.params.id}`,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      return reply.status(200).send(rows[0]);
    });
}
