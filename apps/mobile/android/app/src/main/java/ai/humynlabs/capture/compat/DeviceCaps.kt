package ai.humynlabs.capture.compat

import ai.humynlabs.capture.capture.common.BackUltrawidePicker
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.os.Build
import android.os.Environment
import android.os.StatFs
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.sqrt

/**
 * Type alias re-export — Phase 3 Plan 03-08 extracted the UltrawidePick
 * data class into `ai.humynlabs.capture.capture.common`. The alias keeps
 * any in-package callers (e.g., the existing `pickBackUltrawideCamera`
 * back-compat alias) compiling against `UltrawidePick` without an
 * explicit import; external callers should reference the new
 * `ai.humynlabs.capture.capture.common.UltrawidePick` directly.
 */
internal typealias UltrawidePick = ai.humynlabs.capture.capture.common.UltrawidePick

/**
 * COMPAT-01 + COMPAT-03 + COMPAT-07 — non-recording capability enumeration.
 *
 * Returns a [WritableMap] matching the JS `readDeviceCaps()` contract from
 * `apps/mobile/src/native/HumynCompat.ts` (`DeviceCapsResult`).
 *
 * Output keys:
 *   - resolutionMax:           { w: Int, h: Int }   long edge ≥ 1920 required by COMPAT-01
 *   - fpsMax:                  Int                  ≥ 30 required by COMPAT-01
 *   - ultrawideDfovDeg:        Double               ≥ 110° required by COMPAT-01 (D-COMPAT-02)
 *   - micSampleRateMax:        Int                  48000 if AudioRecord(48k mono PCM16) ok, else 0
 *   - realtimeTimestampSource: Boolean              SENSOR_INFO_TIMESTAMP_SOURCE == REALTIME
 *   - motionSensorsPresent:    Boolean              gyro AND accelerometer present
 *   - rooted:                  Boolean              best-effort heuristic; Play Integrity is binding
 *   - freeStorageGB:           Double               internal data partition (StatFs)
 *
 * `freeStorageGB` < 5 produces a WARNING ONLY (warningOnly=true wired in plan 02-16
 * compatService) — this class does NOT make pass/fail decisions, it only reports.
 *
 * `rooted` is a best-effort heuristic (Build.TAGS + filesystem probe);
 * Play Integrity (Phase 1) is the authoritative root verdict.
 *
 * Pitfall 5 — back-camera selection: must pick the camera with the SHORTEST
 * focal length (= widest dFOV = ultrawide). Picking just the first BACK camera
 * may land on the telephoto and report ~25° dFOV.
 *
 * Logical multi-camera handling (Pixel 7+, Galaxy S20+, etc.): on Camera2 API,
 * modern multi-lens phones expose a single LOGICAL_MULTI_CAMERA per facing
 * direction in `cameraIdList`; the individual physical lenses (main / ultrawide
 * / telephoto) live behind `LOGICAL_MULTI_CAMERA.physicalIds`. Iterating only
 * the public ID list reads the logical camera's DEFAULT physical (usually the
 * main wide), missing the ultrawide entirely. The fix: flatten public IDs ∪
 * physical sub-IDs, then pick min-focal across the flattened set. Resolution,
 * FPS and timestamp source must still come from the LOGICAL parent (the openable
 * camera) since physical sub-cameras don't expose their own session config.
 *
 * dFOV math: 2 * atan(sensor_diagonal / (2 * focal)) — see RESEARCH § Code Examples.
 */
class DeviceCaps(private val ctx: Context) {

    /**
     * Single entry point — returns a JS-bridge-ready WritableMap so the calling
     * TurboModule (HumynCompatModule.readDeviceCaps) can pass it straight to
     * promise.resolve without re-shaping. Shape matches DeviceCapsResult in
     * apps/mobile/src/native/HumynCompat.ts.
     */
    fun readAll(): WritableMap {
        val out = Arguments.createMap()

        // --- 1. Camera capabilities — back ultrawide (Pitfall 5) ---------------
        val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        val pick = mgr?.let { pickBackUltrawide(it) }

        val resolutionMap = Arguments.createMap()
        if (pick != null) {
            // Resolution/FPS belong to the OPENABLE (logical or sole) camera.
            val (resW, resH) = readMaxResolution(pick.openableChars)
            resolutionMap.putInt("w", resW)
            resolutionMap.putInt("h", resH)
            out.putInt("fpsMax", readMaxFps(pick.openableChars))
            // dFOV belongs to the SPECIFIC physical sub-camera (the ultrawide).
            out.putDouble("ultrawideDfovDeg", computeDfov(pick.ultrawideChars).toDouble())
        } else {
            resolutionMap.putInt("w", 0)
            resolutionMap.putInt("h", 0)
            out.putInt("fpsMax", 0)
            out.putDouble("ultrawideDfovDeg", 0.0)
        }
        out.putMap("resolutionMax", resolutionMap)

        // --- 2. Microphone 48 kHz mono PCM16 -----------------------------------
        val micBuf = AudioRecord.getMinBufferSize(
            48_000,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        out.putInt("micSampleRateMax", if (micBuf > 0) 48_000 else 0)

        // --- 3. REALTIME timestamp source (Camera2 logical parent) -------------
        // Read from the openable (logical) camera — this is the device-level
        // sensor clock domain and is identical for all physical sub-cameras.
        val realtime = pick?.openableChars
            ?.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE) ==
            CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME
        out.putBoolean("realtimeTimestampSource", realtime)

        // --- 4. Motion sensors present (gyro + accel) --------------------------
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val hasGyro = sm?.getDefaultSensor(Sensor.TYPE_GYROSCOPE) != null
        val hasAccel = sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
        out.putBoolean("motionSensorsPresent", hasGyro && hasAccel)

        // --- 5. Rooted (best-effort; Play Integrity is binding) ----------------
        out.putBoolean("rooted", isLikelyRooted())

        // --- 6. Free storage GB — internal data partition ----------------------
        out.putDouble("freeStorageGB", readFreeStorageGB())

        return out
    }

