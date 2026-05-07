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

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: loggerOptions, disableRequestLogging: false });

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
  // Plans 07-08 register their routes here.

  return app;
}
