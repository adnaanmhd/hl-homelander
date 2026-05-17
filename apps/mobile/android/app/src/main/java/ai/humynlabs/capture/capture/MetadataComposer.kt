package ai.humynlabs.capture.capture

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Build
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
        /**
         * Quick task 260517-p5g CAPTURE-QA-03 — surface rotation captured at
         * session start. One of `"landscape_left"` (`Surface.ROTATION_90`) or
         * `"landscape_right"` (`Surface.ROTATION_270`); when the device reports
         * `ROTATION_0` / `ROTATION_180` despite the landscape lock the safe
         * default is `"landscape_left"` (logged as a warning). Used by
         * [compose] to stamp `metadata.orientation` truthfully instead of the
         * previous "landscape" literal.
         *
         * Default `"landscape_left"` keeps existing test fixtures that
         * pre-date this field passing — production code always passes an
         * explicit value via `FinalizeWorker.adaptSidecar`.
         */
        val recordedRotation: String = "landscape_left",
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

    /**
     * Truth-source video shape gathered at finalize time (quick task
     * 260517-p5g CAPTURE-QA-03). All spec-relevant video fields read off
     * THIS struct rather than inline literals in [compose] — the encoder's
     * `OUTPUT_FORMAT_CHANGED` MediaFormat snapshot + the MediaExtractor
     * track-header read are the truth-source, never `idea-brief.md` §2.1
     * constants.
     */
    data class VideoReport(
        /** MediaExtractor `KEY_WIDTH` — the muxed track-header truth. */
        val width: Int,
        /** MediaExtractor `KEY_HEIGHT` — the muxed track-header truth. */
        val height: Int,
        /** Canonical codec token: `"hevc"` / `"h264"` / `<mime-stripped>`. */
        val codec: String,
        /** Encoder profile token: `"main"` / `"main10"` / `<other>`. */
        val profile: String,
        /** Encoder `OUTPUT_FORMAT` `KEY_BIT_RATE`; `null` when the encoder didn't report it (older APIs). */
        val bitrateBps: Int?,
        /** Configured target — `HevcEncoder.BIT_RATE` (the fallback when the encoder doesn't report). */
        val bitrateBpsConfigured: Int,
        /** `"cbr"` / `"vbr"` / `"cq"` derived from `KEY_BITRATE_MODE`. */
        val bitrateModeToken: String,
        /** GOP frames — `KEY_I_FRAME_INTERVAL_SEC * frameRate` (default 1 * 30 = 30). */
        val gopFrames: Int,
        /** Color standard token: `"bt709"` / `"bt2020"` / `"bt601"`. */
        val colorStandardToken: String,
        /** Color transfer token: `"sdr"` / `"hlg"` / `"pq"`. */
        val colorTransferToken: String,
        /** Color range token: `"limited"` / `"full"`. */
        val colorRangeToken: String,
        /** 8 (HEVC Main) or 10 (HEVC Main10). */
        val colorDepthBits: Int,
        /** Encoder `OUTPUT_FORMAT` `KEY_MAX_B_FRAMES`; `null` when unreported. */
        val bFramesReported: Int?,
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
        /**
         * Measured mean FPS over the segment's frame timestamps —
         * `(N - 1) / ((lastTs_ns - firstTs_ns) / 1e9)`. Quick task
         * 260517-p5g CAPTURE-QA-01 / CAPTURE-QA-03. Always reported on
         * the happy path (FinalizeWorker cancels the segment before
         * compose() runs when `N < 2`).
         */
        val measuredMeanFps: Double,
        /** Truth-source video shape — see [VideoReport]. CAPTURE-QA-03. */
        val videoReport: VideoReport,
        /**
         * Recorded surface rotation captured at session start — one of
         * `"landscape_left"` / `"landscape_right"`. Quick task 260517-p5g
         * CAPTURE-QA-03; sourced from `SidecarPayload.recordedRotation`.
         */
        val recordedRotation: String,
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

        // Quick task 260517-p5g CAPTURE-QA-03 — every spec-relevant video
        // field reads from the encoder OUTPUT_FORMAT_CHANGED MediaFormat
        // snapshot + the MediaExtractor track-header read carried in
        // m.videoReport (truth-source). `fps` derives from
        // m.measuredMeanFps (computed in FinalizeWorker.finalize). The
        // previous hardcoded literals ("1920x1080" / 30 / "hevc" / "main"
        // / 8_000_000 / "cbr" / 30 / 8 / "bt709" / false / "landscape")
        // would silently up-stamp an OEM-throttled / 720p-fallback segment
        // with spec-passing metadata and poison training; that drift is
        // now guarded by MetadataComposerLiteralsTest's comment-stripped
        // grep gate. `hdr` + `image_stabilization` remain configured-
        // literal because they are CAMERA flags (verified at compat-check
        // time via EncoderProbe `hdrSdrForced` / `oisOff`), not encoder
        // flags — see the inline cites below.
        val metadata = JSONObject()
            // Project identity — NOT a capture-spec value.
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
            // Audio capture disabled per GAP-3 disposition 2026-05-11
            // (see CaptureSession.openSegment for the toggle + rationale).
            // Fields stamped as null to truthfully reflect that no audio
            // track exists in the muxed MP4. JSON consumers that expect
            // numeric values must treat these as nullable; the training
            // pipeline's schema reader is already nullable-tolerant for
            // drift fields above, so this is a consistent extension.
            // Re-enabling audio capture restores these to non-null
            // constants (48000 / "AAC-LC" / 128000 / 1).
            .put("audio_sample_rate_hz", JSONObject.NULL)
            .put("audio_codec", JSONObject.NULL)
            .put("audio_bitrate_bps", JSONObject.NULL)
            .put("audio_channels", JSONObject.NULL)
            .put("start_timestamp", m.startTimestampIso)
            .put("end_timestamp", m.endTimestampIso)
            .put("imu_start_timestamp", m.imuStartTimestampIso)
            .put("imu_end_timestamp", m.imuEndTimestampIso)
            // File-format constant (the extension is in filenameBase) — not a capture-spec value.
            .put("container_format", "mp4")
            .put("duration_seconds", m.durationSeconds)
            // CAPTURE-QA-03 — rotation captured at session start (SidecarPayload.recordedRotation).
            .put("orientation", sidecar.recordedRotation)
            // CAPTURE-QA-03 — videoReport.width × videoReport.height from MediaExtractor (muxed-track truth).
            .put("resolution", "${m.videoReport.width}x${m.videoReport.height}")
            // CAPTURE-QA-01 / CAPTURE-QA-03 — measuredMeanFps = (N - 1) / ((lastTs - firstTs) / 1e9).
            .put("fps", m.measuredMeanFps)
            // CAPTURE-QA-03 — codec / profile from encoder OUTPUT_FORMAT KEY_MIME + KEY_PROFILE.
            .put("video_codec", m.videoReport.codec)
            .put("video_profile", m.videoReport.profile)
            // CAPTURE-QA-03 — encoder-reported bitrate (KEY_BIT_RATE on OUTPUT_FORMAT, API 28+);
            // falls back to the configured target (HevcEncoder.BIT_RATE) when the encoder doesn't
            // report it (older API levels). bitrate_source distinguishes the two for consumers.
            .put("bitrate_bps", m.videoReport.bitrateBps ?: m.videoReport.bitrateBpsConfigured)
            .put(
                "bitrate_source",
                if (m.videoReport.bitrateBps != null) "reported" else "configured",
            )
            // CAPTURE-QA-03 — derived from encoder MediaFormat KEY_BITRATE_MODE.
            .put("bitrate_mode", m.videoReport.bitrateModeToken)
            // CAPTURE-QA-03 — KEY_I_FRAME_INTERVAL_SEC × frameRate (default 1 × 30 = 30).
            .put("gop", m.videoReport.gopFrames)
            // CAPTURE-QA-03 — colorDepth ∈ {8, 10}; 8 is HEVC Main, 10 is Main10 (encoder-attested).
            .put("color_depth_bits", m.videoReport.colorDepthBits)
            // CAPTURE-QA-03 — derived from encoder MediaFormat KEY_COLOR_STANDARD.
            .put("color_space", m.videoReport.colorStandardToken)
            // Camera flag (NOT an encoder flag). Verified at compat-check time via
            // EncoderProbe.hdrSdrForced (apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt).
            // Approved exception to CAPTURE-QA-03 — the truthful value lives in compat, not finalize.
            .put("hdr", false)
            // CAPTURE-QA-03 — encoder-reported via OUTPUT_FORMAT KEY_MAX_B_FRAMES (API 25+).
            // > 0 means at least one B-frame was configured; null (unreported) means the encoder
            // didn't expose the key, in which case we assert the configured 0 (HevcEncoder configures
            // KEY_MAX_B_FRAMES=0 + KEY_LATENCY=1, so an unreported value of 0 is correct).
            .put("b_frames", (m.videoReport.bFramesReported ?: 0) > 0)
            // Camera flag (NOT an encoder flag). Verified at compat-check time via
            // EncoderProbe.oisOff (apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt).
            // Approved exception to CAPTURE-QA-03 — the truthful value lives in compat, not finalize.
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

    // ============================================================
    // Quick task 260517-p5g CAPTURE-QA-03 — pure-fn token mapping helpers.
    // Kept pure (no MediaCodec / MediaExtractor allocation) so they can be
    // exercised directly by MetadataComposerLiteralsTest. The composer
    // consumes the tokens via VideoReport rather than MediaFormat ints,
    // which keeps compose() free of MediaCodec / MediaFormat imports at
    // the JSON-emit boundary.
    // ============================================================

    /** MediaFormat.COLOR_STANDARD_* → JSON token. Unknown → `"unknown"`. */
    internal fun colorStandardToToken(v: Int): String = when (v) {
        MediaFormat.COLOR_STANDARD_BT709 -> "bt709"
        MediaFormat.COLOR_STANDARD_BT2020 -> "bt2020"
        MediaFormat.COLOR_STANDARD_BT601_PAL -> "bt601"
        MediaFormat.COLOR_STANDARD_BT601_NTSC -> "bt601"
        else -> "unknown"
    }

    /** MediaFormat.COLOR_TRANSFER_* → JSON token. Unknown → `"unknown"`. */
    internal fun colorTransferToToken(v: Int): String = when (v) {
        MediaFormat.COLOR_TRANSFER_SDR_VIDEO -> "sdr"
        MediaFormat.COLOR_TRANSFER_HLG -> "hlg"
        MediaFormat.COLOR_TRANSFER_ST2084 -> "pq"
        else -> "unknown"
    }

    /** MediaFormat.COLOR_RANGE_* → JSON token. Unknown → `"limited"` (safe HEVC default). */
    internal fun colorRangeToToken(v: Int): String = when (v) {
        MediaFormat.COLOR_RANGE_LIMITED -> "limited"
        MediaFormat.COLOR_RANGE_FULL -> "full"
        else -> "limited"
    }

    /** Encoder MIME → canonical codec token. */
    internal fun mimeToCodecToken(mime: String?): String = when (mime) {
        MediaFormat.MIMETYPE_VIDEO_HEVC -> "hevc"
        MediaFormat.MIMETYPE_VIDEO_AVC -> "h264"
        null -> "unknown"
        else -> mime.removePrefix("video/")
    }

    /** HEVC profile constant → token. Unknown → `"unknown"`. */
    internal fun hevcProfileToToken(p: Int): String = when (p) {
        MediaCodecInfo.CodecProfileLevel.HEVCProfileMain -> "main"
        MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10 -> "main10"
        MediaCodecInfo.CodecProfileLevel.HEVCProfileMainStill -> "main-still"
        else -> "unknown"
    }

    /** MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_* → token. */
    internal fun bitrateModeToToken(v: Int): String = when (v) {
        MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR -> "cbr"
        MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR -> "vbr"
        MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CQ -> "cq"
        else -> "unknown"
    }

    /**
     * Quick task 260517-p5g CAPTURE-QA-03 — build a [VideoReport] from
     * the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat snapshot + the
     * MediaExtractor track-header read of the muxed MP4.
     *
     * Source-of-truth split:
     *   - width / height come from `MediaExtractor.KEY_WIDTH` / `KEY_HEIGHT`
     *     of the first video track — what was MUXED is the ultimate truth.
     *   - codec / profile / bitrate / bitrate_mode / color tokens / b-frames
     *     come from the encoder's `outputFormat` snapshot (already
     *     populated by `INFO_OUTPUT_FORMAT_CHANGED` by the time finalize
     *     runs — the segment has stopped, the encoder is about to be
     *     released).
     *
     * Falls back to the configured bitrate ([HevcEncoder.BIT_RATE]) and a
     * sensible default (8-bit Main HEVC, BT.709 limited SDR, GOP 30) when
     * the encoder doesn't report a key on the targeted API level.
     */
    fun buildVideoReport(encoder: MediaCodec?, mp4: File): VideoReport {
        // 1. MediaExtractor — width / height from the muxed first video track.
        var width = 0
        var height = 0
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(mp4.absolutePath)
            for (i in 0 until extractor.trackCount) {
                val fmt = extractor.getTrackFormat(i)
                val mime = fmt.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("video/")) {
                    if (fmt.containsKey(MediaFormat.KEY_WIDTH)) width = fmt.getInteger(MediaFormat.KEY_WIDTH)
                    if (fmt.containsKey(MediaFormat.KEY_HEIGHT)) height = fmt.getInteger(MediaFormat.KEY_HEIGHT)
                    break
                }
            }
        } catch (_: Throwable) {
            // Best-effort — leaves width/height = 0 which the caller's
            // resolution gate rejects (width<1920 → resolution_dropped).
        } finally {
            try { extractor.release() } catch (_: Throwable) {}
        }

        // 2. Encoder OUTPUT_FORMAT snapshot — codec / profile / bitrate /
        //    bitrate-mode / color tokens / b-frames. The encoder is
        //    null-tolerant for tests that exercise compose() without a
        //    real encoder.
        val of = try { encoder?.outputFormat } catch (_: Throwable) { null }
        val codec = mimeToCodecToken(of?.getString(MediaFormat.KEY_MIME))
        val profile = if (of != null && of.containsKey(MediaFormat.KEY_PROFILE)) {
            hevcProfileToToken(of.getInteger(MediaFormat.KEY_PROFILE))
        } else "main"
        val bitrateBps: Int? = if (of != null && of.containsKey(MediaFormat.KEY_BIT_RATE)) {
            of.getInteger(MediaFormat.KEY_BIT_RATE)
        } else null
        val bitrateModeToken = if (of != null && of.containsKey(MediaFormat.KEY_BITRATE_MODE)) {
            bitrateModeToToken(of.getInteger(MediaFormat.KEY_BITRATE_MODE))
        } else "cbr"
        val gopFrames = if (of != null && of.containsKey(MediaFormat.KEY_I_FRAME_INTERVAL) &&
            of.containsKey(MediaFormat.KEY_FRAME_RATE)
        ) {
            val iSec = of.getInteger(MediaFormat.KEY_I_FRAME_INTERVAL)
            val fr = of.getInteger(MediaFormat.KEY_FRAME_RATE)
            (iSec * fr).coerceAtLeast(1)
        } else HevcEncoder.GOP_INTERVAL_SEC * HevcEncoder.FRAME_RATE
        val colorStandardToken = if (of != null && of.containsKey(MediaFormat.KEY_COLOR_STANDARD)) {
            colorStandardToToken(of.getInteger(MediaFormat.KEY_COLOR_STANDARD))
        } else "bt709"
        val colorTransferToken = if (of != null && of.containsKey(MediaFormat.KEY_COLOR_TRANSFER)) {
            colorTransferToToken(of.getInteger(MediaFormat.KEY_COLOR_TRANSFER))
        } else "sdr"
        val colorRangeToken = if (of != null && of.containsKey(MediaFormat.KEY_COLOR_RANGE)) {
            colorRangeToToken(of.getInteger(MediaFormat.KEY_COLOR_RANGE))
        } else "limited"
        // HEVC Main profile = 8-bit; Main10 = 10-bit. Derived from the profile token
        // (encoder-attested, not a literal).
        val colorDepthBits = if (profile == "main10") 10 else 8
        // KEY_MAX_B_FRAMES is API 25+; the encoder may or may not echo it back
        // on OUTPUT_FORMAT. Null = unreported (the composer's b_frames render
        // path treats null as "encoder didn't report → assert configured 0").
        val bFramesReported: Int? = if (Build.VERSION.SDK_INT >= 25 && of != null &&
            of.containsKey(MediaFormat.KEY_MAX_B_FRAMES)
        ) {
            of.getInteger(MediaFormat.KEY_MAX_B_FRAMES)
        } else null

        return VideoReport(
            width = width,
            height = height,
            codec = codec,
            profile = profile,
            bitrateBps = bitrateBps,
            bitrateBpsConfigured = HevcEncoder.BIT_RATE,
            bitrateModeToken = bitrateModeToken,
            gopFrames = gopFrames,
            colorStandardToken = colorStandardToken,
            colorTransferToken = colorTransferToken,
            colorRangeToken = colorRangeToken,
            colorDepthBits = colorDepthBits,
            bFramesReported = bFramesReported,
        )
    }
}
