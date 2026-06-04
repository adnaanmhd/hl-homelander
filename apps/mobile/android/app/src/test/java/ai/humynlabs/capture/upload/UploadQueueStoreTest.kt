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
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull

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
        // Clean any prior run's queue dir so tests are independent. Recreate it so
        // tests that write `queue.json` directly (Wave-1-5 Item 7's legacy-shape
        // test at line ~294) don't fail with FileNotFoundException when run in
        // isolation — without this, the test only passes when a sibling
        // `store.enqueue(...)` happened to create the dir earlier in the suite.
        val dir = File(app.filesDir, "upload-queue")
        dir.deleteRecursively()
        dir.mkdirs()
        return UploadQueueStore(app) to dir
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
    fun `deleteLocalAndRemove removes the row`() {
        val (store, _) = newStore()
        store.enqueue(row("01JABCREC1XXXXXXXXXXXXXXXXX"))
        store.deleteLocalAndRemove("01JABCREC1XXXXXXXXXXXXXXXXX")
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
    fun `mint three distinct per-route UUIDv4 idempotency keys at construction`() {
        val r = row("01JABCREC1XXXXXXXXXXXXXXXXX")
        // UUIDv4 syntactic check — same regex the server's idempotency plugin enforces.
        val v4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        assertTrue("row.initIdempotencyKey must be a lowercase UUIDv4; got ${r.initIdempotencyKey}", v4.matches(r.initIdempotencyKey))
        assertTrue("row.partsIdempotencyKey must be a lowercase UUIDv4; got ${r.partsIdempotencyKey}", v4.matches(r.partsIdempotencyKey))
        assertTrue("row.finalizeIdempotencyKey must be a lowercase UUIDv4; got ${r.finalizeIdempotencyKey}", v4.matches(r.finalizeIdempotencyKey))
        // All three per-route keys are pairwise distinct (Wave-1.5 Item 1 — no cross-route reuse).
        val perRoute = setOf(r.initIdempotencyKey, r.partsIdempotencyKey, r.finalizeIdempotencyKey)
        assertEquals("row construction mints 3 pairwise-distinct keys", 3, perRoute.size)
        // Two fresh rows mint independent keys.
        val r2 = row("01JABCREC2XXXXXXXXXXXXXXXXX")
        assertNotEquals(r.initIdempotencyKey, r2.initIdempotencyKey)
        assertNotEquals(r.partsIdempotencyKey, r2.partsIdempotencyKey)
        assertNotEquals(r.finalizeIdempotencyKey, r2.finalizeIdempotencyKey)
    }

    @Test
    fun `all three per-route idempotency keys survive a round trip through queue json`() {
        val (store, _) = newStore()
        val r = row("01JABCREC1XXXXXXXXXXXXXXXXX")
        val originalInit = r.initIdempotencyKey
        val originalParts = r.partsIdempotencyKey
        val originalFinalize = r.finalizeIdempotencyKey
        store.enqueue(r)
        val back = store.read()
        assertEquals(1, back.size)
        assertEquals("initIdempotencyKey must round-trip", originalInit, back[0].initIdempotencyKey)
        assertEquals("partsIdempotencyKey must round-trip", originalParts, back[0].partsIdempotencyKey)
        assertEquals("finalizeIdempotencyKey must round-trip", originalFinalize, back[0].finalizeIdempotencyKey)
    }

    @Test
    fun `read persists migrated idempotency keys back to disk so subsequent reads return the same keys Wave-1-5 Item 7`() {
        val (store, dir) = newStore()
        // Write a queue.json containing ONE row with no per-route key fields
        // (the pre-commit-5c0b2d8 legacy shape). The first read should mint
        // 4 fresh UUIDv4s + write them back to disk; the second read should
        // return the SAME 4 keys (not freshly-minted ones).
        val rid = "01JLEGACY01XXXXXXXXXXXXXXX"
        val legacyJson = JSONArray().apply {
            put(
                JSONObject().apply {
                    put("recordingId", rid)
                    put("ownerUserId", "userA")
                    put("mp4Path", "/data/files/recordings/$rid.mp4")
                    put("csvPath", "/data/files/recordings/$rid.csv")
                    put("jsonPath", "/data/files/recordings/$rid.json")
                    put("taskId", "01HVTESTTASK00000000000000")
                    put("isPractice", false)
                    put("state", "PENDING")
                    put("videoParts", JSONArray())
                    put("imuParts", JSONArray())
                    put("metadataPut", "PENDING")
                    put("enqueuedAt", 1L)
                    put("lastProgressAt", 1L)
                    // NO `*IdempotencyKey` fields.
                },
            )
        }.toString()
        File(dir, "queue.json").writeText(legacyJson)

        // First read: should mint 4 fresh UUIDv4s + persist them back to disk.
        val firstRead = store.read()
        assertEquals(1, firstRead.size)
        val firstRow = firstRead[0]
        val firstInit = firstRow.initIdempotencyKey
        val firstParts = firstRow.partsIdempotencyKey
        val firstFinalize = firstRow.finalizeIdempotencyKey
        val v4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        listOf(firstInit, firstParts, firstFinalize).forEach { k ->
            assertTrue("must mint a UUIDv4; got $k", v4.matches(k))
        }
        // The on-disk queue.json now contains all 4 fields with the captured values
        // (re-parse the raw JSON to confirm — using the public JSON API, not store.read()).
        val onDisk = JSONArray(File(dir, "queue.json").readText())
        assertEquals(1, onDisk.length())
        val rowJson = onDisk.getJSONObject(0)
        assertEquals(firstInit, rowJson.getString("initIdempotencyKey"))
        assertEquals(firstParts, rowJson.getString("partsIdempotencyKey"))
        assertEquals(firstFinalize, rowJson.getString("finalizeIdempotencyKey"))

        // Second read: must return the SAME 4 keys (no fresh mint — persist-back closed the storm).
        val secondRead = store.read()
        assertEquals(1, secondRead.size)
        val secondRow = secondRead[0]
        assertEquals("init key stable across reads", firstInit, secondRow.initIdempotencyKey)
        assertEquals("parts key stable across reads", firstParts, secondRow.partsIdempotencyKey)
        assertEquals("finalize key stable across reads", firstFinalize, secondRow.finalizeIdempotencyKey)
        // The row's _migratedOnLoad flag is `false` on the second read (no migration happened).
        assertFalse("row._migratedOnLoad must be false after the persist-back has happened", secondRow._migratedOnLoad)
    }

    @Test
    fun `read() does NOT re-write a row that already has all 4 per-route keys`() {
        // A row written by enqueue (constructed in-process, never migrated) should
        // not trigger the persist-back hook. Assert via the row._migratedOnLoad
        // flag — false on a freshly-written row's first read.
        val (store, _) = newStore()
        store.enqueue(row("01JNOTLEGACY1XXXXXXXXXXXXXX"))
        val firstRead = store.read()
        assertEquals(1, firstRead.size)
        assertFalse("a fresh in-process-enqueued row's _migratedOnLoad must be false", firstRead[0]._migratedOnLoad)
    }

    @Test
    fun `fromJson mints three fresh UUIDv4s when a pre-Wave-1-5 row on disk has no per-route keys`() {
        // Shape (a): the pre-commit-5c0b2d8 row layout — NO `*IdempotencyKey`
        // fields at all (the currently-stuck `01KRFXGAWCMVQ89PJ2PBXSVAKK` from
        // the Phase-5 smoke walk). fromJson must mint a fresh UUIDv4 for each
        // of the four per-route fields (and log a one-shot warn) so the row
        // can finally drain.
        val legacyNoKey = JSONObject().apply {
            put("recordingId", "01KRFXGAWCMVQ89PJ2PBXSVAKK")
            put("ownerUserId", "userA")
            put("mp4Path", "/data/files/recordings/x.mp4")
            put("csvPath", "/data/files/recordings/x.csv")
            put("jsonPath", "/data/files/recordings/x.json")
            put("taskId", "01HVTESTTASK00000000000000")
            put("isPractice", false)
            put("state", "PENDING")
            put("videoParts", JSONArray())
            put("imuParts", JSONArray())
            put("metadataPut", "PENDING")
            put("enqueuedAt", 1L)
            put("lastProgressAt", 1L)
            // NO idempotencyKey field; NO per-route key fields.
        }
        val v4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        val migratedA = UploadRow.fromJson(legacyNoKey)
        assertNotNull("fromJson must mint initIdempotencyKey", migratedA.initIdempotencyKey)
        assertNotNull("fromJson must mint partsIdempotencyKey", migratedA.partsIdempotencyKey)
        assertNotNull("fromJson must mint finalizeIdempotencyKey", migratedA.finalizeIdempotencyKey)
        assertTrue("init key UUIDv4-shaped; got ${migratedA.initIdempotencyKey}", v4.matches(migratedA.initIdempotencyKey))
        assertTrue("parts key UUIDv4-shaped; got ${migratedA.partsIdempotencyKey}", v4.matches(migratedA.partsIdempotencyKey))
        assertTrue("finalize key UUIDv4-shaped; got ${migratedA.finalizeIdempotencyKey}", v4.matches(migratedA.finalizeIdempotencyKey))
        assertEquals(
            "the three minted per-route keys are pairwise distinct (Wave-1.5 Item 1 — no cross-route reuse)",
            3,
            setOf(migratedA.initIdempotencyKey, migratedA.partsIdempotencyKey, migratedA.finalizeIdempotencyKey).size,
        )
        assertEquals("01KRFXGAWCMVQ89PJ2PBXSVAKK", migratedA.recordingId)

        // Shape (b): a commit-`5c0b2d8`-era row with ONLY the legacy single
        // `idempotencyKey` field. fromJson must STILL mint 4 fresh per-route
        // UUIDv4s — it must NOT propagate the legacy key into all four routes
        // (that re-introduces the cross-route 409 bug Wave-1.5 Item 1 closes).
        val legacySingleKey = "11111111-2222-4333-8444-555555555555"
        val legacyWithSingleKey = JSONObject().apply {
            put("recordingId", "01KRFZ91Y3E315AJVG75KXJZE6")
            put("ownerUserId", "userA")
            put("mp4Path", "/data/files/recordings/y.mp4")
            put("csvPath", "/data/files/recordings/y.csv")
            put("jsonPath", "/data/files/recordings/y.json")
            put("taskId", "01HVTESTTASK00000000000000")
            put("isPractice", false)
            put("state", "PENDING")
            put("videoParts", JSONArray())
            put("imuParts", JSONArray())
            put("metadataPut", "PENDING")
            put("enqueuedAt", 1L)
            put("lastProgressAt", 1L)
            put("idempotencyKey", legacySingleKey)
        }
        val migratedB = UploadRow.fromJson(legacyWithSingleKey)
        // None of the four per-route keys equal the legacy single key — they were minted independently.
        assertNotEquals("init key MUST NOT inherit the legacy single idempotencyKey", legacySingleKey, migratedB.initIdempotencyKey)
        assertNotEquals("parts key MUST NOT inherit the legacy single idempotencyKey", legacySingleKey, migratedB.partsIdempotencyKey)
        assertNotEquals("finalize key MUST NOT inherit the legacy single idempotencyKey", legacySingleKey, migratedB.finalizeIdempotencyKey)
        assertTrue("init UUIDv4", v4.matches(migratedB.initIdempotencyKey))
        assertTrue("parts UUIDv4", v4.matches(migratedB.partsIdempotencyKey))
        assertTrue("finalize UUIDv4", v4.matches(migratedB.finalizeIdempotencyKey))
        assertEquals(
            "the three minted per-route keys are pairwise distinct on shape (b) too",
            3,
            setOf(migratedB.initIdempotencyKey, migratedB.partsIdempotencyKey, migratedB.finalizeIdempotencyKey).size,
        )
    }

}
