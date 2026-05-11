package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-09 Task 2 — `CaptureLaunchSweep` orphan recovery sweep
 * (D-FS-04 from CONTEXT.md).
 *
 * Behavior contract (PLAN.md `<behavior>`):
 *  - recordings/[base].mp4 without matching .json:
 *      - if .session.json sidecar exists AND parseable, leave for Phase 4 re-finalize
 *      - if sidecar corrupt or missing, delete the triple
 *  - recordings/[base].json (non-sidecar) without matching .mp4, delete (orphan JSON)
 *  - practice/[any] files older than 24 h, delete; fresh ones kept
 *  - complete triples (.mp4 + .csv + .json), untouched
 *
 * `application = Application::class` — bypasses MainApplication.onCreate
 * SoLoader.init NPE under Robolectric (canonical Phase 3 pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class CaptureLaunchSweepTest {
    private lateinit var filesDir: File
    private lateinit var recordingsDir: File
    private lateinit var practiceDir: File

    private fun fixtureSidecarPayload(filenameBase: String) = SidecarPayload(
        schemaVersion = SidecarManager.CURRENT_SCHEMA_VERSION,
        sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
        segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
        recordingId = "01JABCRECID1XXXXXXXXXXXXXXX",
        filenameBase = filenameBase,
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

    @Before
    fun setUp() {
        filesDir = File(RuntimeEnvironment.getApplication().filesDir, "sweep-test-${System.nanoTime()}")
        filesDir.mkdirs()
        recordingsDir = File(filesDir, "recordings").apply { mkdirs() }
        practiceDir = File(filesDir, "practice").apply { mkdirs() }
    }

    @Test
    fun `orphan mp4 without sidecar deletes triple`() {
        val base = "20260510_001"
        val mp4 = File(recordingsDir, "$base.mp4").apply { writeText("fake mp4 bytes") }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        // No .json, no .session.json → triple should be deleted.

        CaptureLaunchSweep(filesDir).run()

        assertFalse("mp4 should be deleted", mp4.exists())
        assertFalse("csv should be deleted", csv.exists())
    }

    @Test
    fun `orphan mp4 with valid sidecar leaves triple intact`() {
        val base = "20260510_002"
        val mp4 = File(recordingsDir, "$base.mp4").apply { writeText("fake mp4 bytes") }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        val sidecar = File(recordingsDir, "$base.session.json")
        SidecarManager.write(sidecar, fixtureSidecarPayload(base))

        CaptureLaunchSweep(filesDir).run()

        assertTrue("mp4 should be preserved (Phase 4 re-finalize candidate)", mp4.exists())
        assertTrue("csv should be preserved", csv.exists())
        assertTrue("sidecar should be preserved", sidecar.exists())
    }

    @Test
    fun `orphan mp4 with corrupt sidecar deletes triple`() {
        val base = "20260510_003"
        val mp4 = File(recordingsDir, "$base.mp4").apply { writeText("fake mp4 bytes") }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        val sidecar = File(recordingsDir, "$base.session.json").apply {
            writeText("{ \"schema_version\": \"1.0.0\", \"session_id\":")
        }

        CaptureLaunchSweep(filesDir).run()

        assertFalse("mp4 should be deleted on corrupt sidecar", mp4.exists())
        assertFalse("csv should be deleted on corrupt sidecar", csv.exists())
        assertFalse("corrupt sidecar should be deleted", sidecar.exists())
    }

    @Test
    fun `orphan json without mp4 deletes`() {
        val base = "20260510_004"
        val json = File(recordingsDir, "$base.json").apply { writeText("{}") }
        // No matching .mp4 → orphan JSON should be deleted.

        CaptureLaunchSweep(filesDir).run()

        assertFalse("orphan json should be deleted", json.exists())
    }

    @Test
    fun `practice file older than 24h deletes - fresh kept`() {
        val old = File(practiceDir, "old.mp4").apply {
            writeText("old practice")
            setLastModified(System.currentTimeMillis() - 25L * 60L * 60L * 1000L)
        }
        val fresh = File(practiceDir, "fresh.mp4").apply {
            writeText("fresh practice")
            setLastModified(System.currentTimeMillis() - 60L * 1000L)
        }

        CaptureLaunchSweep(filesDir).run()

        assertFalse("old practice file should be deleted", old.exists())
        assertTrue("fresh practice file should be kept", fresh.exists())
    }

    @Test
    fun `complete triple is untouched`() {
        val base = "20260510_005"
        val mp4 = File(recordingsDir, "$base.mp4").apply { writeText("fake mp4 bytes") }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        val json = File(recordingsDir, "$base.json").apply { writeText("{}") }

        CaptureLaunchSweep(filesDir).run()

        assertTrue("mp4 preserved", mp4.exists())
        assertTrue("csv preserved", csv.exists())
        assertTrue("json preserved", json.exists())
    }

    @Test
    fun `sweep is idempotent on missing dirs`() {
        // Delete the freshly-created dirs to simulate a first-launch state.
        recordingsDir.delete()
        practiceDir.delete()

        // Should not throw — and the recovered list is empty.
        val recovered = CaptureLaunchSweep(filesDir).run()
        assertTrue("no recovered candidates on a first-launch state", recovered.isEmpty())
    }

    // -------------------------------------------------------------------------
    // Phase 4 D-LIFE-04 (plan 04-10) — run() returns the orphan-with-valid-
    // sidecar bases (the re-finalize candidates) so MainApplication can stash
    // them in CaptureLaunchSweep.pendingRecovery → HumynCaptureModule emits the
    // one-shot onCrashRecovery event for the Home toast. The on-device emit path
    // (Arguments.createMap / RCTDeviceEventEmitter) can't be exercised under
    // Robolectric — that's covered by 04-MANUAL-SMOKE.md §4(e). These tests lock
    // the run()-return contract.
    // -------------------------------------------------------------------------

    @Test
    fun `run returns the base of an orphan mp4 with a valid sidecar`() {
        val base = "20260510_900"
        File(recordingsDir, "$base.mp4").apply { writeText("fake mp4 bytes") }
        File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertEquals(listOf(base), recovered)
    }

    @Test
    fun `run does not return bases for corrupt-sidecar or no-sidecar orphans`() {
        // Orphan with corrupt sidecar — discarded, not a recovery candidate.
        val corrupt = "20260510_901"
        File(recordingsDir, "$corrupt.mp4").apply { writeText("x") }
        File(recordingsDir, "$corrupt.csv").apply { writeText("x") }
        File(recordingsDir, "$corrupt.session.json").apply { writeText("{ broken") }
        // Orphan with no sidecar — discarded, not a recovery candidate.
        val nosidecar = "20260510_902"
        File(recordingsDir, "$nosidecar.mp4").apply { writeText("x") }
        File(recordingsDir, "$nosidecar.csv").apply { writeText("x") }
        // A complete triple — not an orphan at all.
        val complete = "20260510_903"
        File(recordingsDir, "$complete.mp4").apply { writeText("x") }
        File(recordingsDir, "$complete.csv").apply { writeText("x") }
        File(recordingsDir, "$complete.json").apply { writeText("{}") }

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertTrue("no recovery candidates among corrupt/no-sidecar/complete", recovered.isEmpty())
    }

    @Test
    fun `run returns all orphan-with-valid-sidecar bases when several exist`() {
        val a = "20260510_910"
        val b = "20260510_911"
        for (base in listOf(a, b)) {
            File(recordingsDir, "$base.mp4").apply { writeText("x") }
            File(recordingsDir, "$base.csv").apply { writeText("x") }
            SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))
        }

        val recovered = CaptureLaunchSweep(filesDir).run().sorted()

        assertEquals(listOf(a, b), recovered)
    }

    @Test
    fun `pendingRecovery holder round-trips a recovered list`() {
        // Mirrors MainApplication.onCreate → HumynCaptureModule.onHostResume:
        // onCreate sets the holder from run(); onHostResume reads it once + nulls it.
        val base = "20260510_920"
        File(recordingsDir, "$base.mp4").apply { writeText("x") }
        File(recordingsDir, "$base.csv").apply { writeText("x") }
        SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))

        CaptureLaunchSweep.pendingRecovery = CaptureLaunchSweep(filesDir).run()
        assertEquals(listOf(base), CaptureLaunchSweep.pendingRecovery)

        // Drain (what onHostResume does).
        val drained = CaptureLaunchSweep.pendingRecovery
        CaptureLaunchSweep.pendingRecovery = null
        assertEquals(listOf(base), drained)
        assertTrue("holder cleared after drain", CaptureLaunchSweep.pendingRecovery == null)
    }
}
