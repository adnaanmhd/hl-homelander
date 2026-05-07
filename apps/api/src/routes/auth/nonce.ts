import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { mintNonce, startNonceGc } from '../../auth/nonce-store.js';
import { AuthNonceResponseSchema } from '@humyn/shared-types';

export default async function nonceRoutes(app: FastifyInstance) {
  startNonceGc(); // safe to call repeatedly
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/nonce',
    {
      schema: { response: { 200: AuthNonceResponseSchema } },
      config: { idempotency: false }, // anonymous route — no user id yet
    },
    async () => mintNonce(),
  );
}
