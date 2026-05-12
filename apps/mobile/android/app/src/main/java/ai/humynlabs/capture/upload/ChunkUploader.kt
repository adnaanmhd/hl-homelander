package ai.humynlabs.capture.upload

import android.util.Log
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.Socket
import java.net.SocketAddress
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import javax.net.SocketFactory

/**
 * Phase 5 / Plan 05-06 — the per-part S3 multipart PUT engine.
 *
 * `ChunkUploader` streams ONE part's byte-range out of the recording file as the
 * PUT body (never loads a multi-GB MP4 into memory — `rangedBody` reads a 64 KB
 * buffer at a time off a `RandomAccessFile.seek(offset)`), captures the `ETag`
 * response header, and wraps every PUT in:
 *
 *  - **retry / backoff** — a part that fails (IOException or a non-2xx) is
 *    retried with the EXACT delay sequence `2 / 4 / 8 / 16 / 32 / 64 s`
 *    (six retries); the 7th failure throws a [DeadLetterException] so the
 *    coordinator marks the PART `FAILED` and the RECORDING `DEAD_LETTER`
 *    (recording the `deadLetterReason`). (UP-04)
 *
 *  - **no re-PUT of a DONE part** — [uploadPart] is a no-op (returns the cached
 *    `etag`) when the part already has `status == DONE && etag != null` — a
 *    successful part is NEVER re-PUT, so a connection drop only re-sends the
 *    parts still in flight, never the whole file. (UP-04)
 *
 *  - **30 s no-progress watchdog** — a per-`Call` `ScheduledExecutorService`
 *    that, if no body bytes have moved for 30 s, calls `Call.cancel()` (closes
 *    the socket); the next retry iteration gets a FRESH `Call` (a new socket /
 *    new TCP handshake / new MSS negotiation). This is the RELIABLE half of
 *    UP-19 — it's what actually defeats the Jio-CGNAT / Vivo-Brasil
 *    MTU-blackhole stall (the connection looks alive at the TCP layer but
 *    progress hangs; only a fresh handshake recovers). (per 05-RESEARCH.md
 *    Pitfall 7)
 *
 * The companion best-effort `TCP_MAXSEG=1280` clamp ([MssSocketFactory]) is the
 * OTHER, unreliable half of UP-19 — see its header.
 *
 * The coordinator (Plan 05-06's `UploadCoordinator`) passes in a shared
 * `OkHttpClient` built with `.socketFactory(MssSocketFactory())`,
 * `readTimeout(0)` and `callTimeout(0)` — stall-handling is deferred to the
 * watchdog (a fixed `readTimeout` would kill a slow-but-progressing transfer on
 * a bad-but-not-dead cellular link).
 */
