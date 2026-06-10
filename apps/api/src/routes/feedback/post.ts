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
import { eq, sql } from 'drizzle-orm';
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

/**
 * Phase 6 item 3 (2026-06-10, Bug 6) — PG content/constraint error classes:
 * 22xxx (data exception — e.g. 22P05 unsupported unicode escape, 22021 bad
 * encoding) and 23xxx (integrity constraint). These mean THIS payload cannot
 * be stored — a client-content problem (4xx), not an infra outage (500).
 * Drizzle wraps the pg error, so check both the error and its cause.
 * Exported for tests.
 */
export function isPgContentError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const cause = (err as { cause?: unknown }).cause;
  const code =
    (err as { code?: unknown }).code ?? (cause as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && (code.startsWith('22') || code.startsWith('23'));
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
            // Phase 6 item 3 (2026-06-10, Bug 6) — a truncated body makes
            // @fastify/busboy's Dicer emit a LATE (nextTick) 'error' onto this
            // file stream; with no listener that is an uncaughtException =
            // process death, not even a 500. @fastify/multipart ≥9.3.0 guards
            // the pre-consumption window (fastify-multipart #595); this no-op
            // covers the post-detach window after our iterator below rejects.
            // The parts() iterator still lands in the 400 catch either way.
            part.file.on('error', () => {});
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
        const e = err as { code?: string; statusCode?: number };
        if (e?.code === 'FST_REQ_FILE_TOO_LARGE') {
          diagnosticTooLarge = true;
        } else if (typeof e?.statusCode !== 'number') {
          // Phase 6 item 3 (2026-06-10, Bug 6) — a busboy parse error
          // ("Unexpected end of form", "Malformed part header", a dropped
          // connection mid-body) carries NO statusCode and used to bubble
          // into the 500 handler. A body the server cannot parse is the
          // CLIENT's malformed request → 400. Fastify/multipart's own typed
          // errors (FST_FIELDS_LIMIT etc.) carry a statusCode and still
          // rethrow to the error handler, which maps them correctly.
          req.log.warn({ err }, 'malformed multipart body on /feedback — replying 400');
          const pd = buildProblemDetail({
            slug: PROBLEM_SLUGS.validation,
            title: 'malformed multipart',
            status: 400,
            detail: 'The multipart body could not be parsed',
            instance: req.id as string,
          });
          return reply.status(400).type(PROBLEM_CT).send(pd);
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
      }

      // Phase 6 item 4 (2026-06-10, Bug 6) — INSERT-FIRST, upload-later. The
      // row (with `_s3_key: null`) is persisted BEFORE any S3 call, so S3
      // leaves the 201 path entirely: an S3 outage can neither 500 nor delay
      // the user's report. BUG-7 — strip NUL bytes (Postgres rejects them in
      // jsonb + text); on a residual content failure degrade to dropping the
      // inline diagnostic, and if even THAT insert fails with a PG content/
      // constraint class (22xxx/23xxx), reply 422 "diagnostic not storable" —
      // 500 is reserved for infra.
      const diagnosticValue = stripNulDeep({
        ...(diagnosticInline ?? {}),
        _s3_key: null,
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
        // dropped (onConflictDoNothing guards the rare partial-first-insert).
        req.log.error(
          { err, feedbackId: id },
          'feedback insert failed after NUL-strip — retrying without the inline diagnostic',
        );
        try {
          await db
            .insert(schema.feedback)
            .values({
              id,
              userId: sub,
              category,
              message: safeMessage,
              diagnostic: { _s3_key: null, _inline_dropped: true } as never,
            })
            .onConflictDoNothing();
        } catch (err2) {
          if (isPgContentError(err2)) {
            // Phase 6 item 3 — even the diagnostic-free row is content-
            // rejected (e.g. an unstorable message). This payload can never
            // succeed → 4xx so the client stops retrying it; 500 stays
            // reserved for genuine infra failures.
            req.log.error(
              { err: err2, feedbackId: id },
              'feedback retry insert content-rejected — replying 422',
            );
            const pd = buildProblemDetail({
              slug: PROBLEM_SLUGS.validation,
              title: 'diagnostic not storable',
              status: 422,
              detail: 'The report content cannot be stored; remove unusual characters and retry',
              instance: req.id as string,
            });
            return reply.status(422).type(PROBLEM_CT).send(pd);
          }
          throw err2; // genuine DB outage → 500 (correct)
        }
      }

      // Row persisted — NOW the best-effort S3 archive of the full blob. On
      // success, stamp the key onto the already-inserted row via jsonb_set; a
      // failure anywhere in this block (bucket misconfig, S3 down, the UPDATE
      // itself) is logged and the 201 stands with `_s3_key: null`.
      let diagnosticS3Key: string | null = null;
      if (diagnosticBytes) {
        try {
          diagnosticS3Key = await uploadDiagnostic({
            feedbackId: id,
            userId: sub,
            bytes: diagnosticBytes,
            contentType: 'application/json',
          });
          await db
            .update(schema.feedback)
            .set({
              diagnostic: sql`jsonb_set(${schema.feedback.diagnostic}, '{_s3_key}', ${JSON.stringify(diagnosticS3Key)}::jsonb)`,
            })
            .where(eq(schema.feedback.id, id));
        } catch (err) {
          req.log.warn(
            { err, feedbackId: id },
            'feedback diagnostic S3 archive failed — feedback already stored with inline diagnostic only',
          );
        }
      }
      return reply.status(201).send({ id, diagnosticS3Key });
    },
  );
}
