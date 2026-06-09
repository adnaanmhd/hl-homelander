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
  // (BUG-5, 2026-06-09 — UPLOAD_FIRST_PROMPT_SHOWN/_VERSION removed with the
  // standalone first-upload battery-optimization modal; the exemption ask moved
  // to onboarding/PermissionsScreen + the Help Center guide, which don't gate on
  // a per-version "shown" flag.)
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

/**
 * Phase 6 (D-04 / D-05) — per-recording thumbnail-ledger entry key.
 *
 * Pattern: `pendingThumb.{recordingId}.v1` — mirrors `practiceDoneKey(sub)`
 * structurally (per-key stash, version-suffixed for a future schema bump
 * without a runtime migration).
 *
 * **NOT scoped by user `sub`** (RESEARCH Pitfall 8). The `recordingId` IS the
 * natural index AND the server-side `GET /recordings` row is already
 * per-user-authed — double-scoping by sub would leak ledger entries to the
 * next user on logout/login or, worse, vanish them. The truth-source is the
 * server's row; this ledger is an overlay only.
 *
 * Written by the JS-side segment-complete handler (the existing
 * `RecordingScreen.tsx` `onSegmentComplete` listener that already calls
 * `HumynUpload.enqueue(...)` — extended by Plan 06-09); survives the post-
 * `verified` MP4 delete (`clearLocalPath` empties `mp4LocalPath` but
 * preserves `thumbnailPath`); GC'd opportunistically on cold start via
 * `cleanupOpportunistic` (D-04a, best-effort).
 */
export function pendingThumbKey(recordingId: string): string {
  return `pendingThumb.${recordingId}.v1`;
}
