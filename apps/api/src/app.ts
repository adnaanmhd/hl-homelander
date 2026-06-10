import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { loggerOptions } from './plugins/logger.js';
import zodPlugin from './plugins/zod.js';
import requestIdPlugin from './plugins/request-id.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import idempotencyPlugin from './plugins/idempotency.js';
import healthzRoutes from './routes/healthz.js';
import readyzRoutes from './routes/readyz.js';
import authRoutes from './routes/auth/index.js';
import tasksRoutes from './routes/tasks/index.js';
import recordingsRoutes from './routes/recordings/index.js';
import meRoutes from './routes/me/index.js';
import contributionsRoutes from './routes/contributions/index.js';
import eventsPostRoute from './routes/events/post.js';
import feedbackPostRoute from './routes/feedback/post.js';
import appVersionGetRoute from './routes/app-version/get.js';
import { startDsrCron } from './cron/dsr-hard-delete.js';
import { startThumbnailSweep } from './cron/thumbnail-sweep.js';
import { verifyConsentTextHash } from './legal/boot-guard.js';
import { isFfmpegAvailable } from './lib/thumbnail.js';

export async function buildApp(): Promise<FastifyInstance> {
  // Plan 01-11 — refuse to start on consent-text drift. MUST run before any
  // plugin/route registration so a stale consent_log row is never written.
  verifyConsentTextHash();

  const app = Fastify({ logger: loggerOptions, disableRequestLogging: false });

  // Bug 1 hardening (260604) — a permissive catch-all content-type parser so no
  // bodiless verb (DELETE /me, future POST-no-body, etc.) can 415 when a native
  // HTTP layer (RN/OkHttp) attaches a content-type Fastify has no parser for.
  // Built-in parsers (application/json, text/plain) and @fastify/multipart's
  // multipart/form-data parser are MORE specific and still take precedence; '*'
  // only catches otherwise-unregistered types, draining + discarding the body.
  // Must be registered before routes.
  app.addContentTypeParser('*', { parseAs: 'string' }, (_req, _body, done) =>
    done(null, undefined),
  );

  // Order matters:
  await app.register(requestIdPlugin); // 1. populate req.id first
  await app.register(zodPlugin); // 2. validator/serializer
  await app.register(errorHandlerPlugin); // 3. setErrorHandler before routes
  await app.register(rateLimitPlugin); // 4. anonymous-tier IP rate limit (pre-auth)
  await app.register(authPlugin); // 5. JWT verifier + requireAuth decorator
  await app.register(idempotencyPlugin); // 6. depends on auth — pulls user.sub

  // Routes
  await app.register(healthzRoutes);
  await app.register(readyzRoutes);
  await app.register(authRoutes); // plan 01-05 — /auth/nonce + /auth/google
  await app.register(tasksRoutes); // plan 01-06 — /tasks/{list,search,get-by-id} + /task-requests
  await app.register(recordingsRoutes); // plan 01-07 — /recordings/{init,parts/:n/complete,finalize,reject} + list/get
  // Plan 01-08 — /me, /contributions, /events, /feedback, /app/version
  await app.register(meRoutes);
  await app.register(contributionsRoutes);
  await app.register(eventsPostRoute);
  await app.register(feedbackPostRoute);
  await app.register(appVersionGetRoute);

  // DSR cron stub — log-only at Phase 1 (Phase 5 swaps in actual hard-delete).
  // Skipped in test runs to avoid log noise + extra db connections under
  // singleFork pool; server.ts boot path always runs it.
  if (process.env.NODE_ENV !== 'test' && process.env.GSD_DSR_CRON !== 'off') {
    startDsrCron(app.log);
  }

  // (Enh 3 / D1, 2026-06-04: the hash-verify worker, its BullMQ/Redis queue, the
  // SQS poller, the events-outbox plugin, and the verify-sweep cron were all
  // removed. `uploaded` is now terminal success — there is nothing to sweep.)

  // BUG-3 (2026-06-09) — ffmpeg boot probe. Server-side poster thumbnails
  // (Bug 6 / D5) shell out to ffmpeg at /finalize + in the backfill script; an
  // image WITHOUT ffmpeg (a pre-Dockerfile-ffmpeg build — DEPLOY-2) silently
  // degrades every poster to null. Log loudly at startup so the gap is
  // observable rather than invisible. Skipped under test (no log noise / no
  // subprocess spawn in the singleFork pool).
  if (process.env.NODE_ENV !== 'test') {
    if (isFfmpegAvailable()) {
      app.log.info('ffmpeg present — server-side poster thumbnails (Bug 6 / D5) enabled');
    } else {
      app.log.warn(
        'ffmpeg NOT found on PATH — server-side poster thumbnails (Bug 6 / D5) are DISABLED; ' +
          'History falls back to the local ledger / gradient. Rebuild the API image WITH ffmpeg ' +
          '(apps/api/Dockerfile already installs it — the deployed image may predate that).',
      );
    }
    // Phase 2 item 4 (2026-06-10) — make the single-instance invariant VISIBLE
    // at boot. The Bug 4 / D2 eviction LRU (auth/installation-binding.ts, 60 s
    // TTL, per-process) and the hourly in-process thumbnail sweep both assume
    // ECS desired_count = 1; scaling out silently weakens eviction (a stale
    // binding can be served from another instance's LRU for up to 60 s) and
    // duplicates the sweep. Revisit both before any scale-out.
    app.log.info(
      'single-instance invariant: installation-binding LRU (60 s TTL) + the thumbnail sweep ' +
        'assume desired_count = 1 — do not scale out without revisiting both',
    );
    // Phase 4 item 1 (2026-06-10, Bug 4) — in-process poster-thumbnail
    // recovery: backfillThumbnails once at boot + hourly. Replaces the
    // structurally-unrunnable manual CLI as the recovery path; rows whose
    // finalize-time generation failed self-heal within one sweep. No-ops
    // (with a warn) when ffmpeg is absent. GSD_THUMB_SWEEP=off escape hatch
    // mirrors GSD_DSR_CRON.
    if (process.env.GSD_THUMB_SWEEP !== 'off') {
      startThumbnailSweep(app.log);
    }
  }

  return app;
}
