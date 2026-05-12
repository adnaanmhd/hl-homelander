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
import java.io.RandomAccessFile

/**
 * Plan 03-09 Task 2 — `CaptureLaunchSweep` orphan recovery sweep
 * (D-FS-04 from CONTEXT.md). Updated 2026-05-12 for the Phase-4 on-hardware
 * smoke fix round (bugs 3(b)/3(c)):
 *   - an orphan `.mp4` + valid `.session.json` is now actually RE-FINALIZED:
 *       • playable mp4 (`ftyp` + `moov` + ≥1 `moof`) → `{base}.json` written,
 *         sidecar deleted, base reported as "recovered";
 *       • stub / incomplete mp4 (the force-quit case the smoke walk hit: a
 *         778-byte stub with no `moov`) → triple discarded, NOT "recovered".
 *   - an orphan `.session.json` with NO matching `.mp4` is now swept (Pass 3).
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

    /** Write a single ISO-BMFF box (`size:uint32` + `type:4cc` + `body`). */
    private fun writeBox(raf: RandomAccessFile, type: String, body: ByteArray) {
        require(type.length == 4)
        raf.writeInt(8 + body.size)
        raf.write(type.toByteArray(Charsets.US_ASCII))
        raf.write(body)
    }

    /** A minimal "playable-looking" fragmented mp4: `ftyp` + `moov` + `moof` + `mdat`. */
    private fun writePlayableMp4(file: File) {
        RandomAccessFile(file, "rw").use { raf ->
            raf.setLength(0)
            writeBox(raf, "ftyp", "isom".toByteArray(Charsets.US_ASCII) + byteArrayOf(0, 0, 0, 0))
            writeBox(raf, "moov", ByteArray(32)) // body contents irrelevant to the scanner
            writeBox(raf, "moof", ByteArray(16))
            writeBox(raf, "mdat", ByteArray(64))
        }
    }

    /** A force-quit stub: a short blob with no `moov`/`moof` (mirrors the on-hardware 778-byte stub). */
    private fun writeStubMp4(file: File) = file.writeBytes(ByteArray(778))

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
    fun `orphan stub-mp4 with valid sidecar is discarded (force-quit case)`() {
        val base = "20260510_002"
        val mp4 = File(recordingsDir, "$base.mp4").also { writeStubMp4(it) }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        val sidecar = File(recordingsDir, "$base.session.json")
        SidecarManager.write(sidecar, fixtureSidecarPayload(base))

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertFalse("stub mp4 is unrecoverable → discarded", mp4.exists())
        assertFalse("csv discarded with the stub", csv.exists())
        assertFalse("sidecar discarded with the stub", sidecar.exists())
        assertTrue("a discarded stub is NOT a recovery candidate", recovered.isEmpty())
        assertFalse("no metadata json was written for a stub", File(recordingsDir, "$base.json").exists())
    }

    @Test
    fun `orphan playable-mp4 with valid sidecar is re-finalized into a triple`() {
        val base = "20260510_002b"
        val mp4 = File(recordingsDir, "$base.mp4").also { writePlayableMp4(it) }
        val csv = File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        val sidecar = File(recordingsDir, "$base.session.json")
        SidecarManager.write(sidecar, fixtureSidecarPayload(base))

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertTrue("mp4 preserved", mp4.exists())
        assertTrue("csv preserved", csv.exists())
        assertTrue("metadata json written from the sidecar", File(recordingsDir, "$base.json").exists())
        assertFalse("sidecar deleted once the triple is complete", sidecar.exists())
        assertEquals("re-finalized base is reported as recovered", listOf(base), recovered)
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
    fun `orphan session-json sidecar with no mp4 is swept (bug 3c)`() {
        val base = "20260510_021403_004"
        val sidecar = File(recordingsDir, "$base.session.json")
        SidecarManager.write(sidecar, fixtureSidecarPayload(base))
        // A lone CSV residue with no mp4 either.
        val csv = File(recordingsDir, "$base.csv").apply { writeText("imu csv residue") }

        CaptureLaunchSweep(filesDir).run()

        assertFalse("lone .session.json with no .mp4 should be deleted", sidecar.exists())
        assertFalse("lone .csv residue should be deleted too", csv.exists())
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
    // Phase 4 D-LIFE-04 — run() returns the bases that were actually
    // re-finalized into usable triples (a stub-mp4 orphan is discarded, not
    // "recovered"). MainApplication.onCreate stashes them in
    // CaptureLaunchSweep.pendingRecovery → HumynCaptureModule emits the
    // one-shot onCrashRecovery event for the Home toast (and exposes the same
    // list via getPendingRecovery() — see HumynCapture.test.ts). The on-device
    // emit path can't be exercised under Robolectric — 04-MANUAL-SMOKE.md §4(e).
    // -------------------------------------------------------------------------

    @Test
    fun `run returns the base of a re-finalized playable orphan`() {
        val base = "20260510_900"
        File(recordingsDir, "$base.mp4").also { writePlayableMp4(it) }
        File(recordingsDir, "$base.csv").apply { writeText("fake csv bytes") }
        SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertEquals(listOf(base), recovered)
    }

    @Test
    fun `run does not return bases for stub-mp4 or corrupt-sidecar or no-sidecar orphans`() {
        // Stub mp4 (force-quit case) — discarded, not a recovery candidate.
        val stub = "20260510_900s"
        File(recordingsDir, "$stub.mp4").also { writeStubMp4(it) }
        File(recordingsDir, "$stub.csv").apply { writeText("x") }
        SidecarManager.write(File(recordingsDir, "$stub.session.json"), fixtureSidecarPayload(stub))
        // Orphan with corrupt sidecar — discarded.
        val corrupt = "20260510_901"
        File(recordingsDir, "$corrupt.mp4").apply { writeText("x") }
        File(recordingsDir, "$corrupt.csv").apply { writeText("x") }
        File(recordingsDir, "$corrupt.session.json").apply { writeText("{ broken") }
        // Orphan with no sidecar — discarded.
        val nosidecar = "20260510_902"
        File(recordingsDir, "$nosidecar.mp4").apply { writeText("x") }
        File(recordingsDir, "$nosidecar.csv").apply { writeText("x") }
        // A complete triple — not an orphan at all.
        val complete = "20260510_903"
        File(recordingsDir, "$complete.mp4").apply { writeText("x") }
        File(recordingsDir, "$complete.csv").apply { writeText("x") }
        File(recordingsDir, "$complete.json").apply { writeText("{}") }

        val recovered = CaptureLaunchSweep(filesDir).run()

        assertTrue("no recovery candidates among stub/corrupt/no-sidecar/complete", recovered.isEmpty())
    }

    @Test
    fun `run returns all re-finalized bases when several exist`() {
        val a = "20260510_910"
        val b = "20260510_911"
        for (base in listOf(a, b)) {
            File(recordingsDir, "$base.mp4").also { writePlayableMp4(it) }
            File(recordingsDir, "$base.csv").apply { writeText("x") }
            SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))
        }

        val recovered = CaptureLaunchSweep(filesDir).run().sorted()

        assertEquals(listOf(a, b), recovered)
    }

    @Test
    fun `pendingRecovery holder round-trips a recovered list`() {
        // Mirrors MainApplication.onCreate → HumynCaptureModule.onHostResume:
        // onCreate sets the holder from run(); onHostResume reads it (and emits).
        val base = "20260510_920"
        File(recordingsDir, "$base.mp4").also { writePlayableMp4(it) }
        File(recordingsDir, "$base.csv").apply { writeText("x") }
        SidecarManager.write(File(recordingsDir, "$base.session.json"), fixtureSidecarPayload(base))

        CaptureLaunchSweep.pendingRecovery = CaptureLaunchSweep(filesDir).run()
        assertEquals(listOf(base), CaptureLaunchSweep.pendingRecovery)

        // Drain (what onHostResume / getPendingRecovery surface).
        val drained = CaptureLaunchSweep.pendingRecovery
        assertEquals(listOf(base), drained)
        CaptureLaunchSweep.pendingRecovery = null
        assertTrue("holder cleared after drain", CaptureLaunchSweep.pendingRecovery == null)
    }
}
