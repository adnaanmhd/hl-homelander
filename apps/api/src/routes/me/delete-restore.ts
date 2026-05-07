// DELETE /me?confirm=DELETE + POST /me/restore — API-03 (DSR erasure-only,
// D-LEGAL-02). Soft-delete + 30-day grace; POST /me/restore clears the soft
// delete if within window, returns 410 if past grace.
//
// Account-deletion DoS guard (T-1.8-02): per-applicationId rate limit on
// DELETE /me — 5 attempts per applicationId per minute. Even if an attacker
// has stolen N JWTs from one build flavor's users, they all share the same
// applicationId so a single bucket caps the storm.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import {
  MeDeleteQuerySchema,
  MeDeleteResponseSchema,
  MeRestoreResponseSchema,
} from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';
const GRACE_DAYS = 30;
const GRACE_MS = GRACE_DAYS * 24 * 3600 * 1000;

export default async function meDeleteRestoreRoutes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/me',
    {
      schema: { querystring: MeDeleteQuerySchema },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const appId = (req.user as { applicationId?: string } | undefined)?.applicationId;
              if (appId) return `delete-me:${appId}`;
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
      const grace = new Date(Date.now() + GRACE_MS);
      const updated = await db
        .update(schema.users)
        .set({
          deletedAt: new Date(),
          deleteGraceUntil: grace,
          updatedAt: new Date(),
        })
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
      const body = MeDeleteResponseSchema.parse({
        ok: true as const,
        deleteGraceUntil: grace.toISOString(),
      });
      return reply.send(body);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/me/restore',
    {
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
      const r = rows[0]!;
      if (!r.deletedAt) {
        // Already not deleted — idempotent OK
        const body = MeRestoreResponseSchema.parse({ ok: true as const });
        return reply.send(body);
      }
      if (r.deleteGraceUntil && r.deleteGraceUntil.getTime() < Date.now()) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.conflict,
          title: 'Account past 30-day grace; restore window expired',
          status: 410,
          instance: req.id as string,
        });
        return reply.status(410).type(PROBLEM_CT).send(pd);
      }
      await db
        .update(schema.users)
        .set({
          deletedAt: null,
          deleteGraceUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, sub));
      const body = MeRestoreResponseSchema.parse({ ok: true as const });
      return reply.send(body);
    },
  );
}
