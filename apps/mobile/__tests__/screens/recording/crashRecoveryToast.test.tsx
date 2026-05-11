// Crash-recovery boot listener → Home toast (D-LIFE-04, plan 04-10).
//
// Coverage:
//   1. installBootRecoveryListener() subscribes to HumynCapture.onCrashRecovery
//      (NativeEventEmitter.addListener('onCrashRecovery', …)).
//   2. Firing the captured listener with { recovered: ['…'] } shows the
//      "Recording recovered after force-quit — uploading." toast AND removes
//      the subscription (one-shot per app launch).
//   3. Firing again (after the first fire) with { recovered: [] } does NOT
//      show a new toast — the subscription is already gone.
//   4. A malformed payload ({ recovered: 'not-an-array' }) does NOT show a
//      toast (the Array.isArray guard — Security "trust the payload blindly").
//   5. An empty { recovered: [] } on the first fire does NOT show a toast (but
//      still removes the subscription — one-shot regardless).
//   6. When HumynCapture isn't registered (no NativeModules.HumynCapture),
//      installBootRecoveryListener() swallows the throw — boot never crashes.
//
// Pattern: per-test `vi.doMock('react-native', …)` injecting NativeModules +
// a stub NativeEventEmitter constructor whose addListener captures the listener
// and returns a subscription with a spy `.remove()`. Mirrors HumynCapture.test.ts's
// setupEmitterMock() constructor-spy pattern. The Toast host is rendered so the
// toast text becomes assertable; `showToast` flows through the real module.

import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Importable handles set up by setupRn — populated per test.
let capturedEvent: string | null = null;
let capturedListener: ((e: unknown) => void) | null = null;
let removeSpy: ReturnType<typeof vi.fn>;

// Minimal RN host-component shim (mirrors vitest.setup.ts's makeComponent) so
// Toast.tsx + the Text primitive render under jsdom even though this test fully
// replaces the `react-native` module (to inject NativeModules + a stub
// NativeEventEmitter constructor).
function makeComponent(name: string) {
  return React.forwardRef<HTMLDivElement, Record<string, unknown> & { children?: React.ReactNode }>(
    function HostComponent(props, ref) {
      const { children, accessibilityLabel, style: _style, pointerEvents: _pe, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      return React.createElement('div', dom, children as React.ReactNode);
    },
  );
}

function setupRn(opts: { registered: boolean }) {
  capturedEvent = null;
  capturedListener = null;
  removeSpy = vi.fn();
  const addListener = vi.fn((name: string, listener: (e: unknown) => void) => {
    capturedEvent = name;
    capturedListener = listener;
    return { remove: removeSpy };
  });
  // Mirror real RN's NativeEventEmitter: it requires a non-null native module
  // (it reads `nativeModule.addListener` for the event-count bookkeeping). When
  // HumynCapture isn't registered, constructing the emitter throws — which is
  // exactly the throw bootRecoveryListener's try/catch swallows.
  function EmitterCtor(this: { addListener: typeof addListener }, nativeModule?: unknown) {
    if (nativeModule == null) {
      throw new Error('NativeEventEmitter requires a non-null argument on Android');
    }
    this.addListener = addListener;
  }
  vi.doMock('react-native', () => ({
    NativeModules: opts.registered ? { HumynCapture: {} } : {},
    NativeEventEmitter: EmitterCtor,
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    StyleSheet: {
      create: (s: unknown) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: {},
    },
  }));
  return { addListener };
}

async function loadModulesAndRenderHost() {
  // Import AFTER doMock so HumynCapture.ts binds the mocked react-native.
  const boot = await import('../../../src/boot/bootRecoveryListener');
  const Toast = await import('../../../src/components/Toast');
  render(<Toast.ToastHost />);
  return { boot, Toast };
}

describe('bootRecoveryListener → Home crash-recovery toast (D-LIFE-04)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.doUnmock('react-native');
    cleanup();
  });

  it('subscribes to onCrashRecovery and shows the toast on a valid payload', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    expect(capturedEvent).toBe('onCrashRecovery');
    expect(typeof capturedListener).toBe('function');
    // Fire with a valid recovered list.
    act(() => {
      capturedListener!({ recovered: ['20260511_120000_001'] });
    });
    const toast = screen.getByLabelText('toast');
    expect(toast.textContent).toContain('Recording recovered after force-quit — uploading.');
    // One-shot: the subscription was removed after the first fire.
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('a second fire after the one-shot does not show a new toast', async () => {
    setupRn({ registered: true });
    const { boot, Toast } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    act(() => {
      capturedListener!({ recovered: ['a'] });
    });
    // Let the first toast fade.
    act(() => {
      vi.advanceTimersByTime(Toast.DEFAULT_TOAST_MS + 1);
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    // Fire again — the listener already removed itself, but even if it were
    // re-invoked the recovered:[] payload short-circuits anyway.
    act(() => {
      capturedListener!({ recovered: [] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('a non-array recovered payload does NOT show a toast (Array.isArray guard)', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    act(() => {
      capturedListener!({ recovered: 'not-an-array' });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    // Still one-shot: the subscription was removed after the (no-op) fire.
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('an empty recovered list does NOT show a toast (but still self-removes)', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    act(() => {
      capturedListener!({ recovered: [] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('a recovered list containing a non-string is rejected', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    act(() => {
      capturedListener!({ recovered: ['ok', 42 as unknown as string] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('swallows the throw when HumynCapture is not registered', async () => {
    setupRn({ registered: false });
    const { boot } = await loadModulesAndRenderHost();
    // Must not throw.
    let teardown: (() => void) | undefined;
    act(() => {
      teardown = boot.installBootRecoveryListener();
    });
    expect(typeof teardown).toBe('function');
    // No listener was captured (the addListener call never reached because
    // ensure() threw inside onCrashRecovery).
    expect(capturedListener).toBeNull();
    // The teardown is a safe no-op.
    expect(() => teardown!()).not.toThrow();
  });
});
