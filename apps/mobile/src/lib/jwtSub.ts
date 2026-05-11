/**
 * Decode the `sub` claim from a JWS-shaped JWT (header.payload.signature)
 * WITHOUT verifying the signature. Used only to derive a local MMKV cache
 * key (the JWT was already verified at sign-in — never trust this `sub` for
 * an authorization decision; V2/V6 ASVS — see 04-RESEARCH § Security Domain,
 * threat T-4.3-01). Returns `''` for any malformed input — onboarding does
 * not soft-lock on a decode glitch.
 *
 * Extracted (verbatim) from RigTutorialScreen.tsx so RigTutorialScreen,
 * PracticeCompleteScreen (plan 04-06), and computeInitialRoute all share one
 * implementation instead of re-rolling base64url decode.
 */
export function decodeGoogleSubFromJwt(jwt: string | null): string {
  if (!jwt) return '';
  const parts = jwt.split('.');
  if (parts.length !== 3) return '';
  try {
    const segment = parts[1] ?? '';
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padNeeded = (4 - (b64.length % 4)) % 4;
    const padded = b64 + '='.repeat(padNeeded);
    type GlobalWithBuffer = typeof globalThis & {
      Buffer?: { from(data: string, enc: string): { toString(enc: string): string } };
    };
    const g = globalThis as GlobalWithBuffer;
    let json: string;
    if (typeof g.atob === 'function') {
      json = g.atob(padded);
    } else if (g.Buffer) {
      json = g.Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return '';
    }
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload?.sub === 'string' ? payload.sub : '';
  } catch {
    return '';
  }
}
