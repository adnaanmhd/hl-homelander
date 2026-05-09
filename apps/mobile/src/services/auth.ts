// Phase 1 sign-in orchestration. Runs the four-step backend round-trip:
//   1. Google Sign-In (Credential Manager, Android 14+) → Google ID token
//   2. POST /auth/nonce → { nonceId, nonce } (single-use, 5-minute TTL)
//   3. PlayIntegrity.requestIntegrityToken(nonce) → encrypted token (Standard request)
//   4. POST /auth/google { googleIdToken, integrityToken, flavor, applicationId, nonceId }
//      → { jwt, user }
// Validates the JWT payload's flavor + applicationId match the build-time
// AppFlavor constants (D-AUTH-05; defense-in-depth alongside server-side
// flavor-allowlist, plan 05). Stores the JWT in MMKV (encrypted) and reserves
// a Keychain refresh-token slot empty (D-AUTH-03 — no refresh at MVP; Phase
// 5+ will populate it without changing this surface).

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Keychain from 'react-native-keychain';
import Config from 'react-native-config';
import { getFlavorContext } from '../native/AppFlavor';
import { requestIntegrityToken } from '../native/PlayIntegrity';
import { secureMmkv as mmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { useAppStore } from '../state/appStore';
import { apiClient } from './api';

// MMKV instance + JWT key are now the canonical singletons declared in
// `../state/mmkv` and `../state/keys` (D-STATE-01). The encryption flag
// (T-1.13-01 mitigation) lives on the singleton; this module just imports
// the handle.

// Configure GoogleSignin at module load — webClientId comes from the per-flavor
// .env file via react-native-config. Empty string is acceptable at typecheck
// time; the manual smoke (Task 5) validates a real value at run time.
GoogleSignin.configure({
  webClientId: Config['GOOGLE_WEB_CLIENT_ID'] ?? '',
  offlineAccess: false,
});

export interface AuthSuccess {
  jwt: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
}

interface NonceResponse {
  nonceId: string;
  nonce: string;
}

interface AuthGoogleResponse {
  jwt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    flavor: string;
    applicationId: string;
    consentVersion: string;
  };
}

interface JwtPayload {
  sub: string;
  flavor: string;
  applicationId: string;
  exp?: number;
  iat?: number;
}

/**
 * Decodes the payload of a JWS-shaped JWT (header.payload.signature) without
 * verifying the signature — used for client-side post-flight assertion that
 * the server-issued JWT carries the build-time flavor + applicationId. The
 * authoritative verification lives server-side; this is defense-in-depth.
 */
function decodeJwtPayload(jwt: string): JwtPayload {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('jwt_malformed');
  }
  const segment = parts[1] ?? '';
  // base64url → base64
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padNeeded = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(padNeeded);
  // base64 → utf8. RN 0.83 Hermes exposes globalThis.atob; Node (vitest)
  // exposes it via the global object too (since Node 16). If neither is
  // available, fall back to globalThis.Buffer (Node) as a last resort.
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
    throw new Error('jwt_decode_no_base64_runtime');
  }
  return JSON.parse(json) as JwtPayload;
}

/**
 * Runs the full Phase 1 sign-in handshake. Returns the JWT + minimal user
 * profile on success; throws with a descriptive message on any failure.
 */
export async function signInWithGoogle(): Promise<AuthSuccess> {
  const { flavor, applicationId } = getFlavorContext();

  // 1. Google Sign-In via Credential Manager.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResponse = await GoogleSignin.signIn();
  if (signInResponse.type !== 'success') {
    throw new Error('google_sign_in_cancelled');
  }
  const googleIdToken = signInResponse.data.idToken;
  if (!googleIdToken) {
    throw new Error('google_sign_in_no_id_token');
  }

  // 2. Mint a server-side single-use nonce.
  const nonceRes = await apiClient.postNoBody<NonceResponse>('/auth/nonce');

  // 3. Request a Play Integrity token bound to that nonce.
  const integrityToken = await requestIntegrityToken(nonceRes.nonce);

  // 4. POST /auth/google.
  const authRes = await apiClient.post<AuthGoogleResponse>('/auth/google', {
    googleIdToken,
    integrityToken,
    flavor,
    applicationId,
    nonceId: nonceRes.nonceId,
  });

  // 5. Validate JWT payload — D-AUTH-05 requires the JWT to carry the build's
  //    (flavor, applicationId). Belt-and-suspenders: the backend cross-checks
  //    via flavor-allowlist (D-AUTH-01); we re-verify here so a misconfigured
  //    backend can't quietly accept the wrong pair.
  const payload = decodeJwtPayload(authRes.jwt);
  if (payload.flavor !== flavor) {
    throw new Error(`jwt_flavor_mismatch: expected ${flavor}, got ${payload.flavor}`);
  }
  if (payload.applicationId !== applicationId) {
    throw new Error(
      `jwt_applicationId_mismatch: expected ${applicationId}, got ${payload.applicationId}`,
    );
  }

  // 6. Store JWT — MMKV with encryption flag (instance-level encryptionKey
  //    on the singleton). Key prefix `auth.jwt.v1` is versioned for kill-switch.
  mmkv.set(KEYS.AUTH_JWT, authRes.jwt);

  // 7. Reserve the Keychain refresh-token slot. Empty at MVP per D-AUTH-03;
  //    Phase 5+ can populate without changing this surface. If Keychain
  //    operations fail (sandboxed test env, etc.), log and continue — the JWT
  //    is the primary auth.
  try {
    await Keychain.setGenericPassword('humyn-refresh', '', { service: 'humyn.refresh.v1' });
  } catch {
    // non-fatal at MVP
  }

  return {
    jwt: authRes.jwt,
    user: {
      id: authRes.user.id,
      email: authRes.user.email,
      name: authRes.user.name,
      avatarUrl: authRes.user.avatarUrl,
    },
  };
}

export function getStoredJwt(): string | undefined {
  return mmkv.getString(KEYS.AUTH_JWT);
}

export function clearStoredJwt(): void {
  mmkv.remove(KEYS.AUTH_JWT);
}

/**
 * Logout helper — clears the local JWT and resets the in-memory auth slice.
 *
 * Plan 02-09 (this plan) ships the helper; plan 02-18 (Profile Logout) will
 * import this directly from `services/auth.ts`. Phase 5 will extend this body
 * to additionally cancel any in-flight uploads — call sites do NOT need to
 * change. AUTH-08 client surface.
 *
 * Defense-in-depth: clearStoredJwt() removes the persisted token; the store's
 * signOut() also wipes the in-memory `jwt` slice. Both write to the same
 * MMKV singleton (state/mmkv) so the redundancy is intentional — a future
 * refactor that decouples store-side persistence from auth.ts will still
 * leave the persisted token cleared.
 */
export function signOut(): void {
  clearStoredJwt();
  useAppStore.getState().signOut();
}
