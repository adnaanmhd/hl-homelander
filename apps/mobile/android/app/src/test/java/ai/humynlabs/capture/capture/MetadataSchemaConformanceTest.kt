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
 *   1. `schema_version == "1.1.0"` (D-IMU-02 bump from 1.0.0).
 *   2. Top-level + nested key set EQUALS the canonical
 *      `video_metadata_v1_1_0_template.json` fixture (T-3.5-01: schema-creep
 *      detection — adding a metadata field without bumping schema_version
 *      fails this assertion at PR time).
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
            location = "Bangalore, India",
        ),
    )

    private fun fixtureMetrics() = MetadataComposer.FinalizeMetrics(
        mp4Sha = "9af2b5a1c0d8e7f63b1c4d2a89e0fd71b3a4c5d6e7f80912a3b4c5d6e7f8c1e4",
        csvSha = "3c7e1f8b6a5d4c2e90b7a3c1d5e4f8a692bc34d56e78f90a1b2c3d4e5f6a792ab",
        mp4SizeBytes = 4_402_341_478L,
        csvSizeBytes = 218_914L,
        drift = MetadataComposer.Drift(maxMs = 0.7, meanMs = 0.18, p99Ms = 0.5),
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
    )

    private fun loadTemplate(): JSONObject {
        val stream = javaClass.classLoader!!
            .getResourceAsStream("video_metadata_v1_1_0_template.json")
            ?: error("video_metadata_v1_1_0_template.json fixture not on classpath")
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
    fun `composer output schema_version is 1_1_0`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        assertEquals("1.1.0", out.getString("schema_version"))
    }

    @Test
    fun `composer output keys exactly match template`() {
        val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
        val template = loadTemplate()
        assertEquals(
            "Composer key set must equal the schema-1.1.0 template key set " +
                "(T-3.5-01: schema-creep guard).",
            keySet(template),
            keySet(out),
        )
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
    fun `locked spec values are hard-coded`() {
        val md = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            .getJSONObject("metadata")
        assertEquals("egocentric_head", md.getString("footage_type"))
        assertEquals("mp4", md.getString("container_format"))
        assertEquals("landscape", md.getString("orientation"))
        assertEquals("1920x1080", md.getString("resolution"))
        assertEquals(30, md.getInt("fps"))
        assertEquals("hevc", md.getString("video_codec"))
        assertEquals("main", md.getString("video_profile"))
        assertEquals(8_000_000, md.getInt("bitrate_bps"))
        assertEquals("cbr", md.getString("bitrate_mode"))
        assertEquals(30, md.getInt("gop"))
        assertEquals(8, md.getInt("color_depth_bits"))
        assertEquals("bt709", md.getString("color_space"))
        assertFalse(md.getBoolean("hdr"))
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
        assertEquals("1.1.0", reloaded.getString("schema_version"))
        assertNotNull(reloaded.getJSONObject("metadata"))
    }

    @Test
    fun `null drift and null imu floor render as JSON null`() {
        val metrics = fixtureMetrics().copy(drift = null, imuFloorHz = null)
        val out = MetadataComposer.compose(fixtureSidecar(), metrics)
        val md = out.getJSONObject("metadata")
        assertTrue(md.isNull("imu_video_drift_max_ms"))
        assertTrue(md.isNull("imu_video_drift_mean_ms"))
        assertTrue(md.isNull("imu_video_drift_p99_ms"))
        assertTrue(md.isNull("imu_min_rate_hz_observed_p1"))
    }
}
