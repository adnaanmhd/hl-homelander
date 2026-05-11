// decodeGoogleSubFromJwt unit tests — plan 04-03 (ONB-08, D-NAV-04).
//
// The util base64url-decodes the `sub` claim from a JWS-shaped JWT
// (header.payload.signature) WITHOUT verifying the signature — it is used
// only to derive a local MMKV cache key. It must never throw and must return
// '' for any malformed input (onboarding does not soft-lock on a decode
// glitch). See 04-RESEARCH § Security Domain (T-4.3-01).

import { describe, it, expect } from 'vitest';

import { decodeGoogleSubFromJwt } from '../../src/lib/jwtSub';

function makeJwt(payload: Record<string, unknown>): string {
  // Build a JWS-shaped token: header + base64url(JSON payload) + signature.
  // Node's Buffer base64url encoding is the inverse of the util's decode.
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJSUzI1NiJ9.${b64}.signature-bytes-here`;
}

describe('decodeGoogleSubFromJwt', () => {
  it('returns the sub claim from a well-formed token', () => {
    expect(decodeGoogleSubFromJwt(makeJwt({ sub: 'abc' }))).toBe('abc');
  });

  it('returns a realistic 21-digit Google sub verbatim', () => {
    const sub = '108472831947509823746';
    expect(decodeGoogleSubFromJwt(makeJwt({ sub, email: 'x@example.com' }))).toBe(sub);
  });

  it('returns "" for null', () => {
    expect(decodeGoogleSubFromJwt(null)).toBe('');
  });

  it('returns "" for a string that is not a 3-part JWT', () => {
    expect(decodeGoogleSubFromJwt('bad')).toBe('');
    expect(decodeGoogleSubFromJwt('header.payload')).toBe('');
  });

  it('returns "" when the payload is not valid base64url JSON', () => {
    expect(decodeGoogleSubFromJwt('header.!!!notbase64!!!.sig')).toBe('');
  });

  it('returns "" when the payload JSON has no sub claim', () => {
    expect(decodeGoogleSubFromJwt(makeJwt({ email: 'x@example.com' }))).toBe('');
  });

  it('returns "" when the sub claim is not a string', () => {
    expect(decodeGoogleSubFromJwt(makeJwt({ sub: 12345 }))).toBe('');
  });
});
