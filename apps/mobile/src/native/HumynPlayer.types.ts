/**
 * Event payloads emitted by `NativeModules.HumynPlayer` over the
 * RCTDeviceEventEmitter (Plan 06-06 / Phase 6 D-07). Mirror the WritableMap
 * shapes produced by `ai.humynlabs.capture.player.PlayerController.emit(...)`.
 */

/**
 * `onProgress` — fires every 250 ms while the player is in `play()` state.
 * All three fields are milliseconds; `durationMs` is `Number.NaN` while the
 * duration is still being resolved (live / unknown-length) so the JS side
 * should guard with `Number.isFinite()` before formatting.
 */
export interface PlayerProgressEvent {
  positionMs: number;
  bufferedMs: number;
  durationMs: number;
}

/**
 * `onBuffer` — fires on every `Player.STATE_*` transition. `buffering` is
 * `true` when the player is filling its buffer (network stall / initial
 * prepare), `false` once playback can proceed.
 */
export interface PlayerBufferEvent {
  buffering: boolean;
}

/**
 * `onError` — fires on `Player.Listener.onPlayerError(PlaybackException)`.
 * `code` is the ExoPlayer error code (e.g. `PlaybackException.ERROR_CODE_*`);
 * `msg` is the localised message (or a fallback `"playback error"` when null).
 * `onEnd` carries no payload (an empty map) and is therefore typed as `void`
 * at the subscriber callsite.
 */
export interface PlayerErrorEvent {
  code: number;
  msg: string;
}
