import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ulid } from 'ulid';
import { db, schema } from '../../db/index.js';
import { TaskRequestCreateSchema } from '@humyn/shared-types';
import type { JwtPayload } from '../../plugins/auth.js';

// POST /task-requests — authenticated. JWT.sub becomes task_requests.user_id;
// no client control over the userId field (mitigates T-1.6-07 spoofing).
//
// Authenticated-tier rate limit (per-user, 10/min) keyed by `user:<sub>`. The
// keyGenerator must decode the JWT itself because @fastify/rate-limit fires
// BEFORE the route's preHandler list (and therefore before requireAuth has
// populated req.user). This mirrors the pattern in plugins/idempotency.ts —
// best-effort jwtVerify(), fall back to per-IP if missing/invalid (the route
// will still 401 from requireAuth, so the fall-back bucket is harmless).
// Pattern 16 (disjoint buckets) is preserved: signed-in users hit `user:<sub>`,
// pre-auth-failure traffic hits `ip:<ip>`.
async function rateLimitKey(req: FastifyRequest): Promise<string> {
  try {
    await req.jwtVerify();
  } catch {
    return `ip:${req.ip}`;
  }
  const u = req.user as JwtPayload | undefined;
  return u?.sub ? `user:${u.sub}` : `ip:${req.ip}`;
}

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
          keyGenerator: rateLimitKey,
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
