// CompatRunningScreen unit tests — Phase 2 plan 02-15 Task 3.
//
// Coverage:
//   - renders title + sub copy verbatim from design-spec §4a
//   - renders all 7 design-spec rows
//   - on pass result, navigation.replace('CompatPass')
//   - on fail result, navigation.replace('CompatFail')
//   - on probe error (rejection), navigation.replace('CompatFail')
//
// Pattern: relies on the canonical react-native shim from vitest.setup.ts
// (default mock); mocks compatService + useAppStore + useNavigation per-test.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const { mockReplace, mockSetCompatResult, mockRunCompatCheck } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSetCompatResult: vi.fn(),
  mockRunCompatCheck: vi.fn(),
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
  useFocusEffect: (cb: () => void) => {
    cb();
  },
  useIsFocused: () => true,
}));

vi.mock('../../src/services/compatService', () => ({
  runCompatCheck: mockRunCompatCheck,
}));

vi.mock('../../src/state/appStore', () => {
  const state = { setCompatResult: mockSetCompatResult };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

// CompatRing pulls react-native-svg + Animated; the canonical mocks already
// resolve those, but the shim's react-native doesn't expose Animated. Stub
// the component to a tiny pass-through so the test focuses on the screen
// behavior, not the ring's drawing layer (Task 2 has its own coverage).
vi.mock('../../src/components/CompatRing', () => ({
  CompatRing: () => null,
}));

import CompatRunningScreen from '../../src/screens/compat/CompatRunningScreen';

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
    freeStorageGB: { pass: true, warningOnly: false, measuredGB: 12 },
    encoderNoBFrames: true,
    oisOff: true,
    hdrSdrForced: true,
  },
};

const FAIL_RESULT = {
  ...PASS_RESULT,
  passed: false,
  failedKeys: ['imuSustained100Hz', 'imuP99Ms'],
  checks: {
    ...PASS_RESULT.checks,
    imuSustained100Hz: { pass: false, measuredHz: 44 },
    imuP99Ms: { pass: false, measuredMs: 25 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CompatRunningScreen (design-spec §4a/§4b)', () => {
  it('Test 1: renders the title + sub copy verbatim from design-spec §4a', () => {
    mockRunCompatCheck.mockResolvedValue(PASS_RESULT);
    render(<CompatRunningScreen />);
    expect(screen.getByText('Checking your phone')).toBeTruthy();
    expect(screen.getByText('Takes around 30 secs')).toBeTruthy();
  });

  it('Test 2: renders all 7 design-spec rows', () => {
    mockRunCompatCheck.mockResolvedValue(PASS_RESULT);
    render(<CompatRunningScreen />);
    expect(screen.getByLabelText('compat-row-ultrawide')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-resolutionFps')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-motionSensors')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-imu')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-mic')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-realtime')).toBeTruthy();
    expect(screen.getByLabelText('compat-row-integrity')).toBeTruthy();
  });

  it('Test 3: on pass result, navigation.replace("CompatPass")', async () => {
    mockRunCompatCheck.mockResolvedValue(PASS_RESULT);
    render(<CompatRunningScreen />);
    // Real timers — the screen runs a 700 ms cosmetic interval + 400 ms hold
    // after probe resolution, so wait long enough for the resolve→hold→nav
    // sequence to fire.
    await waitFor(() => expect(mockSetCompatResult).toHaveBeenCalledWith(PASS_RESULT), {
      timeout: 2000,
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('CompatPass'), {
      timeout: 2000,
    });
  });

  it('Test 4: on fail result, navigation.replace("CompatFail")', async () => {
    mockRunCompatCheck.mockResolvedValue(FAIL_RESULT);
    render(<CompatRunningScreen />);
    await waitFor(() => expect(mockSetCompatResult).toHaveBeenCalledWith(FAIL_RESULT), {
      timeout: 2000,
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('CompatFail'), {
      timeout: 2000,
    });
  });

  it('Test 5: on probe rejection, navigation.replace("CompatFail")', async () => {
    mockRunCompatCheck.mockRejectedValue(new Error('ENCODER_PROBE_ERROR: device busy'));
    render(<CompatRunningScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('CompatFail'), {
      timeout: 2000,
    });
    // No setCompatResult on error path.
    expect(mockSetCompatResult).not.toHaveBeenCalled();
  });
});
