---
phase: 03-humyn-capture-native-module
plan_id: 03-06
plan: 6
type: execute
wave: 3
depends_on: [03-04]
files_modified:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
  - apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
  - shared/types/src/recording.ts
requirements: [CAP-08, CAP-15, CAP-16, CAP-19]
autonomous: true
must_haves:
  truths:
    - MetadataComposer.compose(...) produces a JSONObject conforming to video_metadata.json schema_version 1.1.0
    - schema_version field is "1.1.0" (bump from 1.0.0 to add imu_min_rate_hz_observed_p1)
    - All required fields from video_metadata.json template are present (recording_id, contributor_info, task_info, capture_device_info, metadata block)
    - imu_min_rate_hz_observed_p1 is the ONLY new field added at the Phase 3 emit boundary (D-IMU-02)
    - start_gate block carries forward verbatim from .session.json sidecar (CAP-10 — does NOT re-run at auto-segment cuts)
    - Atomic write: writeAtomic(file, json) writes to {file}.partial then File.renameTo({file})
    - shared/types/src/recording.ts declares imuMinRateHzObservedP1 (verified or added)
  artifacts:
    - path: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
      provides: compose + writeAtomic for video_metadata.json schema 1.1.0
      contains: '"schema_version", "1.1.0"'
    - path: apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
      provides: schema-conformance fixture (copy of repo-root video_metadata.json with imu_min_rate_hz_observed_p1 added + schema_version bumped)
      contains: imu_min_rate_hz_observed_p1
  key_links:
    - from: apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
      to: video_metadata.json
      via: schema_version 1.1.0 + all top-level + metadata.* fields
      pattern: schema_version
    - from: apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
      to: apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
      via: parses both, asserts identical key set
      pattern: video_metadata_v1_1_0_template
---

<objective>
Implement `MetadataComposer.kt` — the single Kotlin object that composes a video_metadata.json (schema 1.1.0) per segment and atomically writes it. Plan 03-10's `FinalizeWorker` calls it. Flips 1 Wave 0 stub from MISSING to GREEN.

Purpose: per CAP-16 + CONTEXT.md "Phase 3 emits video_metadata.json verbatim per segment + adds one new field `imu_min_rate_hz_observed_p1`; schema_version → `1.1.0`." Without a tested composer, the per-segment metadata risks divergence from the canonical template — and divergence breaks Phase 5's strict server-side schema validation (Pitfall 7).

Output: 1 new Kotlin source file, 1 new test fixture, 1 Wave 0 stub flipped to GREEN, plus verification of `shared/types/src/recording.ts` (Pitfall 7 said this is already pre-empted; confirm or fix).
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-RESEARCH.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
@video_metadata.json
@shared/types/src/recording.ts

<interfaces>
<!-- Schema 1.0.0 is video_metadata.json at the repo root. Schema 1.1.0 adds exactly one field: metadata.imu_min_rate_hz_observed_p1 (number). All other fields stay byte-identical. -->

```json
{
  "schema_version": "1.1.0",                    // BUMP from 1.0.0
  "recording_id": "01HQZK4M5N7A2B9CXY3WTV8RPQ",
  "contributor_info": {...verbatim from sidecar...},
  "task_info": {...verbatim from sidecar.task_info_partial + native-derived environment + time_of_day...},
  "capture_device_info": {...verbatim from sidecar.capture_device_info_partial...},
  "metadata": {
    "footage_type": "egocentric_head",
    "filename": "20260505_003020_001.mp4",
    "file_size_bytes": ...,
    "file_sha256": "...",
    "imu_filename": "20260505_003020_001.csv",
    "imu_size_bytes": ...,
    "imu_sha256": "...",
    "imu_gyro_rate_hz": 416, "imu_accel_rate_hz": 416,
    "imu_video_drift_max_ms": 0.7, "imu_video_drift_mean_ms": 0.18, "imu_video_drift_p99_ms": 0.5,
    "imu_min_rate_hz_observed_p1": 95.5,        // NEW FIELD — D-IMU-02
    "audio_sample_rate_hz": 48000, "audio_codec": "AAC-LC", "audio_bitrate_bps": 128000, "audio_channels": 1,
    "start_timestamp": "...", "end_timestamp": "...", "imu_start_timestamp": "...", "imu_end_timestamp": "...",
    "container_format": "mp4", "duration_seconds": 60.0, "orientation": "landscape",
    "resolution": "1920x1080", "fps": 30, "video_codec": "hevc", "video_profile": "main",
    "bitrate_bps": 8000000, "bitrate_mode": "cbr", "gop": 30, "color_depth_bits": 8, "color_space": "bt709",
    "hdr": false, "b_frames": false, "image_stabilization": false,
    "start_gate": {...verbatim from sidecar.start_gate...}
  }
}
```

