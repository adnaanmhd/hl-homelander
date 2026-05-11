package ai.humynlabs.capture.beep

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.util.Collections

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
 * WR-04 — `SoundPool.load()` decodes the clip *asynchronously*; calling
 * `play()` on a still-decoding sample returns `0` (failure) and is silently
 * inaudible. So: the pool is built and both clips start decoding at module
 * construction (the `init` block) — well before any recording starts — and a
 * `setOnLoadCompleteListener` records which sample ids have finished decoding.
 * A `playTone()` whose clip is already loaded plays immediately; one that
 * arrives before the decode finishes is queued and fired by the
 * `OnLoadCompleteListener` callback. `play()`'s return value is checked — a
 * genuine `0` is reported as `BEEP_FAILED` instead of swallowed. `name` is
 * validated against the known set — an unknown name rejects with `UNKNOWN_TONE`
 * (no arbitrary asset path is opened from the JS string). The pool (and its
 * listener) is released on `invalidate()` (Pitfall 5 — no SoundPool leak).
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

    /** Built eagerly in [init]; `null` only if the build/`openFd` failed. */
    private var soundPool: SoundPool? = null

    /** Loaded sample ids keyed by tone name. */
    private val soundIds = mutableMapOf<String, Int>()

    /**
     * Sample ids the `OnLoadCompleteListener` has reported decoded
     * (`status == 0`). A `play()` is only safe once the id is in here.
     */
    private val loadedSampleIds: MutableSet<Int> =
        Collections.synchronizedSet(mutableSetOf())

    /**
     * Sample ids a [playTone] requested *before* the decode finished — fired
     * by the `OnLoadCompleteListener` callback when the matching id loads.
     */
    private val pendingPlays: MutableSet<Int> =
        Collections.synchronizedSet(mutableSetOf())

    init {
        // WR-04 — start decoding both clips the moment the catalyst instance
        // exists, so the first low-battery / thermal cue (which fires well
        // after RecordingScreen mount) almost always plays immediately. The
        // queue path below is the belt-and-suspenders for the rare case a
        // cue beats the decode.
        ensurePool()
    }

    override fun getName(): String = NAME

    /**
     * Build the [SoundPool], register the load-complete listener, and start
     * decoding both known clips. Idempotent — does nothing if the pool already
     * exists, so [playTone] calling it again is a harmless no-op.
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
        // WR-04 — when a sample finishes decoding, mark it loaded and, if a
        // playTone() already asked for it, fire it now (a play() on a loaded
        // sample returns a valid non-zero stream id).
        pool.setOnLoadCompleteListener { sp, sampleId, status ->
            if (status == 0) {
                loadedSampleIds.add(sampleId)
                if (pendingPlays.remove(sampleId)) {
                    sp.play(sampleId, 1f, 1f, 1, 0, 1f)
                }
            }
        }
        soundPool = pool
        val assets = reactApplicationContext.assets
        for ((name, path) in TONE_ASSETS) {
            assets.openFd(path).use { afd ->
                // load() is ASYNC — decode completes a few ms later and is
                // signalled via the OnLoadCompleteListener above.
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
            if (loadedSampleIds.contains(id)) {
                // WR-04 — the sample is decoded; play() returns a valid stream
                // id. A 0 here is a genuine failure (e.g. max streams busy) —
                // report it instead of swallowing it.
                val streamId = pool.play(id, 1f, 1f, 1, 0, 1f)
                if (streamId == 0) {
                    promise.reject("BEEP_FAILED", "SoundPool.play returned 0 for $name")
                    return
                }
            } else {
                // WR-04 — still decoding; queue it. The OnLoadCompleteListener
                // fires it the moment the matching sample id reports loaded.
                pendingPlays.add(id)
            }
            // Enqueued or played — either way the JS side (which swallows
            // rejections, .catch(() => undefined)) treats the cue as
            // best-effort.
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("BEEP_FAILED", t.message ?: "failed to play tone: $name", t)
        }
    }

    override fun invalidate() {
        // Pitfall 5 — release the pool (and its load-complete listener) when
        // the catalyst instance goes away.
        soundPool?.release()
        soundPool = null
        soundIds.clear()
        loadedSampleIds.clear()
        pendingPlays.clear()
        super.invalidate()
    }
}
