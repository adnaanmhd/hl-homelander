// ttsVoice — REC-14 en-IN voice fallback chain.
//
// Each case `vi.doMock`s `react-native-tts` with a different `voices()` array
// then dynamic-imports `pickAndSetEnInVoice` to assert which `setDefaultVoice`
// id it picks (and that `setDefaultRate(1.0, true)` + `setDefaultPitch(0.95)`
// run regardless). `vi.resetModules()` between cases so each import gets the
// freshly-doMock'd module.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type TtsMock = {
  getInitStatus: ReturnType<typeof vi.fn>;
  voices: ReturnType<typeof vi.fn>;
  setDefaultVoice: ReturnType<typeof vi.fn>;
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

describe('pickAndSetEnInVoice (REC-14 fallback chain)', () => {
  it('step 1 — en-IN female-ish: picks the en-IN voice whose id looks female', async () => {
    const tts = makeTtsMock([
      { id: 'en-in-x-ene-female-local', language: 'en-IN', notInstalled: false },
      { id: 'en-us-x', language: 'en-US', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-in-x-ene-female-local');
  });

  it('step 2 — any en-IN: picks the en-IN voice when none looks female', async () => {
    const tts = makeTtsMock([
      { id: 'en-in-x-ene-local', language: 'en-IN', notInstalled: false },
      { id: 'en-us-x-female', language: 'en-US', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-in-x-ene-local');
  });

  it('step 3 — en-US female-ish: picks the female-leaning en-US voice when no en-IN', async () => {
    const tts = makeTtsMock([
      { id: 'en-us-x-female', language: 'en-US', notInstalled: false },
      { id: 'fr-x', language: 'fr-FR', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-us-x-female');
  });

  it('step 4 — first en-*: picks the first voice whose language starts with "en"', async () => {
    const tts = makeTtsMock([{ id: 'en-gb-x', language: 'en-GB', notInstalled: false }]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-gb-x');
  });

  it('notInstalled voices are filtered out before the chain runs', async () => {
    const tts = makeTtsMock([
      { id: 'en-in-x-ene-female-local', language: 'en-IN', notInstalled: true },
      { id: 'en-in-x-ene-local', language: 'en-IN', notInstalled: false },
    ]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).toHaveBeenCalledWith('en-in-x-ene-local');
  });

  it('empty voices() → does NOT call setDefaultVoice (engine default), still sets rate/pitch', async () => {
    const tts = makeTtsMock([]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).not.toHaveBeenCalled();
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });

  it('voices() rejecting → does NOT call setDefaultVoice, still sets rate/pitch', async () => {
    const tts = makeTtsMock([], true);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.setDefaultVoice).not.toHaveBeenCalled();
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });

  it('always calls getInitStatus first and applies setDefaultRate(1.0, true) + setDefaultPitch(0.95)', async () => {
    const tts = makeTtsMock([{ id: 'en-in-x', language: 'en-IN', notInstalled: false }]);
    const { pickAndSetEnInVoice } = await loadWithTts(tts);
    await pickAndSetEnInVoice();
    expect(tts.getInitStatus).toHaveBeenCalled();
    expect(tts.setDefaultRate).toHaveBeenCalledWith(1.0, true);
    expect(tts.setDefaultPitch).toHaveBeenCalledWith(0.95);
  });
});

describe('speakCue', () => {
  it('calls Tts.speak with the §13 androidParams volume 0.85', async () => {
    const tts = makeTtsMock([{ id: 'en-in-x', language: 'en-IN', notInstalled: false }]);
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
