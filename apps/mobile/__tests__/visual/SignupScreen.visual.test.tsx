// Plan 03-02 — Visual snapshot for SignupScreen.
//
// The baseline catches:
//   - Logo + tagline + value-prop block (3 pitch lines tightened to xs gap)
//   - Continue-with-Google CTA at content-driven width (alignSelf:'center')
//   - Consent row with checkbox + Terms-of-Use link
//
// CTA-position regression (button pinned to bottom via space-between)
// shifts the rendered Pressable rectangle and the diff fires.
//
// react-native mock shape: per-test inline shim (NOT importOriginal) per
// Pattern 52 — the real react-native index.js uses Flow `import typeof`
// which Vite's esbuild transform can't parse. Tests that need RN system
// modules (Alert, Linking, Animated.View) must inline the host-component
// shapes and re-export only the surface their screen touches.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/services/auth', () => ({
  signInWithGoogle: vi.fn(),
}));
vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('../../src/state/appStore', () => {
  type Sel<T> = (s: Record<string, unknown>) => T;
  // Quick 260527-hkl — SignupScreen now reads the `consent` slice on every
  // render (gates CTA + mount-time modal auto-open). The visual baseline
  // captures the post-Agree state (consent persisted) so the screenshot
  // mirrors what a returning user sees: modal NOT auto-open, checkbox
  // checked, CTA enabled. The pre-consent (modal-open) state is covered by
  // SignupScreen.test.tsx Test 1 + the visual baseline for the Modal
  // primitive lives elsewhere.
  const stub = {
    jwt: null,
    consent: {
      acceptedAt: '2026-05-27T10:00:00.000Z',
      // SignupScreen recomputes CONSENT_VERSION at module load from the
      // canonical TERMS_OF_USE_TEXT — the FNV-1a hash is stable, so we hard-
      // code it here to keep this stub trivially shaped. The baseline-rebase
      // command (`vitest -u SignupScreen.visual.test.tsx`) regenerates the
      // PNG if the canonical text ever bumps and the hash changes; the
      // visual baseline encodes a single moment in time.
      consentVersion: 'fc6aa4',
    },
    setJwt: () => undefined,
    setConsent: () => undefined,
    setUser: () => undefined,
  } as Record<string, unknown>;
  function useAppStore<T>(selector: Sel<T>): T {
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
    Alert: { alert: () => undefined },
    Platform: {
      OS: 'android',
      select<T>(o: { android?: T; default?: T }): T | undefined {
        return o.android ?? o.default;
      },
    },
    Animated: {
      View: makeComponent('AnimatedView'),
      Text: makeComponent('AnimatedText'),
      Image: makeComponent('AnimatedImage'),
      Value: class {
        _v: number;
        constructor(v: number) {
          this._v = v;
        }
        setValue(v: number) {
          this._v = v;
        }
      },
      timing: () => ({ start: () => undefined }),
      parallel: () => ({ start: () => undefined }),
      sequence: () => ({ start: () => undefined }),
      createAnimatedComponent<T>(c: T): T {
        return c;
      },
    },
    Easing: { bezier: () => () => 0, out: () => () => 0, linear: () => 0 },
  };
});

import SignupScreen from '../../src/screens/signup/SignupScreen';
import { renderToImage } from './_utils/renderToImage';

describe('SignupScreen visual', () => {
  afterEach(() => cleanup());

  it('matches baseline (logo + value-props + content-driven CTA)', () => {
    const { container } = render(<SignupScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
