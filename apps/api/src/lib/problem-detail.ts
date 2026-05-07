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
} as const;
