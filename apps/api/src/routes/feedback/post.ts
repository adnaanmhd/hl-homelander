// POST /feedback (multipart) — API-12. Accepts {category, message} fields plus
// an OPTIONAL `diagnostic` file part (application/json only, ≤5 MB). The
// diagnostic file goes to S3 (humyn-feedback-{env}/feedback/{userId}/{id}/diagnostic.json)
// and the first 100 KB also persists inline on the feedback row so support staff
// can read it without an S3 hop. The S3 archive is BEST-EFFORT — if the upload
// fails (bucket misconfig / S3 down) the feedback row is still written with the
// inline diagnostic and the request returns 201 (diagnosticS3Key: null); a
// support-attachment hiccup must never lose the user's bug report.
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

// BUG-7 (2026-06-09) — Postgres rejects a NUL byte (U+0000) inside a jsonb value
// (SQLSTATE 22P05, "unsupported Unicode escape sequence") AND inside a text value
// (22021). An unredacted control char in a telemetry / device-model string
// (analytics.ts) therefore 500'd the whole "report a problem" request: the
// db.insert below was unguarded — commit cfc69c3 only made the S3 upload
// best-effort. We strip the NUL char from the diagnostic's string keys + values
// (and the message) before insert so the report persists with a 201.
//
// ⚠ Must walk the PARSED values — a `JSON.parse(JSON.stringify(obj).replace(
// /\u0000/g,''))` one-liner does NOT work: JSON.stringify escapes a NUL char to
// the 6-character "\u0000" text sequence, which a literal-NUL regex can't match,
// so the NUL survives the round-trip (empirically verified 2026-06-09).
// Build the NUL matcher at runtime rather than a `/\u0000/` regex LITERAL —
// the literal trips ESLint `no-control-regex` (a build + pre-commit error). A
// shared global-flag regex is safe for String#replace (no lastIndex state).
const NUL_RE = new RegExp(String.fromCharCode(0), 'g');
function stripNul(s: string): string {
  return s.replace(NUL_RE, '');
}
function stripNulDeep(value: unknown): unknown {
  if (typeof value === 'string') return stripNul(value);
  if (Array.isArray(value)) return value.map(stripNulDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[stripNul(k)] = stripNulDeep(v);
    }
    return out;
  }
  return value;
}

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
        // Truncate inline to 100 KB so the DB row stays small but support staff
        // can still read it without an S3 hop. Computed FIRST + unconditionally:
        // the user's bug report (category + message + this inline snapshot) must
        // never be lost because the S3 attachment upload failed.
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
        // Best-effort archive of the full diagnostic blob to S3. A failure here
        // (FEEDBACK_BUCKET unset, bucket missing, S3 unreachable) must NOT 500
        // the whole report — degrade to "feedback stored, diagnostic-in-S3
        // skipped". The inline copy above is already on the row; _s3_key stays
        // null. Surfaced as a warn so a misconfigured bucket is still visible
        // in the logs without taking the endpoint down.
        try {
          diagnosticS3Key = await uploadDiagnostic({
            feedbackId: id,
            userId: sub,
            bytes: diagnosticBytes,
            contentType: 'application/json',
          });
        } catch (err) {
          req.log.warn(
            { err, feedbackId: id },
            'feedback diagnostic S3 upload failed — storing feedback with inline diagnostic only',
          );
        }
      }
      // BUG-7 — strip NUL bytes (Postgres rejects them in jsonb + text) so a
      // control char in a telemetry string can't 500 the report, and guard the
      // insert: prefer sanitize-then-insert (the row persists in full); only on a
      // residual content failure degrade to dropping the inline diagnostic.
      const diagnosticValue = stripNulDeep({
        ...(diagnosticInline ?? {}),
        _s3_key: diagnosticS3Key,
      }) as Record<string, unknown>;
      const safeMessage = stripNul(message);
      try {
        await db.insert(schema.feedback).values({
          id,
          userId: sub,
          category,
          message: safeMessage,
          diagnostic: diagnosticValue as never,
        });
      } catch (err) {
        // Sanitize-then-insert already handles the NUL case; this is a last-resort
        // degrade for any OTHER content quirk so a support-attachment problem never
        // loses the user's category + message. Retry with the inline diagnostic
        // dropped (onConflictDoNothing guards the rare partial-first-insert). A
        // genuine DB outage still surfaces as a 500 — correct (not a content bug).
        req.log.error(
          { err, feedbackId: id },
          'feedback insert failed after NUL-strip — retrying without the inline diagnostic',
        );
        await db
          .insert(schema.feedback)
          .values({
            id,
            userId: sub,
            category,
            message: safeMessage,
            diagnostic: { _s3_key: diagnosticS3Key, _inline_dropped: true } as never,
          })
          .onConflictDoNothing();
      }
      return reply.status(201).send({ id, diagnosticS3Key });
    },
  );
}
