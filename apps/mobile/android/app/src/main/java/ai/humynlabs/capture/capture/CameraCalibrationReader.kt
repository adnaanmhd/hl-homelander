package ai.humynlabs.capture.capture

import android.hardware.camera2.CameraCharacteristics
import org.json.JSONArray
import org.json.JSONObject

/**
 * Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09 — reads live-Camera2
 * camera intrinsics + cam-IMU extrinsics off the ULTRAWIDE physical
 * sub-camera's [CameraCharacteristics] (the lens HumynCapture actually
 * records on) and the openable logical camera's timestamp-source, mapping
 * them into the [CameraCalibration] shape that mirrors the SPC2 reference
 * rig's `meta.json` `calibration.camera` + `calibration.cam_imu_extrinsics`.
 *
 * **Null-fallback contract (T-elm-01).** The reader NEVER throws and capture
 * NEVER blocks on missing calibration:
 *   - When chars is null (JVM unit tests cannot construct CameraCharacteristics)
 *     OR `LENS_INTRINSIC_CALIBRATION` is null/empty (the device reports
 *     UNCALIBRATED — the common case on Pixels), intrinsics params are null
 *     and `intrinsicsSource = "camera2_uncalibrated"`.
 *   - When real intrinsics exist, `intrinsicsSource = "camera2"`.
 *   - Extrinsics require `LENS_POSE_REFERENCE == GYROSCOPE` (Camera2 only
 *     relates the lens pose to the IMU when the pose reference is the
 *     gyroscope) AND non-null pose values; otherwise the pose matrices are
 *     null and `extrinsicsSource = "camera2_no_imu_reference"`. When real
 *     values exist, `extrinsicsSource = "camera2"`.
 *
 * Every `CameraCharacteristics.get(...)` is wrapped in try/catch returning
 * the null-fallback so an arbitrary OEM device that throws on an unexpected
 * key cannot crash the capture path.
 *
 * **On-hardware note.** Genuine non-null intrinsics/extrinsics VALUES only
 * exist on a real device whose ultrawide sub-camera reports a factory
 * calibration; most Pixels report UNCALIBRATED, so the null-fallback path is
 * the expected CI-and-typical-device output. JVM unit tests can only verify
 * the null-fallback path + the pure math helpers
 * ([quaternionToRotationMatrix], [intrinsicArrayToParams]); non-null Camera2
 * output is a MANUAL on-device smoke item.
 */
data class CameraIntrinsics(
    /** Projection model token; mirrors meta.json `calibration.camera.model`. */
    val model: String,
    val resolutionWidth: Int?,
    val resolutionHeight: Int?,
    val fx: Double?,
    val fy: Double?,
    val cx: Double?,
    val cy: Double?,
    /** Skew (the 5th element of LENS_INTRINSIC_CALIBRATION). */
    val skew: Double?,
    val distortionCoeffs: List<Double>?,
    /** `"camera2"` (real values) | `"camera2_uncalibrated"` (null fallback). */
    val intrinsicsSource: String,
)

data class CamImuExtrinsics(
    /** 4x4 homogeneous transform (cam → imu); null when unavailable. */
    val tCamImu: List<List<Double>>?,
    /** 4x4 inverse (imu → cam); null when unavailable. */
    val tImuCam: List<List<Double>>?,
    /** Translation in millimetres (3-vector); null when unavailable. */
    val tCamImuTranslationMm: List<Double>?,
    /** Temporal offset; default 0.0 (Camera2 shares the boottime clock). */
    val timeshiftCamImuSec: Double,
    /** Verbatim from meta.json: `t_imu = t_cam + timeshift`. */
    val timeshiftMeaning: String,
    /** Human-readable clock-sync description derived from the timestamp source. */
    val clockSyncNote: String,
    /** `"camera2"` (real values) | `"camera2_no_imu_reference"` (null fallback). */
    val extrinsicsSource: String,
)

data class CameraCalibration(
    val camera: CameraIntrinsics,
    val camImuExtrinsics: CamImuExtrinsics,
)

object CameraCalibrationReader {

    private const val SOURCE_CALIBRATED = "camera2"
    private const val SOURCE_UNCALIBRATED = "camera2_uncalibrated"
    private const val SOURCE_NO_IMU_REF = "camera2_no_imu_reference"
    private const val TIMESHIFT_MEANING = "t_imu = t_cam + timeshift"
    private const val CLOCK_SYNC_SHARED =
        "camera + imu share the boottime (elapsedRealtimeNanos) clock"
    private const val CLOCK_SYNC_UNSHARED =
        "camera timestamps not on the shared boottime clock"

