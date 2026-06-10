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
import { KEYS, practiceDoneKey } from '../state/keys';
import { useAppStore } from '../state/appStore';
import { apiClient } from './api';
import { getInstallationId } from './installationId';

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
    // Bug 5 / D7 — practice-tutorial completion timestamp (or null) from the server.
    practiceCompletedAt: string | null;
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
 * Steps 1–3 of the handshake: acquire the Google ID token + a server nonce +
 * the Play Integrity token bound to it (or the BYPASS_AUTH mocks). Shared by
 * [signInWithGoogle] and [silentReauth] (review extraction 2026-06-10 — the
 * two verbatim copies were a drift hazard); only the Google-token SOURCE
 * differs, injected via `getGoogleIdToken`. A `null` from the getter means
 * "no credential available" → returns null (the silent path's soft failure;
 * the interactive getter throws instead).
 */
async function acquireHandshakeInputs(
  getGoogleIdToken: () => Promise<string | null>,
): Promise<{ googleIdToken: string; integrityToken: string; nonceId: string } | null> {
  if (Config['BYPASS_AUTH'] === 'true') {
    const nonceRes = await apiClient.postNoBody<NonceResponse>('/auth/nonce');
    return {
      googleIdToken: 'mock-google-token',
      integrityToken: 'mock-integrity-token',
      nonceId: nonceRes.nonceId,
    };
  }
  const googleIdToken = await getGoogleIdToken();
  if (!googleIdToken) return null;
  // Mint a server-side single-use nonce, then a Play Integrity token bound to it.
  const nonceRes = await apiClient.postNoBody<NonceResponse>('/auth/nonce');
  const integrityToken = await requestIntegrityToken(nonceRes.nonce);
  return { googleIdToken, integrityToken, nonceId: nonceRes.nonceId };
}

/**
 * Step 4 + 5 of the handshake: POST /auth/google (Bug 4 / D2 — carries the
 * stable per-install id; `silent: true` marks a machine-initiated re-auth the
 * server must never rebind/create/stamp-consent from — review fix 2026-06-10)
 * and validate the minted JWT carries the build's (flavor, applicationId)
 * (D-AUTH-05 belt-and-suspenders). Throws on any failure.
 */
async function postAuthGoogle(
  inputs: { googleIdToken: string; integrityToken: string; nonceId: string },
  opts: { silent: boolean },
): Promise<AuthGoogleResponse> {
  const { flavor, applicationId } = getFlavorContext();
  const installationId = await getInstallationId();
  const authRes = await apiClient.post<AuthGoogleResponse>('/auth/google', {
    googleIdToken: inputs.googleIdToken,
    integrityToken: inputs.integrityToken,
    flavor,
    applicationId,
    nonceId: inputs.nonceId,
    installationId,
    ...(opts.silent ? { silent: true } : {}),
  });
  const payload = decodeJwtPayload(authRes.jwt);
  if (payload.flavor !== flavor) {
    throw new Error(`jwt_flavor_mismatch: expected ${flavor}, got ${payload.flavor}`);
  }
  if (payload.applicationId !== applicationId) {
    throw new Error(
      `jwt_applicationId_mismatch: expected ${applicationId}, got ${payload.applicationId}`,
    );
  }
  return authRes;
}

/**
 * Runs the full Phase 1 sign-in handshake. Returns the JWT + minimal user
 * profile on success; throws with a descriptive message on any failure.
 */
export async function signInWithGoogle(): Promise<AuthSuccess> {
  // 1. Google Sign-In via Credential Manager (interactive — throws rather
  //    than soft-failing, so the null branch below is unreachable).
  const inputs = await acquireHandshakeInputs(async () => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResponse = await GoogleSignin.signIn();
    if (signInResponse.type !== 'success') {
      throw new Error('google_sign_in_cancelled');
    }
    const token = signInResponse.data.idToken;
    if (!token) {
      throw new Error('google_sign_in_no_id_token');
    }
    return token;
  });
  if (!inputs) {
    throw new Error('google_sign_in_no_id_token');
  }

  // 4. POST /auth/google + validate the minted JWT (D-AUTH-05). Bug 4 / D2 —
  //    the body carries the stable per-install id so the server binds the
  //    account to THIS device (newest-login-wins); a later sign-in on another
  //    device evicts this one (next authed request 401s `device-evicted`).
  const authRes = await postAuthGoogle(inputs, { silent: false });

  // 6. Store JWT — MMKV with encryption flag (instance-level encryptionKey
  //    on the singleton). Key prefix `auth.jwt.v1` is versioned for kill-switch.
  mmkv.set(KEYS.AUTH_JWT, authRes.jwt);

  // 6b. Bug 5 / D7 — seed the local ONB-08 practice-done flag from the server's
  //     practice_completed_at at sign-in (deterministic; no /me round-trip). A
  //     returning user whose account already finished practice then skips the
  //     tutorial on this device's FIRST launch (CompatPass → MainTabs;
  //     computeInitialRoute reads the same flag on later boots). `payload.sub`
  //     is the JWT `sub` (user ULID) — identical to the key computeInitialRoute /
  //     PracticeCompleteScreen derive via decodeGoogleSubFromJwt. Best-effort.
  if (authRes.user.practiceCompletedAt) {
    try {
      mmkv.set(practiceDoneKey(decodeJwtPayload(authRes.jwt).sub), true);
    } catch {
      /* best-effort seed — must never break sign-in */
    }
  }

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

