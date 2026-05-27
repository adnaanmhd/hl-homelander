// ttsVoice — recording-cue voice selection.
//
// Owner override (2026-05-11, debug session handgate-never-passes): the cue
// voice is en-US female-leaning (en-US preferred over en-IN) — a deviation
// from `idea-brief.md §13` / REQ REC-14's "en-IN female" canon. See
// `src/lib/ttsVoice.ts` header.
//
// Each case `vi.doMock`s `react-native-tts` with a different `voices()` array
// then dynamic-imports `pickAndSetEnInVoice` / `pickAndSetLocaleVoice` to
// assert which `setDefaultVoice` id it picks (and that `setDefaultLanguage`
// + `setDefaultRate(1.0, true)` + `setDefaultPitch(0.95)` run regardless).
// `vi.resetModules()` between cases so each import gets the freshly-doMock'd
// module.
//
// Plan 07-06 Task 1 — extended with `pickAndSetLocaleVoice` coverage:
// 5-step per-locale chain (locale-female → locale-any → en-US-female →
// en-US-any → first en-*) + Crashlytics breadcrumb on locale-miss (D-31).

import { describe, it, expect, vi, beforeEach } from 'vitest';

type TtsMock = {
  getInitStatus: ReturnType<typeof vi.fn>;
  voices: ReturnType<typeof vi.fn>;
  setDefaultVoice: ReturnType<typeof vi.fn>;
  setDefaultLanguage: ReturnType<typeof vi.fn>;
  setDefaultRate: ReturnType<typeof vi.fn>;
  setDefaultPitch: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
};

function makeTtsMock(
  voices: Array<{ id: string; language: string; name?: string; notInstalled?: boolean }>,
  voicesRejects = false,
): TtsMock {
  return {
    getInitStatus: vi.fn().mockResolvedValue('success'),
    voices: voicesRejects
      ? vi.fn().mockRejectedValue(new Error('no voices'))
      : vi.fn().mockResolvedValue(voices),
    setDefaultVoice: vi.fn().mockResolvedValue(undefined),
    setDefaultLanguage: vi.fn().mockResolvedValue(undefined),
    setDefaultRate: vi.fn(),
    setDefaultPitch: vi.fn(),
    speak: vi.fn(),
  };
}

// vi.hoisted: the Crashlytics spy must exist BEFORE the (hoisted) vi.mock
// factory runs — a bare const would still be in the TDZ. Pattern lifted
// from apps/mobile/__tests__/services/api.errorToast.test.ts.
const { crashLog } = vi.hoisted(() => ({ crashLog: vi.fn() }));
vi.mock('@react-native-firebase/crashlytics', () => ({
  default: () => ({ log: crashLog }),
}));

async function loadWithTts(tts: TtsMock) {
  vi.resetModules();
  vi.doMock('react-native-tts', () => ({ default: tts, ...tts }));
  // Re-apply the crashlytics doMock so the freshly-imported ttsVoice.ts
  // resolves the same singleton-factory (the top-level vi.mock above is
  // hoisted module-wide; resetModules wipes only the dynamic import cache
  // but the factory + spy persist).
  vi.doMock('@react-native-firebase/crashlytics', () => ({
    default: () => ({ log: crashLog }),
  }));
  const mod = await import('../../src/lib/ttsVoice');
  return mod;
}

beforeEach(() => {
  vi.resetModules();
  crashLog.mockClear();
});

