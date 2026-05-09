package ai.humynlabs.capture.compat

import android.content.Context

/**
 * Behavioral encoder probe (COMPAT-07). Writes a 5-second 1080p HEVC clip to
 * cacheDir/compat-probe-{epochMs}.mp4, parses NAL units to detect B-frames,
 * reads back OIS state from TotalCaptureResult, and confirms HDR→SDR force
 * on Android 13+. The clip is ALWAYS deleted in a finally block — no probe
 * artefact ever survives a crash (D-COMPAT-04, T-2.12-01 mitigation).
 *
 * SHELL ONLY — plan 02-06. Plan 02-12 fills in:
 *   - MediaCodec encoder configured with HEVC + 1080p + KEY_BITRATE_MODE=CBR
 *     + KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0 (the hint, not the proof)
 *   - Camera2 capture session with LENS_OPTICAL_STABILIZATION_MODE_OFF and
 *     CONTROL_VIDEO_STABILIZATION_MODE_OFF
 *   - DynamicRangeProfiles.STANDARD on API 33+ (Pitfall 3 SDK guard;
 *     hdrSdrForced=true automatically on API < 33)
 *   - 5-second muxer drain into MediaMuxer + collected encoder buffers
 *   - NalParser invocation against collected encoder bytes
 *   - finally { cacheFile.delete() } — clip cleanup contract
 *
 * Reference: RESEARCH § Pitfalls 1, 2, 3 + § Code Examples (encoder + OIS).
 */
class EncoderProbe(private val ctx: Context) {

    /**
     * Probe outcome. `encoderClipPath` is the absolute path to the cacheDir
     * file the probe wrote — by the time this Result reaches the caller, the
     * file has already been deleted by the finally block. The path is kept
     * solely for diagnostic logging (T-2.6-01: accept; not persisted).
     */
    data class Result(
        val bFramePresent: Boolean,
        val oisOff: Boolean,
        val hdrSdrForced: Boolean,
        val encoderClipPath: String,
    )

    /**
     * Run the 5-second behavioral probe.
     *
     * SHELL ONLY: throws NotImplementedError until 02-12 lands.
     * Caller (HumynCompatModule.runEncoderProbe) wraps this throw into a
     * rejected Promise with code "ENCODER_PROBE_ERROR".
     */
    fun run(): Result {
        // TODO(02-12): real implementation — see class docstring for the full
        // surface. Until then, JS callers observe a rejected Promise.
        throw NotImplementedError("EncoderProbe.run — implemented in plan 02-12")
    }
}
