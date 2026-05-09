package ai.humynlabs.capture.compat

import android.content.Context

/**
 * Static device-capability enumeration for COMPAT-01 / COMPAT-03 / COMPAT-07.
 * Reads what the device says it can do (vs. EncoderProbe / ImuProbe which
 * verify what the device actually does).
 *
 * SHELL ONLY — plan 02-06. Plan 02-14 fills in:
 *   - resolutionMax / fpsMax via CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP
 *     + CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES
 *   - ultrawideDfovDeg via the back camera with the shortest focal length
 *     (RESEARCH § Pitfall 5 — must pick the BACK ULTRAWIDE camera, not just
 *     the first back camera; that may be the telephoto and report 25° dFOV)
 *   - micSampleRateMax via AudioRecord.getMinBufferSize(48000, MONO, PCM16) > 0
 *   - realtimeTimestampSource via SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME
 *   - rooted via Build.TAGS contains "test-keys" + filesystem heuristic
 *     (best-effort; Play Integrity from Phase 1 is the binding gate)
 *   - freeStorageGB via StatFs(Environment.getDataDirectory().path)
 *     COMPAT-03: < 5 GB → warningOnly=true (banner in CompatPassScreen, NOT a
 *     fail) — that policy lives in compatService (plan 02-16), not here.
 */
class DeviceCaps(private val ctx: Context) {

    data class Result(
        /** Pair(width, height) — long edge ≥ 1920 required by COMPAT-01. */
        val resolutionMax: Pair<Int, Int>,
        /** Maximum sustained FPS (≥ 30 required by COMPAT-01). */
        val fpsMax: Int,
        /** Diagonal FOV of the back ultrawide camera, degrees (≥ 110° required by COMPAT-01). */
        val ultrawideDfovDeg: Float,
        /** 48000 if AudioRecord(48k mono PCM16) returns positive min buffer size, else 0. */
        val micSampleRateMax: Int,
        /** SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME on the back ultrawide. */
        val realtimeTimestampSource: Boolean,
        /** Best-effort root verdict; Play Integrity is authoritative. */
        val rooted: Boolean,
        /** Internal data partition free-space, gigabytes. < 5 → COMPAT-03 warning. */
        val freeStorageGB: Float,
    )

    /**
     * Read static device capabilities. SHELL ONLY: throws NotImplementedError
     * until 02-14 lands. Caller (HumynCompatModule.readDeviceCaps) wraps this
     * throw into a rejected Promise with code "DEVICE_CAPS_ERROR".
     */
    fun read(): Result {
        // TODO(02-14): real implementation — see class docstring for the full
        // 7-field readback against CameraCharacteristics + AudioRecord +
        // SensorManager + StatFs + Build.TAGS heuristic.
        throw NotImplementedError("DeviceCaps.read — implemented in plan 02-14")
    }
}
