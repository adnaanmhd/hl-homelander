// ttsVoice — voice selection for the recording-surface TTS cues.
//
// ⚠ DEVIATION from the LOCKED design spec (2026-05-11, explicit project-owner
// directive — debug session handgate-never-passes): `idea-brief.md §13` /
// `engineering-handoff.md §6.3` / REQ REC-14 specify an *en-IN female* voice.
// On the Pixel 10a test device the only installed voice is `en-us-x-tpf-local`
// (Google US English, female) and the engine's en-IN fallback sounded bad to
// the owner, so the cue voice is now **American English, female-leaning** —
// en-US is preferred over en-IN. (Function/file names keep the `EnIn` spelling
// only to avoid churning every import site; the behaviour is en-US-first.)
//
// `pickAndSetEnInVoice()` runs ONCE (at RecordingScreen / app init):
//
//   0. `setDefaultLanguage('en-US')` as a baseline — so the cues are never an
//      en-IN voice even if the specific-voice pick below doesn't take. (Best-
//      effort; ignored if the engine has no en-US data.)
//   1. an `en-US` voice whose name/id looks female-leaning → `setDefaultVoice`
//   2. else any `en-US` voice → `setDefaultVoice` (on Pixel / Google TTS the
//      bundled en-US voice — `en-us-x-tpf` — is the female one)
//   3. else the first `language` that starts with 'en' → `setDefaultVoice`
//   4. else leave the engine default (after the step-0 en-US language pin)
//
// `notInstalled` voices are filtered out first. `setDefaultRate` /
// `setDefaultPitch` are always applied regardless of which branch hits.
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

// `-tpf-` / `-sfg-` are the female en-US Google WaveNet voice ids; the rest are
// common female voice-name tokens (Amazon Polly etc.). No gender field exists.
const FEMALE_HEURISTIC = /female|woman|-fem|-tpf-|-sfg-|fenrir|salli|joanna|amy|raveena/i;

const looksFemale = (v: TtsVoice): boolean => FEMALE_HEURISTIC.test(`${v.name ?? ''}${v.id ?? ''}`);

/**
 * Pick + set the recording-cue TTS voice (en-US female-leaning per the owner
 * override — see file header), then apply the §13 rate/pitch. Safe to call
 * before the engine reports voices (falls back to the engine default after the
 * en-US language pin). Idempotent enough to call once at RecordingScreen mount.
 */
export async function pickAndSetEnInVoice(): Promise<void> {
  await Tts.getInitStatus();

  let voices: TtsVoice[] = [];
  try {
    voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
  } catch {
    // Older Android / no TTS voices installed → keep the en-US language pin below.
    voices = [];
  }
  const usable = voices.filter((v) => !v.notInstalled);

  const id =
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 1. en-US female-ish
    usable.find((v) => v.language === 'en-US')?.id ?? // 2. any en-US (bundled Google en-US is female)
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 3. first en-*

  // 0. Baseline: pin the engine to en-US so the cues are never an en-IN voice
  //    even if the specific-voice pin below doesn't stick. Best-effort — each
  //    TTS call is individually guarded so `pickAndSetEnInVoice` never rejects.
  try {
    await Tts.setDefaultLanguage('en-US');
  } catch {
    /* best-effort — engine may lack en-US data */
  }
  if (id) {
    try {
      await Tts.setDefaultVoice(id);
    } catch {
      /* best-effort — the step-0 en-US language pin stands */
    }
  }
  // (no en-* voice at all) → the step-0 en-US language pin stands.

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
