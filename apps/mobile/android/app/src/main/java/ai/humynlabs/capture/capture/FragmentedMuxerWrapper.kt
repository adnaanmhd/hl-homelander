package ai.humynlabs.capture.capture

import android.media.MediaCodec
import android.media.MediaFormat
import androidx.media3.common.util.MediaFormatUtil
import androidx.media3.common.util.UnstableApi
import androidx.media3.muxer.BufferInfo as MuxerBufferInfo
import androidx.media3.muxer.FragmentedMp4Muxer
import androidx.media3.muxer.Muxer
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer

/**
 * Phase 3 — fragmented MP4 muxer wrapper (Plan 03-04 Task 1; CAP-02).
 *
 * RESEARCH.md Pitfall 1: stock [android.media.MediaMuxer] does NOT support
 * fragmented MP4. CAP-02 ("periodic moov flush every 30 s") requires
 * [androidx.media3.muxer.FragmentedMp4Muxer] with
 * [FragmentedMp4Muxer.Builder.setFragmentDurationMs] = 30 000 ms.
 *
 * The wrapper exposes a [android.media.MediaMuxer]-shaped surface
 * (`addTrack` / `writeSampleData` / `start` / `stop` / `release`) so the
 * encoder→muxer pump loop in Phase 2's `EncoderProbe.kt`
 * (`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt`,
 * lines 162–182) stays structurally identical for Phase 3.
 *
 * **API translation surface (verified against media3 1.10.0 source on
 * 2026-05-10):**
 * - `Muxer.addTrack(Format)` consumes [androidx.media3.common.Format], not
 *   the framework [MediaFormat]. The wrapper converts via
 *   [MediaFormatUtil.createFormatFromMediaFormat].
 * - `Muxer.writeSampleData(int, ByteBuffer, BufferInfo)` consumes the
 *   muxer-package [androidx.media3.muxer.BufferInfo], a 3-arg type
 *   `(presentationTimeUs, size, flags)`. There is **no `offset` field**:
 *   the buffer's position handles offset (the caller positions the buffer
 *   to the start of the encoded sample before writing — same pattern the
 *   Phase-2 `EncoderProbe` already uses). The plan-doc's earlier 4-arg
 *   constructor reference was based on stale state-of-the-art notes; the
 *   1.10.0 release shipped the 3-arg form.
 * - The new `Muxer` interface has no `start()` / `stop()` / `release()` —
 *   only `addTrack` / `writeSampleData` / `close`. The wrapper exposes
 *   [start] as a no-op and [stop] / [release] both delegating to [close]
 *   so the existing Phase-2 pump (`muxer.start()` after the first
 *   `addTrack`, `muxer.stop()` + `muxer.release()` at the end) compiles
 *   drop-in against the new wrapper.
 *
 * Track this wrapper as the "single most important architectural call"
 * per RESEARCH.md Pitfall 1 / CONTEXT.md "the very first Wave 2 task is
 * the muxer-wrapper task — encoder/audio/IMU bind on top of it." Future
 * plans (03-05 onward) write samples through this surface; do not bypass
 * to FragmentedMp4Muxer directly.
 */
@OptIn(UnstableApi::class)
class FragmentedMuxerWrapper private constructor(
    private val muxer: Muxer,
    private val output: FileOutputStream,
) {

    /**
     * Adds a track described by a framework [MediaFormat] (the shape
     * `MediaCodec.outputFormat` returns when the encoder emits
     * `INFO_OUTPUT_FORMAT_CHANGED`). Returns the muxer's track id, which
     * the caller must use in subsequent [writeSampleData] calls.
     */
    fun addTrack(format: MediaFormat): Int {
        val media3Format = MediaFormatUtil.createFormatFromMediaFormat(format)
        return muxer.addTrack(media3Format)
    }

    /**
     * Writes one encoded sample. The caller must position [buffer] to the
     * start of the sample (i.e. `buffer.position(info.offset)` and
     * `buffer.limit(info.offset + info.size)`) before invoking — same as
     * the Phase-2 [`EncoderProbe.kt`][ai.humynlabs.capture.compat.EncoderProbe]
     * pump pattern.
     *
     * The wrapper translates [MediaCodec.BufferInfo] to the muxer-package
     * [androidx.media3.muxer.BufferInfo] (3-arg `(pts, size, flags)`).
     * `info.offset` is implicit in the buffer's position and not preserved
     * on the muxer side — this matches the framework `MediaMuxer`
     * semantics the EncoderProbe was already targeting.
     */
    fun writeSampleData(trackId: Int, buffer: ByteBuffer, info: MediaCodec.BufferInfo) {
        val muxerInfo = MuxerBufferInfo(
            /* presentationTimeUs = */ info.presentationTimeUs,
            /* size = */ info.size,
            /* flags = */ info.flags,
        )
        muxer.writeSampleData(trackId, buffer, muxerInfo)
    }

    /**
     * No-op for surface compatibility with the legacy
     * [android.media.MediaMuxer.start] contract. The new `Muxer` interface
     * is ready for [writeSampleData] as soon as [Builder.build] returns,
     * so there is no separate "start" step. Kept on the wrapper so the
     * existing Phase-2 pump (`muxer.start()` after the first `addTrack`)
     * compiles unmodified against this wrapper.
     */
    fun start() {
        // intentionally empty; Muxer is started implicitly by build()
    }

    /**
     * Closes the muxer and the underlying [FileOutputStream] / channel.
     * Aliased to [close] so callers using the legacy `MediaMuxer` lifecycle
     * (`stop()` + `release()`) keep working without modification.
     */
    fun stop() = close()

    /** Alias for [close]; see [stop]. */
    fun release() = close()

    /**
     * Closes the muxer and its underlying file handles. Idempotent: calling
     * [stop] then [release] (or vice versa) is safe — the wrapper guards
     * against re-entering muxer.close() / output.close().
     *
     * **WR-09 fix.** media3 1.10.0's `Muxer.close()` is NOT documented as
     * idempotent — a second call throws `IllegalStateException` per the
     * upstream contract. Callers in CaptureSession.closeSegmentResources
     * already wrapped the call in try/catch so the bug never surfaced as
     * a user-visible crash, but the wrapper docstring claimed safety it
     * did not actually provide. Add an explicit @Volatile closed guard
     * so the second call is a true no-op.
     */
    @Volatile private var closed = false

    fun close() {
        if (closed) return
        closed = true
        try {
            muxer.close()
        } finally {
            try {
                output.close()
            } catch (_: Throwable) {
                // FileOutputStream.close() can throw if already closed by the
                // muxer's WritableByteChannel; swallow to keep the wrapper
                // close idempotent.
            }
        }
    }

    companion object {
        /**
         * CAP-02 — periodic moov flush every 30 s. Locked per
         * `idea-brief.md §6.6` ("mid-recording resilience: fragmented
         * MP4 with 30 s moof boundary").
         */
        const val FRAGMENT_DURATION_MS_30S: Long = 30_000L

        /**
         * Constructs a fragmented MP4 muxer with 30 s moof intervals.
         *
         * @param mp4File output file (created if absent; truncated if
         *   present — same semantics as `FileOutputStream(File)`).
         */
        fun create(mp4File: File): FragmentedMuxerWrapper {
            val output = FileOutputStream(mp4File)
            val muxer = FragmentedMp4Muxer.Builder(output.channel)
                .setFragmentDurationMs(FRAGMENT_DURATION_MS_30S)
                .build()
            return FragmentedMuxerWrapper(muxer, output)
        }
    }
}
