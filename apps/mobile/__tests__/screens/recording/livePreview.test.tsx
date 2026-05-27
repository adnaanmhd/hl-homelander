/**
 * Phase 7 plan 07-07 — render-side smoke for the live-cam preview wiring on
 * RecordingScreen (D-05 / D-25 / D-26 / D-27 / D-28).
 *
 * The deep behavioural coverage of the brightness state machine lives in
 * `__tests__/lib/livePreviewState.test.ts` (the pure factory — 8 cases).
 * This file is a render-side smoke that pins:
 *
 *  1. The native-component JS bridge `<HumynLivePreviewView>` exports the
 *     full shape the screen relies on (`HumynLivePreviewView` as a component
 *     + `isLivePreviewAvailable` as a sync discriminant +
 *     `isLivePreviewSurfacePublished` as the async query).
 *
 *  2. The `isLivePreviewAvailable()` discriminant returns `false` when the
 *     native module is absent (e.g. unit-test env / future iOS build) — the
 *     RecordingScreen JSX gates the `<HumynLivePreviewView>` mount on this
 *     boolean so the recording proceeds dimmed-only with no crash.
 *
 *  3. The `isLivePreviewSurfacePublished` async query resolves `false`
 *     when the native module's `isAvailable()` call is missing or rejects
 *     (silent bypass — mirror of HAND-08).
 *
 * Note: vitest discovery pattern (vitest.config.ts) is
 * `__tests__/**`/*.test.tsx`; the plan's nominal path
 * `apps/mobile/src/screens/recording/__tests__/livePreview.test.tsx` is
 * not picked up. Filed as Rule 3 deviation in the SUMMARY — file sits here
 * to match `__tests__/screens/recording/RecordingScreen.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('HumynLivePreviewView JS bridge (native module not registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('isLivePreviewAvailable returns false when native module absent', async () => {
    const mod = await import('../../../src/native/HumynLivePreviewView');
    expect(mod.isLivePreviewAvailable()).toBe(false);
  });

  it('isLivePreviewSurfacePublished resolves false when native module absent', async () => {
    const mod = await import('../../../src/native/HumynLivePreviewView');
    await expect(mod.isLivePreviewSurfacePublished()).resolves.toBe(false);
  });
});

describe('HumynLivePreviewView JS bridge (native module registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('isLivePreviewAvailable returns true when module is registered', async () => {
    const native = { isAvailable: vi.fn().mockResolvedValue(true) };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynLivePreview: native },
      requireNativeComponent: vi.fn(() => () => null),
    }));
    const mod = await import('../../../src/native/HumynLivePreviewView');
    expect(mod.isLivePreviewAvailable()).toBe(true);
  });

  it('isLivePreviewSurfacePublished forwards the native resolution', async () => {
    const native = { isAvailable: vi.fn().mockResolvedValue(true) };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynLivePreview: native },
      requireNativeComponent: vi.fn(() => () => null),
    }));
    const mod = await import('../../../src/native/HumynLivePreviewView');
    await expect(mod.isLivePreviewSurfacePublished()).resolves.toBe(true);
    expect(native.isAvailable).toHaveBeenCalledTimes(1);
  });

  it('isLivePreviewSurfacePublished resolves false on native rejection (silent bypass)', async () => {
    const native = { isAvailable: vi.fn().mockRejectedValue(new Error('bridge_down')) };
    vi.doMock('react-native', () => ({
      NativeModules: { HumynLivePreview: native },
      requireNativeComponent: vi.fn(() => () => null),
    }));
    const mod = await import('../../../src/native/HumynLivePreviewView');
    await expect(mod.isLivePreviewSurfacePublished()).resolves.toBe(false);
  });
});
