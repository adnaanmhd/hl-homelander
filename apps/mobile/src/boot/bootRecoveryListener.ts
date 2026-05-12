// bootRecoveryListener — D-LIFE-04 one-shot crash-recovery toast (plan 04-10;
// hardened 2026-05-12 Phase-4 smoke bug 3(a)).
//
// When Phase 3's app-launch sweep (`CaptureLaunchSweep`) finds orphan segments
// with valid `.session.json` sidecars after a force-quit / OS-evict and
// re-finalizes them into usable `{base}.{mp4,csv,json}` triples, the native
// side both (a) emits a one-shot `onCrashRecovery({ recovered: string[] })`
// event and (b) exposes the same list synchronously via
// `HumynCapture.getPendingRecovery()`. This listener, installed once at app
// boot (App.tsx, right after `hydrate()`):
//   1. queries `getPendingRecovery()` immediately (the reliable channel — no
//      dependence on the fragile native-module-construction ↔ JS-subscribe ↔
//      first-onHostResume timing window that left the toast silently missing
//      on the on-hardware smoke walk);
//   2. ALSO subscribes to `onCrashRecovery` (legacy / belt-and-suspenders);
//   3. shows the Home toast "Recording recovered after force-quit — uploading."
//      the first time either channel reports `recovered.length > 0`, then
//      ignores any further reports (one-shot per app launch — `delivered` flag).
//
// The recovered segments go through the NORMAL upload path (Phase 5 — NOT
// Phase 4). RecordingScreen is not shown during recovery; the user sees the
// recording arrive in History (Phase 6).
//
// Security (Pattern 6 — "crash-recovery payload trusted blindly"): the
// `recovered` payload is validated to be a `string[]` (`Array.isArray` +
// `every(typeof === 'string')`) before the toast fires — don't trust the
// payload shape blindly even though it crosses an app-internal boundary.
//
// Everything is wrapped in try/catch / `.catch()`: in a test / JSDOM env where
// `NativeModules.HumynCapture` isn't registered the native calls throw the
// canonical "not registered" error — swallow so app boot never crashes on the
// recovery wiring. The native-driven path is only live on a real device.

import * as HumynCapture from '../native/HumynCapture';
import { showToast } from '../components/Toast';

/** The exact Home-toast copy fired when recovery happened (D-LIFE-04 / REC-12). */
export const CRASH_RECOVERY_TOAST = 'Recording recovered after force-quit — uploading.';

// 5s is intentional (Phase-5 D-07). Do NOT re-bump to 15s — that was a smoke-walk
// workaround so the pill spanned the splash bootstrap. At 5s the pill displays
// during the splash bootstrap and will likely fade before Home renders; that is
// the pre-workaround behavior and is acceptable ("no Home toast" was an
// observation, not a bug). The proper fix (stash the recovered list + trigger
// the toast from post-bootstrap / Home mount) is explicitly rejected for MVP.
//
// As of Phase-5 D-03, CaptureLaunchSweep never re-finalizes a crash orphan — all
// crash-truncated fragments are discarded — so getPendingRecovery()/onCrashRecovery
// never report a non-empty list and this toast is effectively dead code. It is
// kept wired as a safety net in case some future recovery path produces an
// upload-able recovered segment.
/** How long the recovery toast stays up. It fires from App.tsx's mount effect —
 *  i.e. while the SplashScreen route is still doing its bootstrap. `<ToastHost />`
 *  is a sibling of the navigator so the pill persists across the splash → Home
 *  transition. */
const RECOVERY_TOAST_MS = 5_000;

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

/**
 * Install the one-shot crash-recovery boot listener. Call once at app boot
 * (App.tsx, after `hydrate()`). Returns a teardown that removes the event
 * subscription (rarely needed — the listener self-removes after the first
 * delivery — but useful for tests / hot-reload hygiene).
 */
export function installBootRecoveryListener(): () => void {
  let delivered = false;
  let sub: { remove: () => void } | null = null;

  const deliver = (recovered: unknown): void => {
    if (delivered) return;
    if (isStringArray(recovered) && recovered.length > 0) {
      delivered = true;
      showToast(CRASH_RECOVERY_TOAST, RECOVERY_TOAST_MS);
      // Now that the toast has shown, drop the event subscription so a
      // redundant `onCrashRecovery` emit (the two channels read the same
      // native holder) doesn't re-toast. An EMPTY report from one channel
      // does NOT remove the sub — the other channel is still the fallback.
      sub?.remove();
      sub = null;
    }
  };

  // Channel 1 — synchronous query (reliable; no boot-timing race).
  HumynCapture.getPendingRecovery()
    .then((r) => deliver(r?.recovered))
    .catch(() => undefined);

  // Channel 2 — the one-shot event (legacy; harmless if the holder is already drained).
  try {
    sub = HumynCapture.onCrashRecovery(({ recovered }) => deliver(recovered));
  } catch {
    // HumynCapture native module not registered (JSDOM / a build without it) —
    // recovery wiring is best-effort; never crash boot.
    sub = null;
  }

  return () => {
    sub?.remove();
    sub = null;
  };
}

export default installBootRecoveryListener;