class ChunkUploader(
    private val baseClient: OkHttpClient,
    /** The 6-retry backoff in millis. Overridable in tests so they don't sleep 2/4/8s for real. */
    private val backoffMs: LongArray = longArrayOf(2_000, 4_000, 8_000, 16_000, 32_000, 64_000),
    /** No-progress watchdog window in millis. Overridable (smaller) in tests. */
    private val noProgressWindowMs: Long = 30_000L,
) {

    private val watchdogExecutor: ScheduledExecutorService =
        Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r, "humyn-upload-watchdog").apply { isDaemon = true }
        }

    /**
     * A streaming PUT-body over a byte-range of [file]: `RandomAccessFile.seek(offset)`
     * then a 64 KB read loop into `sink`. NEVER `readBytes()` / NEVER buffers the
     * whole file (T-5-06-04). `onBytes` is invoked with each chunk's length so the
     * caller's watchdog + debounced progress emit see forward motion.
     */
    private fun rangedBody(
        file: File,
        offset: Long,
        length: Long,
        onBytes: (Long) -> Unit,
    ): RequestBody = object : RequestBody() {
        override fun contentType() = "application/octet-stream".toMediaTypeOrNull()
        override fun contentLength() = length
        override fun writeTo(sink: BufferedSink) {
            RandomAccessFile(file, "r").use { raf ->
                raf.seek(offset)
                val buf = ByteArray(64 * 1024)
                var remaining = length
                while (remaining > 0) {
                    val n = raf.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
                    if (n <= 0) break
                    sink.write(buf, 0, n)
                    remaining -= n
                    onBytes(n.toLong())
                }
            }
        }
    }

    /**
     * One PUT attempt (no retry) — used by [putPart]. Arms the 30 s no-progress
     * watchdog around the `Call`; on a 2xx returns the `ETag` header (throws if
     * absent); on a non-2xx throws `IOException`; on the watchdog firing, the
     * `Call` is cancelled and the `execute()` throws (→ caught by [putPart]'s
     * retry loop, which gets a fresh `Call` next iteration).
     */
    private fun putPartOnce(
        presignedUrl: String,
        file: File,
        offset: Long,
        length: Long,
        onProgress: (Long) -> Unit,
    ): String {
        val lastProgressAt = AtomicLong(System.currentTimeMillis())
        val body = rangedBody(file, offset, length) { n ->
            lastProgressAt.set(System.currentTimeMillis())
            onProgress(n)
        }
        val req = Request.Builder().url(presignedUrl).put(body).build()
        val call = baseClient.newCall(req)
        // 30 s no-progress watchdog: poll periodically; if no bytes moved in the
        // window, cancel the Call (closes the socket) so execute() unwinds.
        val pollMs = (noProgressWindowMs / 6).coerceAtLeast(200L)
        val watchdog = watchdogExecutor.scheduleWithFixedDelay({
            if (System.currentTimeMillis() - lastProgressAt.get() >= noProgressWindowMs && !call.isCanceled()) {
                Log.w(TAG, "no-progress watchdog fired — cancelling Call (will retry on a fresh socket)")
                call.cancel()
            }
        }, pollMs, pollMs, TimeUnit.MILLISECONDS)
        try {
            call.execute().use { resp ->
                if (!resp.isSuccessful) throw IOException("part PUT ${resp.code}")
                return resp.header("ETag") ?: throw IOException("no ETag on part response")
            }
        } finally {
            watchdog.cancel(false)
        }
    }

    /**
     * PUT [file]'s [offset]..[offset]+[length] range to [presignedUrl] with the
     * full retry budget (six retries at `2/4/8/16/32/64 s`). Returns the `ETag`
     * on success; throws [DeadLetterException] on the 7th failure (so the
     * coordinator dead-letters the recording). On a watchdog-cancel mid-attempt,
     * the next iteration's `Call` is a brand-new socket (possibly a fresh MSS
     * negotiation — the UP-19 recovery).
     */
    fun putPart(
        presignedUrl: String,
        file: File,
        offset: Long,
        length: Long,
        onProgress: (Long) -> Unit = {},
    ): String {
        var lastError: Exception? = null
        for (attempt in 0..backoffMs.size) {
            try {
                return putPartOnce(presignedUrl, file, offset, length, onProgress)
            } catch (e: Exception) {
                lastError = e
                if (attempt == backoffMs.size) {
                    throw DeadLetterException(
                        "part PUT failed after ${backoffMs.size} retries: ${e.message}",
                        e,
                    )
                }
                try {
                    Thread.sleep(backoffMs[attempt])
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw DeadLetterException("upload interrupted", e)
                }
            }
        }
        // Unreachable — the loop either returns or throws.
        throw DeadLetterException("part PUT failed", lastError)
    }

    /**
     * Queue-row-aware part upload (UP-04). If `parts[n-1]` is already `DONE` with
     * an `etag`, returns the cached etag WITHOUT a new request — a DONE part is
     * never re-PUT. Otherwise: bump `retryCount` per attempt, on success set
     * `status = DONE` + `etag`, on [DeadLetterException] set `status = FAILED`
     * and rethrow (the coordinator catches it → marks the row `DEAD_LETTER`).
     */
    fun uploadPart(
        parts: MutableList<PartState>,
        n: Int,
        file: File,
        offset: Long,
        length: Long,
        presignedUrl: String,
        onProgress: (Long) -> Unit = {},
    ): String {
        val ps = parts[n - 1]
        val cached = ps.etag
        if (ps.status == PartStatus.DONE && cached != null) return cached
        try {
            ps.retryCount++
            val etag = putPart(presignedUrl, file, offset, length, onProgress)
            ps.status = PartStatus.DONE
            ps.etag = etag
            return etag
        } catch (e: DeadLetterException) {
            ps.status = PartStatus.FAILED
            throw e
        }
    }

    /** Stop the watchdog scheduler (called from `UploadCoordinator.shutdown()`). */
    fun shutdown() {
        runCatching { watchdogExecutor.shutdownNow() }
    }

    companion object {
        private const val TAG = "HumynChunkUploader"
    }
}

