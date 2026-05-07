// POST /recordings/:id/reject — calls AWS SDK v3 AbortMultipartUploadCommand
// (for video and optionally IMU) and transitions qa_status to 'rejected'.
// Used when the client cancels an in-progress upload.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { db, schema } from '../../db/index.js';
import { getS3Client, RECORDINGS_BUCKET, recordingKeys } from '../../lib/s3-client.js';
import { canTransition } from '../../lib/recording-state.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const Params = z.object({ id: z.string().length(26) });
const Body = z.object({ imuUploadId: z.string().min(1).optional() });
const PROBLEM_CT = 'application/problem+json';

export default async function rejectRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/recordings/:id/reject',
    {
      schema: {
        params: Params,
        body: Body,
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
      if (!canTransition(rec.qaStatus, 'rejected')) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.conflict,
          title: `Cannot reject from state ${rec.qaStatus}`,
          status: 409,
          instance: req.id as string,
        });
        return reply.status(409).type(PROBLEM_CT).send(pd);
      }
      const s3 = getS3Client();
      const bucket = RECORDINGS_BUCKET();
      const keys = recordingKeys({ userId, recordingId: rec.id });
      if (rec.s3UploadId) {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: keys.video,
            UploadId: rec.s3UploadId,
          }),
        );
      }
      if (req.body.imuUploadId) {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: keys.imu,
            UploadId: req.body.imuUploadId,
          }),
        );
      }
      await db
        .update(schema.recordings)
        .set({ qaStatus: 'rejected' })
        .where(eq(schema.recordings.id, rec.id));
      return reply.send({ ok: true as const });
    },
  );
}
