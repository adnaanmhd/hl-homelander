// Plan 03-03 — Visual snapshot for the post-merge CompatFailScreen.
//
// The baseline catches:
//   - "This phone can't record yet" title
//   - 2 failure rows (ultrawideDfov + imuSustained100Hz)
//   - Inline recovery body + 3 recovery bullets (the merged content from
//     the deleted CompatRecoveryScreen)
//   - Contact Support CTA at content-driven width (alignSelf: 'center')
//
// react-native mock shape: per-test inline shim (Pattern 69) — the canonical
// vitest.setup.ts mock doesn't expose Linking, and importOriginal fails on
// Flow `import typeof` from react-native's index.js (Pattern 52).

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Pattern 47 — hoist FAIL_RESULT into the same hoist-scope as vi.mock so the
// store mock factory can close over it without a TDZ at hoist time.
const { FAIL_RESULT } = vi.hoisted(() => ({
  FAIL_RESULT: {
    signature: 'sig-fail',
    runAt: '2026-05-08T12:00:00Z',
    passed: false,
    failedKeys: ['ultrawideDfov', 'imuSustained100Hz'] as string[],
    checks: {
      resolution: true,
      fps: true,
      ultrawideDfov: { pass: false, measuredDeg: 92 },
      imuSustained100Hz: { pass: false, measuredHz: 44 },
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
  useNavigation: () => ({
    navigate: vi.fn(),
    replace: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => {
  const stub = { compatLastResult: FAIL_RESULT };
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
    Modal: makeComponent('Modal'),
    StyleSheet: {
      create<T extends Record<string, unknown>>(s: T): T {
        return s;
      },
      flatten<T>(s: T): T {
        return s;
      },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Linking: { openURL: () => Promise.resolve() },
    Platform: {
      OS: 'android',
      select<T>(o: { android?: T; default?: T }): T | undefined {
        return o.android ?? o.default;
      },
    },
  };
});

import CompatFailScreen from '../../src/screens/compat/CompatFailScreen';
import { renderToImage } from './_utils/renderToImage';

describe('CompatFailScreen visual (post Plan 03-03 merge)', () => {
  afterEach(() => cleanup());

  it('matches baseline (failure list + inline recovery + contact support)', () => {
    const { container } = render(<CompatFailScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
