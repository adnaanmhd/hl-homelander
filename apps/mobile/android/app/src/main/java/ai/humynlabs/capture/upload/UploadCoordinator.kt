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

/**
 * Phase 5 / Plan 05-06 — the upload-queue drainer.
 *
 * **2026-05-18 — Fix C lands here (debug session
 * `.planning/debug/upload-queue-hol-finalizing.md`).** The previous shape was a
 * strictly-serial `for (row in queueStore.read())` under a single
 * `ReentrantLock` (`drainLock`) — a hung `/finalize` on row N held the lock
 * forever and every row N+1 stayed `PENDING` with `parts 0/0`. Pixel 8a walk
 * 2026-05-18 captured 27 such rows behind one stuck `FINALIZING` head. Replaced
 * with:
 *
 *   1. **Bounded concurrent workers.** Up to [UPLOAD_PARALLELISM_CAP] (default 2)
 *      worker threads drain in parallel. Each worker pulls one row, reserves it
 *      via a per-row in-progress set, runs `uploadOne()`, releases. A hung row
 *      blocks only its own worker; the other worker keeps draining the queue.
 *   2. **`/finalize` watchdog.** The per-call `callTimeout` (60s) on `/finalize`
 *      is sized to be long enough for a healthy server's slowest path
 *      (BullMQ enqueue + finalize-worker handler) but short enough that a hung
 *      server doesn't pin the row forever. The watchdog is per-call, not
 *      client-wide — part PUTs still rely on `ChunkUploader`'s 30s no-progress
 *      watchdog (a fixed `readTimeout` on a slow-but-progressing cellular
 *      transfer would kill it).
 *   3. **FINALIZING reconciliation.** Before re-POSTing `/finalize` on a row
 *      already in `FINALIZING`, the worker first `GET /recordings/:id` — if
 *      the server says `qa_status` is uploaded/verified, the row's local bundle
 *      is deleted + the queue row dropped and the worker moves on (no
 *      re-finalize). This is what would have recovered
 *      `01KRVPP7RKSYXD3DK2H5KKXYXA` on the walk without a process-kill.
 *   4. **NEEDS_ATTENTION terminal-but-recoverable state.** After
 *      [NEEDS_ATTENTION_THRESHOLD] (default 6) automatic recovery attempts on a
 *      single row, the worker transitions it to [UploadState.NEEDS_ATTENTION]
 *      and surrenders. The History UI surfaces a manual Retry affordance that
 *      flips the row back to UPLOADING/PENDING and resets the counter. Distinct
 *      from `DEAD_LETTER` (which is for permanent server-rejection errors
 *      like 409/403); NEEDS_ATTENTION is "give up auto-retrying, ask the user".
 *
 * The rest of the multipart flow (the Pattern-1 [uploadOne] body) is unchanged.
 *
 * [drain] reads the durable queue ([UploadQueueStore.read]) and, for each row
 * that still needs work and is owned by the currently signed-in user, runs the
 * Phase-1 multipart flow:
 *
 *   1. `POST /recordings/init` (first drain — idempotent since Plan 05-09: a
 *      re-/init for a still-`pending` row returns the SAME `uploadId`, so a lost
 *      `201` self-heals), or `POST /recordings/:id/parts` (a re-drain, Plan
 *      05-09 — re-presign URLs against the EXISTING video+IMU multipart uploads,
 *      no `CreateMultipartUpload`, preserves already-DONE parts' ETags) — with
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
 *   5. Terminal success — delete the local bundle + drop the queue row (Enh 3 /
 *      D1, 2026-06-04: `uploaded` is terminal, no on-device verify wait). On a
 *      non-retryable error ([DeadLetterException]) mark `DEAD_LETTER`. (UP-14)
 *
 * Pause / owner safety:
 *  - [isPaused] (the `UploadControlState` flag, flipped by
 *    `HumynUploadModule.pause()` / `resume()`, UP-10) short-circuits [drain]
 *    before each PUT.
 *  - rows whose `ownerUserId != getCurrentSub()` are skipped — a row owned by a
 *    logged-out / different user just waits (UP-13, T-5-06-03).
 *
 * Threading: [drain] hops onto a single-thread dispatch executor; the dispatch
 * thread reserves rows and submits them to the worker pool. The worker pool
 * runs [UPLOAD_PARALLELISM_CAP] rows in parallel. The parallel part PUTs
 * INSIDE each `uploadOne()` are bounded by [partSemaphore] (a process-wide cap
 * across all workers, so two concurrent rows × per-part parallelism doesn't
 * explode total in-flight HTTPS).
 *
 * The auth context (API base URL, bearer JWT, signed-in `sub`) is pushed from
 * the JS side via `HumynUploadModule.setUploadContext(...)` into
 * [UploadAuthContext] — the JWT lives in encrypted MMKV which is awkward to read
 * from Kotlin, so the bridge injects it instead (and refreshes it on `resume()`).
 * Presigned S3 PUTs carry NO bearer (they're presigned); only `/init`,
 * `/finalize`, `GET /recordings/:id` get the
 * `Authorization: Bearer` header.
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
    /**
     * Phase 1 (2026-06-10) — pause the whole queue when a 401 lands (the JWT is
     * dead for EVERY row; hammering the API with N more 401s helps nobody).
     * Default flips the process-lived [UploadControlState] AUTH-pause flag —
     * distinct from the JS-lifecycle pause that `HumynUploadModule.pause()` /
     * `resume()` flip (review fix 2026-06-10: with a single shared flag, a
     * recording stop's `resume()` punched through the auth park and re-drained
     * against a known-dead token; conversely a silent re-auth's resume could
     * unpause uploads mid-recording, violating UP-10). The auth pause clears
     * only when JS pushes a fresh token (`setUploadContext`) or calls
     * `resumeAuth()`. Test seam.
     */
    private val requestPause: () -> Unit = { UploadControlState.setAuthPaused(true) },
    /** Test seam — short backoff so tests don't sleep 2/4/8 s. */
    private val chunkUploader: ChunkUploader = ChunkUploader(DEFAULT_HTTP_CLIENT),
    /** Wave-2 #5 — sleep between bounded in-loop transient retries. Test seam: pass 1L so the retry test doesn't sleep 5 s. */
    private val transientRetryDelayMs: Long = TRANSIENT_RETRY_DELAY_MS,
    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 1) — number of
     * concurrent worker threads. Default [UPLOAD_PARALLELISM_CAP] (=2). Tests
     * pass 1 to force serial drain (a lot of existing tests assume serial),
     * or 4 to exercise the worker pool.
     */
    private val parallelismCap: Int = UPLOAD_PARALLELISM_CAP,
    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 2) — per-call
     * timeout for `/finalize` POSTs and `GET /recordings/:id` reads. Default
     * [FINALIZE_CALL_TIMEOUT_MS] (=60_000). Tests override to 100ms so a
     * deadlocked-server simulation doesn't take 60s.
     */
    private val finalizeCallTimeoutMs: Long = FINALIZE_CALL_TIMEOUT_MS,
    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — how many
     * automatic recovery attempts before transitioning to NEEDS_ATTENTION.
     * Default [NEEDS_ATTENTION_THRESHOLD] (=6). Tests pass 2 so a
     * NEEDS_ATTENTION transition lands in two iterations instead of six.
     */
    private val needsAttentionThreshold: Int = NEEDS_ATTENTION_THRESHOLD,
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

    /**
     * Phase 1 (2026-06-10) — `onUploadAuthFailure { slug }` emitter. Starts
     * no-op (the FGS / JobService singleton has no JS bridge);
     * `HumynUploadModule` installs the real one via [setEmitters]. Fired once
     * per auth-classified 401 so the JS side can either force the eviction UX
     * (`device-evicted` / `reauth-required`) or silently re-auth + resume.
     */
    @Volatile
    private var emitAuthFailure: (slug: String) -> Unit = { }

    /** Install the real event emitters (called by `HumynUploadModule` once the bridge is up). */
    fun setEmitters(
        emitProgress: (recordingId: String, bytesUploaded: Long, bytesTotal: Long) -> Unit,
        emitQueueChanged: () -> Unit,
        emitAuthFailure: (slug: String) -> Unit = { },
    ) {
        this.emitProgress = emitProgress
        this.emitQueueChanged = emitQueueChanged
        this.emitAuthFailure = emitAuthFailure
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

    /**
     * Dispatch executor — single thread, picks the next eligible row + submits
     * it to a worker. Submitting is fast (just a Set insert); the heavy
     * `uploadOne` work happens on a [workerExecutor] thread.
     */
    private val drainExecutor: ExecutorService = Executors.newSingleThreadExecutor { r ->
        Thread(r, "humyn-upload-dispatch").apply { isDaemon = true }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 1) — worker pool.
     * Up to [parallelismCap] [uploadOne] invocations may run concurrently;
     * each worker pulls one row at a time. Independent of [partExecutor] (which
     * runs the per-part PUTs INSIDE each `uploadOne`).
     */
    private val workerExecutor: ExecutorService = Executors.newFixedThreadPool(
        parallelismCap.coerceAtLeast(1),
    ) { r ->
        Thread(r, "humyn-upload-worker").apply { isDaemon = true }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 1) — the set of
     * `recordingId`s currently being uploaded by a worker. Replaces the
     * previous cross-row [java.util.concurrent.locks.ReentrantLock]
     * (`drainLock`). Per-row reservation: a worker that wants to pick row X
     * tries to `add(X)` to this set; if `add` returns false, another worker
     * already owns it. The set is `Collections.synchronizedSet` so add/remove
     * are atomic. Cleared per-row in a `finally` wrapping `uploadOne`.
     *
     * Why not a per-row lock object? A set is simpler (one allocation, atomic
     * Set#add returns the win/lose signal) and avoids the GC churn of
     * thread-local lock maps. Per-row independence is what matters; mutual
     * exclusion is implied by membership in the set.
     */
    private val inProgressIds: MutableSet<String> = java.util.Collections.synchronizedSet(mutableSetOf())

    /**
     * Re-entry guard for [drainNow]. The FGS / UIDT JobService / module-
     * drain trio can all kick a drain simultaneously; without mutual
     * exclusion they would each build their own dispatched-futures list +
     * each `f.get()` block the calling thread. `tryLock()` (not `lock()`)
     * means a contender just returns — the in-progress dispatch already
     * covers all eligible rows, and FGS/JobService callers re-check
     * `queueHasWork()` afterwards. Mirrors the pre-Fix-C `drainLock` shape.
     */
    private val dispatchLock = java.util.concurrent.locks.ReentrantLock()
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
     * `DEAD_LETTER` or `NEEDS_ATTENTION` — i.e. there's automated
     * transfer work outstanding. Used by `HumynForegroundService` to decide
     * whether to keep the upload FGS alive (Plan 05-07's 5-min idle stop + the
     * Android-15 `onTimeout` → UIDT handoff), and by `UploadJobService` to
     * decide `jobFinished(params, wantsReschedule)`. Tolerant of a corrupt/
     * missing queue file (`queueStore.read()` returns empty).
     *
     * Debug session `upload-queue-hol-finalizing` (Fix C item 4) —
     * `NEEDS_ATTENTION` rows are NOT "work outstanding" from the FGS's POV:
     * they're parked waiting on a user retry tap. Surfacing them here would
     * keep the FGS alive forever on a phone with one bad row.
     */
    fun queueHasWork(): Boolean =
        queueStore.read().any {
            it.state != UploadState.DEAD_LETTER &&
                it.state != UploadState.NEEDS_ATTENTION &&
                // Review fix (2026-06-10) — auth-parked rows are not actionable
                // work: they wait on a fresh token, not on the FGS/UIDT.
                // Counting them kept the dataSync notification alive (and the
                // UIDT job rescheduling) forever on an evicted device that
                // never re-signs-in. The durable row marker (unlike the
                // in-memory paused flag) survives process death; recovery
                // never flows through queueHasWork() — resume()/resumeAuth()/
                // drain() kick PENDING rows directly and a successful drain
                // clears the marker.
                it.lastFailureReason?.startsWith(AUTH_FAILURE_REASON_PREFIX) != true
        }

    /**
     * Synchronous drain — exposed for the FGS thread (Plan 05-07) which calls it
     * directly on its own background thread, the UIDT `UploadJobService` thread,
     * and for tests.
     *
     * **2026-05-18 — Fix C concurrency refactor.** Replaced the single
     * `ReentrantLock` + serial-`for` loop with a worker-pool dispatch: pick the
     * next eligible row, atomic-reserve it via [inProgressIds], hand it to
     * [workerExecutor]. Up to [parallelismCap] workers run concurrently — a
     * hung row blocks only its own worker, not other rows.
     *
     * The drain is synchronous from the caller's POV — it waits until every
     * dispatched worker has finished — but the workers run in parallel under
     * the hood. This preserves the contract used by the FGS / UIDT JobService
     * / tests (call `drainNow()`, then expect the queue to have advanced).
     * Concurrency is purely about how rows process internally.
     *
     * Re-entry guard: if another caller is already inside drainNow(), the new
     * caller returns immediately. The in-progress caller is already responsible
     * for the queue's eligible work; a redundant dispatch tick adds nothing.
     */
    fun drainNow() {
        // Re-entry guard. The previous `tryLock` shape did the same thing; we
        // keep it for the FGS + JobService + module-drain trio that can all
        // call drainNow() simultaneously.
        if (!dispatchLock.tryLock()) {
            Log.d(TAG, "drainNow skipped — a dispatch tick is already running")
            return
        }
        try {
            if (isPaused()) { Log.d(TAG, "drainNow paused at top of dispatcher"); return }
            val sub = getCurrentSub() ?: return
            if (!networkMonitor.hasNetwork()) return

            // Build the eligible-row snapshot ONCE per dispatch tick. uploadOne
            // upserts each row back to disk, so a subsequent drainNow() picks
            // up any newly-eligible rows. The snapshot is filtered for ownership
            // + not-already-in-progress + non-terminal state.
            val dispatched = mutableListOf<Future<*>>()
            for (row in queueStore.read()) {
                if (isPaused()) { Log.d(TAG, "drainNow paused mid-dispatch"); break }
                if (row.ownerUserId != sub) continue
                if (!isEligibleForAutomaticDrain(row)) continue
                // Per-row backoff: if this row's lastFailureAt + backoff
                // schedule entry is still in the future, skip — a later drain
                // tick (or the next FGS heartbeat / JobService run /
                // connectivity change) will pick it up when the backoff has
                // elapsed.
                if (!isBackoffElapsed(row)) {
                    Log.d(TAG, "row ${row.recordingId} backoff not elapsed (attempt=${row.attemptCount})")
                    continue
                }
                // Per-row reservation. If another worker has this row in
                // flight (shouldn't happen with the dispatchLock guard, but
                // defensive), skip — they'll handle it.
                if (!inProgressIds.add(row.recordingId)) continue
                // Submit to the worker pool. Workers run uploadOne on this row,
                // then release the reservation.
                dispatched += workerExecutor.submit {
                    try {
                        runWorker(row)
                    } catch (t: Throwable) {
                        // Last-resort net — should never escape runWorker;
                        // log so we'd notice in Crashlytics.
                        Log.e(TAG, "worker for ${row.recordingId} crashed (unexpected)", t)
                    } finally {
                        inProgressIds.remove(row.recordingId)
                    }
                }
            }

            // Wait for every dispatched worker to finish. Synchronous-drain
            // contract: when this returns, all workers we kicked are done.
            // Exceptions inside a worker were already caught by runWorker
            // (transient → retry loop; DeadLetterException → DEAD_LETTER) so
            // f.get() shouldn't throw here.
            for (f in dispatched) {
                try {
                    f.get()
                } catch (_: java.util.concurrent.ExecutionException) {
                    // Already logged in the runnable; nothing to do here.
                } catch (ie: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
        } finally {
            dispatchLock.unlock()
        }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 1) — a single
     * worker iteration: run the bounded transient-retry loop on a SINGLE row.
     * The outer dispatcher ([drainNow]) decides what rows are eligible; this
     * function only sees one row and either drains it or gives up. The
     * `attemptCount`/`lastFailureAt`/NEEDS_ATTENTION transition lives in the
     * catch blocks below.
     */
    private fun runWorker(row: UploadRow) {
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
                // Success — clear failure markers + bail.
                if (row.attemptCount != 0 || row.lastFailureState != null) {
                    row.attemptCount = 0
                    row.lastFailureAt = 0L
                    row.lastFailureState = null
                    row.lastFailureReason = null
                    runCatching { queueStore.upsert(row) }
                }
                break
            } catch (e: AuthFailureException) {
                // Phase 1 (2026-06-10) — a 401 is NEVER the row's fault and NEVER
                // dead-letters. The JWT is dead/evicted for the whole queue: park
                // THIS row back to PENDING with an auth marker, pause the queue
                // (resume() re-opens it once JS pushes a fresh token), and tell
                // the JS side why via onUploadAuthFailure so it can run the
                // eviction UX or a silent re-auth. Before this, an eviction
                // permanently killed every queued upload with no explanation
                // (contradicting UPLOAD-PIPELINE.md §19's refresh contract).
                Log.w(TAG, "row ${row.recordingId} auth failure (${e.slug}) — pausing queue, not dead-lettering")
                row.lastFailureAt = System.currentTimeMillis()
                row.lastFailureState = row.state.name
                row.lastFailureReason = AUTH_FAILURE_REASON_PREFIX + e.slug
                // Review fix (2026-06-10) — zero the backoff counter: a 401 is a
                // QUEUE condition (dead token), never row flakiness. Without
                // this, a row carrying prior transient-failure attempts stayed
                // backoff-skipped for up to 15 min AFTER a successful silent
                // re-auth + resume, looking frozen with a valid token.
                row.attemptCount = 0
                row.state = UploadState.PENDING
                queueStore.upsert(row)
                requestPause()
                emitQueueChanged()
                runCatching { emitAuthFailure(e.slug) }
                break
            } catch (e: DeadLetterException) {
                Log.w(TAG, "row ${row.recordingId} DEAD_LETTER: ${e.message}")
                // Stamp the failure markers BEFORE flipping state so the History
                // row visibly changes even when a user-driven Retry re-fails
                // instantly with the same reason (lastFailureAt is the field the
                // UI keys "something happened" off — Phase 1 item 6).
                row.lastFailureAt = System.currentTimeMillis()
                row.lastFailureState = row.state.name
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
                if (attempts >= maxAttempts) {
                    // Persist the failure marker BEFORE deciding NEEDS_ATTENTION
                    // — the persistent counter is what makes auto-recovery
                    // budget durable across process kills.
                    row.attemptCount = (row.attemptCount + 1).coerceAtMost(Int.MAX_VALUE / 2)
                    row.lastFailureAt = System.currentTimeMillis()
                    row.lastFailureState = row.state.name
                    row.lastFailureReason = sanitizeFailureReason(e.message)
                    if (row.attemptCount >= needsAttentionThreshold) {
                        // Fix C item 4 — surrender to user. The row stays on
                        // disk, the bundle is preserved, the History UI
                        // surfaces a manual Retry affordance (which calls
                        // HumynUploadModule.retryNeedsAttention → resets
                        // attemptCount + state).
                        Log.w(
                            TAG,
                            "row ${row.recordingId} NEEDS_ATTENTION after ${row.attemptCount} attempts " +
                                "(last failure in ${row.lastFailureState ?: "?"}: ${row.lastFailureReason ?: "?"})",
                        )
                        row.state = UploadState.NEEDS_ATTENTION
                    }
                    queueStore.upsert(row)
                    emitQueueChanged()
                    break
                }
                try {
                    Thread.sleep(transientRetryDelayMs)
                } catch (ie: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
        }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` — true iff the row should be
     * picked up by an automatic drain attempt. Skips the terminal-but-
     * recoverable states (DEAD_LETTER, NEEDS_ATTENTION) — these require an
     * explicit user-driven retry. Enh 3 / D1 (2026-06-04): there is no longer
     * an AWAITING_VERIFY / VERIFIED wait state — `/finalize` 200 deletes the
     * bundle + drops the row inline, so a finalized row leaves the queue
     * entirely instead of parking on-device.
     */
    private fun isEligibleForAutomaticDrain(row: UploadRow): Boolean = when (row.state) {
        UploadState.DEAD_LETTER,
        UploadState.NEEDS_ATTENTION,
        -> false
        UploadState.PENDING, UploadState.UPLOADING, UploadState.FINALIZING -> true
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — per-row
     * exponential backoff schedule. A row with `attemptCount = N` must wait
     * `backoffMsForAttempt(N)` after its `lastFailureAt` before being picked
     * up by a worker. A row whose `lastFailureAt == 0` (never failed) returns
     * `true` immediately.
     *
     * Schedule (ms): 0 → 30s → 60s → 2m → 5m → 15m → 1h.
     */
    private fun isBackoffElapsed(row: UploadRow): Boolean {
        if (row.lastFailureAt <= 0L) return true
        val now = System.currentTimeMillis()
        val due = row.lastFailureAt + backoffMsForAttempt(row.attemptCount)
        return now >= due
    }

    private fun backoffMsForAttempt(n: Int): Long = when {
        n <= 0 -> 0L
        n == 1 -> 30_000L
        n == 2 -> 60_000L
        n == 3 -> 2 * 60_000L
        n == 4 -> 5 * 60_000L
        n == 5 -> 15 * 60_000L
        else -> 60 * 60_000L // 1 h cap
    }

    private fun sanitizeFailureReason(msg: String?): String? {
        if (msg.isNullOrBlank()) return null
        // Strip presigned-URL noise — T-5-06-02. Keep the first ~120 chars.
        val safe = msg.replace(Regex("https?://\\S+"), "<url>")
        return safe.take(160)
    }

    /**
     * Phase 1 (2026-06-10) — extract the problem-detail slug from a 401 body.
     * The API's problem-details carry `type: "https://humyn-app.io/problems/
     * <slug>"`; the slugs the JS side dispatches on are `device-evicted`
     * (single-device binding kicked this install) and `reauth-required`
     * (legacy/expired claim shape). Falls back to substring matching for a
     * non-JSON body (proxy error page), then to "unknown" — the JS listener
     * treats unknown as plain token expiry (silent re-auth attempt).
     */
    internal fun parseAuthSlug(bodyText: String): String {
        runCatching {
            val type = JSONObject(bodyText).optString("type", "")
            if (type.isNotBlank()) {
                val slug = type.substringAfterLast('/').trim()
                if (slug.isNotBlank()) return slug
            }
        }
        return when {
            bodyText.contains("device-evicted") -> "device-evicted"
            bodyText.contains("reauth-required") -> "reauth-required"
            else -> "unknown"
        }
    }

    /**
     * BUG-4 (2026-06-09) — classify a non-2xx response from `/recordings/init`,
     * `/recordings/:id/parts`, or `/recordings/:id/finalize`.
     *
     * A **4xx (EXCEPT 408 Request-Timeout + 429 Too-Many-Requests, which are
     * genuinely transient)** is a permanent client-contract violation: return a
     * [DeadLetterException] carrying a SANITIZED snippet of the server's
     * problem-detail body (which names the failing zod field —
     * `error-handler.ts`), so the row dead-letters **fast + visibly** with a
     * readable `deadLetterReason` + a History Retry affordance — instead of being
     * mis-retried as a flaky-network blip on the `30s→1h` backoff for ~23 min
     * (the reported "stuck in-progress with no %, then 400" symptom). Every
     * **5xx / 408 / 429 / network error** stays transient → [IOException] → the
     * bounded retry loop in [runWorker].
     *
     * ⚠ OkHttp response bodies are single-consume: the caller MUST read the body
     * ONCE (`resp.body?.string()`) at the top of its `.use{}` block and pass that
     * text here — never re-read `resp.body`. The snippet is run through
     * [sanitizeFailureReason] (strips presigned-URL noise, T-5-06-02) so a leaky
     * body never reaches `deadLetterReason` / the History UI.
     */
    private fun classifyHttpFailure(code: Int, bodyText: String, label: String): Exception {
        // Phase 1 (2026-06-10) — 401 is an AUTH failure, not a row failure: the
        // JWT expired or the device was evicted (single-device binding). It must
        // never dead-letter; runWorker parks the row, pauses the queue, and
        // emits onUploadAuthFailure with the problem-detail slug.
        if (code == 401) return AuthFailureException(parseAuthSlug(bodyText))
        val transient4xx = code == 408 || code == 429
        if (code in 400..499 && !transient4xx) {
            val snippet = sanitizeFailureReason(bodyText)
            val reason = if (!snippet.isNullOrBlank()) "$label -> $code ($snippet)" else "$label -> $code"
            return DeadLetterException(reason, null)
        }
        return IOException("$label -> $code")
    }

    /**
     * BUG-4 (2026-06-09) — resolve the `capturedAt` ISO for `/recordings/init`.
     * The source (`CaptureSession.kt` wallclock-start via `MetadataComposer`) is
     * normally ALWAYS a valid numeric-offset ISO; a blank value here means
     * metadata corruption. Rather than ship `""` — which is GUARANTEED to 400
     * against the server's `capturedAt: z.string().datetime({ offset: true })`
     * (and, pre-BUG-4, dead-loop the row for ~23 min) — log loudly and fall back
     * to a best-effort offset-ISO derived from the MP4's `lastModified` (close to
     * capture time). The server records this as an audit field; an
     * approximately-correct timestamp beats a guaranteed upload failure.
     */
    private fun resolveCapturedAt(metadata: JSONObject, row: UploadRow): String {
        val raw = metadata.optString("start_timestamp", "")
        if (raw.isNotBlank()) return raw
        val mp4Modified = File(row.mp4Path).lastModified().takeIf { it > 0L } ?: System.currentTimeMillis()
        val fallback = java.time.OffsetDateTime
            .ofInstant(java.time.Instant.ofEpochMilli(mp4Modified), java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        Log.w(
            TAG,
            "row ${row.recordingId}: metadata start_timestamp blank (corruption?) — " +
                "using best-effort capturedAt=$fallback so the upload isn't blocked",
        )
        return fallback
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
        runCatching { workerExecutor.shutdownNow() }
        runCatching { partExecutor.shutdownNow() }
        runCatching { chunkUploader.shutdown() }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` — test seam. Waits until the
     * worker pool has no in-flight work or [timeoutMs] elapses, returning the
     * remaining in-progress count (0 on success). Used by Robolectric tests
     * that need to assert post-drain state without sleeping a fixed duration.
     * Production code never calls this.
     */
    internal fun awaitIdle(timeoutMs: Long = 10_000L): Int {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (inProgressIds.isEmpty()) return 0
            try {
                Thread.sleep(10L)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                return inProgressIds.size
            }
        }
        return inProgressIds.size
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 4) — user-driven
     * retry of a NEEDS_ATTENTION row. Wired up via
     * [HumynUploadModule.retryNeedsAttention]; the History UI's "Retry"
     * affordance on the chip-failed visual fires this. Resets `attemptCount`
     * + `lastFailureAt` + state markers, transitions to UPLOADING (if there's
     * an uploadId — the worker takes the /parts re-presign branch) or PENDING
     * (the worker takes the /init self-heal branch). Re-kicks the drainer.
     *
     * No-op (returns false) on any non-NEEDS_ATTENTION row.
     */
    fun retryNeedsAttention(recordingId: String): Boolean {
        val row = queueStore.read().firstOrNull { it.recordingId == recordingId } ?: return false
        if (row.state != UploadState.NEEDS_ATTENTION) return false
        reactivateRow(row)
        return true
    }

    /**
     * Shared body of the two row-revival paths ([retryNeedsAttention] +
     * [reviveDeadLetter] — review extraction 2026-06-10; the two hand-copies
     * had already drifted on the post-revive state). Clears the failure
     * markers, mints fresh per-route Idempotency-Keys (so a historically
     * server-cached entry under the old key can never replay — safe because
     * /init + /parts + /finalize are SELECT-first idempotent and the server
     * only memoizes 2xx), and puts the row back on the automatic drain path:
     * UPLOADING when an uploadId exists (the worker re-presigns against the
     * EXISTING multipart upload, preserving DONE parts' ETags) or PENDING
     * (the worker takes the idempotent /init self-heal branch).
     */
    private fun reactivateRow(row: UploadRow) {
        row.attemptCount = 0
        row.lastFailureAt = 0L
        row.lastFailureState = null
        row.lastFailureReason = null
        row.rotateIdempotencyKeys()
        row.state = if (row.uploadId != null) UploadState.UPLOADING else UploadState.PENDING
        queueStore.upsert(row)
        emitQueueChanged()
        drain()
    }

    /**
     * Phase 1 items 3 + 5 (2026-06-10) — user-driven revival of a DEAD_LETTER
     * row, moved here from `HumynUploadModule.reviveDeadLetter` so it shares the
     * queue store + emitters and is plain-JUnit testable. Beyond the historical
     * state-flip it now ALSO:
     *  - resets `attemptCount` / `lastFailureAt` / `lastFailureState` /
     *    `lastFailureReason` (mirrors [retryNeedsAttention]) — without this a
     *    revived row could sit backoff-skipped for up to 1 h looking frozen;
     *  - rotates the per-route Idempotency-Keys (immunity against any
     *    historically cached server entry — see [retryNeedsAttention]).
     *
     * `uploadId` / `imuUploadId` / parts / `metadataPut` are KEPT so the drainer
     * takes `/parts` re-presign (uploadId set — preserves DONE ETags) or the
     * idempotent `/init` self-heal (uploadId null). No-op (false) for a missing
     * or non-DEAD_LETTER row — a sweep over a mixed queue never mutates an
     * UPLOADING row mid-transfer. Invoked by the user-tapped History Retry AND
     * the automatic boot/foreground revive sweep (`uploadReconcile.ts`).
     */
    fun reviveDeadLetter(recordingId: String): Boolean {
        val row = queueStore.read().firstOrNull { it.recordingId == recordingId } ?: return false
        if (row.state != UploadState.DEAD_LETTER) return false
        row.deadLetterReason = null
        reactivateRow(row)
        return true
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

        // Debug session `upload-queue-hol-finalizing` (Fix C item 3) — FINALIZING
        // reconciliation. A row already in FINALIZING means we've successfully
        // POSTed /finalize before but never confirmed the response (it 5xx'd,
        // hung past the watchdog, or the response was lost over a flaky link).
        // Before re-POSTing, ask the server what it thinks: if it already shows
        // `qa_status` in {uploaded, verified}, the recording is done — we
        // delete the local bundle + drop the row and bail. This is what would
        // have recovered `01KRVPP7RKSYXD3DK2H5KKXYXA` on the 2026-05-18 walk
        // without a process kill: server-side finalized, client just hadn't
        // learned.
        if (row.state == UploadState.FINALIZING) {
            val serverQa = runCatching { getRecordingQaStatus(baseUrl, row.recordingId) }.getOrNull()
            if (serverQa == "uploaded" || serverQa == "verified") {
                // Server already finalized — `uploaded` is terminal success
                // (Enh 3 / D1). Delete the local bundle + drop the row inline,
                // exactly as the /finalize-200 tail does; no on-device verify
                // wait. Legacy `verified` rows are still read as success.
                completeAndCleanup(row, "FINALIZING reconciled — server qa_status=$serverQa")
                return
            }
            // Else: server still says `pending` (or returned 4xx — null), or
            // the GET failed (also null). Fall through to re-finalize via the
            // normal path. A 404 means the recording row was deleted server-
            // side (e.g. ops takedown) — re-finalize will get a 404/409 that
            // dead-letters cleanly.
        }

        // 1. /init (or, on a re-drain, /:id/parts) — decide partsCount ONCE on
        //    the first call and pin it (`row.partsCount` / `row.chunkBytes`); a
        //    re-drain re-issues fresh (non-expired) presigned URLs against the
        //    EXISTING video+IMU multipart uploads but KEEPS the row's per-part
        //    {etag,status} (a DONE part is never re-PUT, UP-04).
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

        // A re-drain (row.uploadId != null) takes /recordings/:id/parts (re-presign
        // against the EXISTING video+IMU uploadIds — keeps already-DONE parts'
        // ETags valid; UP-04). First drain (row.uploadId == null) takes
        // /recordings/init (idempotent since Plan 05-09 — a re-/init returns the
        // SAME uploadId, so a lost 201 self-heals).
        val initResp: InitResponse = when {
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
        // BEFORE the row is dropped. Without it the bar can briefly jump back
        // to "Uploading… %" between FINALIZING and removal on slow networks
        // where finalize takes more than a paint frame.
        emitQueueChanged()
        postFinalize(baseUrl, row)

        // 5. Terminal success (Enh 3 / D1, 2026-06-04). `/finalize` 200 means
        //    `uploaded` is the terminal success state server-side — there is no
        //    on-device verify wait anymore. Delete the local bundle (mp4 + IMU
        //    csv + metadata json, NOT the thumbnail) and drop the queue row.
        completeAndCleanup(row, "finalize 200")
    }

    /**
     * Enh 3 / D1 (2026-06-04) — terminal-success cleanup. `/finalize` returning
     * 200 (or a FINALIZING-reconcile finding the server already at `qa_status`
     * in {uploaded, verified}) is the end of the line: `uploaded` is the
     * terminal success state server-side, there is no on-device verify wait
     * anymore. Delete the local bundle (mp4 + IMU csv + metadata json) + drop
     * the queue row, then emit so every JS subscriber re-reads the queue
     * without the now-finished row.
     *
     * The THUMBNAIL is deliberately preserved — History renders it from the
     * local thumbnail ledger until Bug 6 (server-generated thumbnails) ships.
     * This is what the removed `verified`-event handler used to do; the
     * coordinator now does it inline the moment finalize succeeds.
     */
    private fun completeAndCleanup(row: UploadRow, why: String) {
        Log.i(TAG, "row ${row.recordingId} uploaded ($why) — deleting local bundle + dropping row")
        queueStore.deleteLocalAndRemove(row.recordingId)
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
    // HTTP — /init, /finalize, presigned PUTs
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
     * `/parts`, `row.finalizeIdempotencyKey` for `/finalize`. Per-route split closes
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

    /**
     * Build an authed GET request — used by [getRecordingQaStatus] for the
     * Fix-C-item-3 FINALIZING reconciliation. No Idempotency-Key (GETs are
     * naturally idempotent and the server's plugin doesn't require one on
     * read methods).
     */
    private fun authedGetRequest(url: String): Request {
        val token = getBearerToken()
        return Request.Builder()
            .url(url)
            .get()
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

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 2) — variant of
     * [executeTracked] that applies a per-call timeout via [okhttp3.Call.timeout].
     * Used for `/finalize` and `GET /recordings/:id` — both can hang server-side
     * (BullMQ enqueue blocking on a broken Redis pool was the 2026-05-18
     * trigger), and a hung call here would otherwise sit forever on the
     * client-wide `readTimeout(0)`. Bypasses the watchdog for everything else
     * (part PUTs delegate stall-handling to [ChunkUploader]'s 30s no-progress
     * watchdog, which correctly handles slow-but-progressing transfers; a
     * fixed `callTimeout` on a part PUT would kill a healthy slow cellular
     * transfer).
     */
    private fun executeTrackedWithTimeout(req: Request, timeoutMs: Long): okhttp3.Response {
        val call = apiClient.newCall(req)
        // Apply per-call timeout — OkHttp 4.x `Call.timeout()` returns an
        // `okio.Timeout`, set in ms or longer. A 0 disables; we pass the
        // configured ms.
        call.timeout().timeout(timeoutMs, TimeUnit.MILLISECONDS)
        inflight.add(call)
        return try {
            call.execute()
        } finally {
            inflight.remove(call)
        }
    }

    /**
     * Debug session `upload-queue-hol-finalizing` (Fix C item 3) — `GET
     * /recordings/:id`, returning the server's current `qa_status` string
     * (or null on any failure — caller treats null as "I don't know, proceed
     * with re-finalize"). Used to short-circuit a stuck FINALIZING row: if the
     * server already shows `uploaded` or `verified`, the client deletes the
     * local bundle + drops the row (terminal success) without re-POSTing
     * /finalize.
     *
     * Returns null on:
     *  - 4xx response (recording doesn't exist server-side, owner mismatch,
     *    etc — the next drain will hit /finalize and dead-letter cleanly);
     *  - 5xx response (transient — the next drain retries);
     *  - timeout (the per-call timeout fired);
     *  - JSON parse error (defensive).
     *
     * The body is expected to follow `RecordingDetailResponseSchema` with a
     * top-level `qa_status` string. Tolerate missing fields → null.
     */
    internal fun getRecordingQaStatus(baseUrl: String, recordingId: String): String? {
        val url = "$baseUrl/recordings/$recordingId"
        val req = authedGetRequest(url)
        try {
            executeTrackedWithTimeout(req, finalizeCallTimeoutMs).use { resp ->
                if (!resp.isSuccessful) {
                    Log.d(TAG, "GET /recordings/$recordingId -> ${resp.code} — falling through")
                    return null
                }
                val text = resp.body?.string().orEmpty()
                if (text.isBlank()) return null
                return try {
                    val obj = JSONObject(text)
                    val qa = obj.optString("qa_status", "")
                    if (qa.isBlank()) null else qa
                } catch (_: org.json.JSONException) {
                    Log.d(TAG, "GET /recordings/$recordingId returned non-JSON — falling through")
                    null
                }
            }
        } catch (t: Throwable) {
            // Includes InterruptedIOException from the per-call timeout.
            Log.d(TAG, "GET /recordings/$recordingId failed: ${t.javaClass.simpleName}")
            return null
        }
    }

    private fun postInit(baseUrl: String, row: UploadRow, jsonFile: File, partsCount: Int): InitResponse {
        // The /recordings/init body (per shared/types RecordingsInitRequestSchema):
        // recordingId, taskId (26-char ULID), practice, partsCount, durationMs,
        // fileSizeBytes, imuSizeBytes, capturedAt (ISO). We read the sizes/
        // timestamp out of the metadata JSON produced by MetadataComposer at
        // capture time (top-level `recording_id`, nested `metadata.{
        // file_size_bytes, imu_size_bytes, duration_seconds, start_timestamp}`);
        // recordingId/taskId come from the row. (Enh 3 / D1, 2026-06-04:
        // file_sha256 / imu_sha256 removed — no upload hashing anymore.)
        val meta = JSONObject(jsonFile.readText())
        val m = meta.optJSONObject("metadata") ?: JSONObject()
        val body = JSONObject().apply {
            put("recordingId", row.recordingId)
            put("taskId", row.taskId)
            put("practice", row.isPractice)
            put("partsCount", partsCount)
            put("durationMs", Math.round((m.optDouble("duration_seconds", 0.0)) * 1000.0))
            put("fileSizeBytes", m.optLong("file_size_bytes", File(row.mp4Path).length()))
            put("imuSizeBytes", m.optLong("imu_size_bytes", File(row.csvPath).length()))
            // BUG-4 (2026-06-09) — guard against a blank start_timestamp (metadata
            // corruption); shipping "" guarantees a 400. resolveCapturedAt falls
            // back to a best-effort offset-ISO so the bytes still upload.
            put("capturedAt", resolveCapturedAt(m, row))
            // Quick task 260522-elm CAPTURE-QA-08/09 — forward the metadata.json
            // top-level `calibration` block (camera intrinsics + cam-IMU
            // extrinsics) verbatim so the server persists it as the queryable
            // mirror (recordings.calibration jsonb). The block's shape already
            // matches the backend zod CalibrationSchema (camera + cam_imu_
            // extrinsics); extra keys are stripped server-side and null params
            // are tolerated. Omitted for pre-1.2.0 metadata with no
            // `calibration` key (the server's zod field is .nullable().optional()).
            meta.optJSONObject("calibration")?.let { put("calibration", it) }
            // Bug 3 / D3 (2026-06-04) — forward the metadata.json precise-GPS
            // block { lat, lng, accuracy_m, provider, captured_at, label } so the
            // server persists it as the queryable mirror (recordings.location
            // jsonb). It lives NESTED under `capture_device_info.location` (not
            // top-level like calibration). Omitted when the segment had no fix
            // (the block is JSON null) — the server's zod field is
            // .nullable().optional(), so a missing key persists as null.
            meta.optJSONObject("capture_device_info")
                ?.optJSONObject("location")
                ?.let { put("location", it) }
        }
        executeTracked(authedJsonRequest("$baseUrl/recordings/init", body, row.initIdempotencyKey)).use { resp ->
            // BUG-4 (2026-06-09) — read the single-consume OkHttp body ONCE, then
            // branch on the code. Post-CR-02 (Plan 05-09) `/recordings/init` is
            // idempotent: a re-/init for an existing `pending` row owned by the
            // caller returns 200 with the SAME uploadId (a lost-201 self-heals).
            // ANY 4xx (409 non-pending takedown, 403 owner mismatch, AND a 400
            // contract violation — the reported stuck-then-400 symptom) is
            // non-retryable → dead-letter FAST with the server's reason via
            // classifyHttpFailure, instead of being looped as transient for ~23
            // min. A 5xx / 408 / 429 / network error stays transient (next drain).
            val bodyText = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw classifyHttpFailure(resp.code, bodyText, "/recordings/init")
            return parseInitResponse(bodyText, "/recordings/init")
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
     * Retry from History via `reviveDeadLetter`). A `5xx` / network error is
     * transient (the next drain retries).
     */
    private fun postRePresign(baseUrl: String, row: UploadRow, partsCount: Int): InitResponse {
        val imuId = row.imuUploadId
            ?: throw DeadLetterException("re-presign needs imuUploadId; row ${row.recordingId} has none", null)
        val body = JSONObject().put("partsCount", partsCount).put("imuUploadId", imuId)
        executeTracked(authedJsonRequest("$baseUrl/recordings/${row.recordingId}/parts", body, row.partsIdempotencyKey)).use { resp ->
            // BUG-4 (2026-06-09) — read the single-consume body ONCE; any 4xx
            // (404 row-gone / 409 not-resumable / 400 contract) dead-letters fast
            // with the server's reason; 5xx / 408 / 429 stay transient.
            val bodyText = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                throw classifyHttpFailure(resp.code, bodyText, "/recordings/${row.recordingId}/parts")
            }
            return parseInitResponse(bodyText, "/recordings/:id/parts")
        }
    }

    /**
     * Parse a `/recordings/init` | `/recordings/:id/parts` JSON body into an
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
        // Debug session `upload-queue-hol-finalizing` (Fix C item 2) — per-call
        // timeout on /finalize. The client-wide `readTimeout(0)` / `callTimeout(0)`
        // is the right shape for part PUTs (delegated to ChunkUploader's no-progress
        // watchdog so a slow-but-progressing cellular transfer doesn't get killed),
        // but it leaves /finalize vulnerable to a server hang. A server-side BullMQ
        // enqueue against an erroring Redis pool was the 2026-05-18 trigger that
        // hung /finalize forever and froze the queue. The 60s call-level timeout
        // here ensures the call fails into the transient-retry loop instead of
        // hanging — long enough for a healthy finalize handler's slowest path, short
        // enough that a stuck row recovers quickly.
        executeTrackedWithTimeout(
            authedJsonRequest("$baseUrl/recordings/${row.recordingId}/finalize", body, row.finalizeIdempotencyKey),
            finalizeCallTimeoutMs,
        ).use { resp ->
            // BUG-4 (2026-06-09) — a 4xx from /finalize is a terminal contract
            // error (404 row-gone / 403 owner / 409 state-conflict / 400 malformed
            // body) → dead-letter fast with the server's reason; a 5xx / 408 / 429
            // stays transient (the watchdog-timeout path throws before we get here,
            // so a hung finalize is still a transient IOException).
            if (!resp.isSuccessful) {
                val bodyText = resp.body?.string().orEmpty()
                throw classifyHttpFailure(resp.code, bodyText, "/recordings/${row.recordingId}/finalize")
            }
        }
    }

    companion object {
        private const val TAG = "HumynUploadCoord"

        /**
         * Phase 1 (2026-06-10) — prefix stamped into `lastFailureReason` when a
         * row is parked by an auth-classified 401. The JS reconcile sweep
         * (`uploadReconcile.ts`) checks for this marker and skips auto-reviving/
         * draining such rows until a fresh token has been pushed (prevents the
         * 401 ping-pong). Keep in sync with `AUTH_FAILURE_REASON_PREFIX` in
         * `apps/mobile/src/services/uploadQueueStore.ts`.
         */
        const val AUTH_FAILURE_REASON_PREFIX = "auth: "
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
         * Debug session `upload-queue-hol-finalizing` (Fix C item 1) — default
         * number of concurrent worker threads. 2 was chosen as the smallest
         * cap that prevents head-of-line blocking on the upload queue (one
         * stuck row leaves N-1 workers free to drain the rest) without
         * blasting cellular networks: 2 workers × 6 part-semaphore permits =
         * up to 12 in-flight HTTPS requests in the worst case, vs the
         * previous 6. A Pixel 7a-class radio handles this comfortably; the
         * device-level part semaphore (a shared [partSemaphore], not
         * per-worker) caps the worst case at 6, identical to the pre-fix
         * shape. Tunable via the constructor if a future device class needs
         * more or a low-bandwidth fleet needs less.
         */
        internal const val UPLOAD_PARALLELISM_CAP: Int = 2

        /**
         * Debug session `upload-queue-hol-finalizing` (Fix C item 2) —
         * per-call timeout for `/finalize` and `GET /recordings/:id`. 60s is
         * long enough for the slowest healthy path (BullMQ enqueue + the
         * finalize-worker handler's S3 CompleteMultipartUpload, p99 ~5s on
         * LocalStack / a few seconds on real S3), but short enough that a
         * stuck server doesn't pin the row indefinitely. A failed call here
         * surfaces as IOException → transient-retry loop → eventual
         * NEEDS_ATTENTION transition if the server stays sick.
         */
        internal const val FINALIZE_CALL_TIMEOUT_MS: Long = 60_000L

        /**
         * Debug session `upload-queue-hol-finalizing` (Fix C item 4) —
         * after this many automatic recovery attempts on a single row, the
         * worker stops trying and transitions the row to NEEDS_ATTENTION.
         * With the backoff schedule (30s, 60s, 2m, 5m, 15m, 1h), this is
         * ~ 23 minutes of total wall-clock from the first failure to the
         * NEEDS_ATTENTION transition — long enough to absorb transient
         * server outages, short enough that a permanently-stuck row
         * surfaces to the user before the local bundle hogs storage.
         */
        internal const val NEEDS_ATTENTION_THRESHOLD: Int = 6

        /**
         * The process-wide shared coordinator. `HumynUploadModule`, the FGS
         * (`HumynForegroundService` — Plan 05-07's upload-drain-on-the-FGS-thread)
         * and the UIDT `UploadJobService` all call [drainNow] on this ONE
         * instance; concurrent calls dispatch onto the same worker pool, with
         * per-row reservations preventing two workers from racing on a single
         * row. Built lazily from the application context; wired to the
         * process-lived [UploadAuthContext] / [UploadControlState].
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
         *
         * Debug session `upload-queue-hol-finalizing` (Fix C item 2) — note
         * that the client-wide `callTimeout(0)` IS PRESERVED here. The
         * `/finalize` watchdog (60s) lives on the per-call layer via
         * [executeTrackedWithTimeout] + `Call.timeout()` — it does NOT touch
         * the part-PUT path that delegates to ChunkUploader's no-progress
         * watchdog.
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
 * Phase 1 (2026-06-10) — a 401 from `/recordings/init`, `/recordings/:id/parts`
 * or `/recordings/:id/finalize`. NOT a row-level failure: the bearer JWT is
 * dead (expired, legacy shape, or evicted by the single-device binding) for the
 * ENTIRE queue. `runWorker` parks the row back to PENDING with an
 * `auth: <slug>` marker, pauses the queue, and emits `onUploadAuthFailure` so
 * the JS side can run the eviction UX or silently re-auth + resume. Never
 * dead-letters, never counts toward NEEDS_ATTENTION.
 */
internal class AuthFailureException(val slug: String) : Exception("auth: $slug")

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
