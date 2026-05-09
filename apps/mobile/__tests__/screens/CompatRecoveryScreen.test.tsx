// CompatRecoveryScreen unit tests — Phase 2 plan 02-15 Task 5 (COMPAT-08).
//
// Coverage:
//   - renders "What now" title + 3 recovery bullets
//   - Contact Support button opens mailto with placeholder + pre-filled body
//   - NO proceed CTA (COMPAT-06 enforcement — the screen must not have a
//     'Next' / 'Continue' / 'Proceed' button)

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { mockOpenURL } = vi.hoisted(() => ({
  mockOpenURL: vi.fn(),
}));

// Replace the canonical react-native shim's Linking with a spy. We pull the
// rest of the shim from vitest.setup.ts via importActual so View/Text/Pressable
// still resolve to the host-component shim primitives.
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  function makeComponent(name: string) {
    return ReactModule.forwardRef<HTMLDivElement, Record<string, unknown>>(
      function HostComponent(props, ref) {
        const { children, accessibilityLabel, accessibilityRole, onPress, style, ...rest } =
          props as {
            children?: React.ReactNode;
            accessibilityLabel?: string;
            accessibilityRole?: string;
            onPress?: () => void;
            style?: unknown;
          } & Record<string, unknown>;
        const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
        if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
        if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
        if (typeof onPress === 'function') dom['onClick'] = onPress;
        if (style && typeof style === 'object' && !Array.isArray(style)) dom['style'] = style;
        return ReactModule.createElement('div', dom, children as React.ReactNode);
      },
    );
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default,
    },
    Linking: { openURL: mockOpenURL },
  };
});

import CompatRecoveryScreen from '../../src/screens/compat/CompatRecoveryScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CompatRecoveryScreen (COMPAT-08)', () => {
  it('Test 1: renders "What now" title and three recovery bullets', () => {
    render(<CompatRecoveryScreen />);
    expect(screen.getByText('What now')).toBeTruthy();
    expect(screen.getByLabelText('recovery-bullet-different-device')).toBeTruthy();
    expect(screen.getByLabelText('recovery-bullet-not-rooted')).toBeTruthy();
    expect(screen.getByLabelText('recovery-bullet-rerun')).toBeTruthy();
  });

  it('Test 2: Contact Support button opens mailto with placeholder + pre-filled body', () => {
    render(<CompatRecoveryScreen />);
    fireEvent.click(screen.getByLabelText('compat-recovery-contact-support'));
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    const url = mockOpenURL.mock.calls[0]?.[0] as string;
    expect(url).toContain('mailto:[EMAIL_ADDRESS]');
    expect(url).toContain('Compatibility%20check');
    // Pre-filled body has the three labelled lines.
    expect(decodeURIComponent(url)).toContain('Phone model:');
    expect(decodeURIComponent(url)).toContain('What I was trying to do:');
    expect(decodeURIComponent(url)).toContain('When it happened:');
  });

  it('Test 3: NO Next / Continue / Proceed CTA (COMPAT-06 enforcement)', () => {
    render(<CompatRecoveryScreen />);
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.queryByText('Proceed')).toBeNull();
  });
});
