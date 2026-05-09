package ai.humynlabs.capture.compat

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
        val ultrawideId = mgr?.let { pickBackUltrawideCamera(it) }
        val ultrawideChars = ultrawideId?.let { mgr.getCameraCharacteristics(it) }

        val resolutionMap = Arguments.createMap()
        if (ultrawideChars != null) {
            val (resW, resH) = readMaxResolution(ultrawideChars)
            resolutionMap.putInt("w", resW)
            resolutionMap.putInt("h", resH)
            out.putInt("fpsMax", readMaxFps(ultrawideChars))
            out.putDouble("ultrawideDfovDeg", computeDfov(ultrawideChars).toDouble())
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

        // --- 3. REALTIME timestamp source (Camera2 ultrawide) ------------------
        val realtime = ultrawideChars
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

    /** Pick the back camera with shortest focal length (= widest dFOV). Pitfall 5. */
    internal fun pickBackUltrawideCamera(mgr: CameraManager): String? {
        val backCameras = try {
            mgr.cameraIdList.mapNotNull { id ->
                val chars = try {
                    mgr.getCameraCharacteristics(id)
                } catch (_: Throwable) {
                    null
                }
                if (chars != null &&
                    chars.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
                ) {
                    id to chars
                } else {
                    null
                }
            }
        } catch (_: Throwable) {
            return null
        }
        if (backCameras.isEmpty()) return null

        return backCameras.minByOrNull { (_, chars) ->
            val focals = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
            if (focals == null || focals.isEmpty()) Float.MAX_VALUE else focals.min()
        }?.first
    }

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