    /**
     * Read calibration from the ultrawide physical sub-camera's
     * [ultrawideChars] (intrinsics + extrinsics) and the openable logical
     * camera's [openableChars] (timestamp source for the clock-sync note).
     * Both nullable for JVM-test safety; never throws.
     */
    fun read(
        ultrawideChars: CameraCharacteristics?,
        openableChars: CameraCharacteristics?,
    ): CameraCalibration =
        CameraCalibration(
            camera = readIntrinsics(ultrawideChars),
            camImuExtrinsics = readExtrinsics(ultrawideChars, openableChars),
        )

    // ----------------------------------------------------------------
    // Intrinsics
    // ----------------------------------------------------------------

    private fun readIntrinsics(chars: CameraCharacteristics?): CameraIntrinsics {
        if (chars == null) return uncalibratedIntrinsics()

        // LENS_INTRINSIC_CALIBRATION = [fx, fy, cx, cy, s] (Camera2 spec).
        val intrinsicArray: FloatArray? = safeGet(chars, CameraCharacteristics.LENS_INTRINSIC_CALIBRATION)
        if (intrinsicArray == null || intrinsicArray.size < 4) {
            // UNCALIBRATED (common on Pixels) — full null fallback, but still
            // attempt to stamp the reference resolution if available.
            return uncalibratedIntrinsics(resolution(chars))
        }

        val params = intrinsicArrayToParams(intrinsicArray.map { it.toDouble() })
        // LENS_DISTORTION = radial/tangential coeffs [k1,k2,k3,p1,p2] (API 28+).
        val distortion: FloatArray? = safeGet(chars, CameraCharacteristics.LENS_DISTORTION)
        val (w, h) = resolution(chars)

        return CameraIntrinsics(
            model = "pinhole",
            resolutionWidth = w,
            resolutionHeight = h,
            fx = params.fx,
            fy = params.fy,
            cx = params.cx,
            cy = params.cy,
            skew = params.skew,
            distortionCoeffs = distortion?.map { it.toDouble() },
            intrinsicsSource = SOURCE_CALIBRATED,
        )
    }

    private fun uncalibratedIntrinsics(
        resolution: Pair<Int?, Int?> = null to null,
    ): CameraIntrinsics = CameraIntrinsics(
        model = "pinhole",
        resolutionWidth = resolution.first,
        resolutionHeight = resolution.second,
        fx = null,
        fy = null,
        cx = null,
        cy = null,
        skew = null,
        distortionCoeffs = null,
        intrinsicsSource = SOURCE_UNCALIBRATED,
    )

