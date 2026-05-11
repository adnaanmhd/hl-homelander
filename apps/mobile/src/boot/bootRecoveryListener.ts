// bootRecoveryListener — D-LIFE-04 one-shot crash-recovery toast (plan 04-10).
//
// When Phase 3's app-launch sweep (`CaptureLaunchSweep`) finds orphan segments
// with valid `.session.json` sidecars after a force-quit / OS-evict, the native
// side emits `onCrashRecovery({ recovered: string[] })` once. This listener,
// installed once at app boot (App.tsx, right after `hydrate()`), subscribes,
// shows the Home toast "Recording recovered after force-quit — uploading." when
// `recovered.length > 0`, and then `.remove()`s the subscription — one-shot per
// app launch.
//
// The recovered segments go through the NORMAL upload path (Phase 5 — NOT Phase
// 4). RecordingScreen is not shown during recovery; the user sees the recording
// arrive in History (Phase 6).
//
// Security (Pattern 6 — "crash-recovery payload trusted blindly"): the
// `recovered` payload is validated to be a `string[]` (`Array.isArray` +
// `every(typeof === 'string')`) before the toast fires — don't trust the
// payload shape blindly even though it crosses an app-internal boundary.
//
// The whole subscribe is wrapped in try/catch: in a test / JSDOM env where
// `NativeModules.HumynCapture` isn't registered, `HumynCapture.onCrashRecovery`
// throws (the canonical "not registered" error) — swallow it so app boot never
// crashes on the recovery wiring. The `emitEvent`-driven path is only live on a
// real device with the native module present.

import * as HumynCapture from '../native/HumynCapture';
import { showToast } from '../components/Toast';

/** The exact Home-toast copy fired when recovery happened (D-LIFE-04 / REC-12). */
export const CRASH_RECOVERY_TOAST = 'Recording recovered after force-quit — uploading.';

/**
 * Install the one-shot crash-recovery boot listener. Call once at app boot
 * (App.tsx, after `hydrate()`). Returns a teardown that removes the
 * subscription (rarely needed — the listener self-removes after the first
 * fire — but useful for tests / hot-reload hygiene).
 */
export function installBootRecoveryListener(): () => void {
  let sub: { remove: () => void } | null = null;
  try {
    sub = HumynCapture.onCrashRecovery(({ recovered }) => {
      // Security V-trusted-blindly: validate the payload is string[].
      const ok =
        Array.isArray(recovered) &&
        recovered.length > 0 &&
        recovered.every((x) => typeof x === 'string');
      if (ok) {
        showToast(CRASH_RECOVERY_TOAST);
      }
      // One-shot per app launch — drop the subscription after the first fire
      // regardless of whether the payload was valid (a second emit shouldn't
      // re-toast).
      sub?.remove();
      sub = null;
    });
  } catch {
    // HumynCapture native module not registered (JSDOM / a build without the
    // module) — recovery wiring is best-effort; never crash boot.
    sub = null;
  }
  return () => {
    sub?.remove();
    sub = null;
  };
}

export default installBootRecoveryListener;
