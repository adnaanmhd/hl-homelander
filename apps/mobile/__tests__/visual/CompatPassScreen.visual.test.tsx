// Plan 03-03 — Visual snapshot for the post-auto-advance CompatPassScreen.
//
// The baseline catches:
//   - "You're in." title (centered)
//   - "All checks passed." sub-line
//   - NO storage warning banner (default warningOnly=false)
//   - NO Continue / Next CTA — the screen is now a transient confirmation,
//     not a gate (auto-routes to RigTutorial after 1.5 s)
//
// We use fake timers so the screen doesn't try to navigate during the 1.5 s
// window the snapshot is taken in. The post-merge layout has no manual CTA;
// the snapshot reflects the success-state body.
//
// react-native mock shape: per-test inline shim (Pattern 69).

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const { PASS_RESULT } = vi.hoisted(() => ({
  PASS_RESULT: {
    signature: 'sig-abcd',
    runAt: '2026-05-08T12:00:00Z',
    passed: true,
    failedKeys: [],
    checks: {
      resolution: true,
      fps: true,
      ultrawideDfov: { pass: true, measuredDeg: 118 },
      imuSustained100Hz: { pass: true, measuredHz: 200 },
      imuP99Ms: { pass: true, measuredMs: 6 },
      micSampleRate: true,
      realtimeTimestamp: true,
      root: { pass: true, verdict: 'clean' },
      freeStorageGB: { pass: true, warningOnly: false, measuredGB: 12.0 },
      encoderNoBFrames: true,
      oisOff: true,
      hdrSdrForced: true,
    },
  },
}));

vi.mock('@react-navigation/native', () => ({
  // Phase 3 (2026-06-10) — the screen now transitively imports
  // services/profileService → services/api → navigation/navigationRef, which
  // calls createNavigationContainerRef at module load. Mirror the
  // vitest.setup stub (reports NOT ready → resetToOnboarding no-ops here).
  createNavigationContainerRef: () => ({
    isReady: () => false,
    resetRoot: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    dispatch: vi.fn(),
    getRootState: vi.fn(),
    current: null,
  }),
  useNavigation: () => ({
    replace: vi.fn(),
    navigate: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => {
  const stub = { compatLastResult: PASS_RESULT };
  function useAppStore<T>(selector: (s: typeof stub) => T): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const React_ = ReactModule;
  function resolveStyle(value: unknown): Record<string, unknown> | undefined {
    if (value == null || value === false) return undefined;
    if (typeof value === 'function') {
      return resolveStyle((value as (s: { pressed: boolean }) => unknown)({ pressed: false }));
    }
    if (Array.isArray(value)) {
      const merged: Record<string, unknown> = {};
      for (const e of value) {
        const r = resolveStyle(e);
        if (r) Object.assign(merged, r);
      }
      return Object.keys(merged).length ? merged : undefined;
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return undefined;
  }
  function makeComponent(name: string) {
    return React_.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, style, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return React_.createElement('div', dom, children as React.ReactNode);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    Image: makeComponent('Image'),
    StyleSheet: {
      create<T extends Record<string, unknown>>(s: T): T {
        return s;
      },
      flatten<T>(s: T): T {
        return s;
      },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select<T>(o: { android?: T; default?: T }): T | undefined {
        return o.android ?? o.default;
      },
    },
  };
});

import CompatPassScreen from '../../src/screens/compat/CompatPassScreen';
import { renderToImage } from './_utils/renderToImage';

describe('CompatPassScreen visual (post Plan 03-03 auto-advance)', () => {
  beforeEach(() => {
    // Hold the auto-advance timer so the snapshot captures the success-state
    // body, not a torn-down screen.
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('matches baseline (success body, no Continue CTA — transient confirmation)', () => {
    const { container } = render(<CompatPassScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