/** Thrown when a part exhausts its retry budget — the coordinator dead-letters the recording. */
class DeadLetterException(message: String, cause: Throwable?) : Exception(message, cause)

/**
 * UP-19, half (b) — the BEST-EFFORT `TCP_MAXSEG=1280` clamp.
 *
 * UP-19 has two halves:
 *  (a) the 30 s no-progress abandon-and-retry-with-fresh-socket watchdog in
 *      [ChunkUploader] — the RELIABLE, portable mitigation that actually defeats
 *      the Jio-CGNAT / Vivo-Brasil MTU-blackhole stall (a fresh TCP handshake is
 *      the only thing that recovers a blackholed-but-TCP-alive connection);
 *  (b) THIS MSS clamp — BEST-EFFORT only. `java.net.Socket` exposes no MSS
 *      setter, and `setsockopt(TCP_MAXSEG)` on a *client* socket is
 *      pre-`connect()`-only and advisory on some kernels — so this may throw an
 *      `ErrnoException` or silently no-op. Every call is wrapped in
 *      `try/catch (_: Throwable)` and dropped silently if it fails — (a) carries
 *      UP-19 alone. **The SMOKE runbook has a manual step: verify whether this
 *      clamp takes on-device; if it no-ops, drop it.** (per 05-RESEARCH.md
 *      Pitfall 7)
 *
 * Implementation: a [SocketFactory] whose `createSocket()` returns a [Socket]
 * subclass overriding `connect()` to attempt `Os.setsockoptInt(fd, IPPROTO_TCP,
 * TCP_MAXSEG, 1280)` (TCP_MAXSEG isn't in `OsConstants`; the Linux numeric value
 * is 2) BEFORE `super.connect()`. The fd is obtained reflectively
 * (`Socket.getFileDescriptor$()` — a hidden API; may be blocked on newer
 * Android, in which case the catch swallows it).
 */
class MssSocketFactory(
    private val delegate: SocketFactory = getDefault(),
) : SocketFactory() {

    override fun createSocket(): Socket = ClampedSocket()

    override fun createSocket(host: String?, port: Int): Socket =
        delegate.createSocket(host, port)

    override fun createSocket(host: String?, port: Int, localHost: InetAddress?, localPort: Int): Socket =
        delegate.createSocket(host, port, localHost, localPort)

    override fun createSocket(host: InetAddress?, port: Int): Socket =
        delegate.createSocket(host, port)

    override fun createSocket(address: InetAddress?, port: Int, localAddress: InetAddress?, localPort: Int): Socket =
        delegate.createSocket(address, port, localAddress, localPort)

    /** A [Socket] that best-effort-clamps MSS to 1280 before connecting. */
    private class ClampedSocket : Socket() {
        override fun connect(endpoint: SocketAddress?, timeout: Int) {
            try {
                // TCP_MAXSEG: not exposed by android.system.OsConstants — the
                // Linux numeric value is 2 (see <netinet/tcp.h>).
                val tcpMaxSeg = 2
                val fdField = Socket::class.java.getDeclaredMethod("getFileDescriptor\$")
                fdField.isAccessible = true
                val fd = fdField.invoke(this) as? java.io.FileDescriptor
                if (fd != null && fd.valid()) {
                    android.system.Os.setsockoptInt(
                        fd,
                        android.system.OsConstants.IPPROTO_TCP,
                        tcpMaxSeg,
                        1280,
                    )
                }
            } catch (_: Throwable) {
                // Best-effort — drop silently. The 30 s watchdog in ChunkUploader
                // is the reliable UP-19 mitigation. (05-RESEARCH.md Pitfall 7)
            }
            super.connect(endpoint, timeout)
        }
    }
}
