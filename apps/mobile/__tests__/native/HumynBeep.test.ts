/**
 * Plan 04-02 Task 2 — JS bridge unit test for the HumynBeep native module
 * (REC-10; mirror of `__tests__/native/HumynCapture.test.ts`).
 *
 * The Kotlin body lands in plan 04-05 (SoundPool over pre-baked .wav assets);
 * this test pins the JS-binding contract the shell must honour:
 *   1. **not-registered** — `playTone(name)` rejects with the canonical
 *      "HumynBeep native module not registered" error when
 *      NativeModules.HumynBeep is absent.
 *   2. **registered** — `playTone(name)` forwards `name` verbatim and resolves.
 *
 * Pattern parity with HumynCapture.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynBeep (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('playTone rejects with the canonical error when native module missing', async () => {
    const { playTone } = await import('../../src/native/HumynBeep');
    await expect(playTone('battery_alert')).rejects.toThrow(
      /HumynBeep native module not registered/,
    );
  });
});

describe('HumynBeep (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('playTone forwards name verbatim and resolves', async () => {
    const native = { playTone: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({ NativeModules: { HumynBeep: native } }));
    const { playTone } = await import('../../src/native/HumynBeep');
    const result = await playTone('battery_alert');
    expect(native.playTone).toHaveBeenCalledTimes(1);
    expect(native.playTone).toHaveBeenCalledWith('battery_alert');
    expect(result).toBeUndefined();
  });

  it('playTone("thermal_alert") forwards the thermal cue name', async () => {
    const native = { playTone: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({ NativeModules: { HumynBeep: native } }));
    const { playTone } = await import('../../src/native/HumynBeep');
    await playTone('thermal_alert');
    expect(native.playTone).toHaveBeenCalledWith('thermal_alert');
  });
});
