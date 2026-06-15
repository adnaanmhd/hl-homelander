package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

/**
 * Plan 06-04 Task 1 — `ThumbnailExtractor.extractFirstFrame(mp4File, thumbsDir)`
 * (Phase 6 D-05; HIST-06 underlying infrastructure).
 *
 * Best-effort first-I-frame extraction via `MediaMetadataRetriever`. The helper
 * is failure-tolerant: any throw catches + logs, cleans up the partial output
 * file, and returns null (the History row falls back to the gradient +
 * first-letter overlay per CONTEXT D-04). The retriever is ALWAYS released on
 * the throw path (Pitfall 2 — `setDataSource` leaks the underlying media-server
 * handle on throw without a finally block).
 *
 * Robolectric's shadow `MediaMetadataRetriever` does not decode real HEVC
 * bytes (Robolectric Issue #2). The on-device verification of a non-null
 * bitmap is part of Plan 06-11 manual smoke; these unit tests cover the
 * three best-effort + setup behaviors that don't require a real decode:
 *   (1) zero-byte garbage file → null + partial cleanup
 *   (2) non-existent thumbsDir → mkdirs() runs (helper proceeds)
 *   (3) retriever release on throw — implicit via no native leak (the
 *       finally branch is the production guard; explicit test would
 *       require a shadow assertion the Robolectric API doesn't expose
 *       cleanly).
 *
 * `application = Application::class` matches `MetadataSchemaConformanceTest` —
 * bypasses `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class ThumbnailExtractorTest {
    private val ctx = RuntimeEnvironment.getApplication()

    @Test
    fun `extractFirstFrame returns null on zero-byte mp4`() {
        val tmp = File(ctx.cacheDir, "garbage-${System.nanoTime()}.mp4").apply {
            writeBytes(ByteArray(0))
        }
        val thumbsDir = File(ctx.cacheDir, "thumbs-${System.nanoTime()}").also {
            it.deleteRecursively()
        }
        val result = ThumbnailExtractor.extractFirstFrame(tmp, thumbsDir)
        assertNull("zero-byte mp4 must yield null", result)
        // Partial output (if any) must be cleaned up on the throw path.
        val partial = File(thumbsDir, "${tmp.nameWithoutExtension}.thumb.jpg")
        assertFalse("partial JPEG must be deleted on throw", partial.exists())
        tmp.delete()
        thumbsDir.deleteRecursively()
    }

    @Test
    fun `extractFirstFrame creates thumbsDir if missing`() {
        val tmp = File(ctx.cacheDir, "garbage-${System.nanoTime()}.mp4").apply {
            writeBytes(ByteArray(0))
        }
        val newDir = File(ctx.cacheDir, "thumbs-fresh-${System.nanoTime()}")
        assertFalse("precondition: thumbs dir does not exist", newDir.exists())
        // Returns null (zero-byte fixture is garbage) but mkdirs() must run
        // BEFORE the retriever throws — the helper's first statement.
        ThumbnailExtractor.extractFirstFrame(tmp, newDir)
        assertTrue("thumbsDir must be created", newDir.exists())
        tmp.delete()
        newDir.deleteRecursively()
    }

    @Test
    fun `extractFirstFrame returns null on missing mp4 file`() {
        // Tighter contract test: a path to a non-existent file is the
        // most common failure mode in practice (race between finalize +
        // unlink). The helper must swallow + return null without crashing
        // the caller — caller is FinalizeWorker step 7.5, where a throw
        // would skip the onSegmentComplete emit entirely.
        val missing = File(ctx.cacheDir, "does-not-exist-${System.nanoTime()}.mp4")
        assertFalse(missing.exists())
        val thumbsDir = File(ctx.cacheDir, "thumbs-${System.nanoTime()}").also {
            it.deleteRecursively()
        }
        val result = ThumbnailExtractor.extractFirstFrame(missing, thumbsDir)
        assertNull("missing mp4 must yield null (no crash)", result)
        thumbsDir.deleteRecursively()
    }
}
