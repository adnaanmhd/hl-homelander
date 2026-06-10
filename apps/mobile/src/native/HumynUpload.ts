/**
 * Typed JS bridge for the `HumynUpload` native module — the control surface for
 * the Phase-5 background upload pipeline.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/
 * HumynUploadModule.kt (and the `UploadRow` / `PartState` schema in
 * UploadModels.kt). Shape parity with the canonical `HumynBattery.ts` /
 * `HumynCapture.ts` pattern — same `ensure()` guard, same canonical "not
 * registered" error, same lazy `NativeEventEmitter` + `on*(listener):
 * EmitterSubscription` convention, plus a `getQueueSafe()` boot-time variant
 * so the reconcile sweep (Plan 05-08) / JSDOM tests don't crash on a missing
 * module.
 *
 * **Subscription leak warning:** `onUploadQueueChanged(listener)` /
 * `onUploadProgress(listener)` return the `EmitterSubscription` from
 * `NativeEventEmitter.addListener`. Callers MUST `.remove()` it on unmount or
 * the listener leaks.
 *
 * Plan 05-04 ships this bridge surface + the native module's enqueue/pause/
 * resume/getQueue/clearUploaded + the durable queue store. The actual /init →
 * PUT → /finalize transfer engine (`ChunkUploader` / `UploadCoordinator`) is
 * Plan 05-06; the FGS + OEM-walkthrough are Plan 05-07; the boot reconcile
 * sweep is Plan 05-08.
 *
 * 2026-05-18 — debug session `.planning/debug/upload-queue-hol-finalizing.md`
 * (Fix C) added the `'needs-attention'` row state + the [retryNeedsAttention]
 * native method (manual retry of a NEEDS_ATTENTION row from the History UI).
 */
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';

/** One S3 multipart part — number (1-based), status, ETag (once done), retry count. */
export type UploadPartState = {
  n: number;
  status: 'pending' | 'done' | 'failed';
  etag?: string;
  retryCount: number;
};

/** One upload-queue row — mirrors `UploadRow` in UploadModels.kt. */
export type UploadQueueRow = {
  recordingId: string;
  /** The signed-in `sub` when the recording was finalized (UP-13 owner-pin). */
  ownerUserId: string;
  mp4Path: string;
  csvPath: string;
  jsonPath: string;
  taskId: string;
  isPractice: boolean;
  /**
   * The row's lifecycle state. `'needs-attention'` was added 2026-05-18 by
   * debug session `.planning/debug/upload-queue-hol-finalizing.md` (Fix C
   * item 4) — terminal-but-recoverable: automatic retries gave up after
   * [UploadCoordinator.NEEDS_ATTENTION_THRESHOLD] failed attempts; the user
   * can manually retry via [HumynUpload.retryNeedsAttention]. Distinct from
   * `'dead-letter'` (permanent server-rejection like 409 / 403 / missing
   * bundle file): NEEDS_ATTENTION is the "stuck waiting on a flaky server,
   * ask the user" state.
   */
  state:
    | 'pending'
    | 'uploading'
    | 'finalizing'
    // (Enh 3 / D1, 2026-06-04: 'awaiting-verify' / 'verified' removed. On
    // /finalize 200 the coordinator deletes the local bundle + drops the row —
    // 'uploaded' is terminal success server-side; there's no on-device verify
    // wait state anymore.)
    | 'dead-letter'
    | 'needs-attention';
  uploadId?: string;
  imuUploadId?: string;
  partsCount?: number;
  chunkBytes?: number;
  videoParts: UploadPartState[];
  imuParts: UploadPartState[];
  metadataPut: 'pending' | 'done' | 'failed';
  enqueuedAt: number;
  lastProgressAt: number;
  deadLetterReason?: string;
  /**
   * Recording duration in seconds, surfaced from the bundle's `metadata.json`
   * `duration_seconds` field for the Pending-Uploads row meta line. Optional —
   * the Plan-05-04 native row schema doesn't carry it yet; the Pending-Uploads
   * screen renders a neutral fallback label when it's absent. (Phase-6 follow-on
   * to plumb it through `UploadRow` / `rowToMap`.)
   */
  durationSeconds?: number;
  /**
   * Quick task 260517-p5g CAPTURE-QA-04 / CAPTURE-QA-05 — when set, this row
   * represents a CANCELED segment that must NEVER be rendered as pending
   * upload. The native `UploadQueueStore.enqueue` short-circuits canceled rows
   * before they ever land on disk; the JS-side `PendingUploadsScreen` filters
   * them out as a belt-and-braces backstop (defense-in-depth).
   */
  cancelReason?: 'fps_dropped' | 'resolution_dropped' | 'insufficient_frames';
  /**
   * Debug session `.planning/debug/upload-queue-hol-finalizing.md` (Fix C
   * item 4) — count of automatic recovery attempts the worker has made on
   * this row. Reaches NEEDS_ATTENTION at threshold; reset to 0 on success
   * or manual user retry. Optional — absent on healthy rows.
   */
  attemptCount?: number;
  /**
   * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — wall-clock
   * ms of the last failed automatic recovery attempt. Used by the
   * History-UI Retry button to render "Stuck for 12 min — Retry". Absent on
   * healthy rows.
   */
  lastFailureAt?: number;
  /**
   * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — the row's
   * state name at the moment of the most recent failure (e.g.
   * `"FINALIZING"`). Surfaced for diagnostic display. Absent on healthy
   * rows.
   */
  lastFailureState?: string;
  /**
   * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — a short
   * description of the most recent failure mode (e.g.
   * `"finalize timed out after 60s"`). Surfaced in the History-UI Retry
   * label. Absent on healthy rows.
   */
  lastFailureReason?: string;
};