/**
 * Phase 1 (2026-06-10) — NON-interactive re-auth for the upload pipeline's
 * `onUploadAuthFailure` listener (plain token expiry, NOT eviction). Runs the
 * same handshake as [signInWithGoogle] (shared helpers) but sources the
 * Google ID token from `GoogleSignin.signInSilently()` — no UI is ever shown
 * — and POSTs `silent: true` (review fix 2026-06-10): the server refuses to
 * rebind the single-device binding from a machine-initiated re-auth, so a
 * drawer phone's background drain can never evict the phone the user is
 * actively using; a divergent binding comes back 401 `device-evicted`, which
 * `maybeHandleEviction` inside the API client routes to the eviction UX.
 * On success the fresh JWT lands in MMKV AND the app store (`setJwt` writes
 * through), which fires `uploadReconcile`'s jwt-change subscription →
 * context re-push + auth-resume (never the recording pause — UP-10). Returns
 * `false` on ANY failure (no saved credential, offline, integrity failure,
 * eviction) — never throws, never shows UI.
 */
export async function silentReauth(): Promise<boolean> {
  try {
    const inputs = await acquireHandshakeInputs(async () => {
      const silent = await GoogleSignin.signInSilently();
      return silent.type === 'success' ? (silent.data.idToken ?? null) : null;
    });
    if (!inputs) return false;

    const authRes = await postAuthGoogle(inputs, { silent: true });

    // setJwt writes through to MMKV AND updates the store slice — the latter
    // is what re-pushes the upload context + auth-resumes the queue (the
    // uploadReconcile jwt-change subscription).
    useAppStore.getState().setJwt(authRes.jwt);
    return true;
  } catch {
    return false;
  }
}

export function getStoredJwt(): string | undefined {
  return mmkv.getString(KEYS.AUTH_JWT);
}

export function clearStoredJwt(): void {
  mmkv.remove(KEYS.AUTH_JWT);
}

/**
 * Logout helper — clears the local JWT plus user-bound onboarding flags and
 * resets the in-memory auth slice. AUTH-08 client surface.
 *
 * Cleared (user-bound state):
 *   - auth.jwt.v1                  (the JWT itself)
 *   - onboarding.consent.v1        (per-user consent record)
 *   - onboarding.permsGranted.v1   (per-user permission grant log)
 *   - onboarding.compatPassed.v1   (compat-pass summary; the next user
 *                                   re-enters the gate-decision tree)
 *   - onboarding.tutorialDone.v1   (per-user tutorial completion flag)
 *
 * PRESERVED (device-bound state — survives logout/re-login on same device):
 *   - compat.lastResult.v1   — the full CompatResult signature embeds the
 *     device installation_id (per CONTEXT decisions); a same-device re-login
 *     should NOT have to re-run the 30-second compat probe.
 *   - installation_id.v1     — anchors compat.signature; rotating it would
 *     invalidate every persisted compat result on the device.
 *   - telemetry.ring.v1      — diagnostic ring buffer is device-scoped.
 *   - appVersion.cache.v1    — soft-upgrade cache is device-scoped.
 *
 * Defense-in-depth: useAppStore.signOut() also wipes the in-memory `jwt`
 * slice + writes through to MMKV via the same singleton; explicit deletes
 * here keep auth.ts self-sufficient if the store-side persistence model
 * changes later.
 *
 * NOTE: Phase 5 will extend signOut to cancel in-flight uploads and preserve
 * the upload queue for resume-on-re-login (idea-brief.md §10 "Logout while
 * uploads pending"). The seam below is documented so plan 02-21's phase gate
 * doesn't re-litigate.
 */
export function signOut(): void {
  // User-bound: JWT.
  mmkv.remove(KEYS.AUTH_JWT);
  // User-bound: onboarding flags. Cleared so the next user goes through
  // Signup → Permissions → Compat (gate-decision tree, plan 02-05/16).
  mmkv.remove(KEYS.ONBOARDING_CONSENT);
  mmkv.remove(KEYS.ONBOARDING_PERMS_GRANTED);
  mmkv.remove(KEYS.ONBOARDING_COMPAT_PASSED);
  mmkv.remove(KEYS.ONBOARDING_TUTORIAL_DONE);
  // Device-bound state (compat.lastResult.v1, installation_id.v1,
  // telemetry.ring.v1, appVersion.cache.v1) is intentionally preserved.
  // TODO Phase 5: cancelInFlightUpload(); preserveQueueForResumeOnReLogin();
  useAppStore.getState().signOut();
}