    /** Intrinsics reference frame = SENSOR_INFO_ACTIVE_ARRAY_SIZE. */
    private fun resolution(chars: CameraCharacteristics): Pair<Int?, Int?> {
        val rect = safeGet(chars, CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
        return if (rect != null) rect.width() to rect.height() else null to null
    }

    // ----------------------------------------------------------------
    // Extrinsics
    // ----------------------------------------------------------------

    private fun readExtrinsics(
        ultrawideChars: CameraCharacteristics?,
        openableChars: CameraCharacteristics?,
    ): CamImuExtrinsics {
        val clockSyncNote = clockSyncNote(openableChars)

        if (ultrawideChars == null) {
            return noImuExtrinsics(clockSyncNote)
        }

        // Camera2 only relates the lens pose to the IMU/gyroscope when
        // LENS_POSE_REFERENCE == GYROSCOPE.
        val poseReference: Int? = safeGet(ultrawideChars, CameraCharacteristics.LENS_POSE_REFERENCE)
        if (poseReference == null ||
            poseReference != CameraCharacteristics.LENS_POSE_REFERENCE_GYROSCOPE
        ) {
            return noImuExtrinsics(clockSyncNote)
        }

        // LENS_POSE_TRANSLATION = [x,y,z] metres; LENS_POSE_ROTATION = quaternion [x,y,z,w].
        val translation: FloatArray? = safeGet(ultrawideChars, CameraCharacteristics.LENS_POSE_TRANSLATION)
        val rotation: FloatArray? = safeGet(ultrawideChars, CameraCharacteristics.LENS_POSE_ROTATION)
        if (translation == null || translation.size < 3 ||
            rotation == null || rotation.size < 4
        ) {
            return noImuExtrinsics(clockSyncNote)
        }

        val tx = translation[0].toDouble()
        val ty = translation[1].toDouble()
        val tz = translation[2].toDouble()
        val rot = quaternionToRotationMatrix(
            rotation[0].toDouble(),
            rotation[1].toDouble(),
            rotation[2].toDouble(),
            rotation[3].toDouble(),
        )

        val tCamImu = homogeneous(rot, listOf(tx, ty, tz))
        val tImuCam = invertRigid(rot, listOf(tx, ty, tz))
        val translationMm = listOf(tx * 1000.0, ty * 1000.0, tz * 1000.0)

        return CamImuExtrinsics(
            tCamImu = tCamImu,
            tImuCam = tImuCam,
            tCamImuTranslationMm = translationMm,
            timeshiftCamImuSec = 0.0,
            timeshiftMeaning = TIMESHIFT_MEANING,
            clockSyncNote = clockSyncNote,
            extrinsicsSource = SOURCE_CALIBRATED,
        )
    }

    private fun noImuExtrinsics(clockSyncNote: String): CamImuExtrinsics = CamImuExtrinsics(
        tCamImu = null,
        tImuCam = null,
        tCamImuTranslationMm = null,
        timeshiftCamImuSec = 0.0,
        timeshiftMeaning = TIMESHIFT_MEANING,
        clockSyncNote = clockSyncNote,
        extrinsicsSource = SOURCE_NO_IMU_REF,
    )

    private fun clockSyncNote(openableChars: CameraCharacteristics?): String {
        if (openableChars == null) return CLOCK_SYNC_UNSHARED
        val source: Int? = safeGet(openableChars, CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)
        return if (source != null &&
            source == CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME
        ) {
            CLOCK_SYNC_SHARED
        } else {
            CLOCK_SYNC_UNSHARED
        }
    }

    // ----------------------------------------------------------------
    // Pure math helpers (no Android framework objects — JVM-testable).
    // ----------------------------------------------------------------

    /** fx/fy/cx/cy/skew extracted from a Camera2 LENS_INTRINSIC_CALIBRATION array. */
    data class IntrinsicParams(
        val fx: Double?,
        val fy: Double?,
        val cx: Double?,
        val cy: Double?,
        val skew: Double?,
    )

    /**
     * Maps a Camera2 `LENS_INTRINSIC_CALIBRATION` array `[fx, fy, cx, cy, s]`
     * to [IntrinsicParams]. Tolerates a 4-element array (no skew → null).
     */
    internal fun intrinsicArrayToParams(arr: List<Double>): IntrinsicParams {
        if (arr.size < 4) return IntrinsicParams(null, null, null, null, null)
        return IntrinsicParams(
            fx = arr[0],
            fy = arr[1],
            cx = arr[2],
            cy = arr[3],
            skew = if (arr.size >= 5) arr[4] else null,
        )
    }

    /**
     * Quaternion `(x, y, z, w)` → 3x3 rotation matrix (row-major). Normalizes
     * the quaternion first so a non-unit input doesn't skew the matrix. A
     * zero-norm quaternion degrades to the identity rotation.
     */
    internal fun quaternionToRotationMatrix(
        x: Double,
        y: Double,
        z: Double,
        w: Double,
    ): List<List<Double>> {
        val norm = Math.sqrt(x * x + y * y + z * z + w * w)
        if (norm == 0.0) {
            return listOf(
                listOf(1.0, 0.0, 0.0),
                listOf(0.0, 1.0, 0.0),
                listOf(0.0, 0.0, 1.0),
            )
        }
        val nx = x / norm
        val ny = y / norm
        val nz = z / norm
        val nw = w / norm

        val xx = nx * nx
        val yy = ny * ny
        val zz = nz * nz
        val xy = nx * ny
        val xz = nx * nz
        val yz = ny * nz
        val wx = nw * nx
        val wy = nw * ny
        val wz = nw * nz

        return listOf(
            listOf(1.0 - 2.0 * (yy + zz), 2.0 * (xy - wz), 2.0 * (xz + wy)),
            listOf(2.0 * (xy + wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz - wx)),
            listOf(2.0 * (xz - wy), 2.0 * (yz + wx), 1.0 - 2.0 * (xx + yy)),
        )
    }

    /** Assemble a 4x4 homogeneous transform from a 3x3 rotation + 3-vector translation. */
    internal fun homogeneous(rot: List<List<Double>>, t: List<Double>): List<List<Double>> =
        listOf(
            listOf(rot[0][0], rot[0][1], rot[0][2], t[0]),
            listOf(rot[1][0], rot[1][1], rot[1][2], t[1]),
            listOf(rot[2][0], rot[2][1], rot[2][2], t[2]),
            listOf(0.0, 0.0, 0.0, 1.0),
        )

    /**
     * Inverse of a rigid transform `[R | t]`: `[Rᵀ | -Rᵀt]`. Returns the 4x4
     * homogeneous inverse.
     */
    internal fun invertRigid(rot: List<List<Double>>, t: List<Double>): List<List<Double>> {
        // Rᵀ
        val rt = listOf(
            listOf(rot[0][0], rot[1][0], rot[2][0]),
            listOf(rot[0][1], rot[1][1], rot[2][1]),
            listOf(rot[0][2], rot[1][2], rot[2][2]),
        )
        // -Rᵀ t
        val nt = listOf(
            -(rt[0][0] * t[0] + rt[0][1] * t[1] + rt[0][2] * t[2]),
            -(rt[1][0] * t[0] + rt[1][1] * t[1] + rt[1][2] * t[2]),
            -(rt[2][0] * t[0] + rt[2][1] * t[1] + rt[2][2] * t[2]),
        )
        return homogeneous(rt, nt)
    }

    /** Null-tolerant CameraCharacteristics.get — never throws (T-elm-01). */
    private fun <T> safeGet(chars: CameraCharacteristics, key: CameraCharacteristics.Key<T>): T? =
        try {
            chars.get(key)
        } catch (_: Throwable) {
            null
        }
}

/**
 * Quick task 260522-elm — the single source of truth for the on-disk JSON
 * shape of the `calibration` block. Used by BOTH [SidecarManager.write] /
 * [SidecarManager.read] (the per-segment `.session.json` sidecar) AND
 * [MetadataComposer.compose] (the canonical `video_metadata.json` top-level
 * `calibration` sibling) so the two never drift. Mirrors the SPC2 reference
 * rig's `meta.json` `calibration.camera` + `calibration.cam_imu_extrinsics`
 * shapes.
 *
 * [toJson] emits the FULL key structure even for a null/uncalibrated
 * [CameraCalibration]; [uncalibratedFallback] is the always-present block
 * the composer stamps when the sidecar carried no calibration (older
 * sidecars on disk, or a JVM/CI run). This guarantees the `calibration`
 * block is ALWAYS present with the full key set.
 */
object CalibrationJson {

