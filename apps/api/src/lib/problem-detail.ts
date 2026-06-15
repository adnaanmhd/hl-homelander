// RFC 7807 problem-detail shape — wire contract. Stable forever.
// Type URIs live under https://humyn-app.io/problems/<slug>. The slug is the
// wire identifier the mobile client switches on, so do NOT rename slugs once shipped.

export const PROBLEM_TYPE_BASE = 'https://humyn-app.io/problems/' as const;

export interface ProblemDetail {
  type: string; // URI under PROBLEM_TYPE_BASE
  title: string; // short, human-readable
  status: number; // HTTP status code
  detail?: string; // additional context
  instance?: string; // request id / request path
  // Extension members (RFC 7807 §3.2 allows arbitrary extensions)
  [key: string]: unknown;
}

export function buildProblemDetail(opts: {
  slug: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}): ProblemDetail {
  return {
    type: `${PROBLEM_TYPE_BASE}${opts.slug}`,
    title: opts.title,
    status: opts.status,
    ...(opts.detail !== undefined ? { detail: opts.detail } : {}),
    ...(opts.instance !== undefined ? { instance: opts.instance } : {}),
    ...(opts.extensions ?? {}),
  };
}

// Canonical slugs used across plans 05-12. Adding a slug here = adding a wire-
// side error type. Removing/renaming = breaking the wire contract.
export const PROBLEM_SLUGS = {
  validation: 'validation',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not-found',
  conflict: 'conflict',
  rateLimited: 'rate-limited',
  idempotencyKeyInvalid: 'idempotency-key-invalid',
  idempotencyKeyConflict: 'idempotency-key-conflict',
  internal: 'internal',
  // Auth — used by plan 05
  integrityRooted: 'integrity-rooted',
  integrityEmulator: 'integrity-emulator',
  integrityInstallSource: 'integrity-install-source',
  integrityNonce: 'integrity-nonce',
  integrityStale: 'integrity-stale',
  // Auth — W6 (plan 05 task 4): iosAppStore Phase-1 reject (App Attest in Phase 7)
  integrityFlavorNotSupported: 'integrity-flavor-not-supported',
  // Auth — Bug 4 / D2 (2026-06-04): account used on a newer device; this device's
  // JWT installationId no longer matches users.current_installation_id. The
  // client maps this slug to a "signed out — used on another device" Signup msg.
  deviceEvicted: 'device-evicted',
  // Auth — Bug 4 / D2 follow-up: a legacy / pre-Bug-4 JWT carrying NO
  // installationId claim (or an unbound row) is NOT an eviction — the user just
  // needs to re-sign-in once so a claim-bearing JWT is minted. Distinct slug so
  // the client shows "please sign in again" rather than the misleading "used on
  // another device" eviction copy.
  reauthRequired: 'reauth-required',
  // Recordings — plan 01-07 task 4 (API-08 + API-09)
  recordingNotFound: 'recording-not-found',
  recordingNotPlayable: 'recording-not-playable',
} as const;
