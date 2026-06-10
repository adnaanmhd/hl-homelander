// Phase 2 item 2 (2026-06-10, Bug 3) — pre-recording session check.
//
// The single-device eviction is pull-based (no FCM — LOCKED): an evicted
// device only learns it was evicted when it makes an authed call. Without this
// check, a user could record a full 10-minute segment whose upload can never
// succeed (every /recordings/init 401s). RecordingScreen fires this once at
// mount (the pre-record surface — 'rotate-prompt'/'ready', before the hand
// gate / HumynCapture.start()):
//
//   - a definitive 401 → blocked. The eviction slugs (device-evicted /
//     reauth-required) are already routed through the eviction UX inside the
//     API client (maybeHandleEviction → notifyDeviceEvicted +
//     resetToOnboarding, which unmounts this screen); a plain 401 without a
//     slug gets the same re-sign-in UX via applyDeviceEviction('reauth').
//   - ANY other failure (offline, timeout, 5xx) → proceed. Offline capture
//     stays legal — the upload queue holds until connectivity returns.

import { apiClient, applyDeviceEviction } from './api';

/** Short timeout — this is a liveness probe, never a UX-blocking fetch. */
const SESSION_CHECK_TIMEOUT_MS = 5_000;

/**
 * Returns `false` when the session is definitively dead (401 — the eviction
 * UX has been triggered); `true` otherwise (healthy OR indeterminate).
 * Never throws.
 */
export async function preRecordSessionCheck(): Promise<boolean> {
  try {
    await apiClient.get('/me', { timeoutMs: SESSION_CHECK_TIMEOUT_MS });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // apiClient throws `GET /me failed: <status> <body>` on non-2xx. Only a
    // definitive 401 blocks; the eviction-slug variants already fired
    // maybeHandleEviction inside the client (applyDeviceEviction is
    // idempotent — guarded on deviceEvicted — so re-applying is safe and
    // covers the slug-less 401 shape).
    if (/failed: 401/.test(msg)) {
      applyDeviceEviction('reauth');
      return false;
    }
    return true;
  }
}