Per RESEARCH Pitfall 7: shared/types/src/recording.ts line 33 ALREADY HAS `imuMinRateHzObservedP1: z.number().int().nullable().optional()`. Verify on read.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Generate video_metadata_v1_1_0_template.json fixture + verify shared/types/src/recording.ts pre-emption</name>
  <files>apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json, shared/types/src/recording.ts</files>
  <read_first>
    - video_metadata.json (canonical 1.0.0 source — repo root)
    - shared/types/src/recording.ts (Pitfall 7 says line 33 already has imuMinRateHzObservedP1; verify)
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Pitfall 7 lines 637–649; Assumption A7 line 1053)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-IMU-02 — schema bump 1.0.0 → 1.1.0)
  </read_first>
  <behavior>
    - Fixture is byte-identical to video_metadata.json EXCEPT: schema_version is "1.1.0" AND `metadata` block has `imu_min_rate_hz_observed_p1: 95.5` inserted immediately after `imu_video_drift_p99_ms`
    - shared/types/src/recording.ts contains `imuMinRateHzObservedP1` field; if absent, ADD `imuMinRateHzObservedP1: z.number().nullable().optional()`
  </behavior>
  <action>
    **1A — Generate fixture:** copy `video_metadata.json` to `apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json`. Apply two edits:

      - `"schema_version": "1.0.0"` → `"schema_version": "1.1.0"`
      - Insert `"imu_min_rate_hz_observed_p1": 95.5,` line immediately after `"imu_video_drift_p99_ms": 0.5,` (preserving 2-space indent)

    Final diff should be exactly 2 lines changed/added.

    **1B — Verify `shared/types/src/recording.ts`:** if `imuMinRateHzObservedP1` exists in the file (per Pitfall 7), leave it untouched. If absent, add it to the `RecordingCreateSchema` zod object with `imuMinRateHzObservedP1: z.number().nullable().optional()`. Do NOT add `.int()` — Assumption A7 says decimal values are correct (Phase 5's planner will reconcile the existing `.int()` constraint on the drift fields). Document the actual file state in the SUMMARY.

    **1C — Do NOT** modify repo-root `video_metadata.json`. It stays at schema_version 1.0.0 as historical reference until Phase 5 refreshes it.

  </action>
  <verify>
    <automated>diff /Users/adnaan/Documents/hl-homelander/video_metadata.json /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json | head -10 && grep -q imuMinRateHzObservedP1 /Users/adnaan/Documents/hl-homelander/shared/types/src/recording.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json` exists
    - `grep -q '"schema_version": "1.1.0"' apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json`
    - `grep -q '"imu_min_rate_hz_observed_p1":' apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json`
    - `grep -q '"schema_version": "1.0.0"' video_metadata.json` (repo root file unchanged)
    - `grep -q "imuMinRateHzObservedP1" shared/types/src/recording.ts`
    - `cd shared/types && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Fixture exists; shared types declare the new field.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement MetadataComposer.kt + atomic write + flip MetadataSchemaConformanceTest to GREEN</name>
  <files>apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt, apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt</files>
  <read_first>
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt (data classes for sidecar — feed into composer)
    - apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json (the fixture from Task 1)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-IMU-02 + <specifics> "schema version bump rationale")
    - .planning/phases/03-humyn-capture-native-module/03-RESEARCH.md (Code Examples for ISO-8601 formatter line 517 — `OffsetDateTime.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)`)
  </read_first>
  <behavior>
    - compose(sidecar, mp4Sha, csvSha, drift, imuFloor, mp4Size, csvSize, mp4Filename, csvFilename, recordingId, durationSec, startTsIso, endTsIso, imuStartIso, imuEndIso, environment, timeOfDay) returns a JSONObject with schema_version = "1.1.0"
    - Top-level keys exactly: schema_version, recording_id, contributor_info, task_info, capture_device_info, metadata
    - metadata block keys exactly match the template fixture (33 fields including imu_min_rate_hz_observed_p1 + start_gate)
    - All locked spec values hard-coded: footage_type="egocentric_head", container_format="mp4", orientation="landscape", resolution="1920x1080", fps=30, video_codec="hevc", video_profile="main", bitrate_bps=8000000, bitrate_mode="cbr", gop=30, color_depth_bits=8, color_space="bt709", hdr=false, b_frames=false, image_stabilization=false, audio_sample_rate_hz=48000, audio_codec="AAC-LC", audio_bitrate_bps=128000, audio_channels=1
    - start_gate carried verbatim from sidecar (CAP-10 — same gate across all segments in a session)
    - writeAtomic(file, jsonString) writes to {file}.partial, fsyncs, renames to {file}; on rename failure deletes .partial
    - Test: composer output keys match template keys exactly (set equality, top-level + nested)
    - Test: writeAtomic creates {file}.json (not {file}.json.partial) when successful; .partial does NOT exist post-write
  </behavior>
  <action>
    Create `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt`:

    ```kotlin
    package ai.humynlabs.capture.capture

    import org.json.JSONObject
    import java.io.File

    /**
     * Phase 3 CAP-16 — composes video_metadata.json schema 1.1.0 per segment.
     *
     * Schema bump 1.0.0 → 1.1.0 adds exactly one field:
     * metadata.imu_min_rate_hz_observed_p1 (D-IMU-02).
     *
     * All locked spec values from idea-brief.md §2.1 are hard-coded
     * (resolution, fps, codec, bitrate mode, etc.) — the encoder configures
     * to these values and the metadata stamps them.
     *
     * start_gate is carried verbatim from the .session.json sidecar
     * (CAP-10: hand-gate does NOT re-run at auto-segment cuts).
     */
    object MetadataComposer {
        const val CURRENT_SCHEMA_VERSION = "1.1.0"

        data class FinalizeMetrics(
            val mp4Sha: String, val csvSha: String,
            val mp4SizeBytes: Long, val csvSizeBytes: Long,
            val drift: DriftCalculator.Drift?,
            val imuFloorHz: Double?,
            val gyroRateHz: Int, val accelRateHz: Int,
            val mp4Filename: String, val csvFilename: String,
            val durationSeconds: Double,
            val startTimestampIso: String, val endTimestampIso: String,
            val imuStartTimestampIso: String, val imuEndTimestampIso: String,
            val environment: String, // default "residential"
            val timeOfDay: String,   // "day" | "night" derived from local clock
        )

        fun compose(sidecar: SidecarPayload, m: FinalizeMetrics): JSONObject {
            val contributor = JSONObject()
                .put("name", sidecar.contributorInfo.name)
                .put("email", sidecar.contributorInfo.email)
                .put("age", sidecar.contributorInfo.age ?: JSONObject.NULL)
                .put("gender", sidecar.contributorInfo.gender ?: JSONObject.NULL)
                .put("consent", sidecar.contributorInfo.consent)

            val taskInfo = JSONObject()
                .put("task_id", sidecar.taskInfoPartial.taskId)
                .put("task_name", sidecar.taskInfoPartial.taskName)
                .put("task_category", sidecar.taskInfoPartial.taskCategory)
                .put("environment", m.environment)
                .put("setting", sidecar.taskInfoPartial.taskSetting)
                .put("time_of_day", m.timeOfDay)

            val captureDevice = JSONObject()
                .put("type", sidecar.captureDeviceInfoPartial.type)
                .put("model", sidecar.captureDeviceInfoPartial.model)
                .put("os", sidecar.captureDeviceInfoPartial.os)
                .put("os_version", sidecar.captureDeviceInfoPartial.osVersion)
                .put("app_version", sidecar.captureDeviceInfoPartial.appVersion)
                .put("dfov_degrees", sidecar.captureDeviceInfoPartial.dfovDegrees)
                .put("ip_address", sidecar.captureDeviceInfoPartial.ipAddress ?: JSONObject.NULL)
                .put("location", sidecar.captureDeviceInfoPartial.location ?: JSONObject.NULL)

            val startGate = JSONObject()
                .put("type", sidecar.startGate.type)
                .put("passed", sidecar.startGate.passed)
                .put("skipped", sidecar.startGate.skipped)
                .put("bypassed", sidecar.startGate.bypassed)
                .put("duration_ms", sidecar.startGate.durationMs)
                .put("consecutive_hits_required", sidecar.startGate.consecutiveHitsRequired)
                .put("platform_cadence_ms", sidecar.startGate.platformCadenceMs)

            val metadata = JSONObject()
                .put("footage_type", "egocentric_head")
                .put("filename", m.mp4Filename)
                .put("file_size_bytes", m.mp4SizeBytes)
                .put("file_sha256", m.mp4Sha)
                .put("imu_filename", m.csvFilename)
                .put("imu_size_bytes", m.csvSizeBytes)
                .put("imu_sha256", m.csvSha)
                .put("imu_gyro_rate_hz", m.gyroRateHz)
                .put("imu_accel_rate_hz", m.accelRateHz)
                .put("imu_video_drift_max_ms", m.drift?.maxMs ?: JSONObject.NULL)
                .put("imu_video_drift_mean_ms", m.drift?.meanMs ?: JSONObject.NULL)
                .put("imu_video_drift_p99_ms", m.drift?.p99Ms ?: JSONObject.NULL)
                .put("imu_min_rate_hz_observed_p1", m.imuFloorHz ?: JSONObject.NULL)
                .put("audio_sample_rate_hz", 48000)
                .put("audio_codec", "AAC-LC")
                .put("audio_bitrate_bps", 128000)
                .put("audio_channels", 1)
                .put("start_timestamp", m.startTimestampIso)
                .put("end_timestamp", m.endTimestampIso)
                .put("imu_start_timestamp", m.imuStartTimestampIso)
                .put("imu_end_timestamp", m.imuEndTimestampIso)
                .put("container_format", "mp4")
                .put("duration_seconds", m.durationSeconds)
                .put("orientation", "landscape")
                .put("resolution", "1920x1080")
                .put("fps", 30)
                .put("video_codec", "hevc")
                .put("video_profile", "main")
                .put("bitrate_bps", 8_000_000)
                .put("bitrate_mode", "cbr")
                .put("gop", 30)
                .put("color_depth_bits", 8)
                .put("color_space", "bt709")
                .put("hdr", false)
                .put("b_frames", false)
                .put("image_stabilization", false)
                .put("start_gate", startGate)

            return JSONObject()
                .put("schema_version", CURRENT_SCHEMA_VERSION)
                .put("recording_id", sidecar.recordingId)
                .put("contributor_info", contributor)
                .put("task_info", taskInfo)
                .put("capture_device_info", captureDevice)
                .put("metadata", metadata)
        }

        /**
         * Atomic write: write to {file}.partial, then File.renameTo({file}).
         * Two reasons: (1) reader of recordings/ never sees a half-written
         * JSON; (2) the .partial residue at app-launch sweep (Plan 03-10) is
         * an unambiguous mid-write-crash signal.
         */
        fun writeAtomic(file: File, json: JSONObject) {
            val partial = File(file.parentFile, "${file.name}.partial")
            try {
                partial.writeText(json.toString(2))
                if (!partial.renameTo(file)) {
                    // Fallback: copy + delete (some FS reject rename across mount points).
                    file.writeText(partial.readText())
                    partial.delete()
                }
            } catch (e: Throwable) {
                partial.delete()
                throw e
            }
        }
    }
    ```

    Note: `DriftCalculator.Drift` is referenced — confirm Plan 03-05's DriftCalculator exposes the data class at top level inside the file; if it's nested differently, adjust the import.

    **Test: replace MetadataSchemaConformanceTest stub with:**

    ```kotlin
    @RunWith(RobolectricTestRunner::class)
    class MetadataSchemaConformanceTest {
        private val ctx = RuntimeEnvironment.getApplication()

        private fun fixtureSidecar() = SidecarPayload(
            schemaVersion = "1.0.0",
            sessionId = "01JABCSESSIONXXXXXXXXXXXXXX",
            segmentId = "01JABCSEGMENT1XXXXXXXXXXXXX",
            recordingId = "01HQZK4M5N7A2B9CXY3WTV8RPQ",
            filenameBase = "20260505_003020_001",
            startedAtNs = 12345678901234L,
            wallclockStartIso = "2026-05-05T00:30:20.000+05:30",
            isPractice = false,
            taskInfoPartial = TaskInfoPartial("cooking.chopping", "Chopping", "cooking", "indoor"),
            contributorInfo = ContributorInfo("Donald", "user@gmail.com", 26, "male", true),
            startGate = StartGate("hand_detection", true, false, false, 3420, 5, 400),
            captureDeviceInfoPartial = CaptureDeviceInfoPartial("phone", "Google Pixel 10a", "android", "19.4.2", "1.0.0", 115.0, null, "Bangalore, India"),
        )

        private fun fixtureMetrics() = MetadataComposer.FinalizeMetrics(
            mp4Sha = "9af2b5a1c0d8e7f63b1c4d2a89e0fd71b3a4c5d6e7f80912a3b4c5d6e7f8c1e4",
            csvSha = "3c7e1f8b6a5d4c2e90b7a3c1d5e4f8a692bc34d56e78f90a1b2c3d4e5f6a792ab",
            mp4SizeBytes = 4_402_341_478L, csvSizeBytes = 218914L,
            drift = DriftCalculator.Drift(maxMs = 0.7, meanMs = 0.18, p99Ms = 0.5),
            imuFloorHz = 95.5,
            gyroRateHz = 416, accelRateHz = 416,
            mp4Filename = "20260505_003020_001.mp4", csvFilename = "20260505_003020_001.csv",
            durationSeconds = 60.0,
            startTimestampIso = "2026-05-05T00:30:20.000+05:30",
            endTimestampIso = "2026-05-05T00:31:20.000+05:30",
            imuStartTimestampIso = "2026-05-05T00:30:20.012+05:30",
            imuEndTimestampIso = "2026-05-05T00:31:20.987+05:30",
            environment = "residential", timeOfDay = "day",
        )

        private fun loadTemplate(): JSONObject {
            val stream = javaClass.classLoader!!.getResourceAsStream("video_metadata_v1_1_0_template.json")!!
            return JSONObject(stream.bufferedReader().use { it.readText() })
        }

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

        @Test fun `composer output schema_version is 1_1_0`() {
            val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            assertEquals("1.1.0", out.getString("schema_version"))
        }

        @Test fun `composer output keys exactly match template`() {
            val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            val template = loadTemplate()
            assertEquals(keySet(template), keySet(out))
        }

        @Test fun `imu_min_rate_hz_observed_p1 is the only new field vs schema 1_0_0`() {
            val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            assertTrue(out.getJSONObject("metadata").has("imu_min_rate_hz_observed_p1"))
            assertEquals(95.5, out.getJSONObject("metadata").getDouble("imu_min_rate_hz_observed_p1"), 0.0001)
        }

        @Test fun `start_gate carries verbatim from sidecar`() {
            val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            val sg = out.getJSONObject("metadata").getJSONObject("start_gate")
            assertEquals("hand_detection", sg.getString("type"))
            assertTrue(sg.getBoolean("passed"))
            assertFalse(sg.getBoolean("skipped"))
            assertEquals(5, sg.getInt("consecutive_hits_required"))
        }

        @Test fun `locked spec values are hard-coded`() {
            val md = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics()).getJSONObject("metadata")
            assertEquals("1920x1080", md.getString("resolution"))
            assertEquals(30, md.getInt("fps"))
            assertEquals("hevc", md.getString("video_codec"))
            assertEquals(8_000_000, md.getInt("bitrate_bps"))
            assertEquals("cbr", md.getString("bitrate_mode"))
            assertEquals(30, md.getInt("gop"))
            assertFalse(md.getBoolean("b_frames"))
            assertFalse(md.getBoolean("hdr"))
            assertFalse(md.getBoolean("image_stabilization"))
            assertEquals(48000, md.getInt("audio_sample_rate_hz"))
            assertEquals("AAC-LC", md.getString("audio_codec"))
        }

        @Test fun `writeAtomic creates final file and removes partial`() {
            val out = MetadataComposer.compose(fixtureSidecar(), fixtureMetrics())
            val target = File(ctx.cacheDir, "20260505_003020_001.json")
            target.delete()
            val partial = File(ctx.cacheDir, "20260505_003020_001.json.partial")
            partial.delete()
            MetadataComposer.writeAtomic(target, out)
            assertTrue(target.exists())
            assertFalse(partial.exists())
            // Round-trip parse
            val reloaded = JSONObject(target.readText())
            assertEquals("1.1.0", reloaded.getString("schema_version"))
        }

        @Test fun `null drift renders as JSON null`() {
            val metrics = fixtureMetrics().copy(drift = null, imuFloorHz = null)
            val out = MetadataComposer.compose(fixtureSidecar(), metrics)
            val md = out.getJSONObject("metadata")
            assertTrue(md.isNull("imu_video_drift_max_ms"))
            assertTrue(md.isNull("imu_min_rate_hz_observed_p1"))
        }
    }
    ```

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.MetadataSchemaConformanceTest"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` exists with `object MetadataComposer { fun compose / fun writeAtomic }`
    - `grep -q "CURRENT_SCHEMA_VERSION = \"1.1.0\"" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt`
    - `grep -q "imu_min_rate_hz_observed_p1" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt`
    - `grep -q "egocentric_head" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` (locked footage_type)
    - `grep -q "1920x1080" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` (locked resolution)
    - `grep -q "renameTo" apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` (atomic write)
    - `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt` does NOT contain `MISSING — Wave 0 stub`
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.MetadataSchemaConformanceTest"` exits 0 with all 7 test cases green
  </acceptance_criteria>
  <done>MetadataComposer implemented; schema 1.1.0 fixture conformance test green.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                 | Description                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| sidecar.contributor_info → metadata.json | PII (email, name) flows from JS → sidecar → metadata; never modified server-side |
