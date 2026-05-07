// POST /events — telemetry ingest (API-11). Per-event row insert into the
// events table. The event-name allowlist (EVENT_NAMES from shared/types) is
// the one quality gate at ingest; unknown names are rejected with 400.
//
// Schema-creep guards (T-1.8-05):
//   - MAX_KEYS = 32 cap on the number of property keys.
//   - MAX_PROPERTIES_BYTES = 4 KB cap on the properties JSON serialized size.
//   - Per-property value max 256 chars (Zod EventCreateSchema).
// Per-user rate limit: 600/min sustained ≈ 10 events/sec.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ulid } from 'ulid';
import { db, schema } from '../../db/index.js';
import { EventCreateSchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

// Response schema kept for documentation / future strict-mode use only.
// Pattern 22 (STATE.md): declaring response.201 narrows reply.code() so
// the 400 problem-detail returns trip the type checker. Validate inline.
const ResponseSchema = z.object({ id: z.string().length(26) });
void ResponseSchema;
const MAX_KEYS = 32;
const MAX_PROPERTIES_BYTES = 4 * 1024;

export default async function eventsPostRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/events',
    {
      schema: { body: EventCreateSchema },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 600,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `events:${sub}`;
            } catch {
              /* fall-through */
            }
            return `ip:${req.ip}`;
          },
        },
      },
    },
    async (req, reply) => {
      const userJwt = req.user as {
        sub: string;
        flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
      };
      const sub = userJwt.sub;
      const flavor = userJwt.flavor;
      const props = req.body.properties;

      // Schema-creep guards — keys count + total bytes.
      if (Object.keys(props).length > MAX_KEYS) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: `properties exceeds MAX_KEYS=${MAX_KEYS}`,
          status: 400,
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }
      if (JSON.stringify(props).length > MAX_PROPERTIES_BYTES) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: `properties exceeds MAX_PROPERTIES_BYTES=${MAX_PROPERTIES_BYTES}`,
          status: 400,
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }

      const id = ulid();
      await db.insert(schema.events).values({
        id,
        userId: sub,
        name: req.body.name,
        properties: props,
        occurredAt: new Date(req.body.occurredAt),
        flavor,
      });
      return reply.status(201).send({ id });
    },
  );
}
