/**
 * Plan 03-04 Task 3 — JS bridge unit test for the HumynCapture native module
 * (D-API-01..03; mirror of `__tests__/native/HumynCompat.test.ts`).
 *
 * Covers four describe blocks:
 *   1. **not-registered** — start/stop reject with the canonical
 *      "HumynCapture native module not registered" error when
 *      NativeModules.HumynCapture is absent (the default vitest.setup.ts
 *      stubs `NativeModules` to `{}`).
 *   2. **registered** — start forwards opts verbatim, returns the
 *      resolved value verbatim; native rejection propagates; stop
 *      forwards no args.
 *   3. **event subscriptions** — onSegmentStart/onSegmentComplete/
 *      onSessionStop/onThermalAbort/onError each forward to
 *      NativeEventEmitter.addListener with the right event name and
 *      return the EventSubscription so callers can `.remove()` it
 *      (T-3.3-04 leak-mitigation contract).
 *   4. **CaptureSessionOpts Zod cross-validation** — valid opts parse
 *      OK; `consent: false` rejects (T-3.3-01 mitigation); malformed
 *      `appVersion` rejects.
 *
 * Pattern parity with HumynCompat.test.ts: `vi.resetModules()` in
 * beforeEach, `vi.doMock('react-native', () => ...)` to inject
 * `NativeModules.HumynCapture`, `vi.doUnmock` in afterEach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Reusable valid opts mirroring D-API-02 — all Zod constraints satisfied.
const VALID_OPTS = {
  taskId: '01J5K7M9P0QR2STU4VWX6YZ8AB',
  taskName: 'Make a sandwich',
  taskCategory: 'kitchen',
  taskSetting: 'indoor' as const,
  contributor: {
    name: 'Adnaan',
    email: 'm.adnaan161@gmail.com',
    age: null,
    gender: null,
    consent: true as const,
  },
  isPractice: false,
  startGate: {
    type: 'hand_detection' as const,
    passed: true,
    skipped: false,
    bypassed: false,
    durationMs: 1500,
    consecutiveHitsRequired: 5,
    platformCadenceMs: 100,
  },
  location: 'Bangalore, India',
  appVersion: '1.0.0-apk',
  dfovDegrees: 115.2,
};

describe('HumynCapture (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('start rejects when native module missing', async () => {
    const { start } = await import('../../src/native/HumynCapture');
    await expect(start(VALID_OPTS)).rejects.toThrow(/HumynCapture native module not registered/);
  });

  it('stop rejects when native module missing', async () => {
    const { stop } = await import('../../src/native/HumynCapture');
    await expect(stop()).rejects.toThrow(/HumynCapture native module not registered/);
  });
});

describe('HumynCapture.getPendingRecovery (D-LIFE-04 crash-recovery query — Phase-4 smoke bug 3a)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('forwards to native getPendingRecovery and passes through a valid {recovered} payload', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn(),
      getPendingRecovery: vi.fn().mockResolvedValue({ recovered: ['20260511_120000_009'] }),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { getPendingRecovery } = await import('../../src/native/HumynCapture');
    const r = await getPendingRecovery();
    expect(native.getPendingRecovery).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ recovered: ['20260511_120000_009'] });
  });

  it('normalizes a malformed payload to {recovered: []}', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn(),
      getPendingRecovery: vi.fn().mockResolvedValue({ recovered: 'not-an-array' }),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { getPendingRecovery } = await import('../../src/native/HumynCapture');
    await expect(getPendingRecovery()).resolves.toEqual({ recovered: [] });
  });

  it('resolves {recovered: []} when the native module is not registered (never throws)', async () => {
    vi.doMock('react-native', () => ({ NativeModules: {}, NativeEventEmitter: vi.fn() }));
    const { getPendingRecovery } = await import('../../src/native/HumynCapture');
    await expect(getPendingRecovery()).resolves.toEqual({ recovered: [] });
  });

  it('resolves {recovered: []} when the native call rejects (never throws)', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn(),
      getPendingRecovery: vi.fn().mockRejectedValue(new Error('boom')),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { getPendingRecovery } = await import('../../src/native/HumynCapture');
    await expect(getPendingRecovery()).resolves.toEqual({ recovered: [] });
  });
});

describe('HumynCapture (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('start forwards opts verbatim and returns resolved value verbatim', async () => {
    const resolved = {
      sessionId: '01J5K7M9P0QR2STU4VWX6YZ8AC',
      segmentId: '01J5K7M9P0QR2STU4VWX6YZ8AD',
      recordingId: '01J5K7M9P0QR2STU4VWX6YZ8AE',
      filenameBase: '20260510_120000_001',
    };
    const native = {
      start: vi.fn().mockResolvedValue(resolved),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { start } = await import('../../src/native/HumynCapture');
    const result = await start(VALID_OPTS);
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith(VALID_OPTS);
    expect(result).toEqual(resolved);
  });

  it('start propagates native rejection (thermal_throttling)', async () => {
    const native = {
      start: vi.fn().mockRejectedValue(new Error('thermal_throttling')),
      stop: vi.fn(),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { start } = await import('../../src/native/HumynCapture');
    await expect(start(VALID_OPTS)).rejects.toThrow(/thermal_throttling/);
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it('stop forwards no args and resolves to void', async () => {
    const native = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: native },
      NativeEventEmitter: vi.fn(),
    }));
    const { stop } = await import('../../src/native/HumynCapture');
    const result = await stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.stop).toHaveBeenCalledWith();
    expect(result).toBeUndefined();
  });
});

describe('HumynCapture event subscriptions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  /**
   * Re-usable mock factory. Mocks `react-native` so that:
   *   - NativeModules.HumynCapture is a stub native module (start/stop are
   *     spies, never actually invoked in this describe block);
   *   - NativeEventEmitter is a constructor that returns a singleton
   *     instance whose `addListener` is a spy returning a fake
   *     EventSubscription with `.remove`.
   * Returns the underlying spies so the test can assert against them.
   */
  function setupEmitterMock(): {
    addListener: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    emitterCtor: ReturnType<typeof vi.fn>;
  } {
    const remove = vi.fn();
    const addListener = vi.fn().mockReturnValue({ remove });
    // NativeEventEmitter is invoked with `new`, so the mock MUST be a
    // regular function (not an arrow). `vi.fn()` itself is callable as a
    // constructor; we wire `addListener` onto each constructed instance
    // by tracking spy invocations and assigning to `this`. This is the
    // canonical Vitest "constructor spy" pattern (#3415-style).
    const emitterCtor = vi.fn(function (this: { addListener: typeof addListener }) {
      this.addListener = addListener;
    });
    vi.doMock('react-native', () => ({
      NativeModules: {
        HumynCapture: { start: vi.fn(), stop: vi.fn() },
      },
      NativeEventEmitter: emitterCtor,
    }));
    return { addListener, remove, emitterCtor };
  }

  it('onSegmentStart subscribes via NativeEventEmitter.addListener("onSegmentStart")', async () => {
    const { addListener, remove, emitterCtor } = setupEmitterMock();
    const { onSegmentStart } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    const subscription = onSegmentStart(listener);
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledWith('onSegmentStart', listener);
    // Returned subscription has the .remove escape hatch (T-3.3-04 leak mitigation).
    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('onSegmentComplete subscribes via NativeEventEmitter.addListener("onSegmentComplete")', async () => {
    const { addListener } = setupEmitterMock();
    const { onSegmentComplete } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    onSegmentComplete(listener);
    expect(addListener).toHaveBeenCalledWith('onSegmentComplete', listener);
  });

  it('onSessionStop subscribes via NativeEventEmitter.addListener("onSessionStop")', async () => {
    const { addListener } = setupEmitterMock();
    const { onSessionStop } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    onSessionStop(listener);
    expect(addListener).toHaveBeenCalledWith('onSessionStop', listener);
  });

  it('onThermalAbort subscribes via NativeEventEmitter.addListener("onThermalAbort")', async () => {
    const { addListener } = setupEmitterMock();
    const { onThermalAbort } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    onThermalAbort(listener);
    expect(addListener).toHaveBeenCalledWith('onThermalAbort', listener);
  });

  it('onError subscribes via NativeEventEmitter.addListener("onError")', async () => {
    const { addListener } = setupEmitterMock();
    const { onError } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    onError(listener);
    expect(addListener).toHaveBeenCalledWith('onError', listener);
  });

  it('emitter is constructed lazily — first subscribe triggers exactly one ctor call', async () => {
    const { emitterCtor } = setupEmitterMock();
    const { onSegmentStart, onSegmentComplete } = await import('../../src/native/HumynCapture');
    expect(emitterCtor).not.toHaveBeenCalled();
    onSegmentStart(vi.fn());
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    onSegmentComplete(vi.fn());
    // Second subscribe reuses the singleton — no second ctor call.
    expect(emitterCtor).toHaveBeenCalledTimes(1);
  });
});