/** Progress tick for one in-flight recording. */
export type UploadProgressEvent = {
  recordingId: string;
  bytesUploaded: number;
  bytesTotal: number;
};

interface HumynUploadNativeModule {
  /**
   * Push the auth context the coordinator needs for `/recordings/init`,
   * `/finalize`, `/reupload` (presigned S3 PUTs carry no bearer): the API base
   * URL, the bearer JWT, and the signed-in `sub`. Call on launch / post-sign-in
   * / on-resume so a JWT refresh is picked up. (Kotlin can't conveniently read
   * the encrypted MMKV, so the JS side injects it — `services/api.ts`'s
   * `API_BASE_URL` + the `AUTH_JWT` MMKV key are the single source.)
   */
  setUploadContext(apiBaseUrl: string, bearerToken: string | null, sub: string): Promise<void>;
  /** Add a recording's bundle to the durable queue. Practice recordings are refused (D-08). */
  enqueue(
    recordingId: string,
    mp4Path: string,
    csvPath: string,
    jsonPath: string,
    taskId: string,
    isPractice: boolean,
    ownerUserId: string,
  ): Promise<void>;
  /** Pause in-flight uploads (UP-10 — HumynCapture.start() calls this). */
  pause(): Promise<void>;
  /** Resume uploads (UP-10 — HumynCapture.stop() calls this). */
  resume(): Promise<void>;
  /** Read all queue rows (the JS side filters to own-rows). Read-only — no abort (UP-11). */
  getQueue(): Promise<UploadQueueRow[]>;
  /**
   * Local-delete on terminal success: unlink each recording's local bundle
   * (mp4/csv/json) + drop the queue row. (Enh 3 / D1, 2026-06-04: renamed from
   * `clearUploaded` — `uploaded` is terminal success now. The coordinator
   * already does this on /finalize 200; this is the reconcile backstop for ids
   * the server reports as terminal-success that still have a local row.)
   */
  clearUploaded(recordingIds: string[]): Promise<void>;
  /**
   * SAFE dead-letter revival primitive — preferred over [reupload] for the
   * cold-start auto-revive sweep + the Home pending-uploads tile tap.
   * Operates ONLY on rows currently in DEAD_LETTER state; no-op for every
   * other state (so a sweep never silently mutates an in-flight row).
   *
   * Performs the LOCAL-RESET branch unconditionally: state → UPLOADING,
   * deadLetterReason cleared; uploadId / imuUploadId / parts / etags / reupload
   * flag are KEPT UNCHANGED. The drainer's `when` then takes either /parts
   * (uploadId set — preserves DONE part ETags, UP-04) or the idempotent /init
   * self-heal (uploadId null — re-presigns against the existing s3UploadId).
   *
   * Closes the FULL-RESET footgun in [reupload]: when called on a row whose
   * `reupload=true` is already set, [reupload] destructively wipes uploadId
   * and every cached part ETag → the drainer pounds /reupload → 409 storm.
   * Trail: `.planning/debug/resolved/uploads-stuck-multi-segment.md`.
   */
  reviveDeadLetter(recordingId: string): Promise<boolean | null>;
  /**
   * Debug session `.planning/debug/upload-queue-hol-finalizing.md` (Fix C
   * item 4) — manually retry a `NEEDS_ATTENTION` row. Resets `attemptCount`
   * + the failure markers, transitions back to UPLOADING / PENDING per the
   * existing `uploadId` shape, and re-kicks the drainer. Resolves `true`
   * if a row matched + was transitioned; `false` for any non-NEEDS_ATTENTION
   * row (so a stale UI tap doesn't silently mutate an in-flight or verified
   * row). Distinct from [reviveDeadLetter] (which targets DEAD_LETTER rows
   * — permanent server-rejection vs. exhausted auto-retry budget).
   */
  retryNeedsAttention(recordingId: string): Promise<boolean>;
  /**
   * Wave-1.5 Item 8 — cold-start drain kick (no unpause). Used by
   * `installUploadReconcile()` on boot: if `getQueueSafe()` returns a row in
   * {PENDING, UPLOADING}, kick the drainer. Distinct from `resume()`: does NOT
   * flip the paused flag (a pause is sticky; a boot-time drain MUST NOT
   * silently unpause). If the coordinator is paused, the drain is a no-op.
   */
  drainNow(): Promise<void>;
  // --- Plan 05-07 — battery-optimization exemption + OEM autostart (UP-09) ---
  /** `true` iff the app is already whitelisted from battery optimizations. */
  isBatteryOptimizationExempt(): Promise<boolean>;
  /** Open the AOSP "allow unrestricted" prompt (falls back to the settings list). */
  requestBatteryOptimizationExemption(): Promise<void>;
  /** `true` if a known OEM "autostart" activity resolves on this device. */
  oemAutostartAvailable(): Promise<boolean>;
  /** Launch the OEM autostart screen if one resolves; resolves `true`/`false` (never crashes). */
  openOemAutostart(): Promise<boolean>;
  /**
   * Plan 06-12 follow-on (Finding 6) — synchronous read of the current
   * connectivity state of the default network. Resolves with `{ online }`
   * where `online` reflects `cm.activeNetwork != null` &&
   * `NET_CAPABILITY_INTERNET`. The companion `onConnectivityChanged` event
   * surfaces every transition.
   */
  getConnectivity(): Promise<{ online: boolean }>;
}

