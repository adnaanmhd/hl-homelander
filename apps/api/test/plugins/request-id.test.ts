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

describe('request-id plugin', () => {
  it('echoes client-supplied X-Request-Id back', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'test-abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('test-abc-123');
  });
  it('mints an id when none is supplied', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(10);
  });
});
