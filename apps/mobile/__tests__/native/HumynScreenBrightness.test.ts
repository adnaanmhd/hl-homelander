/**
 * Plan 04-02 Task 2 — JS bridge unit test for the HumynScreenBrightness native
 * module (REC-08; mirror of `__tests__/native/HumynCapture.test.ts`).
 *
 * The Kotlin body lands in plan 04-05 (the real per-window
 * `WindowManager.LayoutParams.screenBrightness` mutation); this test pins the
 * JS-binding contract the shell must honour:
 *   1. **not-registered** — `set(value)` rejects with the canonical
 *      "HumynScreenBrightness native module not registered" error when
 *      NativeModules.HumynScreenBrightness is absent.
 *   2. **registered** — `set(value)` forwards `value` verbatim and resolves;
 *      `set(-1)` (the "restore system default" sentinel) is accepted the
 *      same way (no JS-side range guard — the Kotlin body does the clamp).
 *
 * Pattern parity with HumynCapture.test.ts: `vi.resetModules()` in
 * beforeEach, `vi.doMock('react-native', ...)` to inject the stub,
 * `vi.doUnmock` in afterEach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynScreenBrightness (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('set rejects with the canonical error when native module missing', async () => {
    const { set } = await import('../../src/native/HumynScreenBrightness');
    await expect(set(0.05)).rejects.toThrow(/HumynScreenBrightness native module not registered/);
  });
});

describe('HumynScreenBrightness (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('set forwards value verbatim and resolves', async () => {
    const native = { set: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({ NativeModules: { HumynScreenBrightness: native } }));
    const { set } = await import('../../src/native/HumynScreenBrightness');
    const result = await set(0.05);
    expect(native.set).toHaveBeenCalledTimes(1);
    expect(native.set).toHaveBeenCalledWith(0.05);
    expect(result).toBeUndefined();
  });

  it('set(-1) (restore-system-default sentinel) is forwarded verbatim', async () => {
    const native = { set: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({ NativeModules: { HumynScreenBrightness: native } }));
    const { set } = await import('../../src/native/HumynScreenBrightness');
    await set(-1);
    expect(native.set).toHaveBeenCalledWith(-1);
  });
});