function ensure(): HumynUploadNativeModule {
  const native = NativeModules.HumynUpload as HumynUploadNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynUpload native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * The `HumynUpload` JS facade. `getQueueSafe()` is the boot-time variant —
 * returns `[]` instead of throwing when the module is absent (a build without
 * the native module, a JSDOM test) so the Plan-05-08 reconcile sweep doesn't
 * crash boot.
 */
export const HumynUpload = {
  /** Set the upload coordinator's auth context. Throws if the module is absent. */
  setUploadContext: (apiBaseUrl: string, bearerToken: string | null, sub: string): Promise<void> =>
    ensure().setUploadContext(apiBaseUrl, bearerToken, sub),
  enqueue: (
    recordingId: string,
    mp4Path: string,
    csvPath: string,
    jsonPath: string,
    taskId: string,
    isPractice: boolean,
    ownerUserId: string,
  ): Promise<void> =>
    ensure().enqueue(recordingId, mp4Path, csvPath, jsonPath, taskId, isPractice, ownerUserId),
  pause: (): Promise<void> => ensure().pause(),
  resume: (): Promise<void> => ensure().resume(),
  getQueue: (): Promise<UploadQueueRow[]> => ensure().getQueue(),
  /** Local-delete on terminal success (renamed from clearUploaded, Enh 3 / D1). */
  clearUploaded: (recordingIds: string[]): Promise<void> => ensure().clearUploaded(recordingIds),
  /**
   * SAFE dead-letter revival — only mutates DEAD_LETTER rows; no-op otherwise.
   * Preferred over [reupload] for the cold-start sweep + Home tile tap.
   * Throws if the module is absent — use [reviveDeadLetterSafe] from boot
   * paths (the boot-time variants never throw).
   *
   * Phase 1 (2026-06-10): resolves `true` when a row was actually revived;
   * `null` for the no-op case (missing / non-DEAD_LETTER row) so the History
   * Retry handler can toast "nothing to retry" instead of failing silently.
   */
  reviveDeadLetter: (recordingId: string): Promise<boolean | null> =>
    ensure().reviveDeadLetter(recordingId),
  /**
   * Boot-safe `reviveDeadLetter()` — never throws. Resolves `true` on an
   * actual revive; `null` on a no-op OR when the module is unavailable.
   */
  reviveDeadLetterSafe: async (recordingId: string): Promise<boolean | null> => {
    try {
      return (await ensure().reviveDeadLetter(recordingId)) ?? null;
    } catch {
      /* no native module / JSDOM — non-fatal */
      return null;
    }
  },
  /**
   * Debug session `.planning/debug/upload-queue-hol-finalizing.md` (Fix C item
   * 4) — manually retry a NEEDS_ATTENTION row. Throws if the module is absent
   * (call sites are user-driven taps, so a hard error is the right behavior).
   * Returns `true` if a row matched + was transitioned; `false` otherwise.
   */
  retryNeedsAttention: (recordingId: string): Promise<boolean> =>
    ensure().retryNeedsAttention(recordingId),
  /** Boot-safe `retryNeedsAttention()` — never throws; returns `false` when the module is unavailable. */
  retryNeedsAttentionSafe: async (recordingId: string): Promise<boolean> => {
    try {
      return await ensure().retryNeedsAttention(recordingId);
    } catch {
      return false;
    }
  },
  /**
   * Wave-1.5 Item 8 — kick the drainer (no unpause). Throws if the module is
   * absent. Distinct from `resume()`: does NOT flip the paused flag.
   */
  drainNow: (): Promise<void> => ensure().drainNow(),
  /** Boot-safe `drainNow()` — never throws; no-op when the module is absent. */
  drainNowSafe: async (): Promise<void> => {
    try {
      await ensure().drainNow();
    } catch {
      /* no native module / JSDOM — non-fatal */
    }
  },
  /** Boot-safe `getQueue()` — never throws; `[]` if the module is unavailable. */
  getQueueSafe: async (): Promise<UploadQueueRow[]> => {
    try {
      return await ensure().getQueue();
    } catch {
      return [];
    }
  },

  // --- Plan 05-07 — battery-optimization exemption + OEM autostart (UP-09) ---
  /** Open the AOSP "allow unrestricted battery" prompt. Throws if the module is absent. */
  requestBatteryOptimizationExemption: (): Promise<void> =>
    ensure().requestBatteryOptimizationExemption(),
  /** `true` iff already exempt. Throws if the module is absent. */
  isBatteryOptimizationExempt: (): Promise<boolean> => ensure().isBatteryOptimizationExempt(),
  /** `true` if a known OEM autostart screen resolves on this device. Throws if the module is absent. */
  oemAutostartAvailable: (): Promise<boolean> => ensure().oemAutostartAvailable(),
  /** Launch the OEM autostart screen if one resolves; `true`/`false` (never crashes natively). Throws if the module is absent. */
  openOemAutostart: (): Promise<boolean> => ensure().openOemAutostart(),

  // Boot-/screen-safe variants — never throw (a build without the native module,
  // a JSDOM test, an iOS build where these aren't implemented). Used by the
  // onboarding CompatPassScreen battery ask (relocated from PermissionsScreen
  // in Phase 5, 2026-06-10 — the ask raced the compat camera probes) + the
  // Help Center BatteryOptimizationGuide (BUG-5, 2026-06-09).
  /** Safe: `false` (treat as "not exempt — show the prompt") when the module is unavailable. */
  isBatteryOptimizationExemptSafe: async (): Promise<boolean> => {
    try {
      return await ensure().isBatteryOptimizationExempt();
    } catch {
      return false;
    }
  },
  /** Safe: no-op when the module is unavailable. */
  requestBatteryOptimizationExemptionSafe: async (): Promise<void> => {
    try {
      await ensure().requestBatteryOptimizationExemption();
    } catch {
      /* no native module — nothing to do */
    }
  },
  /** Safe: `false` (don't render the OEM deep-link button) when the module is unavailable. */
  oemAutostartAvailableSafe: async (): Promise<boolean> => {
    try {
      return await ensure().oemAutostartAvailable();
    } catch {
      return false;
    }
  },
  /** Safe: `false` when the module is unavailable. */
  openOemAutostartSafe: async (): Promise<boolean> => {
    try {
      return await ensure().openOemAutostart();
    } catch {
      return false;
    }
  },
  /** Safe: no-op when the module is unavailable (a build without it / JSDOM). */
  setUploadContextSafe: async (
    apiBaseUrl: string,
    bearerToken: string | null,
    sub: string,
  ): Promise<void> => {
    try {
      await ensure().setUploadContext(apiBaseUrl, bearerToken, sub);
    } catch {
      /* no native module — nothing to do */
    }
  },
  /**
   * Safe variant of [getConnectivity] — resolves to `{ online: true }` when
   * the native module is unavailable (JSDOM / a build without the module)
   * so the OfflineBanner doesn't flicker on first paint in test contexts.
   */
  getConnectivitySafe: async (): Promise<{ online: boolean }> => {
    try {
      return await ensure().getConnectivity();
    } catch {
      return { online: true };
    }
  },
} as const;

// Lazy NativeEventEmitter — constructed on first subscribe (mirrors
// HumynBattery.ts / HumynCapture.ts) so module load doesn't crash in JSDOM
// tests that don't mock NativeModules.HumynUpload.
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynUpload);
  }
  return _emitter;
}