    /**
     * Pick the back ultrawide. Returns the openable (logical or sole) camera ID
     * paired with the characteristics of the specific physical sub-camera that
     * owns the shortest focal length — the ultrawide. Pitfall 5 + logical
     * multi-camera handling.
     *
     * Phase 3 Plan 03-08: thin delegate to
     * [BackUltrawidePicker.pick] (extracted shared util) per CONTEXT.md
     * "Claude's Discretion" option (a). Behavior is unchanged — the
     * existing `DeviceCapsTest` suite is the regression safety net.
     */
    internal fun pickBackUltrawide(mgr: CameraManager): UltrawidePick? =
        BackUltrawidePicker.pick(mgr)

    /**
     * Back-compat alias for callers that only need the openable camera ID.
     * Retained so existing call sites and tests keep working.
     */
    internal fun pickBackUltrawideCamera(mgr: CameraManager): String? =
        pickBackUltrawide(mgr)?.openableId

    /** Read max resolution (long edge, short edge) from StreamConfigurationMap. */
    internal fun readMaxResolution(chars: CameraCharacteristics): Pair<Int, Int> {
        val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            ?: return 0 to 0
        val sizes = map.getOutputSizes(android.graphics.ImageFormat.YUV_420_888) ?: return 0 to 0
        if (sizes.isEmpty()) return 0 to 0
        val largest = sizes.maxByOrNull { it.width.toLong() * it.height.toLong() } ?: return 0 to 0
        // Return (w, h) as Camera2 reports them; the >= 1920 long-edge check
        // lives in compatService (plan 02-16) which inspects max(w, h).
        return largest.width to largest.height
    }

    /** Read max sustained FPS via CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES.upper. */
    internal fun readMaxFps(chars: CameraCharacteristics): Int {
        val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?: return 0
        return fpsRanges.maxOfOrNull { it.upper } ?: 0
    }

    /** dFOV = 2 * atan(sensor_diag / (2 * focal)) — degrees. */
    internal fun computeDfov(chars: CameraCharacteristics): Float {
        val focals = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: return 0f
        val size = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: return 0f
        if (focals.isEmpty()) return 0f
        val focalMm = focals.min()
        return computeDfovFromValues(focalMm, size.width, size.height)
    }

    /** Pure function for testability — RESEARCH § Code Examples lines 764-788. */
    internal fun computeDfovFromValues(
        focalMm: Float,
        sensorWidthMm: Float,
        sensorHeightMm: Float,
    ): Float {
        if (focalMm <= 0f) return 0f
        val diag = sqrt(sensorWidthMm * sensorWidthMm + sensorHeightMm * sensorHeightMm)
        return (2.0 * atan(diag / (2.0 * focalMm)) * (180.0 / PI)).toFloat()
    }

    internal fun readFreeStorageGB(): Double {
        return try {
            val statFs = StatFs(Environment.getDataDirectory().path)
            statFs.availableBytes / 1_000_000_000.0
        } catch (_: Throwable) {
            // If StatFs fails (e.g. headless test environment without a real
            // data partition) report 0; downstream COMPAT-03 banner will warn.
            0.0
        }
    }

    /**
     * Best-effort root verdict — Play Integrity is authoritative.
     *   Heuristic 1: Build.TAGS contains "test-keys" (custom-built ROM)
     *   Heuristic 2: presence of su binary in any of a small set of
     *   well-known PATH-like locations.
     */
    internal fun isLikelyRooted(): Boolean {
        val tags = Build.TAGS
        if (tags != null && tags.contains("test-keys")) return true
        val paths = listOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/system/app/Superuser.apk",
            "/data/local/xbin/su",
            "/data/local/bin/su",
        )
        return paths.any {
            try {
                File(it).exists()
            } catch (_: SecurityException) {
                false
            }
        }
    }
}
