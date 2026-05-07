import type { FastifyInstance } from 'fastify';

export default async function healthzRoutes(app: FastifyInstance) {
  // Liveness — answers as long as the process is up. ALB never marks unhealthy
  // unless the process is crashed.
  app.get('/healthz', async () => ({ status: 'ok' }));
}
