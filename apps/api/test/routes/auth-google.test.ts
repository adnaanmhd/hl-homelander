import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { FIXTURES } from '../fixtures/play-integrity-fixtures.js';

vi.mock('../../src/auth/verify-id-token.js', () => ({
  verifyGoogleIdToken: vi.fn(async (_idToken: string) => ({
    sub: '1234567890',
    email: 'tester@example.com',
    email_verified: true,
    name: 'Tester',
    picture: null,
  })),
}));
vi.mock('../../src/auth/verify-play-integrity.js', () => ({
  decodeIntegrityToken: vi.fn(async (_opts: { packageName: string; integrityToken: string }) =>
    FIXTURES.happyPlayStore(),
  ),
}));

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
  await db.delete(schema.consentLog);
  await db.delete(schema.profiles);
  await db.delete(schema.users);
  await db.delete(schema.authNonces);
});

async function freshNonce(): Promise<{ nonceId: string; nonce: string }> {
  const r = await app.inject({ method: 'POST', url: '/auth/nonce' });
  return r.json() as { nonceId: string; nonce: string };
}

describe('POST /auth/google — happy path', () => {
  it('playStore happy path → 200 + JWT + user record + consent_log row', async () => {
    const { nonceId, nonce } = await freshNonce();
    // Make the mocked decodeIntegrityToken return a payload whose nonce matches
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...FIXTURES.happyPlayStore(),
      requestDetails: { ...FIXTURES.happyPlayStore().requestDetails, nonce },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'fake-id-token',
        integrityToken: 'fake-integrity-token',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.jwt).toBe('string');
    expect(body.user.email).toBe('tester@example.com');
    expect(body.user.flavor).toBe('playStore');
    const consentRows = await db
      .select()
      .from(schema.consentLog)
      .where(eq(schema.consentLog.userId, body.user.id));
    expect(consentRows.length).toBe(1);
  });
});

describe('POST /auth/google — reject paths', () => {
  it('rooted → 403 integrity-rooted', async () => {
    const { nonceId, nonce } = await freshNonce();
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...FIXTURES.rooted(),
      requestDetails: { ...FIXTURES.rooted().requestDetails, nonce },
    });
    const res = await app.inject({
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
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe('https://humyn-app.io/problems/integrity-rooted');
  });
  it('emulator → 403 integrity-emulator', async () => {
    const { nonceId, nonce } = await freshNonce();
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...FIXTURES.emulator(),
      requestDetails: { ...FIXTURES.emulator().requestDetails, nonce },
    });
    const res = await app.inject({
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
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe('https://humyn-app.io/problems/integrity-emulator');
  });
  it('non-Play-Store install on playStore → 403 integrity-install-source', async () => {
    const { nonceId, nonce } = await freshNonce();
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...FIXTURES.unrecognizedVersion(),
      requestDetails: { ...FIXTURES.unrecognizedVersion().requestDetails, nonce },
    });
    const res = await app.inject({
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
    expect(res.statusCode).toBe(403);
    expect(res.json().type).toBe('https://humyn-app.io/problems/integrity-install-source');
  });
  it('mismatched (flavor, applicationId) → 403 forbidden (allowlist fast-fail)', async () => {
    const { nonceId } = await freshNonce();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        googleIdToken: 'x',
        integrityToken: 'y',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture.apk',
        nonceId,
      },
    });
    expect(res.statusCode).toBe(403);
  });
  it('replayed nonce → 401 integrity-nonce', async () => {
    const { nonceId, nonce } = await freshNonce();
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...FIXTURES.happyPlayStore(),
      requestDetails: { ...FIXTURES.happyPlayStore().requestDetails, nonce },
    });
    // First call consumes the nonce
    await app.inject({
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
    // Second call — same nonceId, now consumed
    const res = await app.inject({
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
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/integrity-nonce');
  });
});
