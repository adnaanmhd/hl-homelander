package ai.humynlabs.capture.capture

import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Phase 3 D-FS-03 / CAP-17 — `YYYYMMDD_HHMMSS_NNN` per-day filename
 * sequence (Plan 03-05 Task 2; idea-brief.md §8.1).
 *
 * Recovery strategy = ls-derived (Open Question 2 / D-FS-03 self-healing).
 * Every call recomputes `max(NNN) + 1` over today's files in the supplied
 * dirs. MMKV-backed cache is a non-load-bearing optimization; the ls scan
 * is the authoritative source so a wiped MMKV cache does not collide.
 *
 * `dirs` = listOf(filesDir/recordings/, filesDir/practice/) — today's NNN
 * counts across both, so practice files share the day-sequence namespace
 * with real recordings (filenames remain globally unique within a day).
 *
 * Defensive cap: NNN is a 3-digit per-day sequence per CAP-17. At the
 * 10-min default segment, 999/day is unreachable in practice; throwing
 * here is purely defensive — the start() Promise rejects with
 * `internal_error` (Phase 3 Plan 03-08 wires `errorCodeFor`), and
 * Phase 4's RecordingScreen surfaces a "filename sequence exhausted —
 * please contact support" toast (CONTEXT.md "Edge Cases").
 */
object FilenameGenerator {
    private val basePattern = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
    private val datePattern = DateTimeFormatter.ofPattern("yyyyMMdd")
    private const val MAX_PER_DAY = 999

    /**
     * Returns the next filename base for the current segment.
     *
     * @param now wall-clock LocalDateTime to stamp into the filename.
     * @param dirs directories to scan for today's existing files. Each may
     *   be nonexistent (`listFiles()` returning null is treated as empty).
     * @return `YYYYMMDD_HHMMSS_NNN` string (no extension).
     * @throws IllegalStateException ("filename_seq_exhausted_for_day_YYYYMMDD")
     *   if today's max NNN is already 999.
     */
    fun nextBase(now: LocalDateTime, dirs: List<File>): String {
        val today = now.toLocalDate().format(datePattern)
        val maxNNN = dirs
            .flatMap { dir -> dir.listFiles()?.toList() ?: emptyList() }
            .map { it.nameWithoutExtension }
            .filter { it.startsWith("${today}_") }
            // Filename shape: YYYYMMDD_HHMMSS_NNN — the third underscore-
            // delimited token (index 2) is the sequence.
            .mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }
            .maxOrNull() ?: 0

        if (maxNNN >= MAX_PER_DAY) {
            throw IllegalStateException("filename_seq_exhausted_for_day_${today}")
        }
        val nnn = "%03d".format(maxNNN + 1)
        return "${now.format(basePattern)}_${nnn}"
    }
}
