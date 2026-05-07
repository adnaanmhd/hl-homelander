// POST /recordings/:id/parts/:n/complete — Phase 1 state-probe shim. The
// route exists so the client can confirm the row is still 'pending' (i.e.
// the upload window hasn't been aborted) without per-part persistence on
// the server side. Phase 5 may extend this to durable progress events.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { RecordingPartCompleteSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const Params = z.object({
  id: z.string().length(26),
  n: z.coerce.number().int().min(1).max(1000),
});
const PROBLEM_CT = 'application/problem+json';

export default async function completePartRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/:id/parts/:n/complete',
    {
      schema: {
        params: Params,
        body: RecordingPartCompleteSchema,
        // Response schema intentionally omitted (Pattern 22 — STATE.md):
        // declaring response.200 narrows reply.code() so 404/403/409
        // problem-detail returns trip the type checker.
      },
      preHandler: [app.requireAuth],
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      const rows = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, req.params.id))
        .limit(1);
      if (rows.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: 'Recording not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      const rec = rows[0]!;
      if (rec.userId !== userId) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.forbidden,
          title: 'Not your recording',
          status: 403,
          instance: req.id as string,
        });
        return reply.status(403).type(PROBLEM_CT).send(pd);
      }
      if (rec.qaStatus !== 'pending') {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.conflict,
          title: `Recording in state ${rec.qaStatus}; cannot record more parts`,
          status: 409,
          instance: req.id as string,
        });
        return reply.status(409).type(PROBLEM_CT).send(pd);
      }
      // Phase 1: no per-part persistence — the client batches part metadata
      // in the /finalize body. This route exists so the client can probe
      // state ("is the recording still pending?"). Phase 5 may add durable
      // per-part progress events.
      return reply.send({ ok: true as const });
    },
  );
}
