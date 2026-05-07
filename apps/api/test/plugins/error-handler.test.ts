import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  app.withTypeProvider<ZodTypeProvider>().post(
    '/_test/echo',
    {
      schema: { body: z.object({ name: z.string().min(1) }) },
      config: { idempotency: false },
    },
    async (req) => req.body,
  );
  app.get('/_test/throw', async () => {
    const e = new Error('teapot') as Error & { statusCode: number };
    e.statusCode = 418;
    throw e;
  });
  app.get('/_test/boom', async () => {
    throw new Error('boom');
  });
});
afterAll(async () => {
  await app.close();
});

describe('error handler — RFC 7807 problem+json', () => {
  it('zod validation error → 400 problem+json with errors[]', async () => {
    const res = await app.inject({ method: 'POST', url: '/_test/echo', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.type).toBe('https://humyn-app.io/problems/validation');
    expect(body.status).toBe(400);
    expect(Array.isArray(body.errors)).toBe(true);
  });
  it('fastify error w/ statusCode → mapped slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/_test/throw' });
    expect(res.statusCode).toBe(418);
    const body = res.json();
    // 418 is in the 400 fallback bucket → validation slug
    expect(body.type).toMatch(/https:\/\/humyn-app\.io\/problems\//);
    expect(body.status).toBe(418);
  });
  it('unhandled error → 500 internal slug, message scrubbed', async () => {
    const res = await app.inject({ method: 'GET', url: '/_test/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.type).toBe('https://humyn-app.io/problems/internal');
    expect(body.detail).toBe('An unexpected error occurred'); // scrubbed
  });
});
