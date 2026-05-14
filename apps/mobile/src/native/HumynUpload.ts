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
 * resume/getQueue/clearVerified + the durable queue store. The actual /init →
 * PUT → /finalize transfer engine (`ChunkUploader` / `UploadCoordinator`) is
 * Plan 05-06; the FGS + OEM-walkthrough are Plan 05-07; the boot reconcile
 * sweep is Plan 05-08.
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
  state: 'pending' | 'uploading' | 'finalizing' | 'awaiting-verify' | 'verified' | 'dead-letter';
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
  /** Mark each recordingId verified, unlink local files, drop the row (UP-15 / VERIFY-06). */
  clearVerified(recordingIds: string[]): Promise<void>;
  /**
   * Flip a queue row into its re-upload state (UP-16) — the coordinator then
   * re-mints the multipart upload via `POST /recordings/:id/reupload` (not
   * `/init`) and re-PUTs from the still-present local copy. No-op (resolves)
   * if the row doesn't exist. Driven by the `re-upload` server event
   * (services/recordingEvents.ts) and the dead-letter "Retry" affordance.
   */
  reupload(recordingId: string): Promise<void>;
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
  clearVerified: (recordingIds: string[]): Promise<void> => ensure().clearVerified(recordingIds),
  /** Flip a row into re-upload mode (UP-16). Throws if the module is absent. */
  reupload: (recordingId: string): Promise<void> => ensure().reupload(recordingId),
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
  // a JSDOM test, an iOS build where these aren't implemented). Used by
  // BatteryOptimizationScreen so it renders without the module.
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
 * every mutation (enqueue / clearVerified / coalesced coordinator updates).
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