    /** Serialize a [CameraCalibration] to the meta.json-mirroring JSON shape. */
    fun toJson(calibration: CameraCalibration): JSONObject {
        val cam = calibration.camera
        val ext = calibration.camImuExtrinsics

        val params = JSONObject()
            .put("fx", cam.fx ?: JSONObject.NULL)
            .put("fy", cam.fy ?: JSONObject.NULL)
            .put("cx", cam.cx ?: JSONObject.NULL)
            .put("cy", cam.cy ?: JSONObject.NULL)
            .put("skew", cam.skew ?: JSONObject.NULL)

        val cameraJson = JSONObject()
            .put("model", cam.model)
            .put("resolution", resolutionArrayOrNull(cam.resolutionWidth, cam.resolutionHeight))
            .put("params", params)
            .put("distortion_coeffs", doubleListToArrayOrNull(cam.distortionCoeffs))
            .put("intrinsics_source", cam.intrinsicsSource)

        val extrinsicsJson = JSONObject()
            .put("T_cam_imu", matrixToArrayOrNull(ext.tCamImu))
            .put("T_imu_cam", matrixToArrayOrNull(ext.tImuCam))
            .put("T_cam_imu_translation_mm", doubleListToArrayOrNull(ext.tCamImuTranslationMm))
            .put("timeshift_cam_imu_sec", ext.timeshiftCamImuSec)
            .put("timeshift_meaning", ext.timeshiftMeaning)
            .put("clock_sync_note", ext.clockSyncNote)
            .put("extrinsics_source", ext.extrinsicsSource)

        return JSONObject()
            .put("camera", cameraJson)
            .put("cam_imu_extrinsics", extrinsicsJson)
    }

