// uploadQueueStore — the single app-lifetime upload-queue → Zustand bridge
// (Bug 7 + Bug 11, 2026-06-04).
//
// Replaces the three per-screen `onUploadQueueChanged` / `onUploadProgress`
// subscriptions (History / Home / PendingUploads) with ONE subscription
// installed at boot, next to `installUploadReconcile()` in App.tsx. The native
// `emitQueueChanged()` is a fire-and-forget event with no buffering, so a
// listener that only exists once its screen is focused (History is lazy-mounted
// + frozen-on-blur in the bottom-tab navigator) MISSES every enqueue that fired
// while it was unmounted — that's Bug 7. A boot-installed listener that writes
// into the store (which lives outside the navigator and survives tab
// lazy-mount / freezeOnBlur) fixes it: every screen reads `uploadQueue` from the
// store and re-renders reactively.
//
// What it does:
//   - seed: `getQueueSafe()` → `setUploadQueue(rows)` once (boot-safe — returns
//     [] when the native module is absent / in JSDOM, never throws).
//   - `onUploadQueueChanged(rows)` → `setUploadQueue(rows)` + `bumpContributionsVersion()`
//     (Bug 11 — a queue mutation correlates with the server-side count change at
//     `/recordings/init`; Home + Profile debounce-refetch on the version bump).
//   - `onUploadProgress(e)` → `setUploadProgress(recordingId, pct)` where
//     `pct = bytesUploaded / bytesTotal * 100` (0..100), matching the percent
//     the screens previously computed locally.
//
// Safety (mirrors `uploadReconcile.installUploadReconcile()` /
// `boot/bootRecoveryListener.ts`):
//   - The boot caller in App.tsx wraps this in try/catch, but we ALSO guard each
//     subscribe so a `NativeEventEmitter` construction failure (a build without
//     the native module / JSDOM that doesn't mock it) leaves a usable teardown
//     instead of throwing past the partially-installed listener.
//   - The returned teardown `.remove()`s whatever subscribed (the bridge's
//     "caller MUST .remove()" leak contract).

import type { EmitterSubscription } from 'react-native';
import Config from 'react-native-config';
import {
  HumynUpload,
  onUploadAuthFailure,
  onUploadProgress,
  onUploadQueueChanged,
  type UploadAuthFailureEvent,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../native/HumynUpload';
import { useAppStore } from '../state/appStore';
import { applyDeviceEviction } from './api';
import { silentReauth } from './auth';
import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';

/**
 * Phase 1 (2026-06-10) — marker prefix the native coordinator stamps into
 * `lastFailureReason` when a 401 parks a row (see
 * `UploadCoordinator.AUTH_FAILURE_REASON_PREFIX` — keep in sync). The
 * reconcile sweep skips auto-reviving/draining rows carrying it until a fresh
 * token has been pushed (prevents 401 ping-pong).
 */
export const AUTH_FAILURE_REASON_PREFIX = 'auth: ';

/** Single-flight guard — N parked rows can emit N auth events in one drain tick. */
let authFailureHandling = false;

/**
 * Phase 1 (2026-06-10) — dispatch a native `onUploadAuthFailure` event.
 * Exported for tests.
 *
 *  - `device-evicted` / `reauth-required` → the EXACT `maybeHandleEviction`
 *    behavior (`services/api.ts`): clear session + eviction notice + Signup.
 *  - anything else (plain expiry / unparseable body) → attempt a silent Google
 *    re-auth; on success push the fresh JWT to the native coordinator and
 *    `resume()` the (auth-paused) queue. On failure leave the queue paused —
 *    the next sign-in or process restart recovers it.
 */
export async function handleUploadAuthFailure(slug: string): Promise<void> {
  if (authFailureHandling) return;
  authFailureHandling = true;
  try {
    if (slug === 'device-evicted' || slug === 'reauth-required') {
      applyDeviceEviction(slug === 'device-evicted' ? 'evicted' : 'reauth');
      return;
    }
    const ok = await silentReauth().catch(() => false);
    if (!ok) return;
    // silentReauth's setJwt already triggers uploadReconcile's jwt-change
    // subscription (context push + resume), but that subscription only exists
    // when installUploadReconcile ran — push + resume here too (idempotent).
    const baseUrl = Config.API_BASE_URL;
    if (baseUrl) {
      const jwt = secureMmkv.getString(KEYS.AUTH_JWT) ?? null;
      await HumynUpload.setUploadContextSafe(baseUrl, jwt, decodeGoogleSubFromJwt(jwt));
    }
    try {
      await HumynUpload.resume();
    } catch {
      /* no native module — non-fatal */
    }
  } finally {
    authFailureHandling = false;
  }
}

/**
 * Install the single upload-queue → store bridge. Call once at app boot
 * (App.tsx, beside `installUploadReconcile()` — wrap in try/catch there so a
 * build without `HumynUpload` / JSDOM never crashes boot). Seeds the store from
 * `getQueueSafe()`, subscribes to queue + progress events, and returns a
 * teardown that removes both subscriptions.
 */
export function installUploadQueueStore(): () => void {
  // Guard the seed against the boot-time race: the async `getQueueSafe()` reads
  // a snapshot, but an `onUploadQueueChanged` event can fire (with a FRESHER
  // queue) before that promise resolves. Without the flag the slow seed `.then`
  // would overwrite the fresh event payload with the stale boot snapshot (a
  // just-enqueued row would vanish until the next mutation). Whoever writes the
  // queue first sets `seeded`; the seed then no-ops if an event already won.
  let seeded = false;

  // Seed once. getQueueSafe never throws (returns [] when the module is absent).
  void HumynUpload.getQueueSafe()
    .then((rows: UploadQueueRow[]) => {
      if (seeded) return; // a live event already applied a fresher snapshot
      seeded = true;
      useAppStore.getState().setUploadQueue(rows);
    })
    .catch(() => undefined);

  let queueSub: EmitterSubscription | undefined;
  let progressSub: EmitterSubscription | undefined;
  let authSub: EmitterSubscription | undefined;

  try {
    queueSub = onUploadQueueChanged((rows: UploadQueueRow[]) => {
      seeded = true; // events are the live source — supersede the boot seed
      const s = useAppStore.getState();
      s.setUploadQueue(rows);
      // Bump on every queue mutation — fires a handful of times per recording;
      // Home + Profile debounce the resulting contributions refetch (Bug 11).
      s.bumpContributionsVersion();
    });
  } catch {
    /* no native module / JSDOM — non-fatal; the store keeps its seeded value */
  }

  try {
    progressSub = onUploadProgress((e: UploadProgressEvent) => {
      const pct = e.bytesTotal > 0 ? (e.bytesUploaded / e.bytesTotal) * 100 : 0;
      useAppStore.getState().setUploadProgress(e.recordingId, pct);
    });
  } catch {
    /* no native module / JSDOM — non-fatal */
  }

  try {
    // Phase 1 (2026-06-10) — the coordinator paused the queue on a 401.
    // Either run the eviction UX or silently re-auth + resume.
    authSub = onUploadAuthFailure((e: UploadAuthFailureEvent) => {
      void handleUploadAuthFailure(e.slug).catch(() => undefined);
    });
  } catch {
    /* no native module / JSDOM — non-fatal */
  }

  return () => {
    queueSub?.remove();
    progressSub?.remove();
    authSub?.remove();
  };
}

export default installUploadQueueStore;
