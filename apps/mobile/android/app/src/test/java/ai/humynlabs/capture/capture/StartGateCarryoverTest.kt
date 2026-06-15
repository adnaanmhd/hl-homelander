package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Plan 03-10 Task 2 — CAP-10: `start_gate` block carries verbatim across
 * auto-segment cuts via the per-session `.session.json` sidecar (D-FS-05).
 *
 * The hand-gate runs ONCE at session start; auto-segment cuts inherit
 * the same gate result. The invariant: every segment in a session
 * stamps the identical `start_gate` block into its `video_metadata.json`.
 *
 * Mechanism: `CaptureSession.openSegment` writes the JS-supplied
 * `startGate` opts into the segment's sidecar; `MetadataComposer.compose`
 * reads `start_gate` verbatim from the sidecar and writes it into the
 * `metadata.start_gate` JSON block — byte-identical across segments
 * since both reads pull from the same opts object via the sidecar.
 *
 * Robolectric — `application = Application::class` bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE (Plan 03-04 pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class StartGateCarryoverTest {

    private fun fixtureMetrics() = MetadataComposer.FinalizeMetrics(
        mp4SizeBytes = 1L,
        csvSizeBytes = 1L,
        drift = null,
        imuFloorHz = 200.0,
        gyroRateHz = 416,
        accelRateHz = 416,
        mp4Filename = "x.mp4",
        csvFilename = "x.csv",
        durationSeconds = 600.0,
        startTimestampIso = "2026-05-05T00:30:20.000+05:30",
        endTimestampIso = "2026-05-05T00:40:20.000+05:30",
        imuStartTimestampIso = "2026-05-05T00:30:20.000+05:30",
        imuEndTimestampIso = "2026-05-05T00:40:20.000+05:30",
        environment = "residential",
        timeOfDay = "day",
        // Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-03 — measured
        // values that the composer now reads from the FinalizeMetrics
        // (previously hardcoded inside compose()).
        measuredMeanFps = 30.0,
        videoReport = MetadataComposer.VideoReport(
            width = 1920,
            height = 1080,
            codec = "hevc",
            profile = "main",
            bitrateBps = 8_000_000,
            bitrateBpsConfigured = 8_000_000,
            bitrateModeToken = "cbr",
            gopFrames = 30,
            colorStandardToken = "bt709",
            colorTransferToken = "sdr",
            colorRangeToken = "limited",
            colorDepthBits = 8,
            bFramesReported = 0,
        ),
        recordedRotation = "landscape_left",
    )

    /**
     * Adapts the package-level [SidecarPayload] (the type
     * SidecarManager writes) into the nested
     * [MetadataComposer.SidecarPayload] (the type MetadataComposer.compose
     * consumes). FinalizeWorker performs the same adapt at runtime —
     * the exact one-to-one mapping is the invariant under test.
     */
    private fun fixtureSidecar(
        segmentId: String,
        recordingId: String,
        filenameBase: String,
        gate: StartGate,
    ): MetadataComposer.SidecarPayload = MetadataComposer.SidecarPayload(
        schemaVersion = "1.0.0",
        sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
        segmentId = segmentId,
        recordingId = recordingId,
        filenameBase = filenameBase,
        startedAtNs = 1L,
        wallclockStartIso = "2026-05-05T00:30:20.000+05:30",
        isPractice = false,
        taskInfoPartial = MetadataComposer.TaskInfoPartial(
            "cooking.chopping", "Chopping", "cooking", "indoor",
        ),
        contributorInfo = MetadataComposer.ContributorInfo(
            "Alice", "alice@example.com", 26, "female", true,
        ),
        startGate = MetadataComposer.StartGate(
            gate.type,
            gate.passed,
            gate.skipped,
            gate.bypassed,
            gate.durationMs,
            gate.consecutiveHitsRequired,
            gate.platformCadenceMs,
        ),
        captureDeviceInfoPartial = MetadataComposer.CaptureDeviceInfoPartial(
            "phone", "Pixel 10a", "android", "14", "1.0.0", 115.0, null, null,
        ),
    )

    @Test
    fun `start_gate JSON block is byte-identical across two segments`() {
        // Same gate result, different segment + recording IDs (CAP-09 — each
        // segment owns its own recording_id).
        val gate = StartGate(
            type = "hand_detection",
            passed = true,
            skipped = false,
            bypassed = false,
            durationMs = 3420,
            consecutiveHitsRequired = 5,
            platformCadenceMs = 400,
        )
        val sidecar1 = fixtureSidecar(
            segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
            recordingId = "01JABCRECID1XXXXXXXXXXXXXXX",
            filenameBase = "20260505_003020_001",
            gate = gate,
        )
        val sidecar2 = fixtureSidecar(
            segmentId = "01JABCSEGMENT2XXXXXXXXXXXXX",
            recordingId = "01JABCRECID2XXXXXXXXXXXXXXX",
            filenameBase = "20260505_004020_002",
            gate = gate,
        )
        val metrics = fixtureMetrics()
        val json1Gate = MetadataComposer
            .compose(sidecar1, metrics)
            .getJSONObject("metadata")
            .getJSONObject("start_gate")
        val json2Gate = MetadataComposer
            .compose(sidecar2, metrics)
            .getJSONObject("metadata")
            .getJSONObject("start_gate")
        assertEquals(
            "start_gate JSON must be byte-identical across segments (CAP-10)",
            json1Gate.toString(),
            json2Gate.toString(),
        )
    }

    @Test
    fun `start_gate carries verbatim from sidecar to metadata JSON`() {
        // Round-trip: the gate fields the sidecar carries equal the values
        // the metadata.start_gate block writes out.
        val gate = StartGate("hand_detection", false, true, false, 2_750, 4, 333)
        val sidecar = fixtureSidecar(
            segmentId = "g1",
            recordingId = "r1",
            filenameBase = "20260505_003020_001",
            gate = gate,
        )
        val block = MetadataComposer
            .compose(sidecar, fixtureMetrics())
            .getJSONObject("metadata")
            .getJSONObject("start_gate")
        assertEquals("hand_detection", block.getString("type"))
        assertEquals(false, block.getBoolean("passed"))
        assertEquals(true, block.getBoolean("skipped"))
        assertEquals(false, block.getBoolean("bypassed"))
        assertEquals(2_750, block.getInt("duration_ms"))
        assertEquals(4, block.getInt("consecutive_hits_required"))
        assertEquals(333, block.getInt("platform_cadence_ms"))
    }
}
