package ai.humynlabs.capture.upload

import android.app.Application
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
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
import org.robolectric.annotation.Config
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Debug session `.planning/debug/reupload-finalize-409.md` (2026-05-13) —
 * `HumynUploadModule.reupload()` Path-A (worker-fired re-upload after server
 * `qa_status='hash-mismatch'`) MUST rotate the three per-route idempotency
 * keys (`init`, `parts`, `finalize`) and MUST NOT rotate the
 * `reuploadIdempotencyKey` (one-shot per cycle, same-body replay is correct
 * idempotent behavior).
 *
 * Pins the regression that surfaced in Phase 5 UAT Item 1 §3 on the Pixel 10a:
 * the post-reupload `POST /recordings/:id/finalize` returned 409
 * `idempotency-key-conflict` in 4 ms because the §2-original
 * `finalizeIdempotencyKey` was reused against a different `(uploadId, parts)`
 * body. Wave-1.5 Plan 05-14 Item 1 split the keys per-route within ONE upload
 * session; this test pins the rotation at the hash-mismatch boundary (a NEW
 * logical session for /init/parts/finalize, even though the queue row is
 * shared with the original upload).
 *
 * Path-B (Wave-1.5 Item 2 client-side dead-letter on server `qa_status='pending'`)
 * is explicitly covered to assert the opposite: keys MUST NOT rotate, because
 * Path-B keeps uploadId/parts/etags by design (same-body replay returns the
 * cached 200 — correct idempotent behavior).
 *
 * `application = Application::class` — canonical Robolectric/SoLoader-bypass
 * pattern shared with `UploadCoordinatorTest` + `HumynHandDetectorModuleTest`.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class HumynUploadModuleReuploadTest {

    private lateinit var app: Application
    private lateinit var recDir: File

    @Before
    fun setUp() {
        app = RuntimeEnvironment.getApplication() as Application
        // Fresh per-test queue dir + recording bundle dir — shared with the
        // process-wide UploadCoordinator singleton (`getShared(app)`).
        File(app.filesDir, "upload-queue").deleteRecursively()
        recDir = File(app.filesDir, "recordings").apply { mkdirs() }
    }

    @After
    fun tearDown() {
        File(app.filesDir, "upload-queue").deleteRecursively()
        recDir.deleteRecursively()
    }

    // ── Path-A: hash-mismatch re-upload — keys MUST rotate ─────────────────

    @Test
    fun `reupload Path-A rotates initIdempotencyKey partsIdempotencyKey finalizeIdempotencyKey but NOT reuploadIdempotencyKey`() {
        // Arrange: a row that has already consumed /init + /parts + /finalize
        // once (state == FINALIZING is the on-device evidence from the §3 walk;
        // state == AWAITING_VERIFY would also exercise Path-A — both fall into
        // the `else ->` branch).
        val module = HumynUploadModule(BridgeReactContext(app))
        val store = UploadCoordinator.getShared(app).queueStore

        val recordingId = "01KRGB97X3MPJ784QF78SD77NJ"
        val row = newRow(recordingId).apply {
            state = UploadState.FINALIZING
            uploadId = "old-video-upload-id"
            imuUploadId = "old-imu-upload-id"
            partsCount = 9
            chunkBytes = WIFI_CHUNK_BYTES
            metadataPut = PartStatus.DONE
            videoParts.add(PartState(1, PartStatus.DONE, etag = "\"v1\"", retryCount = 0))
            videoParts.add(PartState(2, PartStatus.DONE, etag = "\"v2\"", retryCount = 0))
            imuParts.add(PartState(1, PartStatus.DONE, etag = "\"i1\"", retryCount = 0))
        }
        store.enqueue(row)

        // Capture the four keys minted at row construction.
        val preInit = row.initIdempotencyKey
        val preParts = row.partsIdempotencyKey
        val preFinalize = row.finalizeIdempotencyKey
        val preReupload = row.reuploadIdempotencyKey

        // Act
        val promise = RecordingPromise()
        module.reupload(recordingId, promise)
        assertTrue(
            "reupload should settle within the timeout",
            promise.await(5, TimeUnit.SECONDS),
        )
        assertTrue(
            "expected resolve(null), got reject(${promise.rejectCode}: ${promise.rejectThrowable?.message})",
            !promise.rejected,
        )

        // Assert: read the row back from the queue store (durable round-trip).
        val back = store.read().single { it.recordingId == recordingId }

        // (1) The three rotatable keys differ — this is the fix.
        assertNotEquals(
            "initIdempotencyKey MUST rotate at the hash-mismatch boundary",
            preInit,
            back.initIdempotencyKey,
        )
        assertNotEquals(
            "partsIdempotencyKey MUST rotate at the hash-mismatch boundary",
            preParts,
            back.partsIdempotencyKey,
        )
        assertNotEquals(
            "finalizeIdempotencyKey MUST rotate at the hash-mismatch boundary " +
                "(the specific 409 surfaced in UAT Item 1 §3 on 2026-05-13)",
            preFinalize,
            back.finalizeIdempotencyKey,
        )

        // (2) reuploadIdempotencyKey is one-shot per cycle — same-body replay is
        // correct idempotent behavior, so it must NOT rotate.
        assertEquals(
            "reuploadIdempotencyKey MUST NOT rotate (one-shot per re-upload cycle)",
            preReupload,
            back.reuploadIdempotencyKey,
        )

        // (3) The three new keys are pairwise distinct (UUIDs from separate
        // randomUUID() calls — sanity guard against an accidental shared assign).
        assertNotEquals(back.initIdempotencyKey, back.partsIdempotencyKey)
        assertNotEquals(back.initIdempotencyKey, back.finalizeIdempotencyKey)
        assertNotEquals(back.partsIdempotencyKey, back.finalizeIdempotencyKey)

        // (4) The canonical Path-A reset assertions — keep them here so a
        // future refactor doesn't silently widen the reset scope without
        // taking the test with it.
        assertEquals(UploadState.PENDING, back.state)
        assertEquals(true, back.reupload)
        assertNull("uploadId cleared", back.uploadId)
        assertNull("imuUploadId cleared", back.imuUploadId)
        assertEquals(PartStatus.PENDING, back.metadataPut)
        assertNull("deadLetterReason cleared", back.deadLetterReason)
        for (p in back.videoParts) {
            assertEquals(PartStatus.PENDING, p.status)
            assertNull("video part etag cleared", p.etag)
            assertEquals(0, p.retryCount)
        }
        for (p in back.imuParts) {
            assertEquals(PartStatus.PENDING, p.status)
            assertNull("imu part etag cleared", p.etag)
            assertEquals(0, p.retryCount)
        }
        // partsCount / chunkBytes stay pinned across a re-upload.
        assertEquals(9, back.partsCount)
        assertEquals(WIFI_CHUNK_BYTES, back.chunkBytes)
    }

    // ── Path-B: client-side dead-letter on server qa_status='pending' — keys MUST NOT rotate ─

    @Test
    fun `reupload Path-B (DEAD_LETTER with uploadId set and !reupload) does NOT rotate any idempotency key`() {
        // Arrange: the Wave-1.5 Item 2 branch — a row that dead-lettered
        // mid-/parts (server still at qa_status='pending', uploadId/parts/etags
        // intact). The drainer takes the postRePresign branch; the existing
        // finalizeIdempotencyKey + same body is correct idempotent replay.
        val module = HumynUploadModule(BridgeReactContext(app))
        val store = UploadCoordinator.getShared(app).queueStore

        val recordingId = "01KRFXGAWCMVQ89PJ2PBXSVAKK"
        val row = newRow(recordingId).apply {
            state = UploadState.DEAD_LETTER
            uploadId = "in-flight-video-upload-id"
            imuUploadId = "in-flight-imu-upload-id"
            partsCount = 2
            chunkBytes = WIFI_CHUNK_BYTES
            metadataPut = PartStatus.DONE
            videoParts.add(PartState(1, PartStatus.DONE, etag = "\"v1\"", retryCount = 0))
            videoParts.add(PartState(2, PartStatus.PENDING))
            imuParts.add(PartState(1, PartStatus.DONE, etag = "\"i1\"", retryCount = 0))
            deadLetterReason = "Network dropped mid-/parts"
            reupload = false
        }
        store.enqueue(row)

        val preInit = row.initIdempotencyKey
        val preParts = row.partsIdempotencyKey
        val preFinalize = row.finalizeIdempotencyKey
        val preReupload = row.reuploadIdempotencyKey

        // Act
        val promise = RecordingPromise()
        module.reupload(recordingId, promise)
        assertTrue(promise.await(5, TimeUnit.SECONDS))
        assertTrue(
            "expected resolve(null), got reject(${promise.rejectCode})",
            !promise.rejected,
        )

        // Assert: no key was rotated — Path-B keeps uploadId/parts/etags and so
        // every (key, body) pair is stable.
        val back = store.read().single { it.recordingId == recordingId }
        assertEquals(preInit, back.initIdempotencyKey)
        assertEquals(preParts, back.partsIdempotencyKey)
        assertEquals(preFinalize, back.finalizeIdempotencyKey)
        assertEquals(preReupload, back.reuploadIdempotencyKey)

        // Path-B's canonical reset: state → UPLOADING; deadLetterReason cleared;
        // uploadId / parts / etags KEPT.
        assertEquals(UploadState.UPLOADING, back.state)
        assertNull(back.deadLetterReason)
        assertEquals("in-flight-video-upload-id", back.uploadId)
        assertEquals("in-flight-imu-upload-id", back.imuUploadId)
        assertEquals(PartStatus.DONE, back.videoParts[0].status)
        assertEquals("\"v1\"", back.videoParts[0].etag)
        assertEquals(PartStatus.DONE, back.metadataPut)
        assertEquals(false, back.reupload)
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private fun newRow(recordingId: String): UploadRow {
        // A minimal bundle on disk under filesDir/recordings — the test doesn't
        // PUT to S3, but UploadRow's mp4Path/csvPath/jsonPath need to resolve
        // for any downstream code (e.g. emitQueueChanged → rowToMap).
        val mp4 = File(recDir, "$recordingId.mp4").apply { writeBytes(byteArrayOf(0, 1, 2)) }
        val csv = File(recDir, "$recordingId.csv").apply { writeText("ts,ax,ay,az\n0,0,0,9.8\n") }
        val json = File(recDir, "$recordingId.json").apply { writeText("{}") }
        return UploadRow(
            recordingId = recordingId,
            ownerUserId = "userA",
            mp4Path = mp4.path,
            csvPath = csv.path,
            jsonPath = json.path,
            taskId = "T".repeat(26),
            isPractice = false,
        )
    }

    /**
     * Minimal `Promise` test double — copy of the pattern in
     * `HumynHandDetectorModuleTest.RecordingPromise`. No mocking framework on
     * the test classpath (junit + robolectric only). Captures the first
     * settlement and counts down a latch so the test can await the background
     * executor.
     */
    private class RecordingPromise : Promise {
        private val latch = CountDownLatch(1)

        @Volatile var resolvedValue: Any? = null
        @Volatile var rejected = false
        @Volatile var rejectCode: String? = null
        @Volatile var rejectThrowable: Throwable? = null

        fun await(timeout: Long, unit: TimeUnit): Boolean = latch.await(timeout, unit)

        private inline fun settle(block: () -> Unit) {
            block()
            latch.countDown()
        }

        override fun resolve(value: Any?) = settle { resolvedValue = value }

        override fun reject(code: String, message: String?) =
            settle { rejected = true; rejectCode = code }

        override fun reject(code: String, throwable: Throwable?) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(code: String, message: String?, throwable: Throwable?) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(throwable: Throwable) =
            settle { rejected = true; rejectThrowable = throwable }

        override fun reject(throwable: Throwable, userInfo: WritableMap) =
            settle { rejected = true; rejectThrowable = throwable }

        override fun reject(code: String, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code }

        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        override fun reject(code: String, message: String?, userInfo: WritableMap) =
            settle { rejected = true; rejectCode = code }

        override fun reject(
            code: String?,
            message: String?,
            throwable: Throwable?,
            userInfo: WritableMap?,
        ) = settle { rejected = true; rejectCode = code; rejectThrowable = throwable }

        @Deprecated("Prefer reject(code, message) — string-only reject is deprecated in RN.")
        override fun reject(message: String) = settle { rejected = true }
    }
}
