package ai.humynlabs.capture.capture

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaRecorder

/**
 * Phase 3 CAP-03 — AAC-LC encoder + AudioRecord wrapper.
 *
 * MediaFormat keys locked per `idea-brief.md §6.3`:
 *   - AAC-LC profile / 48 kHz / mono / 128 kbps
 *   - 16 KiB max input size — covers a single AAC frame (1024 samples
 *     × 2 bytes = 2 KiB at 48 kHz mono PCM-16; 16 KiB is generous
 *     headroom + matches Android's idiomatic default for the field).
 *
 * Audio source mode (RESEARCH.md Standard Stack lines 207–212):
 *   1. UNPROCESSED if `PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED == "true"`
 *      (most Pixel + Samsung mid-tier devices) — raw mic, no AGC, flat
 *      frequency response. Threat T-3.7-03 disposition: accept (capture
 *      quality non-negotiable per CLAUDE.md).
 *   2. VOICE_RECOGNITION fallback — also flat freq response, no AGC.
 *   Never CAMCORDER (applies AGC + may engage noise suppression that
 *   alters byte-for-byte CAP-18 invariants).
 *
 * `buildMediaFormat()` is the pure-fn seam for config-audit tests.
 * `pickAudioSourceFor(propertyLookup)` exposes a lambda-driven seam
 * for unit testing without mocking AudioManager.
 */
object AacEncoder {
    const val MIME = MediaFormat.MIMETYPE_AUDIO_AAC
    const val SAMPLE_RATE_HZ = 48_000
    const val CHANNEL_COUNT = 1
    const val BIT_RATE = 128_000
    const val MAX_INPUT_SIZE = 16384

    /**
     * Build the locked-spec MediaFormat. Pure function — no MediaCodec
     * allocation. Safe to call from tests.
     */
    fun buildMediaFormat(): MediaFormat = MediaFormat
        .createAudioFormat(MIME, SAMPLE_RATE_HZ, CHANNEL_COUNT)
        .apply {
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, MAX_INPUT_SIZE)
        }

    /**
     * Allocate + configure a real AAC-LC encoder. Caller owns lifecycle.
     */
    fun configure(): MediaCodec {
        val codec = MediaCodec.createEncoderByType(MIME)
        codec.configure(buildMediaFormat(), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
        return codec
    }

    /**
     * Build an AudioRecord with the spec-locked PCM format and the
     * UNPROCESSED → VOICE_RECOGNITION audio source ladder.
     *
     * Buffer size: `getMinBufferSize(...) * 4` — 4× the platform
     * minimum to absorb scheduling jitter on the recording thread
     * without dropping samples (RESEARCH.md Standard Stack line 215).
     */
    fun makeAudioRecord(audioMgr: AudioManager): AudioRecord {
        val source = pickAudioSource(audioMgr)
        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        // getMinBufferSize returns ERROR (-2) or ERROR_BAD_VALUE (-2)
        // for unsupported formats; clamp to a safe positive value so
        // the Builder doesn't throw on devices that report -2 even
        // though 48 kHz mono PCM-16 is universally supported.
        val bufSize = if (minBuf > 0) minBuf * 4 else 32_768
        return AudioRecord.Builder()
            .setAudioSource(source)
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE_HZ)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .build(),
            )
            .setBufferSizeInBytes(bufSize)
            .build()
    }

    /**
     * Choose the audio source by reading
     * `PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED` from a real
     * AudioManager. Visible-for-tests delegate calls
     * [pickAudioSourceFor] with the AudioManager-bound lookup.
     */
    fun pickAudioSource(audioMgr: AudioManager): Int =
        pickAudioSourceFor { key -> audioMgr.getProperty(key) }

    /**
     * Lambda-driven seam — caller supplies a `(propertyKey) -> value?`
     * lookup. Keeps tests free of AudioManager mocking on a classpath
     * without `mockito-kotlin`.
     */
    fun pickAudioSourceFor(propertyLookup: (String) -> String?): Int =
        if (propertyLookup(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") {
            MediaRecorder.AudioSource.UNPROCESSED
        } else {
            MediaRecorder.AudioSource.VOICE_RECOGNITION
        }
}
