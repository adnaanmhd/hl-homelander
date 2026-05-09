/**
 * Versioned MMKV keys. NEVER hardcode a key string in a service — import
 * from here. New keys added in later phases extend this file with the
 * `.v1` (or `.v2` on schema break) suffix per Phase 1 convention.
 *
 * D-STATE-01.
 */
export const KEYS = {
  AUTH_JWT: 'auth.jwt.v1',
  ONBOARDING_CONSENT: 'onboarding.consent.v1',
  ONBOARDING_PERMS_GRANTED: 'onboarding.permsGranted.v1',
  ONBOARDING_COMPAT_PASSED: 'onboarding.compatPassed.v1',
  ONBOARDING_TUTORIAL_DONE: 'onboarding.tutorialDone.v1',
  INSTALLATION_ID: 'installation_id.v1',
  COMPAT_LAST_RESULT: 'compat.lastResult.v1',
  APP_VERSION_CACHE: 'appVersion.cache.v1',
  TELEMETRY_RING: 'telemetry.ring.v1',
} as const;

/**
 * Per-version dismiss key for the soft-upgrade banner (D-UPG-05).
 * Pattern: `appVersion.softBannerDismissed.{latest}` (e.g., 1.6.2).
 */
export function softBannerDismissKey(latest: string): string {
  return `appVersion.softBannerDismissed.${latest}`;
}
