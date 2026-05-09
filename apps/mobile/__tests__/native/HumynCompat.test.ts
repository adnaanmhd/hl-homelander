/**
 * Plan 02-06 Task 2 — JS bridge unit test for HumynCompat native module.
 *
 * Behavior:
 *  1. When NativeModules.HumynCompat is undefined → calling any of the 3
 *     functions rejects with an error containing "HumynCompat native module
 *     not registered".
 *  2. When NativeModules.HumynCompat is mocked with a spy → runImuProbe
 *     forwards args verbatim and returns the resolved value verbatim.
 *  3. When the native call rejects → the JS function rejects with the same
 *     error.
 *
 * The default vitest.setup.ts stubs `NativeModules` to `{}` (HumynCompat
 * undefined), so test 1 runs without per-test mocking. Tests 2 and 3 use
 * vi.doMock to inject a mocked NativeModules.HumynCompat for the import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynCompat (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('runEncoderProbe rejects when native module missing', async () => {
    const { runEncoderProbe } = await import('../../src/native/HumynCompat');
    await expect(runEncoderProbe()).rejects.toThrow(/HumynCompat native module not registered/);
  });

  it('runImuProbe rejects when native module missing', async () => {
    const { runImuProbe } = await import('../../src/native/HumynCompat');
    await expect(runImuProbe(30000, true)).rejects.toThrow(
      /HumynCompat native module not registered/,
    );
  });

  it('readDeviceCaps rejects when native module missing', async () => {
    const { readDeviceCaps } = await import('../../src/native/HumynCompat');
    await expect(readDeviceCaps()).rejects.toThrow(/HumynCompat native module not registered/);
  });
});

describe('HumynCompat (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('runImuProbe forwards args and returns resolved value verbatim', async () => {
    const native = {
      runEncoderProbe: vi.fn(),
      runImuProbe: vi
        .fn()
        .mockResolvedValue({ sustainedHz: 195.4, p99IntervalMs: 11.3, samplesCollected: 5860 }),
      readDeviceCaps: vi.fn(),
    };
    vi.doMock('react-native', () => ({ NativeModules: { HumynCompat: native } }));
    const { runImuProbe } = await import('../../src/native/HumynCompat');
    const result = await runImuProbe(30000, true);
    expect(native.runImuProbe).toHaveBeenCalledTimes(1);
    expect(native.runImuProbe).toHaveBeenCalledWith(30000, true);
    expect(result).toEqual({ sustainedHz: 195.4, p99IntervalMs: 11.3, samplesCollected: 5860 });
  });

  it('runEncoderProbe propagates native rejection', async () => {
    const native = {
      runEncoderProbe: vi.fn().mockRejectedValue(new Error('ENCODER_PROBE_ERROR: boom')),
      runImuProbe: vi.fn(),
      readDeviceCaps: vi.fn(),
    };
    vi.doMock('react-native', () => ({ NativeModules: { HumynCompat: native } }));
    const { runEncoderProbe } = await import('../../src/native/HumynCompat');
    await expect(runEncoderProbe()).rejects.toThrow(/ENCODER_PROBE_ERROR: boom/);
    expect(native.runEncoderProbe).toHaveBeenCalledTimes(1);
  });
});
