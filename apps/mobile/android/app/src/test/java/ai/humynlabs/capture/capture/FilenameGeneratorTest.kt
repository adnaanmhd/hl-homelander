package ai.humynlabs.capture.capture

import android.app.Application
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.time.LocalDateTime

/**
 * Plan 03-05 Task 2 — `FilenameGenerator.nextBase(now, dirs)` for
 * `YYYYMMDD_HHMMSS_NNN` per `idea-brief.md §8.1` + CAP-17.
 *
 * Recovery strategy = ls-derived (Open Question 2 / D-FS-03 self-healing):
 * counter is recomputed each call from the existing files in `recordings/`
 * + `practice/`, so MMKV-wipe / app-reinstall doesn't collide.
 *
 * Behavior contract (PLAN.md `<behavior>`):
 *  - Empty dirs → NNN=001.
 *  - Existing 005 → NNN=006 (max+1).
 *  - practice/ contributes to today's counter.
 *  - Yesterday's files don't pollute today's counter.
 *  - Nonexistent dirs (listFiles → null) → NNN=001.
 *  - NNN=999 → throws IllegalStateException("filename_seq_exhausted_for_day_…").
 *
 * `application = Application::class` matches Plan 03-04 Task 1's
 * `FragmentedMuxerWrapperTest` pattern — bypasses
 * `MainApplication.onCreate`'s SoLoader.init NPE under Robolectric.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class FilenameGeneratorTest {
    private val ctx = RuntimeEnvironment.getApplication()
    private val rec by lazy { File(ctx.filesDir, "recordings").apply { mkdirs() } }
    private val pra by lazy { File(ctx.filesDir, "practice").apply { mkdirs() } }

    @Before
    fun cleanDirs() {
        rec.listFiles()?.forEach { it.delete() }
        pra.listFiles()?.forEach { it.delete() }
    }

    @Test
    fun `empty dirs returns NNN 001`() {
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `existing 005 returns NNN 006`() {
        File(rec, "20260505_001234_005.mp4").writeBytes(byteArrayOf(0))
        File(rec, "20260505_001234_001.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_006", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `practice dir contributes to todays counter`() {
        File(pra, "20260505_001234_007.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_008", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `yesterdays files dont pollute todays counter`() {
        File(rec, "20260504_120000_999.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `nonexistent dirs return NNN 001`() {
        val ghost = File(ctx.filesDir, "nonexistent")
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(ghost)))
    }

    @Test
    fun `NNN 999 plus one throws IllegalStateException`() {
        File(rec, "20260505_001234_999.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        try {
            FilenameGenerator.nextBase(now, listOf(rec, pra))
            fail("should have thrown")
        } catch (e: IllegalStateException) {
            assertTrue(
                "message should contain filename_seq_exhausted; was ${e.message}",
                e.message?.contains("filename_seq_exhausted") == true
            )
        }
    }

    // ----------------------------------------------------------------
    // Quick task 260522-elm CAPTURE-QA-07 — ULID-prefixed filenames.
    // On-disk artifacts are now `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`.
    // nextBase strips a leading 26-char ULID prefix before the per-day NNN
    // parse so the max+1 accounting stays correct (T-elm-05). A ULID is 26
    // Crockford-base32 chars (`0-9A-HJKMNP-TV-Z`).
    // ----------------------------------------------------------------

    // A syntactically valid 26-char Crockford-base32 ULID.
    private val ulidA = "01HZX0000000000000000000XX"
    private val ulidB = "01HZX0000000000000000000YY"

    @Test
    fun `ULID-prefixed existing 005 returns NNN 006`() {
        File(rec, "${ulidA}_20260505_001234_005.mp4").writeBytes(byteArrayOf(0))
        File(rec, "${ulidB}_20260505_001234_001.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_006", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `ULID-prefixed practice file contributes to todays counter`() {
        File(pra, "${ulidA}_20260505_001234_007.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_008", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `mixed dir honors max across ULID-prefixed and legacy files`() {
        // One ULID-prefixed (003) + one legacy un-prefixed (009) for the same
        // day — the max (009) must win regardless of prefix presence.
        File(rec, "${ulidA}_20260505_001234_003.mp4").writeBytes(byteArrayOf(0))
        File(rec, "20260505_001234_009.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_010", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }

    @Test
    fun `ULID-prefixed yesterdays files dont pollute todays counter`() {
        File(rec, "${ulidA}_20260504_120000_999.mp4").writeBytes(byteArrayOf(0))
        val now = LocalDateTime.of(2026, 5, 5, 0, 30, 20)
        assertEquals("20260505_003020_001", FilenameGenerator.nextBase(now, listOf(rec, pra)))
    }
}
