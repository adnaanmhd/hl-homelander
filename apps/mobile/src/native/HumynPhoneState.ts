/**
 * Typed JS bridge for the HumynPhoneState native module — the AudioManager-based
 * "another app / a phone call grabbed audio focus" interruption signal.
 *
 * Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/phonestate/
 * HumynPhoneStateModule.kt. Shape parity with the Phase-3 HumynCapture.ts
 * pattern — same `ensure()` guard, same canonical "not registered" error,
 * same lazy `NativeEventEmitter` + `on*(listener): EmitterSubscription`
 * convention.
 *
 * **NO TelephonyManager / READ_PHONE_STATE / PhoneStateListener** — the Kotlin
 * body (plan 04-05) uses `AudioManager.OnAudioFocusChangeListener` only (see
 * 04-RESEARCH Pitfall 2 + CLAUDE.md "Do NOT Use"). A real incoming call grabs
 * audio focus, which surfaces here as an `onAudioFocusChanged` event with
 * `focus: 'loss'` — that's the signal RecordingScreen uses to pause/stop.
 *
 * **Subscription leak warning:** every `on*(listener)` helper returns the
 * `EmitterSubscription` from `NativeEventEmitter.addListener`. Callers MUST
 * `.remove()` it on unmount (use the standard `useEffect` cleanup) or the
 * listener leaks.
 *
 * Until plan 04-05 (`HumynPhoneStateModule.kt` body) lands, the native side's
 * `start()` / `stop()` resolve trivially (the shell); the JS bridge surface is
 * contractually final from this plan onward.
 */
import { NativeEventEmitter, NativeModules, type EmitterSubscription } from 'react-native';

interface HumynPhoneStateNativeModule {
  /** Begin listening for audio-focus changes; idempotent. */
  start(): Promise<void>;
  /** Stop listening + abandon the focus request; idempotent. */
  stop(): Promise<void>;
}

function ensure(): HumynPhoneStateNativeModule {
  const native = NativeModules.HumynPhoneState as HumynPhoneStateNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynPhoneState native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/**
 * Start listening for audio-focus changes. RecordingScreen calls this when a
 * recording starts and `stop()` when it ends. Implementation: plan 04-05.
 */
export async function start(): Promise<void> {
  return ensure().start();
}

/** Stop listening for audio-focus changes. Implementation: plan 04-05. */
export async function stop(): Promise<void> {
  return ensure().stop();
}

// Lazy NativeEventEmitter — constructed on first subscribe so module load
// doesn't crash in JSDOM tests that don't mock NativeModules.HumynPhoneState
// (mirrors HumynCapture.ts).
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynPhoneState);
  }
  return _emitter;
}

/** Audio-focus change payload (the four AudioManager AUDIOFOCUS_* states). */
export interface AudioFocusChangedEvent {
  focus: 'gain' | 'loss' | 'transient_loss' | 'transient_loss_can_duck';
}

/**
 * Subscribe to `onAudioFocusChanged` events (`focus: 'loss'` ≈ an incoming
 * call or another app took over). Caller MUST `.remove()` the returned
 * subscription on unmount or it leaks.
 */
export function onAudioFocusChanged(
  listener: (e: AudioFocusChangedEvent) => void,
): EmitterSubscription {
  return emitter().addListener('onAudioFocusChanged', listener);
}
