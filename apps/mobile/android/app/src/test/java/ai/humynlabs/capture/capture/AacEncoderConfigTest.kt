package ai.humynlabs.capture.capture

import android.app.Application
import android.media.AudioManager
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaRecorder
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/**
 * Plan 03-08 Task 1 — CAP-03 AAC-LC encoder MediaFormat audit + audio
 * source mode selection.
 *
 * Locks the AAC config against `idea-brief.md §6.3`:
 *   - AAC-LC profile / 48 kHz / mono / 128 kbps
 * Locks the audio-source fallback against `RESEARCH.md` Standard Stack
 * lines 207–212:
 *   - UNPROCESSED if PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED == "true"
 *   - VOICE_RECOGNITION otherwise (never CAMCORDER — applies AGC)
 *
 * AudioManager is the platform-shadowed Robolectric system service —
 * we drive the property by invoking the real `AudioManager.setProperty`-
 * style accessor through the Robolectric shadow's underlying system
 * properties map. To keep the test airtight against Robolectric
 * versioning differences, we wrap AudioManager in a thin lambda-based
 * fake (no mockito-kotlin dependency on the test classpath — verified
 * against `apps/mobile/android/app/build.gradle` test deps).
 *
 * `application = Application::class` matches Plan 03-04's pattern.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], application = Application::class)
class AacEncoderConfigTest {

    @Test
    fun `format declares AAC-LC 48kHz mono 128kbps`() {
        val f = AacEncoder.buildMediaFormat()
        assertEquals(MediaFormat.MIMETYPE_AUDIO_AAC, f.getString(MediaFormat.KEY_MIME))
        assertEquals(48_000, f.getInteger(MediaFormat.KEY_SAMPLE_RATE))
        assertEquals(1, f.getInteger(MediaFormat.KEY_CHANNEL_COUNT))
        assertEquals(128_000, f.getInteger(MediaFormat.KEY_BIT_RATE))
        assertEquals(
            MediaCodecInfo.CodecProfileLevel.AACObjectLC,
            f.getInteger(MediaFormat.KEY_AAC_PROFILE),
        )
        assertEquals(16384, f.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE))
    }

    @Test
    fun `companion constants match locked spec values`() {
        assertEquals(MediaFormat.MIMETYPE_AUDIO_AAC, AacEncoder.MIME)
        assertEquals(48_000, AacEncoder.SAMPLE_RATE_HZ)
        assertEquals(1, AacEncoder.CHANNEL_COUNT)
        assertEquals(128_000, AacEncoder.BIT_RATE)
    }

    @Test
    fun `pickAudioSource returns UNPROCESSED when device supports it`() {
        val am = AudioManagerStub(unprocessedProperty = "true")
        assertEquals(
            MediaRecorder.AudioSource.UNPROCESSED,
            AacEncoder.pickAudioSourceFor(am::getProperty),
        )
    }

    @Test
    fun `pickAudioSource falls back to VOICE_RECOGNITION when property is null`() {
        val am = AudioManagerStub(unprocessedProperty = null)
        assertEquals(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            AacEncoder.pickAudioSourceFor(am::getProperty),
        )
    }

    @Test
    fun `pickAudioSource falls back to VOICE_RECOGNITION when property is 'false'`() {
        val am = AudioManagerStub(unprocessedProperty = "false")
        assertEquals(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            AacEncoder.pickAudioSourceFor(am::getProperty),
        )
    }

    @Test
    fun `pickAudioSource Robolectric default falls back to VOICE_RECOGNITION`() {
        // Robolectric's default ShadowAudioManager returns null for
        // PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED — the canonical
        // un-overridden test environment exercises the fallback path.
        val am = RuntimeEnvironment.getApplication()
            .getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
        assertEquals(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            AacEncoder.pickAudioSource(am),
        )
    }

    /**
     * Hand-rolled fake — `mockito-kotlin` is not on the test classpath
     * (verified against `apps/mobile/android/app/build.gradle`).
     * AacEncoder.pickAudioSourceFor takes a `(String) -> String?` lambda
     * so callers can inject any property source without mocking the
     * full AudioManager API.
     */
    private class AudioManagerStub(private val unprocessedProperty: String?) {
        fun getProperty(key: String): String? =
            if (key == AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) {
                unprocessedProperty
            } else null
    }
}
