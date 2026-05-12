package ai.humynlabs.capture.upload

import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Plan 05-06 Task 1 — `ChunkUploader` (streaming PUT-per-part + ETag capture +
 * the `2/4/8/16/32/64 s` retry/backoff → [DeadLetterException] + the 30 s
 * no-progress watchdog + the no-re-PUT-of-a-DONE-part rule).
 *
 * Uses OkHttp's `MockWebServer` to stand in for S3's presigned-PUT endpoint.
 * Backoff delays + the watchdog window are injected SHORT so the suite runs
 * fast (no real 2/4/8 s sleeps).
 *
 * This is a plain JVM test (no Robolectric — `ChunkUploader` touches no Android
 * framework classes; `MssSocketFactory`'s `android.system.*` calls are only
 * reached on a live socket, never in these tests since the shared `OkHttpClient`
 * here uses the default socket factory).
 */
class ChunkUploaderRetryTest {

    private lateinit var server: MockWebServer
    private lateinit var partFile: File
    private lateinit var client: OkHttpClient

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        // A small "part" file — the rangedBody streams its bytes as the PUT body.
        partFile = File.createTempFile("humyn-part", ".bin").apply {
            writeBytes(ByteArray(4096) { (it % 251).toByte() })
            deleteOnExit()
        }
        client = OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            // Production uses callTimeout(0) and lets the no-progress watchdog
            // own stall-handling. The test mirrors that, but adds a generous
            // 10 s callTimeout backstop so a watchdog regression can't hang the
            // whole suite indefinitely — 10 s is far longer than any test's
            // injected no-progress window (≤ 250 ms), so a working watchdog
            // always fires first.
            .callTimeout(10, TimeUnit.SECONDS)
            .build()
    }

    @After
    fun tearDown() {
        runCatching { server.shutdown() }
        partFile.delete()
    }

    /** Fast backoff (2 ms steps) so the 6-retry path doesn't take 2 minutes. */
    private fun fastUploader(noProgressWindowMs: Long = 30_000L) = ChunkUploader(
        baseClient = client,
        backoffMs = longArrayOf(2, 2, 2, 2, 2, 2),
        noProgressWindowMs = noProgressWindowMs,
    )

    @Test
    fun `putPart returns the ETag on a 2xx`() {
        server.enqueue(MockResponse().setResponseCode(200).addHeader("ETag", "\"deadbeef\""))
        val etag = fastUploader().putPart(server.url("/part1").toString(), partFile, 0, partFile.length())
        assertEquals("\"deadbeef\"", etag)
        // The body it streamed must be the file's bytes (T-5-06-04: streamed, not buffered whole).
        val recorded = server.takeRequest()
        assertEquals("PUT", recorded.method)
        assertEquals(partFile.length(), recorded.bodySize)
    }

    @Test
    fun `putPart retries 6 times then succeeds on the 7th`() {
        repeat(6) { server.enqueue(MockResponse().setResponseCode(500)) }
        server.enqueue(MockResponse().setResponseCode(200).addHeader("ETag", "\"ok\""))
        val etag = fastUploader().putPart(server.url("/p").toString(), partFile, 0, partFile.length())
        assertEquals("\"ok\"", etag)
        assertEquals("7 requests = 1 initial + 6 retries", 7, server.requestCount)
    }

    @Test
    fun `putPart throws DeadLetterException after 7 failures`() {
        repeat(7) { server.enqueue(MockResponse().setResponseCode(503)) }
        val ex = assertThrows(DeadLetterException::class.java) {
            fastUploader().putPart(server.url("/p").toString(), partFile, 0, partFile.length())
        }
        assertTrue(ex.message!!.contains("after 6 retries"))
        assertEquals("7 requests = 1 initial + 6 retries", 7, server.requestCount)
    }

    @Test
    fun `putPart throws if a 2xx response carries no ETag`() {
        // No ETag header → IOException → retried → after 7 → DeadLetterException.
        repeat(7) { server.enqueue(MockResponse().setResponseCode(200)) }
        assertThrows(DeadLetterException::class.java) {
            fastUploader().putPart(server.url("/p").toString(), partFile, 0, partFile.length())
        }
    }

    @Test
    fun `watchdog cancels a stalled Call and the next retry uses a fresh Call`() {
        // First response: stall — never send the response headers (the connection
        // is accepted, the request body is read, then nothing). The 250 ms
        // no-progress watchdog fires → Call cancelled → IOException → retry.
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
        // Second response: a clean 200 with an ETag — the fresh-socket retry.
        server.enqueue(MockResponse().setResponseCode(200).addHeader("ETag", "\"fresh\""))
        val etag = fastUploader(noProgressWindowMs = 250L)
            .putPart(server.url("/p").toString(), partFile, 0, partFile.length())
        assertEquals("\"fresh\"", etag)
        assertTrue("at least 2 requests — the stalled one + the fresh retry", server.requestCount >= 2)
    }

    @Test
    fun `uploadPart returns the cached etag for a DONE part without a new request`() {
        val parts = mutableListOf(PartState(1, PartStatus.DONE, etag = "\"cached\""))
        val etag = fastUploader().uploadPart(
            parts, 1, partFile, 0, partFile.length(), server.url("/p").toString(),
        )
        assertEquals("\"cached\"", etag)
        assertEquals("a DONE part is never re-PUT", 0, server.requestCount)
    }

    @Test
    fun `uploadPart marks the part DONE and stores the etag on success`() {
        server.enqueue(MockResponse().setResponseCode(200).addHeader("ETag", "\"e1\""))
        val parts = mutableListOf(PartState(1))
        fastUploader().uploadPart(parts, 1, partFile, 0, partFile.length(), server.url("/p").toString())
        assertEquals(PartStatus.DONE, parts[0].status)
        assertEquals("\"e1\"", parts[0].etag)
        assertTrue("retryCount advanced at least once", parts[0].retryCount >= 1)
    }

    @Test
    fun `uploadPart marks the part FAILED and rethrows on dead-letter`() {
        repeat(7) { server.enqueue(MockResponse().setResponseCode(500)) }
        val parts = mutableListOf(PartState(1))
        val thrown = assertThrows(DeadLetterException::class.java) {
            fastUploader().uploadPart(parts, 1, partFile, 0, partFile.length(), server.url("/p").toString())
        }
        assertEquals(PartStatus.FAILED, parts[0].status)
        assertSame(DeadLetterException::class.java, thrown.javaClass)
    }
}
