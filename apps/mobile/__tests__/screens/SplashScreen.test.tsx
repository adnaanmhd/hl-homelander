// SplashScreen unit tests — design-spec §1 + RESEARCH § Architecture +
// CONTEXT.md § "Splash version-check timing".
//
// Behaviour matrix:
//   1. Renders the brand logo + tagline (Real Humyns. Real Intelligence.) with
//      accent-colored "Real Intelligence."
//   2. After mount, fetchAppVersion is called; force-upgrade dispatches
//      setForceUpgradeBlocked(true), soft-banner dispatches
//      setSoftUpgradeAvailable.
//   3. After max(2400 ms minimum, version-check) completes, navigation.replace
//      is called with the result of computeInitialRoute(...).
//   4. Network failure → splash STILL advances after 2400 ms (does not hang).
//
// Mocking strategy: every external dependency is hoisted via vi.hoisted +
// vi.mock so the factories see the spy object. Fake timers control the
// SPLASH_MIN_MS delay.

import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockFetchAppVersion,
  mockComputeUpgradeAction,
  mockGetInstallationId,
  mockGetFlavorContext,
  mockComputeInitialRoute,
  mockNavigationReplace,
  mockGetParent,
  mockSetForceUpgradeBlocked,
  mockSetSoftUpgradeAvailable,
  mockLogEvent,
} = vi.hoisted(() => ({
  mockFetchAppVersion: vi.fn(),
  mockComputeUpgradeAction: vi.fn(),
  mockGetInstallationId: vi.fn(),
  mockGetFlavorContext: vi.fn(),
  mockComputeInitialRoute: vi.fn(),
  mockNavigationReplace: vi.fn(),
  mockGetParent: vi.fn(),
  mockSetForceUpgradeBlocked: vi.fn(),
  mockSetSoftUpgradeAvailable: vi.fn(),
  mockLogEvent: vi.fn(),
}));

vi.mock('../../src/services/versionService', () => ({
  fetchAppVersion: () => mockFetchAppVersion(),
  computeUpgradeAction: (a: string, b: unknown) => mockComputeUpgradeAction(a, b),
}));

vi.mock('../../src/services/installationId', () => ({
  getInstallationId: () => mockGetInstallationId(),
}));

vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => mockGetFlavorContext(),
}));

vi.mock('../../src/state/initialRoute', () => ({
  computeInitialRoute: (s: unknown, sig: string | null) => mockComputeInitialRoute(s, sig),
}));

vi.mock('../../src/util/analytics', () => ({
  logEvent: (name: string, props?: Record<string, unknown>) => mockLogEvent(name, props),
}));

vi.mock('../../src/state/appStore', () => ({
  useAppStore: {
    getState: () => ({
      setForceUpgradeBlocked: mockSetForceUpgradeBlocked,
      setSoftUpgradeAvailable: mockSetSoftUpgradeAvailable,
    }),
  },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: mockNavigationReplace,
    getParent: mockGetParent,
  }),
}));

import SplashScreen from '../../src/screens/splash/SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchAppVersion.mockReset();
    mockComputeUpgradeAction.mockReset();
    mockGetInstallationId.mockReset().mockResolvedValue('uuid-fake-001');
    mockGetFlavorContext.mockReset().mockReturnValue({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      versionName: '0.5.0',
      versionCode: 5,
      deviceModel: 'Test',
    });
    mockComputeInitialRoute.mockReset().mockReturnValue({
      stack: 'OnboardingStack',
      screen: 'Signup',
    });
    mockNavigationReplace.mockReset();
    mockGetParent.mockReset().mockReturnValue({ replace: vi.fn() });
    mockSetForceUpgradeBlocked.mockReset();
    mockSetSoftUpgradeAvailable.mockReset();
    mockLogEvent.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('Test 1: renders the brand logo + tagline (Real Humyns. Real Intelligence.)', () => {
    mockFetchAppVersion.mockResolvedValue(null);
    const { getByLabelText } = render(<SplashScreen />);
    // Logo
    expect(getByLabelText(/Humyn Labs logo/i)).toBeTruthy();
    // Tagline includes both halves; the second half ("Real Intelligence.")
    // is wrapped in an accent-colored sub-Text whose accessibilityLabel is
    // attached to the parent caption row.
    expect(getByLabelText('splash tagline')).toBeTruthy();
  });

  it('Test 2: force-upgrade verdict → setForceUpgradeBlocked(true) + replace(ForceUpgrade)', async () => {
    mockFetchAppVersion.mockResolvedValue({
      flavor: 'apkRollout',
      minSupported: '1.0.0',
      latest: '1.5.0',
      forceUpgrade: false,
      apkUrl: 'https://e.com/x.apk',
      apkSha256: 'a'.repeat(64),
      playStoreUrl: null,
    });
    mockComputeUpgradeAction.mockReturnValue({
      action: 'force-upgrade',
      reason: 'below-min-supported',
    });

    render(<SplashScreen />);
    // Drive the splash-min-time + version-check race to completion.
    await vi.advanceTimersByTimeAsync(2500);
    await waitFor(() => {
      expect(mockSetForceUpgradeBlocked).toHaveBeenCalledWith(true);
    });
    expect(mockNavigationReplace).toHaveBeenCalledWith(
      'ForceUpgrade',
      expect.objectContaining({ hardBlock: true }),
    );
    // Soft-banner NOT touched on the force-upgrade path.
    expect(mockSetSoftUpgradeAvailable).not.toHaveBeenCalled();
  });

  it('Test 3: soft-banner verdict → setSoftUpgradeAvailable + dispatches initial route', async () => {
    mockFetchAppVersion.mockResolvedValue({
      flavor: 'apkRollout',
      minSupported: '0.1.0',
      latest: '1.5.0',
      forceUpgrade: false,
      apkUrl: 'https://e.com/x.apk',
      apkSha256: 'a'.repeat(64),
      playStoreUrl: null,
    });
    mockComputeUpgradeAction.mockReturnValue({ action: 'soft-banner', latest: '1.5.0' });
    mockComputeInitialRoute.mockReturnValue({
      stack: 'OnboardingStack',
      screen: 'Signup',
    });

    render(<SplashScreen />);
    await vi.advanceTimersByTimeAsync(2500);
    await waitFor(() => {
      expect(mockSetSoftUpgradeAvailable).toHaveBeenCalledWith({ latest: '1.5.0' });
    });
    expect(mockNavigationReplace).toHaveBeenCalledWith('Signup');
    expect(mockSetForceUpgradeBlocked).not.toHaveBeenCalled();
  });

  it('Test 4: network failure → splash STILL advances after 2400 ms (no hang)', async () => {
    // fetchAppVersion returns null (graceful failure path from versionService).
    mockFetchAppVersion.mockResolvedValue(null);
    mockComputeInitialRoute.mockReturnValue({
      stack: 'OnboardingStack',
      screen: 'Signup',
    });

    render(<SplashScreen />);
    // Before 2400 ms — no navigation.
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockNavigationReplace).not.toHaveBeenCalled();
    // After 2400 ms — navigation fires even with null version response.
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => {
      expect(mockNavigationReplace).toHaveBeenCalledWith('Signup');
    });
    // No upgrade-state mutations on the null path.
    expect(mockSetForceUpgradeBlocked).not.toHaveBeenCalled();
    expect(mockSetSoftUpgradeAvailable).not.toHaveBeenCalled();
  });
});
