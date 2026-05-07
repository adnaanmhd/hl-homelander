// GET /me + PATCH /me — API-02. The /me row is the authenticated user's record;
// PATCH only allows the editable fields enumerated in `UserPatchSchema`
// (name, age, gender). email + applicationId + flavor + avatarUrl + consentVersion
// are read-only here — they're mutated by /auth/google or by Google itself.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { UserPatchSchema, MeResponseSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

function rowToMe(r: typeof schema.users.$inferSelect): {
  id: string;
  email: string;
  name: string;
  age: number | null;
  gender: string | null;
  avatarUrl: string | null;
  consentVersion: string;
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
  deletedAt: string | null;
  deleteGraceUntil: string | null;
  createdAt: string;
} {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    age: r.age,
    gender: r.gender,
    avatarUrl: r.avatarUrl,
    consentVersion: r.consentVersion,
    flavor: r.flavor,
    applicationId: r.applicationId,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    deleteGraceUntil: r.deleteGraceUntil?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export default async function meGetPatchRoutes(app: FastifyInstance): Promise<void> {
  // Response schema intentionally omitted (Pattern 22) — declaring response.200
  // narrows reply.code() so 404 problem-detail returns trip the type checker.
  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 120,
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
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, sub)).limit(1);
      if (rows.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'User not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      const body = MeResponseSchema.parse(rowToMe(rows[0]!));
      return reply.send(body);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/me',
    {
      schema: { body: UserPatchSchema },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 30,
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
      const body = req.body as { name?: string; age?: number | null; gender?: string | null };
      const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.age !== undefined) updates.age = body.age;
      if (body.gender !== undefined) updates.gender = body.gender;
      const updated = await db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, sub))
        .returning();
      if (updated.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'User not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      const respBody = MeResponseSchema.parse(rowToMe(updated[0]!));
      return reply.send(respBody);
    },
  );
}
