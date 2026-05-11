package ai.humynlabs.capture.phonestate

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for `NativeModules.HumynPhoneState` — the
 * AudioManager-based "another app / a phone call grabbed audio focus"
 * interruption signal.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). Two `@ReactMethod`s:
 * [start] (begin listening for audio-focus changes) and [stop] (stop +
 * abandon the focus request).
 *
 * **SHELL.** This plan (04-02) ships the contract surface only. Plan 04-05
 * wires the real body: an `AudioManager.OnAudioFocusChangeListener`
 * registered via `AudioManager.requestAudioFocus(...)` that emits
 * `onAudioFocusChanged` via `RCTDeviceEventEmitter` whenever the OS hands
 * focus to/from another app (a real incoming call grabs audio focus, which
 * surfaces as a focus-loss event — that's the signal RecordingScreen uses to
 * pause/stop).
 *
 * **Audio-focus is the ONLY mechanism here** — see 04-RESEARCH Pitfall 2 +
 * CLAUDE.md "Do NOT Use". The telephony / call-state APIs are deliberately
 * NOT used: they would need a runtime permission we don't request and would
 * trip the manifest-invariant gate. (T-4.2-01 — the acceptance gate greps
 * this file to confirm the telephony symbols are absent, so this docstring
 * names them only descriptively, not literally.)
 */
@ReactModule(name = HumynPhoneStateModule.NAME)
class HumynPhoneStateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynPhoneState"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun start(promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    fun stop(promise: Promise) {
        promise.resolve(null)
    }
}
