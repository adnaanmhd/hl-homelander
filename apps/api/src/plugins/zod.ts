import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

async function zodPlugin(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}

export type AppInstance = FastifyInstance & { withTypeProvider: () => unknown };
export type { ZodTypeProvider };
export default fp(zodPlugin, { name: 'zod' });
