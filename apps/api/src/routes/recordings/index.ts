// Barrel for the /recordings/* surface (plan 01-07).
// Registration order matters: list (literal /recordings) before get
// (/recordings/:id) per Fastify radix-tree precedence (Pattern 28 — STATE.md).

import type { FastifyInstance } from 'fastify';
import recordingsInitRoute from './init.js';
import completePartRoute from './complete-part.js';
import recordingsRePresignRoute from './parts.js';
import finalizeRoute from './finalize.js';
import rejectRoute from './reject.js';
import recordingsReuploadRoute from './reupload.js';
import recordingsVerifiedIdsRoute from './verified-ids.js';
import recordingsListRoute from './list.js';
import recordingsStreamUrlRoute from './stream-url.js';
import recordingsGetRoute from './get.js';

export default async function recordingsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(recordingsInitRoute);
  await app.register(completePartRoute);
  // POST /recordings/:id/parts — re-presign video + IMU part URLs against the
  // existing multipart uploads (Plan 05-09; the coordinator's preferred re-drain
  // route — preserves DONE parts' ETags; vs. re-/init which restarts the IMU stream)
  await app.register(recordingsRePresignRoute);
  await app.register(finalizeRoute);
  await app.register(rejectRoute);
  await app.register(recordingsReuploadRoute); // POST /recordings/:id/reupload (Plan 05-05)
  await app.register(recordingsVerifiedIdsRoute); // GET /recordings/verified-ids (literal — register before /recordings/:id)
  await app.register(recordingsListRoute); // GET /recordings (literal)
  // Pattern 28 (STATE.md) — Fastify radix-tree precedence. The literal
  // /recordings/:id/stream-url MUST register BEFORE the parameterised
  // /recordings/:id, otherwise the wildcard `:id` swallows '/stream-url'.
  await app.register(recordingsStreamUrlRoute); // GET /recordings/:id/stream-url (Phase 6 plan 06-03)
  await app.register(recordingsGetRoute); // GET /recordings/:id (parameterized — LAST)
}
