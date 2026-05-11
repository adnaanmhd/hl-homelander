package ai.humynlabs.capture.beep

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * REC-10 — TurboModule entry point for `NativeModules.HumynBeep`.
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). One `@ReactMethod`:
 * [playTone] — play the pre-baked tone named `name`.
 *
 * **SHELL.** This plan (04-02) ships the contract surface only. Plan 04-05
 * wires the real body: a `SoundPool` loaded with small pre-generated `.wav`
 * files from `assets/audio/`; `playTone(name)` resolves the name to a loaded
 * sample id and calls `soundPool.play(...)`. Pre-baking the tones (rather than
 * generating them at runtime via a tone generator / `AudioTrack`) avoids
 * AudioContext latency variance that would make the cue feel laggy on ₹30K
 * phones (engineering-handoff §6.1).
 *
 * Tone names: `'battery_alert'` (520 Hz / 200 ms), `'thermal_alert'`
 * (descending 440→560→680 Hz). **DO NOT use `react-native-sound` /
 * `react-native-track-player`** (CLAUDE.md "Do NOT Use" — wrong tool; the
 * in-house SoundPool wrapper is tiny).
 */
@ReactModule(name = HumynBeepModule.NAME)
class HumynBeepModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynBeep"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun playTone(name: String, promise: Promise) {
        promise.resolve(null)
    }
}
