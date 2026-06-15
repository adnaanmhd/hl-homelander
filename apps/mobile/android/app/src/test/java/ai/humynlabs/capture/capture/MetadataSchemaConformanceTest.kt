package ai.humynlabs.capture.capture

import android.app.Application
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 03-06 — flips the Wave 0 stub for CAP-16 to GREEN.
 *
 * Tests `MetadataComposer.compose()` output:
 *   1. `schema_version == "1.5.0"` (Bug 3 / D3 bump from 1.4.0 — changes
 *      `capture_device_info.location` from a coarse string label to the precise
 *      [LocationFix] object { lat, lng, accuracy_m, provider, captured_at,
 *      label }; the prior 1.4.0 bump dropped the sha fields).
 *   2. Top-level + nested key set EQUALS the canonical
 *      `video_metadata_v1_5_0_template.json` fixture (T-3.5-01: schema-creep
 *      detection — adding a metadata field without bumping schema_version
 *      fails this assertion at PR time). The non-null `location` fixture locks
 *      the nested location key structure.
 *   3. `imu_min_rate_hz_observed_p1` is the only new field vs schema 1.0.0.
 *   4. `start_gate` carries verbatim from the sidecar (CAP-10).
 *   5. Locked spec values from `idea-brief.md §2.1` are hard-coded
 *      (T-3.5-04 mitigation).
 *   6. `MetadataComposer.writeAtomic()` produces the final file with
 *      no `.partial` residue on success (T-3.5-02).
 *   7. Null drift / null IMU floor render as JSON `null` (not omitted, not "null").
 *
 * `application = Application::class` matches the Phase 3 stub pattern
 * (per Plan 03-04 SUMMARY): bypasses `MainApplication.onCreate`'s
 * `SoLoader.init` NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class MetadataSchemaConformanceTest {

    private val ctx = RuntimeEnvironment.getApplication()

    private fun fixtureSidecar() = MetadataComposer.SidecarPayload(
        schemaVersion = "1.0.0",
        sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
        segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
        recordingId = "01HQZK4M5N7A2B9CXY3WTV8RPQ",
        filenameBase = "20260505_003020_001",
        startedAtNs = 12345678901234L,
        wallclockStartIso = "2026-05-05T00:30:20.000+05:30",
        isPractice = false,
        taskInfoPartial = MetadataComposer.TaskInfoPartial(
            taskId = "cooking.chopping",
            taskName = "Chopping",
            taskCategory = "cooking",
            taskSetting = "indoor",
        ),
        contributorInfo = MetadataComposer.ContributorInfo(
            name = "Donald",
            email = "user@gmail.com",
            age = 26,
            gender = "male",
            consent = true,
        ),
        startGate = MetadataComposer.StartGate(
            type = "hand_detection",
            passed = true,
            skipped = false,
            bypassed = false,
            durationMs = 3420,
            consecutiveHitsRequired = 5,
            platformCadenceMs = 400,
        ),
        captureDeviceInfoPartial = MetadataComposer.CaptureDeviceInfoPartial(
            type = "phone",
            model = "Google Pixel 10a",
            os = "android",
            osVersion = "19.4.2",
            appVersion = "1.0.0",
            dfovDegrees = 115.0,
            ipAddress = null,
            // Bug 3 / D3 — precise LocationFix (schema 1.5.0). The non-null
            // fixture locks the nested key structure; the null path is covered
            // by `location renders as JSON null when unavailable` below.
            location = LocationFix(
                lat = 12.9716,
                lng = 77.5946,
                accuracyM = 8.5,
                provider = "fused",
                capturedAt = "2026-05-05T00:30:19.500+05:30",
                label = "Bangalore, India",
            ),
        ),
    )

    private fun fixtureMetrics() = MetadataComposer.FinalizeMetrics(
        mp4SizeBytes = 4_402_341_478L,
        csvSizeBytes = 218_914L,
        drift = MetadataComposer.Drift(maxMs = 0.7, meanMs = 0.18, p99Ms = 0.5, warmupFramesSkipped = 150),
        imuFloorHz = 95.5,
        gyroRateHz = 416,
        accelRateHz = 416,
        mp4Filename = "20260505_003020_001.mp4",
        csvFilename = "20260505_003020_001.csv",
        durationSeconds = 60.0,
        startTimestampIso = "2026-05-05T00:30:20.000+05:30",
        endTimestampIso = "2026-05-05T00:31:20.000+05:30",
        imuStartTimestampIso = "2026-05-05T00:30:20.012+05:30",
        imuEndTimestampIso = "2026-05-05T00:31:20.987+05:30",
        environment = "residential",
        timeOfDay = "day",
        // Quick task 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-03 — happy-path
        // fixture: every spec value is the "measured / probed / reported"
        // truth-source, NOT the previously-inline compose() literal.
        measuredMeanFps = 29.97,
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

    private fun loadTemplate(): JSONObject {
        val stream = javaClass.classLoader!!
            .getResourceAsStream("video_metadata_v1_5_0_template.json")
            ?: error("video_metadata_v1_5_0_template.json fixture not on classpath")
        return JSONObject(stream.bufferedReader().use { it.readText() })
    }

    /** Recursively gather all dotted key paths from a JSONObject. */
    private fun keySet(obj: JSONObject, prefix: String = ""): Set<String> {
        val out = mutableSetOf<String>()
        obj.keys().forEach { k ->
            val path = if (prefix.isEmpty()) k else "$prefix.$k"
            out.add(path)
            val v = obj.opt(k)
            if (v is JSONObject) out.addAll(keySet(v, path))
        }
        return out
    }

    @Test
    fun `composer output schema_version is 1_5_0`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        assertEquals("1.5.0", out.getString("schema_version"))
    }

    @Test
    fun `composer output keys exactly match template`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val template = loadTemplate()
        assertEquals(
            "Composer key set must equal the schema-1.5.0 template key set " +
                "(T-3.5-01: schema-creep guard). Includes the additive top-level " +
                "`calibration` block (camera + cam_imu_extrinsics) — quick 260522-elm — " +
                "and the precise `capture_device_info.location` object — Bug 3 / D3.",
            keySet(template),
            keySet(out),
        )
    }

    @Test
    fun `composer emits the precise location object when the sidecar carries a fix`() {
        // Bug 3 / D3 — the non-null fixture LocationFix flows lat/lng/accuracy_m/
        // provider/captured_at/label into the nested capture_device_info.location
        // block (schema 1.5.0). Proves the object shape + value pass-through.
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val loc = out.getJSONObject("capture_device_info").getJSONObject("location")
        assertEquals(12.9716, loc.getDouble("lat"), 0.0001)
        assertEquals(77.5946, loc.getDouble("lng"), 0.0001)
        assertEquals(8.5, loc.getDouble("accuracy_m"), 0.0001)
        assertEquals("fused", loc.getString("provider"))
        assertEquals("2026-05-05T00:30:19.500+05:30", loc.getString("captured_at"))
        assertEquals("Bangalore, India", loc.getString("label"))
    }

    @Test
    fun `location renders as JSON null when unavailable`() {
        // Bug 3 / D3 — a null fix (partial COARSE grant with no last-known, or a
        // timed-out request) emits capture_device_info.location as JSON null, not
        // an empty object and not the string "null".
        val sidecar = fixtureSidecar().copy(
            captureDeviceInfoPartial = fixtureSidecar().captureDeviceInfoPartial.copy(location = null),
        )
        val out = MetadataComposer.compose(sidecar, fixtureMetrics())
        val cd = out.getJSONObject("capture_device_info")
        assertTrue(cd.isNull("location"))
    }

    @Test
    fun `location label renders as JSON null when no reverse-geocode label`() {
        // Bug 3 / D3 — lat/lng present but label null (Geocoder failed / offline).
        val fix = LocationFix(12.9716, 77.5946, 8.5, "gps", "2026-05-05T00:30:19.500+05:30", null)
        val sidecar = fixtureSidecar().copy(
            captureDeviceInfoPartial = fixtureSidecar().captureDeviceInfoPartial.copy(location = fix),
        )
        val out = MetadataComposer.compose(sidecar, fixtureMetrics())
        val loc = out.getJSONObject("capture_device_info").getJSONObject("location")
        assertEquals("gps", loc.getString("provider"))
        assertTrue(loc.isNull("label"))
    }

    @Test
    fun `composer ALWAYS emits a top-level calibration block (uncalibrated fallback when null)`() {
        // Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — the fixture
        // sidecar carries no calibration (null), so compose() must stamp the
        // always-present uncalibrated fallback with the full key structure.
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val cal = out.getJSONObject("calibration")
        val cam = cal.getJSONObject("camera")
        val ext = cal.getJSONObject("cam_imu_extrinsics")
        // (a) full key structure present.
        assertEquals("pinhole", cam.getString("model"))
        assertTrue(cam.has("params"))
        assertTrue(cam.isNull("resolution"))
        assertTrue(cam.isNull("distortion_coeffs"))
        assertTrue(ext.has("T_cam_imu"))
        assertTrue(ext.has("T_imu_cam"))
        assertTrue(ext.has("T_cam_imu_translation_mm"))
        // (b) null-fallback path stamps the uncalibrated sources + null params.
        assertEquals("camera2_uncalibrated", cam.getString("intrinsics_source"))
        assertEquals("camera2_no_imu_reference", ext.getString("extrinsics_source"))
        val params = cam.getJSONObject("params")
        assertTrue(params.isNull("fx"))
        assertTrue(params.isNull("fy"))
        assertTrue(params.isNull("cx"))
        assertTrue(params.isNull("cy"))
        assertTrue(params.isNull("skew"))
        assertEquals(0.0, ext.getDouble("timeshift_cam_imu_sec"), 0.0)
        assertEquals("t_imu = t_cam + timeshift", ext.getString("timeshift_meaning"))
        // (c) drift fields untouched — calibration is additive telemetry.
        val md = out.getJSONObject("metadata")
        assertTrue(md.has("imu_video_drift_max_ms"))
        assertTrue(md.has("imu_video_drift_mean_ms"))
        assertTrue(md.has("imu_video_drift_p99_ms"))
    }

    @Test
    fun `composer emits captured calibration values when the sidecar carries them`() {
        // Quick task 260522-elm — a calibrated sidecar flows real intrinsics +
        // extrinsics through to the calibration block (intrinsics_source/
        // extrinsics_source = "camera2").
        val calibrated = CameraCalibration(
            camera = CameraIntrinsics(
                model = "pinhole",
                resolutionWidth = 1920,
                resolutionHeight = 1080,
                fx = 725.58,
                fy = 725.26,
                cx = 1006.06,
                cy = 506.90,
                skew = 0.0,
                distortionCoeffs = listOf(0.027, 0.017, -0.011, 0.002),
                intrinsicsSource = "camera2",
            ),
            camImuExtrinsics = CamImuExtrinsics(
                tCamImu = listOf(
                    listOf(1.0, 0.0, 0.0, 0.01),
                    listOf(0.0, 1.0, 0.0, -0.08),
                    listOf(0.0, 0.0, 1.0, -0.05),
                    listOf(0.0, 0.0, 0.0, 1.0),
                ),
                tImuCam = null,
                tCamImuTranslationMm = listOf(10.0, -80.0, -50.0),
                timeshiftCamImuSec = 0.0,
                timeshiftMeaning = "t_imu = t_cam + timeshift",
                clockSyncNote = "camera + imu share the boottime (elapsedRealtimeNanos) clock",
                extrinsicsSource = "camera2",
            ),
        )
        val out = MetadataComposer.compose(
            fixtureSidecar().copy(calibration = calibrated),
            fixtureMetrics(),
        )
        val cam = out.getJSONObject("calibration").getJSONObject("camera")
        assertEquals("camera2", cam.getString("intrinsics_source"))
        assertEquals(725.58, cam.getJSONObject("params").getDouble("fx"), 0.0001)
        assertEquals(1920, cam.getJSONArray("resolution").getInt(0))
        val ext = out.getJSONObject("calibration").getJSONObject("cam_imu_extrinsics")
        assertEquals("camera2", ext.getString("extrinsics_source"))
        assertEquals(0.01, ext.getJSONArray("T_cam_imu").getJSONArray(0).getDouble(3), 0.0001)
    }

    @Test
    fun `imu_min_rate_hz_observed_p1 is the only new field vs schema 1_0_0`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val md = out.getJSONObject("metadata")
        assertTrue(md.has("imu_min_rate_hz_observed_p1"))
        assertEquals(95.5, md.getDouble("imu_min_rate_hz_observed_p1"), 0.0001)
    }

    @Test
    fun `start_gate carries verbatim from sidecar`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val sg = out.getJSONObject("metadata").getJSONObject("start_gate")
        assertEquals("hand_detection", sg.getString("type"))
        assertTrue(sg.getBoolean("passed"))
        assertFalse(sg.getBoolean("skipped"))
        assertFalse(sg.getBoolean("bypassed"))
        assertEquals(3420, sg.getInt("duration_ms"))
        assertEquals(5, sg.getInt("consecutive_hits_required"))
        assertEquals(400, sg.getInt("platform_cadence_ms"))
    }

    @Test
    fun `spec-relevant values are derived from FinalizeMetrics (CAPTURE-QA-03)`() {
        // Quick task 260517-p5g CAPTURE-QA-03 — every spec-relevant field
        // now derives from `FinalizeMetrics.videoReport` + `measuredMeanFps`
        // + `sidecar.recordedRotation`. The previous "hard-coded literals"
        // assertion is replaced with this derivation assertion — see
        // `MetadataComposerLiteralsTest` for the comment-stripped grep gate
        // that locks in the absence of hardcoded spec literals in compose().
        val md = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            .getJSONObject("metadata")
        // Project-identity fields (NOT capture-spec values).
        assertEquals("egocentric_head", md.getString("footage_type"))
        assertEquals("mp4", md.getString("container_format"))
        // Derived from sidecar.recordedRotation (was the "landscape" literal).
        assertEquals("landscape_left", md.getString("orientation"))
        // Derived from videoReport.width × videoReport.height.
        assertEquals("1920x1080", md.getString("resolution"))
        // Derived from measuredMeanFps (the fixture uses 29.97 to prove the
        // path is not a literal 30).
        assertEquals(29.97, md.getDouble("fps"), 0.0001)
        // Derived from videoReport.{codec,profile,bitrateBps,bitrateModeToken,
        // gopFrames,colorDepthBits,colorStandardToken,bFramesReported}.
        assertEquals("hevc", md.getString("video_codec"))
        assertEquals("main", md.getString("video_profile"))
        assertEquals(8_000_000, md.getInt("bitrate_bps"))
        assertEquals("reported", md.getString("bitrate_source"))
        assertEquals("cbr", md.getString("bitrate_mode"))
        assertEquals(30, md.getInt("gop"))
        assertEquals(8, md.getInt("color_depth_bits"))
        assertEquals("bt709", md.getString("color_space"))
        // hdr + image_stabilization stay configured-literal (camera flags,
        // verified at compat-check time via EncoderProbe — see compose() comment).
        assertFalse(md.getBoolean("hdr"))
        // b_frames derives from videoReport.bFramesReported (== 0 here → false).
        assertFalse(md.getBoolean("b_frames"))
        assertFalse(md.getBoolean("image_stabilization"))
        // GAP-3 (2026-05-11) — audio capture disabled. Fields stamped as
        // null in the metadata JSON to truthfully reflect that no audio
        // track exists in the muxed MP4. Re-enabling audio restores the
        // non-null constants (48000 / "AAC-LC" / 128000 / 1).
        assertTrue(md.isNull("audio_sample_rate_hz"))
        assertTrue(md.isNull("audio_codec"))
        assertTrue(md.isNull("audio_bitrate_bps"))
        assertTrue(md.isNull("audio_channels"))
    }

    @Test
    fun `resolution flows through from videoReport (truth-source proof)`() {
        // CAPTURE-QA-03 — change videoReport.width/height and watch the
        // composed JSON change. Proves the field is NOT a literal.
        val m = fixtureMetrics().copy(
            videoReport = fixtureMetrics().videoReport.copy(width = 1280, height = 720),
        )
        val md = MetadataComposer.compose(fixtureSidecar(), m).getJSONObject("metadata")
        assertEquals("1280x720", md.getString("resolution"))
    }

    @Test
    fun `fps flows through from measuredMeanFps (truth-source proof)`() {
        val m = fixtureMetrics().copy(measuredMeanFps = 25.5)
        val md = MetadataComposer.compose(fixtureSidecar(), m).getJSONObject("metadata")
        assertEquals(25.5, md.getDouble("fps"), 0.0001)
    }

    @Test
    fun `orientation flows through from sidecar_recordedRotation (truth-source proof)`() {
        val sidecar = fixtureSidecar().copy(recordedRotation = "landscape_right")
        val md = MetadataComposer.compose(sidecar, fixtureMetrics()).getJSONObject("metadata")
        assertEquals("landscape_right", md.getString("orientation"))
    }

    @Test
    fun `bitrate_source is configured when encoder did not report (fallback path)`() {
        val m = fixtureMetrics().copy(
            videoReport = fixtureMetrics().videoReport.copy(bitrateBps = null),
        )
        val md = MetadataComposer.compose(fixtureSidecar(), m).getJSONObject("metadata")
        assertEquals(8_000_000, md.getInt("bitrate_bps"))
        assertEquals("configured", md.getString("bitrate_source"))
    }

    @Test
    fun `b_frames is true when encoder reported a non-zero MAX_B_FRAMES (defensive)`() {
        val m = fixtureMetrics().copy(
            videoReport = fixtureMetrics().videoReport.copy(bFramesReported = 5),
        )
        val md = MetadataComposer.compose(fixtureSidecar(), m).getJSONObject("metadata")
        assertTrue(md.getBoolean("b_frames"))
    }

    @Test
    fun `writeAtomic creates final file and removes partial`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val target = File(ctx.cacheDir, "20260505_003020_001.json")
        target.delete()
        val partial = File(ctx.cacheDir, "20260505_003020_001.json.partial")
        partial.delete()

        MetadataComposer.writeAtomic(target, out)

        assertTrue("target file must exist after writeAtomic", target.exists())
        assertFalse(".partial residue must NOT exist after a clean write", partial.exists())
        // Round-trip parse — file is valid JSON with the bumped schema_version.
        val reloaded = JSONObject(target.readText())
        assertEquals("1.5.0", reloaded.getString("schema_version"))
        assertNotNull(reloaded.getJSONObject("metadata"))
        assertNotNull(reloaded.getJSONObject("calibration"))
    }

    @Test
    fun `null drift and null imu floor render as JSON null`() {
        val metrics = fixtureMetrics().copy(drift = null, imuFloorHz = null)
        val out = MetadataComposer.compose(fixtureSidecar(), metrics)
        val md = out.getJSONObject("metadata")
        assertTrue(md.isNull("imu_video_drift_max_ms"))
        assertTrue(md.isNull("imu_video_drift_mean_ms"))
        assertTrue(md.isNull("imu_video_drift_p99_ms"))
        assertTrue(md.isNull("imu_video_drift_warmup_frames_skipped"))
        assertTrue(md.isNull("imu_min_rate_hz_observed_p1"))
    }
}
