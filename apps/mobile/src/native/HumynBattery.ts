/**
 * Typed JS bridge for the HumynBattery native module — the battery
 * level/charging signal that drives the low-battery cue during a recording.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/
 * HumynBatteryModule.kt. Shape parity with the Phase-3 HumynCapture.ts
 * pattern — same `ensure()` guard, same canonical "not registered" error,
 * same lazy `NativeEventEmitter` + `on*(listener): EmitterSubscription`
 * convention.
 *
 * **Subscription leak warning:** `onBatteryChanged(listener)` returns the
 * `EmitterSubscription` from `NativeEventEmitter.addListener`. Callers MUST
 * `.remove()` it on unmount or the listener leaks.
 *
 * Until plan 04-05 (`HumynBatteryModule.kt` body — an
 * `Intent.ACTION_BATTERY_CHANGED` sticky-broadcast receiver) lands, the
 * native side's `start()` / `stop()` resolve trivially (the shell); the JS
 * bridge surface is contractually final from this plan onward.
 */
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';

interface HumynBatteryNativeModule {
  /** Register the ACTION_BATTERY_CHANGED receiver; idempotent. */
  start(): Promise<void>;
  /** Unregister the receiver; idempotent. */
  stop(): Promise<void>;
}

function ensure(): HumynBatteryNativeModule {
  const native = NativeModules.HumynBattery as HumynBatteryNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynBattery native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Start emitting `onBatteryChanged` events. RecordingScreen calls this when a
 * recording starts and `stop()` when it ends. Implementation: plan 04-05.
 */
export async function start(): Promise<void> {
  return ensure().start();
}

/** Stop emitting `onBatteryChanged` events. Implementation: plan 04-05. */
export async function stop(): Promise<void> {
  return ensure().stop();
}

// Lazy NativeEventEmitter — constructed on first subscribe (mirrors
// HumynCapture.ts) so module load doesn't crash in JSDOM tests that don't
// mock NativeModules.HumynBattery.
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynBattery);
  }
  return _emitter;
}

/** Battery state payload — `level` is a fraction 0..1; `isCharging` is the plug state. */
export interface BatteryChangedEvent {
  level: number;
  isCharging: boolean;
}

/**
 * Subscribe to `onBatteryChanged` events. Caller MUST `.remove()` the
 * returned subscription on unmount or it leaks.
 */
export function onBatteryChanged(listener: (e: BatteryChangedEvent) => void): EmitterSubscription {
  return emitter().addListener('onBatteryChanged', listener);
}
