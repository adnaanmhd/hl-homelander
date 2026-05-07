// Barrel for the /recordings/* surface (plan 01-07).

import type { FastifyInstance } from 'fastify';
import recordingsInitRoute from './init.js';
import completePartRoute from './complete-part.js';
import finalizeRoute from './finalize.js';
import rejectRoute from './reject.js';

export default async function recordingsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(recordingsInitRoute);
  await app.register(completePartRoute);
  await app.register(finalizeRoute);
  await app.register(rejectRoute);
}
