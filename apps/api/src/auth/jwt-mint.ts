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
}

export async function mintJwt(opts: MintJwtOpts): Promise<string> {
  return opts.app.jwt.sign(
    {
      sub: opts.sub,
      flavor: opts.flavor,
      applicationId: opts.applicationId,
      integrity_verdict: opts.integrity_verdict,
      token_version: TOKEN_VERSION,
    },
    { expiresIn: `${TTL_DAYS}d`, algorithm: 'HS256' },
  );
}
