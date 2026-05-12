package ai.humynlabs.capture.upload

import org.json.JSONArray
import org.json.JSONObject

/**
 * Phase 5 / Plan 05-04 — the upload-queue row model + the chunk-size / parts-count
 * arithmetic for the S3 multipart upload pipeline.
 *
 * DEVIATION from `idea-brief.md §7.1` / REQ UP-02 ("2 MB on cellular"): S3's
 * minimum non-final part size is 5 MiB, so a literal 2 MiB S3 part would be
 * rejected by `UploadPart`. Decision (Plan 05-04, per `05-RESEARCH.md` Pitfall 2):
 * cellular S3 part size = 5 MiB (S3-legal, closest to spec intent). The 8 MiB
 * Wi-Fi figure is unchanged. `partsCount = ceil(videoSizeBytes / chunkBytes)` is
 * computed ONCE at enqueue/init time from the video (the bigger file) and the
 * then-current network type, and is pinned for the upload — a mid-upload
 * Wi-Fi↔cellular flip keeps the original layout. The 30s no-progress watchdog
 * (Plan 05-06) is the cellular mitigation, not a re-layout.
 *
 * `UploadQueueStore` (this package) serialises [UploadRow] to/from a native-owned
 * JSON-on-disk store — NOT a `react-native-mmkv` instance (resolves D-STATE-01:
 * the JS side reads the queue via the `HumynUpload` bridge, never via MMKV).
 */

/** 8 MiB — the Wi-Fi S3 multipart part size. */
const val WIFI_CHUNK_BYTES: Long = 8L * 1024 * 1024

/**
 * 5 MiB — the cellular S3 multipart part size. NOT 2 MiB (see the file header):
 * S3's minimum non-final part size is 5 MiB, so 5 MiB is the S3-legal value
 * closest to the spec's "2 MB on cellular" intent.
 */
const val CELLULAR_CHUNK_BYTES: Long = 5L * 1024 * 1024

/** The "no real task" sentinel — practice recordings carry this taskId (D-08). */
const val PRACTICE_TASK_ID: String = "__practice__"

/** Wi-Fi → 8 MiB chunks; cellular → 5 MiB chunks (NOT 2 MiB — see header). */
fun chunkBytesForNetwork(isCellular: Boolean): Long =
    if (isCellular) CELLULAR_CHUNK_BYTES else WIFI_CHUNK_BYTES

/**
 * `ceil(videoSizeBytes / chunkBytes)`, floored to 1. The same `partsCount`
 * covers the video AND the IMU CSV per the Phase-1 backend `/recordings/init`
 * contract — size it for the bigger file (the video); the tiny IMU CSV uses
 * part 1 only and ignores the surplus part-URLs (Pitfall 2).
 */
fun partsCountFor(videoSizeBytes: Long, chunkBytes: Long): Int {
    if (chunkBytes <= 0L) return 1
    return ((videoSizeBytes + chunkBytes - 1) / chunkBytes).toInt().coerceAtLeast(1)
}

/** Row lifecycle state. */
enum class UploadState {
    PENDING,
    UPLOADING,
    FINALIZING,
    AWAITING_VERIFY,
    VERIFIED,
    DEAD_LETTER,
}

/** Per-part transfer status. */
enum class PartStatus {
    PENDING,
    DONE,
    FAILED,
}

/** One S3 multipart part — its number (1-based), status, ETag (once DONE), retry count. */
data class PartState(
    val n: Int,
    var status: PartStatus = PartStatus.PENDING,
    var etag: String? = null,
    var retryCount: Int = 0,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("n", n)
        put("status", status.name)
        if (etag != null) put("etag", etag)
        put("retryCount", retryCount)
    }

    companion object {
        fun fromJson(o: JSONObject): PartState = PartState(
            n = o.getInt("n"),
            status = runCatching { PartStatus.valueOf(o.optString("status", "PENDING")) }
                .getOrDefault(PartStatus.PENDING),
            etag = if (o.has("etag") && !o.isNull("etag")) o.getString("etag") else null,
            retryCount = o.optInt("retryCount", 0),
        )
    }
}

/**
 * One upload-queue row — the durable record of "this recording's bundle
 * (MP4 + IMU CSV + metadata JSON) needs to reach S3 and be hash-verified".
 *
 * `ownerUserId` is the signed-in `sub` at the time the recording was finalized
 * — `UploadQueueStore.bootstrap(currentSub)` only resumes rows whose
 * `ownerUserId == currentSub` (UP-13 cross-account guard on a shared phone).
 */
