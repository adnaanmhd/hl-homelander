package ai.humynlabs.capture.capture

import org.json.JSONObject
import java.io.File

/**
 * Phase 3 Plan 03-06 — composes `video_metadata.json` schema 1.1.0 per
 * segment (CAP-16) and atomically writes it to disk.
 *
 * Schema bump 1.0.0 → 1.1.0 adds exactly one field at the metadata block:
 * `imu_min_rate_hz_observed_p1` (D-IMU-02). All other fields stay
 * byte-identical to the canonical `video_metadata.json` template.
 *
 * All locked spec values from `idea-brief.md §2.1` are hard-coded inside
 * [compose] (resolution `1920x1080`, fps `30`, video_codec `hevc`,
 * bitrate `8 Mbps`, bitrate_mode `cbr`, gop `30`, color_space `bt709`,
 * `b_frames=false`, `hdr=false`, `image_stabilization=false`,
 * audio `48 kHz mono AAC-LC 128 kbps`, etc.). The HEVC encoder configures
 * to these values and the metadata stamps them. T-3.5-04 mitigation:
 * any drift between hard-coded values and `idea-brief.md` is caught by the
 * `locked spec values are hard-coded` test (PR review surfaces).
 *
 * `start_gate` is carried verbatim from the per-session `.session.json`
 * sidecar (CAP-10: hand-gate runs once at session start; auto-segment
 * cuts inherit the same gate result across all segments in the session).
 *
 * Atomic write contract (T-3.5-02 mitigation): [writeAtomic] writes the
 * payload to `{file}.partial`, then `File.renameTo({file})`. A reader of
 * `recordings/` never sees a half-written JSON; a `.partial` residue at
 * Plan 03-10's app-launch sweep is an unambiguous mid-write-crash signal.
 *
 * **Data-class scope:** [SidecarPayload], [TaskInfoPartial],
 * [ContributorInfo], [CaptureDeviceInfoPartial], and [StartGate] are
 * **nested inside this object** so this plan can ship + verify against
 * the schema fixture in isolation from Plan 03-05's `SidecarManager`,
 * which lands its own (functionally equivalent) sidecar types in
 * parallel. Plan 03-09's orchestrator/bridge wireup is responsible for
 * adapting `SidecarManager.SidecarPayload` → these nested types at the
 * finalize-worker call site.
 */
object MetadataComposer {
    const val CURRENT_SCHEMA_VERSION = "1.1.0"

    /** Sidecar input shape (subset relevant to metadata composition). */
    data class SidecarPayload(
        val schemaVersion: String,
        val sessionId: String,
        val segmentId: String,
        val recordingId: String,
        val filenameBase: String,
        val startedAtNs: Long,
        val wallclockStartIso: String,
        val isPractice: Boolean,
        val taskInfoPartial: TaskInfoPartial,
        val contributorInfo: ContributorInfo,
        val startGate: StartGate,
        val captureDeviceInfoPartial: CaptureDeviceInfoPartial,
    )

    data class TaskInfoPartial(
        val taskId: String,
        val taskName: String,
        val taskCategory: String,
        val taskSetting: String,
    )

    data class ContributorInfo(
        val name: String,
        val email: String,
        val age: Int?,
        val gender: String?,
        val consent: Boolean,
    )

    data class CaptureDeviceInfoPartial(
        val type: String,
        val model: String,
        val os: String,
        val osVersion: String,
        val appVersion: String,
        val dfovDegrees: Double,
        val ipAddress: String?,
        val location: String?,
    )

    data class StartGate(
        val type: String,
        val passed: Boolean,
        val skipped: Boolean,
        val bypassed: Boolean,
        val durationMs: Int,
        val consecutiveHitsRequired: Int,
        val platformCadenceMs: Int,
    )

    /** Drift figures `{max, mean, p99}` per `idea-brief.md §6.5`. */
    data class Drift(
        val maxMs: Double,
        val meanMs: Double,
        val p99Ms: Double,
    )

    /** Native-derived metrics gathered at finalize time. */
    data class FinalizeMetrics(
        val mp4Sha: String,
        val csvSha: String,
        val mp4SizeBytes: Long,
        val csvSizeBytes: Long,
        val drift: Drift?,
        val imuFloorHz: Double?,
        val gyroRateHz: Int,
        val accelRateHz: Int,
        val mp4Filename: String,
        val csvFilename: String,
        val durationSeconds: Double,
        val startTimestampIso: String,
        val endTimestampIso: String,
        val imuStartTimestampIso: String,
        val imuEndTimestampIso: String,
        val environment: String, // e.g. "residential"
        val timeOfDay: String,   // "day" | "night"
    )

