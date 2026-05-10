package ai.humynlabs.capture.capture

import org.json.JSONException
import org.json.JSONObject
import java.io.File

/**
 * Phase 3 D-FS-05 — per-segment `.session.json` sidecar (Plan 03-05
 * Task 3; CONTEXT.md `<specifics>`).
 *
 * Stash JS-provided opts + segment timing data at segment-start; delete
 * at finalize-time canonical metadata-JSON write. An orphan sidecar
 * means the finalize never completed — app-launch sweep (Plan 03-08)
 * uses the orphan to attempt re-finalize.
 *
 * **Schema version:** `1.0.0` — bumps independently of
 * `video_metadata.json`'s `schema_version` (which is at `1.1.0` after
 * the `imu_min_rate_hz_observed_p1` field addition).
 *
 * **Storage:** `org.json.JSONObject` (JDK + Android — no kotlinx-
 * serialization dep needed). The schema is small (~12 fields) and
 * round-trip stability is the only invariant we care about.
 *
 * **Threat T-3.4-01 mitigation (PLAN.md `<threat_model>`):** corrupt
 * mid-write sidecar → `JSONObject(text)` parse throws →
 * IllegalArgumentException("sidecar_corrupt"). App-launch sweep
 * (Plan 03-08) discards the corrupt sidecar + its MP4/CSV. The triple
 * loss is acceptable — same outcome as a crash before sidecar write.
 */
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

data class StartGate(
    val type: String,
    val passed: Boolean,
    val skipped: Boolean,
    val bypassed: Boolean,
    val durationMs: Int,
    val consecutiveHitsRequired: Int,
    val platformCadenceMs: Int,
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

object SidecarManager {
    const val CURRENT_SCHEMA_VERSION = "1.0.0"

    /**
     * Writes `payload` to `file` as a 2-space-indented JSON object whose
     * shape matches CONTEXT.md `<specifics>` verbatim.
     */
    fun write(file: File, payload: SidecarPayload) {
        val json = JSONObject()
            .put("schema_version", payload.schemaVersion)
            .put("session_id", payload.sessionId)
            .put("segment_id", payload.segmentId)
            .put("recording_id", payload.recordingId)
            .put("filename_base", payload.filenameBase)
            .put("started_at_ns", payload.startedAtNs)
            .put("wallclock_start_iso", payload.wallclockStartIso)
            .put("is_practice", payload.isPractice)
            .put(
                "task_info_partial",
                JSONObject()
                    .put("task_id", payload.taskInfoPartial.taskId)
                    .put("task_name", payload.taskInfoPartial.taskName)
                    .put("task_category", payload.taskInfoPartial.taskCategory)
                    .put("task_setting", payload.taskInfoPartial.taskSetting),
            )
            .put(
                "contributor_info",
                JSONObject()
                    .put("name", payload.contributorInfo.name)
                    .put("email", payload.contributorInfo.email)
                    .put("age", payload.contributorInfo.age ?: JSONObject.NULL)
                    .put("gender", payload.contributorInfo.gender ?: JSONObject.NULL)
                    .put("consent", payload.contributorInfo.consent),
            )
            .put(
                "start_gate",
                JSONObject()
                    .put("type", payload.startGate.type)
                    .put("passed", payload.startGate.passed)
                    .put("skipped", payload.startGate.skipped)
                    .put("bypassed", payload.startGate.bypassed)
                    .put("duration_ms", payload.startGate.durationMs)
                    .put("consecutive_hits_required", payload.startGate.consecutiveHitsRequired)
                    .put("platform_cadence_ms", payload.startGate.platformCadenceMs),
            )
            .put(
                "capture_device_info_partial",
                JSONObject()
                    .put("type", payload.captureDeviceInfoPartial.type)
                    .put("model", payload.captureDeviceInfoPartial.model)
                    .put("os", payload.captureDeviceInfoPartial.os)
                    .put("os_version", payload.captureDeviceInfoPartial.osVersion)
                    .put("app_version", payload.captureDeviceInfoPartial.appVersion)
                    .put("dfov_degrees", payload.captureDeviceInfoPartial.dfovDegrees)
                    .put("ip_address", payload.captureDeviceInfoPartial.ipAddress ?: JSONObject.NULL)
                    .put("location", payload.captureDeviceInfoPartial.location ?: JSONObject.NULL),
            )

        file.writeText(json.toString(2))
    }

    /**
     * Reads `file` back into a [SidecarPayload]. Throws
     * `IllegalArgumentException("sidecar_corrupt")` if the JSON parser
     * rejects the file (T-3.4-01 mitigation; caller — Plan 03-08's
     * app-launch sweep — discards the corrupt sidecar + its MP4/CSV).
     *
     * @throws java.io.FileNotFoundException if `file` does not exist;
     *   caller handles missing-sidecar case explicitly (see Plan 03-08).
     */
    fun read(file: File): SidecarPayload {
        try {
            val text = file.readText()
            val json = JSONObject(text)
            val ti = json.getJSONObject("task_info_partial")
            val ci = json.getJSONObject("contributor_info")
            val sg = json.getJSONObject("start_gate")
            val cd = json.getJSONObject("capture_device_info_partial")
            return SidecarPayload(
                schemaVersion = json.getString("schema_version"),
                sessionId = json.getString("session_id"),
                segmentId = json.getString("segment_id"),
                recordingId = json.getString("recording_id"),
                filenameBase = json.getString("filename_base"),
                startedAtNs = json.getLong("started_at_ns"),
                wallclockStartIso = json.getString("wallclock_start_iso"),
                isPractice = json.getBoolean("is_practice"),
                taskInfoPartial = TaskInfoPartial(
                    ti.getString("task_id"),
                    ti.getString("task_name"),
                    ti.getString("task_category"),
                    ti.getString("task_setting"),
                ),
                contributorInfo = ContributorInfo(
                    ci.getString("name"),
                    ci.getString("email"),
                    if (ci.isNull("age")) null else ci.getInt("age"),
                    if (ci.isNull("gender")) null else ci.getString("gender"),
                    ci.getBoolean("consent"),
                ),
                startGate = StartGate(
                    sg.getString("type"),
                    sg.getBoolean("passed"),
                    sg.getBoolean("skipped"),
                    sg.getBoolean("bypassed"),
                    sg.getInt("duration_ms"),
                    sg.getInt("consecutive_hits_required"),
                    sg.getInt("platform_cadence_ms"),
                ),
                captureDeviceInfoPartial = CaptureDeviceInfoPartial(
                    cd.getString("type"),
                    cd.getString("model"),
                    cd.getString("os"),
                    cd.getString("os_version"),
                    cd.getString("app_version"),
                    cd.getDouble("dfov_degrees"),
                    if (cd.isNull("ip_address")) null else cd.getString("ip_address"),
                    if (cd.isNull("location")) null else cd.getString("location"),
                ),
            )
        } catch (e: JSONException) {
            throw IllegalArgumentException("sidecar_corrupt", e)
        }
    }

    /** Deletes `file`. Returns true if the file was removed. */
    fun delete(file: File): Boolean = file.delete()
}
