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

describe('healthz + readyz', () => {
  it('GET /healthz → 200 status:ok with the GIT_SHA deploy stamp', async () => {
    const prev = process.env.GIT_SHA;
    process.env.GIT_SHA = 'cafe1234';
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok', sha: 'cafe1234' });
    } finally {
      if (prev === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = prev;
    }
  });
  it('GET /healthz → sha falls back to "unknown" without GIT_SHA', async () => {
    const prev = process.env.GIT_SHA;
    delete process.env.GIT_SHA;
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok', sha: 'unknown' });
    } finally {
      if (prev !== undefined) process.env.GIT_SHA = prev;
    }
  });
  it('GET /readyz → 200 status:ready when DB reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });
});
