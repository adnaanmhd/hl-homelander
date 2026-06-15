// BatteryOptimizationGuide — BUG-5 (2026-06-09). The OEM autostart + AOSP
// battery-exemption walkthrough, extracted from the deleted standalone
// onboarding modal into a Help Center component.
//
// Coverage (ported from the old BatteryOptimizationScreen.test.tsx, minus the
// Done/Skip + shouldShowBatteryOptimizationPrompt cases which no longer exist):
//   1. Renders without crashing when the HumynUpload native module is absent
//      (the *Safe try/catch path) — the standalone fallback copy shows.
//   2. The OEM "Open Autostart settings" button renders ONLY when
//      oemAutostartAvailableSafe() resolves true, and taps openOemAutostartSafe().
//   3. Tapping "Allow unrestricted battery" calls
//      requestBatteryOptimizationExemptionSafe() then re-checks
//      isBatteryOptimizationExemptSafe() and reflects the status line.

import React from 'react';
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { requestExemptSafeMock, isExemptSafeMock, oemAvailableSafeMock, openOemSafeMock } =
  vi.hoisted(() => ({
    requestExemptSafeMock: vi.fn(),
    isExemptSafeMock: vi.fn(),
    oemAvailableSafeMock: vi.fn(),
    openOemSafeMock: vi.fn(),
  }));

vi.mock('../../../src/native/HumynUpload', () => ({
  HumynUpload: {
    requestBatteryOptimizationExemptionSafe: requestExemptSafeMock,
    isBatteryOptimizationExemptSafe: isExemptSafeMock,
    oemAutostartAvailableSafe: oemAvailableSafeMock,
    openOemAutostartSafe: openOemSafeMock,
  },
}));

import { BatteryOptimizationGuide } from '../../../src/screens/help/BatteryOptimizationGuide';

beforeEach(() => {
  requestExemptSafeMock.mockReset().mockResolvedValue(undefined);
  isExemptSafeMock.mockReset().mockResolvedValue(false);
  oemAvailableSafeMock.mockReset().mockResolvedValue(false);
  openOemSafeMock.mockReset().mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
});

describe('BatteryOptimizationGuide (BUG-5 — relocated to Help Center)', () => {
  it('renders without crashing when the native-module probes resolve safe-defaults', async () => {
    render(<BatteryOptimizationGuide />);
    expect(screen.getByLabelText('battery-optimization-guide')).toBeTruthy();
    // The standalone fallback copy is ALWAYS shown.
    expect(
      screen.getByText(
        /Settings → Apps → Homelander → Battery → Unrestricted, and turn on Autostart/,
      ),
    ).toBeTruthy();
    // No OEM deep-link button when oemAutostartAvailableSafe → false.
    await waitFor(() => {
      expect(screen.queryByLabelText('battery-opt-open-oem-autostart')).toBeNull();
    });
  });

  it('renders the OEM "Open Autostart settings" button only when oemAutostartAvailableSafe resolves true, and taps it', async () => {
    oemAvailableSafeMock.mockResolvedValue(true);
    render(<BatteryOptimizationGuide />);
    await waitFor(() => {
      expect(screen.getByLabelText('battery-opt-open-oem-autostart')).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText('battery-opt-open-oem-autostart'));
    await waitFor(() => {
      expect(openOemSafeMock).toHaveBeenCalled();
    });
  });

  it('tap "Allow unrestricted battery" → requests the AOSP exemption then re-checks and reflects the status', async () => {
    // First check (mount effect) → not exempt; after the request → exempt.
    isExemptSafeMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<BatteryOptimizationGuide />);
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
});
