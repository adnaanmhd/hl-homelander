import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index.js';
import { FIXTURES } from '../fixtures/play-integrity-fixtures.js';
import jwt from 'jsonwebtoken';

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
import { _clearInstallationCache } from '../../src/auth/installation-binding.js';

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
  // Bug 4 / D2 — the installation-binding LRU is a module singleton; clear it so
  // a sub re-bound by a prior test never leaks a stale binding into this one.
  _clearInstallationCache();
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
        installationId: 'inst-a',
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
    // Bug 4 / D2 — the minted JWT carries installationId and the account row is
    // bound to this device's install id (newest-login-wins).
    const claims = jwt.decode(body.jwt) as { installationId?: string };
    expect(claims.installationId).toBe('inst-a');
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, body.user.id));
    expect(userRows[0]?.currentInstallationId).toBe('inst-a');
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
        installationId: 'inst-a',
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
        installationId: 'inst-a',
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
        installationId: 'inst-a',
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
        installationId: 'inst-a',
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
        installationId: 'inst-a',
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
        installationId: 'inst-a',
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/integrity-nonce');
  });
});

describe('POST /auth/google — single-device newest-login-wins (Bug 4 / D2)', () => {
  // Both sign-ins resolve to the same googleSub ('1234567890', from the mock) =>
  // the same account, on two different installation ids.
  async function signIn(installationId: string): Promise<string> {
    const { nonceId, nonce } = await freshNonce();
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
        installationId,
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json().jwt as string;
  }

  it('device B sign-in evicts device A → 401 device-evicted; B still works', async () => {
    const tokenA = await signIn('inst-device-a');
    const tokenB = await signIn('inst-device-b'); // rebinds the account to B

    // Device A's JWT no longer matches users.current_installation_id → evicted.
    const aRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(aRes.statusCode).toBe(401);
    expect(aRes.json().type).toBe('https://humyn-app.io/problems/device-evicted');

    // Device B is the current binding → authed request succeeds.
    const bRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(bRes.statusCode).toBe(200);
  });
});

describe('POST /auth/google — silent re-auth (review fix V1: newest-INTERACTIVE-login-wins)', () => {
  // A drawer phone's background upload drain silent-re-auths on token expiry.
  // That machine-initiated call must never steal the single-device binding from
  // the phone the user is actively using, create an account, or stamp consent.
  //
  // The earlier describes spend most of the default 127.0.0.1 anonymous-tier
  // budget (30/min per IP, in-memory per app instance) — this block runs in its
  // own per-IP bucket so the whole file stays under the limit.
  const SILENT_TESTS_IP = '10.99.0.1';
  async function authGoogle(installationId: string, silent?: boolean) {
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/auth/nonce',
      remoteAddress: SILENT_TESTS_IP,
    });
    const { nonceId, nonce } = nonceRes.json() as { nonceId: string; nonce: string };
    (decodeIntegrityToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...FIXTURES.happyPlayStore(),
      requestDetails: { ...FIXTURES.happyPlayStore().requestDetails, nonce },
    });
    return app.inject({
      method: 'POST',
      url: '/auth/google',
      remoteAddress: SILENT_TESTS_IP,
      payload: {
        googleIdToken: 'fake-id-token',
        integrityToken: 'fake-integrity-token',
        flavor: 'playStore',
        applicationId: 'ai.humynlabs.capture',
        nonceId,
        installationId,
        ...(silent === undefined ? {} : { silent }),
      },
    });
  }

  it('silent + DIVERGENT binding → 401 device-evicted; binding NOT stolen; no consent_log append', async () => {
    const interactive = await authGoogle('inst-active-phone');
    expect(interactive.statusCode).toBe(200);
    const userId = interactive.json().user.id as string;

    const res = await authGoogle('inst-drawer-phone', true);
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/device-evicted');

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(row!.currentInstallationId).toBe('inst-active-phone'); // unchanged
    const consentRows = await db
      .select()
      .from(schema.consentLog)
      .where(eq(schema.consentLog.userId, userId));
    expect(consentRows).toHaveLength(1); // only the interactive sign-in stamped
  });

  it('silent + MATCHING binding → 200 + fresh JWT; consent NOT bumped, no consent_log append', async () => {
    const interactive = await authGoogle('inst-same');
    expect(interactive.statusCode).toBe(200);
    const userId = interactive.json().user.id as string;
    // Pin an OLD consent denorm so any silent bump would be visible.
    const oldAccepted = new Date('2025-01-02T03:04:05.000Z');
    await db
      .update(schema.users)
      .set({ consentVersion: '0.9.9-test', consentAcceptedAt: oldAccepted })
      .where(eq(schema.users.id, userId));

    const res = await authGoogle('inst-same', true);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.jwt).toBe('string');
    const claims = jwt.decode(body.jwt as string) as { sub?: string; installationId?: string };
    expect(claims.sub).toBe(userId);
    expect(claims.installationId).toBe('inst-same');

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(row!.consentVersion).toBe('0.9.9-test'); // NOT bumped
    expect(row!.consentAcceptedAt.getTime()).toBe(oldAccepted.getTime());
    const consentRows = await db
      .select()
      .from(schema.consentLog)
      .where(eq(schema.consentLog.userId, userId));
    expect(consentRows).toHaveLength(1); // still only the interactive stamp
  });

  it('silent + UNKNOWN account → 401, no account created (creation implies consent UI)', async () => {
    const res = await authGoogle('inst-fresh-install', true);
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/device-evicted');
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.googleSub, '1234567890'));
    expect(rows).toHaveLength(0);
  });

  it('INTERACTIVE divergent sign-in still rebinds (newest-login-wins regression pin)', async () => {
    const a = await authGoogle('inst-a');
    expect(a.statusCode).toBe(200);
    const b = await authGoogle('inst-b'); // no silent flag — interactive
    expect(b.statusCode).toBe(200);
    const userId = b.json().user.id as string;
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(row!.currentInstallationId).toBe('inst-b'); // rebound
    const consentRows = await db
      .select()
      .from(schema.consentLog)
      .where(eq(schema.consentLog.userId, userId));
    expect(consentRows).toHaveLength(2); // every interactive sign-in stamps
  });
});
