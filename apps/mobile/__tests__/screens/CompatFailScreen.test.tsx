// CompatFailScreen unit tests — design-spec §4d (post Plan 03-03 merge,
// post Plan 03-11 / A5 bullet removal).
//
// Coverage:
//   - renders "This phone can't record yet" verbatim
//   - failed-key copy renders the design-spec §4d copy with measured value:
//     "Stable motion sensors at 100 Hz+ required (yours: 44 Hz)"
//   - inline 1-sentence recovery body renders directly under the failure
//     list (Plan 03-11 / A5: the 3 recovery bullets were dropped as filler)
//   - regression guard — the legacy `recovery-bullet-*` Text nodes are GONE
//   - Contact Support button opens mailto with `support@humynlabs.ai`
//     (Plan 03-03 swap of OQ-1's 5th and final placeholder occurrence)
//   - multiple failed keys render multiple rows
//   - NO Next / Continue / Proceed CTA (COMPAT-06 enforcement carried
//     forward from the old standalone CompatRecoveryScreen)

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { mockNavigate, mockOpenURL, compatHolder } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockOpenURL: vi.fn(),
  compatHolder: { value: null as unknown },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => {
  function useAppStore<T>(selector: (s: { compatLastResult: unknown }) => T): T {
    return selector({ compatLastResult: compatHolder.value });
  }
  (useAppStore as unknown as { getState: () => { compatLastResult: unknown } }).getState = () => ({
    compatLastResult: compatHolder.value,
  });
  return { useAppStore };
});

// Replace the canonical react-native shim's Linking with a spy so the
// Contact Support mailto fire is observable. View/Text/Pressable still
// resolve to the host-component shim primitives via inline shapes (per
// Pattern 69 — vi.importActual would trip Flow `import typeof`).
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

import CompatFailScreen from '../../src/screens/compat/CompatFailScreen';

const BASE = {
  signature: 'sig-fail',
  runAt: '2026-05-08T12:00:00Z',
  passed: false,
  failedKeys: ['imuSustained100Hz'] as string[],
  checks: {
    resolution: true,
    fps: true,
    ultrawideDfov: { pass: true, measuredDeg: 118 },
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
};

beforeEach(() => {
  vi.clearAllMocks();
  compatHolder.value = BASE;
});

afterEach(() => {
  cleanup();
});

describe('CompatFailScreen (design-spec §4d, post Plan 03-03 merge)', () => {
  it('Test 1: renders "This phone can\'t record yet" verbatim', () => {
    render(<CompatFailScreen />);
    expect(screen.getByText("This phone can't record yet")).toBeTruthy();
  });

  it('Test 2: imuSustained100Hz fail renders verbatim §4d copy with measured value', () => {
    render(<CompatFailScreen />);
    expect(
      screen.getByText('Stable motion sensors at 100 Hz+ required (yours: 44 Hz)'),
    ).toBeTruthy();
  });

  it('Test 3: ultrawideDfov fail renders measured-value copy', () => {
    compatHolder.value = {
      ...BASE,
      checks: {
        ...BASE.checks,
        ultrawideDfov: { pass: false, measuredDeg: 92 },
        imuSustained100Hz: { pass: true, measuredHz: 200 },
      },
    };
    render(<CompatFailScreen />);
    expect(screen.getByText('Ultrawide camera 110°+ required (yours: 92°)')).toBeTruthy();
  });

  it('Test 4: multiple failed keys render multiple rows', () => {
    compatHolder.value = {
      ...BASE,
      checks: {
        ...BASE.checks,
        ultrawideDfov: { pass: false, measuredDeg: 92 },
        imuSustained100Hz: { pass: false, measuredHz: 44 },
        encoderNoBFrames: false,
      },
    };
    render(<CompatFailScreen />);
    expect(screen.getByLabelText('compat-fail-row-ultrawideDfov')).toBeTruthy();
    expect(screen.getByLabelText('compat-fail-row-imuSustained100Hz')).toBeTruthy();
    expect(screen.getByLabelText('compat-fail-row-encoderNoBFrames')).toBeTruthy();
  });

  it('Test 5: empty result renders no failure rows (defensive null check)', () => {
    compatHolder.value = null;
    render(<CompatFailScreen />);
    // The screen still mounts with the title; just no rows.
    expect(screen.getByText("This phone can't record yet")).toBeTruthy();
    expect(screen.queryByLabelText('compat-fail-row-imuSustained100Hz')).toBeNull();
  });

  it('Test 6 (Plan 03-11 / A5): inline 1-sentence recovery body renders under the failure list', () => {
    render(<CompatFailScreen />);
    // Plan 03-11 (A5) — recovery body tightened to a single sentence; the
    // bullet-list "What Now" block is gone. Failure list above already
    // itemizes WHAT failed.
    expect(screen.getByText("This phone doesn't meet the recording requirements.")).toBeTruthy();
  });

  it('Test 6b (Plan 03-11 / A5): legacy `recovery-bullet-*` Text nodes are GONE', () => {
    render(<CompatFailScreen />);
    expect(screen.queryByLabelText('recovery-bullet-different-device')).toBeNull();
    expect(screen.queryByLabelText('recovery-bullet-not-rooted')).toBeNull();
    expect(screen.queryByLabelText('recovery-bullet-rerun')).toBeNull();
  });

  it('Test 7 (post-merge): Contact Support mailto contains support@humynlabs.ai (OQ-1 5th occurrence resolved)', () => {
    render(<CompatFailScreen />);
    fireEvent.click(screen.getByLabelText('compat-fail-contact-support'));
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    const url = mockOpenURL.mock.calls[0]?.[0] as string;
    expect(url).toContain('mailto:support@humynlabs.ai');
    expect(url).not.toContain('[EMAIL_ADDRESS]');
    expect(url).toContain('Compatibility%20check');
    expect(decodeURIComponent(url)).toContain('Phone model:');
    expect(decodeURIComponent(url)).toContain('What I was trying to do:');
    expect(decodeURIComponent(url)).toContain('When it happened:');
  });

  it('Test 8 (post-merge): NO navigation to CompatRecovery (route deleted)', () => {
    render(<CompatFailScreen />);
    // Pre-merge had a "What now" CTA that fired navigate('CompatRecovery');
    // post-merge that CTA is gone — recovery is inline.
    expect(screen.queryByLabelText('compat-fail-what-now')).toBeNull();
    fireEvent.click(screen.getByLabelText('compat-fail-contact-support'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Test 9 (post-merge): NO Next / Continue / Proceed CTA (COMPAT-06 enforcement)', () => {
    render(<CompatFailScreen />);
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.queryByText('Proceed')).toBeNull();
  });
});
