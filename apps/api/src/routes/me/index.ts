import type { FastifyInstance } from 'fastify';
import meGetPatchRoutes from './get-patch.js';
import meDeleteRestoreRoutes from './delete-restore.js';
import mePracticeCompleteRoutes from './practice-complete.js';

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  await app.register(meGetPatchRoutes);
  await app.register(meDeleteRestoreRoutes);
  await app.register(mePracticeCompleteRoutes);
}
