package ai.humynlabs.capture.capture

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.util.Log
import java.io.File
import java.io.FileOutputStream

/**
 * Phase 6 D-05 — best-effort first-I-frame thumbnail extraction for the
 * History tile (HIST-06 underlying infrastructure).
 *
 * Called from `FinalizeWorker.finalize()` step 7.5 after the sidecar delete
 * (orphan-sidecar contract) and BEFORE the onSegmentComplete emit. Output JPEG
 * (80% quality) lives at
 * `${thumbsDir}/${mp4File.nameWithoutExtension}.thumb.jpg`. The thumbsDir is
 * `filesDir/thumbs/` — a SIBLING of `filesDir/recordings/`, NOT inside it, so
 * the thumbnail survives the post-upload MP4 delete (the /finalize-200 bundle
 * cleanup, Enh 3 / D1; CONTEXT D-04).
 *
 * **HEVC GOP=30, no B-frames (CAP-01)** — frame 0 IS a key frame, so
 * `OPTION_CLOSEST_SYNC` at `timeUs=0` returns it directly with no decode
 * delay (~20-50 ms on Pixel 7a-class per CONTEXT D-05).
 *
 * **Best-effort contract:** any throwable catches + logs + cleans up the
 * partial output + returns null. The retriever is ALWAYS released
 * (RESEARCH Pitfall 2 — `setDataSource` leaks the underlying media-server
 * handle on throw without a finally block; symptom is "media server died"
 * log entries after a few hundred extracts). On null return, the History
 * row renders the token-color gradient + first-letter task-name fallback
 * (CONTEXT D-04).
 *
 * **Why this lives in FinalizeWorker's blast radius (D-05a):** the helper
 * runs on the same `finalizeExecutor` thread as the rest of finalize, so
 * it cannot interfere with the encoder pump or the IMU writer. The
 * existing post-sidecar-delete-but-before-emit hook is the smallest blast
 * radius vs. a dedicated `HumynThumbnail` module (extra MainApplication
 * wiring) or inlining in `HumynUpload.enqueue` (couples upload-queue
 * logic with extract logic). Future refactor opportunity (post-MVP):
 * promote to a shared helper if a second consumer ever appears.
 *
 * **CAP-18 invariant preserved:** this helper READS the MP4 (via
 * `MediaMetadataRetriever.setDataSource`); it never decodes / re-encodes /
 * transcodes / strips the file's bytes on disk. The thumbnail is a
 * sidecar derivative — the source MP4 still travels byte-for-byte to S3.
 */
object ThumbnailExtractor {
    /**
     * Extracts the first key-frame from [mp4File] as an 80%-quality JPEG
     * under [thumbsDir]. Returns the output file on success, null on any
     * throwable (logged at WARN; the caller continues). The retriever is
     * always released.
     *
     * @param mp4File the finalized HEVC MP4 (must exist on disk).
     * @param thumbsDir the destination directory (created if missing).
     * @return the output JPEG file, or null on extract failure.
     */
    fun extractFirstFrame(mp4File: File, thumbsDir: File): File? {
        thumbsDir.mkdirs()
        val outFile = File(thumbsDir, "${mp4File.nameWithoutExtension}.thumb.jpg")
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(mp4File.absolutePath)
            val bitmap =
                retriever.getFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    ?: return null
            FileOutputStream(outFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)
            }
            bitmap.recycle()
            return outFile
        } catch (t: Throwable) {
            // Best-effort — log + clean up partial output + return null.
            // The History row renders the gradient + first-letter fallback
            // (CONTEXT D-04). The retriever release in `finally` is the
            // Pitfall 2 mitigation — without it, repeated extracts leak
            // media-server handles ("media server died" after ~hundreds).
            Log.w("ThumbnailExtractor", "extract failed for ${mp4File.name}", t)
            outFile.delete()
            return null
        } finally {
            retriever.release()
        }
    }
}
