import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe('rate-limit plugin — anonymous tier (per-IP)', () => {
  it('returns 429 + retry-after header after >30 req/min from same IP', async () => {
    const responses = await Promise.all(
      Array.from({ length: 35 }).map(() =>
        app.inject({ method: 'GET', url: '/healthz', remoteAddress: '203.0.113.1' }),
      ),
    );
    const tooMany = responses.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBeGreaterThan(0);
    const sample = tooMany[0]!;
    expect(sample.headers['retry-after']).toBeDefined();
    expect(sample.json().type).toBe('https://humyn-app.io/problems/rate-limited');
    expect(sample.json().tier).toBe('anonymous');
  });
});
