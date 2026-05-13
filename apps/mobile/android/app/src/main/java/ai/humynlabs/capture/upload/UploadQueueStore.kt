package ai.humynlabs.capture.upload

import android.content.Context
import android.util.Log
import java.io.File

/**
 * Phase 5 / Plan 05-04 — the durable upload queue.
 *
 * A native-owned JSON-on-disk store under `filesDir/upload-queue/queue.json`.
 * It is deliberately NOT a `react-native-mmkv` instance — that resolves
 * D-STATE-01 (one MMKV instance only): the JS side reads the queue via the
 * `HumynUpload` bridge (`getQueue()` / the `onUploadQueueChanged` event), never
 * via MMKV.
 *
 * Threat model (Plan 05-04 §threat_model):
 *  - T-5-04-01 (cross-account drain on a shared phone): every row carries
 *    `ownerUserId`; [bootstrap]/[rowsForUser] only return rows whose
 *    `ownerUserId == currentSub`.
 *  - T-5-04-02 (corrupt queue.json): [writeAtomic] writes `.partial` then
 *    renames; [read] tolerates a corrupt/missing file by returning an empty
 *    list + logging — never crashes.
 *  - T-5-04-04 (a practice recording leaking into the queue / to S3): [enqueue]
 *    REFUSES any row whose `taskId == "__practice__"` OR whose `mp4Path` is
 *    under a `practice/` directory (D-08).
 *
 * Atomic-write idiom mirrors `capture.MetadataComposer.writeAtomic` — write to
 * `queue.json.partial`, then rename onto `queue.json`. A `.partial` residue left
 * by a process crash is harmless; a future `CaptureLaunchSweep`-style pass could
 * sweep `upload-queue/` `.partial` cruft the way it already sweeps `recordings/`.
 */
class UploadQueueStore(private val context: Context) {

    private val dir = File(context.filesDir, "upload-queue")
    private val file = File(dir, "queue.json")
    private val partial = File(dir, "queue.json.partial")
    private val lock = Any()

    /**
     * Re-entry guard for the Wave-1.5 Item 7 migration-persist-back hook in
     * [read]: when [upsert] / [enqueue] / [bootstrap] internally call [read],
     * they MUST NOT re-trigger the migration upsert (`upsert` itself reads
     * from disk → fromJson re-mints fresh UUIDv4s for the still-legacy on-disk
     * row → infinite recursion). The first read on any thread does the
     * migration; nested reads on the same thread just return the parsed rows
     * unchanged. Cleared in `finally`.
     */
    private val migrating = ThreadLocal.withInitial { false }

    /**
     * Read all queue rows. Missing file → empty; corrupt file → empty + log.
     *
     * Wave-1.5 Item 7 — after parsing, persist any row whose `_migratedOnLoad`
     * flag was set by `UploadRow.fromJson` (i.e. one or more of the four
     * `*IdempotencyKey` fields was minted from a missing on-disk value). The
     * write is the existing atomic-rename writer (`writeAtomic`); subsequent
     * reads then return the SAME minted keys. Closes the per-`read()`-mints-
     * fresh-UUID storm + the process-kill-between-`/init`-and-`/parts` edge:
     * without this, a row from the pre-Wave-1.5 on-disk shape would mint a
     * fresh UUIDv4 on every `read()`, the next drain's `/init` would land
     * with key K1, the process-kill→next-boot would re-mint key K2, and the
     * subsequent `/parts` POST against the same row would carry K2 ≠ K1 →
     * 409 idempotency-key-conflict. The persist-back makes the keys stable
     * across boots.
     *
     * Re-entry guard: flag is cleared BEFORE the `upsert(row)` call so the
     * upserted row, when re-read from disk by a recursive call inside upsert,
     * is not re-migrated. The flag is in-memory only (not in toJson).
     */
    fun read(): MutableList<UploadRow> = synchronized(lock) {
        if (!file.exists()) return mutableListOf()
        val rows: MutableList<UploadRow> = try {
            rowsFromJsonString(file.readText())
        } catch (t: Throwable) {
            Log.w(TAG, "queue.json unreadable — treating as empty", t)
            return mutableListOf()
        }
        // Wave-1.5 Item 7 — persist any row whose fromJson set _migratedOnLoad.
        // Guarded by a thread-local so a nested read() inside upsert() (which
        // re-parses the still-legacy on-disk row) doesn't recurse infinitely.
        if (migrating.get()) return rows
        val migrated = rows.filter { it._migratedOnLoad }
        if (migrated.isEmpty()) return rows
        migrating.set(true)
        try {
            for (row in migrated) {
                row._migratedOnLoad = false
                Log.i(TAG, "row ${row.recordingId} idempotency-key migration persisted (Wave-1.5 Item 7)")
                try {
                    upsert(row)
                } catch (t: Throwable) {
                    // Surface but don't fail the read — the next read retries; the in-memory rows
                    // still carry the minted keys for THIS drain.
                    Log.w(TAG, "migrate persist-back failed for ${row.recordingId}; will retry on next read", t)
                }
            }
        } finally {
            migrating.set(false)
        }
        return rows
    }

