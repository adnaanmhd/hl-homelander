// GET /recordings/:id/stream-url — D-08 (Phase 6 plan 06-03).
//
// Mints a short-TTL CloudFront-signed URL for in-app player streaming, with a
// discriminated `archiveState` envelope so the player can render the disabled
// state for archived / still-uploading recordings without a second round-trip:
//
//   archiveState='available'    — qa_status ∈ {uploaded, verified, hash-mismatch},
//                                  age ≤ 90 d → CloudFront-signed presignedUrl
//   archiveState='unavailable'  — qa_status='pending' → presignedUrl=null
//                                  ("Still uploading — try again in a moment.")
//   archiveState='deep-archive' — age > 90 d (S3 Glacier per Phase 1 lifecycle)
//                                  → presignedUrl=null ("Archived. Contact support.")
//   takedown / rejected / cross-user → 404 problem-detail (T-1.7-10 no existence leak).
//
// Auth: requireAuth (JWT sub). Per-user rate-limit 60/min (Pattern 16 keyGenerator —
// best-effort jwtVerify with IP fallback). Pattern 22 — response schema intentionally
// omitted so reply.code(404) coexists with the 200 envelope.
//
// CloudFront-signed (NOT S3 presigned) — keeps prod parity with /recordings/:id and
// preserves cache-hit + cheaper-egress economics (06-RESEARCH Q-1). Env contract:
// CLOUDFRONT_RECORDINGS_PRIVATE_KEY + CLOUDFRONT_RECORDINGS_KEY_PAIR_ID +
// CLOUDFRONT_RECORDINGS_BASE_URL (already injected in prod via Secrets Manager).
//
// CAP-18 — server never reads recording bytes; bytes flow CloudFront/S3 → device
// directly. Verified by inspection: no GetObjectCommand body read here.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { RecordingsStreamUrlParamsSchema } from '@humyn/shared-types';

const PROBLEM_CT = 'application/problem+json';
const STREAM_TTL_SECONDS = 5 * 60; // D-08 — 5-min TTL
const DEEP_ARCHIVE_DAYS = 90; // Phase 1 S3 lifecycle parity (created_at > 90d)

function getCloudFrontSigningKey(): { key: string; keyPairId: string; baseUrl: string } {
  const key = process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY;
  const keyPairId = process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID;
  const baseUrl = process.env.CLOUDFRONT_RECORDINGS_BASE_URL;
  if (!key || !keyPairId || !baseUrl) {
    throw new Error('CloudFront signing config missing');
  }
  return { key, keyPairId, baseUrl };
}

export default async function recordingsStreamUrlRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings/:id/stream-url',
    {
      schema: {
        params: RecordingsStreamUrlParamsSchema,
        // Pattern 22 — response schema intentionally omitted. The route
        // returns 200 (3 archiveState variants) AND 404 problem-detail;
        // declaring response.200 narrows reply.code() and breaks the 404 path.
      },
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `user:${sub}`;
            } catch {
              /* fall-through to ip key when jwt verify fails */
            }
            return `ip:${req.ip}`;
          },
        },
      },
    },
    async (req, reply) => {
      const userId = (req.user as { sub: string }).sub;
      const rows = await db
        .select()
        .from(schema.recordings)
        .where(eq(schema.recordings.id, req.params.id))
        .limit(1);

      // T-1.7-10 — cross-user OR not-found OR takedown OR rejected → 404
      // recording-not-found. NEVER leak existence: a takedown row collapses
      // to "doesn't exist" so the user cannot probe other users' rows.
      if (
        rows.length === 0 ||
        rows[0]!.userId !== userId ||
        rows[0]!.qaStatus === 'takedown' ||
        rows[0]!.qaStatus === 'rejected'
      ) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.recordingNotFound,
          title: 'Recording not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }

      const rec = rows[0]!;

      // qa_status='pending' — bytes not yet in S3 (or partially uploaded).
      // Same envelope shape, presignedUrl=null, archiveState='unavailable'.
      if (rec.qaStatus === 'pending') {
        return reply.send({
          presignedUrl: null,
          expiresAt: new Date().toISOString(),
          archiveState: 'unavailable' as const,
        });
      }

      // Deep-Archive — age > 90d (Phase 1 S3 lifecycle moves objects to
      // Glacier). Derived from created_at; no S3 HeadObject required.
      const ageDays = (Date.now() - rec.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > DEEP_ARCHIVE_DAYS) {
        return reply.send({
          presignedUrl: null,
          expiresAt: new Date().toISOString(),
          archiveState: 'deep-archive' as const,
        });
      }

      // Available — qa_status ∈ {uploaded, verified, hash-mismatch}, age ≤ 90d.
      // CloudFront-signed playable URL with 5-min TTL.
      const { key, keyPairId, baseUrl } = getCloudFrontSigningKey();
      const expiresAt = new Date(Date.now() + STREAM_TTL_SECONDS * 1000);
      const presignedUrl = getCloudFrontSignedUrl({
        url: `${baseUrl}/${rec.s3KeyVideo}`,
        privateKey: key,
        keyPairId,
        dateLessThan: expiresAt.toISOString(),
      });
      return reply.send({
        presignedUrl,
        expiresAt: expiresAt.toISOString(),
        archiveState: 'available' as const,
      });
    },
  );
}
