// E2E rate-limit firing test — anonymous tier (per-IP) on /tasks/search.
//
// Plan 04 wires `@fastify/rate-limit` globally with max=30/min keyed by
// `ip:<ip>`. We blast 40 requests from the same simulated remoteAddress and
// assert that some return 429 with the canonical problem-detail body
// (tier=anonymous, retry-after header populated).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupAuthMocks } from './helpers/mock-play-integrity.js';

setupAuthMocks();
import { buildApp } from '../../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe('Rate-limit anonymous tier', () => {
  it('returns 429 + Retry-After + tier=anonymous after >30 req/min on /tasks/search from same IP', async () => {
    const responses = await Promise.all(
      Array.from({ length: 40 }).map(() =>
        app.inject({
          method: 'GET',
          url: '/tasks/search?q=x&limit=1',
          remoteAddress: '203.0.113.99',
        }),
      ),
    );
    const tooMany = responses.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBeGreaterThan(0);
    const sample = tooMany[0]!;
    expect(sample.headers['retry-after']).toBeDefined();
    const body = sample.json() as { type: string; tier: string };
    expect(body.type).toBe('https://humyn-app.io/problems/rate-limited');
    expect(body.tier).toBe('anonymous');
  });
});
