import type { FastifyInstance } from 'fastify';
import meGetPatchRoutes from './get-patch.js';
import meDeleteRestoreRoutes from './delete-restore.js';

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  await app.register(meGetPatchRoutes);
  await app.register(meDeleteRestoreRoutes);
}
