package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-05 Task 3 — `SidecarManager` round-trips the per-segment
 * `.session.json` schema verbatim (D-FS-05; CONTEXT.md `<specifics>`).
 *
 * Behavior contract (PLAN.md `<behavior>`):
 *  - write(file, opts) → JSON file with all D-FS-05 schema fields.
 *  - read(file) → equivalent SidecarPayload struct.
 *  - read of corrupt JSON throws IllegalArgumentException("sidecar_corrupt").
 *  - Round-trip preserves consent: true and schema_version: 1.0.0.
 *  - delete(file) removes the file.
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class SidecarManagerTest {
    private val ctx = RuntimeEnvironment.getApplication()

    private fun fixturePayload() = SidecarPayload(
        schemaVersion = SidecarManager.CURRENT_SCHEMA_VERSION,
        sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
        segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
        recordingId = "01JABCRECID1XXXXXXXXXXXXXXX",
        filenameBase = "20260505_003020_001",
        startedAtNs = 12345678901234L,
        wallclockStartIso = "2026-05-05T00:30:20.000+05:30",
        isPractice = false,
        taskInfoPartial = TaskInfoPartial("cooking.chopping", "Chopping", "cooking", "indoor"),
        contributorInfo = ContributorInfo("Alice", "alice@example.com", 26, "female", true),
        startGate = StartGate("hand_detection", true, false, false, 3420, 5, 400),
        captureDeviceInfoPartial = CaptureDeviceInfoPartial(
            "phone", "Pixel 10a", "android", "19.4.2", "1.0.0", 115.0, null, "Bangalore, India",
        ),
    )

    @Test
    fun `write then read round-trip`() {
        val f = File(ctx.cacheDir, "session.json")
        SidecarManager.write(f, fixturePayload())
        val loaded = SidecarManager.read(f)
        assertEquals(fixturePayload(), loaded)
        assertEquals("1.0.0", loaded.schemaVersion)
        assertTrue(loaded.contributorInfo.consent)
    }

    @Test
    fun `corrupt JSON throws sidecar_corrupt`() {
        val f = File(ctx.cacheDir, "bad.json").apply {
            writeText("{ \"schema_version\": \"1.0.0\", \"session_id\":")
        }
        try {
            SidecarManager.read(f)
            fail("should throw")
        } catch (e: IllegalArgumentException) {
            assertEquals("sidecar_corrupt", e.message)
        }
    }

    @Test
    fun `null fields round-trip`() {
        val f = File(ctx.cacheDir, "nulls.json")
        val p = fixturePayload().copy(
            contributorInfo = ContributorInfo("Alice", "alice@example.com", null, null, true),
        )
        SidecarManager.write(f, p)
        val loaded = SidecarManager.read(f)
        assertNull(loaded.contributorInfo.age)
        assertNull(loaded.contributorInfo.gender)
    }

    @Test
    fun `delete removes file`() {
        val f = File(ctx.cacheDir, "todelete.json")
        SidecarManager.write(f, fixturePayload())
        assertTrue(f.exists())
        assertTrue(SidecarManager.delete(f))
        assertFalse(f.exists())
    }
}
