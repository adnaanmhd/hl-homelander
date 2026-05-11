// ttsVoice — recording-cue voice selection.
//
// Owner override (2026-05-11, debug session handgate-never-passes): the cue
// voice is en-US female-leaning (en-US preferred over en-IN) — a deviation
// from `idea-brief.md §13` / REQ REC-14's "en-IN female" canon. See
// `src/lib/ttsVoice.ts` header.
//
// Each case `vi.doMock`s `react-native-tts` with a different `voices()` array
// then dynamic-imports `pickAndSetEnInVoice` to assert which `setDefaultVoice`
// id it picks (and that `setDefaultLanguage('en-US')` + `setDefaultRate(1.0,
// true)` + `setDefaultPitch(0.95)` run regardless). `vi.resetModules()`
// between cases so each import gets the freshly-doMock'd module.

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

async function loadWithTts(tts: TtsMock) {
  vi.resetModules();
  vi.doMock('react-native-tts', () => ({ default: tts, ...tts }));
  const mod = await import('../../src/lib/ttsVoice');
  return mod;
}

beforeEach(() => {
  vi.resetModules();
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
