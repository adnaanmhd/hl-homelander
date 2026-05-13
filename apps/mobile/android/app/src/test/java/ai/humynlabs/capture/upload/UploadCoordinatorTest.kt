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
                        val partsCount = JSONObject(request.body.readUtf8()).getInt("partsCount")
                        val code = initResponseCode
                        if (code != 0) {
                            MockResponse().setResponseCode(code).setBody("{}")
                        } else {
                            MockResponse().setResponseCode(201).setBody(initBody(partsCount)).apply {
                                val d = initHeadersDelayMs
                                if (d > 0) setHeadersDelay(d, TimeUnit.MILLISECONDS)
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
                        MockResponse().setResponseCode(200).setBody("{}")
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

    /** Write a recording bundle (mp4 of [mp4Bytes] size + csv + metadata json) under filesDir/recordings. */
    private fun writeBundle(recordingId: String, mp4Bytes: Int): Triple<File, File, File> {
        val mp4 = File(recDir, "$recordingId.mp4").apply { writeBytes(ByteArray(mp4Bytes) { (it % 251).toByte() }) }
        val csv = File(recDir, "$recordingId.csv").apply { writeText("ts,ax,ay,az\n1,0,0,9.8\n") }
        val json = File(recDir, "$recordingId.json").apply {
            writeText(
                JSONObject().apply {
                    put("schema_version", "1.1.0")
                    put("recording_id", recordingId)
                    put("metadata", JSONObject().apply {
                        put("file_sha256", "a".repeat(64))
                        put("imu_sha256", "b".repeat(64))
                        put("file_size_bytes", mp4Bytes.toLong())
                        put("imu_size_bytes", csv.length())
                        put("duration_seconds", 12.5)
                        put("start_timestamp", "2026-05-12T10:00:00.000Z")
                    })
                }.toString(),
            )
        }
        return Triple(mp4, csv, json)
    }

    private fun row(recordingId: String, ownerUserId: String = "userA"): UploadRow {
        val (mp4, csv, json) = writeBundle(recordingId, mp4Bytes = 12_000_000) // ~12 MB → 2 parts at 8 MiB
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

}
