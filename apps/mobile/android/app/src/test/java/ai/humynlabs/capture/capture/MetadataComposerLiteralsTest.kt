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
    // Test D — BUG-260518-04: codec priority chain (extractor → encoder → configured).
    //
    // The Pixel 8a + 10a apkRollout 22ffec5 walk on 2026-05-18 stamped
    // every one of 15 verified segments with `video_codec: "unknown"`
    // even though every other OUTPUT_FORMAT-derived field
    // (`video_profile = "main"`, `bitrate_bps = 8000000`,
    //  `bitrate_mode = "cbr"`, `gop = 30`, `b_frames = false`,
    //  `color_space = "bt709"`, `color_depth_bits = 8`) populated
    // correctly. Root cause: `encoder.outputFormat.getString(KEY_MIME)`
    // returns null on those encoders even though the OUTPUT_FORMAT
    // snapshot otherwise populates. The fix derives codec from the
    // muxed MP4's MediaExtractor track-header MIME (the spec-compliant
    // CAPTURE-QA-01 truth source) with the encoder OUTPUT_FORMAT MIME
    // as a secondary source and `HevcEncoder.MIME` as a last-resort
    // fallback. These tests lock in the priority chain.
    // ----------------------------------------------------------------

    @Test
    fun `chooseCodecToken — extractor MIME wins when present`() {
        val token = MetadataComposer.chooseCodecToken(
            extractorMime = "video/hevc",
            encoderMime = null,
            configuredMime = "video/hevc",
        )
        assertEquals("hevc", token)
    }

    @Test
    fun `chooseCodecToken — falls back to encoder MIME when extractor is null (BUG-260518-04 regression)`() {
        // The Pixel 8a + 10a apkRollout 22ffec5 case: extractor returns
        // null (e.g. MediaExtractor.setDataSource threw on a still-being-
        // written MP4 in some race window) AND encoder OUTPUT_FORMAT
        // populates KEY_MIME correctly. Codec must still resolve to
        // "hevc" via the encoder source. (In the actual walk both
        // sources were intermittent — this test exercises the encoder
        // fallback in isolation.)
        val token = MetadataComposer.chooseCodecToken(
            extractorMime = null,
            encoderMime = "video/hevc",
            configuredMime = "video/hevc",
        )
        assertEquals("hevc", token)
    }

    @Test
    fun `chooseCodecToken — falls back to configured MIME when both extractor and encoder are null`() {
        // The Pixel 8a + 10a apkRollout 22ffec5 ROOT case: extractor
        // returned null (the MP4 may not have flushed its track header
        // yet at finalize time on some encoders) AND encoder OUTPUT_FORMAT
        // KEY_MIME = null. The configured constant (HevcEncoder.MIME =
        // MediaFormat.MIMETYPE_VIDEO_HEVC) is the last-resort truth — we
        // literally called `MediaCodec.createEncoderByType(MIME)` so the
        // encoder cannot have produced any other codec.
        val token = MetadataComposer.chooseCodecToken(
            extractorMime = null,
            encoderMime = null,
            configuredMime = android.media.MediaFormat.MIMETYPE_VIDEO_HEVC,
        )
        assertEquals("hevc", token)
    }

    @Test
    fun `chooseCodecToken — returns unknown only when all three sources are null`() {
        // This path requires the MP4 to be unreadable AND the encoder to
        // report nothing AND the caller to pass no configured constant —
        // a case that in production cannot reach compose() because the
        // upstream resolution gate (width<1920) would have already
        // canceled the segment. The test exists to prove "unknown" is
        // not an arbitrary fallback any more.
        val token = MetadataComposer.chooseCodecToken(
            extractorMime = null,
            encoderMime = null,
            configuredMime = null,
        )
        assertEquals("unknown", token)
    }

    @Test
    fun `chooseCodecToken — extractor MIME beats a conflicting encoder MIME`() {
        // If the muxer for some reason committed H.264 (impossible with
        // HevcEncoder, but the fix must be source-of-truth-faithful), the
        // metadata reflects what was MUXED, not what the encoder snapshot
        // claims. CAPTURE-QA-01 principle: metadata reflects measured
        // reality of the file the training pipeline reads.
        val token = MetadataComposer.chooseCodecToken(
            extractorMime = "video/avc",
            encoderMime = "video/hevc",
            configuredMime = "video/hevc",
        )
        assertEquals("h264", token)
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
    // Test E — quick 260522-elm calibration block (CAPTURE-QA-08/09).
    //
    // The calibration block is purely additive and introduces NONE of the
    // banned spec literals — the grep gate (Test A) stays green unchanged
    // because the block's `.put(...)` keys (model / params / fx / etc.)
    // live in CalibrationJson, not the compose() body. These tests confirm
    // the block is ALWAYS present with the null-fallback contract and that
    // the drift fields are untouched.
    // ----------------------------------------------------------------

    @Test
    fun `compose ALWAYS emits a top-level calibration block with null fallback`() {
        // fixtureSidecar carries no calibration (null) → uncalibrated fallback.
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val cal = out.getJSONObject("calibration")
        val cam = cal.getJSONObject("camera")
        assertEquals("camera2_uncalibrated", cam.getString("intrinsics_source"))
        assertTrue(cam.getJSONObject("params").isNull("fx"))
        assertEquals(
            "camera2_no_imu_reference",
            cal.getJSONObject("cam_imu_extrinsics").getString("extrinsics_source"),
        )
    }

    @Test
    fun `calibration is additive — drift fields are unchanged`() {
        val md = compose(fixtureMetrics().copy(
            drift = MetadataComposer.Drift(maxMs = 6.16, meanMs = 5.58, p99Ms = 5.63, warmupFramesSkipped = 150),
        ))
        assertEquals(6.16, md.getDouble("imu_video_drift_max_ms"), 0.0001)
        assertEquals(5.58, md.getDouble("imu_video_drift_mean_ms"), 0.0001)
        assertEquals(5.63, md.getDouble("imu_video_drift_p99_ms"), 0.0001)
        assertEquals(150, md.getInt("imu_video_drift_warmup_frames_skipped"))
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
            // Bug 3 / D3 — location incidental to the no-literals grep; null
            // exercises the unavailable-fix path (was a coarse label pre-1.5.0).
            "phone", "Pixel 10a", "android", "14", "1.0.0", 115.0, null, null,
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
