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
     * Quick task 260522-elm CAPTURE-QA-07 — on-disk artifacts are now
     * prefixed with the segment's 26-char ULID `recordingId`:
     * `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`. [nextBase] still RETURNS
     * the un-prefixed `YYYYMMDD_HHMMSS_NNN` tail (CaptureSession.openSegment
     * prepends the `{recordingId}_`); the ls-scan below strips a leading
     * 26-char ULID prefix from each on-disk name BEFORE the per-day NNN parse
     * so the `max(NNN)+1` accounting stays correct.
     *
     * A ULID is 26 Crockford-base32 chars (`0-9A-HJKMNP-TV-Z`). The strip is
     * backward-compatible: legacy un-prefixed files (which do NOT match the
     * `^<26-char-ULID>_` shape) fall through to the as-is path and parse via
     * the original index-2 token logic. Mixed dirs (some prefixed, some
     * legacy) are handled — the max across both is honored (T-elm-05).
     */
    private val ulidPrefixPattern = Regex("^[0-9A-HJKMNP-TV-Z]{26}_")

    /**
     * Returns the next filename base for the current segment.
     *
     * @param now wall-clock LocalDateTime to stamp into the filename.
     * @param dirs directories to scan for today's existing files. Each may
     *   be nonexistent (`listFiles()` returning null is treated as empty).
     * @return `YYYYMMDD_HHMMSS_NNN` string (no extension; CaptureSession
     *   prepends the `{recordingId}_` prefix per CAPTURE-QA-07).
     * @throws IllegalStateException ("filename_seq_exhausted_for_day_YYYYMMDD")
     *   if today's max NNN is already 999.
     */
    fun nextBase(now: LocalDateTime, dirs: List<File>): String {
        val today = now.toLocalDate().format(datePattern)
        val maxNNN = dirs
            .flatMap { dir -> dir.listFiles()?.toList() ?: emptyList() }
            .map { it.nameWithoutExtension }
            // CAPTURE-QA-07 — strip a leading 26-char ULID prefix (e.g.
            // `01HZX0000000000000000000XX_20260505_001234_005` → date-tail
            // `20260505_001234_005`). Legacy un-prefixed files pass through
            // unchanged (backward-compat).
            .map { stripUlidPrefix(it) }
            .filter { it.startsWith("${today}_") }
            // Date-tail shape: YYYYMMDD_HHMMSS_NNN — the third underscore-
            // delimited token (index 2) is the sequence.
            .mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }
            .maxOrNull() ?: 0

        if (maxNNN >= MAX_PER_DAY) {
            throw IllegalStateException("filename_seq_exhausted_for_day_${today}")
        }
        val nnn = "%03d".format(maxNNN + 1)
        return "${now.format(basePattern)}_${nnn}"
    }

    /**
     * Drops a leading `<26-char-ULID>_` prefix from [nameWithoutExtension]
     * if present, returning the `YYYYMMDD_HHMMSS_NNN` date-tail. Names that
     * do NOT carry a ULID prefix (legacy files) are returned unchanged.
     */
    private fun stripUlidPrefix(nameWithoutExtension: String): String =
        ulidPrefixPattern.find(nameWithoutExtension)?.let {
            nameWithoutExtension.substring(it.range.last + 1)
        } ?: nameWithoutExtension
}
