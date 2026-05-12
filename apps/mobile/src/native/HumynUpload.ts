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
};

/** Progress tick for one in-flight recording. */
export type UploadProgressEvent = {
  recordingId: string;
  bytesUploaded: number;
  bytesTotal: number;
};

interface HumynUploadNativeModule {
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
  /** Boot-safe `getQueue()` — never throws; `[]` if the module is unavailable. */
  getQueueSafe: async (): Promise<UploadQueueRow[]> => {
    try {
      return await ensure().getQueue();
    } catch {
      return [];
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
