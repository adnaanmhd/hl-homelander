// GET /app/version — API-13. The ONLY unauthenticated route in plan 01-08.
// Pre-sign-in upgrade prompts read this; clients cache for 6 hours.
//
// Per D-APK-02, response shape is per-flavor:
//   - apkRollout  → { apkUrl, apkSha256, playStoreUrl: null }
//   - playStore   → { playStoreUrl, apkUrl: null, apkSha256: null }
//   - iosAppStore → { playStoreUrl, apkUrl: null, apkSha256: null }

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppVersionQuerySchema } from '@humyn/shared-types';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';
// 6 hours per API-13. Locked literal 21600 (= 6 * 3600) — clients cache for
// 6h between checks. Kept as a literal so the wire contract is greppable.
const CACHE_TTL_SECONDS = 21600;
// Wire-contract sanity: the emitted header is exactly `Cache-Control: public, max-age=21600`.
const CACHE_CONTROL_HEADER = `public, max-age=21600`;

export default async function appVersionGetRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/app/version',
    {
      schema: { querystring: AppVersionQuerySchema },
      // No requireAuth — pre-sign-in upgrade prompts read this.
    },
    async (req, reply) => {
      const flavor = req.query.flavor;
      const rows = await db
        .select()
        .from(schema.appVersions)
        .where(eq(schema.appVersions.flavor, flavor))
        .limit(1);
      if (rows.length === 0) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.notFound,
          title: `No app_version row for flavor=${flavor}`,
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }
      const r = rows[0]!;
      // CACHE_TTL_SECONDS is bound to 21600 (literal) so this header is
      // identical to CACHE_CONTROL_HEADER above; both forms greppable.
      void CACHE_TTL_SECONDS;
      reply.header('Cache-Control', CACHE_CONTROL_HEADER);
      if (flavor === 'apkRollout') {
        return reply.send({
          flavor: 'apkRollout' as const,
          minSupported: r.minSupported,
          latest: r.latest,
          forceUpgrade: r.forceUpgrade,
          apkUrl: r.apkUrl ?? '',
          apkSha256: r.apkSha256 ?? '',
          playStoreUrl: null,
        });
      }
      return reply.send({
        flavor,
        minSupported: r.minSupported,
        latest: r.latest,
        forceUpgrade: r.forceUpgrade,
        apkUrl: null,
        apkSha256: null,
        playStoreUrl: r.playStoreUrl ?? '',
      });
    },
  );
}
