// SoftUpgradeBanner — UPG-04 + D-UPG-05 contract (plan 02-20).
//
// Coverage:
//   1. Returns null when softUpgradeAvailable is null.
//   2. Returns null when payload is null (versionService didn't write it).
//   3. Returns null when MMKV already has the per-version dismiss key set
//      (cold-start respects prior dismissal).
//   4. Renders title + body with the correct version when payload present.
//   5. Tap × dismisses → MMKV.set(softBannerDismissKey(latest), 'true') AND
//      banner unmounts.
//   6. Tap Update → upgradeFlow.startUpgrade(payload) is called.
//   7. Per-version isolation: dismissing latest=0.2.0 does NOT block a
//      subsequent render with a new latest=0.3.0 (the dismiss key auto-resets).
//
// Mocking pattern: vi.hoisted spies for service + store + MMKV. The setup
// file already mocks react-native-mmkv.

import React from 'react';
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { startUpgradeMock, mmkvStore, mockState, logEventMock } = vi.hoisted(() => ({
  startUpgradeMock: vi.fn(),
  // In-memory MMKV stand-in used by both the mock and the assertions.
  mmkvStore: new Map<string, string>(),
  mockState: {
    softUpgradeAvailable: null as { latest: string } | null,
    appVersionCache: null as { response: unknown; fetchedAt: number } | null,
  },
  logEventMock: vi.fn(),
}));

vi.mock('../../src/services/upgradeFlow', () => ({
  startUpgrade: startUpgradeMock,
}));

vi.mock('../../src/util/analytics', () => ({
  logEvent: logEventMock,
}));

vi.mock('../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: typeof mockState) => T) => selector(mockState),
}));

vi.mock('../../src/state/mmkv', () => ({
  secureMmkv: {
    getString: (key: string) => mmkvStore.get(key),
    set: (key: string, value: string) => mmkvStore.set(key, value),
    remove: (key: string) => mmkvStore.delete(key),
  },
}));

import { SoftUpgradeBanner } from '../../src/components/SoftUpgradeBanner';
import { softBannerDismissKey } from '../../src/state/keys';
import type { AppVersionResponse } from '@humyn/shared-types';

const PS_PAYLOAD: AppVersionResponse = {
  flavor: 'playStore',
  minSupported: '0.1.0',
  latest: '0.2.0',
  forceUpgrade: false,
  apkUrl: null,
  apkSha256: null,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.humynlabs.capture',
};

beforeEach(() => {
  startUpgradeMock.mockReset();
  logEventMock.mockReset();
  mmkvStore.clear();
  mockState.softUpgradeAvailable = null;
  mockState.appVersionCache = null;
});

afterEach(() => {
  cleanup();
});

describe('SoftUpgradeBanner (UPG-04 / D-UPG-05)', () => {
  it('returns null when softUpgradeAvailable is null', () => {
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    const { queryByLabelText } = render(<SoftUpgradeBanner />);
    expect(queryByLabelText('soft-upgrade-banner')).toBeNull();
  });

  it('returns null when appVersionCache is null', () => {
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    const { queryByLabelText } = render(<SoftUpgradeBanner />);
    expect(queryByLabelText('soft-upgrade-banner')).toBeNull();
  });

  it('returns null when MMKV has the per-version dismiss key already set', () => {
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    mmkvStore.set(softBannerDismissKey('0.2.0'), 'true');
    const { queryByLabelText } = render(<SoftUpgradeBanner />);
    expect(queryByLabelText('soft-upgrade-banner')).toBeNull();
  });

  it('renders title + body with the correct latest version', () => {
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    render(<SoftUpgradeBanner />);
    expect(screen.getByText('A new version is available')).toBeTruthy();
    expect(screen.getByText('Update to v0.2.0 for the latest improvements.')).toBeTruthy();
  });

  it('tap dismiss writes the per-version key + unmounts the banner', async () => {
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    const { queryByLabelText } = render(<SoftUpgradeBanner />);
    fireEvent.click(screen.getByLabelText('soft-upgrade-dismiss'));
    await waitFor(() => {
      expect(queryByLabelText('soft-upgrade-banner')).toBeNull();
    });
    expect(mmkvStore.get(softBannerDismissKey('0.2.0'))).toBe('true');
    expect(logEventMock).toHaveBeenCalledWith(
      'upg_soft_banner_dismissed',
      expect.objectContaining({ latest: '0.2.0' }),
    );
  });

  it('tap Update → startUpgrade called with the store payload', async () => {
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    startUpgradeMock.mockResolvedValue(undefined);
    render(<SoftUpgradeBanner />);
    fireEvent.click(screen.getByLabelText('soft-upgrade-update'));
    await waitFor(() => {
      expect(startUpgradeMock).toHaveBeenCalledWith(PS_PAYLOAD);
    });
    expect(logEventMock).toHaveBeenCalledWith(
      'upg_soft_banner_tapped',
      expect.objectContaining({ flavor: 'playStore', latest: '0.2.0' }),
    );
  });

  it('per-version isolation: dismiss(0.2.0) does NOT block a fresh render with latest=0.3.0', () => {
    // First mount + dismiss at 0.2.0.
    mockState.softUpgradeAvailable = { latest: '0.2.0' };
    mockState.appVersionCache = { response: PS_PAYLOAD, fetchedAt: Date.now() };
    const first = render(<SoftUpgradeBanner />);
    fireEvent.click(screen.getByLabelText('soft-upgrade-dismiss'));
    first.unmount();

    // New `latest` arrives — both the trigger flag and the payload's
    // `latest` field bump. T-2.20-04: dismissal at 0.2.0 must NOT carry
    // over to 0.3.0.
    const NEXT_PAYLOAD: AppVersionResponse = { ...PS_PAYLOAD, latest: '0.3.0' };
    mockState.softUpgradeAvailable = { latest: '0.3.0' };
    mockState.appVersionCache = { response: NEXT_PAYLOAD, fetchedAt: Date.now() };
    const second = render(<SoftUpgradeBanner />);
    expect(second.queryByLabelText('soft-upgrade-banner')).toBeTruthy();
    expect(screen.getByText('Update to v0.3.0 for the latest improvements.')).toBeTruthy();
  });
});
