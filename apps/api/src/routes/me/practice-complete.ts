// POST /me/practice-complete — Bug 5 / D7 (2026-06-04). Idempotent: stamps
// users.practice_completed_at once (set-if-NULL) and returns the timestamp
// (whether just-set or pre-existing). Called by PracticeCompleteScreen.Continue
// alongside the local ONB-08 MMKV flag so the tutorial is skipped on all future
// devices/reinstalls. Independent of whether the practice clip uploads.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

export default async function mePracticeCompleteRoutes(app: FastifyInstance): Promise<void> {
  // withTypeProvider matches /auth/google's config typing (accepts the
  // `idempotency: false` opt-out key). No body/response schema declared —
  // the response is built manually (Pattern 22).
  app.withTypeProvider<ZodTypeProvider>().post(
    '/me/practice-complete',
    {
      preHandler: [app.requireAuth],
      // Naturally idempotent (set-if-NULL) — no Idempotency-Key required (mirror
      // /auth/google's opt-out). Per-user rate-limit mirrors PATCH /me.
      config: {
        idempotency: false,
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
      const now = new Date();
      // Set-if-NULL: the first call stamps the timestamp; later calls update 0
      // rows and fall through to reading the existing value (idempotent).
      await db
        .update(schema.users)
        .set({ practiceCompletedAt: now, updatedAt: now })
        .where(and(eq(schema.users.id, sub), isNull(schema.users.practiceCompletedAt)));
      const rows = await db
        .select({ pca: schema.users.practiceCompletedAt })
        .from(schema.users)
        .where(eq(schema.users.id, sub))
        .limit(1);
      const pca = rows[0]?.pca;
      if (!pca) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'User not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      return reply.send({ practiceCompletedAt: pca.toISOString() });
    },
  );
}
