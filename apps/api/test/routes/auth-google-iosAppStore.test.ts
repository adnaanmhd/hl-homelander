import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/auth/verify-id-token.js', () => ({
  verifyGoogleIdToken: vi.fn(async () => ({
    sub: 'g-ios',
    email: 'ios@e.com',
    email_verified: true,
    name: 'iOS',
  })),
}));
vi.mock('../../src/auth/verify-play-integrity.js', () => ({
  decodeIntegrityToken: vi.fn(async () => {
    throw new Error('should never be called for iosAppStore');
  }),
}));

import { buildApp } from '../../src/app.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe('POST /auth/google — iosAppStore is gated until Phase 7 (W6)', () => {
  it('returns 501 + integrity-flavor-not-supported problem-detail', async () => {
    // Even with a valid nonce + JWT-shaped body, iosAppStore must hard-reject in Phase 1.
    const nonceRes = await app.inject({ method: 'POST', url: '/auth/nonce' });
    const { nonceId } = nonceRes.json() as { nonceId: string };
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: '',
        flavor: 'iosAppStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(501);
    expect(r.json().type).toBe('https://humyn-app.io/problems/integrity-flavor-not-supported');
  });
});
