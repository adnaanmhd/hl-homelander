// Barrel for the /recordings/* surface (plan 01-07).
// Registration order matters: list (literal /recordings) before get
// (/recordings/:id) per Fastify radix-tree precedence (Pattern 28 — STATE.md).

import type { FastifyInstance } from 'fastify';
import recordingsInitRoute from './init.js';
import completePartRoute from './complete-part.js';
import finalizeRoute from './finalize.js';
import rejectRoute from './reject.js';
import recordingsListRoute from './list.js';
import recordingsGetRoute from './get.js';

export default async function recordingsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(recordingsInitRoute);
  await app.register(completePartRoute);
  await app.register(finalizeRoute);
  await app.register(rejectRoute);
  await app.register(recordingsListRoute); // GET /recordings (literal)
  await app.register(recordingsGetRoute); // GET /recordings/:id (parameterized)
}
