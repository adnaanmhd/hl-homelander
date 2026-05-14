/**
 * `NativeModules.HumynPlayer` + the `<HumynPlayerView>` native component — the
 * hand-rolled `media3:media3-exoplayer:1.10.0` in-app HEVC player (Plan 06-06 /
 * Phase 6 D-07). Mirrors the `HumynGateCamera` triad shape (module +
 * ViewManager) and the `HumynUpload` event-subscription pattern (lazy
 * NativeEventEmitter).
 *
 * Why hand-rolled (not `react-native-video`): CLAUDE.md "Do NOT Use" forbids
 * `react-native-video`; the rest of the capture-side family is hand-rolled
 * native modules (HumynCapture / HumynUpload / HumynGateCamera / ...), and
 * the player needs the same memory-mappable file:// path (no scoped-storage
 * detour) + the same App-private filesDir sandbox enforced server-side at the
 * URI gate (T-6.6-01).
 *
 * PlayerScreen (Plan 06-10) consumes this surface:
 *  1. mount `<HumynPlayerView style={StyleSheet.absoluteFill}>`,
 *  2. `await HumynPlayer.prepare(uri)` — `file://<filesDir>/recording.mp4` for
 *     local playback, the signed `https://recordings.humyn.ai/...` URL minted
 *     by Plan 06-03 for streamed playback,
 *  3. subscribe to `onPlayerProgress` / `onPlayerBuffer` / `onPlayerEnd` /
 *     `onPlayerError`,
 *  4. `await HumynPlayer.play()` / `pause()` / `seekTo(ms)`,
 *  5. on unmount / route-leave: `await HumynPlayer.release()`. (The native
 *    `HumynPlayerModule.invalidate()` is the final-gate safety net for
 *    catalyst teardown.)
 *
 * Shape parity discriminant: `isPlayerAvailable()` — if `false` (module
 * didn't register / JSDOM unit test), PlayerScreen falls back to an error
 * placeholder rather than throwing at `ensure()`.
 */
import {
  NativeEventEmitter,
  NativeModules,
  requireNativeComponent,
  type EmitterSubscription,
  type ViewStyle,
} from 'react-native';

import type { PlayerBufferEvent, PlayerErrorEvent, PlayerProgressEvent } from './HumynPlayer.types';

interface HumynPlayerNativeModule {
  /** Build (or reuse) the ExoPlayer, validate the URI scheme (T-6.6-01), queue the MediaItem. */
  prepare(uri: string): Promise<void>;
  /** Start playback (kicks the 250 ms progress ticker). */
  play(): Promise<void>;
  /** Pause playback (stops the progress ticker). */
  pause(): Promise<void>;
  /** Seek to `positionMs` (Long on the native side; pass as Number). */
  seekTo(positionMs: number): Promise<void>;
  /** Release the ExoPlayer + surface. Idempotent. */
  release(): Promise<void>;
}

function ensure(): HumynPlayerNativeModule {
  const native = NativeModules.HumynPlayer as HumynPlayerNativeModule | undefined;
  if (!native) {
    throw new Error(
      'HumynPlayer native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt',
    );
  }
  return native;
}

/** `true` iff the native module is registered. PlayerScreen guards with this before mount. */
export const isPlayerAvailable = (): boolean => NativeModules.HumynPlayer != null;

/**
 * The HumynPlayer facade — mirrors `HumynGateCamera` (verb facade with
 * `ensure()` lookup). Each call throws synchronously if the module isn't
 * registered; the JS guard is `isPlayerAvailable()` at the callsite.
 */
export const HumynPlayer = {
  prepare: (uri: string): Promise<void> => ensure().prepare(uri),
  play: (): Promise<void> => ensure().play(),
  pause: (): Promise<void> => ensure().pause(),
  seekTo: (positionMs: number): Promise<void> => ensure().seekTo(positionMs),
  release: (): Promise<void> => ensure().release(),
} as const;

/**
 * The native video surface (a `TextureView`). Mount full-screen at the back of
 * the PlayerScreen stack; RN overlays (transport controls, captions, gradients)
 * compose on top.
 */
export const HumynPlayerView = requireNativeComponent<{ style?: ViewStyle }>('HumynPlayerView');

// Lazy NativeEventEmitter — constructed on first subscribe (mirrors
// HumynBattery.ts / HumynUpload.ts) so module load doesn't crash in JSDOM
// tests that don't mock NativeModules.HumynPlayer.
let _emitter: NativeEventEmitter | null = null;
function emitter(): NativeEventEmitter {
  if (_emitter == null) {
    _emitter = new NativeEventEmitter(NativeModules.HumynPlayer);
  }
  return _emitter;
}

/**
 * Subscribe to `onProgress` (positionMs / bufferedMs / durationMs every
 * 250 ms during playback). Caller MUST `.remove()` the returned subscription
 * on unmount or it leaks.
 */
export function onPlayerProgress(listener: (e: PlayerProgressEvent) => void): EmitterSubscription {
  return emitter().addListener('onProgress', listener);
}

/**
 * Subscribe to `onBuffer` — fires `{ buffering: true | false }` on every
 * `Player.STATE_*` transition. Caller MUST `.remove()` on unmount.
 */
export function onPlayerBuffer(listener: (e: PlayerBufferEvent) => void): EmitterSubscription {
  return emitter().addListener('onBuffer', listener);
}

/**
 * Subscribe to `onEnd` — fires once when the player transitions to
 * `Player.STATE_ENDED`. Empty payload. Caller MUST `.remove()` on unmount.
 */
export function onPlayerEnd(listener: () => void): EmitterSubscription {
  return emitter().addListener('onEnd', listener);
}

/**
 * Subscribe to `onError` — fires on `Player.Listener.onPlayerError`. Carries
 * the ExoPlayer error `code` + message. Caller MUST `.remove()` on unmount.
 */
export function onPlayerError(listener: (e: PlayerErrorEvent) => void): EmitterSubscription {
  return emitter().addListener('onError', listener);
}
