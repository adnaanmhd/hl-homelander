// Crash-recovery boot listener → Home toast (D-LIFE-04, plan 04-10; hardened
// 2026-05-12 Phase-4 smoke bug 3(a)).
//
// installBootRecoveryListener() now has TWO channels:
//   1. HumynCapture.getPendingRecovery() — synchronous query (the reliable
//      channel; no boot-timing race);
//   2. HumynCapture.onCrashRecovery(listener) — the one-shot event (legacy).
// The Home toast "Recording recovered after force-quit — uploading." fires the
// first time EITHER channel reports `recovered.length > 0` (validated as a
// string[]), then any further reports are ignored (one-shot per app launch).
// When a toast actually shows, the event subscription is removed so a redundant
// emit (both channels read the same native holder) can't re-toast; an EMPTY /
// malformed report does NOT remove the sub (the other channel is still the
// fallback).
//
// Pattern: per-test `vi.doMock('react-native', …)` injecting NativeModules
// (with a `getPendingRecovery` spy) + a stub NativeEventEmitter constructor
// whose addListener captures the listener and returns a subscription with a spy
// `.remove()`. The Toast host is rendered so the toast text becomes assertable;
// `showToast` flows through the real module.

import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Importable handles set up by setupRn — populated per test.
let capturedEvent: string | null = null;
let capturedListener: ((e: unknown) => void) | null = null;
let removeSpy: ReturnType<typeof vi.fn>;
let getPendingRecoverySpy: ReturnType<typeof vi.fn>;

// Minimal RN host-component shim (mirrors vitest.setup.ts's makeComponent).
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

function setupRn(opts: { registered: boolean; pending?: unknown }) {
  capturedEvent = null;
  capturedListener = null;
  removeSpy = vi.fn();
  getPendingRecoverySpy = vi.fn(async () => ({
    recovered: 'pending' in opts ? opts.pending : [],
  }));
  const addListener = vi.fn((name: string, listener: (e: unknown) => void) => {
    capturedEvent = name;
    capturedListener = listener;
    return { remove: removeSpy };
  });
  function EmitterCtor(this: { addListener: typeof addListener }, nativeModule?: unknown) {
    if (nativeModule == null) {
      throw new Error('NativeEventEmitter requires a non-null argument on Android');
    }
    this.addListener = addListener;
  }
  vi.doMock('react-native', () => ({
    NativeModules: opts.registered
      ? { HumynCapture: { getPendingRecovery: getPendingRecoverySpy } }
      : {},
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
  const boot = await import('../../../src/boot/bootRecoveryListener');
  const Toast = await import('../../../src/components/Toast');
  render(<Toast.ToastHost />);
  return { boot, Toast };
}

// Flush pending microtasks (the getPendingRecovery().then(...) chain) under
// fake timers — `vi.advanceTimersByTimeAsync(0)` drains the microtask queue.
async function flushMicrotasks() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
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

  it('subscribes to onCrashRecovery and shows the toast on a valid event payload', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    expect(getPendingRecoverySpy).toHaveBeenCalledTimes(1);
    expect(capturedEvent).toBe('onCrashRecovery');
    expect(typeof capturedListener).toBe('function');
    // getPendingRecovery resolved [] → no toast yet, sub still alive.
    expect(screen.queryByLabelText('toast')).toBeNull();
    expect(removeSpy).not.toHaveBeenCalled();
    // The event channel delivers a valid recovered list → toast + sub removed.
    act(() => {
      capturedListener!({ recovered: ['20260511_120000_001'] });
    });
    const toast = screen.getByLabelText('toast');
    expect(toast.textContent).toContain('Recording recovered after force-quit — uploading.');
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the toast from the synchronous getPendingRecovery channel', async () => {
    setupRn({ registered: true, pending: ['20260511_120000_009'] });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    const toast = screen.getByLabelText('toast');
    expect(toast.textContent).toContain('Recording recovered after force-quit — uploading.');
    // A toast showed → the event subscription was removed (no double-toast).
    expect(removeSpy).toHaveBeenCalledTimes(1);
    // A redundant event emit afterwards does not re-toast (sub removed).
    act(() => {
      capturedListener?.({ recovered: ['x'] });
    });
    // Still exactly one toast surface.
    expect(screen.getAllByLabelText('toast')).toHaveLength(1);
  });

  it('a second event fire after the one-shot does not show a new toast', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    act(() => {
      capturedListener!({ recovered: ['a'] });
    });
    // RECOVERY_TOAST_MS is 15 s (it fires while the SplashScreen bootstrap is
    // still up, so it has to outlast it) — advance well past that.
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    act(() => {
      capturedListener!({ recovered: ['b'] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('a non-array event payload does NOT show a toast and does NOT remove the sub', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    act(() => {
      capturedListener!({ recovered: 'not-an-array' });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    // Sub stays alive — the other channel is still the fallback.
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('an empty event payload does NOT show a toast and does NOT remove the sub', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    act(() => {
      capturedListener!({ recovered: [] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('a recovered list containing a non-string is rejected', async () => {
    setupRn({ registered: true });
    const { boot } = await loadModulesAndRenderHost();
    act(() => {
      boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    act(() => {
      capturedListener!({ recovered: ['ok', 42 as unknown as string] });
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('swallows the throw when HumynCapture is not registered', async () => {
    setupRn({ registered: false });
    const { boot } = await loadModulesAndRenderHost();
    let teardown: (() => void) | undefined;
    act(() => {
      teardown = boot.installBootRecoveryListener();
    });
    await flushMicrotasks();
    expect(typeof teardown).toBe('function');
    // No listener was captured (onCrashRecovery's ensure() threw).
    expect(capturedListener).toBeNull();
    // The teardown is a safe no-op.
    expect(() => teardown!()).not.toThrow();
  });
});
