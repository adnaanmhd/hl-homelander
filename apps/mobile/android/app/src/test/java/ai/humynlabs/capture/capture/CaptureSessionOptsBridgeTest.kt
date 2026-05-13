package ai.humynlabs.capture.capture

import android.app.Application
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-09 Task 1 — `CaptureSessionOptsBridge` parses + validates the
 * D-API-02 ReadableMap into a Kotlin [CaptureSessionOpts] (PLAN.md
 * `<behavior>`).
 *
 * Behavior contract:
 *  - valid map → returns CaptureSessionOpts with every field populated.
 *  - `consent: false` → throws IllegalArgumentException("consent_invalid").
 *  - missing required string → throws "invalid_opts: <field>".
 *  - taskSetting outside enum → throws "invalid_opts: taskSetting".
 *  - dfovDegrees ≤ 0 → throws "invalid_opts: dfovDegrees".
 *  - non-semver appVersion → throws "invalid_opts: appVersion".
 *  - Defense-in-depth at the Kotlin bridge end: the JS-side Zod schema
 *    (Plan 03-04) rejects malformed input first; this parser exists
 *    because a malicious / buggy JS caller could bypass that and call
 *    `NativeModules.HumynCapture.start` directly with any ReadableMap.
 *
 * `application = Application::class` matches the canonical Phase 3 test
 * pattern — bypasses `MainApplication.onCreate`'s SoLoader.init NPE
 * under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class CaptureSessionOptsBridgeTest {

    private fun validMap(): JavaOnlyMap = JavaOnlyMap().apply {
        putString("taskId", "cooking.chopping")
        putString("taskName", "Chopping vegetables")
        putString("taskCategory", "cooking")
        putString("taskSetting", "indoor")
        putMap(
            "contributor",
            JavaOnlyMap().apply {
                putString("name", "Alice")
                putString("email", "alice@example.com")
                putInt("age", 28)
                putString("gender", "female")
                putBoolean("consent", true)
            },
        )
        putBoolean("isPractice", false)
        putMap(
            "startGate",
            JavaOnlyMap().apply {
                putString("type", "hand_detection")
                putBoolean("passed", true)
                putBoolean("skipped", false)
                putBoolean("bypassed", false)
                putInt("durationMs", 3420)
                putInt("consecutiveHitsRequired", 5)
                putInt("platformCadenceMs", 400)
            },
        )
        putString("location", "Bangalore, India")
        putString("appVersion", "1.0.0")
        putDouble("dfovDegrees", 115.0)
    }

    @Test
    fun `valid map parses to CaptureSessionOpts`() {
        val opts = CaptureSessionOptsBridge.fromBridge(validMap())
        assertEquals("cooking.chopping", opts.taskId)
        assertEquals("Chopping vegetables", opts.taskName)
        assertEquals("cooking", opts.taskCategory)
        assertEquals("indoor", opts.taskSetting)
        assertEquals("Alice", opts.contributor.name)
        assertEquals("alice@example.com", opts.contributor.email)
        assertEquals(28, opts.contributor.age)
        assertEquals("female", opts.contributor.gender)
        assertEquals(true, opts.contributor.consent)
        assertEquals(false, opts.isPractice)
        assertEquals("hand_detection", opts.startGate.type)
        assertEquals(true, opts.startGate.passed)
        assertEquals(3420, opts.startGate.durationMs)
        assertEquals(5, opts.startGate.consecutiveHitsRequired)
        assertEquals(400, opts.startGate.platformCadenceMs)
        assertEquals("Bangalore, India", opts.location)
        assertEquals("1.0.0", opts.appVersion)
        assertEquals(115.0, opts.dfovDegrees, 0.0)
    }

    @Test
    fun `consent false throws consent_invalid`() {
        val m = validMap()
        // Replace the contributor sub-map with a consent=false variant.
        m.putMap(
            "contributor",
            JavaOnlyMap().apply {
                putString("name", "Alice")
                putString("email", "alice@example.com")
                putInt("age", 28)
                putString("gender", "female")
                putBoolean("consent", false)
            },
        )
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertEquals("consent_invalid", e.message)
        }
    }

    @Test
    fun `missing taskId throws invalid_opts`() {
        val m = validMap().apply { putString("taskId", "") }
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertTrue("message=${e.message}", e.message!!.contains("taskId"))
        }
    }

    @Test
    fun `taskSetting outside enum throws`() {
        val m = validMap().apply { putString("taskSetting", "garage") }
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("taskSetting"))
        }
    }

    @Test
    fun `dfovDegrees zero throws`() {
        val m = validMap().apply { putDouble("dfovDegrees", 0.0) }
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("dfovDegrees"))
        }
    }

    @Test
    fun `invalid appVersion throws`() {
        val m = validMap().apply { putString("appVersion", "not-a-version") }
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("appVersion"))
        }
    }

    @Test
    fun `null location parses as null`() {
        val m = validMap().apply { putNull("location") }
        val opts = CaptureSessionOptsBridge.fromBridge(m)
        assertEquals(null, opts.location)
    }

    @Test
    fun `null gender parses as null`() {
        val m = validMap()
        m.putMap(
            "contributor",
            JavaOnlyMap().apply {
                putString("name", "Alice")
                putString("email", "alice@example.com")
                putInt("age", 28)
                putNull("gender")
                putBoolean("consent", true)
            },
        )
        val opts = CaptureSessionOptsBridge.fromBridge(m)
        assertEquals(null, opts.contributor.gender)
    }

    @Test
    fun `missing contributor name throws invalid_opts name`() {
        val m = validMap()
        // Replace the contributor sub-map with an empty-name variant —
        // the JS-side guard in buildCaptureOpts (UAT 2026-05-13 gap
        // closure, Plan 05-15) MUST be the first observable failure for
        // an empty name; this test pins that the Kotlin bridge remains
        // a defense-in-depth backstop (T-3.3-01) that fires identically
        // if a malicious / buggy JS caller bypasses the JS guard and
        // calls NativeModules.HumynCapture.start directly with an empty
        // contributor.name.
        m.putMap(
            "contributor",
            JavaOnlyMap().apply {
                putString("name", "")
                putString("email", "alice@example.com")
                putInt("age", 28)
                putString("gender", "female")
                putBoolean("consent", true)
            },
        )
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw on empty contributor.name")
        } catch (e: IllegalArgumentException) {
            assertTrue("message=${e.message}", e.message!!.contains("invalid_opts: name"))
        }
    }

    @Test
    fun `missing contributor email throws invalid_opts email`() {
        val m = validMap()
        // Symmetric guard test — buildCaptureOpts also rejects empty
        // email at the JS layer; this pins the Kotlin defense-in-depth
        // (T-3.3-01) for the email field.
        m.putMap(
            "contributor",
            JavaOnlyMap().apply {
                putString("name", "Alice")
                putString("email", "")
                putInt("age", 28)
                putString("gender", "female")
                putBoolean("consent", true)
            },
        )
        try {
            CaptureSessionOptsBridge.fromBridge(m)
            fail("should throw on empty contributor.email")
        } catch (e: IllegalArgumentException) {
            assertTrue("message=${e.message}", e.message!!.contains("invalid_opts: email"))
        }
    }
}
