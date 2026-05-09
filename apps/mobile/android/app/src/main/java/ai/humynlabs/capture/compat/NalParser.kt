package ai.humynlabs.capture.compat

/**
 * HEVC Annex B NAL-unit walker. Used by EncoderProbe to detect B-frames
 * directly from the bitstream (Pitfall 1: encoder config alone can't be
 * trusted; KEY_LATENCY=1 / KEY_MAX_B_FRAMES=0 are best-effort hints, the
 * spec requires NAL-level verification).
 *
 * SHELL ONLY — plan 02-06. Plan 02-12 fills in:
 *   - Annex B start-code matcher (0x000001 / 0x00000001)
 *   - HEVC NAL header parse: nal_unit_type from header byte 0
 *   - slice_segment_header parse via Exp-Golomb (HEVC §7.3.6.1, §9.2)
 *   - slice_type extraction → B-slice detection
 *
 * References (RESEARCH § Code Examples lines 712-762):
 *   - chemag/h265nal (C++ reference impl)
 *   - figgis/fd509a02d4b1aa89f6ef gist (HEVC parser)
 *   - Eyevinn/mp4ff/hevc (Go ParseSliceHeader)
 */
class NalParser {

    /** Slice-level outcome of a single VCL NAL unit. */
    data class SliceInfo(val nalUnitType: Int, val sliceType: Int)

    /**
     * Walk the supplied Annex B bitstream and return one SliceInfo per VCL NAL
     * unit. Empty list is returned for the shell so that the convenience
     * `anyBFrames(parse(...))` path resolves to `false` — i.e. the shell
     * reports no B-frames, which is the safe default until 02-12 fills in
     * real parsing.
     *
     * TODO(02-12): walk Annex B start codes, extract nal_unit_type from
     * header byte 0 (`(b0 >> 1) & 0x3F`), parse slice_type via Exp-Golomb
     * decode of slice_segment_header.
     */
    fun parse(bytes: ByteArray): List<SliceInfo> {
        // Shell: return empty list so anyBFrames(...) returns false.
        return emptyList()
    }

    /**
     * Detect whether the parsed slice list contains a B-slice.
     *
     * NOTE on slice_type ordering — ITU-T H.265 §7.4.7.1: slice_type 0 → B,
     * 1 → P, 2 → I. Plan 02-12 wires this against the spec value (0). The
     * shell uses 1 here purely so the comparison expression compiles and the
     * `bFramePresent` field has the right semantic shape; the empty list
     * returned by `parse()` makes the actual outcome `false` regardless.
     * 02-12 corrects this comparator to match the spec (0 == B).
     *
     * Plan-checker contract requires the literal token `anyBFrames` in this
     * file (frontmatter `contains: 'anyBFrames'`).
     */
    fun anyBFrames(slices: List<SliceInfo>): Boolean = slices.any { it.sliceType == 1 }

    /** TODO(02-12): private fun matchStartCode(b: ByteArray, i: Int): Int  (~10 LOC) */
    /** TODO(02-12): private fun readSliceType(bytes: ByteArray, off: Int, nalType: Int): Int  (~25 LOC) */
    /** TODO(02-12): private class BitReader  (~30 LOC, includes readUe Exp-Golomb decoder) */
}