describe('HumynCapture (full module wired — Plan 03-09 surface)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  /**
   * 5th describe block per PLAN.md Task 2 — asserts the bridge surface
   * Plan 03-09 ships:
   *   - start/stop/event helpers exist + are callable shapes;
   *   - start surfaces `not_implemented_in_03_09` after opts validation
   *     passes (the temporary stub Plan 03-10 replaces);
   *   - the JS bridge contract is operational without spinning up Camera2.
   */
  function setupRegisteredMock(): {
    startMock: ReturnType<typeof vi.fn>;
    stopMock: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
  } {
    const startMock = vi.fn().mockRejectedValue(new Error('not_implemented_in_03_09'));
    const stopMock = vi.fn().mockRejectedValue(new Error('no_active_session'));
    const remove = vi.fn();
    const addListener = vi.fn().mockReturnValue({ remove });
    const emitterCtor = vi.fn(function (this: { addListener: typeof addListener }) {
      this.addListener = addListener;
    });
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: { start: startMock, stop: stopMock } },
      NativeEventEmitter: emitterCtor,
    }));
    return { startMock, stopMock, addListener };
  }

  it('exposes start, stop, and 5 event helpers with callable shapes', async () => {
    setupRegisteredMock();
    const mod = await import('../../src/native/HumynCapture');
    expect(typeof mod.start).toBe('function');
    expect(typeof mod.stop).toBe('function');
    expect(typeof mod.onSegmentStart).toBe('function');
    expect(typeof mod.onSegmentComplete).toBe('function');
    expect(typeof mod.onSessionStop).toBe('function');
    expect(typeof mod.onThermalAbort).toBe('function');
    expect(typeof mod.onError).toBe('function');
  });

  it('start surfaces the not_implemented_in_03_09 stub from Plan 03-09 (Plan 03-10 replaces)', async () => {
    const { startMock } = setupRegisteredMock();
    const { start } = await import('../../src/native/HumynCapture');
    await expect(start(VALID_OPTS)).rejects.toThrow(/not_implemented_in_03_09/);
    expect(startMock).toHaveBeenCalledWith(VALID_OPTS);
  });

  it('stop surfaces the no_active_session stub from Plan 03-09', async () => {
    const { stopMock } = setupRegisteredMock();
    const { stop } = await import('../../src/native/HumynCapture');
    await expect(stop()).rejects.toThrow(/no_active_session/);
    expect(stopMock).toHaveBeenCalledTimes(1);
  });
});

describe('CaptureSessionOpts Zod cross-validation', () => {
  it('valid opts parse without error', async () => {
    const { CaptureSessionOptsSchema } = await import('@humyn/shared-types');
    expect(() => CaptureSessionOptsSchema.parse(VALID_OPTS)).not.toThrow();
  });

  it('rejects consent: false (T-3.3-01 mitigation)', async () => {
    const { CaptureSessionOptsSchema } = await import('@humyn/shared-types');
    const bad = {
      ...VALID_OPTS,
      contributor: { ...VALID_OPTS.contributor, consent: false as unknown as true },
    };
    expect(() => CaptureSessionOptsSchema.parse(bad)).toThrow();
  });

  it('rejects malformed appVersion', async () => {
    const { CaptureSessionOptsSchema } = await import('@humyn/shared-types');
    const bad = { ...VALID_OPTS, appVersion: 'invalid' };
    expect(() => CaptureSessionOptsSchema.parse(bad)).toThrow();
  });

  it('rejects negative dfovDegrees', async () => {
    const { CaptureSessionOptsSchema } = await import('@humyn/shared-types');
    const bad = { ...VALID_OPTS, dfovDegrees: -10 };
    expect(() => CaptureSessionOptsSchema.parse(bad)).toThrow();
  });
});
