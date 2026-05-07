import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { isValidIdempotencyKey, hashRequest, lookup, persist } from '../lib/idempotency-store.js';
import { buildProblemDetail, PROBLEM_SLUGS } from '../lib/problem-detail.js';

const HEADER = 'idempotency-key';
const PROBLEM_CT = 'application/problem+json';

declare module 'fastify' {
  interface FastifyRequest {
    idempotency?: { key: string; userId: string; requestHash: string };
  }
}

async function idempotencyPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== 'POST' && req.method !== 'PATCH') return;
    // Anonymous routes (e.g. /auth/google before user exists) MUST opt-out via route config.
    // Convention: route declares `config: { idempotency: false }` to skip.
    const cfg = (req.routeOptions?.config ?? {}) as { idempotency?: boolean };
    if (cfg.idempotency === false) return;

    const raw = req.headers[HEADER];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key) {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.idempotencyKeyInvalid,
        title: 'Idempotency-Key required',
        status: 400,
        detail: 'POST/PATCH requests must include an Idempotency-Key header (UUIDv4)',
        instance: req.id as string,
      });
      return reply.status(400).type(PROBLEM_CT).send(pd);
    }
    if (!isValidIdempotencyKey(key)) {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.idempotencyKeyInvalid,
        title: 'Idempotency-Key must be a UUIDv4',
        status: 400,
        detail: `Got ${key.slice(0, 16)}...`,
        instance: req.id as string,
      });
      return reply.status(400).type(PROBLEM_CT).send(pd);
    }

    // The global preHandler runs BEFORE route-level requireAuth, so req.user
    // is not populated yet. We decode the bearer token ourselves (best-effort)
    // — if it fails, fall through and let the route's requireAuth handle the
    // 401. Only when the JWT decodes cleanly do we have a userId for the
    // (user_id, key) lookup.
    let userId: string | undefined;
    try {
      // jwtVerify() populates req.user as a side effect on success.
      await req.jwtVerify();
      userId = (req.user as { sub?: string } | undefined)?.sub;
    } catch {
      // Token missing / invalid — let the route's requireAuth handle it.
    }
    if (!userId) return;

    const requestHash = hashRequest(req.method, req.url, req.body);
    const hit = await lookup(userId, key);
    if (hit) {
      if (hit.requestHash !== requestHash) {
        const pd = buildProblemDetail({
          slug: PROBLEM_SLUGS.idempotencyKeyConflict,
          title: 'Idempotency-Key reused with different request body',
          status: 409,
          detail: 'Same key, different body. Use a fresh UUIDv4.',
          instance: req.id as string,
        });
        return reply.status(409).type(PROBLEM_CT).send(pd);
      }
      // Replay — return original response
      return reply.status(hit.statusCode).send(hit.responseBody);
    }

    req.idempotency = { key, userId, requestHash };
  });

  // After-response hook persists the original response.
  app.addHook('onSend', async (req, reply, payload) => {
    if (!req.idempotency) return payload;
    if (reply.statusCode >= 500) return payload; // don't memoize server errors
    let bodyForStorage: unknown;
    try {
      bodyForStorage = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      bodyForStorage = payload;
    }
    await persist({
      userId: req.idempotency.userId,
      key: req.idempotency.key,
      method: req.method,
      path: req.url,
      requestHash: req.idempotency.requestHash,
      statusCode: reply.statusCode,
      responseBody: bodyForStorage,
    });
    return payload;
  });
}

export default fp(idempotencyPlugin, { name: 'idempotency', dependencies: ['auth'] });