| metadata.json on disk → S3 (Phase 5)     | byte-for-byte; CAP-18                                                            |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                         | Disposition | Mitigation Plan                                                                                                                                                                                         |
| --------- | ---------------------- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.5-01  | Tampering              | Schema-creep — a future plan adds a metadata field without bumping schema_version | mitigate    | `MetadataSchemaConformanceTest` asserts key set EQUALS the template. New fields fail the test until the template is updated, forcing a schema_version review at PR time.                                |
| T-3.5-02  | Tampering              | Half-written metadata.json on crash mid-write                                     | mitigate    | `writeAtomic({file}.partial → renameTo({file}))`. Reader of recordings/ never sees a partial file. .partial residue at app-launch sweep is an unambiguous crash signal that Plan 03-10's sweep handles. |
| T-3.5-03  | Information disclosure | metadata.json contains contributor email + name + location                        | accept      | Same trust model as the .session.json sidecar — app-private filesDir until Phase 5 uploads. Phase 5's planner gates server-side retention per LEGAL-04.                                                 |
| T-3.5-04  | Tampering              | Locked spec values (1920x1080, 8 Mbps, etc.) drift from idea-brief.md §2.1        | mitigate    | Hard-coded in `MetadataComposer.kt` `compose()`. Test `locked spec values are hard-coded` asserts each one. Changing them requires editing the test (PR review surfaces).                               |

