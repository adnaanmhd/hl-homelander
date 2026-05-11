/**
 * Plan 04-02 Task 2 — JS bridge unit test for the HumynPhoneState native
 * module (the AudioManager-based call/focus-interruption signal; mirror of
 * `__tests__/native/HumynCapture.test.ts`).
 *
 * The Kotlin body lands in plan 04-05 (the real
 * `AudioManager.OnAudioFocusChangeListener` — NO `TelephonyManager` /
 * `READ_PHONE_STATE` / `PhoneStateListener`, see 04-RESEARCH Pitfall 2);
 * this test pins the JS-binding contract:
 *   1. **not-registered** — `start()` / `stop()` reject with the canonical
 *      "HumynPhoneState native module not registered" error.
 *   2. **registered** — `start()` / `stop()` forward no args and resolve.
 *   3. **event subscriptions** — `onAudioFocusChanged(listener)` forwards to
 *      NativeEventEmitter.addListener('onAudioFocusChanged', listener) and
 *      returns an object with `.remove()` (the leak-mitigation contract —
 *      callers MUST `.remove()` on unmount).
 *
 * Pattern parity with HumynCapture.test.ts (incl. the `setupEmitterMock()`
 * constructor-spy for the event-binding describe).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynPhoneState (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('start rejects when native module missing', async () => {
    const { start } = await import('../../src/native/HumynPhoneState');
    await expect(start()).rejects.toThrow(/HumynPhoneState native module not registered/);
  });

  it('stop rejects when native module missing', async () => {
    const { stop } = await import('../../src/native/HumynPhoneState');
    await expect(stop()).rejects.toThrow(/HumynPhoneState native module not registered/);
  });
});

describe('HumynPhoneState (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('start forwards no args and resolves', async () => {
    const native = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynPhoneState: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { start } = await import('../../src/native/HumynPhoneState');
    const result = await start();
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });

  it('stop forwards no args and resolves', async () => {
    const native = { start: vi.fn(), stop: vi.fn().mockResolvedValue(undefined) };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynPhoneState: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { stop } = await import('../../src/native/HumynPhoneState');
    const result = await stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.stop).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });
});

describe('HumynPhoneState event subscriptions', () => {
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
      NativeModules: { HumynPhoneState: { start: vi.fn(), stop: vi.fn() } },
      NativeEventEmitter: emitterCtor,
    }));
    return { addListener, remove, emitterCtor };
  }

  it('onAudioFocusChanged subscribes via NativeEventEmitter.addListener("onAudioFocusChanged")', async () => {
    const { addListener, remove, emitterCtor } = setupEmitterMock();
    const { onAudioFocusChanged } = await import('../../src/native/HumynPhoneState');
    const listener = vi.fn();
    const subscription = onAudioFocusChanged(listener);
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledWith('onAudioFocusChanged', listener);
    expect(typeof subscription.remove).toBe('function');
    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
