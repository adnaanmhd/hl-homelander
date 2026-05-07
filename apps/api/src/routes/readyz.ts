import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export default async function readyzRoutes(app: FastifyInstance) {
  // Readiness — returns 200 only if the DB ping completes within 1s.
  app.get('/readyz', async (req, reply) => {
    try {
      await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 1000)),
      ]);
      return { status: 'ready' };
    } catch (err) {
      req.log.warn({ err }, 'readyz_db_check_failed');
      return reply.status(503).type('application/problem+json').send({
        type: 'https://humyn-app.io/problems/internal',
        title: 'Not ready',
        status: 503,
        detail: 'Database unreachable',
      });
    }
  });
}
