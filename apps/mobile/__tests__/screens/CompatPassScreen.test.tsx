// CompatPassScreen unit tests — Phase 2 plan 02-15 Task 4 (design-spec §4c).
//
// Coverage:
//   - renders "You're in." + "All checks passed." verbatim
//   - storage warning banner appears when warningOnly=true
//   - storage warning hidden when warningOnly=false
//   - 40 ms haptic fires on mount (impactLight)
//   - Next button calls navigation.replace('RigTutorial')

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
// The canonical react-native-haptic-feedback mock from vitest.setup.ts exposes
// `default.trigger` as a vi.fn(); we import it directly so per-test assertions
// observe the same spy the screen's `require()` resolves.
import HapticFeedback from 'react-native-haptic-feedback';

const { mockReplace, compatHolder } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  compatHolder: { value: null as unknown },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: mockReplace,
    reset: vi.fn(),
    navigate: vi.fn(),
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

import CompatPassScreen from '../../src/screens/compat/CompatPassScreen';

const PASS_RESULT = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  // The canonical setup mock's vi.fn() spy persists across files; reset its
  // call history so per-test assertions observe only this test's render.
  (HapticFeedback.trigger as unknown as ReturnType<typeof vi.fn>).mockClear();
  compatHolder.value = PASS_RESULT;
});

afterEach(() => {
  cleanup();
});

describe('CompatPassScreen (design-spec §4c)', () => {
  it('Test 1: renders "You\'re in." + "All checks passed." verbatim', () => {
    render(<CompatPassScreen />);
    expect(screen.getByText("You're in.")).toBeTruthy();
    expect(screen.getByText('All checks passed.')).toBeTruthy();
  });

  it('Test 2: 40 ms haptic fires on mount (impactLight)', () => {
    render(<CompatPassScreen />);
    const trigger = HapticFeedback.trigger as unknown as ReturnType<typeof vi.fn>;
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith(
      'impactLight',
      expect.objectContaining({ enableVibrateFallback: true }),
    );
  });

  it('Test 3: Next button replaces nav with RigTutorial', () => {
    render(<CompatPassScreen />);
    fireEvent.click(screen.getByLabelText('compat-pass-next'));
    expect(mockReplace).toHaveBeenCalledWith('RigTutorial');
  });

  it('Test 4: storage warning hidden when warningOnly=false', () => {
    render(<CompatPassScreen />);
    expect(screen.queryByLabelText('compat-storage-warning')).toBeNull();
  });

  it('Test 5: storage warning shown when warningOnly=true (COMPAT-03)', () => {
    compatHolder.value = {
      ...PASS_RESULT,
      checks: {
        ...PASS_RESULT.checks,
        freeStorageGB: { pass: true, warningOnly: true, measuredGB: 3.2 },
      },
    };
    render(<CompatPassScreen />);
    const banner = screen.getByLabelText('compat-storage-warning');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('3.2 GB free');
  });
});
