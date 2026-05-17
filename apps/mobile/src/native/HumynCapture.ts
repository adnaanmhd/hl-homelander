/**
 * D-API-01..03 — typed JS bridge for the HumynCapture native module
 * (Phase 3 Plan 03-04 Task 3).
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/
 * HumynCaptureModule.kt. Shape parity with the Phase-2 HumynCompat.ts
 * pattern — same `ensure()` guard, same NativeModules/NativeEventEmitter
 * surface; the differences are:
 *   - HumynCapture exposes `start(opts)` + `stop()` instead of the three
 *     compat probe methods,
 *   - HumynCapture wires NativeEventEmitter helpers (D-API-03) for the
 *     5 emit channels Phase 4 / Phase 5 consume.
 *
 * Until Plan 03-09 (HumynCaptureModule.kt) + Plan 03-10 (event emission)
 * land, the native side throws NotImplementedError and `start()` /
 * `stop()` resolve with rejected Promises. JSDOM unit tests that don't
 * mock NativeModules.HumynCapture see the canonical
 * `'HumynCapture native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt'`
 * error so they can disambiguate "missing wiring" from "captured failure".
 *
 * **Subscription leak warning (T-3.3-04 mitigation):** every
 * `on*(listener)` helper returns the EventSubscription returned by
 * `NativeEventEmitter.addListener`. Callers MUST `.remove()` it on
 * unmount or the listener (and the JS context refs it captures) leak.
 * Phase 4's RecordingScreen will use the standard `useEffect` cleanup
 * pattern.
 */
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';
import type { CaptureSessionOpts } from '@humyn/shared-types';
import type {
  CaptureStartResponse,
  SegmentStartEvent,
  SegmentCompleteEvent,
  SegmentCanceledEvent,
  SegmentCancelReason,
  SessionStopEvent,
  ThermalAbortEvent,
  CaptureErrorEvent,
  CrashRecoveryEvent,
} from './HumynCapture.types';

interface HumynCaptureNativeModule {
  start(opts: CaptureSessionOpts): Promise<CaptureStartResponse>;
  stop(): Promise<void>;
  /** D-LIFE-04 — synchronous query for the crash-recovery bases the boot
   *  sweep re-finalized (the backstop for the one-shot `onCrashRecovery`
   *  event, which has a fragile boot-timing window on the new arch). */
  getPendingRecovery(): Promise<{ recovered: string[] }>;
}

function ensure(): HumynCaptureNativeModule {
  const native = NativeModules.HumynCapture as HumynCaptureNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynCapture native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Start a capture session. Resolves with `{sessionId, segmentId,
 * recordingId, filenameBase}` once the encoder pipeline is configured
 * (Camera2 capture session built, encoder Surface connected, IMU
 * registered, foreground service started, first segment's sidecar
 * written). The first frame may not yet have been encoded by the
 * time this Promise resolves — frame production happens asynchronously
 * on the encoder pump thread; the first onSegmentStart event fires
 * before resolution but the first muxer.writeSampleData call is
 * in-flight. Subsequent encoder failures (timeout, format renegotiation,
 * etc.) surface as `onError` events, not as a Promise rejection.
 * (WR-12: docstring corrected — the previous text claimed "first frame
 * is written" which over-promised the resolution timing.)
 *
 * Pre-flight rejection codes (D-THERM-01 / D-API-01):
 *   - `thermal_throttling` — `PowerManager.getCurrentThermalStatus() ≥ THROTTLING`
 *   - `permission_revoked` — Camera or Microphone permission denied
 *   - `storage_full` — free-space below the Phase-4 gate
 *   - `internal_error` — filename sequence exhausted, encoder boot failure, etc.
 *
 * Implementation: Plan 03-09.
 */
export async function start(opts: CaptureSessionOpts): Promise<CaptureStartResponse> {
  return ensure().start(opts);
}

/**
 * Stop the current session. Resolves after the final segment finalizes
 * (SHA + drift + metadata-JSON write + `.session.json` cleanup).
 * Subsequent `onSessionStop` event fires with `segmentsCompleted` count.
 *
 * Implementation: Plan 03-09.
 */
export async function stop(): Promise<void> {
  return ensure().stop();
}

/**
 * D-LIFE-04 — query the crash-recovery bases the boot sweep re-finalized.
 * The one-shot `onCrashRecovery` event is the primary delivery channel, but
 * its boot-timing window (module construction ↔ JS subscribe ↔ first
 * onHostResume) is fragile on the new architecture, so the boot listener
 * also calls this on first render. Clears the native holder, so whichever
 * channel fires first wins (the boot listener guards against a double toast).
 * Resolves `{ recovered: [] }` when there is nothing to recover; never throws.
 */
export async function getPendingRecovery(): Promise<{ recovered: string[] }> {
  try {
    const r = await ensure().getPendingRecovery();
    return r && Array.isArray(r.recovered) ? r : { recovered: [] };
  } catch {
    return { recovered: [] };
  }
}

// NativeEventEmitter — D-API-01 + D-API-03.
//
// **Lazy NativeEventEmitter pattern:** `_emitter` is constructed on first
// subscribe so module load doesn't crash in JSDOM tests that don't mock
// `NativeModules.HumynCapture`. JSDOM tests that only exercise `start()` /
// `stop()` (the not-registered-rejects path) never trigger emitter
// construction; tests that exercise event subscriptions explicitly mock
// `react-native` to inject a stub `NativeEventEmitter`.
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynCapture);
  }
  return _emitter;
}

