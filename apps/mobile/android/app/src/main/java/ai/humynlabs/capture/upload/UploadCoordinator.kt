package ai.humynlabs.capture.upload

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock

/**
 * Phase 5 / Plan 05-06 — the upload-queue drainer.
 *
 * [drain] reads the durable queue ([UploadQueueStore.read]) and, for each row
 * that still needs work and is owned by the currently signed-in user, runs the
 * Phase-1 multipart flow:
 *
 *   1. `POST /recordings/init` (first drain — idempotent since Plan 05-09: a
 *      re-/init for a still-`pending` row returns the SAME `uploadId`, so a lost
 *      `201` self-heals), or `POST /recordings/:id/parts` (a re-drain, Plan
 *      05-09 — re-presign URLs against the EXISTING video+IMU multipart uploads,
 *      no `CreateMultipartUpload`, preserves already-DONE parts' ETags), or
 *      `POST /recordings/:id/reupload` (the FIRST drain of a hash-mismatch
 *      re-upload — Plan 05-08 sets `reupload` state; `row.reupload` is cleared
 *      right after so a re-drain of *that* takes the `/parts` branch too) — with
 *      `partsCount = partsCountFor(videoSizeBytes, chunkBytesForNetwork(isCellular))`
 *      decided ONCE here and pinned on the row → gets `partUrls` / `imuPartUrls`
 *      / `metadataUrl` / `uploadId` / `imuUploadId`. (UP-01, UP-04)
 *   2. PUT `metadata.json` to `metadataUrl` (one shot).
 *   3. PUT each video part to its presigned URL and the single IMU part to its
 *      presigned URL, behind a 6-permit [Semaphore] used as 3 video ∥ + 3 IMU ∥
 *      (the IMU CSV is tiny → part 1 only; the surplus IMU part-URLs are ignored
 *      — Pitfall 2), each via [ChunkUploader.uploadPart] (the
 *      retry/backoff/watchdog). After each successful part, `{etag,status}` is
 *      persisted into the queue row ([UploadQueueStore.upsert]) and a DEBOUNCED
 *      progress event is emitted (≤ once per 5 s per row). (UP-03)
 *   4. `POST /recordings/:id/finalize` with `{ videoParts, imuParts, imuUploadId }`.
 *   5. Mark the row `AWAITING_VERIFY` — it stays in the queue until a
 *      `verified` / `re-upload` event clears it (Plan 05-08). On a
 *      non-retryable error ([DeadLetterException]) mark `DEAD_LETTER`. (UP-14)
 *
 * Pause / owner safety:
 *  - [isPaused] (the `UploadControlState` flag, flipped by
 *    `HumynUploadModule.pause()` / `resume()`, UP-10) short-circuits [drain]
 *    before each PUT.
 *  - rows whose `ownerUserId != getCurrentSub()` are skipped — a row owned by a
 *    logged-out / different user just waits (UP-13, T-5-06-03).
 *
 * Threading: [drain] hops onto a single-thread executor (it's also called from
 * the FGS thread in Plan 05-07 — the FGS owns the `startForeground`-with-
 * `dataSync` lifecycle; this plan provides the `drain()` logic + sends the
 * `ACTION_SET_UPLOAD_ACTIVE` intent from `HumynUploadModule.enqueue()`). The
 * parallel part PUTs run on a small fixed pool, capped by the semaphore. NEVER
 * on the JS / main thread.
 *
 * The auth context (API base URL, bearer JWT, signed-in `sub`) is pushed from
 * the JS side via `HumynUploadModule.setUploadContext(...)` into
 * [UploadAuthContext] — the JWT lives in encrypted MMKV which is awkward to read
 * from Kotlin, so the bridge injects it instead (and refreshes it on `resume()`).
 * Presigned S3 PUTs carry NO bearer (they're presigned); only `/init`,
 * `/finalize`, `/reupload` get the `Authorization: Bearer` header.
 */