</threat_model>

<verification>
- `MetadataSchemaConformanceTest` flips from MISSING to GREEN.
- The 16 remaining Wave 0 stubs still fail with MISSING (no regression).
- `cd apps/mobile/android && ./gradlew :app:compileApkRolloutDebugSources` exits 0.
- `cd shared/types && npx tsc --noEmit` exits 0 (recording.ts compiles).
- Phase 2 + Wave 1 + Plan 03-03/04 suites stay green.
</verification>

<success_criteria>

- ✓ `MetadataComposer.compose(...)` produces JSON conforming to schema 1.1.0 with all locked spec values hard-coded.
- ✓ `MetadataComposer.writeAtomic(file, json)` writes to .partial then renames atomically.
- ✓ Test fixture `video_metadata_v1_1_0_template.json` mirrors `video_metadata.json` with exactly 2 line changes.
- ✓ shared/types/src/recording.ts declares `imuMinRateHzObservedP1` (verified or added).
- ✓ MetadataSchemaConformanceTest flipped from MISSING to GREEN with 7 test cases passing.
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-06-SUMMARY.md` per the canonical summary template — including:

- Pattern callout: "Atomic JSON write" — write to `.partial` then `renameTo`; `.partial` residue at sweep time is an unambiguous crash signal.
- Wave 0 progress: 7 of 17 stubs GREEN (41%).
- Note any drift between `video_metadata.json` (repo root, 1.0.0) and the schema 1.1.0 fixture — exactly 2 line changes expected.
- Pitfall 7 verification result: report whether `shared/types/src/recording.ts` already had `imuMinRateHzObservedP1` (RESEARCH.md said yes per Pitfall 7 line 647) or if Task 1 had to add it.
  </output>
