package ai.humynlabs.capture.upload

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 05-04 Task 1 — `UploadQueueStore` (native-owned durable upload queue) +
 * `UploadModels` (chunk-size / parts-count arithmetic).
 *
 * Covers: round-trip through queue.json; the D-08 practice-filter refusal
 * (taskId == "__practice__" OR an mp4Path under a `practice/` dir); the UP-13
 * owner-pin in `bootstrap(currentSub)`; a null-sub `bootstrap` resumes nothing;
 * the 8 MiB / 5 MiB chunk-size constants; `partsCountFor` (ceil).
 *
 * `application = Application::class` — bypasses `MainApplication.onCreate`
 * `SoLoader.init` NPE under Robolectric (canonical Phase 3/4 pattern; see
 * `CaptureLaunchSweepTest`).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UploadQueueStoreTest {

    private fun newStore(): Pair<UploadQueueStore, File> {
        // A fresh per-test filesDir-rooted store. Robolectric's Application has a
        // real (temp) filesDir; UploadQueueStore writes under filesDir/upload-queue.
        val app = RuntimeEnvironment.getApplication()
        // Clean any prior run's queue dir so tests are independent.
        File(app.filesDir, "upload-queue").deleteRecursively()
        return UploadQueueStore(app) to File(app.filesDir, "upload-queue")
    }

    private fun row(
        recordingId: String,
        ownerUserId: String = "userA",
        mp4Path: String = "/data/files/recordings/$recordingId.mp4",
        taskId: String = "cooking.chopping",
        isPractice: Boolean = false,
    ) = UploadRow(
        recordingId = recordingId,
        ownerUserId = ownerUserId,
        mp4Path = mp4Path,
        csvPath = mp4Path.removeSuffix(".mp4") + ".csv",
        jsonPath = mp4Path.removeSuffix(".mp4") + ".json",
        taskId = taskId,
        isPractice = isPractice,
    )

    @Test
    fun `enqueue then read round-trips a row through queue json`() {
        val (store, dir) = newStore()
        val r = row("01JABCREC1XXXXXXXXXXXXXXXXX").also {
            it.uploadId = "vid-upload-id"
            it.imuUploadId = "imu-upload-id"
            it.partsCount = 3
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"abc\"", retryCount = 1))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
            it.metadataPut = PartStatus.PENDING
        }
        store.enqueue(r)

        assertTrue("queue.json should exist after enqueue", File(dir, "queue.json").exists())
        val back = store.read()
        assertEquals(1, back.size)
        val got = back[0]
        assertEquals(r.recordingId, got.recordingId)
        assertEquals("userA", got.ownerUserId)
        assertEquals("vid-upload-id", got.uploadId)
        assertEquals("imu-upload-id", got.imuUploadId)
        assertEquals(3, got.partsCount)
        assertEquals(WIFI_CHUNK_BYTES, got.chunkBytes)
        assertEquals(2, got.videoParts.size)
        assertEquals(PartStatus.DONE, got.videoParts[0].status)
        assertEquals("\"abc\"", got.videoParts[0].etag)
        assertEquals(1, got.videoParts[0].retryCount)
        assertEquals(1, got.imuParts.size)
        assertEquals(PartStatus.PENDING, got.metadataPut)
    }

    @Test
    fun `enqueue is idempotent on recordingId`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        assertEquals(1, store.read().size)
    }

    @Test
    fun `enqueue refuses a row whose taskId is __practice__ (D-08)`() {
        val (store, _) = newStore()
        store.enqueue(
            row(
                "01JABCPRAC1XXXXXXXXXXXXXXXX",
                mp4Path = "/data/files/recordings/practice-clip.mp4",
                taskId = PRACTICE_TASK_ID,
                isPractice = true,
            ),
        )
        assertTrue("practice row must not enter the queue", store.read().isEmpty())
    }

    @Test
    fun `enqueue refuses a row whose mp4Path is under a practice dir (D-08)`() {
        val (store, _) = newStore()
        store.enqueue(
            row(
                "01JABCPRAC2XXXXXXXXXXXXXXXX",
                mp4Path = "/data/user/0/ai.humynlabs.capture/files/practice/clip.mp4",
                taskId = "cooking.chopping",
                isPractice = true,
            ),
        )
        assertTrue("practice-dir row must not enter the queue", store.read().isEmpty())
    }

    @Test
    fun `bootstrap returns only the current sub's rows (UP-13 owner-pin)`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX", ownerUserId = "userA"))
        store.enqueue(row("01JABCREC2XXXXXXXXXXXXXXXXX", ownerUserId = "userA"))
        store.enqueue(row("01JABCREC3XXXXXXXXXXXXXXXXX", ownerUserId = "userB"))

        val forA = store.bootstrap("userA")
        assertEquals(2, forA.size)
        assertTrue(forA.all { it.ownerUserId == "userA" })

        val forB = store.bootstrap("userB")
        assertEquals(1, forB.size)
        assertEquals("userB", forB[0].ownerUserId)

        // All three rows are still on disk — logout/login preserves them.
        assertEquals(3, store.read().size)
    }

    @Test
    fun `bootstrap with null sub resumes nothing`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX", ownerUserId = "userA"))
        assertTrue(store.bootstrap(null).isEmpty())
        // Row preserved.
        assertEquals(1, store.read().size)
    }

    @Test
    fun `corrupt queue json reads as empty (no crash)`() {
        val (store, dir) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        File(dir, "queue.json").writeText("{ not valid json")
        assertTrue(store.read().isEmpty())
    }

    @Test
    fun `chunk size constants are 8 MiB wifi and 5 MiB cellular`() {
        assertEquals(8L * 1024 * 1024, chunkBytesForNetwork(false))
        assertEquals(5L * 1024 * 1024, chunkBytesForNetwork(true))
        assertEquals(8L * 1024 * 1024, WIFI_CHUNK_BYTES)
        assertEquals(5L * 1024 * 1024, CELLULAR_CHUNK_BYTES)
    }

    @Test
    fun `partsCountFor ceils the division and floors to 1`() {
        assertEquals(2, partsCountFor(10_000_000L, 8L * 1024 * 1024))
        assertEquals(1, partsCountFor(1L, 8L * 1024 * 1024))
        assertEquals(1, partsCountFor(0L, 8L * 1024 * 1024))
        assertEquals(1, partsCountFor(8L * 1024 * 1024, 8L * 1024 * 1024))
        assertEquals(2, partsCountFor(8L * 1024 * 1024 + 1, 8L * 1024 * 1024))
        // A 200 MiB video on cellular (5 MiB parts) → 40 parts.
        assertEquals(40, partsCountFor(200L * 1024 * 1024, CELLULAR_CHUNK_BYTES))
    }

    @Test
    fun `markVerifiedAndDeleteLocal removes the row`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        store.markVerifiedAndDeleteLocal("01JABCREC1XXXXXXXXXXXXXXXXX")
        assertTrue(store.read().isEmpty())
    }

    @Test
    fun `remove drops a row without touching others`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        store.enqueue(row("01JABCREC2XXXXXXXXXXXXXXXXX"))
        store.remove("01JABCREC1XXXXXXXXXXXXXXXXX")
        val back = store.read()
        assertEquals(1, back.size)
        assertEquals("01JABCREC2XXXXXXXXXXXXXXXXX", back[0].recordingId)
    }

    @Test
    fun `upsert replaces the matching row`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        val updated = store.read()[0].also { it.state = UploadState.UPLOADING; it.uploadId = "uid" }
        store.upsert(updated)
        val back = store.read()
        assertEquals(1, back.size)
        assertEquals(UploadState.UPLOADING, back[0].state)
        assertEquals("uid", back[0].uploadId)
    }

    @Test
    fun `bootstrap drops verified rows whose mp4 is gone`() {
        val (store, _) = newStore()
        // A verified row pointing at a non-existent file → housekeeping should drop it.
        val r = row("01JABCRECVXXXXXXXXXXXXXXXXX").also { it.state = UploadState.VERIFIED }
        // enqueue won't add a VERIFIED row's verification state, but it's a normal row at enqueue;
        // simulate by upserting the verified state.
        store.enqueue(row("01JABCRECVXXXXXXXXXXXXXXXXX"))
        store.upsert(r)
        assertEquals(1, store.read().size)
        store.bootstrap("userA")
        assertTrue("verified-with-missing-file row should be swept", store.read().isEmpty())
    }
}
