import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import { buildProblemDetail, PROBLEM_SLUGS } from '../lib/problem-detail.js';
import { getCurrentInstallationId } from '../auth/installation-binding.js';

// Per D-AUTH-05.
// `iat` and `exp` are filled by jsonwebtoken at sign-time (from `expiresIn`)
// and asserted at verify-time, so they are optional on the type to keep the
// sign call ergonomic. They will always be present on a verified `req.user`.
export interface JwtPayload {
  sub: string; // ULID
  iat?: number;
  exp?: number;
  flavor: 'apkRollout' | 'playStore' | 'iosAppStore';
  applicationId: string;
  integrity_verdict: 'passed' | 'bypassed_apk';
  token_version: number;
  // Bug 4 / D2 — optional because legacy (pre-Bug-4) tokens lack it. requireAuth
  // 401s when it's absent OR diverges from users.current_installation_id.
  installationId?: string;
}

// Cluster-wide kill-switch (D-AUTH-05). Bumping invalidates every outstanding token.
// At MVP this is a constant; later it becomes config / DB.
export const CURRENT_TOKEN_VERSION = 1 as const;

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// @fastify/jwt owns `FastifyRequest.user`. Augment its FastifyJWT interface so
// `req.user` is typed as our JwtPayload across the codebase.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SIGNING_SECRET;
  if (!secret) throw new Error('JWT_SIGNING_SECRET not set');

  await app.register(jwtPlugin, {
    secret,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.unauthorized,
        title: 'Unauthorized',
        status: 401,
        detail: 'Missing or invalid JWT',
        instance: req.id as string,
      });
      return reply.status(401).type('application/problem+json').send(pd);
    }
    const payload = req.user as JwtPayload | undefined;
    if (!payload || payload.token_version < CURRENT_TOKEN_VERSION) {
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.unauthorized,
        title: 'Token version revoked',
        status: 401,
        detail: 'Re-sign-in required',
        instance: req.id as string,
      });
      return reply.status(401).type('application/problem+json').send(pd);
    }
    // Bug 4 / D2 — single-device newest-login-wins. 401 unless the JWT carries an
    // installationId that still matches the account's current binding (LRU-cached
    // sub → current_installation_id). A legacy JWT (no claim) or a device that's
    // been superseded by a newer sign-in both fail here → forced re-sign-in /
    // eviction. Overrides LOCKED D-AUTH-03 (stateless, no per-request DB read).
    const current = await getCurrentInstallationId(payload.sub);
    if (!payload.installationId) {
      // Legacy / pre-Bug-4 token with no installationId claim — the account was
      // NOT taken over by another device; the user just needs to re-sign-in once
      // so a claim-bearing JWT is minted. Distinct `reauth-required` slug → the
      // client shows "please sign in again", not the misleading "used on another
      // device" copy. (Empty cohort at MVP launch; matters for dev tokens minted
      // before D2 and any future token-shape migration.)
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.reauthRequired,
        title: 'Sign in again',
        status: 401,
        detail: 'Please sign in again',
        instance: req.id as string,
      });
      return reply.status(401).type('application/problem+json').send(pd);
    }
    if (payload.installationId !== current) {
      // Genuine eviction — a newer sign-in on another device superseded this one.
      const pd = buildProblemDetail({
        slug: PROBLEM_SLUGS.deviceEvicted,
        title: 'Signed out',
        status: 401,
        detail: 'Your account was used on another device',
        instance: req.id as string,
      });
      return reply.status(401).type('application/problem+json').send(pd);
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
