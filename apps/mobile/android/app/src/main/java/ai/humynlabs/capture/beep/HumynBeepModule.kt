package ai.humynlabs.capture.beep

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * REC-10 — short alert tones played via `SoundPool` over pre-baked `.wav`
 * assets bundled in the APK (`assets/audio/`).
 *
 * Tone names (engineering-handoff §6.1, reproduced verbatim):
 *   - `'battery_alert'` — 520 Hz sine, 200 ms (the low-battery cue).
 *   - `'thermal_alert'` — descending three-note 440 → 560 → 680 Hz at
 *     180 / 180 / 220 ms (the thermal-kill cue).
 *
 * §6.1 mandates pre-baked `.wav` at 44.1 kHz mono shipped as bundled assets
 * "to avoid AudioContext latency variance" — generating tones at runtime via
 * a tone generator / `AudioTrack` would make the cue feel laggy on ₹30K
 * phones. **DO NOT add the third-party RN sound / track-player libraries**
 * (CLAUDE.md "Do NOT Use" — wrong tool; this in-house SoundPool wrapper is
 * tiny). The platform media-player class is also avoided — SoundPool is the
 * low-latency choice for short pre-loaded clips.
 *
 * The `SoundPool` is built lazily on the first [playTone] call and both
 * known clips are pre-loaded then, so subsequent `play()` calls return a
 * valid stream id immediately. `name` is validated against the known set —
 * an unknown name rejects with `UNKNOWN_TONE` (no arbitrary asset path is
 * opened from the JS string). The pool is released on `invalidate()`
 * (Pitfall 5 — no SoundPool leak).
 *
 * Mirrors the canonical 3-file native-module triad (see
 * `ai.humynlabs.capture.updater.HumynUpdaterModule`).
 */
@ReactModule(name = HumynBeepModule.NAME)
class HumynBeepModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "HumynBeep"

        /** The known tone names → their bundled asset filename (under `audio/`). */
        private val TONE_ASSETS = mapOf(
            "battery_alert" to "audio/battery_alert.wav",
            "thermal_alert" to "audio/thermal_alert.wav",
        )
    }

    /** Lazily-built pool; `null` until the first [playTone]. */
    private var soundPool: SoundPool? = null

    /** Loaded sample ids keyed by tone name. */
    private val soundIds = mutableMapOf<String, Int>()

    override fun getName(): String = NAME

    /**
     * Build the [SoundPool] and pre-load both known clips. Idempotent — does
     * nothing if the pool already exists. SoundPool decodes asynchronously;
     * a clip is fully usable a few ms after `load()`. The low-battery /
     * thermal cues fire well after RecordingScreen mount, so a lazy pre-load
     * on the first call has the clip ready in practice.
     */
    private fun ensurePool() {
        if (soundPool != null) return
        val pool = SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .build()
        soundPool = pool
        val assets = reactApplicationContext.assets
        for ((name, path) in TONE_ASSETS) {
            assets.openFd(path).use { afd ->
                soundIds[name] = pool.load(afd, 1)
            }
        }
    }

    @ReactMethod
    fun playTone(name: String, promise: Promise) {
        if (!TONE_ASSETS.containsKey(name)) {
            promise.reject("UNKNOWN_TONE", "unknown tone name: $name")
            return
        }
        try {
            ensurePool()
            val pool = soundPool
                ?: run {
                    promise.reject("BEEP_FAILED", "sound pool unavailable")
                    return
                }
            val id = soundIds[name]
                ?: run {
                    promise.reject("BEEP_FAILED", "tone not loaded: $name")
                    return
                }
            pool.play(id, 1f, 1f, 1, 0, 1f)
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("BEEP_FAILED", t.message ?: "failed to play tone: $name", t)
        }
    }

    override fun invalidate() {
        // Pitfall 5 — release the pool when the catalyst instance goes away.
        soundPool?.release()
        soundPool = null
        soundIds.clear()
        super.invalidate()
    }
}