    /**
     * The always-present uncalibrated-fallback calibration block, emitted
     * when no calibration was captured (null sidecar value, JVM/CI). Full
     * key structure, null params, `intrinsics_source = "camera2_uncalibrated"`
     * + `extrinsics_source = "camera2_no_imu_reference"`.
     */
    fun uncalibratedFallback(): JSONObject = toJson(
        CameraCalibration(
            camera = CameraIntrinsics(
                model = "pinhole",
                resolutionWidth = null,
                resolutionHeight = null,
                fx = null,
                fy = null,
                cx = null,
                cy = null,
                skew = null,
                distortionCoeffs = null,
                intrinsicsSource = "camera2_uncalibrated",
            ),
            camImuExtrinsics = CamImuExtrinsics(
                tCamImu = null,
                tImuCam = null,
                tCamImuTranslationMm = null,
                timeshiftCamImuSec = 0.0,
                timeshiftMeaning = "t_imu = t_cam + timeshift",
                clockSyncNote = "camera timestamps not on the shared boottime clock",
                extrinsicsSource = "camera2_no_imu_reference",
            ),
        ),
    )

    /**
     * Deserialize a `calibration` JSON object back into a [CameraCalibration].
     * Returns null when [json] is null (older sidecars without the key) — the
     * composer then stamps [uncalibratedFallback].
     */
    fun fromJson(json: JSONObject?): CameraCalibration? {
        if (json == null) return null
        return try {
            val cam = json.getJSONObject("camera")
            val params = cam.optJSONObject("params")
            val ext = json.getJSONObject("cam_imu_extrinsics")
            CameraCalibration(
                camera = CameraIntrinsics(
                    model = cam.optString("model", "pinhole"),
                    resolutionWidth = arrayInt(cam.optJSONArray("resolution"), 0),
                    resolutionHeight = arrayInt(cam.optJSONArray("resolution"), 1),
                    fx = optDoubleOrNull(params, "fx"),
                    fy = optDoubleOrNull(params, "fy"),
                    cx = optDoubleOrNull(params, "cx"),
                    cy = optDoubleOrNull(params, "cy"),
                    skew = optDoubleOrNull(params, "skew"),
                    distortionCoeffs = doubleList(cam.optJSONArray("distortion_coeffs")),
                    intrinsicsSource = cam.optString("intrinsics_source", "camera2_uncalibrated"),
                ),
                camImuExtrinsics = CamImuExtrinsics(
                    tCamImu = matrix(ext.optJSONArray("T_cam_imu")),
                    tImuCam = matrix(ext.optJSONArray("T_imu_cam")),
                    tCamImuTranslationMm = doubleList(ext.optJSONArray("T_cam_imu_translation_mm")),
                    timeshiftCamImuSec = ext.optDouble("timeshift_cam_imu_sec", 0.0),
                    timeshiftMeaning = ext.optString("timeshift_meaning", "t_imu = t_cam + timeshift"),
                    clockSyncNote = ext.optString("clock_sync_note", ""),
                    extrinsicsSource = ext.optString("extrinsics_source", "camera2_no_imu_reference"),
                ),
            )
        } catch (_: Throwable) {
            // A malformed calibration block degrades to the uncalibrated
            // fallback (composer re-stamps) rather than failing the sidecar
            // read — calibration is non-load-bearing telemetry.
            null
        }
    }

    private fun resolutionArrayOrNull(w: Int?, h: Int?): Any =
        if (w != null && h != null) JSONArray().put(w).put(h) else JSONObject.NULL

    private fun doubleListToArrayOrNull(list: List<Double>?): Any =
        if (list != null) JSONArray().also { a -> list.forEach { a.put(it) } } else JSONObject.NULL

    private fun matrixToArrayOrNull(matrix: List<List<Double>>?): Any =
        if (matrix != null) {
            JSONArray().also { outer ->
                matrix.forEach { row ->
                    outer.put(JSONArray().also { inner -> row.forEach { inner.put(it) } })
                }
            }
        } else {
            JSONObject.NULL
        }

    private fun optDoubleOrNull(obj: JSONObject?, key: String): Double? =
        if (obj != null && obj.has(key) && !obj.isNull(key)) obj.getDouble(key) else null

    private fun arrayInt(arr: JSONArray?, idx: Int): Int? =
        if (arr != null && idx < arr.length() && !arr.isNull(idx)) arr.getInt(idx) else null

    private fun doubleList(arr: JSONArray?): List<Double>? {
        if (arr == null) return null
        return (0 until arr.length()).map { arr.getDouble(it) }
    }

    private fun matrix(arr: JSONArray?): List<List<Double>>? {
        if (arr == null) return null
        return (0 until arr.length()).map { i ->
            val row = arr.getJSONArray(i)
            (0 until row.length()).map { j -> row.getDouble(j) }
        }
    }
}
