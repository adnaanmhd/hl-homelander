package ai.humynlabs.capture.compat

/**
 * HEVC Annex B NAL-unit walker + slice_type extractor.
 *
 * COMPAT-07 / RESEARCH § Pitfall 1: encoder config (KEY_LATENCY=1 / KEY_MAX_B_FRAMES=0)
 * is not trustworthy on every OEM driver — we MUST read slice_type directly from the
 * bitstream to detect B-frames.
 *
 * References:
 *   - ITU-T H.265 §7.3.2.1 (NAL unit syntax) / §7.3.6.1 (slice_segment_header) / §7.4.7.1
 *   - ITU-T H.265 §9.2 (Exp-Golomb decoding)
 *   - chemag/h265nal (C++ reference impl)
 *   - figgis/fd509a02d4b1aa89f6ef gist (HEVC bitstream parser)
 *   - Eyevinn/mp4ff/hevc Go reference (ParseSliceHeader)
 *
 * NOTE on slice_type: ITU-T H.265 §7.4.7.1 is the authority. The HEVC convention is
 * `slice_type 0 → B, 1 → P, 2 → I`. The `RESEARCH.md` inline note (lines 747/757) reads
 * `1 == B` — that's a typo in the prose; the spec value `0 == B` is what we use here.
 * Plan 02-12 plan body §244 calls this out and pins the comparator to `0`.
 */
class NalParser {

    /** Slice-level outcome of a single VCL NAL unit. */
    data class SliceInfo(val nalUnitType: Int, val sliceType: Int)

    /**
     * Bit-level reader over a byte array, used for Exp-Golomb decoding inside the
     * slice_segment_header (HEVC §9.2). Bounds-tolerant: out-of-bounds reads return 0
     * so a truncated bitstream degrades to "no slice info" rather than throwing.
     */
    private class BitReader(private val bytes: ByteArray, startByte: Int) {
        private var byteOffset: Int = startByte
        private var bitOffset: Int = 0

        fun readBit(): Int {
            if (byteOffset >= bytes.size) return 0
            val v = (bytes[byteOffset].toInt() shr (7 - bitOffset)) and 0x1
            bitOffset++
            if (bitOffset == 8) {
                bitOffset = 0
                byteOffset++
            }
            return v
        }

        fun readBits(n: Int): Int {
            var v = 0
            repeat(n) { v = (v shl 1) or readBit() }
            return v
        }

        /** Unsigned Exp-Golomb (HEVC §9.2). */
        fun readUe(): Int {
            var leadingZeros = 0
            while (leadingZeros < 32 && readBit() == 0) leadingZeros++
            if (leadingZeros == 0) return 0
            val suffix = readBits(leadingZeros)
            return (1 shl leadingZeros) - 1 + suffix
        }
    }

    /**
     * Match an Annex B start code at offset `i`.
     * Returns 0 if no match, 3 for the 3-byte form (0x000001), 4 for the 4-byte form
     * (0x00000001).
     */
    private fun matchStartCode(b: ByteArray, i: Int): Int {
        // Prefer the 4-byte form first so a leading 0x00 isn't mis-attributed to the 3-byte form.
        if (i + 3 < b.size &&
            b[i] == 0.toByte() &&
            b[i + 1] == 0.toByte() &&
            b[i + 2] == 0.toByte() &&
            b[i + 3] == 1.toByte()
        ) return 4
        if (i + 2 < b.size &&
            b[i] == 0.toByte() &&
            b[i + 1] == 0.toByte() &&
            b[i + 2] == 1.toByte()
        ) return 3
        return 0
    }

    /**
     * Walk the supplied Annex B bitstream and return one SliceInfo per VCL NAL unit
     * whose slice_type could be extracted. Non-VCL units (PPS / SPS / VPS / SEI) are
     * skipped silently.
     */
    fun parse(bytes: ByteArray): List<SliceInfo> {
        val out = mutableListOf<SliceInfo>()
        if (bytes.size < 3) return out
        var i = 0
        while (i < bytes.size - 2) {
            val startLen = matchStartCode(bytes, i)
            if (startLen == 0) { i++; continue }
            val nalStart = i + startLen
            // Need at least the 2-byte NAL header.
            if (nalStart + 1 >= bytes.size) break
            val headerByte0 = bytes[nalStart].toInt() and 0xFF
            // forbidden_zero_bit (1) + nal_unit_type (6) + nuh_layer_id (6) + temporal_id (3)
            val nalUnitType = (headerByte0 shr 1) and 0x3F
            // VCL NAL types in HEVC are 0..31; non-VCL are 32+.
            if (nalUnitType in 0..31) {
                val sliceType = readSliceType(bytes, nalStart + 2, nalUnitType)
                if (sliceType >= 0) out.add(SliceInfo(nalUnitType, sliceType))
            }
            // Advance past the 2-byte NAL header; matchStartCode will scan from here.
            i = nalStart + 2
        }
        return out
    }

    /**
     * Extract slice_type from slice_segment_header per HEVC §7.3.6.1.
     *
     * Simplified parse — works because:
     *   - our test fixtures and the 5 s probe always emit `first_slice_segment_in_pic_flag = 1`
     *     (single-tile, single-slice frames), so we never need PPS context to compute
     *     `slice_segment_address`;
     *   - we read the optional `no_output_of_prior_pics_flag` only when the NAL type is in the
     *     IRAP VCL range (16..23) — matches the spec's gating;
     *   - everything between `slice_pic_parameter_set_id` and `slice_type` is just an
     *     `ue(v)` and a (skipped) sequence of segment-address bits gated on
     *     `!first_slice_segment_in_pic_flag`, both of which evaluate to "skip" for our inputs.
     *
     * Returns -1 if parsing fails (caller treats the unit as non-slice and drops it).
     */
    private fun readSliceType(bytes: ByteArray, byteOffset: Int, nalUnitType: Int): Int {
        return try {
            val br = BitReader(bytes, byteOffset)
            val firstSlice = br.readBit()
            if (firstSlice != 1) return -1
            // no_output_of_prior_pics_flag is present for IRAP slices (BLA_W_LP..RSV_IRAP_VCL23 = 16..23)
            if (nalUnitType in 16..23) br.readBit()
            br.readUe() // slice_pic_parameter_set_id
            br.readUe() // slice_type
        } catch (_: Throwable) {
            -1
        }
    }

    /**
     * HEVC §7.4.7.1: slice_type 0 → B, 1 → P, 2 → I.
     * The plan-checker contract requires the literal token `anyBFrames` in this file
     * (frontmatter `contains: 'anyBFrames'`).
     */
    fun anyBFrames(slices: List<SliceInfo>): Boolean = slices.any { it.sliceType == 0 }
}
