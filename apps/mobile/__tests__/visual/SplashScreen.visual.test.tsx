// Plan 03-02 — Visual snapshot for SplashScreen.
//
// The baseline catches:
//   - Logo Image presence (the Plan 03-01 density-bucketed wordmark)
//   - Tagline Text block
//   - Animated.View wrappers around both
//
// Render-tree shape changes (e.g., CTA appearing on splash, animation
// wrapper dropped) flip the PNG and the diff fires.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Force every dynamic dep to a deterministic stub so the rendered tree
// is byte-stable across runs.
const {
  mockFetchAppVersion,
  mockGetInstallationId,
  mockGetFlavorContext,
  mockComputeInitialRoute,
} = vi.hoisted(() => ({
  mockFetchAppVersion: vi.fn(),
  mockGetInstallationId: vi.fn(),
  mockGetFlavorContext: vi.fn(),
  mockComputeInitialRoute: vi.fn(),
}));

vi.mock('../../src/services/versionService', () => ({
  fetchAppVersion: () => mockFetchAppVersion(),
  computeUpgradeAction: () => ({ action: 'no-op' }),
}));
vi.mock('../../src/services/installationId', () => ({
  getInstallationId: () => mockGetInstallationId(),
}));
vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => mockGetFlavorContext(),
}));
vi.mock('../../src/state/initialRoute', () => ({
  computeInitialRoute: () => mockComputeInitialRoute(),
}));
vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('../../src/state/appStore', () => ({
  useAppStore: {
    getState: () => ({
      setForceUpgradeBlocked: () => undefined,
      setSoftUpgradeAvailable: () => undefined,
    }),
  },
}));

import SplashScreen from '../../src/screens/splash/SplashScreen';
import { renderToImage } from './_utils/renderToImage';

describe('SplashScreen visual', () => {
  beforeEach(() => {
    mockFetchAppVersion.mockResolvedValue(null);
    mockGetInstallationId.mockResolvedValue('uuid-fake-001');
    mockGetFlavorContext.mockReturnValue({
      flavor: 'apkRollout',
      applicationId: 'ai.humynlabs.capture.apk',
      versionName: '0.5.0',
      versionCode: 5,
      deviceModel: 'Test',
    });
    mockComputeInitialRoute.mockReturnValue({ stack: 'OnboardingStack', screen: 'Signup' });
  });
  afterEach(() => {
    cleanup();
  });

  it('matches baseline (logo + tagline structure)', () => {
    const { container } = render(<SplashScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
