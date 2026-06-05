// requireAuth plugin (apps/api/src/plugins/auth.ts) — Bug 4 / D2 single-device
// newest-login-wins. Two distinct 401 contracts the mobile client switches on:
//   - a JWT with NO installationId claim (legacy / pre-Bug-4) → `reauth-required`
//     ("please sign in again"), which is NOT an eviction.
//   - a JWT whose installationId diverges from users.current_installation_id (a
//     newer device took over the account) → `device-evicted`.
// A matching installationId still authes through (guards against false 401s).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { buildApp } from '../../src/app.js';
import { db, schema } from '../../src/db/index.js';
import { _clearInstallationCache } from '../../src/auth/installation-binding.js';

const TEST_USER_ID = '01HVTESTAUTHPLUGIN00000000';
const BOUND_INSTALL = 'inst-bound';

// Sign a JWT directly (jsonwebtoken + the app secret) so we can OMIT the
// installationId claim — mintJwt() requires it, but the legacy/reauth case is
// precisely the no-claim token. token_version must be current, else requireAuth
// 401s earlier for an unrelated (token-version) reason.
function tok(claims: Record<string, unknown>): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID,
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      integrity_verdict: 'bypassed_apk',
      token_version: 1,
      ...claims,
    },
    process.env.JWT_SIGNING_SECRET!,
    { algorithm: 'HS256', expiresIn: '24h' },
  );
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  app.get('/_test/requireauth', { preHandler: [app.requireAuth] }, async (_req, reply) => {
    return reply.status(200).send({ ok: true });
  });
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    googleSub: 'g-auth-plugin',
    email: 'authplugin@e.test',
    name: 'Auth Plugin',
    consentVersion: '1.0.0',
    consentAcceptedAt: new Date(),
    currentInstallationId: BOUND_INSTALL,
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
  });
});
afterAll(async () => {
  await db.delete(schema.users).where(eq(schema.users.id, TEST_USER_ID));
  await app.close();
});
beforeEach(() => {
  // The installation-binding LRU is a module singleton — drop any cached entry so
  // each case re-reads the seeded binding from the row.
  _clearInstallationCache();
});

describe('requireAuth — single-device binding (Bug 4 / D2)', () => {
  it('401 reauth-required when the JWT carries no installationId claim', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/_test/requireauth',
      headers: { authorization: `Bearer ${tok({})}` }, // no installationId claim
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/reauth-required');
  });

  it('401 device-evicted when the JWT installationId diverges from the bound row', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/_test/requireauth',
      headers: { authorization: `Bearer ${tok({ installationId: 'inst-some-other-device' })}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().type).toBe('https://humyn-app.io/problems/device-evicted');
  });

  it('200 when the JWT installationId matches the current binding', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/_test/requireauth',
      headers: { authorization: `Bearer ${tok({ installationId: BOUND_INSTALL })}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
