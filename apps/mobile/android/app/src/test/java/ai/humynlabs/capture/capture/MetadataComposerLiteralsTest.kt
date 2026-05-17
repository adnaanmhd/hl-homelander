package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

/**
 * Quick task 260517-p5g CAPTURE-QA-03 — literal-regression guard for
 * `MetadataComposer.compose()`. The composer now derives every spec-
 * relevant field from `FinalizeMetrics.videoReport` + `measuredMeanFps` +
 * `sidecar.recordedRotation`; this test locks in the absence of inline
 * spec literals in the `compose()` body so a future drive-by edit that
 * re-introduces `"1920x1080"` / `30` / `"hevc"` / `8_000_000` / `"cbr"` /
 * etc. breaks CI immediately.
 *
 * Tests:
 *
 *   A. Source-code grep gate (comment-stripped) — read MetadataComposer.kt
 *      as a string, strip `//` and `*` comment lines, locate the
 *      `compose()` method body, and assert that NO line contains any of
 *      the banned spec literals as a `.put(...)` second argument.
 *      Comments documenting old literals (e.g. citing the LOCKED spec)
 *      remain allowed — they're stripped before the grep.
 *
 *   B. Derivation flow — for each spec-relevant field, change the
 *      matching `FinalizeMetrics` input and assert the composed JSON
 *      changes accordingly.
 *
 *   C. b_frames defensive — even though the encoder configures
 *      `KEY_MAX_B_FRAMES=0`, a synthetic non-zero `bFramesReported`
 *      stamps `b_frames: true` so a future encoder regression that
 *      silently emits B-frames doesn't get up-stamped as `false`.
 *
 * `application = Application::class` — canonical Robolectric bypass for
 * `MainApplication.onCreate`'s SoLoader.init NPE (Phase 3+ pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class MetadataComposerLiteralsTest {

    // ----------------------------------------------------------------
    // Test A — source-code grep gate (comment-stripped).
    // ----------------------------------------------------------------

    @Test
    fun `compose() has no inline spec literals (comment-stripped grep gate)`() {
        // Locate MetadataComposer.kt relative to the test runtime cwd
        // (gradle test runs from `apps/mobile/android/app/`).
        val candidates = listOf(
            "src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt",
            "../src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt",
            "app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt",
            "apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt",
        )
        val source = candidates.map { File(it) }.firstOrNull { it.exists() }
            ?: error(
                "MetadataComposer.kt not found relative to cwd=${File(".").absolutePath}; " +
                    "tried $candidates",
            )

        // Strip comment lines so a future maintainer can document the
        // OLD literals (e.g. "// was '1920x1080'") without tripping the
        // grep gate. Single-line `//` and JavaDoc `*` lines are both
        // dropped. Block-comment `/** ... */` continuation lines are
        // covered by the `*` strip.
        val cleaned = source.readText()
            .lineSequence()
            .filterNot { line ->
                val t = line.trim()
                t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")
            }
            .joinToString("\n")

        val composeBody = extractComposeBody(cleaned)

        // Banned literals as `.put(...)` second arguments — these are the
        // spec values the composer previously hardcoded. After CAPTURE-QA-03
        // each must be derived from FinalizeMetrics. The grep checks
        // `.put("<key>", <literal>)` (allowing for variable whitespace).
        assertNoPutLiteral(composeBody, key = "resolution", literal = "\"1920x1080\"")
        assertNoPutLiteral(composeBody, key = "fps", literal = "30")
        assertNoPutLiteral(composeBody, key = "video_codec", literal = "\"hevc\"")
        assertNoPutLiteral(composeBody, key = "video_profile", literal = "\"main\"")
        assertNoPutLiteral(composeBody, key = "bitrate_bps", literal = "8_000_000")
        assertNoPutLiteral(composeBody, key = "bitrate_bps", literal = "8000000")
        assertNoPutLiteral(composeBody, key = "bitrate_mode", literal = "\"cbr\"")
        assertNoPutLiteral(composeBody, key = "gop", literal = "30")
        // color_depth_bits stays derived (videoReport.colorDepthBits) — the
        // literal 8 in the put() position would re-introduce the up-stamp
        // bug if a future Main10 encoder shipped.
        assertNoPutLiteral(composeBody, key = "color_depth_bits", literal = "8")
        assertNoPutLiteral(composeBody, key = "color_space", literal = "\"bt709\"")
        assertNoPutLiteral(composeBody, key = "b_frames", literal = "false")
        // orientation must derive from sidecar.recordedRotation — the
        // previous "landscape" literal flattened landscape_left/right.
        assertNoPutLiteral(composeBody, key = "orientation", literal = "\"landscape\"")
    }

    // ----------------------------------------------------------------
    // Test B — derivation flow (each field changes when its source changes).
    // ----------------------------------------------------------------

    @Test
    fun `resolution derives from videoReport_width and height`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(width = 1280, height = 720),
        ))
        assertEquals("1280x720", md.getString("resolution"))
        val md2 = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(width = 3840, height = 2160),
        ))
        assertEquals("3840x2160", md2.getString("resolution"))
    }

    @Test
    fun `fps derives from measuredMeanFps`() {
        val md = compose(fixtureMetrics().copy(measuredMeanFps = 29.97))
        assertEquals(29.97, md.getDouble("fps"), 0.0001)
        val md2 = compose(fixtureMetrics().copy(measuredMeanFps = 25.0))
        assertEquals(25.0, md2.getDouble("fps"), 0.0001)
    }

    @Test
    fun `video_codec derives from videoReport_codec`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(codec = "h264"),
        ))
        assertEquals("h264", md.getString("video_codec"))
    }

    @Test
    fun `video_profile derives from videoReport_profile`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(profile = "main10"),
        ))
        assertEquals("main10", md.getString("video_profile"))
    }

    @Test
    fun `bitrate_bps and bitrate_source derive from videoReport`() {
        // Reported branch.
        val mdReported = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bitrateBps = 7_500_000),
        ))
        assertEquals(7_500_000, mdReported.getInt("bitrate_bps"))
        assertEquals("reported", mdReported.getString("bitrate_source"))
        // Configured (fallback) branch.
        val mdConfigured = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bitrateBps = null, bitrateBpsConfigured = 8_000_000),
        ))
        assertEquals(8_000_000, mdConfigured.getInt("bitrate_bps"))
        assertEquals("configured", mdConfigured.getString("bitrate_source"))
    }

    @Test
    fun `bitrate_mode derives from videoReport_bitrateModeToken`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bitrateModeToken = "vbr"),
        ))
        assertEquals("vbr", md.getString("bitrate_mode"))
    }

    @Test
    fun `gop derives from videoReport_gopFrames`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(gopFrames = 60),
        ))
        assertEquals(60, md.getInt("gop"))
    }

    @Test
    fun `color_depth_bits derives from videoReport_colorDepthBits`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(colorDepthBits = 10),
        ))
        assertEquals(10, md.getInt("color_depth_bits"))
    }

    @Test
    fun `color_space derives from videoReport_colorStandardToken`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(colorStandardToken = "bt2020"),
        ))
        assertEquals("bt2020", md.getString("color_space"))
    }

    @Test
    fun `orientation derives from sidecar_recordedRotation`() {
        val md = composeWith(
            fixtureSidecar().copy(recordedRotation = "landscape_right"),
            fixtureMetrics(),
        )
        assertEquals("landscape_right", md.getString("orientation"))
    }

    // ----------------------------------------------------------------
    // Test C — b_frames defensive (encoder reports non-zero → stamps true).
    // ----------------------------------------------------------------

    @Test
    fun `b_frames is true when encoder reported MAX_B_FRAMES gt 0`() {
        val md = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bFramesReported = 5),
        ))
        assertTrue(md.getBoolean("b_frames"))
    }

    @Test
    fun `b_frames is false when encoder reported MAX_B_FRAMES = 0 or null`() {
        val md0 = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bFramesReported = 0),
        ))
        assertFalse(md0.getBoolean("b_frames"))
        val mdNull = compose(fixtureMetrics().copy(
            videoReport = fixtureVideoReport().copy(bFramesReported = null),
        ))
        assertFalse(mdNull.getBoolean("b_frames"))
    }

    // ----------------------------------------------------------------
    // Allowed-literal sanity (hdr + image_stabilization stay literal —
    // they're CAMERA flags verified at compat-check time).
    // ----------------------------------------------------------------

    @Test
    fun `hdr and image_stabilization stay configured-literal (camera flags)`() {
        val md = compose(fixtureMetrics())
        // These are camera flags, NOT encoder flags. EncoderProbe's
        // hdrSdrForced / oisOff readbacks are the truth-source at compat-
        // check time. The composer leaves them as literal `false` with an
        // inline comment citing the truth-source.
        assertFalse(md.getBoolean("hdr"))
        assertFalse(md.getBoolean("image_stabilization"))
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private fun extractComposeBody(source: String): String {
        // Locate the `fun compose(...)` declaration and grab everything
        // until the matching closing brace. Brace-counted so a JSONObject
        // method-chain `.apply { ... }` doesn't fool the search.
        val openMarker = "fun compose("
        val openIdx = source.indexOf(openMarker)
        require(openIdx >= 0) { "compose() not found in MetadataComposer.kt" }
        val braceOpenIdx = source.indexOf('{', startIndex = openIdx)
        require(braceOpenIdx >= 0) { "compose() body brace not found" }
        var depth = 1
        var i = braceOpenIdx + 1
        while (i < source.length && depth > 0) {
            when (source[i]) {
                '{' -> depth += 1
                '}' -> depth -= 1
            }
            i += 1
        }
        return source.substring(braceOpenIdx, i)
    }

    private fun assertNoPutLiteral(body: String, key: String, literal: String) {
        // Match `.put("<key>", <literal>` with arbitrary whitespace.
        val pattern = """\.put\(\s*"$key"\s*,\s*$literal""".toRegex()
        val match = pattern.find(body)
        if (match != null) {
            error(
                "compose() carries a forbidden literal: '.put(\"$key\", $literal' at " +
                    "offset ${match.range.first}. CAPTURE-QA-03 requires every spec-relevant " +
                    "field to derive from FinalizeMetrics (videoReport / measuredMeanFps / " +
                    "sidecar.recordedRotation).",
            )
        }
    }

    private fun fixtureVideoReport() = MetadataComposer.VideoReport(
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
    )

    private fun fixtureMetrics() = MetadataComposer.FinalizeMetrics(
        mp4Sha = "0".repeat(64),
        csvSha = "1".repeat(64),
        mp4SizeBytes = 1L,
        csvSizeBytes = 1L,
        drift = null,
        imuFloorHz = 200.0,
        gyroRateHz = 416,
        accelRateHz = 416,
        mp4Filename = "x.mp4",
        csvFilename = "x.csv",
        durationSeconds = 60.0,
        startTimestampIso = "2026-05-17T00:00:00.000+05:30",
        endTimestampIso = "2026-05-17T00:01:00.000+05:30",
        imuStartTimestampIso = "2026-05-17T00:00:00.000+05:30",
        imuEndTimestampIso = "2026-05-17T00:01:00.000+05:30",
        environment = "residential",
        timeOfDay = "day",
        measuredMeanFps = 30.0,
        videoReport = fixtureVideoReport(),
        recordedRotation = "landscape_left",
    )

    private fun fixtureSidecar() = MetadataComposer.SidecarPayload(
        schemaVersion = "1.0.0",
        sessionId = "01JABCSESSION-LITERALS-TEST",
        segmentId = "01JABCSEGMENT-LITERALS-TEST",
        recordingId = "01JABCRECID-LITERALS-TEST",
        filenameBase = "20260517_000000_001",
        startedAtNs = 1L,
        wallclockStartIso = "2026-05-17T00:00:00.000+05:30",
        isPractice = false,
        taskInfoPartial = MetadataComposer.TaskInfoPartial(
            "cooking.chopping", "Chopping", "cooking", "indoor",
        ),
        contributorInfo = MetadataComposer.ContributorInfo(
            "Alice", "alice@example.com", 26, "female", true,
        ),
        startGate = MetadataComposer.StartGate(
            "hand_detection", true, false, false, 3420, 5, 400,
        ),
        captureDeviceInfoPartial = MetadataComposer.CaptureDeviceInfoPartial(
            "phone", "Pixel 10a", "android", "14", "1.0.0", 115.0, null, "Bangalore, India",
        ),
        recordedRotation = "landscape_left",
    )

    private fun compose(metrics: MetadataComposer.FinalizeMetrics) =
        composeWith(fixtureSidecar(), metrics)

    private fun composeWith(
        sidecar: MetadataComposer.SidecarPayload,
        metrics: MetadataComposer.FinalizeMetrics,
    ) = MetadataComposer.compose(sidecar, metrics).getJSONObject("metadata")
}
