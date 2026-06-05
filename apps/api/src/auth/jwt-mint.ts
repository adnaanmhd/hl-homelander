import type { FastifyInstance } from 'fastify';
import type { Flavor } from './flavor-allowlist.js';

const TTL_DAYS = 30; // D-AUTH-03 — 30-day, no refresh, no denylist
const TOKEN_VERSION = 1; // D-AUTH-05 — kill-switch

export interface MintJwtOpts {
  app: FastifyInstance;
  sub: string; // ULID
  flavor: Flavor;
  applicationId: string;
  integrity_verdict: 'passed' | 'bypassed_apk';
  // Bug 4 / D2 — the device's stable install id, also written onto
  // users.current_installation_id this sign-in. requireAuth 401s when a later
  // JWT's installationId diverges from the row (newest-login-wins).
  installationId: string;
}

export async function mintJwt(opts: MintJwtOpts): Promise<string> {
  return opts.app.jwt.sign(
    {
      sub: opts.sub,
      flavor: opts.flavor,
      applicationId: opts.applicationId,
      integrity_verdict: opts.integrity_verdict,
      token_version: TOKEN_VERSION,
      installationId: opts.installationId,
    },
    { expiresIn: `${TTL_DAYS}d`, algorithm: 'HS256' },
  );
}