class UploadCoordinator(
    /** The durable queue store this coordinator drains — also reused by `HumynUploadModule` so there's a single lock. */
    val queueStore: UploadQueueStore,
    private val networkMonitor: NetworkMonitor,
    emitProgress: (recordingId: String, bytesUploaded: Long, bytesTotal: Long) -> Unit,
    emitQueueChanged: () -> Unit,
    private val getApiBaseUrl: () -> String?,
    private val getBearerToken: () -> String?,
    private val getCurrentSub: () -> String?,
    private val isPaused: () -> Boolean,
    /** Test seam — short backoff so tests don't sleep 2/4/8 s. */
    private val chunkUploader: ChunkUploader = ChunkUploader(DEFAULT_HTTP_CLIENT),
    /** Wave-2 #5 — sleep between bounded in-loop transient retries. Test seam: pass 1L so the retry test doesn't sleep 5 s. */
    private val transientRetryDelayMs: Long = TRANSIENT_RETRY_DELAY_MS,
) {

    /**
     * Event-emission hooks. Mutable so the shared singleton (built via
     * [getShared] from the FGS / the UIDT JobService — neither of which has a
     * live React bridge) starts with no-op emitters, and `HumynUploadModule`
     * installs the real `RCTDeviceEventEmitter`-backed ones in its `init` via
     * [setEmitters]. Marked `@Volatile` because the FGS thread / a JobService
     * thread / the JS thread can all touch them.
     */
    @Volatile
    private var emitProgress: (recordingId: String, bytesUploaded: Long, bytesTotal: Long) -> Unit = emitProgress

    @Volatile
    private var emitQueueChanged: () -> Unit = emitQueueChanged

    /** Install the real event emitters (called by `HumynUploadModule` once the bridge is up). */
    fun setEmitters(
        emitProgress: (recordingId: String, bytesUploaded: Long, bytesTotal: Long) -> Unit,
        emitQueueChanged: () -> Unit,
    ) {
        this.emitProgress = emitProgress
        this.emitQueueChanged = emitQueueChanged
    }

    /**
     * Plan 06-12 follow-on (Finding 6) — pass-through to the underlying
     * [NetworkMonitor] so the JS bridge can install a connectivity-changed
     * listener without holding a direct reference to the monitor. The
     * listener fires once immediately with the current state, then again on
     * every transition.
     */
    fun addConnectivityListener(listener: (Boolean) -> Unit) {
        networkMonitor.addConnectivityListener(listener)
    }
    fun removeConnectivityListener(listener: (Boolean) -> Unit) {
        networkMonitor.removeConnectivityListener(listener)
    }
    fun hasNetwork(): Boolean = networkMonitor.hasNetwork()

    private val apiClient: OkHttpClient = DEFAULT_HTTP_CLIENT
    private val drainExecutor: ExecutorService = Executors.newSingleThreadExecutor { r ->
        Thread(r, "humyn-upload-drain").apply { isDaemon = true }
    }

    /**
     * Serialises [drainNow]. `drainNow()` is `public` and called DIRECTLY off
     * three threads — `HumynForegroundService.startUploadDrain()` (its
     * `HandlerThread`), `UploadJobService.onStartJob()` (a fresh `Thread`), and
     * `HumynUploadModule.drain()` (the [drainExecutor]). Without mutual exclusion
     * two of them could run `uploadOne(row)` on the same row simultaneously —
     * each re-POSTing `/recordings/init`, each laying out `row.videoParts`, each
     * writing the shared mutable `row` back, `row.uploadId` clobbered by whichever
     * finishes last (the CR-03 defect). `drainNow()` acquires this with
     * `tryLock()` — a second concurrent drain returns immediately (its work is
     * already covered by the in-progress drain, and the FGS / JobService callers
     * re-check `queueHasWork()` afterwards, so a skipped drain is not a skipped
     * upload). `tryLock()` (not `lock()`) means a contender never blocks; the
     * lock is released in a `finally` wrapping the whole body.
     */
    private val drainLock = ReentrantLock()
    private val partExecutor: ExecutorService = Executors.newFixedThreadPool(6) { r ->
        Thread(r, "humyn-upload-part").apply { isDaemon = true }
    }
    private val partSemaphore = Semaphore(6) // 3 video ∥ + 3 IMU ∥ (IMU has 1 part → effectively 3 video + 1 IMU)

    /** The active in-flight calls, so [cancelInflight] can abort them on pause/logout. */
    private val inflight = java.util.Collections.synchronizedSet(mutableSetOf<okhttp3.Call>())

    /** Per-row last-progress-emit timestamp (debounce to ≤ once / 5 s). */
    private val lastEmitMs = java.util.Collections.synchronizedMap(mutableMapOf<String, Long>())

    // -------------------------------------------------------------------------
    // Public surface
    // -------------------------------------------------------------------------

    /** Kick a queue drain on the drain thread. No-op if paused / no network / no signed-in user. */
    fun drain() {
        drainExecutor.execute { drainNow() }
    }

    /**
     * `true` if the durable queue still has at least one row that isn't already
     * `VERIFIED` or `DEAD_LETTER` — i.e. there's transfer work outstanding. Used
     * by `HumynForegroundService` to decide whether to keep the upload FGS alive
     * (Plan 05-07's 5-min idle stop + the Android-15 `onTimeout` → UIDT handoff),
     * and by `UploadJobService` to decide `jobFinished(params, wantsReschedule)`.
     * Tolerant of a corrupt/missing queue file (`queueStore.read()` returns empty).
     */
    fun queueHasWork(): Boolean =
        queueStore.read().any {
            it.state != UploadState.VERIFIED && it.state != UploadState.DEAD_LETTER
        }

    /**
     * Synchronous drain — exposed for the FGS thread (Plan 05-07) which calls it
     * directly on its own background thread, the UIDT `UploadJobService` thread,
     * and for tests. Iterates the queue, uploads each eligible row, dead-letters
     * on a [DeadLetterException], leaves a transient failure as-is (the next drain
     * retries).
     *
     * Serialised by [drainLock] via `tryLock()` — if a drain is already running
     * (on any of the three caller threads), this call returns immediately. That's
     * safe: the in-progress drain already covers all the queued work, and the FGS
     * / `UploadJobService` callers re-check `queueHasWork()` after `drainNow()`
     * returns, so a "lost" (skipped) drain is not a lost upload. The lock is
     * released in a `finally` wrapping the entire body — any exception (including
     * a `DeadLetterException` rethrown out of `uploadOne` and caught here per-row)
     * still releases it.
     */
    fun drainNow() {
        if (!drainLock.tryLock()) {
            Log.d(TAG, "drainNow skipped — a drain is already running")
            return
        }
        try {
            if (isPaused()) { Log.d(TAG, "drainNow paused at before-iteration"); return }
            val sub = getCurrentSub() ?: return
            if (!networkMonitor.hasNetwork()) return
            for (row in queueStore.read()) {
                if (isPaused()) { Log.d(TAG, "drainNow paused at per-row checkpoint, row=${row.recordingId}"); break }
                if (row.ownerUserId != sub) continue
                if (row.state == UploadState.AWAITING_VERIFY ||
                    row.state == UploadState.VERIFIED ||
                    row.state == UploadState.DEAD_LETTER
                ) {
                    continue
                }
                // Wave-2 #5 — bounded in-loop retry on a transient. A single
                // transient (e.g., the /init 500 surfaced by the §4a walk, or a
                // mid-PUT TCP reset on flaky cellular) previously sat the row
                // until the next external trigger fired (cold-start drainNow,
                // JWT change, FGS heartbeat, UIDT JobService, tile-tap, Retry).
                // The bounded retry tries up to 3 attempts spaced 5 s apart per
                // row, then falls through to the next row + relies on the next
                // external trigger if all 3 still fail. uploadOne is re-drain-
                // safe (DONE parts are preserved with their ETags; the next
                // attempt takes the /parts branch and skips them — UP-04 / CR-01).
                var attempts = 0
                val maxAttempts = 3
                while (true) {
                    if (isPaused()) break
                    try {
                        uploadOne(row)
                        break
                    } catch (e: DeadLetterException) {
                        Log.w(TAG, "row ${row.recordingId} DEAD_LETTER: ${e.message}")
                        row.state = UploadState.DEAD_LETTER
                        row.deadLetterReason = e.message ?: "upload failed"
                        queueStore.upsert(row)
                        emitQueueChanged()
                        lastEmitMs.remove(row.recordingId)
                        break
                    } catch (e: Exception) {
                        attempts++
                        // Never log presigned URLs — T-5-06-02. `recordingId` is a ULID, safe.
                        Log.w(TAG, "row ${row.recordingId} upload failed transiently (attempt $attempts/$maxAttempts): ${e.message}")
                        if (attempts >= maxAttempts) break
                        try {
                            Thread.sleep(transientRetryDelayMs)
                        } catch (ie: InterruptedException) {
                            Thread.currentThread().interrupt()
                            break
                        }
                    }
                }
            }
        } finally {
            drainLock.unlock()
        }
    }

    /** Cancel any in-flight HTTP calls (pause / logout). Queue rows are NOT discarded — they resume. */
    fun cancelInflight() {
        synchronized(inflight) {
            inflight.forEach { runCatching { it.cancel() } }
            inflight.clear()
        }
    }

    /** Shut down the executors + the chunk-uploader watchdog scheduler (HumynUploadModule.invalidate()). */
    fun shutdown() {
        runCatching { cancelInflight() }
        runCatching { drainExecutor.shutdownNow() }
        runCatching { partExecutor.shutdownNow() }
        runCatching { chunkUploader.shutdown() }
    }

    // -------------------------------------------------------------------------
    // The Pattern-1 flow
    // -------------------------------------------------------------------------

    private fun uploadOne(row: UploadRow) {
        val baseUrl = getApiBaseUrl()?.trimEnd('/')
            ?: throw IOException("API base URL not configured — cannot /init")
        val mp4 = File(row.mp4Path)
        val csv = File(row.csvPath)
        val jsonFile = File(row.jsonPath)
        if (!mp4.exists() || !csv.exists() || !jsonFile.exists()) {
            throw DeadLetterException("recording ${row.recordingId}: a bundle file is missing on disk", null)
        }

        // 1. /init (or /reupload, or — on a re-drain — /:id/parts) — decide
        //    partsCount ONCE on the first call and pin it (`row.partsCount` /
        //    `row.chunkBytes`); a re-drain re-issues fresh (non-expired) presigned
        //    URLs against the EXISTING video+IMU multipart uploads but KEEPS the
        //    row's per-part {etag,status} (a DONE part is never re-PUT, UP-04).
        val wasReupload = row.reupload // Plan 05-08's "re-upload after hash-mismatch" marker — captured BEFORE the `when` reads it
        if (row.chunkBytes == null) {
            row.chunkBytes = chunkBytesForNetwork(networkMonitor.isCellular())
        }
        if (row.partsCount == null) {
            row.partsCount = partsCountFor(mp4.length(), row.chunkBytes!!)
        }
        val partsCount = row.partsCount!!
        // Lay out the per-part state ONCE (preserve any pre-existing DONE parts on a re-drain).
        if (row.videoParts.isEmpty()) {
            row.videoParts.addAll((1..partsCount).map { PartState(it) })
        } else {
            // Defensive: top up if the layout is short (shouldn't happen — partsCount is pinned).
            for (n in (row.videoParts.size + 1)..partsCount) row.videoParts.add(PartState(n))
        }
        if (row.imuParts.isEmpty()) row.imuParts.add(PartState(1))

        // re-upload (hash-mismatch) first → /recordings/:id/reupload (mints fresh ids; the reupload @ReactMethod
        // already reset every part to PENDING + dropped cached ETags — Plan 05-08; we clear row.reupload right
        // after so a re-drain of this row preserves its DONE parts' ETags via /parts, not another /reupload).
        // Otherwise: a re-drain (row.uploadId != null) → /recordings/:id/parts (re-presign against the EXISTING
        // video+IMU uploadIds — keeps already-DONE parts' ETags valid; UP-04). First drain (row.uploadId == null)
        // → /recordings/init (idempotent since Plan 05-09 — a re-/init returns the SAME uploadId, so a lost 201
        // self-heals).
        val initResp: InitResponse = when {
            row.reupload -> postReupload(baseUrl, row, partsCount)
            row.uploadId != null -> postRePresign(baseUrl, row, partsCount)
            else -> postInit(baseUrl, row, jsonFile, partsCount)
        }
        row.uploadId = initResp.uploadId
        row.imuUploadId = initResp.imuUploadId
        row.state = UploadState.UPLOADING
        queueStore.upsert(row)
        // Wave-2 #7 — JS keys `isActive = (state === 'uploading')` to render the
        // determinate-progress bar + percent chip; without an emit here the JS
        // side stays on the stale `pending` snapshot, the bar never renders.
        emitQueueChanged()

        // Clear the re-upload marker IMMEDIATELY — now that the fresh /reupload ids are persisted, a subsequent
        // re-drain of this same row (process-killed mid-flight) must take the /recordings/:id/parts branch
        // (re-presign against those ids → preserves any re-upload parts that have already landed) instead of
        // calling /reupload again (fresh ids → orphaned ETags → /finalize InvalidPart → spin forever — CR-01 on
        // the re-upload path, WARNING 4). The redundant row.reupload = false in the success tail is harmless.
        if (wasReupload) {
            row.reupload = false
            queueStore.upsert(row)
        }

        if (isPaused()) { Log.d(TAG, "drainNow paused at after-init, row=${row.recordingId}"); return }

        // 2. metadata.json — one shot, but through the same retry/backoff/
        //    dead-letter machinery (a permanently-failing metadata PUT
        //    dead-letters the recording rather than spinning forever).
        if (row.metadataPut != PartStatus.DONE) {
            chunkUploader.putPart(
                initResp.metadataUrl, jsonFile, 0, jsonFile.length(),
            ) { maybeEmitProgress(row, mp4.length() + csv.length() + jsonFile.length()) }
            row.metadataPut = PartStatus.DONE
            queueStore.upsert(row)
        }

        if (isPaused()) { Log.d(TAG, "drainNow paused at after-metadata, row=${row.recordingId}"); return }

        val chunkBytes = row.chunkBytes ?: chunkBytesForNetwork(false)
        val totalBytes = mp4.length() + csv.length() + jsonFile.length()

        // 3. video parts + the 1 IMU part, behind the 6-permit semaphore.
        val futures = mutableListOf<Future<*>>()
        for (p in row.videoParts) {
            if (p.status == PartStatus.DONE) continue
            val partNumber = p.n
            val url = initResp.partUrls.firstOrNull { it.partNumber == partNumber }?.url
                ?: throw IOException("no presigned URL for video part $partNumber")
            futures += partExecutor.submit {
                if (isPaused()) return@submit
                partSemaphore.acquire()
                try {
                    val offset = (partNumber - 1L) * chunkBytes
                    val length = minOf(chunkBytes, mp4.length() - offset)
                    chunkUploader.uploadPart(row.videoParts, partNumber, mp4, offset, length, url) {
                        maybeEmitProgress(row, totalBytes)
                    }
                    queueStore.upsert(row)
                } finally {
                    partSemaphore.release()
                }
            }
        }
        // IMU — always one part (the CSV is tiny → 1 part regardless; ignore surplus imuPartUrls).
        if (row.imuParts.first().status != PartStatus.DONE) {
            val imuUrl = initResp.imuPartUrls.firstOrNull { it.partNumber == 1 }?.url
                ?: throw IOException("no presigned URL for IMU part 1")
            futures += partExecutor.submit {
                if (isPaused()) return@submit
                partSemaphore.acquire()
                try {
                    chunkUploader.uploadPart(row.imuParts, 1, csv, 0, csv.length(), imuUrl) {
                        maybeEmitProgress(row, totalBytes)
                    }
                    queueStore.upsert(row)
                } finally {
                    partSemaphore.release()
                }
            }
        }
        // Wait for all part PUTs; surface a DeadLetterException so the row dead-letters.
        var deadLetter: DeadLetterException? = null
        var transient: Exception? = null
        for (f in futures) {
            try {
                f.get()
            } catch (e: java.util.concurrent.ExecutionException) {
                when (val cause = e.cause) {
                    is DeadLetterException -> deadLetter = cause
                    is Exception -> transient = cause
                    else -> transient = IOException(cause)
                }
            }
        }
        if (deadLetter != null) throw deadLetter
        if (transient != null) throw transient
        if (isPaused()) { Log.d(TAG, "drainNow paused at after-parts, row=${row.recordingId}"); return }

        // Re-check every part landed (defensive — uploadPart already throws on failure).
        if (row.videoParts.any { it.status != PartStatus.DONE || it.etag == null } ||
            row.imuParts.any { it.status != PartStatus.DONE || it.etag == null }
        ) {
            throw IOException("some parts did not complete — will retry next drain")
        }

        // 4. /finalize.
        row.state = UploadState.FINALIZING
        queueStore.upsert(row)
        // Wave-2 #7 — pair with the UPLOADING-state emit above so JS sees the
        // row's transition out of `uploading` (which drops the in-flight bar)
        // BEFORE the AWAITING_VERIFY emit lands. Without it the bar can briefly
        // jump back to "Uploading… %" between FINALIZING and AWAITING_VERIFY
        // on slow networks where finalize takes more than a paint frame.
        emitQueueChanged()
        postFinalize(baseUrl, row)

        // 5. AWAITING_VERIFY — stays in the queue until a verified/re-upload event (Plan 05-08).
        row.state = UploadState.AWAITING_VERIFY
        row.reupload = false // a successful (re-)upload clears the marker
        row.lastProgressAt = System.currentTimeMillis()
        queueStore.upsert(row)
        emitQueueChanged()
        lastEmitMs.remove(row.recordingId)
    }

    private fun maybeEmitProgress(row: UploadRow, totalBytes: Long) {
        val now = System.currentTimeMillis()
        val last = lastEmitMs[row.recordingId] ?: 0L
        if (now - last < PROGRESS_DEBOUNCE_MS) return
        lastEmitMs[row.recordingId] = now
        row.lastProgressAt = now
        val done = doneBytes(row)
        runCatching { emitProgress(row.recordingId, done, totalBytes) }
    }

    private fun doneBytes(row: UploadRow): Long {
        val chunk = row.chunkBytes ?: chunkBytesForNetwork(false)
        val mp4Len = File(row.mp4Path).length()
        var sum = 0L
        for (p in row.videoParts) {
            if (p.status == PartStatus.DONE) {
                val offset = (p.n - 1L) * chunk
                sum += minOf(chunk, (mp4Len - offset).coerceAtLeast(0L))
            }
        }
        if (row.imuParts.firstOrNull()?.status == PartStatus.DONE) sum += File(row.csvPath).length()
        if (row.metadataPut == PartStatus.DONE) sum += File(row.jsonPath).length()
        return sum
    }

    // -------------------------------------------------------------------------
    // HTTP — /init, /reupload, /finalize, presigned PUTs
    // -------------------------------------------------------------------------

    private data class PartUrl(val partNumber: Int, val url: String)
    private data class InitResponse(
        val uploadId: String,
        val imuUploadId: String,
        val partUrls: List<PartUrl>,
        val imuPartUrls: List<PartUrl>,
        val metadataUrl: String,
    )

    /**
     * Build an authed JSON POST request. The Idempotency-Key header (a stable
     * PER-ROUTE UUIDv4 from the UploadRow, persisted in queue.json) is REQUIRED
     * — the API's global idempotency pre-handler (apps/api/src/plugins/
     * idempotency.ts) rejects every POST/PATCH without one with a 400. Per-route
     * key — `row.initIdempotencyKey` for `/init`, `row.partsIdempotencyKey` for
     * `/parts`, `row.finalizeIdempotencyKey` for `/finalize`,
     * `row.reuploadIdempotencyKey` for `/reupload`. Per-route split closes
     * Wave-1.5 Item 1 (the server caches by `(user_id, key)` + hashes
     * `(method,path,body)` for equality — a single per-row key reused across
     * routes hits a 409 on the second route, the bug observed 2026-05-13 on
     * recording `01KRFZ91Y3E315AJVG75KXJZE6`). The SAME key is sent on every
     * retry of ITS OWN route → same key + same (method,path,body) ⇒ cached 2xx
     * response replayed, which is what makes the hook idempotent.
     */
    private fun authedJsonRequest(url: String, bodyJson: JSONObject, idempotencyKey: String): Request {
        val token = getBearerToken()
        return Request.Builder()
            .url(url)
            .post(bodyJson.toString().toRequestBody("application/json".toMediaTypeOrNull()))
            .header("Idempotency-Key", idempotencyKey)
            .apply { if (!token.isNullOrBlank()) header("Authorization", "Bearer $token") }
            .build()
    }

    private fun executeTracked(req: Request): okhttp3.Response {
        val call = apiClient.newCall(req)
        inflight.add(call)
        return try {
            call.execute()
        } finally {
            inflight.remove(call)
        }
    }

    private fun postInit(baseUrl: String, row: UploadRow, jsonFile: File, partsCount: Int): InitResponse {
        // The /recordings/init body (per shared/types RecordingsInitRequestSchema):
        // recordingId, taskId (26-char ULID), practice, partsCount, durationMs,
        // fileSha256, imuSha256, fileSizeBytes, imuSizeBytes, capturedAt (ISO).
        // We read the SHAs/sizes/timestamp out of the metadata JSON produced by
        // MetadataComposer at capture time (top-level `recording_id`, nested
        // `metadata.{file_sha256, imu_sha256, file_size_bytes, imu_size_bytes,
        // duration_seconds, start_timestamp}`); recordingId/taskId come from the row.
        val meta = JSONObject(jsonFile.readText())
        val m = meta.optJSONObject("metadata") ?: JSONObject()
        val body = JSONObject().apply {
            put("recordingId", row.recordingId)
            put("taskId", row.taskId)
            put("practice", row.isPractice)
            put("partsCount", partsCount)
            put("durationMs", Math.round((m.optDouble("duration_seconds", 0.0)) * 1000.0))
            put("fileSha256", m.optString("file_sha256", ""))
            put("imuSha256", m.optString("imu_sha256", ""))
            put("fileSizeBytes", m.optLong("file_size_bytes", File(row.mp4Path).length()))
            put("imuSizeBytes", m.optLong("imu_size_bytes", File(row.csvPath).length()))
            put("capturedAt", m.optString("start_timestamp", ""))
        }
        executeTracked(authedJsonRequest("$baseUrl/recordings/init", body, row.initIdempotencyKey)).use { resp ->
            // Post-CR-02 (Plan 05-09) `/recordings/init` is idempotent: a re-/init for an existing `pending` row
            // owned by the caller returns 200 with the SAME uploadId (a lost-201 self-heals). A 409 only happens
            // when the row moved to a non-`pending` state (e.g. an ops takedown) — genuinely terminal; a 403 is a
            // wrong-owner mismatch (shouldn't ever happen from this client). Both are non-retryable → dead-letter
            // instead of looping (CR-02). A 5xx / network error is still transient (the next drain retries).
            if (resp.code == 409 || resp.code == 403) {
                throw DeadLetterException(
                    "/recordings/init -> ${resp.code} (recording not resumable — moved to a non-pending state, or owner mismatch)",
                    null,
                )
            }
            if (!resp.isSuccessful) throw IOException("/recordings/init -> ${resp.code}")
            return parseInitResponse(resp.body?.string().orEmpty(), "/recordings/init")
        }
    }

    private fun postReupload(baseUrl: String, row: UploadRow, partsCount: Int): InitResponse {
        // POST /recordings/:id/reupload — body is just { partsCount } (Plan 05-05).
        val body = JSONObject().put("partsCount", partsCount)
        executeTracked(authedJsonRequest("$baseUrl/recordings/${row.recordingId}/reupload", body, row.reuploadIdempotencyKey)).use { resp ->
            // 409 self-heal: the server gates /reupload on qa_status='hash-mismatch'.
            // A 409 here means the row is in some OTHER state — almost always still
            // 'pending' — because a stray Retry tap on a non-DEAD_LETTER row, or a
            // re-delivered `re-upload` server event, flipped row.reupload=true even
            // though the server never reached hash-mismatch. Without this self-heal
            // the row is permanently trapped: drain → /reupload → 409 → 3-retry
            // transient backoff → next row → comes back → 409 again, forever (mixed
            // with 429s from the per-user 30/min rate limiter on /reupload).
            //
            // Clear the flag here so the NEXT drain takes the /init branch — /init
            // is idempotent for an existing pending row (the SELECT-first guard at
            // init.ts:270-286 returns the SAME s3UploadId via replyExistingRowIdempotent),
            // every part is re-PUT, /finalize is called, the row drains cleanly.
            // The local mp4/csv/json are still on disk so a re-PUT is always possible.
            //
            // We still throw IOException so the CURRENT drain attempt is treated as
            // a transient failure and the per-row backoff fires before the /init
            // retry — keeps the server from getting hammered.
            //
            // Trail: .planning/debug/resolved/uploads-stuck-multi-segment.md
            // (2026-05-16 demo) — the 17-row /reupload→409 storm closed by this fix.
            if (resp.code == 409) {
                row.reupload = false
                queueStore.upsert(row)
                throw IOException("/recordings/${row.recordingId}/reupload -> 409 (cleared row.reupload — next drain takes the /init self-heal path)")
            }
            if (!resp.isSuccessful) throw IOException("/recordings/${row.recordingId}/reupload -> ${resp.code}")
            return parseInitResponse(resp.body?.string().orEmpty(), "/recordings/:id/reupload")
        }
    }

    /**
     * Re-drain path (Plan 05-09's `POST /recordings/:id/parts`): re-presign the video + IMU part URLs against
     * the EXISTING multipart uploads — NO `CreateMultipartUpload`, NO DB write, NO state change — so every
     * already-DONE part keeps its valid ETag (UP-04, the slow-cellular resume guarantee). The response shape is
     * identical to `/init`'s (`RecordingsInitResponseSchema`); it echoes back the row's own `uploadId` /
     * `imuUploadId` unchanged. A `404` (row gone) / `409` (row no longer `pending` — `/finalize` already
     * consumed the upload, or an ops takedown) is terminal: the upload can't be resumed against that upload-id
     * and the server won't re-presign → `DeadLetterException` (the row dead-letters → chip-failed → the user can
     * Retry, which routes through `reupload` if the server is in `hash-mismatch`). A `5xx` / network error is
     * transient (the next drain retries).
     */
    private fun postRePresign(baseUrl: String, row: UploadRow, partsCount: Int): InitResponse {
        val imuId = row.imuUploadId
            ?: throw DeadLetterException("re-presign needs imuUploadId; row ${row.recordingId} has none", null)
        val body = JSONObject().put("partsCount", partsCount).put("imuUploadId", imuId)
        executeTracked(authedJsonRequest("$baseUrl/recordings/${row.recordingId}/parts", body, row.partsIdempotencyKey)).use { resp ->
            if (resp.code == 404 || resp.code == 409) {
                throw DeadLetterException("/recordings/${row.recordingId}/parts -> ${resp.code} (upload not resumable)", null)
            }
            if (!resp.isSuccessful) throw IOException("/recordings/${row.recordingId}/parts -> ${resp.code}")
            return parseInitResponse(resp.body?.string().orEmpty(), "/recordings/:id/parts")
        }
    }

    /**
     * Parse a `/recordings/init` | `/recordings/:id/reupload` | `/recordings/:id/parts` JSON body into an
     * [InitResponse]. On a near-miss non-JSON body (e.g. a proxy error page that happens to embed presigned URLs
     * with `X-Amz-Signature` query params), `org.json.JSONException` carries a snippet of the body in its message
     * — re-throw a body-free `IOException` carrying only the static [label] so the transient-error log in
     * `drainNow` (which logs `e.message`) never leaks a presigned URL (T-5-06-02 / WR-06).
     */
    private fun parseInitResponse(text: String, label: String): InitResponse {
        return try {
            val o = JSONObject(text)
            fun parts(key: String): List<PartUrl> {
                val arr = o.optJSONArray(key) ?: JSONArray()
                val out = mutableListOf<PartUrl>()
                for (i in 0 until arr.length()) {
                    val po = arr.optJSONObject(i) ?: continue
                    out.add(PartUrl(po.getInt("partNumber"), po.getString("url")))
                }
                return out
            }
            InitResponse(
                uploadId = o.getString("uploadId"),
                imuUploadId = o.getString("imuUploadId"),
                partUrls = parts("partUrls"),
                imuPartUrls = parts("imuPartUrls"),
                metadataUrl = o.getString("metadataUrl"),
            )
        } catch (e: org.json.JSONException) {
            throw IOException("$label response not valid JSON")
        }
    }

    private fun postFinalize(baseUrl: String, row: UploadRow) {
        // POST /recordings/:id/finalize — { videoParts:[{partNumber,etag}],
        // imuParts:[...], imuUploadId } (shared/types RecordingFinalizeSchema +
        // the finalize route's FinalizeBodyExtended).
        fun partsArray(parts: List<PartState>): JSONArray = JSONArray().apply {
            parts.forEach {
                put(JSONObject().put("partNumber", it.n).put("etag", it.etag ?: ""))
            }
        }
        val body = JSONObject().apply {
            put("videoParts", partsArray(row.videoParts))
            put("imuParts", partsArray(row.imuParts))
            put("imuUploadId", row.imuUploadId ?: "")
        }
        executeTracked(authedJsonRequest("$baseUrl/recordings/${row.recordingId}/finalize", body, row.finalizeIdempotencyKey)).use { resp ->
            if (!resp.isSuccessful) throw IOException("/recordings/${row.recordingId}/finalize -> ${resp.code}")
        }
    }

    companion object {
        private const val TAG = "HumynUploadCoord"
        // Wave-2 #7 — debounce dropped 5000 → 500 ms so a fast (~2-s) LocalStack
        // upload emits ~4 ticks (visible bar movement) instead of one. Still
        // 20× under the per-part RTT on CGNAT cellular (Item 4 walk), so the
        // native bus pressure stays at <2 events/s/recording.
        private const val PROGRESS_DEBOUNCE_MS = 500L
        // Wave-2 #5 — sleep between bounded in-loop transient retries
        // (3 attempts × 5 s — see the loop just inside `drainNow`'s per-row
        // body). Visible package-private so tests can pin the contract.
        internal const val TRANSIENT_RETRY_DELAY_MS = 5_000L

        /**
         * The process-wide shared coordinator. `HumynUploadModule`, the FGS
         * (`HumynForegroundService` — Plan 05-07's upload-drain-on-the-FGS-thread)
         * and the UIDT `UploadJobService` all call [drainNow] on this ONE
         * instance; `drainNow()` is serialised by a `ReentrantLock` (`tryLock()` —
         * a second concurrent drain returns immediately), so only one drain runs
         * at a time regardless of which thread (FGS `HandlerThread` / UIDT
         * `UploadJobService` `Thread` / the `drainExecutor`) enters first. Built
         * lazily from the application context; wired to the process-lived
         * [UploadAuthContext] / [UploadControlState].
         * Emitters default to no-op until `HumynUploadModule` installs the real
         * ones via [setEmitters] (the FGS / JobService threads have no JS bridge).
         */
        @Volatile
        private var shared: UploadCoordinator? = null

        @JvmStatic
        fun getShared(context: Context): UploadCoordinator {
            shared?.let { return it }
            return synchronized(this) {
                shared ?: run {
                    val appCtx = context.applicationContext
                    val store = UploadQueueStore(appCtx)
                    // The FGS / JobService get a NetworkMonitor whose resume callback
                    // just kicks this same coordinator's drain (when the module is
                    // alive its own monitor also wakes the drain — harmless double-poke).
                    val monitor = NetworkMonitor(appCtx) { shared?.drain() }
                    runCatching { monitor.register() }
                    UploadCoordinator(
                        queueStore = store,
                        networkMonitor = monitor,
                        emitProgress = { _, _, _ -> },
                        emitQueueChanged = { },
                        getApiBaseUrl = UploadAuthContext::apiBaseUrl,
                        getBearerToken = UploadAuthContext::bearerToken,
                        getCurrentSub = UploadAuthContext::sub,
                        isPaused = UploadControlState::isPaused,
                    ).also { shared = it }
                }
            }
        }

        /**
         * The shared OkHttp client for the upload pipeline: the best-effort
         * [MssSocketFactory] (UP-19 half b), a 30 s connect timeout, and
         * `readTimeout(0)` / `callTimeout(0)` — stall-handling is the
         * `ChunkUploader` 30 s no-progress watchdog's job (a fixed `readTimeout`
         * would kill a slow-but-progressing transfer on a bad cellular link).
         */
        val DEFAULT_HTTP_CLIENT: OkHttpClient = OkHttpClient.Builder()
            .socketFactory(MssSocketFactory())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .writeTimeout(0, TimeUnit.SECONDS)
            .callTimeout(0, TimeUnit.SECONDS)
            .build()
    }
}

/**
 * Process-lived auth context for the upload pipeline. `HumynUploadModule`
 * pushes the API base URL + bearer JWT + signed-in `sub` here (the JWT lives in
 * encrypted MMKV which is awkward to read from Kotlin — the bridge injects it,
 * refreshed on `resume()`). `UploadCoordinator` reads it. Lives at module scope
 * (not on the bridge instance) so it survives a catalyst reload.
 */
internal object UploadAuthContext {
    private val ref = AtomicReference<Triple<String?, String?, String?>>(Triple(null, null, null))
    fun set(apiBaseUrl: String?, bearerToken: String?, sub: String?) {
        ref.set(Triple(apiBaseUrl, bearerToken, sub))
    }
    fun apiBaseUrl(): String? = ref.get().first
    fun bearerToken(): String? = ref.get().second
    fun sub(): String? = ref.get().third
}