describe('pickAndSetEnInVoice (en-US-female fallback chain)', () => {
  it('step 0 — always pins setDefaultLanguage("en-US") first (never en-IN)', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-tpf-local', language: 'en-US', notInstalled: false }]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('en-US');
  });

  it('step 1 — en-US female-ish: picks the en-US voice whose id looks female (e.g. -tpf-)', async () => {
    const tts = makeTtsMock([
      { id: 'en-in-x-ene-female-local', language: 'en-IN', notInstalled: false },
      { id: 'en-us-x-tpf-local', language: 'en-US', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-tpf-local');
  });

  it('step 2 — any en-US (none matches the female heuristic) still beats an en-IN-female voice', async () => {
    const tts = makeTtsMock([
      { id: 'en-in-x-ene-female-local', language: 'en-IN', notInstalled: false },
      { id: 'en-us-x-plain', language: 'en-US', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-plain');
  });

  it('step 3 — first en-* when there is no en-US voice at all', async () => {
    const tts = makeTtsMock([
      { id: 'en-gb-x', language: 'en-GB', notInstalled: false },
      { id: 'fr-x', language: 'fr-FR', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-gb-x');
  });

  it('step 0 still applies even if setDefaultLanguage("en-US") rejects — the voice pick still runs', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-plain', language: 'en-US', notInstalled: false }]);
    tts.setDefaultLanguage.mockRejectedValueOnce(new Error('LANG_MISSING_DATA'));
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-plain');
  });

  it('notInstalled voices are filtered out before the chain runs', async () => {
    const tts = makeTtsMock([
      { id: 'en-us-x-tpf-local', language: 'en-US', notInstalled: true },
      { id: 'en-us-x-plain', language: 'en-US', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).not.toHaveBeenCalledWith('en-us-x-tpf-local');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-plain');
  });

  it('empty voices() → no setDefaultVoice, but the en-US language pin + rate/pitch still apply', async () => {
    const tts = makeTtsMock([]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).not.toHaveBeenCalled();
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('en-US');
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });

  it('voices() rejecting → no setDefaultVoice, language pin + rate/pitch still apply', async () => {
    const tts = makeTtsMock([], true);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).not.toHaveBeenCalled();
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('en-US');
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });

  it('always calls getInitStatus first and applies setDefaultRate(1.0, true) + setDefaultPitch(0.95)', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-plain', language: 'en-US', notInstalled: false }]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.getInitStatus).toHaveBeenCalled();
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });
});

describe('pickAndSetLocaleVoice (I18N-06 / D-31 — 5-step per-locale chain)', () => {
  it('step 1 — picks the locale female voice first when both exist (hi-IN)', async () => {
    const tts = makeTtsMock([
      { id: 'hi-in-x-male', language: 'hi-IN', name: 'Hindi Male' },
      { id: 'hi-in-x-female', language: 'hi-IN', name: 'Hindi Female' },
    ]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('hi-IN');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('hi-IN');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('hi-in-x-female');
    expect(crashLog).not.toHaveBeenCalled();
  });

  it('step 2 — falls to any locale-matching voice when no female heuristic hits (pt-BR)', async () => {
    const tts = makeTtsMock([{ id: 'pt-br-x-plain', language: 'pt-BR' }]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('pt-BR');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('pt-BR');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('pt-br-x-plain');
    expect(crashLog).not.toHaveBeenCalled();
  });

  it('step 3 — falls to an en-US female voice when no locale voice is installed, AND logs a Crashlytics breadcrumb (ta-IN → en-US)', async () => {
    const tts = makeTtsMock([
      { id: 'en-us-x-tpf-local', language: 'en-US', name: 'English Female' },
    ]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('ta-IN');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('ta-IN');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-tpf-local');
    expect(crashLog).toHaveBeenCalledTimes(1);
    const firstCall = crashLog.mock.calls[0];
    expect(firstCall).toBeDefined();
    const arg = JSON.parse(firstCall![0] as string);
    expect(arg.event).toBe('tts_locale_fallback');
    expect(arg.locale).toBe('ta-IN');
    expect(arg.fallback).toBe(true);
  });

  it('step 4 — falls to any en-US voice when no locale + no en-US-female exists, logs breadcrumb', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-plain', language: 'en-US', name: 'English Generic' }]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('bn-IN');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('bn-IN');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-plain');
    expect(crashLog).toHaveBeenCalledTimes(1);
  });

  it('step 5 — falls to first en-* voice when no en-US exists, logs breadcrumb', async () => {
    const tts = makeTtsMock([
      { id: 'en-gb-x', language: 'en-GB' },
      { id: 'fr-x', language: 'fr-FR' },
    ]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('mr-IN');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-gb-x');
    expect(crashLog).toHaveBeenCalledTimes(1);
  });

  it('preserves the en-US owner deviation when activeLocale is "en" (sets language to en-US, NOT en)', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-tpf-local', language: 'en-US' }]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('en');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('en-US'); // NOT 'en'
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-tpf-local');
    // en never logs fallback — it IS the always-true fallback target (would flood Crashlytics)
    expect(crashLog).not.toHaveBeenCalled();
  });

  it('does NOT log Crashlytics breadcrumb when locale-matching voice IS installed (hi-IN hit)', async () => {
    const tts = makeTtsMock([{ id: 'hi-in-x-plain', language: 'hi-IN' }]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('hi-IN');
    expect(crashLog).not.toHaveBeenCalled();
  });

  it('keeps the owner-locked setDefaultRate(1.0, true) + setDefaultPitch(0.95) regardless of locale', async () => {
    const tts = makeTtsMock([{ id: 'hi-in-x', language: 'hi-IN' }]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('hi-IN');
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });

  it('best-effort: setDefaultLanguage rejecting does not throw / aborts the chain', async () => {
    const tts = makeTtsMock([{ id: 'hi-in-x', language: 'hi-IN' }]);
    tts.setDefaultLanguage.mockRejectedValueOnce(new Error('LANG_MISSING_DATA'));
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await expect(pickAndSetLocaleVoice('hi-IN')).resolves.toBeUndefined();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('hi-in-x');
  });

  it('empty voices() — sets language but no voice + no crashlytics breadcrumb', async () => {
    const tts = makeTtsMock([]);
    const { pickAndSetLocaleVoice } = await loadWithTts(tts);
    await pickAndSetLocaleVoice('hi-IN');
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('hi-IN');
    expect(tts.setDefaultVoice).not.toHaveBeenCalled();
    // No voices at all = no fallback path taken = no breadcrumb (the breadcrumb is
    // specifically "no locale voice, so we walked to en-* steps"; here we
    // walked nowhere, which is its own degenerate engine state).
    expect(crashLog).not.toHaveBeenCalled();
  });

  it('pickAndSetEnInVoice() delegates to pickAndSetLocaleVoice("en") — backward-compat shim (D-31)', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-tpf-local', language: 'en-US' }]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultLanguage).toHaveBeenCalledWith('en-US');
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-tpf-local');
    expect(crashLog).not.toHaveBeenCalled();
  });
});

describe('speakCue', () => {
  it('calls Tts.speak with the §13 androidParams volume 0.85', async () => {
    const tts = makeTtsMock([{ id: 'en-us-x-plain', language: 'en-US', notInstalled: false }]);
    const { speakCue } = await loadWithTts(tts);
    speakCue('Battery low. Consider charging soon.');
    expect(tts.speak).toHaveBeenCalledWith(
      'Battery low. Consider charging soon.',
      expect.objectContaining({
        androidParams: expect.objectContaining({ KEY_PARAM_VOLUME: 0.85 }),
      }),
    );
  });
});
