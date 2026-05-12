/**
 * Plan 04-02 Task 2 — JS bridge unit test for the HumynBattery native module
 * (the level/charging signal for the low-battery cue; mirror of
 * `__tests__/native/HumynCapture.test.ts`).
 *
 * The Kotlin body lands in plan 04-05 (the
 * `Intent.ACTION_BATTERY_CHANGED` sticky-broadcast receiver); this test pins
 * the JS-binding contract:
 *   1. **not-registered** — `start()` / `stop()` reject with the canonical
 *      "HumynBattery native module not registered" error.
 *   2. **registered** — `start()` / `stop()` forward no args and resolve.
 *   3. **event subscriptions** — `onBatteryChanged(listener)` forwards to
 *      NativeEventEmitter.addListener('onBatteryChanged', listener) and
 *      returns an object with `.remove()` (the leak-mitigation contract).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynBattery (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('start rejects when native module missing', async () => {
    const { start } = await import('../../src/native/HumynBattery');
    await expect(start()).rejects.toThrow(/HumynBattery native module not registered/);
  });

  it('stop rejects when native module missing', async () => {
    const { stop } = await import('../../src/native/HumynBattery');
    await expect(stop()).rejects.toThrow(/HumynBattery native module not registered/);
  });
});

describe('HumynBattery (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('start forwards no args and resolves', async () => {
    const native = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynBattery: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { start } = await import('../../src/native/HumynBattery');
    const result = await start();
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });

  it('stop forwards no args and resolves', async () => {
    const native = { start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynBattery: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { stop } = await import('../../src/native/HumynBattery');
    const result = await stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.stop).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });
});

describe('HumynBattery event subscriptions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  function setupEmitterMock(): {
    addListener: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    emitterCtor: ReturnType<typeof vi.fn>;
  } {
    const remove = vi.fn();
    const addListener = vi.fn().mockReturnValue({ remove });
    const emitterCtor = vi.fn(function (this: { addListener: typeof addListener }) {
      this.addListener = addListener;
    });
    vi.doMock('react-native', () => ({
      NativeModules: { HumynBattery: { start: vi.fn(), stop: vi.fn() } },
      NativeEventEmitter: emitterCtor,
    }));
    return { addListener, remove, emitterCtor };
  }

  it('onBatteryChanged subscribes via NativeEventEmitter.addListener("onBatteryChanged")', async () => {
    const { addListener, remove, emitterCtor } = setupEmitterMock();
    const { onBatteryChanged } = await import('../../src/native/HumynBattery');
    const listener = vi.fn();
    const subscription = onBatteryChanged(listener);
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledWith('onBatteryChanged', listener);
    expect(typeof subscription.remove).toBe('function');
    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('HumynBattery.getCurrentLevel (REC-16 sync read — Phase-4 smoke bug 2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('forwards to native getCurrentLevel and resolves the {level,isCharging} shape', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentLevel: vi.fn().mockResolvedValue({ level: 0.04, isCharging: false }),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynBattery: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { getCurrentLevel } = await import('../../src/native/HumynBattery');
    const r = await getCurrentLevel();
    expect(native.getCurrentLevel).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ level: 0.04, isCharging: false });
  });

  it('resolves {level:-1} when the native module is not registered (never throws)', async () => {
    vi.doMock('react-native', () => ({ NativeModules: {}, NativeEventEmitter: vi.fn() }));
    const { getCurrentLevel } = await import('../../src/native/HumynBattery');
    await expect(getCurrentLevel()).resolves.toEqual({ level: -1, isCharging: false });
  });

  it('resolves {level:-1} when the native call rejects (never throws)', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentLevel: vi.fn().mockRejectedValue(new Error('boom')),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynBattery: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { getCurrentLevel } = await import('../../src/native/HumynBattery');
    await expect(getCurrentLevel()).resolves.toEqual({ level: -1, isCharging: false });
  });
});
