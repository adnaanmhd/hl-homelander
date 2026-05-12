package ai.humynlabs.capture.handdetector

import android.app.Application
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Plan 04-04 Task 2 — lightweight unit coverage for the parts of
 * [HumynHandDetectorModule] that don't need the native MediaPipe lib:
 *
 *   (a) [HumynHandDetectorModule.clampConfidence] — T-4.4-03 input
 *       validation: a JS-supplied confidence is clamped into `[0f, 1f]`.
 *   (b) [HumynHandDetectorModule.detectHands] with a path to a non-existent
 *       file — T-4.4-02: `BitmapFactory.decodeFile` returns null →
 *       `IllegalArgumentException` → `promise.reject("HAND_DETECT_FAILED", e)`
 *       on the background executor; never crashes the bridge.
 *
 * The `MediaPipe HandLandmarker.detect()` call itself is not unit-testable
 * without the native `libmediapipe_tasks_vision_jni.so` — that path is left to
 * the Wave-5 on-hardware smoke (D-WAVE-04: module-ready + practice E2E passes
 * + lifecycle edges manually verified).
 *
 * `application = Application::class` matches the canonical Phase-3 test
 * pattern — bypasses `MainApplication.onCreate`'s SoLoader.init NPE under
 * Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class HumynHandDetectorModuleTest {

    private val ctx get() = RuntimeEnvironment.getApplication()

    // ── (a) clampConfidence — T-4.4-03 ─────────────────────────────────────

    @Test
    fun `clampConfidence clamps a negative value to 0f`() {
        assertEquals(0f, HumynHandDetectorModule.clampConfidence(-0.5), 0f)
    }

    @Test
    fun `clampConfidence clamps an above-one value to 1f`() {
        assertEquals(1f, HumynHandDetectorModule.clampConfidence(2.0), 0f)
    }

    @Test
    fun `clampConfidence passes an in-range value through`() {
        assertEquals(0.5f, HumynHandDetectorModule.clampConfidence(0.5), 1e-6f)
    }

    // ── (b) detectHands on a bad path — T-4.4-02 ──────────────────────────

    @Test
    fun `detectHands rejects with HAND_DETECT_FAILED for a missing file`() {
        val module = HumynHandDetectorModule(BridgeReactContext(ctx))
        val promise = RecordingPromise()
        module.detectHands("/no/such/file-${System.nanoTime()}.jpg", 0.5, promise)
        assertTrue(
            "detectHands should settle within the timeout",
            promise.await(5, TimeUnit.SECONDS),
        )
        assertTrue("expected reject, got resolve(${promise.resolvedValue})", promise.rejected)
        assertEquals("HAND_DETECT_FAILED", promise.rejectCode)
        assertNotNull("reject should carry the underlying throwable", promise.rejectThrowable)
    }

    // ── (c) cleanup is serialised on bgExecutor & doesn't wedge the module ──
    //        WR-03 — RecordingScreen calls cleanup() on every unmount; the
    //        close() now runs on the same single-thread executor detect()
    //        runs on. This exercises the `bgExecutor.execute { … resolve(null) }`
    //        path and confirms a cleanup leaves the module usable.

    @Test
    fun `cleanup resolves and the module still works afterwards`() {
        val module = HumynHandDetectorModule(BridgeReactContext(ctx))

        val cleanupPromise = RecordingPromise()
        module.cleanup(cleanupPromise)
        assertTrue(
            "cleanup should settle within the timeout",
            cleanupPromise.await(5, TimeUnit.SECONDS),
        )
        assertTrue(
            "expected resolve(null), got reject(${cleanupPromise.rejectCode})",
            !cleanupPromise.rejected,
        )
        assertEquals(null, cleanupPromise.resolvedValue)

        // The module survives a cleanup — a subsequent detectHands on a bad
        // path still rejects gracefully (it does not wedge on a closed pool).
        val detectPromise = RecordingPromise()
        module.detectHands("/no/such/file-${System.nanoTime()}.jpg", 0.5, detectPromise)
        assertTrue(
            "detectHands should settle within the timeout after cleanup",
            detectPromise.await(5, TimeUnit.SECONDS),
        )
        assertTrue(
            "expected reject after cleanup, got resolve(${detectPromise.resolvedValue})",
            detectPromise.rejected,
        )
        assertEquals("HAND_DETECT_FAILED", detectPromise.rejectCode)
    }

    /**
     * Minimal `Promise` test double — no mocking framework on the test
     * classpath (junit + robolectric only). Captures the first settlement and
     * counts down a latch so the test can await the background executor.
     */
    private class RecordingPromise : Promise {
        private val latch = CountDownLatch(1)

        @Volatile var resolvedValue: Any? = null
        @Volatile var rejected = false
        @Volatile var rejectCode: String? = null
        @Volatile var rejectThrowable: Throwable? = null

        fun await(timeout: Long, unit: TimeUnit): Boolean = latch.await(timeout, unit)

        private inline fun settle(block: () -> Unit) {
            block()
            latch.countDown()
        }

        override fun resolve(value: Any?) = settle { resolvedValue = value }

        override fun reject(code: String, message: String?) =
            settle { rejected = true; rejectCode = code }

        override fun reject(code: String, throwable: Throwable?) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(code: String, message: String?, throwable: Throwable?) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(throwable: Throwable) =
            settle { rejected = true; rejectThrowable = throwable }

        override fun reject(throwable: Throwable, userInfo: WritableMap) =
            settle { rejected = true; rejectThrowable = throwable }

        override fun reject(code: String, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code }

        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(code: String, message: String?, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code }

        override fun reject(
            code: String?,
            message: String?,
            throwable: Throwable?,
            userInfo: WritableMap?,
        ) = settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        @Deprecated("Prefer reject(code, message) — string-only reject is deprecated in RN.")
        override fun reject(message: String) = settle { rejected = true }
    }
}
