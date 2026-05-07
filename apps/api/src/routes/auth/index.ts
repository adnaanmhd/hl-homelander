import type { FastifyInstance } from 'fastify';
import nonceRoutes from './nonce.js';
import googleAuthRoutes from './google.js';

export default async function authRoutes(app: FastifyInstance) {
  await app.register(nonceRoutes);
  await app.register(googleAuthRoutes);
}
