import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { buildProblemDetail, PROBLEM_SLUGS } from '../lib/problem-detail.js';

// Anonymous tier: per-IP, lower budget. Authenticated tier: per-user, higher budget.
// Two SEPARATE registrations so the buckets don't share storage.
async function rateLimitPlugin(app: FastifyInstance) {
  // 1. Anonymous tier — per-IP. Applies BEFORE auth runs.
  await app.register(rateLimit, {
    max: 30, // 30 req / window
    timeWindow: '1 minute',
    keyGenerator: (req) => `ip:${req.ip}`,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // @fastify/rate-limit `throws` the return value of this function. Returning
    // a plain object makes Fastify's setErrorHandler fall through to the catch-all
    // 500 branch (it doesn't recognize the shape as an Error). We build a real
    // Error with statusCode=429 and stash the problem-detail body on `.problemDetail`
    // so error-handler.ts can short-circuit straight to a 429 problem+json.
    errorResponseBuilder: (req, ctx) => {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.rateLimited,
        title: 'Rate limit exceeded',
        status: 429,
        detail: `Anonymous (per-IP) rate limit hit. Retry after ${ctx.after}.`,
        instance: req.id as string,
        extensions: { tier: 'anonymous', retryAfterSeconds: ctx.after },
      });
      const err = new Error(pd.title) as Error & {
        statusCode: number;
        problemDetail: typeof pd;
      };
      err.statusCode = 429;
      err.problemDetail = pd;
      return err;
    },
  });

  // 2. Authenticated tier — per-user. Registered as a SEPARATE rate-limit instance
  //    via @fastify/rate-limit's `app.rateLimit({ ... })` per-route helper. Routes
  //    that require auth pass `config.rateLimit` with the auth-tier limits and a
  //    keyGenerator that pulls req.user.sub.
  //
  // This is how routes consume it (example for plans 05-08):
  //   app.post('/foo', {
  //     preHandler: [app.requireAuth],
  //     config: {
  //       rateLimit: {
  //         max: 120, timeWindow: '1 minute',
  //         keyGenerator: (req) => `user:${(req.user as any).sub}`,
  //       },
  //     },
  //   }, handler)
  //
  // The bucket is keyed by `user:<sub>` — completely disjoint from `ip:<ip>`,
  // so authenticated traffic does NOT consume anonymous IP budget and vice versa.
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });
