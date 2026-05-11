/**
 * Plan 04-02 Task 1 — JS bridge unit test for the HumynHandDetector native
 * module (HAND-01 / HAND-08; mirror of `__tests__/native/HumynCapture.test.ts`).
 *
 * The Kotlin body lands in plan 04-04 (the real MediaPipe HandLandmarker
 * pipeline); this test pins the JS-binding contract the shell must honour:
 *   1. **not-registered** — `detectHands` rejects with the canonical
 *      "HumynHandDetector native module not registered" error and
 *      `isHandDetectorAvailable()` returns `false` when
 *      NativeModules.HumynHandDetector is absent (the default
 *      vitest.setup.ts stubs `NativeModules` to `{}`).
 *   2. **registered** — `detectHands(path, minConf)` forwards `(path, minConf)`
 *      verbatim and resolves with the native return value; `detectHands(path)`
 *      passes the `0.5` default; `cleanup()` forwards no args and resolves;
 *      `isHandDetectorAvailable()` returns `true`.
 *
 * Pattern parity with HumynCapture.test.ts: `vi.resetModules()` in
 * beforeEach, `vi.doMock('react-native', () => ...)` to inject
 * `NativeModules.HumynHandDetector`, `vi.doUnmock` in afterEach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynHandDetector (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('detectHands rejects with the canonical error when native module missing', async () => {
    const { detectHands } = await import('../../src/native/HumynHandDetector');
    await expect(detectHands('/x.jpg', 0.5)).rejects.toThrow(
      /HumynHandDetector native module not registered/,
    );
  });

  it('isHandDetectorAvailable returns false when native module missing (HAND-08 discriminant)', async () => {
    const { isHandDetectorAvailable } = await import('../../src/native/HumynHandDetector');
    expect(isHandDetectorAvailable()).toBe(false);
  });

  it('cleanup resolves to undefined (no-op) when native module missing', async () => {
    const { cleanup } = await import('../../src/native/HumynHandDetector');
    await expect(cleanup()).resolves.toBeUndefined();
  });
});

describe('HumynHandDetector (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('detectHands forwards (path, minConfidence) verbatim and resolves the native value', async () => {
    const native = {
      detectHands: vi.fn().mockResolvedValue(2),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynHandDetector: native },
    }));
    const { detectHands } = await import('../../src/native/HumynHandDetector');
    const result = await detectHands('/x.jpg', 0.5);
    expect(native.detectHands).toHaveBeenCalledTimes(1);
    expect(native.detectHands).toHaveBeenCalledWith('/x.jpg', 0.5);
    expect(result).toBe(2);
  });

  it('detectHands(path) passes 0.5 as the default minConfidence', async () => {
    const native = {
      detectHands: vi.fn().mockResolvedValue(1),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynHandDetector: native },
    }));
    const { detectHands } = await import('../../src/native/HumynHandDetector');
    const result = await detectHands('/y.jpg');
    expect(native.detectHands).toHaveBeenCalledWith('/y.jpg', 0.5);
    expect(result).toBe(1);
  });

  it('cleanup forwards no args and resolves', async () => {
    const native = {
      detectHands: vi.fn().mockResolvedValue(0),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynHandDetector: native },
    }));
    const { cleanup } = await import('../../src/native/HumynHandDetector');
    const result = await cleanup();
    expect(native.cleanup).toHaveBeenCalledTimes(1);
    expect(native.cleanup).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });

  it('isHandDetectorAvailable returns true when native module present', async () => {
    const native = {
      detectHands: vi.fn(),
      cleanup: vi.fn(),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynHandDetector: native },
    }));
    const { isHandDetectorAvailable } = await import('../../src/native/HumynHandDetector');
    expect(isHandDetectorAvailable()).toBe(true);
  });
});
