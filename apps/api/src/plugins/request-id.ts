import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { nanoid } from 'nanoid';

async function requestIdPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    // If client supplied X-Request-Id, trust it (helps with cross-system tracing).
    // Otherwise mint a 21-char nanoid.
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64
        ? incoming
        : nanoid();
    req.id = id;
    reply.header('x-request-id', id);
  });
}

export default fp(requestIdPlugin, { name: 'request-id' });
