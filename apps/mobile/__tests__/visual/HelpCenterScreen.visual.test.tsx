// Plan 03-02 — Visual snapshot for HelpCenterScreen.
//
// The baseline catches:
//   - 3 Accordion headers (Instructions Guide / FAQs / Troubleshooting)
//   - Contact Support headline + 2 CTAs (Contact Support primary +
//     Report-a-problem outline)
//   - Accordions start COLLAPSED — an open-by-default regression would
//     shift the rendered tree and surface in PR review.
//
// react-native mock shape: per-test inline shim (NOT importOriginal) per
// Pattern 52 — see SignupScreen.visual.test.tsx for the rationale.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/services/feedbackService', () => ({
  submitFeedback: vi.fn(),
}));
vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));

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

import HelpCenterScreen from '../../src/screens/help/HelpCenterScreen';
import { renderToImage } from './_utils/renderToImage';

describe('HelpCenterScreen visual', () => {
  afterEach(() => cleanup());

  it('matches baseline (3 accordions collapsed + contact support CTAs)', () => {
    const { container } = render(<HelpCenterScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
