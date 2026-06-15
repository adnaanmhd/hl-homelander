import type { FastifyInstance } from 'fastify';

export default async function healthzRoutes(app: FastifyInstance) {
  // Liveness — answers as long as the process is up. ALB never marks unhealthy
  // unless the process is crashed. `sha` is the deploy stamp (Dockerfile
  // ARG GIT_SHA → ENV) so `curl /healthz` proves WHICH build is live — the
  // 2026-06-10 incident was a stale image nobody could detect.
  app.get('/healthz', async () => ({
    status: 'ok',
    sha: process.env.GIT_SHA ?? 'unknown',
  }));
}
