// API error-code → i18n toast-key map per D-34 / SPEC I18N-08.
//
// The server-side `code` field on RFC 7807 error responses gets translated
// to a localized toast string on the client via this map. The raw English
// `detail` field stays English and is logged to Crashlytics breadcrumb at
// the API-error call site (D-35) — the user never sees it. Unknown codes
// resolve to the generic translated key so the user always sees a
// localized message.
//
// Keys MUST match the structure shipped in `apps/mobile/src/i18n/locales/en.json`
// (plan 07-01's en.json skeleton). The errorMap.test.ts cross-validates
// every value against an inline snapshot of the en.json shape; plan 07-05
// adds the runtime cross-validation against the real, populated catalog.
//
// Wire-up to actual toast call sites lives in plan 07-05. This plan ships
// the map + helper only.

export const GENERIC_ERROR_KEY = 'errors.generic';

/**
 * API error-code → translated i18n-key lookup. Add a new entry here when a
 * new server-side `code` enum value needs a translated toast surface.
 * Unknown codes fall through to `GENERIC_ERROR_KEY` via `toastKeyForCode`.
 *
 * Keys must exist in `apps/mobile/src/i18n/locales/en.json` (and, after
 * plan 07-02 catalog regen, in each non-English locale JSON too).
 */
export const ERROR_TOAST_KEYS: Record<string, string> = {
  // Auth (Phase 1 + Phase 2 sign-in flow)
  AUTH_INVALID_TOKEN: 'errors.auth.invalidToken',
  AUTH_EXPIRED_TOKEN: 'errors.auth.expiredToken',
  AUTH_GOOGLE_FAILED: 'errors.auth.googleFailed',

  // Upload (Phase 5; FRAUD-05 daily quota was descoped to §v2 on 2026-05-12
  // but the key is kept defensively in case the cap is re-promoted from v2)
  UPLOAD_QUOTA_EXCEEDED: 'errors.upload.quotaExceeded',
  UPLOAD_NETWORK_LOST: 'errors.upload.networkLost',

  // Recording (Phase 4)
  RECORDING_TOO_SHORT: 'errors.recording.tooShort',

  // Compat (Phase 2 device-compat probe)
  COMPAT_FAILED: 'errors.compat.failed',
};

/**
 * Resolve an API error `code` to a translated i18n key.
 * Returns `GENERIC_ERROR_KEY` for null/undefined/empty/unknown codes so the
 * caller can always render *some* localized toast.
 */
export function toastKeyForCode(code: string | null | undefined): string {
  if (!code) return GENERIC_ERROR_KEY;
  return ERROR_TOAST_KEYS[code] ?? GENERIC_ERROR_KEY;
}