/**
 * Subscribe to `onUploadQueueChanged` — fires with the full queue snapshot on
 * every mutation (enqueue / clearUploaded / coalesced coordinator updates).
 * Caller MUST `.remove()` the returned subscription on unmount or it leaks.
 */
export function onUploadQueueChanged(
  listener: (rows: UploadQueueRow[]) => void,
): EmitterSubscription {
  return emitter().addListener('onUploadQueueChanged', listener);
}

/**
 * Subscribe to `onUploadProgress` — per-recording byte progress (debounced to
 * ≤ once/5s on the native side). Caller MUST `.remove()` the returned
 * subscription on unmount or it leaks.
 */
export function onUploadProgress(listener: (e: UploadProgressEvent) => void): EmitterSubscription {
  return emitter().addListener('onUploadProgress', listener);
}

/**
 * Phase 1 (2026-06-10) — auth-failure event payload. `slug` is the server's
 * problem-detail slug from the 401 body: `'device-evicted'` (single-device
 * binding kicked this install), `'reauth-required'` (legacy/expired claim
 * shape), or `'unknown'` (unparseable body — treat as plain token expiry).
 */
export type UploadAuthFailureEvent = { slug: string };

/**
 * Phase 1 (2026-06-10) — subscribe to `onUploadAuthFailure`. Fired by the
 * native coordinator when a 401 from `/init`, `/parts` or `/finalize` parks a
 * row + pauses the queue. The boot-installed listener
 * (`services/uploadQueueStore.ts`) runs the eviction UX or a silent re-auth.
 * Caller MUST `.remove()` the returned subscription on teardown.
 */
export function onUploadAuthFailure(
  listener: (e: UploadAuthFailureEvent) => void,
): EmitterSubscription {
  return emitter().addListener('onUploadAuthFailure', listener);
}

/** Connectivity-change event payload — `online === true` when there's an active default network with INTERNET capability. */
export type ConnectivityEvent = { online: boolean };

/**
 * Plan 06-12 follow-on (Finding 6) — subscribe to `onConnectivityChanged`.
 * Fires once immediately with the current state (NetworkMonitor.addConnectivityListener
 * replays it on register), then again on every default-network transition.
 * Caller MUST `.remove()` the returned subscription on unmount.
 */
export function onConnectivityChanged(
  listener: (e: ConnectivityEvent) => void,
): EmitterSubscription {
  return emitter().addListener('onConnectivityChanged', listener);
}