/**
 * Subscribe to `onSegmentStart` events. Caller MUST `.remove()` the
 * returned subscription on unmount (T-3.3-04 leak mitigation).
 */
export function onSegmentStart(listener: (e: SegmentStartEvent) => void): EmitterSubscription {
  return emitter().addListener('onSegmentStart', listener);
}

/**
 * Subscribe to `onSegmentComplete` events. Phase 5's upload pipeline
 * consumes the `mp4Path` / `csvPath` / `jsonPath` triple and the SHA +
 * drift figures from this event.
 */
export function onSegmentComplete(
  listener: (e: SegmentCompleteEvent) => void,
): EmitterSubscription {
  return emitter().addListener('onSegmentComplete', listener);
}

/**
 * Quick task 260517-p5g CAPTURE-QA-04 — subscribe to `onSegmentCanceled`
 * events. Fires when the native `FinalizeWorker` rejects a segment via
 * one of the three capture-quality gates (mean_fps<28 / w<1920 || h<1080
 * / N<2). The segment NEVER enters the upload queue; the listener writes
 * a History-row ledger entry then deletes the MP4 + CSV + JSON bundle
 * files (write-then-delete). Caller MUST `.remove()` the returned
 * subscription on unmount or the listener leaks.
 */
export function onSegmentCanceled(
  listener: (e: SegmentCanceledEvent) => void,
): EmitterSubscription {
  return emitter().addListener('onSegmentCanceled', listener);
}

/** Subscribe to `onSessionStop` events. */
export function onSessionStop(listener: (e: SessionStopEvent) => void): EmitterSubscription {
  return emitter().addListener('onSessionStop', listener);
}

/**
 * Subscribe to `onThermalAbort` events. Phase 4 listens here and fires
 * the TTS voice cue + toast per D-THERM-01.
 */
export function onThermalAbort(listener: (e: ThermalAbortEvent) => void): EmitterSubscription {
  return emitter().addListener('onThermalAbort', listener);
}

/**
 * Subscribe to `onError` events. Mid-session failures (encoder/storage
 * crash, permission revoked) surface here; pre-flight failures surface
 * as `start()` Promise rejections, not as `onError` events.
 */
export function onError(listener: (e: CaptureErrorEvent) => void): EmitterSubscription {
  return emitter().addListener('onError', listener);
}

/**
 * D-LIFE-04 — subscribe to the one-shot `onCrashRecovery` event the
 * Phase-3 app-launch sweep emits when it re-finalizes orphan segments
 * after a force-quit / OS-evict (`{ recovered: string[] }` — the
 * re-finalize-candidate filenameBases). Fires AT MOST once per app
 * launch (only when there is recoverable work). Caller MUST `.remove()`
 * the returned subscription on unmount (T-3.3-04 leak mitigation) — the
 * boot listener `.remove()`s it after the first fire (one-shot).
 */
export function onCrashRecovery(listener: (e: CrashRecoveryEvent) => void): EmitterSubscription {
  return emitter().addListener('onCrashRecovery', listener);
}

export type {
  CaptureStartResponse,
  SegmentStartEvent,
  SegmentCompleteEvent,
  SegmentCanceledEvent,
  SegmentCancelReason,
  SessionStopEvent,
  ThermalAbortEvent,
  CaptureErrorEvent,
  CrashRecoveryEvent,
};
