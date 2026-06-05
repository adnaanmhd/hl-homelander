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
import {
  HumynUpload,
  onUploadProgress,
  onUploadQueueChanged,
  type UploadProgressEvent,
  type UploadQueueRow,
} from '../native/HumynUpload';
import { useAppStore } from '../state/appStore';

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

  return () => {
    queueSub?.remove();
    progressSub?.remove();
  };
}

export default installUploadQueueStore;
