// GET /app/version — API-13. Asserts per-flavor response shape, Cache-Control
// header, and that the route is unauthenticated (D-APK-02 / pre-sign-in
// upgrade prompts).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { seedAppVersions } from '../../src/routes/app-version/seed-initial.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await seedAppVersions();
});
afterAll(async () => {
  await app.close();
});

describe('GET /app/version', () => {
  it('returns apkRollout shape with apkUrl + apkSha256 + max-age=21600', async () => {
    const r = await app.inject({ method: 'GET', url: '/app/version?flavor=apkRollout' });
    expect(r.statusCode).toBe(200);
    expect(r.json().flavor).toBe('apkRollout');
    expect(typeof r.json().apkUrl).toBe('string');
    expect(typeof r.json().apkSha256).toBe('string');
    expect(r.json().playStoreUrl).toBeNull();
    expect(r.headers['cache-control']).toContain('max-age=21600');
  });

  it('returns playStore shape with playStoreUrl', async () => {
    const r = await app.inject({ method: 'GET', url: '/app/version?flavor=playStore' });
    expect(r.statusCode).toBe(200);
    expect(r.json().playStoreUrl).toMatch(/^https:\/\/play\.google\.com/);
    expect(r.json().apkUrl).toBeNull();
    expect(r.json().apkSha256).toBeNull();
  });

  it('returns iosAppStore shape with apple URL', async () => {
    const r = await app.inject({ method: 'GET', url: '/app/version?flavor=iosAppStore' });
    expect(r.statusCode).toBe(200);
    expect(r.json().flavor).toBe('iosAppStore');
    expect(r.json().playStoreUrl).toMatch(/^https:\/\/apps\.apple\.com/);
  });

  it('does NOT require auth (unauthenticated request → 200)', async () => {
    const r = await app.inject({ method: 'GET', url: '/app/version?flavor=playStore' });
    expect(r.statusCode).toBe(200);
  });

  it('rejects unknown flavor with 400', async () => {
    const r = await app.inject({ method: 'GET', url: '/app/version?flavor=admin' });
    expect(r.statusCode).toBe(400);
  });
});
