package ai.humynlabs.capture.beep

import android.app.Application
import android.media.AudioAttributes
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Phase 6 Plan 06-01 Task 3 — lightweight unit coverage for the audibility
 * fix landed in Task 1.
 *
 *   (a) `audioAttributes_usageIsMedia` — D-09 Wave 1: the SoundPool is
 *       constructed with `AudioAttributes.USAGE_MEDIA` so the cue plays on
 *       STREAM_MUSIC (the user-controlled "media volume"), not the system
 *       stream which was silent at MAX media volume on Android 16 / Pixel
 *       10a during the Phase-5 Item-5 walk. The actual audibility is
 *       device-only and not unit-testable; this is the structural check.
 *   (b) `streamIdGuard_rejectsPromise_whenStreamIdZero` — the WR-04
 *       guarantee carried by the `streamId == 0` guard in `playTone`: if
 *       `SoundPool.play(...)` returns 0 (max streams busy OR load
 *       incomplete), the cue is reported as `BEEP_FAILED` instead of being
 *       silently swallowed. Exercises the
 *       `HumynBeepModule.Companion.streamIdGuard` helper directly with a
 *       `RecordingPromise` test double.
 *   (c) `streamIdGuard_resolvesPromise_whenStreamIdNonZero` — the inverse
 *       branch: a non-zero streamId means the cue is queued for playback;
 *       the guard MUST NOT reject the promise.
 *
 * The full `SoundPool` round-trip (decode → play) is device-only --
 * Robolectric's `ShadowSoundPool` does not simulate the audio framework's
 * stream-id allocation logic, so we test the guard contract directly. The
 * `playTone(...)` integration path is exercised on hardware via the
 * Plan 06-11 manual-smoke runbook §1 (D-09b: BLOCKING for phase sign-off,
 * NOT for Wave 2 entry).
 *
 * `application = Application::class` -- bypasses the `MainApplication.onCreate`
 * `SoLoader.init` NPE under Robolectric (canonical Phase 3/4 pattern; see
 * `CaptureLaunchSweepTest` / `UploadQueueStoreTest`).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HumynBeepModuleTest {

    @Test
    fun audioAttributes_usageIsMedia() {
        val attrs = HumynBeepModule.buildAudioAttributes()
        assertNotNull("buildAudioAttributes() must return a non-null AudioAttributes", attrs)
        assertEquals(
            "D-09 Wave 1: SoundPool MUST use AudioAttributes.USAGE_MEDIA so the cue plays on STREAM_MUSIC (the user-controlled media volume).",
            AudioAttributes.USAGE_MEDIA,
            attrs.usage,
        )
        assertEquals(
            "CONTENT_TYPE_SONIFICATION stays from the original implementation (short alert tone).",
            AudioAttributes.CONTENT_TYPE_SONIFICATION,
            attrs.contentType,
        )
    }

    @Test
    fun streamIdGuard_rejectsPromise_whenStreamIdZero() {
        val promise = RecordingPromise()
        val played = HumynBeepModule.streamIdGuard(
            streamId = 0,
            name = "battery_alert",
            sampleId = 42,
            promise = promise,
        )
        assertFalse(
            "streamIdGuard MUST report failure when SoundPool.play returns 0.",
            played,
        )
        assertTrue("promise.reject MUST be called", promise.rejected)
        assertEquals(
            "Reject code must match the documented BEEP_FAILED code (see HumynBeepModule.kt).",
            "BEEP_FAILED",
            promise.rejectCode,
        )
    }

    @Test
    fun streamIdGuard_resolvesPromise_whenStreamIdNonZero() {
        val promise = RecordingPromise()
        val played = HumynBeepModule.streamIdGuard(
            streamId = 17,
            name = "thermal_alert",
            sampleId = 7,
            promise = promise,
        )
        assertTrue(
            "streamIdGuard MUST report success when SoundPool.play returns a non-zero streamId.",
            played,
        )
        assertFalse(
            "promise.reject MUST NOT be called when streamId is non-zero -- the caller resolves it.",
            promise.rejected,
        )
    }

    /**
     * Minimal `Promise` test double -- no mocking framework on the test
     * classpath (junit + robolectric only). Mirrors `HumynHandDetectorModuleTest`'s
     * `RecordingPromise`; captures the first settlement so the assertions
     * can read `rejected` / `rejectCode` / `resolvedValue`.
     */
    private class RecordingPromise : Promise {
        @Volatile var resolvedValue: Any? = null
        @Volatile var rejected = false
        @Volatile var rejectCode: String? = null
        @Volatile var rejectMessage: String? = null
        @Volatile var rejectThrowable: Throwable? = null

        override fun resolve(value: Any?) {
            resolvedValue = value
        }

        override fun reject(code: String, message: String?) {
            rejected = true; rejectCode = code; rejectMessage = message
        }

        override fun reject(code: String, throwable: Throwable?) {
            rejected = true; rejectCode = code; rejectThrowable = throwable
        }

        override fun reject(code: String, message: String?, throwable: Throwable?) {
            rejected = true; rejectCode = code; rejectMessage = message; rejectThrowable = throwable
        }

        override fun reject(throwable: Throwable) {
            rejected = true; rejectThrowable = throwable
        }

        override fun reject(throwable: Throwable, userInfo: WritableMap) {
            rejected = true; rejectThrowable = throwable
        }

        override fun reject(code: String, userInfo: WritableMap) {
            rejected = true; rejectCode = code
        }

        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
            rejected = true; rejectCode = code; rejectThrowable = throwable
        }

        override fun reject(code: String, message: String?, userInfo: WritableMap) {
            rejected = true; rejectCode = code; rejectMessage = message
        }

        override fun reject(
            code: String?,
            message: String?,
            throwable: Throwable?,
            userInfo: WritableMap?,
        ) {
            rejected = true; rejectCode = code; rejectMessage = message; rejectThrowable = throwable
        }

        @Deprecated("Prefer reject(code, message) — string-only reject is deprecated in RN.")
        override fun reject(message: String) {
            rejected = true; rejectMessage = message
        }
    }
}
