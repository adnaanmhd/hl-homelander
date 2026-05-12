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
    private val finalizeCalls = AtomicInteger(0)
    private val putCalls = ConcurrentHashMap<String, AtomicInteger>() // path → count
    private val lastFinalizeBody = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
    @Volatile private var failAllPuts = false

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
                        val partsCount = JSONObject(request.body.readUtf8()).getInt("partsCount")
                        MockResponse().setResponseCode(201).setBody(initBody(partsCount))
                    }
                    path.endsWith("/reupload") -> {
                        reuploadCalls.incrementAndGet()
                        val partsCount = JSONObject(request.body.readUtf8()).getInt("partsCount")
                        MockResponse().setResponseCode(200).setBody(initBody(partsCount))
                    }
                    path.endsWith("/finalize") -> {
                        finalizeCalls.incrementAndGet()
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
    private fun initBody(partsCount: Int): String {
        fun urls(prefix: String) = JSONArray().apply {
            (1..partsCount).forEach { n ->
                put(JSONObject().put("partNumber", n).put("url", server.url("/s3/$prefix/$n").toString()))
            }
        }
        return JSONObject().apply {
            put("recordingId", "x")
            put("uploadId", "VID-UPLOAD-ID")
            put("imuUploadId", "IMU-UPLOAD-ID")
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
}