    /**
     * Compose a `video_metadata.json` (schema 1.1.0) JSONObject from the
     * sidecar carry-over fields and finalize-time metrics. Top-level keys
     * are exactly: `schema_version`, `recording_id`, `contributor_info`,
     * `task_info`, `capture_device_info`, `metadata`. The `metadata`
     * block carries 33 fields including `imu_min_rate_hz_observed_p1`
     * and the verbatim `start_gate` block.
     */
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

        // CAP-10: start_gate carries verbatim from the sidecar — same gate
        // result is stamped on every segment in the session. The hand-gate
        // does NOT re-run at auto-segment cuts.
        val startGate = JSONObject()
            .put("type", sidecar.startGate.type)
            .put("passed", sidecar.startGate.passed)
            .put("skipped", sidecar.startGate.skipped)
            .put("bypassed", sidecar.startGate.bypassed)
            .put("duration_ms", sidecar.startGate.durationMs)
            .put("consecutive_hits_required", sidecar.startGate.consecutiveHitsRequired)
            .put("platform_cadence_ms", sidecar.startGate.platformCadenceMs)

        // Locked spec values from idea-brief.md §2.1 are hard-coded:
        // resolution, fps, codec, profile, bitrate, gop, color, audio.
        // T-3.5-04 mitigation: drift from idea-brief is caught by the
        // `locked spec values are hard-coded` test.
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
            // D-IMU-02 — the only new field at the schema 1.1.0 emit boundary.
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
     * Atomic write of [json] to [file]. Writes to `{file.parent}/{file.name}.partial`
     * first, then atomically moves it onto [file] via
     * [java.nio.file.Files.move] with `ATOMIC_MOVE` + `REPLACE_EXISTING`.
     * On a same-filesystem move the OS guarantees observers either see the
     * old [file] (or no [file]) or the fully-written one — never a
     * half-written file (T-3.5-02 mitigation).
     *
     * **CR-06 fix.** The previous implementation had a `File.renameTo`
     * fallback that, on rename failure, did `file.writeText(partial.readText())`
     * — a non-atomic rewrite that defeats the entire point. A power loss
     * mid-fallback wrote a partial canonical JSON; the sidecar (which
     * signals "finalize incomplete") was then deleted by the
     * FinalizeWorker, and the next launch parsed a corrupt finalized
     * file with no recovery signal. The fix is to use
     * [java.nio.file.Files.move] which IS atomic across compatible
     * filesystems and throws clearly otherwise. Android `filesDir` is
     * always single-mount, so atomic move is the contract we need;
     * a cross-mount failure surfaces as `IOException("atomic_move_unsupported")`
     * which FinalizeWorker maps to onError(code=finalize_failed,
     * recoverable=false) and the sidecar stays on disk so the app-launch
     * sweep can retry on next boot.
     *
     * On any throwable mid-write, the residual `.partial` is deleted before
     * the exception propagates so the caller's retry sees a clean slate.
     * (A `.partial` left behind across a process crash is intentional —
     * Plan 03-10's app-launch sweep treats it as a mid-write-crash signal,
     * and WR-13's third-pass sweep removes the `.partial` cruft so it
     * doesn't pollute the FilenameGenerator NNN sequence.)
     */
    fun writeAtomic(file: File, json: JSONObject) {
        val parent = file.parentFile
            ?: throw IllegalArgumentException("writeAtomic: file has no parent: ${file.path}")
        val partial = File(parent, "${file.name}.partial")
        try {
            partial.writeText(json.toString(2))
            try {
                java.nio.file.Files.move(
                    partial.toPath(),
                    file.toPath(),
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                )
            } catch (e: java.nio.file.AtomicMoveNotSupportedException) {
                // filesDir is single-mount on Android; this should never happen.
                // If it does, surface as IOException so FinalizeWorker emits
                // onError(code=finalize_failed) and the sidecar stays on disk
                // for the next-launch sweep to retry.
                throw java.io.IOException("atomic_move_unsupported", e)
            }
        } catch (e: Throwable) {
            partial.delete()
            throw e
        }
    }
}
