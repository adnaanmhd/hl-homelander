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
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, schema } from '../../db/index.js';
import { getS3Client, RECORDINGS_BUCKET } from '../../lib/s3-client.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { RecordingsStreamUrlParamsSchema } from '@humyn/shared-types';

const PROBLEM_CT = 'application/problem+json';
const STREAM_TTL_SECONDS = 5 * 60; // D-08 — 5-min TTL
const DEEP_ARCHIVE_DAYS = 90; // Phase 1 S3 lifecycle parity (created_at > 90d)

function getCloudFrontSigningKey(): { key: string; keyPairId: string; baseUrl: string } | null {
  const key = process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY;
  const keyPairId = process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID;
  const baseUrl = process.env.CLOUDFRONT_RECORDINGS_BASE_URL;
  if (!key || !keyPairId || !baseUrl) return null;
  return { key, keyPairId, baseUrl };
}

/**
 * Sign a short-TTL S3 GET URL for the recording's video key. Used as the dev /
 * LocalStack fallback when CLOUDFRONT_RECORDINGS_* env is unset (no
 * distribution to sign against). Prod must always have CloudFront configured —
 * the call site logs a warning when this fallback fires so a missing prod
 * secret stays visible.
 */
async function signS3GetUrl(s3KeyVideo: string): Promise<string> {
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: RECORDINGS_BUCKET(), Key: s3KeyVideo });
  return getS3SignedUrl(s3, cmd, { expiresIn: STREAM_TTL_SECONDS });
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

      // Available — qa_status = 'uploaded' (terminal success after Enh 3/D1) or a
      // legacy 'verified'/'hash-mismatch' row, age ≤ 90d. (pending/rejected/
      // takedown are handled above / 404'd.)
      // Short-TTL signed playable URL. Prefer CloudFront in prod (cache
      // hits + cheaper egress per 06-RESEARCH Q-1); fall back to S3
      // presigned GET in dev / LocalStack where the CLOUDFRONT_* env vars
      // aren't set (no distribution to sign against). The envelope shape
      // is identical to the client; only the URL host differs.
      const cf = getCloudFrontSigningKey();
      const expiresAt = new Date(Date.now() + STREAM_TTL_SECONDS * 1000);
      let presignedUrl: string;
      if (cf) {
        presignedUrl = getCloudFrontSignedUrl({
          url: `${cf.baseUrl}/${rec.s3KeyVideo}`,
          privateKey: cf.key,
          keyPairId: cf.keyPairId,
          dateLessThan: expiresAt.toISOString(),
        });
      } else {
        // Dev / LocalStack — log a one-line warning so a missing prod
        // CLOUDFRONT_* secret never stays invisible.
        req.log.warn(
          { component: 'recordings-stream-url' },
          'CLOUDFRONT_RECORDINGS_* unset — falling back to S3 presigned GET (dev only).',
        );
        presignedUrl = await signS3GetUrl(rec.s3KeyVideo);
      }
      return reply.send({
        presignedUrl,
        expiresAt: expiresAt.toISOString(),
        archiveState: 'available' as const,
      });
    },
  );
}
