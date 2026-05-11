package ai.humynlabs.capture.phonestate

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * REC-12 / REC-13 — phone-call & alarm interruption detection via
 * `AudioManager.OnAudioFocusChangeListener` ONLY.
 *
 * **The telephony / call-state APIs are deliberately NOT used.** The
 * call-state callback (the Android telephony-callback / call-state-listener
 * pair) requires the phone-state read permission on apps targeting API 31+ —
 * which this app is (`targetSdk 35`) — and CLAUDE.md forbids that permission
 * (04-RESEARCH Pitfall 2 / D-LIFE-02 correction). So this module is built
 * purely on `AudioManager` audio-focus:
 * it requests `AUDIOFOCUS_GAIN` via an `AudioFocusRequest` (API 26+; minSdk
 * is 26 so the modern API is always available) and emits the raw focus
 * transitions through `RCTDeviceEventEmitter`. A real incoming call grabs
 * audio focus, surfacing as a focus-loss event — and an alarm ringing also
 * produces `AUDIOFOCUS_LOSS_TRANSIENT`, so this one signal covers both.
 *
 * **This module is a dumb pipe of raw focus transitions.** The
 * answered-vs-declined timing heuristic (start a ~6–8 s timer on
 * `transient_loss`; `gain` within the window → no-op; timer fires or a
 * permanent `loss` arrives → `stop()` the recording — errs toward stopping,
 * data-safety bias) lives JS-side in `useRecordingLifecycle` (plan 04-08).
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`). `start()` begins
 * listening; `stop()` abandons the focus request; `invalidate()` abandons it
 * too if still held (Pitfall 5 — no listener / focus-request leak).
 *
 * NOTE: the threat-model acceptance gate greps this file to confirm the
 * telephony symbols are absent, so this docstring names them only
 * descriptively, never literally.
 */
@ReactModule(name = HumynPhoneStateModule.NAME)
class HumynPhoneStateModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynPhoneState"
    }

    /**
     * The active focus request, or `null` when not listening. Held so
     * `stop()` / `invalidate()` can abandon it. API 26+ (minSdk 26) so the
     * modern `AudioFocusRequest` API is always available.
     */
    private var focusRequest: AudioFocusRequest? = null

    /**
     * The focus-change listener — fires on every OS audio-focus transition
     * while [focusRequest] is held. Maps the raw `AUDIOFOCUS_*` int to a
     * stable string and emits `onAudioFocusChanged({focus})`.
     */
    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        emitFocus(change)
    }

    override fun getName(): String = NAME

    private fun audioManager(): AudioManager =
        reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /**
     * Map a raw `AudioManager.AUDIOFOCUS_*` constant to the stable bridge
     * string and emit it. Unknown values are silently ignored (no emit).
     */
    private fun emitFocus(change: Int) {
        val mapped = when (change) {
            AudioManager.AUDIOFOCUS_GAIN -> "gain"
            AudioManager.AUDIOFOCUS_LOSS -> "loss"
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> "transient_loss"
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> "transient_loss_can_duck"
            else -> return
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onAudioFocusChanged", Arguments.createMap().apply { putString("focus", mapped) })
    }

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (focusRequest == null) {
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setOnAudioFocusChangeListener(focusListener)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build(),
                    )
                    .build()
                focusRequest = req
                // Requesting AUDIOFOCUS_GAIN is what makes the OS notify us on
                // focus loss when a call/alarm comes in — no permission needed.
                audioManager().requestAudioFocus(req)
            }
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("PHONE_STATE_START_FAILED", t.message ?: "audio-focus request failed", t)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            focusRequest?.let { audioManager().abandonAudioFocusRequest(it) }
            focusRequest = null
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("PHONE_STATE_STOP_FAILED", t.message ?: "abandon audio focus failed", t)
        }
    }

    override fun invalidate() {
        // Pitfall 5 — abandon the focus request if still held when the
        // catalyst instance goes away (RecordingScreen forgot to stop()).
        focusRequest?.let {
            try {
                audioManager().abandonAudioFocusRequest(it)
            } catch (_: Throwable) {
                // best-effort teardown
            }
        }
        focusRequest = null
        super.invalidate()
    }
}