data class UploadRow(
    val recordingId: String,
    val ownerUserId: String,
    val mp4Path: String,
    val csvPath: String,
    val jsonPath: String,
    val taskId: String,
    val isPractice: Boolean,
    var state: UploadState = UploadState.PENDING,
    var uploadId: String? = null,
    var imuUploadId: String? = null,
    var partsCount: Int? = null,
    var chunkBytes: Long? = null,
    val videoParts: MutableList<PartState> = mutableListOf(),
    val imuParts: MutableList<PartState> = mutableListOf(),
    var metadataPut: PartStatus = PartStatus.PENDING,
    val enqueuedAt: Long = System.currentTimeMillis(),
    var lastProgressAt: Long = System.currentTimeMillis(),
    var deadLetterReason: String? = null,
    /**
     * `true` once a server `hash-mismatch` event (Plan 05-08) flags this row for
     * a re-upload — `UploadCoordinator` then calls `POST /recordings/:id/reupload`
     * (re-using the recordings row) instead of `POST /recordings/init`. Cleared
     * when the re-upload finishes (the row goes `AWAITING_VERIFY` again). At
     * Plan-05-06 nothing sets it; it's the seam Plan 05-08 wires.
     */
    var reupload: Boolean = false,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("recordingId", recordingId)
        put("ownerUserId", ownerUserId)
        put("mp4Path", mp4Path)
        put("csvPath", csvPath)
        put("jsonPath", jsonPath)
        put("taskId", taskId)
        put("isPractice", isPractice)
        put("state", state.name)
        if (uploadId != null) put("uploadId", uploadId)
        if (imuUploadId != null) put("imuUploadId", imuUploadId)
        if (partsCount != null) put("partsCount", partsCount)
        if (chunkBytes != null) put("chunkBytes", chunkBytes)
        put("videoParts", JSONArray().apply { videoParts.forEach { put(it.toJson()) } })
        put("imuParts", JSONArray().apply { imuParts.forEach { put(it.toJson()) } })
        put("metadataPut", metadataPut.name)
        put("enqueuedAt", enqueuedAt)
        put("lastProgressAt", lastProgressAt)
        if (deadLetterReason != null) put("deadLetterReason", deadLetterReason)
        if (reupload) put("reupload", true)
    }

    companion object {
        private fun parts(arr: JSONArray?): MutableList<PartState> {
            val out = mutableListOf<PartState>()
            if (arr == null) return out
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                out.add(PartState.fromJson(o))
            }
            return out
        }

        fun fromJson(o: JSONObject): UploadRow = UploadRow(
            recordingId = o.getString("recordingId"),
            ownerUserId = o.optString("ownerUserId", ""),
            mp4Path = o.optString("mp4Path", ""),
            csvPath = o.optString("csvPath", ""),
            jsonPath = o.optString("jsonPath", ""),
            taskId = o.optString("taskId", ""),
            isPractice = o.optBoolean("isPractice", false),
            state = runCatching { UploadState.valueOf(o.optString("state", "PENDING")) }
                .getOrDefault(UploadState.PENDING),
            uploadId = if (o.has("uploadId") && !o.isNull("uploadId")) o.getString("uploadId") else null,
            imuUploadId = if (o.has("imuUploadId") && !o.isNull("imuUploadId")) o.getString("imuUploadId") else null,
            partsCount = if (o.has("partsCount") && !o.isNull("partsCount")) o.getInt("partsCount") else null,
            chunkBytes = if (o.has("chunkBytes") && !o.isNull("chunkBytes")) o.getLong("chunkBytes") else null,
            videoParts = parts(o.optJSONArray("videoParts")),
            imuParts = parts(o.optJSONArray("imuParts")),
            metadataPut = runCatching { PartStatus.valueOf(o.optString("metadataPut", "PENDING")) }
                .getOrDefault(PartStatus.PENDING),
            enqueuedAt = o.optLong("enqueuedAt", System.currentTimeMillis()),
            lastProgressAt = o.optLong("lastProgressAt", System.currentTimeMillis()),
            deadLetterReason = if (o.has("deadLetterReason") && !o.isNull("deadLetterReason")) {
                o.getString("deadLetterReason")
            } else {
                null
            },
            reupload = o.optBoolean("reupload", false),
        )
    }
}

/** Serialise a list of rows to a JSON array string. */
fun rowsToJsonString(rows: List<UploadRow>): String =
    JSONArray().apply { rows.forEach { put(it.toJson()) } }.toString()

/** Parse a JSON array string back into a mutable list of rows; bad input → empty. */
fun rowsFromJsonString(text: String?): MutableList<UploadRow> {
    val out = mutableListOf<UploadRow>()
    if (text.isNullOrBlank()) return out
    return try {
        val arr = JSONArray(text)
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(UploadRow.fromJson(o))
        }
        out
    } catch (_: Throwable) {
        mutableListOf()
    }
}
