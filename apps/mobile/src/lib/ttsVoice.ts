// ttsVoice — REC-14 en-IN voice selection for the recording-surface TTS cues.
//
// `pickAndSetEnInVoice()` applies the `engineering-handoff.md §6.3` /
// `idea-brief.md §13` fallback chain ONCE (at RecordingScreen / app init):
//
//   1. `language === 'en-IN'` AND the name/id looks female-leaning
//   2. any `language === 'en-IN'`
//   3. `language === 'en-US'` AND the name/id looks female-leaning
//   4. the first `language` that starts with 'en'
//
// `notInstalled` voices are filtered out first. If `Tts.voices()` returns []
// (older Android, or no installed voices) the chain yields nothing and the TTS
// engine default is left in place — `setDefaultRate` / `setDefaultPitch` are
// still applied.
//
// ⚠ rate-scale note (04-RESEARCH Pattern 4 CORRECTION): `react-native-tts`'s
// `setDefaultRate(rate)` expects a cross-platform-translated value in
// 0.01–0.99 (passing 1.0 is out of range). To get Android's raw normal speed
// (which matches `idea-brief.md §13`'s "rate 1.0") pass
// `setDefaultRate(1.0, true)` with `skipTransform = true`. `setDefaultPitch(0.95)`
// is fine (Android `TextToSpeech.setPitch` accepts it). Volume is NOT a
// `setDefaultVolume` — pass `androidParams.KEY_PARAM_VOLUME: 0.85` per
// `speak()` call (see `speakCue` below; RecordingScreen / useRecordingLifecycle
// use that helper so the androidParams aren't repeated at each call site).

import Tts from 'react-native-tts';

// react-native-tts `voices()` element shape (Android): `{ id, name?, language
// (BCP-47), quality(300|500), latency?(100-500), networkConnectionRequired?,
// notInstalled? }`. No gender field — heuristic on language + name/id.
interface TtsVoice {
  id?: string;
  name?: string;
  language?: string;
  notInstalled?: boolean;
}

const FEMALE_HEURISTIC = /female|woman|-fem|fenrir|salli|joanna|amy|raveena/i;

const looksFemale = (v: TtsVoice): boolean => FEMALE_HEURISTIC.test(`${v.name ?? ''}${v.id ?? ''}`);

/**
 * Pick + set the en-IN female-leaning TTS voice per the REC-14 fallback chain,
 * then apply the §13 rate/pitch. Safe to call before the engine reports
 * voices (falls back to the engine default). Idempotent enough to call once at
 * RecordingScreen mount; calling it again just re-applies the same choice.
 */
export async function pickAndSetEnInVoice(): Promise<void> {
  await Tts.getInitStatus();

  let voices: TtsVoice[] = [];
  try {
    voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
  } catch {
    // Older Android / no TTS voices installed → fall through to engine default.
    voices = [];
  }
  const usable = voices.filter((v) => !v.notInstalled);

  const id =
    usable.find((v) => v.language === 'en-IN' && looksFemale(v))?.id ?? // 1. en-IN female-ish
    usable.find((v) => v.language === 'en-IN')?.id ?? // 2. any en-IN
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 3. en-US female-ish
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 4. first en-*

  if (id) {
    await Tts.setDefaultVoice(id);
  }
  // skipTransform=true → Android's raw 1.0 (== normal speed). See the note above.
  Tts.setDefaultRate(1.0, true);
  Tts.setDefaultPitch(0.95);
}

/**
 * Speak a recording-surface voice cue at the §13 volume (0.85). The
 * `androidParams` block carries the volume; rate/pitch/voice were already set
 * by `pickAndSetEnInVoice()`. RecordingScreen (plan 04-09) /
 * `useRecordingLifecycle`'s `voiceCue` callback use this so the androidParams
 * aren't repeated at every call site (and so the cue text can also be
 * duplicated on-screen as the VoiceCue pill — REC-15).
 */
export function speakCue(text: string): void {
  Tts.speak(text, {
    // `react-native-tts`'s `Options` typedef lists `iosVoiceId` + `rate` as
    // required, but the native side treats them as optional — `rate: 1.0`
    // matches the default (set by `setDefaultRate(1.0, true)` above);
    // `iosVoiceId: ''` is inert (iOS is descoped at MVP — Android-only APK).
    iosVoiceId: '',
    rate: 1.0,
    androidParams: {
      KEY_PARAM_VOLUME: 0.85,
      KEY_PARAM_PAN: 0,
      KEY_PARAM_STREAM: 'STREAM_MUSIC',
    },
  });
}
