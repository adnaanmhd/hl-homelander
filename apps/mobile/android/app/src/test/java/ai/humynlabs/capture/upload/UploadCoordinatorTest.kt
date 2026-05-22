package ai.humynlabs.capture.upload

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowNetworkCapabilities
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Plan 05-06 Task 2 — `UploadCoordinator` (the queue drainer running the
 * `/init`→PUT(metadata + parts, 6-permit semaphore)→`/finalize` flow, persisting
 * per-part `{etag,status}`, debouncing progress, pause/owner-aware,
 * dead-lettering cleanly).
 *
 * `MockWebServer` stands in for BOTH the Phase-1 API and S3 — `/recordings/init`
 * returns presigned-PUT URLs pointed back at the same server; each PUT returns a
 * 200 + an `ETag`; `/recordings/:id/finalize` returns 200. A short-backoff
 * `ChunkUploader` is injected so the dead-letter test doesn't sleep 2/4/8 s.
 *
 * `application = Application::class` — bypasses MainApplication.onCreate
 * SoLoader.init NPE under Robolectric (canonical Phase 3/4 pattern).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UploadCoordinatorTest {

    private lateinit var server: MockWebServer
    private lateinit var store: UploadQueueStore
    private lateinit var recDir: File
    private lateinit var app: Application

    /** Counters the dispatcher updates so tests can assert call shapes. */
    private val initCalls = AtomicInteger(0)
    private val reuploadCalls = AtomicInteger(0)
    private val partsCalls = AtomicInteger(0)
    private val finalizeCalls = AtomicInteger(0)
    private val putCalls = ConcurrentHashMap<String, AtomicInteger>() // path → count
    private val lastFinalizeBody = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
    private val lastPartsBody = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
    private val lastInitBody = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
    /** Captured Idempotency-Key header per POST path. Set in the dispatcher. Last-write-wins per path. */
    private val idempotencyKeysByPath = java.util.concurrent.ConcurrentHashMap<String, String>()
    @Volatile private var failAllPuts = false
    /** When > 0, the `/recordings/init` response is parked this many ms (used by the drain-serialisation test). */
    @Volatile private var initHeadersDelayMs = 0L
    /** Override the `/recordings/init` response code (0 = default 201 + presigned body). */
    @Volatile private var initResponseCode = 0
    /** Override the `/recordings/:id/parts` response code (0 = default 200 + presigned body echoing the supplied ids). */
    @Volatile private var partsResponseCode = 0
    /** When non-null, the `/recordings/:id/parts` body is returned verbatim with a 200 (used by the non-JSON-leak test). */
    @Volatile private var partsRawBody: String? = null
    /** Wave-2 #5 — when > 0, the next N `/recordings/init` calls return 503 (transient), then the default 201 takes over. */
    private val flakyInitCount = AtomicInteger(0)
    /** Fix C item 3 — `qa_status` returned from `GET /recordings/:id`. Null → 404. */
    @Volatile private var qaStatusFor: (String) -> String? = { _ -> null }
    /** Fix C item 2/3 — count of `GET /recordings/:id` calls. */
    private val getRecordingCalls = AtomicInteger(0)
    /** Fix C item 2 — when > 0, the next N `/finalize` calls park for [finalizeHangMs] ms before returning (simulates a hung server). */
    private val finalizeHangCount = AtomicInteger(0)
    /** Fix C item 2 — duration of the hang. Set to > finalizeCallTimeoutMs to force the watchdog to fire. */
    @Volatile private var finalizeHangMs: Long = 0L

    @Before
    fun setUp() {
        app = RuntimeEnvironment.getApplication() as Application
        File(app.filesDir, "upload-queue").deleteRecursively()
        recDir = File(app.filesDir, "recordings").apply { mkdirs() }
        store = UploadQueueStore(app)

        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path ?: ""
                return when {
                    path == "/recordings/init" -> {
                        initCalls.incrementAndGet()
                        request.getHeader("Idempotency-Key")?.let { idempotencyKeysByPath["/recordings/init"] = it }
                        val initBody = JSONObject(request.body.readUtf8())
                        lastInitBody.set(initBody)
                        val partsCount = initBody.getInt("partsCount")
                        val code = initResponseCode
                        val flakyRemaining = flakyInitCount.get()
                        when {
                            code != 0 -> MockResponse().setResponseCode(code).setBody("{}")
                            flakyRemaining > 0 -> {
                                flakyInitCount.decrementAndGet()
                                // 503 → parseInitResponse throws IOException → uploadOne propagates → drainNow's
                                // per-row transient catch (Wave-2 #5 retry loop) sleeps and retries.
                                MockResponse().setResponseCode(503).setBody("transient")
                            }
                            else -> {
                                MockResponse().setResponseCode(201).setBody(initBody(partsCount)).apply {
                                    val d = initHeadersDelayMs
                                    if (d > 0) setHeadersDelay(d, TimeUnit.MILLISECONDS)
                                }
                            }
                        }
                    }
                    path.endsWith("/reupload") -> {
                        reuploadCalls.incrementAndGet()
                        request.getHeader("Idempotency-Key")?.let { idempotencyKeysByPath["/reupload"] = it }
                        val partsCount = JSONObject(request.body.readUtf8()).getInt("partsCount")
                        MockResponse().setResponseCode(200).setBody(initBody(partsCount))
                    }
                    path.endsWith("/parts") -> {
                        partsCalls.incrementAndGet()
                        request.getHeader("Idempotency-Key")?.let { idempotencyKeysByPath["/parts"] = it }
                        val body = JSONObject(request.body.readUtf8())
                        lastPartsBody.set(body)
                        val code = partsResponseCode
                        val raw = partsRawBody
                        when {
                            code != 0 -> MockResponse().setResponseCode(code).setBody("{}")
                            raw != null -> MockResponse().setResponseCode(200).setBody(raw)
                            else -> {
                                // Echo the row's existing uploadId/imuUploadId back unchanged (Plan 05-09's /parts contract).
                                val partsCount = body.getInt("partsCount")
                                val imuUploadId = body.getString("imuUploadId")
                                MockResponse().setResponseCode(200)
                                    .setBody(initBody(partsCount, uploadId = "VID-UPLOAD-ID", imuUploadId = imuUploadId))
                            }
                        }
                    }
                    path.endsWith("/finalize") -> {
                        finalizeCalls.incrementAndGet()
                        request.getHeader("Idempotency-Key")?.let { idempotencyKeysByPath["/finalize"] = it }
                        lastFinalizeBody.set(JSONObject(request.body.readUtf8()))
                        // Fix C item 2 — simulate a hung /finalize handler. The body
                        // is parked via `setHeadersDelay` so the OkHttp `Call.timeout`
                        // (set by executeTrackedWithTimeout) fires.
                        if (finalizeHangCount.getAndDecrement() > 0) {
                            MockResponse().setResponseCode(200).setBody("{}").setHeadersDelay(finalizeHangMs, TimeUnit.MILLISECONDS)
                        } else {
                            MockResponse().setResponseCode(200).setBody("{}")
                        }
                    }
                    path.startsWith("/recordings/") && request.method == "GET" -> {
                        // Fix C item 3 — GET /recordings/:id for the FINALIZING
                        // reconciliation path. Extract the id (between `/recordings/`
                        // and the next `/` or end-of-path) and return the configured
                        // qa_status (or 404 if null).
                        getRecordingCalls.incrementAndGet()
                        val tail = path.substringAfter("/recordings/")
                        val id = tail.substringBefore('/').substringBefore('?')
                        val qa = qaStatusFor(id)
                        if (qa == null) {
                            MockResponse().setResponseCode(404).setBody("{}")
                        } else {
                            MockResponse().setResponseCode(200).setBody(
                                JSONObject().put("id", id).put("qa_status", qa).toString(),
                            )
                        }
                    }
                    path.startsWith("/s3/") -> {
                        putCalls.computeIfAbsent(path) { AtomicInteger(0) }.incrementAndGet()
                        if (failAllPuts) {
                            MockResponse().setResponseCode(500)
                        } else {
                            MockResponse().setResponseCode(200).addHeader("ETag", "\"etag-${path.hashCode()}\"")
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        server.start()
        // Default: cellular = false; ChunkSize tests flip it.
        attachCaps(NetworkCapabilities.TRANSPORT_WIFI)
    }

    @After
    fun tearDown() {
        runCatching { server.shutdown() }
    }

    private fun cm(): ConnectivityManager =
        app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private fun attachCaps(vararg transports: Int) {
        val active = cm().activeNetwork ?: return
        val caps = ShadowNetworkCapabilities.newInstance()
        transports.forEach { shadowOf(caps).addTransportType(it) }
        shadowOf(caps).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        shadowOf(cm()).setNetworkCapabilities(active, caps)
    }

    private fun base() = server.url("/").toString().trimEnd('/')

    /** A presigned-URL payload pointing back at the MockWebServer's `/s3/...` paths. */
    private fun initBody(
        partsCount: Int,
        uploadId: String = "VID-UPLOAD-ID",
        imuUploadId: String = "IMU-UPLOAD-ID",
    ): String {
        fun urls(prefix: String) = JSONArray().apply {
            (1..partsCount).forEach { n ->
                put(JSONObject().put("partNumber", n).put("url", server.url("/s3/$prefix/$n").toString()))
            }
        }
        return JSONObject().apply {
            put("recordingId", "x")
            put("uploadId", uploadId)
            put("imuUploadId", imuUploadId)
            put("partsCount", partsCount)
            put("partUrls", urls("video"))
            put("imuPartUrls", urls("imu"))
            put("metadataUrl", server.url("/s3/metadata").toString())
            put("expiresAt", "2099-01-01T00:00:00.000Z")
        }.toString()
    }

    /**
     * Write a recording bundle (mp4 of [mp4Bytes] size + csv + metadata json) under filesDir/recordings.
     * When [calibration] is non-null it is added as the metadata.json top-level `calibration` block
     * (schema 1.2.0) so a test can assert the uploader forwards it on /recordings/init (260522-elm).
     */
    private fun writeBundle(recordingId: String, mp4Bytes: Int, calibration: JSONObject? = null): Triple<File, File, File> {
        val mp4 = File(recDir, "$recordingId.mp4").apply { writeBytes(ByteArray(mp4Bytes) { (it % 251).toByte() }) }
        val csv = File(recDir, "$recordingId.csv").apply { writeText("ts,ax,ay,az\n1,0,0,9.8\n") }
        val json = File(recDir, "$recordingId.json").apply {
            writeText(
                JSONObject().apply {
                    put("schema_version", if (calibration != null) "1.2.0" else "1.1.0")
                    put("recording_id", recordingId)
                    put("metadata", JSONObject().apply {
                        put("file_sha256", "a".repeat(64))
                        put("imu_sha256", "b".repeat(64))
                        put("file_size_bytes", mp4Bytes.toLong())
                        put("imu_size_bytes", csv.length())
                        put("duration_seconds", 12.5)
                        put("start_timestamp", "2026-05-12T10:00:00.000Z")
                    })
                    if (calibration != null) put("calibration", calibration)
                }.toString(),
            )
        }
        return Triple(mp4, csv, json)
    }

    private fun row(recordingId: String, ownerUserId: String = "userA", calibration: JSONObject? = null): UploadRow {
        val (mp4, csv, json) = writeBundle(recordingId, mp4Bytes = 12_000_000, calibration = calibration) // ~12 MB → 2 parts at 8 MiB
        return UploadRow(
            recordingId = recordingId,
            ownerUserId = ownerUserId,
            mp4Path = mp4.path,
            csvPath = csv.path,
            jsonPath = json.path,
            taskId = "T".repeat(26),
            isPractice = false,
        )
    }

    private fun coordinator(
        currentSub: String? = "userA",
        paused: () -> Boolean = { false },
        bearer: String? = "test-jwt",
        fastBackoffUploader: Boolean = true,
        // Fix C item 1 — default to 1 so a lot of existing serial-drain
        // assertions still hold. The dedicated concurrency test passes 2.
        parallelismCap: Int = 1,
        // Fix C item 2 — default to a fast 500 ms so a hung-/finalize test
        // doesn't sleep 60 s.
        finalizeCallTimeoutMs: Long = 500L,
        // Fix C item 4 — default to 2 so a NEEDS_ATTENTION test lands in
        // two iterations instead of six.
        needsAttentionThreshold: Int = 2,
    ): UploadCoordinator {
        val monitor = NetworkMonitor(app) {}
        val cu = if (fastBackoffUploader) {
            ChunkUploader(UploadCoordinator.DEFAULT_HTTP_CLIENT, backoffMs = longArrayOf(1, 1, 1, 1, 1, 1), noProgressWindowMs = 5_000L)
        } else {
            ChunkUploader(UploadCoordinator.DEFAULT_HTTP_CLIENT)
        }
        return UploadCoordinator(
            queueStore = store,
            networkMonitor = monitor,
            emitProgress = { _, _, _ -> },
            emitQueueChanged = { },
            getApiBaseUrl = { base() },
            getBearerToken = { bearer },
            getCurrentSub = { currentSub },
            isPaused = paused,
            chunkUploader = cu,
            // Wave-2 #5 — 1 ms so the in-loop retry test doesn't sleep 5 s.
            transientRetryDelayMs = 1L,
            parallelismCap = parallelismCap,
            finalizeCallTimeoutMs = finalizeCallTimeoutMs,
            needsAttentionThreshold = needsAttentionThreshold,
        )
    }

    @Test
    fun `drain runs init then metadata PUT then part PUTs then finalize and ends AWAITING_VERIFY`() {
        store.enqueue(row("01JCOORDREC1XXXXXXXXXXXXXX"))
        val coord = coordinator()
        coord.drainNow()

        assertEquals("one /init", 1, initCalls.get())
        assertEquals("zero /reupload", 0, reuploadCalls.get())
        assertEquals("one /finalize", 1, finalizeCalls.get())
        // metadata.json one-shot PUT.
        assertTrue("metadata PUT", (putCalls["/s3/metadata"]?.get() ?: 0) >= 1)
        // 2 video parts (12 MB / 8 MiB → 2) + 1 IMU part.
        assertEquals(1, putCalls["/s3/video/1"]?.get())
        assertEquals(1, putCalls["/s3/video/2"]?.get())
        assertEquals(1, putCalls["/s3/imu/1"]?.get())
        // finalize body carries the collected ETags.
        val fin = lastFinalizeBody.get()!!
        assertEquals(2, fin.getJSONArray("videoParts").length())
        assertEquals(1, fin.getJSONArray("imuParts").length())
        assertEquals("IMU-UPLOAD-ID", fin.getString("imuUploadId"))
        assertTrue(fin.getJSONArray("videoParts").getJSONObject(0).getString("etag").startsWith("\"etag-"))

        // Row ended AWAITING_VERIFY and is STILL in the queue (cleared only on a verified event).
        val back = store.read()
        assertEquals(1, back.size)
        assertEquals(UploadState.AWAITING_VERIFY, back[0].state)
        assertEquals(PartStatus.DONE, back[0].metadataPut)
        assertTrue(back[0].videoParts.all { it.status == PartStatus.DONE && it.etag != null })
    }

    @Test
    fun `init forwards the metadata calibration block verbatim (260522-elm CAPTURE-QA-08-09)`() {
        // A schema-1.2.0 metadata.json carries a top-level `calibration` block;
        // the uploader must forward it verbatim on /recordings/init so the
        // server can persist the recordings.calibration jsonb mirror.
        val calibration = JSONObject().apply {
            put("camera", JSONObject().apply {
                put("model", "pinhole")
                put("resolution", org.json.JSONArray().put(4208).put(3120))
                put("params", JSONObject().apply {
                    put("fx", 1643.84); put("fy", 1643.84); put("cx", 2103.26); put("cy", 1552.57); put("skew", 0)
                })
                put("distortion_coeffs", org.json.JSONArray().put(0.02).put(-0.03).put(0.013).put(0.0005).put(0.0002))
                put("intrinsics_source", "camera2")
            })
            put("cam_imu_extrinsics", JSONObject().apply {
                put("T_cam_imu", JSONObject.NULL)
                put("T_imu_cam", JSONObject.NULL)
                put("T_cam_imu_translation_mm", JSONObject.NULL)
                put("timeshift_cam_imu_sec", 0)
                put("timeshift_meaning", "t_imu = t_cam + timeshift")
                put("clock_sync_note", "camera + imu share the boottime (elapsedRealtimeNanos) clock")
                put("extrinsics_source", "camera2_no_imu_reference")
            })
        }
        store.enqueue(row("01JCOORDCALIBXXXXXXXXXXXXXX", calibration = calibration))
        val coord = coordinator()
        coord.drainNow()

        assertEquals("one /init", 1, initCalls.get())
        val init = lastInitBody.get()!!
        assertTrue("init body carries calibration", init.has("calibration"))
        val cam = init.getJSONObject("calibration").getJSONObject("camera")
        assertEquals("camera2", cam.getString("intrinsics_source"))
        assertEquals(1643.84, cam.getJSONObject("params").getDouble("fx"), 1e-6)
        assertEquals(
            "camera2_no_imu_reference",
            init.getJSONObject("calibration").getJSONObject("cam_imu_extrinsics").getString("extrinsics_source"),
        )
    }

    @Test
    fun `init omits calibration for pre-1_2_0 metadata with no calibration block (260522-elm)`() {
        // Backward-compat: a 1.1.0 bundle has no `calibration` key; the uploader
        // must NOT invent one — the server's zod field is .nullable().optional().
        store.enqueue(row("01JCOORDNOCALIBXXXXXXXXXXXX")) // writeBundle with calibration=null
        coordinator().drainNow()
        assertEquals("one /init", 1, initCalls.get())
        assertTrue("init body omits calibration", !lastInitBody.get()!!.has("calibration"))
    }

    @Test
    fun `drain skips a row whose ownerUserId differs from the current sub (UP-13)`() {
        store.enqueue(row("01JCOORDREC2XXXXXXXXXXXXXX", ownerUserId = "userB"))
        val coord = coordinator(currentSub = "userA")
        coord.drainNow()
        assertEquals("no /init for a foreign-owned row", 0, initCalls.get())
        assertEquals(0, server.requestCount)
        // Row untouched, still PENDING.
        assertEquals(UploadState.PENDING, store.read()[0].state)
    }

    @Test
    fun `drain returns without any PUT when paused`() {
        store.enqueue(row("01JCOORDREC3XXXXXXXXXXXXXX"))
        val coord = coordinator(paused = { true })
        coord.drainNow()
        assertEquals(0, server.requestCount)
        assertEquals(UploadState.PENDING, store.read()[0].state)
    }

    @Test
    fun `drain does nothing when no one is signed in`() {
        store.enqueue(row("01JCOORDREC4XXXXXXXXXXXXXX"))
        val coord = coordinator(currentSub = null)
        coord.drainNow()
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `a part that always 500s dead-letters the row with a reason`() {
        failAllPuts = true
        store.enqueue(row("01JCOORDREC5XXXXXXXXXXXXXX"))
        var queueChanged = false
        val monitor = NetworkMonitor(app) {}
        val coord = UploadCoordinator(
            queueStore = store,
            networkMonitor = monitor,
            emitProgress = { _, _, _ -> },
            emitQueueChanged = { queueChanged = true },
            getApiBaseUrl = { base() },
            getBearerToken = { "jwt" },
            getCurrentSub = { "userA" },
            isPaused = { false },
            chunkUploader = ChunkUploader(UploadCoordinator.DEFAULT_HTTP_CLIENT, backoffMs = longArrayOf(1, 1, 1, 1, 1, 1), noProgressWindowMs = 5_000L),
        )
        coord.drainNow()

        val back = store.read()[0]
        assertEquals(UploadState.DEAD_LETTER, back.state)
        assertNotNull(back.deadLetterReason)
        assertTrue("emitQueueChanged fired so the Pending-Uploads UI shows chip-failed", queueChanged)
    }

    @Test
    fun `a DONE part is never re-PUT across drains (UP-04 — no whole-file restart)`() {
        store.enqueue(row("01JCOORDREC6XXXXXXXXXXXXXX"))
        // Pre-mark video part 1 DONE on disk (simulate a prior partial drain).
        val r = store.read()[0].also {
            it.uploadId = null // force /init this drain
            it.partsCount = 2
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"already-done\""))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
        }
        store.upsert(r)
        val coord = coordinator()
        coord.drainNow()

        // /init re-issues 2 part-URLs, but part 1 was already DONE → only part 2 + IMU get PUT.
        assertNull("DONE part 1 must not be re-PUT", putCalls["/s3/video/1"])
        assertEquals(1, putCalls["/s3/video/2"]?.get())
        assertEquals(1, putCalls["/s3/imu/1"]?.get())
        // finalize still carries part 1's cached etag.
        val fin = lastFinalizeBody.get()!!
        val p1 = fin.getJSONArray("videoParts").getJSONObject(0)
        assertEquals(1, p1.getInt("partNumber"))
        assertEquals("\"already-done\"", p1.getString("etag"))
    }

    @Test
    fun `drainNow is serialised - two concurrent drains, only one does the upload work (CR-03)`() {
        // The CR-03 defect: drainNow() is public + called off three threads (FGS
        // HandlerThread / UIDT-job Thread / drainExecutor) with no mutual exclusion
        // — two could run uploadOne(row) on the same row, re-POSTing /init, racing
        // the queue file, clobbering row.uploadId. The ReentrantLock.tryLock() fix:
        // a second concurrent drain returns immediately (no-op).
        store.enqueue(row("01JCOORDREC8XXXXXXXXXXXXXX"))
        // Park the first drain inside uploadOne for ~400 ms (the /recordings/init
        // response is delayed) so the second thread reliably arrives mid-drain.
        initHeadersDelayMs = 400L

        val coord = coordinator()
        val t2WallMs = java.util.concurrent.atomic.AtomicLong(Long.MAX_VALUE)
        val t1 = Thread { coord.drainNow() }
        val t2 = Thread {
            val start = System.nanoTime()
            coord.drainNow()
            t2WallMs.set((System.nanoTime() - start) / 1_000_000L)
        }
        t1.start()
        Thread.sleep(50) // let t1 get past tryLock() and into the parked /init
        t2.start()
        t1.join(5_000)
        t2.join(5_000)

        // Exactly ONE drain did the upload work — no double /init, no double /finalize.
        assertEquals("only one /recordings/init (the lock blocked the second drain)", 1, initCalls.get())
        assertEquals("only one /finalize", 1, finalizeCalls.get())
        // No part was PUT twice.
        assertEquals(1, putCalls["/s3/video/1"]?.get())
        assertEquals(1, putCalls["/s3/video/2"]?.get())
        assertEquals(1, putCalls["/s3/imu/1"]?.get())
        // The queue has exactly one row, in the expected post-drain state — no duplicate row.
        val back = store.read()
        assertEquals("one row, not duplicated", 1, back.size)
        assertEquals(UploadState.AWAITING_VERIFY, back[0].state)
        // The loser of the tryLock() returned promptly — well before the 400 ms /init delay.
        assertTrue("t2 lost the drainLock and returned promptly (was ${t2WallMs.get()}ms)", t2WallMs.get() < 300L)
    }

    // -------------------------------------------------------------------------
    // Plan 05-10 — re-drain uses POST /recordings/:id/parts (not re-/init);
    // row.reupload cleared right after postReupload; 409 from /parts and /init →
    // dead-letter; parseInitResponse doesn't leak presigned URLs on a non-JSON body.
    // -------------------------------------------------------------------------

    @Test
    fun `reDrain uses parts route not init - DONE part not re-PUT, uploadId unchanged (CR-01, UP-04)`() {
        // A row that has already been /init'd once (uploadId set) and has part 1 DONE.
        val recId = "01JCOORDRECAXXXXXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recId, mp4Bytes = 12_000_000) // ~12 MB → 2 parts at 8 MiB
        store.enqueue(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        val r = store.read()[0].also {
            it.uploadId = "VID-UPLOAD-ID"
            it.imuUploadId = "IMU-UPLOAD-ID"
            it.partsCount = 2
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.reupload = false
            it.state = UploadState.UPLOADING
            it.metadataPut = PartStatus.PENDING
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"etag-1\""))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
        }
        store.upsert(r)

        val coord = coordinator()
        coord.drainNow()

        // The re-drain hit /recordings/:id/parts — NOT /recordings/init.
        assertEquals("one /recordings/:id/parts", 1, partsCalls.get())
        assertEquals("no /recordings/init on a re-drain", 0, initCalls.get())
        // The /parts request body carried { partsCount, imuUploadId } matching the row.
        val pb = lastPartsBody.get()!!
        assertEquals(2, pb.getInt("partsCount"))
        assertEquals("IMU-UPLOAD-ID", pb.getString("imuUploadId"))
        // The DONE part 1 was not re-PUT; part 2 + IMU were.
        assertNull("DONE part 1 must not be re-PUT", putCalls["/s3/video/1"])
        assertEquals(1, putCalls["/s3/video/2"]?.get())
        assertEquals(1, putCalls["/s3/imu/1"]?.get())
        // /finalize carries part 1's cached etag + part 2's fresh etag, against the SAME upload ids.
        val fin = lastFinalizeBody.get()!!
        assertEquals(2, fin.getJSONArray("videoParts").length())
        assertEquals("\"etag-1\"", fin.getJSONArray("videoParts").getJSONObject(0).getString("etag"))
        assertTrue(fin.getJSONArray("videoParts").getJSONObject(1).getString("etag").startsWith("\"etag-"))
        assertEquals("IMU-UPLOAD-ID", fin.getString("imuUploadId"))
        // Row: uploadId unchanged, ends AWAITING_VERIFY.
        val back = store.read().first()
        assertEquals("VID-UPLOAD-ID", back.uploadId)
        assertEquals("IMU-UPLOAD-ID", back.imuUploadId)
        assertEquals(UploadState.AWAITING_VERIFY, back.state)
    }

    @Test
    fun `reupload drain clears the reupload flag then a re-drain uses parts not reupload (WARNING 4)`() {
        // First drain of a hash-mismatch re-upload — row.reupload = true, parts all PENDING
        // (mimicking the post-`reupload`-@ReactMethod state — Plan 05-08).
        val recId = "01JCOORDRECBXXXXXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recId, mp4Bytes = 5_000_000) // ~5 MB → 1 part at 8 MiB
        store.enqueue(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        store.upsert(
            store.read()[0].also {
                it.reupload = true
                it.uploadId = "old-vid"
                it.imuUploadId = "old-imu"
                it.partsCount = 1
                it.chunkBytes = WIFI_CHUNK_BYTES
                it.state = UploadState.PENDING
                it.videoParts.add(PartState(1))
                it.imuParts.add(PartState(1))
            },
        )

        val coord = coordinator()
        coord.drainNow()

        // First drain → /reupload (NOT /parts, NOT /init); after it the flag is cleared.
        assertEquals("one /reupload", 1, reuploadCalls.get())
        assertEquals("no /parts on the first re-upload drain", 0, partsCalls.get())
        assertEquals("no /init on the first re-upload drain", 0, initCalls.get())
        run {
            val back = store.read().first()
            assertEquals("reupload flag cleared right after postReupload", false, back.reupload)
            assertEquals("VID-UPLOAD-ID", back.uploadId) // the fresh /reupload id was persisted
            assertEquals(UploadState.AWAITING_VERIFY, back.state)
        }

        // Now simulate a mid-flight kill of a SECOND re-upload drain: a row with reupload=false,
        // uploadId set, parts DONE — the next drain must take the /parts branch, NOT /reupload.
        reuploadCalls.set(0); partsCalls.set(0); initCalls.set(0); finalizeCalls.set(0)
        putCalls.clear(); lastFinalizeBody.set(null)
        store.upsert(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
                state = UploadState.UPLOADING,
                uploadId = "new-vid", imuUploadId = "new-imu",
                partsCount = 1, chunkBytes = WIFI_CHUNK_BYTES,
                metadataPut = PartStatus.DONE,
                reupload = false,
                videoParts = mutableListOf(PartState(1, PartStatus.DONE, etag = "\"e-v\"")),
                imuParts = mutableListOf(PartState(1, PartStatus.DONE, etag = "\"e-i\"")),
            ),
        )
        coord.drainNow()

        assertEquals("re-drain of a process-killed re-upload uses /parts", 1, partsCalls.get())
        assertEquals("re-drain of a process-killed re-upload does NOT call /reupload again", 0, reuploadCalls.get())
        assertEquals(0, initCalls.get())
        // Nothing re-PUT — both parts are DONE.
        assertTrue("no part PUT (all DONE)", putCalls.keys.none { it.startsWith("/s3/video/") || it.startsWith("/s3/imu/") })
        val fin = lastFinalizeBody.get()!!
        assertEquals("\"e-v\"", fin.getJSONArray("videoParts").getJSONObject(0).getString("etag"))
        assertEquals("\"e-i\"", fin.getJSONArray("imuParts").getJSONObject(0).getString("etag"))
        assertEquals(UploadState.AWAITING_VERIFY, store.read().first().state)
    }

    @Test
    fun `a 409 from the parts route dead-letters the row, no infinite loop`() {
        partsResponseCode = 409
        val recId = "01JCOORDRECCXXXXXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recId, mp4Bytes = 12_000_000)
        store.enqueue(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        store.upsert(
            store.read()[0].also {
                it.uploadId = "VID-UPLOAD-ID"
                it.imuUploadId = "IMU-UPLOAD-ID"
                it.partsCount = 2
                it.chunkBytes = WIFI_CHUNK_BYTES
                it.reupload = false
                it.state = UploadState.UPLOADING
                it.videoParts.add(PartState(1))
                it.videoParts.add(PartState(2))
                it.imuParts.add(PartState(1))
            },
        )
        val coord = coordinator()
        coord.drainNow()
        assertEquals(UploadState.DEAD_LETTER, store.read().first().state)
        assertNotNull(store.read().first().deadLetterReason)
        // A second drain makes NO further requests — the DEAD_LETTER row is skipped.
        val before = server.requestCount
        coord.drainNow()
        assertEquals("no requests on a 2nd drain of a dead-lettered row", before, server.requestCount)
    }

    @Test
    fun `a 409 from the init route dead-letters the row, no infinite loop`() {
        initResponseCode = 409
        store.enqueue(row("01JCOORDRECDXXXXXXXXXXXXXXX")) // uploadId == null → first drain hits /init
        val coord = coordinator()
        coord.drainNow()
        assertEquals(UploadState.DEAD_LETTER, store.read().first().state)
        assertNotNull(store.read().first().deadLetterReason)
        val before = server.requestCount
        coord.drainNow()
        assertEquals("no requests on a 2nd drain of a dead-lettered row", before, server.requestCount)
    }

    @Test
    fun `a non-JSON parts response does not leak presigned URLs and is treated as transient`() {
        partsRawBody = "<html>oops https://s3.example/bucket/key?X-Amz-Signature=abc123&X-Amz-Credential=xyz</html>"
        val recId = "01JCOORDRECEXXXXXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recId, mp4Bytes = 12_000_000)
        store.enqueue(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        store.upsert(
            store.read()[0].also {
                it.uploadId = "VID-UPLOAD-ID"
                it.imuUploadId = "IMU-UPLOAD-ID"
                it.partsCount = 2
                it.chunkBytes = WIFI_CHUNK_BYTES
                it.reupload = false
                it.state = UploadState.UPLOADING
                it.videoParts.add(PartState(1))
                it.videoParts.add(PartState(2))
                it.imuParts.add(PartState(1))
            },
        )
        val coord = coordinator()
        coord.drainNow()
        // Transient — the row is NOT dead-lettered; it stays for the next drain.
        val back = store.read().first()
        assertTrue("non-JSON /parts body is a transient error, not a dead-letter", back.state != UploadState.DEAD_LETTER)
        assertNull("no dead-letter reason", back.deadLetterReason)

        // And the exception parseInitResponse throws carries ONLY the static label — no body content.
        // Call the same parser the coordinator uses, reflectively, with the leaky body.
        val m = UploadCoordinator::class.java.getDeclaredMethod("parseInitResponse", String::class.java, String::class.java)
        m.isAccessible = true
        val ex = try {
            m.invoke(coord, partsRawBody, "/recordings/:id/parts")
            null
        } catch (e: java.lang.reflect.InvocationTargetException) {
            e.targetException
        }
        assertNotNull("parseInitResponse must throw on a non-JSON body", ex)
        assertTrue("must be an IOException", ex is java.io.IOException)
        val msg = ex!!.message ?: ""
        assertEquals("/recordings/:id/parts response not valid JSON", msg)
        assertTrue("the message must not contain 'http'", !msg.contains("http"))
        assertTrue("the message must not contain 'X-Amz'", !msg.contains("X-Amz"))
        assertTrue("the message must not contain '<html'", !msg.contains("<html"))
    }

    @Test
    fun `cellular network makes init request 5 MiB-chunk partsCount`() {
        attachCaps(NetworkCapabilities.TRANSPORT_CELLULAR) // cellular only → 5 MiB chunks
        // ~12 MB video at 5 MiB chunks → 3 parts.
        val recordingId = "01JCOORDREC7XXXXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recordingId, mp4Bytes = 12_000_000)
        store.enqueue(
            UploadRow(
                recordingId = recordingId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        val coord = coordinator()
        coord.drainNow()

        // 12_000_000 / (5*1024*1024=5_242_880) = ceil(2.29) = 3 parts.
        assertEquals(3, putCalls.keys.count { it.startsWith("/s3/video/") })
        assertEquals(CELLULAR_CHUNK_BYTES, store.read()[0].chunkBytes)
        assertEquals(3, store.read()[0].partsCount)
    }

    @Test
    fun `every API POST carries its OWN per-route Idempotency-Key UUIDv4 (init+finalize on the first drain)`() {
        // Regression for the 'POST /recordings/init -> 400 Idempotency-Key required'
        // gate that blocked the Phase-5 on-device UAT walk three times. Every
        // POST/PATCH must carry an Idempotency-Key header that the server's
        // UUID_V4_REGEX accepts (apps/api/src/lib/idempotency-store.ts), and
        // each route uses its OWN per-route key (Wave-1.5 Item 1 — single per-row
        // key + 4 different bodies = 409 idempotency-key-conflict on the 2nd
        // route; the 2026-05-13 walk's recording `01KRFZ91Y3E315AJVG75KXJZE6`
        // showed `/init` → 201 then `/finalize` → 409 because both used the same
        // key with different bodies).
        val r = row("01JCOORDIDEM1XXXXXXXXXXXXXX")
        val expectedInitKey = r.initIdempotencyKey
        val expectedFinalizeKey = r.finalizeIdempotencyKey
        store.enqueue(r)
        coordinator().drainNow()

        // /init + /finalize fired on this happy path; /parts and /reupload didn't.
        val uuidV4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        val initKey = idempotencyKeysByPath["/recordings/init"]
        assertNotNull("/recordings/init must send an Idempotency-Key header (server's pre-handler 400s without it)", initKey)
        assertTrue("/recordings/init Idempotency-Key must be a UUIDv4; got $initKey", uuidV4.matches(initKey!!))
        assertEquals("/recordings/init key must equal the row's initIdempotencyKey", expectedInitKey, initKey)

        val finalizeKey = idempotencyKeysByPath["/finalize"]
        assertNotNull("/finalize must send an Idempotency-Key header", finalizeKey)
        assertTrue("/finalize Idempotency-Key must be a UUIDv4; got $finalizeKey", uuidV4.matches(finalizeKey!!))
        assertEquals("/finalize key must equal the row's finalizeIdempotencyKey", expectedFinalizeKey, finalizeKey)

        // Cross-route distinctness — the bug being closed.
        assertNotEquals("init and finalize keys MUST be distinct (Wave-1.5 Item 1)", initKey, finalizeKey)
    }

    @Test
    fun `a re-drain via slash parts uses the row's partsIdempotencyKey (distinct from init)`() {
        // Same row, two drains. First drain: /init has uploadId=null → /init.
        // Second drain after a process-kill simulation (uploadId set): /parts.
        // Each route carries ITS OWN stable per-route key (Wave-1.5 Item 1 —
        // the server caches by (user_id, key) + hashes (method,path,body); a
        // single per-row key reused across routes hits a 409).
        val r = row("01JCOORDIDEM2XXXXXXXXXXXXXX").also {
            it.uploadId = "VID-UPLOAD-ID"
            it.imuUploadId = "IMU-UPLOAD-ID"
            // Pin partsCount so partsCountFor doesn't recompute against the file
            // size (we just need the re-drain to take the /parts branch).
            it.partsCount = 2
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"e1\""))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
        }
        val expectedPartsKey = r.partsIdempotencyKey
        val expectedInitKey = r.initIdempotencyKey
        store.enqueue(r)
        coordinator().drainNow()

        assertEquals("re-drain takes /parts, not /init", 0, initCalls.get())
        val partsKey = idempotencyKeysByPath["/parts"]
        assertNotNull("/parts must send an Idempotency-Key header", partsKey)
        assertEquals("/parts key must equal the row's partsIdempotencyKey", expectedPartsKey, partsKey)
        assertNotEquals(
            "/parts key MUST differ from the row's initIdempotencyKey (per-route split, Wave-1.5 Item 1)",
            expectedInitKey, partsKey,
        )
    }

    @Test
    fun `each route's Idempotency-Key is stable across a synthetic retry of the same route`() {
        // Drive a row through /init, then capture the key; clear the captured key,
        // drive ANOTHER drain that takes the /parts branch (re-presign — same row,
        // different route); confirm /init's would-have-been retry key is stable in
        // the row (since /init isn't called again, we assert via the row's pinned
        // field — the contract is "the SAME UUIDv4 the row was constructed with").
        val r = row("01JCOORDIDEM3XXXXXXXXXXXXXX")
        val initKeyAtConstruction = r.initIdempotencyKey
        val partsKeyAtConstruction = r.partsIdempotencyKey
        store.enqueue(r)
        val coord = coordinator()
        coord.drainNow()
        // First drain captured.
        val firstInitKey = idempotencyKeysByPath["/recordings/init"]
        assertEquals("first /init carries the row's initIdempotencyKey", initKeyAtConstruction, firstInitKey)
        // The row, now on disk after the first drain, still has the same per-route keys
        // (toJson/fromJson round-trip preserves them — Wave-1.5 Item 1).
        val rowOnDisk = store.read().first()
        assertEquals("initIdempotencyKey survives the round-trip through queue.json", initKeyAtConstruction, rowOnDisk.initIdempotencyKey)
        assertEquals("partsIdempotencyKey survives the round-trip through queue.json", partsKeyAtConstruction, rowOnDisk.partsIdempotencyKey)
    }

    @Test
    fun `LOCAL reset of a client-side DEAD_LETTER row routes to slash parts not slash reupload Wave-1-5 Item 2`() {
        // Wave-1.5 Item 2: HumynUpload.reupload(recordingId) on a row with
        // state=DEAD_LETTER && uploadId!=null && !reupload does a LOCAL reset
        // (state→UPLOADING, deadLetterReason=null, KEEP uploadId/imuUploadId/
        // parts/etags). The drainer then takes the postRePresign branch (/parts),
        // NOT /reupload (which would 409 — the server's reupload.ts:125-138
        // requires qa_status='hash-mismatch'). We assert the drain OUTCOME of a
        // row in the post-LOCAL-reset state — that's the contract the
        // HumynUploadModule branching produces.
        val recId = "01JLOCALRESET01XXXXXXXXXXXX"
        val (mp4, csv, json) = writeBundle(recId, mp4Bytes = 12_000_000) // ~12 MB → 2 parts
        store.enqueue(
            UploadRow(
                recordingId = recId, ownerUserId = "userA",
                mp4Path = mp4.path, csvPath = csv.path, jsonPath = json.path,
                taskId = "T".repeat(26), isPractice = false,
            ),
        )
        // Post-LOCAL-reset state: state=UPLOADING (was DEAD_LETTER), uploadId
        // preserved, parts preserved with their ETags, metadataPut=DONE
        // preserved, reupload=false, deadLetterReason=null.
        store.upsert(
            store.read()[0].also {
                it.uploadId = "VID-UPLOAD-ID"
                it.imuUploadId = "IMU-UPLOAD-ID"
                it.partsCount = 2
                it.chunkBytes = WIFI_CHUNK_BYTES
                it.reupload = false
                it.state = UploadState.UPLOADING
                it.deadLetterReason = null
                it.metadataPut = PartStatus.DONE
                it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"etag-vid-1\""))
                it.videoParts.add(PartState(2, PartStatus.DONE, etag = "\"etag-vid-2\""))
                it.imuParts.add(PartState(1, PartStatus.DONE, etag = "\"etag-imu-1\""))
            },
        )
        val coord = coordinator()
        coord.drainNow()

        // The post-LOCAL-reset drain hit /parts (re-presign), NOT /reupload (no full reset).
        assertEquals("LOCAL-reset drain takes /parts", 1, partsCalls.get())
        assertEquals("LOCAL-reset drain does NOT call /reupload", 0, reuploadCalls.get())
        assertEquals("LOCAL-reset drain does NOT call /init", 0, initCalls.get())
        // The /parts Idempotency-Key is the row's partsIdempotencyKey (Wave-1.5 Item 1).
        val rowAfterUpsert = store.read().first()
        val partsKey = idempotencyKeysByPath["/parts"]
        assertNotNull("/parts must send an Idempotency-Key", partsKey)
        assertEquals("/parts uses partsIdempotencyKey", rowAfterUpsert.partsIdempotencyKey, partsKey)
        // No part was re-PUT — all were DONE before; the re-presign just re-issues fresh URLs.
        assertTrue("no part PUT (all DONE)", putCalls.keys.none { it.startsWith("/s3/video/") || it.startsWith("/s3/imu/") })
        // /finalize fired with the original ETags preserved (UP-04 guarantee).
        val fin = lastFinalizeBody.get()!!
        assertEquals("\"etag-vid-1\"", fin.getJSONArray("videoParts").getJSONObject(0).getString("etag"))
        assertEquals("\"etag-vid-2\"", fin.getJSONArray("videoParts").getJSONObject(1).getString("etag"))
        assertEquals("\"etag-imu-1\"", fin.getJSONArray("imuParts").getJSONObject(0).getString("etag"))
        // Row ends AWAITING_VERIFY; uploadId preserved across the drain.
        val back = store.read().first()
        assertEquals(UploadState.AWAITING_VERIFY, back.state)
        assertEquals("VID-UPLOAD-ID", back.uploadId)
        assertEquals("IMU-UPLOAD-ID", back.imuUploadId)
    }

    @Test
    fun `Wave-2 #5 - a transient on slash init triggers the bounded in-loop retry then succeeds`() {
        // First /recordings/init returns 503 (transient — parseInitResponse
        // throws IOException; not a 4xx DeadLetterException). The drainer's
        // per-row retry loop (Wave-2 #5) sleeps transientRetryDelayMs (1 ms in
        // tests) and re-attempts uploadOne, which re-POSTs /init. Second call
        // returns the normal 201 → happy-path /finalize → row ends
        // AWAITING_VERIFY. Without the retry loop the row would sit
        // PENDING/UPLOADING forever and the test would see only 1 /init and 0
        // /finalize.
        flakyInitCount.set(1)
        store.enqueue(row("01JRETRYW25XXXXXXXXXXXXXXX"))
        coordinator().drainNow()

        assertEquals("two /init calls (flaky 503 then retried 201)", 2, initCalls.get())
        assertEquals("zero /reupload", 0, reuploadCalls.get())
        assertEquals("one /finalize after the retry succeeds", 1, finalizeCalls.get())
        // Row reached AWAITING_VERIFY — proof the retry took the happy path.
        assertEquals(UploadState.AWAITING_VERIFY, store.read().first().state)
    }

    @Test
    fun `Wave-2 #5 - exhausting the retry budget leaves the row recoverable, does NOT dead-letter`() {
        // 3 /init attempts all return 503. The retry loop exits without
        // calling /finalize. The row STAYS in its pre-attempt state (uploadId
        // == null, state == PENDING) so the next external drain trigger (cold
        // start, JWT change, FGS heartbeat, UIDT JobService, tile-tap kick)
        // picks it up. Critically, transient exhaustion is NOT a dead-letter
        // event — only DeadLetterException (a 4xx contract violation) is.
        flakyInitCount.set(3)
        store.enqueue(row("01JRETRYW25EXHXXXXXXXXXXXXX"))
        coordinator().drainNow()

        assertEquals("three /init attempts (the retry budget)", 3, initCalls.get())
        assertEquals("no /finalize fired", 0, finalizeCalls.get())
        val back = store.read().first()
        assertTrue("row is recoverable, NOT dead-lettered", back.state != UploadState.DEAD_LETTER)
        assertNull("no dead-letter reason on transient exhaustion", back.deadLetterReason)
    }

    @Test
    fun `Wave-2 #7 - happy-path drain emits onQueueChanged on UPLOADING and FINALIZING transitions`() {
        // Wave-2 #7 regression: without an emitQueueChanged() right after
        // row.state = UPLOADING / FINALIZING, the JS snapshot stayed pinned on
        // `pending` (or `uploading`) and the Pending-Uploads tile's determinate
        // progress bar — gated by `isActive = state === 'uploading'` and the
        // chip's `Uploading… N%` label — never rendered. We assert by capturing
        // the row state at each emit: the snapshot sequence MUST include both
        // `uploading` and `finalizing` (in that order) before the final
        // `awaiting-verify` emit.
        val recId = "01JEMITQCHGW27XXXXXXXXXXXXX"
        store.enqueue(row(recId))
        val seen = java.util.Collections.synchronizedList(mutableListOf<UploadState>())
        val monitor = NetworkMonitor(app) {}
        val coord = UploadCoordinator(
            queueStore = store,
            networkMonitor = monitor,
            emitProgress = { _, _, _ -> },
            emitQueueChanged = {
                // Snapshot the row's state at emit time so we can assert the
                // sequence (not just the count — the bug was a missing emit
                // tied to specific state transitions, so the test must pin
                // those exact transitions, not just any emit at any state).
                store.read().firstOrNull { it.recordingId == recId }?.let { seen.add(it.state) }
            },
            getApiBaseUrl = { base() },
            getBearerToken = { "test-jwt" },
            getCurrentSub = { "userA" },
            isPaused = { false },
            chunkUploader = ChunkUploader(UploadCoordinator.DEFAULT_HTTP_CLIENT, backoffMs = longArrayOf(1, 1, 1, 1, 1, 1), noProgressWindowMs = 5_000L),
        )
        coord.drainNow()

        // The captured snapshot states must include the two transitions Wave-2
        // #7 hinges on, in order, before the terminal AWAITING_VERIFY emit.
        val uploadingIdx = seen.indexOf(UploadState.UPLOADING)
        val finalizingIdx = seen.indexOf(UploadState.FINALIZING)
        val awaitingIdx = seen.indexOf(UploadState.AWAITING_VERIFY)
        assertTrue("emitQueueChanged fired with state=UPLOADING (so JS flips isActive=true and renders the progress bar). Seen: $seen", uploadingIdx >= 0)
        assertTrue("emitQueueChanged fired with state=FINALIZING (so the bar drops cleanly before AWAITING_VERIFY). Seen: $seen", finalizingIdx >= 0)
        assertTrue("emitQueueChanged fired with state=AWAITING_VERIFY (the row's terminal in-queue state). Seen: $seen", awaitingIdx >= 0)
        assertTrue("UPLOADING emit comes before FINALIZING. Seen: $seen", uploadingIdx < finalizingIdx)
        assertTrue("FINALIZING emit comes before AWAITING_VERIFY. Seen: $seen", finalizingIdx < awaitingIdx)
    }

    @Test
    fun `four distinct keys across init parts finalize reupload (no cross-route reuse)`() {
        // Drive a row through /init → /finalize (Wave 1 happy path) and a separate
        // row through /reupload → /finalize (Wave 1 hash-mismatch path) and a
        // third row through a re-drain → /parts. Across the three rows, capture
        // the four route-keyed Idempotency-Keys and assert all 4 captured values
        // are distinct UUIDv4s and are uniquely matched to ONE route each.
        val uuidV4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

        // 1. /init + /finalize via a fresh row (Wave 1 happy path).
        val r1 = row("01JCOORDIDEM4XXXXXXXXXXXXXX")
        store.enqueue(r1)
        coordinator().drainNow()
        val initKey = idempotencyKeysByPath["/recordings/init"]
        // /finalize captured here; we'll re-capture below for the reupload row to assert distinctness.
        val finalizeKey1 = idempotencyKeysByPath["/finalize"]

        // 2. Re-drain a separate row to drive /parts.
        idempotencyKeysByPath.clear()
        val r2 = row("01JCOORDIDEM5XXXXXXXXXXXXXX").also {
            it.uploadId = "VID-UPLOAD-ID"
            it.imuUploadId = "IMU-UPLOAD-ID"
            it.partsCount = 2
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"e1\""))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
        }
        store.enqueue(r2)
        coordinator().drainNow()
        val partsKey = idempotencyKeysByPath["/parts"]

        // 3. Re-upload a third row to drive /reupload.
        idempotencyKeysByPath.clear()
        val r3 = row("01JCOORDIDEM6XXXXXXXXXXXXXX").also {
            it.reupload = true
            it.uploadId = "old-vid"
            it.imuUploadId = "old-imu"
            it.partsCount = 1
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.state = UploadState.PENDING
            it.videoParts.add(PartState(1))
            it.imuParts.add(PartState(1))
        }
        store.enqueue(r3)
        coordinator().drainNow()
        val reuploadKey = idempotencyKeysByPath["/reupload"]
        val finalizeKey3 = idempotencyKeysByPath["/finalize"]

        // All four captured keys are present + UUIDv4-shaped.
        assertNotNull("/init key captured", initKey)
        assertNotNull("/parts key captured", partsKey)
        assertNotNull("/finalize key captured (from row 1 OR 3)", finalizeKey1 ?: finalizeKey3)
        assertNotNull("/reupload key captured", reuploadKey)
        listOf(initKey, partsKey, finalizeKey1, reuploadKey).forEach {
            if (it != null) assertTrue("UUIDv4 shape: $it", uuidV4.matches(it))
        }
        // Cross-route distinctness — no two routes use the same captured key.
        val captured = listOfNotNull(initKey, partsKey, finalizeKey1, reuploadKey)
        assertEquals("four distinct keys across the four routes", captured.size, captured.toSet().size)
        // And specifically: every row was constructed with 4 distinct keys.
        listOf(r1, r2, r3).forEach { r ->
            val perRow = setOf(r.initIdempotencyKey, r.partsIdempotencyKey, r.finalizeIdempotencyKey, r.reuploadIdempotencyKey)
            assertEquals("row ${r.recordingId} has 4 distinct per-route keys", 4, perRow.size)
        }
    }

    // =========================================================================
    // Debug session `.planning/debug/upload-queue-hol-finalizing.md` Fix C —
    // four new behaviors layered on top of the Plan-05-06 drainer.
    // =========================================================================

    @Test
    fun `Fix C item 3 — FINALIZING row reconciles when server qa_status is verified, no re-finalize POST`() {
        // Set up a row that's already in FINALIZING with a known uploadId (i.e. a
        // process-killed mid-finalize OR a stuck post-/finalize-hang row). The
        // GET /recordings/:id endpoint will say `qa_status=verified` — the
        // coordinator should mark the row AWAITING_VERIFY locally and skip the
        // re-POST entirely.
        val rec = "01JCOORDREC10XXXXXXXXXXXXX"
        val stuckRow = row(rec).apply {
            state = UploadState.FINALIZING
            uploadId = "VID-UPLOAD-ID"
            imuUploadId = "IMU-UPLOAD-ID"
            partsCount = 2
            chunkBytes = WIFI_CHUNK_BYTES
            videoParts.addAll((1..2).map { PartState(it, PartStatus.DONE, etag = "etag-${'$'}it") })
            imuParts.add(PartState(1, PartStatus.DONE, etag = "imu-etag"))
            metadataPut = PartStatus.DONE
        }
        store.upsert(stuckRow)
        qaStatusFor = { id -> if (id == rec) "verified" else null }

        val coord = coordinator()
        coord.drainNow()

        // GET fired once; no /finalize POST; row moved to AWAITING_VERIFY.
        assertEquals("one GET /recordings/:id", 1, getRecordingCalls.get())
        assertEquals("zero /finalize", 0, finalizeCalls.get())
        val back = store.read().first { it.recordingId == rec }
        assertEquals(UploadState.AWAITING_VERIFY, back.state)
    }

    @Test
    fun `Fix C item 3 — FINALIZING row falls through to re-finalize when server qa_status is still pending`() {
        // Same setup as above but the GET reports `qa_status=pending` — the
        // coordinator should fall through to the normal re-finalize path
        // (sending a fresh /finalize POST).
        val rec = "01JCOORDREC11XXXXXXXXXXXXX"
        val stuckRow = row(rec).apply {
            state = UploadState.FINALIZING
            uploadId = "VID-UPLOAD-ID"
            imuUploadId = "IMU-UPLOAD-ID"
            partsCount = 2
            chunkBytes = WIFI_CHUNK_BYTES
            videoParts.addAll((1..2).map { PartState(it, PartStatus.DONE, etag = "etag-${'$'}it") })
            imuParts.add(PartState(1, PartStatus.DONE, etag = "imu-etag"))
            metadataPut = PartStatus.DONE
        }
        store.upsert(stuckRow)
        qaStatusFor = { id -> if (id == rec) "pending" else null }

        val coord = coordinator()
        coord.drainNow()

        // GET fired, then re-finalize POSTed.
        assertEquals(1, getRecordingCalls.get())
        assertEquals(1, finalizeCalls.get())
        // Row moved through FINALIZING → AWAITING_VERIFY (the re-finalize succeeded).
        val back = store.read().first { it.recordingId == rec }
        assertEquals(UploadState.AWAITING_VERIFY, back.state)
    }

    @Test
    fun `Fix C item 2 — finalize watchdog fires on a hung server, surfaces as transient`() {
        // /finalize parks 5s past the watchdog window (500 ms). The OkHttp
        // per-call timeout should fire, the call surfaces as IOException, the
        // bounded transient-retry loop fires (3 attempts × 1 ms retry sleep),
        // then the row is left in FINALIZING for the next drain tick. Without
        // the watchdog this would hang for the test duration (or forever).
        val rec = "01JCOORDREC12XXXXXXXXXXXXX"
        store.enqueue(row(rec))
        finalizeHangCount.set(99) // every /finalize parks
        finalizeHangMs = 5_000L // long past the 500ms watchdog
        // Test seam: GET returns null (404) so the reconciliation path doesn't
        // short-circuit; we want the /finalize POST to actually fire + hang.
        qaStatusFor = { _ -> null }

        val coord = coordinator(finalizeCallTimeoutMs = 500L)
        // Note: this MUST return within reason — the test would hang here if
        // the watchdog didn't work. The transient-retry loop tries 3 times.
        val startMs = System.currentTimeMillis()
        coord.drainNow()
        val elapsedMs = System.currentTimeMillis() - startMs

        // /finalize was attempted (3 transient retries → 3 hangs at 500 ms each
        // ≈ 1500–2500 ms total elapsed). MUST be much less than 3 × 5 s = 15s.
        assertTrue("drain returned within reasonable time (was ${'$'}elapsedMs ms)", elapsedMs < 10_000L)
        assertTrue("at least one /finalize POST attempted", finalizeCalls.get() >= 1)
        // Row stayed FINALIZING (not VERIFIED, not DEAD_LETTER) — the watchdog
        // surfaced as transient, the next drain will retry.
        val back = store.read().first { it.recordingId == rec }
        assertEquals(UploadState.FINALIZING, back.state)
    }

    @Test
    fun `Fix C item 4 — repeated transient failures transition row to NEEDS_ATTENTION`() {
        // /finalize parks past the watchdog every time, so every drain tick
        // exhausts the 3-retry budget + lands a failure. With
        // needsAttentionThreshold = 2, two such ticks transition the row.
        val rec = "01JCOORDREC13XXXXXXXXXXXXX"
        store.enqueue(row(rec))
        finalizeHangCount.set(99)
        finalizeHangMs = 5_000L
        qaStatusFor = { _ -> null }

        val coord = coordinator(finalizeCallTimeoutMs = 200L, needsAttentionThreshold = 2)
        // First tick — attemptCount=1; no NEEDS_ATTENTION yet.
        coord.drainNow()
        var back = store.read().first { it.recordingId == rec }
        assertEquals("first tick: still FINALIZING with attemptCount=1", UploadState.FINALIZING, back.state)
        assertEquals(1, back.attemptCount)
        // The backoff schedule says wait 30s before the next attempt. We can't
        // wait, so reach into the row and pull `lastFailureAt` back so the
        // second drain picks up immediately.
        back.lastFailureAt = 0L
        store.upsert(back)

        // Second tick — attemptCount=2, threshold reached, NEEDS_ATTENTION lands.
        coord.drainNow()
        back = store.read().first { it.recordingId == rec }
        assertEquals(UploadState.NEEDS_ATTENTION, back.state)
        assertTrue(back.attemptCount >= 2)
        assertNotNull("lastFailureState recorded", back.lastFailureState)
    }

    @Test
    fun `Fix C item 4 — retryNeedsAttention resets state and counter`() {
        // Set up a NEEDS_ATTENTION row by hand (the previous test exercises the
        // transition path).
        val rec = "01JCOORDREC14XXXXXXXXXXXXX"
        val pre = row(rec).apply {
            state = UploadState.NEEDS_ATTENTION
            uploadId = "VID-UPLOAD-ID"
            imuUploadId = "IMU-UPLOAD-ID"
            partsCount = 2
            chunkBytes = WIFI_CHUNK_BYTES
            videoParts.addAll((1..2).map { PartState(it, PartStatus.DONE, etag = "etag-${'$'}it") })
            imuParts.add(PartState(1, PartStatus.DONE, etag = "imu-etag"))
            metadataPut = PartStatus.DONE
            attemptCount = 6
            lastFailureAt = System.currentTimeMillis() - 1000L
            lastFailureState = "FINALIZING"
            lastFailureReason = "finalize timed out after 60s"
        }
        store.upsert(pre)

        val coord = coordinator()
        val ok = coord.retryNeedsAttention(rec)
        assertTrue("retry transitioned the row", ok)

        val back = store.read().first { it.recordingId == rec }
        // The row was reset: state is UPLOADING (because uploadId is set, the
        // worker takes the /parts re-presign branch on the next tick), counter
        // is zero, failure markers cleared.
        // (After drainNow runs, the row may have advanced further — but the
        // pre-drain assertion is captured above by the synchronous transition.)
        // The retry kicks drainNow(), so when we look the row may have already
        // moved through UPLOADING → FINALIZING → AWAITING_VERIFY. We just check
        // the failure markers are gone.
        assertEquals(0, back.attemptCount)
        assertNull(back.lastFailureState)
        assertNull(back.lastFailureReason)
        assertNotEquals(UploadState.NEEDS_ATTENTION, back.state)
    }

    @Test
    fun `Fix C item 4 — retryNeedsAttention is a no-op for non-NEEDS_ATTENTION rows`() {
        val rec = "01JCOORDREC15XXXXXXXXXXXXX"
        // A row in UPLOADING — must NOT be mutated by retryNeedsAttention.
        val pre = row(rec).apply { state = UploadState.UPLOADING }
        store.upsert(pre)

        val coord = coordinator()
        val ok = coord.retryNeedsAttention(rec)
        assertEquals("retry refused to mutate a non-NEEDS_ATTENTION row", false, ok)
        val back = store.read().first { it.recordingId == rec }
        assertEquals(UploadState.UPLOADING, back.state)
    }

    @Test
    fun `Fix C item 1 — drainNow with parallelism=2 dispatches two rows concurrently`() {
        // Two rows in PENDING; the worker pool runs both in parallel. We can't
        // easily assert wall-clock overlap on Robolectric (no real network
        // delay), but we CAN assert that BOTH rows progressed to AWAITING_VERIFY
        // after a single drainNow() — which proves the loop visited both and
        // each ran end-to-end without a head-of-line lock.
        store.enqueue(row("01JCOORDREC16AXXXXXXXXXXXX"))
        store.enqueue(row("01JCOORDREC16BXXXXXXXXXXXX"))
        qaStatusFor = { _ -> null }

        val coord = coordinator(parallelismCap = 2)
        coord.drainNow()

        val all = store.read()
        assertEquals(2, all.size)
        all.forEach { r ->
            assertEquals("row ${'$'}{r.recordingId} drained end-to-end", UploadState.AWAITING_VERIFY, r.state)
        }
        // Two /init + two /finalize POSTs — both rows got the full Pattern-1 flow.
        assertEquals(2, initCalls.get())
        assertEquals(2, finalizeCalls.get())
    }

}
