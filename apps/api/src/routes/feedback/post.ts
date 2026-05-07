// POST /feedback (multipart) — API-12. Accepts {category, message} fields plus
// an OPTIONAL `diagnostic` file part (application/json only, ≤5 MB). The
// diagnostic file goes to S3 (humyn-feedback-{env}/feedback/{userId}/{id}/diagnostic.json)
// and the first 100 KB also persists inline on the feedback row so support staff
// can read it without an S3 hop.
//
// Multipart limits:
//   - fileSize: FEEDBACK_MAX_BYTES (5 MB)
//   - files: 1 (only diagnostic.json)
//   - fields: 10 (category + message + room for future text fields)
// Per-user rate limit: 5/min (T-1.8-03 — feedback DoS guard).

import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { ulid } from 'ulid';
import { db, schema } from '../../db/index.js';
import { FEEDBACK_CATEGORIES } from '@humyn/shared-types';
import {
  uploadDiagnostic,
  FEEDBACK_MAX_BYTES,
  FEEDBACK_INLINE_MAX_BYTES,
} from '../../lib/feedback-uploader.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../../lib/problem-detail.js';

const PROBLEM_CT = 'application/problem+json';

type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export default async function feedbackPostRoute(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: FEEDBACK_MAX_BYTES, files: 1, fields: 10 },
    attachFieldsToBody: false,
  });

  app.post(
    '/feedback',
    {
      preHandler: [app.requireAuth],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: async (req) => {
            try {
              await req.jwtVerify();
              const sub = (req.user as { sub?: string } | undefined)?.sub;
              if (sub) return `feedback:${sub}`;
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

      let category: string | undefined;
      let message: string | undefined;
      let diagnosticBytes: Buffer | null = null;
      let diagnosticTooLarge = false;
      let diagnosticBadType = false;

      try {
        for await (const part of req.parts()) {
          if (part.type === 'file') {
            if (part.fieldname !== 'diagnostic') {
              part.file.resume(); // drain unknown file fields
              continue;
            }
            // Content-type allowlist (T-1.8-04).
            if (part.mimetype !== 'application/json') {
              diagnosticBadType = true;
              part.file.resume();
              continue;
            }
            const chunks: Buffer[] = [];
            let total = 0;
            for await (const chunk of part.file) {
              const buf = chunk as Buffer;
              total += buf.length;
              if (total > FEEDBACK_MAX_BYTES) {
                diagnosticTooLarge = true;
                break;
              }
              chunks.push(buf);
            }
            if (!diagnosticTooLarge) diagnosticBytes = Buffer.concat(chunks);
          } else if (part.type === 'field') {
            if (part.fieldname === 'category') category = String(part.value);
            else if (part.fieldname === 'message') message = String(part.value);
          }
        }
      } catch (err) {
        // @fastify/multipart throws when limits.fileSize is exceeded — collapse
        // to the same "too large" branch so the client sees a 413 problem-detail.
        const e = err as { code?: string };
        if (e?.code === 'FST_REQ_FILE_TOO_LARGE') {
          diagnosticTooLarge = true;
        } else {
          throw err;
        }
      }

      // Validate fields BEFORE the size/type errors so a request missing both
      // category and a too-large file gets the most diagnostic 400 message
      // first; size errors come later for the well-formed-text-bad-file path.
      if (!category || !FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: 'invalid feedback category',
          status: 400,
          detail: `Allowed: ${FEEDBACK_CATEGORIES.join(', ')}`,
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }
      if (!message || message.length > 4000 || message.length < 1) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: 'invalid feedback message',
          status: 400,
          detail: 'message must be 1..4000 chars',
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }
      if (diagnosticBadType) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: 'diagnostic must be application/json',
          status: 400,
          instance: req.id as string,
        });
        return reply.status(400).type(PROBLEM_CT).send(pd);
      }
      if (diagnosticTooLarge) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.validation,
          title: `diagnostic exceeds ${FEEDBACK_MAX_BYTES} bytes`,
          status: 413,
          instance: req.id as string,
        });
        return reply.status(413).type(PROBLEM_CT).send(pd);
      }

      const id = ulid();
      let diagnosticS3Key: string | null = null;
      let diagnosticInline: Record<string, unknown> | null = null;
      if (diagnosticBytes) {
        diagnosticS3Key = await uploadDiagnostic({
          feedbackId: id,
          userId: sub,
          bytes: diagnosticBytes,
          contentType: 'application/json',
        });
        // Truncate inline to 100 KB so the DB row stays small but support staff
        // can still read it without an S3 hop.
        const truncated = diagnosticBytes.subarray(0, FEEDBACK_INLINE_MAX_BYTES).toString('utf8');
        try {
          const parsed = JSON.parse(truncated) as unknown;
          diagnosticInline =
            typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : { _raw: parsed };
        } catch {
          diagnosticInline = { _raw_truncated: truncated.slice(0, 1024) };
        }
      }
      await db.insert(schema.feedback).values({
        id,
        userId: sub,
        category,
        message,
        diagnostic: { ...(diagnosticInline ?? {}), _s3_key: diagnosticS3Key } as never,
      });
      return reply.status(201).send({ id, diagnosticS3Key });
    },
  );
}
