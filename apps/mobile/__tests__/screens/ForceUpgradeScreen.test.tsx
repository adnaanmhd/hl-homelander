// ForceUpgradeScreen — UPG-03 + D-UPG-01..04 contract (plan 02-20).
//
// Coverage:
//   1. Renders verbatim §9 / D-UPG-01 title "Update to continue.".
//   2. Tap Update → upgradeFlow.startUpgrade(payload) is called with the
//      Zustand-store payload.
//   3. apk_hash_mismatch error path → Alert with the integrity-check copy
//      (D-UPG-02).
//   4. apk_download_failed error path → Alert with the connection copy.
//   5. No payload → Alert "Update info unavailable".
//   6. hardBlock=true → BackHandler.addEventListener returns true (back
//      pressed swallowed). Asserts the registered listener returns true.
//
// Mocking pattern: vi.hoisted spies for service + analytics + react-native
// Alert / BackHandler. The setup file's react-native shim provides
// View/Text/Pressable/etc.; we extend it per-test by re-mocking only the
// specific named exports we need to spy on (Alert, BackHandler) — the rest
// of the module passes through.

import React from 'react';
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted spies — Pattern 47.
const { startUpgradeMock, alertMock, addEventListenerMock, removeMock, logEventMock, mockState } =
  vi.hoisted(() => ({
    startUpgradeMock: vi.fn(),
    alertMock: vi.fn(),
    addEventListenerMock: vi.fn(),
    removeMock: vi.fn(),
    logEventMock: vi.fn(),
    mockState: {
      appVersionCache: null as { response: unknown; fetchedAt: number } | null,
    },
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

// Spy on Alert + BackHandler at module-eval time. The setup-file's react-
// native shim already exports default no-op stubs for both — we replace
// their internals via a per-test vi.mock factory that reuses the host-
// component shim. Since vi.importActual('react-native') would parse the
// real Flow-typed source (which Vite can't transform), we replicate just
// the shape ForceUpgradeScreen consumes.
vi.mock('react-native', async () => {
  const React = await import('react');
  function makeHost(name: string) {
    return React.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const {
        children,
        accessibilityLabel,
        accessibilityRole,
        onPress,
        style: _style,
        ...rest
      } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      return React.createElement('div', dom, children as React.ReactNode);
    });
  }
  return {
    View: makeHost('View'),
    Text: makeHost('Text'),
    Pressable: makeHost('Pressable'),
    SafeAreaView: makeHost('SafeAreaView'),
    ScrollView: makeHost('ScrollView'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(s: T): T => s,
      flatten: <T,>(s: T): T => s,
    },
    Alert: { alert: alertMock },
    BackHandler: { addEventListener: addEventListenerMock },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default,
    },
  };
});

import ForceUpgradeScreen from '../../src/screens/force-upgrade/ForceUpgradeScreen';
import type { AppVersionResponse } from '@humyn/shared-types';

const APK_PAYLOAD: AppVersionResponse = {
  flavor: 'apkRollout',
  minSupported: '0.1.0',
  latest: '0.2.0',
  forceUpgrade: true,
  apkUrl: 'https://cdn.example.com/x.apk',
  apkSha256: 'a'.repeat(64),
  playStoreUrl: null,
};

beforeEach(() => {
  startUpgradeMock.mockReset();
  alertMock.mockReset();
  addEventListenerMock.mockReset();
  removeMock.mockReset();
  logEventMock.mockReset();
  // BackHandler.addEventListener returns a subscription with .remove().
  addEventListenerMock.mockReturnValue({ remove: removeMock });
  mockState.appVersionCache = { response: APK_PAYLOAD, fetchedAt: Date.now() };
});

afterEach(() => {
  cleanup();
});

describe('ForceUpgradeScreen (UPG-03 / D-UPG-01..04)', () => {
  it('renders the verbatim §9 title and body', () => {
    render(<ForceUpgradeScreen />);
    expect(screen.getByText('Update to continue.')).toBeTruthy();
    expect(
      screen.getByText('A newer version of Humyn Labs Capture is required to keep recording.'),
    ).toBeTruthy();
  });

  it('renders the screen container with accessibilityLabel="force-upgrade-screen"', () => {
    render(<ForceUpgradeScreen />);
    expect(screen.getByLabelText('force-upgrade-screen')).toBeTruthy();
  });

  it('hardBlock=true (default) registers a hardware-back listener that returns true', () => {
    render(<ForceUpgradeScreen />);
    expect(addEventListenerMock).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addEventListenerMock.mock.calls[0]?.[1] as () => boolean;
    expect(handler()).toBe(true);
  });

  it('tap Update → calls startUpgrade with the store payload', async () => {
    startUpgradeMock.mockResolvedValue(undefined);
    render(<ForceUpgradeScreen />);
    fireEvent.click(screen.getByLabelText('force-upgrade-update'));
    await waitFor(() => {
      expect(startUpgradeMock).toHaveBeenCalledWith(APK_PAYLOAD);
    });
  });

  it('apk_hash_mismatch error path → Alert with the D-UPG-02 integrity-check copy', async () => {
    startUpgradeMock.mockRejectedValue(new Error('apk_hash_mismatch'));
    render(<ForceUpgradeScreen />);
    fireEvent.click(screen.getByLabelText('force-upgrade-update'));
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        'Update failed (integrity check)',
        'Try again or contact support.',
      );
    });
  });

  it('apk_download_failed error path → Alert with the connection copy', async () => {
    startUpgradeMock.mockRejectedValue(new Error('apk_download_failed'));
    render(<ForceUpgradeScreen />);
    fireEvent.click(screen.getByLabelText('force-upgrade-update'));
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        'Update failed',
        'Check your connection and try again.',
      );
    });
  });

  it('no payload → Alert "Update info unavailable"', async () => {
    mockState.appVersionCache = null;
    render(<ForceUpgradeScreen />);
    fireEvent.click(screen.getByLabelText('force-upgrade-update'));
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Update info unavailable', 'Try again in a moment.');
    });
    expect(startUpgradeMock).not.toHaveBeenCalled();
  });

  it('emits upg_force_upgrade_shown analytics event on mount', () => {
    render(<ForceUpgradeScreen />);
    expect(logEventMock).toHaveBeenCalledWith(
      'upg_force_upgrade_shown',
      expect.objectContaining({ flavor: 'apkRollout' }),
    );
  });
});
