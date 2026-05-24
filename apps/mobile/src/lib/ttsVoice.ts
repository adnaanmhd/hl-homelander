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
// Plan 07-06 (I18N-06 / D-31) — extension: per-locale 5-step fallback chain.
// `pickAndSetLocaleVoice(activeLocale)` is the new public entry point. The
// existing `pickAndSetEnInVoice()` is preserved as a thin shim that calls
// `pickAndSetLocaleVoice('en')` (D-31 — "import-call stability" so the
// existing RecordingScreen call site does NOT change at the symbol level
// across the plan boundary). For the English locale the owner-deviation
// behavior above is preserved verbatim: `setDefaultLanguage('en-US')` (not
// 'en'), step 1 = en-US-female-leaning, step 2 = any en-US, step 3 = first
// en-*. For the other 7 locales, the chain prepends two steps:
//
//   1. a voice matching `activeLocale` that looks female-leaning
//   2. any voice matching `activeLocale`
//   3. an en-US female-leaning voice  (the existing owner chain — preserved)
//   4. any en-US voice                (the existing owner chain — preserved)
//   5. first en-* voice               (the existing owner chain — preserved)
//
// When the chain falls past step 2 (no locale voice installed) on a non-'en'
// locale, emit a Crashlytics breadcrumb `{ event: 'tts_locale_fallback',
// locale, fallback: true }` per D-31 so we can size the "locale TTS missing"
// fleet population for §v2 voice-pack download work. The 'en' locale never
// logs a breadcrumb (it IS the always-true fallback target — would flood
// Crashlytics).
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

import crashlytics from '@react-native-firebase/crashlytics';
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
 * Pick + set the recording-cue TTS voice for the active locale, then apply
 * the §13 rate/pitch. Walks the 5-step chain documented at the top of the
 * file: locale-female → locale-any → en-US-female → en-US-any → first en-*.
 *
 * For the English locale (`activeLocale === 'en'`) the language is pinned
 * to `'en-US'` (NOT `'en'`) per the owner-deviation in the file header — so
 * the existing en-US-first behaviour is preserved verbatim across the
 * plan-07-06 boundary. For all other locales the language is pinned to the
 * active BCP-47 tag and the chain prepends the locale-matching steps.
 *
 * When the chain falls past step 2 (no locale-matching voice installed) on
 * a non-'en' locale, a Crashlytics breadcrumb fires per D-31:
 *   `{ event: 'tts_locale_fallback', locale: activeLocale, fallback: true }`.
 * The 'en' locale never logs (it IS the always-true fallback target).
 *
 * Safe to call before the engine reports voices (falls back to the engine
 * default after the language pin). Idempotent enough to call once at
 * RecordingScreen mount.
 */
export async function pickAndSetLocaleVoice(activeLocale: string): Promise<void> {
  // getInitStatus first per 07-RESEARCH "Pitfall 2: Tts.voices() race on
  // Android 14+" — voices() may return [] before the engine reports ready.
  try {
    await Tts.getInitStatus();
  } catch {
    /* best-effort */
  }

  let voices: TtsVoice[] = [];
  try {
    voices = ((await Tts.voices()) as TtsVoice[]) ?? [];
  } catch {
    // Older Android / no TTS voices installed → keep the language pin below.
    voices = [];
  }
  const usable = voices.filter((v) => !v.notInstalled);

  // 0. Language pin: pin the engine to the active locale BCP-47 tag, EXCEPT
  //    for 'en' which resolves to 'en-US' to preserve the owner deviation
  //    (CLAUDE.md TTS banner). Best-effort — each TTS call is individually
  //    guarded so `pickAndSetLocaleVoice` never rejects.
  const langTag = activeLocale === 'en' ? 'en-US' : activeLocale;
  try {
    await Tts.setDefaultLanguage(langTag);
  } catch {
    /* best-effort — engine may lack the locale data */
  }

  // 5-step chain (D-31). For activeLocale === 'en', steps 1+2 ALSO match
  // en-US (since langTag is 'en-US' for 'en'); the find chain dedupes
  // naturally — the first match wins.
  const id =
    usable.find((v) => v.language === activeLocale && looksFemale(v))?.id ?? // 1. locale female-ish
    usable.find((v) => v.language === activeLocale)?.id ?? // 2. any locale voice
    usable.find((v) => v.language === 'en-US' && looksFemale(v))?.id ?? // 3. en-US female-ish (owner chain)
    usable.find((v) => v.language === 'en-US')?.id ?? // 4. any en-US (owner chain)
    usable.find((v) => (v.language ?? '').toLowerCase().startsWith('en'))?.id; // 5. first en-* (owner chain)

  if (id) {
    try {
      await Tts.setDefaultVoice(id);
    } catch {
      /* best-effort — the step-0 language pin stands */
    }
  }
  // (no en-* voice at all) → the step-0 language pin stands.

  // Crashlytics breadcrumb when we fell past step 2 (no locale-matching
  // voice). Skip for 'en' — en is the always-true fallback target so a
  // breadcrumb would flood Crashlytics. Only fires when there's at least
  // one usable voice (an empty voices() is its own degenerate engine state
  // — different from "the engine reports voices but none match the
  // locale", which is the population the breadcrumb is sizing).
  if (activeLocale !== 'en' && usable.length > 0) {
    const localeHit = usable.some((v) => v.language === activeLocale);
    if (!localeHit) {
      try {
        crashlytics().log(
          JSON.stringify({
            event: 'tts_locale_fallback',
            locale: activeLocale,
            fallback: true,
          }),
        );
      } catch {
        /* best-effort — Crashlytics may be disabled in dev / on emulator */
      }
    }
  }

  // skipTransform=true → Android's raw 1.0 (== normal speed). See the note above.
  Tts.setDefaultRate(1.0, true);
  Tts.setDefaultPitch(0.95);
}

/**
 * Backward-compat shim per D-31 ("import-call stability"). The existing
 * RecordingScreen call site `pickAndSetEnInVoice()` keeps working without
 * needing a churn-the-call-sites pass. For NEW code, call
 * `pickAndSetLocaleVoice(i18n.language)` directly.
 */
export async function pickAndSetEnInVoice(): Promise<void> {
  return pickAndSetLocaleVoice('en');
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
