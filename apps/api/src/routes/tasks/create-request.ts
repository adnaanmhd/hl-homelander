import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ulid } from 'ulid';
import { db, schema } from '../../db/index.js';
import { TaskRequestCreateSchema } from '@humyn/shared-types';
import type { JwtPayload } from '../../plugins/auth.js';

// POST /task-requests — authenticated. JWT.sub becomes task_requests.user_id;
// no client control over the userId field (mitigates T-1.6-07 spoofing).
//
// Authenticated-tier rate limit (per-user, 10/min) keyed by user:<sub>; bucket
// is disjoint from the anonymous-tier (per-IP) bucket per Pattern 16.
//
// Response schema is omitted from the type provider so reply.code(201) is not
// type-narrowed (Pattern 22). The 201 payload shape matches TaskRequestSchema.
export default async function taskRequestRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/task-requests',
    {
      schema: { body: TaskRequestCreateSchema },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (req) => `user:${(req.user as JwtPayload).sub}`,
        },
      },
    },
    async (req, reply) => {
      const userId = (req.user as JwtPayload).sub;
      const id = ulid();
      const inserted = await db
        .insert(schema.taskRequests)
        .values({
          id,
          userId,
          name: req.body.name,
          description: req.body.description,
          category: req.body.category,
          setting: req.body.setting,
          sampleVideoS3Key: req.body.sampleVideoS3Key ?? null,
        })
        .returning();
      const row = inserted[0]!;
      return reply.status(201).send({
        id: row.id,
        userId: row.userId,
        name: row.name,
        description: row.description,
        category: row.category,
        setting: row.setting,
        ...(row.sampleVideoS3Key !== null ? { sampleVideoS3Key: row.sampleVideoS3Key } : {}),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      });
    },
  );
}
