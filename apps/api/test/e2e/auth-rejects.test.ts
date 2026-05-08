// E2E auth-reject path tests — exercises every reject branch of /auth/google.
//
// 6 scenarios:
//   1. rooted device                                 → 403 integrity-rooted
//   2. emulator                                      → 403 integrity-emulator
//   3. playStore flavor + non-Play install source    → 403 integrity-install-source
//   4. apkRollout flavor + bypass DISABLED + non-Play install → 403 integrity-install-source
//   5. apkRollout flavor + bypass ENABLED + non-Play install  → 200 + JWT
//   6. iosAppStore flavor (W6 Phase-1 gate)          → 501 integrity-flavor-not-supported
//
// All external service calls are vi.mock'd. Each test mints a fresh nonce
// (the nonces are single-use; replays would 401 with integrity-nonce).

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { truncateTestTables } from './helpers/seed-fixtures.js';
import {
  setupAuthMocks,
  rootedPayload,
  emulatorPayload,
  unrecognizedVersionPayload,
} from './helpers/mock-play-integrity.js';

setupAuthMocks();
import { buildApp } from '../../src/app.js';
import { decodeIntegrityToken } from '../../src/auth/verify-play-integrity.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await truncateTestTables();
  vi.mocked(decodeIntegrityToken).mockReset();
});

async function freshNonce(): Promise<{ nonceId: string; nonce: string }> {
  const r = await app.inject({ method: 'POST', url: '/auth/nonce' });
  return r.json() as { nonceId: string; nonce: string };
}

describe('/auth/google — reject paths', () => {
  it('rooted device → 403 integrity-rooted', async () => {
    const { nonceId, nonce } = await freshNonce();
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(rootedPayload(nonce));
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().type).toBe('https://humyn-app.io/problems/integrity-rooted');
  });

  it('emulator → 403 integrity-emulator', async () => {
    const { nonceId, nonce } = await freshNonce();
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(emulatorPayload(nonce));
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().type).toBe('https://humyn-app.io/problems/integrity-emulator');
  });

  it('non-Play-Store install on playStore flavor → 403 integrity-install-source', async () => {
    const { nonceId, nonce } = await freshNonce();
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(
      unrecognizedVersionPayload(nonce, 'ai.humynlabs.capture'),
    );
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().type).toBe('https://humyn-app.io/problems/integrity-install-source');
  });

  it('non-Play-Store install on apkRollout flavor with bypass DISABLED → 403 integrity-install-source', async () => {
    delete process.env.REMOTE_CONFIG_JSON;
    const { nonceId, nonce } = await freshNonce();
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(
      unrecognizedVersionPayload(nonce, 'ai.humynlabs.capture.apk'),
    );
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'apkRollout',
        applicationId: 'ai.humynlabs.capture.apk',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().type).toBe('https://humyn-app.io/problems/integrity-install-source');
  });

  it('non-Play-Store install on apkRollout flavor with bypass ENABLED → 200 + JWT', async () => {
    process.env.REMOTE_CONFIG_JSON = JSON.stringify({
      'auth.apk_install_source_bypass.ai.humynlabs.capture.apk': true,
    });
    const { nonceId, nonce } = await freshNonce();
    vi.mocked(decodeIntegrityToken).mockResolvedValueOnce(
      unrecognizedVersionPayload(nonce, 'ai.humynlabs.capture.apk'),
    );
    const r = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'apkRollout',
        applicationId: 'ai.humynlabs.capture.apk',
        nonceId,
      },
    });
    expect(r.statusCode).toBe(200);
    expect(typeof (r.json() as { jwt: string }).jwt).toBe('string');
    delete process.env.REMOTE_CONFIG_JSON;
  });

  it('iosAppStore flavor (W6 Phase-1 gate) → 501 integrity-flavor-not-supported', async () => {
    const { nonceId } = await freshNonce();
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
