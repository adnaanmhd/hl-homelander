// CompatFailScreen unit tests — Phase 2 plan 02-15 Task 4 (design-spec §4d).
//
// Coverage:
//   - renders "This phone can't record yet" verbatim
//   - failed-key copy renders the design-spec §4d copy with measured value:
//     "Stable motion sensors at 100 Hz+ required (yours: 44 Hz)"
//   - "What now" CTA navigates to CompatRecovery
//   - multiple failed keys render multiple rows

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { mockNavigate, compatHolder } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
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

describe('CompatFailScreen (design-spec §4d)', () => {
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

  it('Test 3: What now button navigates to CompatRecovery', () => {
    render(<CompatFailScreen />);
    fireEvent.click(screen.getByLabelText('compat-fail-what-now'));
    expect(mockNavigate).toHaveBeenCalledWith('CompatRecovery');
  });

  it('Test 4: ultrawideDfov fail renders measured-value copy', () => {
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

  it('Test 5: multiple failed keys render multiple rows', () => {
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

  it('Test 6: empty result renders no failure rows (defensive null check)', () => {
    compatHolder.value = null;
    render(<CompatFailScreen />);
    // The screen still mounts with the title; just no rows.
    expect(screen.getByText("This phone can't record yet")).toBeTruthy();
    expect(screen.queryByLabelText('compat-fail-row-imuSustained100Hz')).toBeNull();
  });
});