    /** Atomic write: `.partial` then rename. Caller holds [lock]. */
    private fun writeAtomic(rows: List<UploadRow>) {
        dir.mkdirs()
        try {
            partial.writeText(rowsToJsonString(rows))
            try {
                java.nio.file.Files.move(
                    partial.toPath(),
                    file.toPath(),
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                )
            } catch (_: java.nio.file.AtomicMoveNotSupportedException) {
                // filesDir is single-mount on Android; fall back to renameTo.
                if (!partial.renameTo(file)) {
                    throw java.io.IOException("upload-queue rename failed")
                }
            }
        } catch (t: Throwable) {
            partial.delete()
            Log.w(TAG, "queue.json write failed", t)
            throw t
        }
    }

    /**
     * Returns true if [mp4Path]/[taskId] signals a practice recording (D-08).
     * Practice recordings NEVER enter the upload queue — the `__practice__`
     * taskId would also fail the server-side `recordings.taskId` FK.
     */
    private fun isPracticeRow(mp4Path: String, taskId: String): Boolean {
        if (taskId == PRACTICE_TASK_ID) return true
        val p = File(mp4Path).path
        return p.contains("/files/practice/") || p.contains("/practice/")
    }

    /**
     * Add a row to the queue. REFUSES (silently, with a warning) any practice
     * recording (D-08). Idempotent on `recordingId` — a re-enqueue of an
     * already-present recording is a no-op.
     */
    fun enqueue(row: UploadRow) {
        if (isPracticeRow(row.mp4Path, row.taskId)) {
            Log.w(TAG, "enqueue refused: practice recording ${row.recordingId} — not uploaded (D-08)")
            return
        }
        if (!row.isPractice && (row.taskId == PRACTICE_TASK_ID)) {
            // Defensive: the isPractice flag should agree with the taskId signal.
            Log.w(TAG, "enqueue: row ${row.recordingId} isPractice=false but taskId=__practice__ — refusing anyway")
            return
        }
        if (row.isPractice && !isPracticeRow(row.mp4Path, row.taskId)) {
            Log.w(TAG, "enqueue: row ${row.recordingId} isPractice=true but path/taskId look non-practice — refusing")
            return
        }
        synchronized(lock) {
            val rows = read()
            if (rows.none { it.recordingId == row.recordingId }) {
                rows.add(row)
                writeAtomic(rows)
            }
        }
    }

    /** Replace (or add) the row matching [row].recordingId. Used by the coordinator (Plan 05-06). */
    fun upsert(row: UploadRow) {
        synchronized(lock) {
            val rows = read()
            val idx = rows.indexOfFirst { it.recordingId == row.recordingId }
            if (idx >= 0) rows[idx] = row else rows.add(row)
            writeAtomic(rows)
        }
    }

    /** Drop the row with [recordingId] from the queue (does NOT touch local files). */
    fun remove(recordingId: String) {
        synchronized(lock) {
            val rows = read()
            val before = rows.size
            rows.removeAll { it.recordingId == recordingId }
            if (rows.size != before) writeAtomic(rows)
        }
    }

    /**
     * App-launch / login resume sweep (UP-13 + housekeeping):
     *  - drops any `VERIFIED` row whose local mp4 is already gone (housekeeping);
     *  - returns only rows whose `ownerUserId == currentSub` and which still need
     *    work (`state != VERIFIED`).
     * `currentSub == null` → nobody is signed in → resume nothing (wait for login;
     * the rows stay on disk, UP-13).
     */
    fun bootstrap(currentSub: String?): List<UploadRow> {
        synchronized(lock) {
            var rows = read()
            val before = rows.size
            rows = rows.filterNot { it.state == UploadState.VERIFIED && !File(it.mp4Path).exists() }
                .toMutableList()
            if (rows.size != before) writeAtomic(rows)
            return if (currentSub == null) {
                emptyList()
            } else {
                rows.filter { it.ownerUserId == currentSub && it.state != UploadState.VERIFIED }
            }
        }
    }

    /** The Pending-Uploads UI only ever sees the signed-in user's own rows. */
    fun rowsForUser(currentSub: String?): List<UploadRow> =
        if (currentSub == null) emptyList() else read().filter { it.ownerUserId == currentSub }

    /**
     * On a server `verified` event (Plan 05-08; UP-15): mark the row VERIFIED,
     * unlink the local mp4 + csv + json, then drop the row from the queue.
     * Local files are NEVER deleted before this point.
     */
    fun markVerifiedAndDeleteLocal(recordingId: String) {
        synchronized(lock) {
            val rows = read()
            val row = rows.firstOrNull { it.recordingId == recordingId } ?: return
            row.state = UploadState.VERIFIED
            // Best-effort unlink — a missing file is fine (already cleaned).
            runCatching { File(row.mp4Path).delete() }
            runCatching { File(row.csvPath).delete() }
            runCatching { File(row.jsonPath).delete() }
            rows.removeAll { it.recordingId == recordingId }
            writeAtomic(rows)
        }
    }

    companion object {
        private const val TAG = "HumynUploadQueue"
    }
}
