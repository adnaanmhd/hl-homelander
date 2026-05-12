// BatteryOptimizationScreen — Plan 05-07 (UP-09) first-upload walkthrough.
//
// Coverage:
//   1. Renders without crashing when the HumynUpload native module is absent
//      (the *Safe try/catch path) — title + the standalone fallback copy show.
//   2. The OEM "Open Autostart settings" button renders ONLY when
//      HumynUpload.oemAutostartAvailable() resolves true.
//   3. Tapping "Allow unrestricted battery" calls
//      HumynUpload.requestBatteryOptimizationExemption{,Safe} then re-checks
//      isBatteryOptimizationExempt{,Safe} and reflects the status line.
//   4. Tapping "Done" / "Skip for now" sets UPLOAD_FIRST_PROMPT_SHOWN +
//      UPLOAD_FIRST_PROMPT_VERSION in the shared MMKV instance and calls onDone.
//   5. shouldShowBatteryOptimizationPrompt(): true on first run, true after a
//      version bump, false once shown at the current version.
//
// Uses the setup-file react-native host-component shim + the in-memory
// react-native-mmkv mock; HumynUpload and AppFlavor are mocked per-suite.

import React from 'react';
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  requestExemptMock,
  requestExemptSafeMock,
  isExemptMock,
  isExemptSafeMock,
  oemAvailableMock,
  oemAvailableSafeMock,
  openOemMock,
  openOemSafeMock,
  versionNameRef,
  flavorThrowsRef,
} = vi.hoisted(() => ({
  requestExemptMock: vi.fn(),
  requestExemptSafeMock: vi.fn(),
  isExemptMock: vi.fn(),
  isExemptSafeMock: vi.fn(),
  oemAvailableMock: vi.fn(),
  oemAvailableSafeMock: vi.fn(),
  openOemMock: vi.fn(),
  openOemSafeMock: vi.fn(),
  versionNameRef: { current: '1.0.0' } as { current: string },
  flavorThrowsRef: { current: false } as { current: boolean },
}));

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: {
    requestBatteryOptimizationExemption: requestExemptMock,
    requestBatteryOptimizationExemptionSafe: requestExemptSafeMock,
    isBatteryOptimizationExempt: isExemptMock,
    isBatteryOptimizationExemptSafe: isExemptSafeMock,
    oemAutostartAvailable: oemAvailableMock,
    oemAutostartAvailableSafe: oemAvailableSafeMock,
    openOemAutostart: openOemMock,
    openOemAutostartSafe: openOemSafeMock,
  },
}));

vi.mock('../../../src/native/AppFlavor', () => ({
  getFlavorContext: () => {
    if (flavorThrowsRef.current) throw new Error('AppFlavor native module not registered');
    return { versionName: versionNameRef.current };
  },
}));

import BatteryOptimizationScreen, {
  shouldShowBatteryOptimizationPrompt,
} from '../../../src/screens/onboarding/BatteryOptimizationScreen';
import { secureMmkv } from '../../../src/state/mmkv';
import { KEYS } from '../../../src/state/keys';

beforeEach(() => {
  secureMmkv.clearAll();
  requestExemptSafeMock.mockReset().mockResolvedValue(undefined);
  isExemptSafeMock.mockReset().mockResolvedValue(false);
  oemAvailableSafeMock.mockReset().mockResolvedValue(false);
  openOemSafeMock.mockReset().mockResolvedValue(false);
  versionNameRef.current = '1.0.0';
  flavorThrowsRef.current = false;
});

afterEach(() => {
  cleanup();
});

describe('BatteryOptimizationScreen (UP-09 first-upload walkthrough)', () => {
  it('renders without crashing when the native module probes resolve safe-defaults', async () => {
    render(<BatteryOptimizationScreen />);
    expect(screen.getByText('Keep your uploads running')).toBeTruthy();
    // The standalone fallback copy is ALWAYS shown.
    expect(
      screen.getByText(
        /Settings → Apps → Homelander → Battery → Unrestricted, and turn on Autostart/,
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('battery-optimization-screen')).toBeTruthy();
    // No OEM deep-link button when oemAutostartAvailableSafe → false.
    await waitFor(() => {
      expect(screen.queryByLabelText('battery-opt-open-oem-autostart')).toBeNull();
    });
  });

  it('renders the OEM "Open Autostart settings" button only when oemAutostartAvailableSafe resolves true', async () => {
    oemAvailableSafeMock.mockResolvedValue(true);
    render(<BatteryOptimizationScreen />);
    await waitFor(() => {
      expect(screen.getByLabelText('battery-opt-open-oem-autostart')).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText('battery-opt-open-oem-autostart'));
    await waitFor(() => {
      expect(openOemSafeMock).toHaveBeenCalled();
    });
  });

  it('tap "Allow unrestricted battery" → requests the AOSP exemption then re-checks and reflects the status', async () => {
    // First check (effect) → not exempt; after the request → exempt.
    isExemptSafeMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<BatteryOptimizationScreen />);
    fireEvent.click(screen.getByLabelText('battery-opt-allow-unrestricted'));
    await waitFor(() => {
      expect(requestExemptSafeMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/Allowed — uploads will keep running in the background/),
      ).toBeTruthy();
    });
  });

  it('tap "Done" sets the two MMKV flags (shown + version) and calls onDone', async () => {
    const onDone = vi.fn();
    versionNameRef.current = '2.3.4';
    render(<BatteryOptimizationScreen onDone={onDone} />);
    fireEvent.click(screen.getByLabelText('battery-opt-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(secureMmkv.getBoolean(KEYS.UPLOAD_FIRST_PROMPT_SHOWN)).toBe(true);
    expect(secureMmkv.getString(KEYS.UPLOAD_FIRST_PROMPT_VERSION)).toBe('2.3.4');
  });

  it('tap "Skip for now" also sets the flags and calls onDone', async () => {
    const onDone = vi.fn();
    render(<BatteryOptimizationScreen onDone={onDone} />);
    fireEvent.click(screen.getByLabelText('battery-opt-skip'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(secureMmkv.getBoolean(KEYS.UPLOAD_FIRST_PROMPT_SHOWN)).toBe(true);
  });

  describe('shouldShowBatteryOptimizationPrompt()', () => {
    it('is true on a first run (never shown)', () => {
      expect(shouldShowBatteryOptimizationPrompt()).toBe(true);
    });

    it('is false once shown at the current app version', () => {
      versionNameRef.current = '1.5.0';
      secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_SHOWN, true);
      secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_VERSION, '1.5.0');
      expect(shouldShowBatteryOptimizationPrompt()).toBe(false);
    });

    it('is true again after an app-version bump (re-show on force-upgrade)', () => {
      secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_SHOWN, true);
      secureMmkv.set(KEYS.UPLOAD_FIRST_PROMPT_VERSION, '1.5.0');
      versionNameRef.current = '1.6.0';
      expect(shouldShowBatteryOptimizationPrompt()).toBe(true);
    });
  });
});
