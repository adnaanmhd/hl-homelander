// CompatPassScreen unit tests — design-spec §4c (post Plan 03-03 auto-advance).
//
// Coverage (post-merge):
//   - renders "You're in." + "All checks passed." verbatim
//   - 40 ms haptic fires on mount (impactLight)
//   - storage warning banner appears when warningOnly=true
//   - storage warning hidden when warningOnly=false
//   - AUTO-ADVANCE: after ~1.5 s, navigation.replace('RigTutorial') fires
//     WITHOUT a manual tap (Plan 03-03 — 02-COSMETIC-GAPS.md § Compat-pass
//     screen)
//   - NO manual "Continue" / "Next" Pressable rendered (CTA removed)
//   - Hardware-back / unmount cancels the pending timer (T-3.2-05)

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
// The canonical react-native-haptic-feedback mock from vitest.setup.ts exposes
// `default.trigger` as a vi.fn(); we import it directly so per-test assertions
// observe the same spy the screen's `require()` resolves.
import HapticFeedback from 'react-native-haptic-feedback';

const { mockReplace, mockReset, compatHolder, practiceDoneHolder } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockReset: vi.fn(),
  compatHolder: { value: null as unknown },
  practiceDoneHolder: { value: false },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: mockReplace,
    reset: mockReset,
    // getParent → null so CompatPassScreen falls back to navigation.reset
    // (mockReset) for the Bug 5/D7 practice-done → MainTabs path.
    getParent: () => null,
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
  (
    useAppStore as unknown as { getState: () => { compatLastResult: unknown; jwt: string } }
  ).getState = () => ({
    compatLastResult: compatHolder.value,
    jwt: 'jwt-x',
  });
  return { useAppStore };
});

// Bug 5 / D7 — CompatPassScreen now reads the per-account practice-done flag to
// route RigTutorial (not done) vs MainTabs (done). Drive that flag via
// `practiceDoneHolder` by mocking the sub-decode + the MMKV read + the key.
vi.mock('../../src/lib/jwtSub', () => ({ decodeGoogleSubFromJwt: () => 'sub-x' }));
vi.mock('../../src/state/keys', () => ({
  practiceDoneKey: (sub: string) => `tutorial.practice_done.${sub}.v1`,
}));
vi.mock('../../src/state/mmkv', () => ({
  secureMmkv: { getBoolean: () => practiceDoneHolder.value },
}));

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
  practiceDoneHolder.value = false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CompatPassScreen (design-spec §4c, post Plan 03-03 auto-advance)', () => {
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

  it('Test 3 (post-merge): storage warning hidden when warningOnly=false', () => {
    render(<CompatPassScreen />);
    expect(screen.queryByLabelText('compat-storage-warning')).toBeNull();
  });

  it('Test 4 (post-merge): storage warning shown when warningOnly=true (COMPAT-03)', () => {
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

  it('Test 5 (post-merge): auto-advances to RigTutorial after ~1.5 s without a tap', () => {
    vi.useFakeTimers();
    render(<CompatPassScreen />);
    // Pre-advance: timer pending, no replace yet.
    expect(mockReplace).not.toHaveBeenCalled();
    // Cross the 1.5 s threshold; the setTimeout fires.
    vi.advanceTimersByTime(1500);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('RigTutorial');
  });

  it('Test 6 (post-merge): NO manual Continue / Next Pressable rendered', () => {
    render(<CompatPassScreen />);
    // Pre-merge had a Button with accessibilityLabel="compat-pass-next" + a
    // visible "Next" label. Both must be gone post-auto-advance.
    expect(screen.queryByLabelText('compat-pass-next')).toBeNull();
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Continue')).toBeNull();
  });

  it('Test 7 (post-merge): unmount cancels the pending auto-advance timer (T-3.2-05)', () => {
    vi.useFakeTimers();
    const { unmount } = render(<CompatPassScreen />);
    // Unmount before the 1.5 s threshold — cleanup should clearTimeout.
    unmount();
    vi.advanceTimersByTime(2000);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Test 8 (Bug 5/D7): a returning user whose account completed practice skips to MainTabs', () => {
    // The practice-done flag is set (seeded at sign-in from the server, or set
    // on this device). After the auto-advance, CompatPass must reset into
    // MainTabs and must NOT push the user back through RigTutorial.
    vi.useFakeTimers();
    practiceDoneHolder.value = true;
    render(<CompatPassScreen />);
    vi.advanceTimersByTime(1500);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('Test 9 (Bug 5/D7): a user who has NOT completed practice still goes to RigTutorial', () => {
    vi.useFakeTimers();
    practiceDoneHolder.value = false;
    render(<CompatPassScreen />);
    vi.advanceTimersByTime(1500);
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('RigTutorial');
  });
});
