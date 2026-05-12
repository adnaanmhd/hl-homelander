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
  // Plan 05-07 (UP-09) — the first-upload battery-optimization walkthrough.
  // `..._SHOWN` is set once the user dismisses the screen; `..._VERSION` records
  // the app version it was last shown for, so a force-upgrade re-shows it (MIUI
  // may revert the exemption on an app update — idea-brief.md §7.4).
  UPLOAD_FIRST_PROMPT_SHOWN: 'upload.firstPromptShown.v1',
  UPLOAD_FIRST_PROMPT_VERSION: 'upload.firstPromptVersion.v1',
  // Plan 05-08 (VERIFY-06 / UP-14/15/16) — the `_events`-envelope + reconcile sweep.
  // `..._RECONCILE_CURSOR` is the `verified-ids` pagination cursor (opaque server token);
  // `..._PROCESSED_EVENTS` is a JSON array of `${recording_id}:${event_type}` keys the
  // client has already acted on (FIFO-trimmed) so a redelivered `_events` row is a no-op
  // (T-5-08-01). Both live on the SHARED encrypted MMKV instance (D-STATE-01 — no new instance).
  UPLOAD_RECONCILE_CURSOR: 'upload.reconcileCursor.v1',
  UPLOAD_PROCESSED_EVENTS: 'upload.processedEvents.v1',
} as const;

/**
 * Per-version dismiss key for the soft-upgrade banner (D-UPG-05).
 * Pattern: `appVersion.softBannerDismissed.{latest}` (e.g., 1.6.2).
 */
export function softBannerDismissKey(latest: string): string {
  return `appVersion.softBannerDismissed.${latest}`;
}

/**
 * Per-Google-account practice-tutorial completion flag (ONB-08, D-NAV-04).
 * Pattern: `tutorial.practice_done.{googleAccountSub}.v1`. Written by
 * PracticeCompleteScreen.Continue (plan 04-06) via appStore.setPracticeDone(sub);
 * read by computeInitialRoute at boot. Reinstall wipes MMKV → tutorial re-runs.
 * An empty sub still produces a deterministic key (`tutorial.practice_done..v1`)
 * — never throws; mirrors the decodeGoogleSubFromJwt-returns-'' no-soft-lock
 * contract.
 */
export function practiceDoneKey(sub: string): string {
  return `tutorial.practice_done.${sub}.v1`;
}
