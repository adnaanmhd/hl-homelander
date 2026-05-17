package ai.humynlabs.capture.upload

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Quick task 260517-p5g CAPTURE-QA-04 — belt-and-braces backstop:
 * `UploadQueueStore.enqueue` refuses any [UploadRow] whose
 * `cancelReason != null`. The JS-side `RecordingScreen.onSegmentCanceled`
 * handler is the primary gate (it never calls `HumynUpload.enqueue` for
 * canceled segments); this guard catches a future native-side regression
 * that ever constructs a canceled UploadRow directly.
 *
 * Tests:
 *   A. enqueue(row with cancelReason="fps_dropped") is a no-op (queue.json
 *      stays empty).
 *   B. enqueue(row with cancelReason=null) persists normally — happy-path
 *      regression guard.
 *   C. Practice-recording short-circuit (existing D-08) still fires when
 *      cancelReason=null — regression guard for the existing path.
 *   D. cancelReason round-trips through queue.json (toJson / fromJson).
 *   E. cancelReason missing on disk → fromJson reads null (backward-compat).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class UploadQueueStoreCancelGuardTest {

    private fun newStore(): Pair<UploadQueueStore, File> {
        val app = RuntimeEnvironment.getApplication()
        val dir = File(app.filesDir, "upload-queue")
        dir.deleteRecursively()
        dir.mkdirs()
        return UploadQueueStore(app) to dir
    }

    private fun row(
        recordingId: String,
        cancelReason: String? = null,
        taskId: String = "cooking.chopping",
        mp4Path: String = "/data/files/recordings/$recordingId.mp4",
        isPractice: Boolean = false,
    ) = UploadRow(
        recordingId = recordingId,
        ownerUserId = "userA",
        mp4Path = mp4Path,
        csvPath = mp4Path.removeSuffix(".mp4") + ".csv",
        jsonPath = mp4Path.removeSuffix(".mp4") + ".json",
        taskId = taskId,
        isPractice = isPractice,
        cancelReason = cancelReason,
    )

    @Test
    fun `Test A — enqueue refuses a row with cancelReason set (fps_dropped)`() {
        val (store, dir) = newStore()
        val r = row("01JCANCELED-REC-FPS", cancelReason = "fps_dropped")
        store.enqueue(r)
        // queue.json must NOT exist (no enqueue happened).
        val queueFile = File(dir, "queue.json")
        // Either it doesn't exist OR it's an empty-array JSON.
        if (queueFile.exists()) {
            assertEquals("[]", queueFile.readText().trim())
        }
        // And read() returns empty.
        assertEquals(0, store.read().size)
    }

    @Test
    fun `Test A2 — enqueue refuses a row with cancelReason=resolution_dropped`() {
        val (store, _) = newStore()
        store.enqueue(row("01JCANCELED-REC-RES", cancelReason = "resolution_dropped"))
        assertEquals(0, store.read().size)
    }

    @Test
    fun `Test A3 — enqueue refuses a row with cancelReason=insufficient_frames`() {
        val (store, _) = newStore()
        store.enqueue(row("01JCANCELED-REC-IF", cancelReason = "insufficient_frames"))
        assertEquals(0, store.read().size)
    }

    @Test
    fun `Test B — enqueue persists a normal row with cancelReason=null (regression)`() {
        val (store, dir) = newStore()
        store.enqueue(row("01JNORMAL-REC-XXXXXXXXXXXXX", cancelReason = null))
        assertEquals(1, store.read().size)
        val back = store.read()[0]
        assertEquals("01JNORMAL-REC-XXXXXXXXXXXXX", back.recordingId)
        assertNull(back.cancelReason)
        // queue.json should exist now.
        assertEquals(true, File(dir, "queue.json").exists())
    }

    @Test
    fun `Test C — practice-recording short-circuit still fires (existing D-08 regression)`() {
        val (store, _) = newStore()
        store.enqueue(row(
            "01JPRACTICE-REC-XXXXXXXXXXX",
            cancelReason = null,
            taskId = "__practice__",
            mp4Path = "/data/files/practice/20260517_120000_001.mp4",
            isPractice = true,
        ))
        assertEquals(0, store.read().size)
    }

    @Test
    fun `Test D — cancelReason round-trips through toJson + fromJson`() {
        val r = row("01JROUNDTRIP-REC-XXXXXXXXXXX", cancelReason = "fps_dropped")
        // Round-trip via JSON to assert toJson/fromJson coverage. The
        // store.enqueue path would refuse the row first; we test the
        // model serialization directly.
        val json = r.toJson()
        assertEquals("fps_dropped", json.getString("cancelReason"))
        val back = UploadRow.fromJson(json)
        assertEquals("fps_dropped", back.cancelReason)
    }

    @Test
    fun `Test E — cancelReason missing on disk reads back as null (backward-compat)`() {
        // Legacy row (pre-CAPTURE-QA-04) — no `cancelReason` key.
        val r = row("01JLEGACY-REC-XXXXXXXXXXXXXX", cancelReason = null)
        val json = r.toJson()
        // toJson omits the field when null — defensive verify.
        assertEquals(false, json.has("cancelReason"))
        val back = UploadRow.fromJson(json)
        assertNull(back.cancelReason)
    }

    @Test
    fun `Test F — cancelReason is null on a fresh UploadRow (default)`() {
        val r = UploadRow(
            recordingId = "01JDEFAULT-REC-XXXXXXXXXXXX",
            ownerUserId = "userA",
            mp4Path = "/m.mp4",
            csvPath = "/c.csv",
            jsonPath = "/j.json",
            taskId = "cooking.chopping",
            isPractice = false,
        )
        assertNull(r.cancelReason)
    }

    @Test
    fun `Test G — toJson preserves a non-null cancelReason field`() {
        val r = row("01JTOJSON-REC-XXXXXXXXXXXXX", cancelReason = "resolution_dropped")
        val json = r.toJson()
        assertNotNull(json.optString("cancelReason"))
        assertEquals("resolution_dropped", json.getString("cancelReason"))
    }
}
