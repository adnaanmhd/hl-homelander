// GET /recordings/:id — single recording the caller owns, with a CloudFront-
// signed playback URL minted via @aws-sdk/cloudfront-signer when qa_status is
// 'uploaded' (API-09). 5-min TTL. Cross-user lookups, missing rows, and
// takedown rows all collapse to 404 recording-not-found so existence isn't
// leaked (T-1.7-10). Non-success states (pending = still uploading; rejected;
// takedown) return 404 recording-not-playable. ('uploaded' is the terminal
// success state after Enh 3 / D1 removed the hash-verify flow; legacy 'verified'
// rows, if any, play via GET /recordings/:id/stream-url.)
//
// Env contract: CLOUDFRONT_RECORDINGS_PRIVATE_KEY (PEM) +
// CLOUDFRONT_RECORDINGS_KEY_PAIR_ID + CLOUDFRONT_RECORDINGS_BASE_URL.
// In prod, ECS task injects all three from Secrets Manager (humyn/cloudfront/*).

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, schema } from '../../db/index.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';
import { getS3Client, RECORDINGS_BUCKET, PRESIGNED_TTL_SECONDS } from '../../lib/s3-client.js';
import { RecordingsGetParamsSchema, RecordingsGetResponseSchema } from './schemas.js';

type RecordingsGetResponse = z.infer<typeof RecordingsGetResponseSchema>;

const PROBLEM_CT = 'application/problem+json';
const PLAYBACK_TTL_SECONDS = 5 * 60; // 5-min CloudFront-signed URL TTL per API-09

function getCloudFrontSigningKey(): {
  key: string;
  keyPairId: string;
  baseUrl: string;
} {
  const key = process.env.CLOUDFRONT_RECORDINGS_PRIVATE_KEY;
  const keyPairId = process.env.CLOUDFRONT_RECORDINGS_KEY_PAIR_ID;
  const baseUrl = process.env.CLOUDFRONT_RECORDINGS_BASE_URL;
  if (!key || !keyPairId || !baseUrl) {
    throw new Error('CloudFront signing config missing');
  }
  return { key, keyPairId, baseUrl };
}

export default async function recordingsGetRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/recordings/:id',
    {
      schema: {
        params: RecordingsGetParamsSchema,
        // Response schema intentionally omitted (Pattern 22 — STATE.md):
        // declaring response.200 narrows reply.code() and breaks 404 returns.
        // Body shape still typed via RecordingsGetResponseSchema return-value.
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

      // Cross-user OR not-found OR takedown — all return 404
      // recording-not-found. Never leak existence: a takedown row appears
      // identically to "doesn't exist" (T-1.7-10).
      if (rows.length === 0 || rows[0]!.userId !== userId || rows[0]!.qaStatus === 'takedown') {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.recordingNotFound,
          title: 'Recording not found',
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }

      const rec = rows[0]!;

      // 'uploaded' is the terminal success state (Enh 3 / D1). Anything else
      // means there's no playable artifact: pending = still uploading;
      // rejected/takedown = gone. (Legacy 'verified' rows play via /stream-url.)
      if (rec.qaStatus !== 'uploaded') {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.recordingNotPlayable,
          title: `Recording is ${rec.qaStatus}; no playback URL available`,
          status: 404,
          instance: req.id as string,
        });
        return reply.status(404).type(PROBLEM_CT).send(pd);
      }

      const { key, keyPairId, baseUrl } = getCloudFrontSigningKey();
      const expiresAt = new Date(Date.now() + PLAYBACK_TTL_SECONDS * 1000);
      const playbackUrl = getCloudFrontSignedUrl({
        url: `${baseUrl}/${rec.s3KeyVideo}`,
        privateKey: key,
        keyPairId,
        dateLessThan: expiresAt.toISOString(),
      });

      // Bug 6 / D5 — short-TTL presigned GET for the server poster JPEG (null when
      // the row has no server thumbnail). S3-presigned (not CloudFront) so it works
      // identically in dev/LocalStack and prod.
      const thumbnailUrl = rec.s3KeyThumbnail
        ? await getS3SignedUrl(
            getS3Client(),
            new GetObjectCommand({ Bucket: RECORDINGS_BUCKET(), Key: rec.s3KeyThumbnail }),
            { expiresIn: PRESIGNED_TTL_SECONDS },
          )
        : null;

      const body: RecordingsGetResponse = {
        recording_id: rec.id,
        task_id: rec.taskId,
        qa_status: 'uploaded' as const,
        duration_ms: rec.durationMs,
        created_at: rec.createdAt.toISOString(),
        playback_url: playbackUrl,
        playback_url_expires_at: expiresAt.toISOString(),
        thumbnail_url: thumbnailUrl,
      };
      return reply.send(body);
    },
  );
}
