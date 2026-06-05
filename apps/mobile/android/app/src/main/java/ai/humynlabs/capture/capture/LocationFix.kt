package ai.humynlabs.capture.capture

import org.json.JSONObject

/**
 * Bug 3 / D3 (2026-06-04) — precise GPS location fix captured at session start.
 *
 * **Overrides the formerly-LOCKED "no precise GPS leaves the device" constraint**
 * (owner sign-off `.planning/260604-locked-override-signoff.md` D3; the
 * consent-text + DPIA review is a SHIP gate, NOT a code gate). Replaces the
 * prior `location: String?` coarse label — the human-readable "City, Country"
 * now lives in [label], with precise [lat] / [lng] + [accuracyM] / [provider]
 * alongside it.
 *
 * Flows JS opts → [CaptureSessionOptsBridge] → [CaptureSession] → sidecar →
 * [MetadataComposer] (emitted nested under `capture_device_info.location` in
 * metadata.json, schema 1.5.0). Null when unavailable (the fix timed out, or
 * only a partial COARSE grant returned no last-known fix) — the block is then
 * JSON `null`.
 *
 * Mirrors the [CameraCalibration] shared-type pattern: a single definition
 * referenced by both the SidecarManager + MetadataComposer payloads (so
 * `FinalizeWorker.adaptSidecar` passes it straight through, no per-field bridge).
 */
data class LocationFix(
    val lat: Double,
    val lng: Double,
    /** Horizontal accuracy radius in metres (`Location.getAccuracy`). */
    val accuracyM: Double,
    /** Fix provider — e.g. "fused" | "gps" | "network" | "fused_last_known". */
    val provider: String,
    /** ISO-8601 wall-clock at fix acquisition. */
    val capturedAt: String,
    /** Optional reverse-geocoded "City, Country" for human readability. */
    val label: String?,
)

/**
 * JSON (de)serialization for the metadata.json `capture_device_info.location`
 * block + its sidecar mirror. Mirrors [CalibrationJson]. The snake_case keys
 * match the backend zod `LocationSchema` (shared/types/src/recording.ts) so the
 * block forwards verbatim into the `/recordings/init` body (UploadCoordinator
 * reads `capture_device_info.location` → `recordings.location jsonb`).
 */
object LocationJson {
    /** Serialize a [LocationFix] to the meta.json-mirroring JSON shape. */
    fun toJson(loc: LocationFix): JSONObject = JSONObject()
        .put("lat", loc.lat)
        .put("lng", loc.lng)
        .put("accuracy_m", loc.accuracyM)
        .put("provider", loc.provider)
        .put("captured_at", loc.capturedAt)
        .put("label", loc.label ?: JSONObject.NULL)

    /** Parse a JSON `location` block back into a [LocationFix] (sidecar read). */
    fun fromJson(obj: JSONObject): LocationFix = LocationFix(
        lat = obj.getDouble("lat"),
        lng = obj.getDouble("lng"),
        accuracyM = obj.getDouble("accuracy_m"),
        provider = obj.getString("provider"),
        capturedAt = obj.getString("captured_at"),
        label = if (obj.isNull("label")) null else obj.getString("label"),
    )
}
