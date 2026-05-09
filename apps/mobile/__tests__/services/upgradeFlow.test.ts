// upgradeFlow — D-UPG-01..02 service-level tests (plan 02-20).
//
// Mocking strategy: per-test vi.mock overrides the global react-native shim
// from vitest.setup.ts; the service file only imports `Linking` from react-
// native so the override is a one-prop module. HumynUpdater + AppFlavor are
// mocked at the module boundary so the native bridge never loads.
//
// Coverage:
//   1. apkRollout happy path → download → installer.
//   2. apkRollout SHA-256 mismatch → distinct catastrophic Analytics event,
//      throws apk_hash_mismatch, NEVER calls launchInstaller (T-2.20-01).
//   3. apkRollout generic download failure → distinct download_failed event.
//   4. playStore market:// success.
//   5. playStore market:// failure → falls back to https URL.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted binds spies into the same hoist scope as vi.mock factories;
// see Pattern 47. Without this, the const declarations would race the
// vi.mock hoist and crash with "Cannot access ... before initialization".
const { openURLMock, downloadMock, installerMock } = vi.hoisted(() => ({
  openURLMock: vi.fn(),
  downloadMock: vi.fn(),
  installerMock: vi.fn(),
}));

vi.mock('react-native', () => ({
  Linking: { openURL: openURLMock },
}));

vi.mock('../../src/native/HumynUpdater', () => ({
  downloadAndVerifyApk: (...a: unknown[]) => downloadMock(...a),
  launchInstaller: (...a: unknown[]) => installerMock(...a),
}));

vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'playStore',
    applicationId: 'ai.humynlabs.capture',
    versionName: '0.16.0',
    versionCode: 16,
    deviceModel: 'TestDevice',
  }),
}));

import {
  startUpgrade,
  ANALYTICS_EVENTS,
  isApkRolloutPayload,
} from '../../src/services/upgradeFlow';
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

const PS_PAYLOAD: AppVersionResponse = {
  flavor: 'playStore',
  minSupported: '0.1.0',
  latest: '0.2.0',
  forceUpgrade: true,
  apkUrl: null,
  apkSha256: null,
  playStoreUrl: 'https://play.google.com/store/apps/details?id=ai.humynlabs.capture',
};

beforeEach(() => {
  openURLMock.mockReset();
  downloadMock.mockReset();
  installerMock.mockReset();
});

describe('upgradeFlow.startUpgrade', () => {
  it('apkRollout: download → installer (happy path)', async () => {
    downloadMock.mockResolvedValue({ path: '/tmp/x.apk', sha256: 'a'.repeat(64) });
    installerMock.mockResolvedValue(true);
    await startUpgrade(APK_PAYLOAD);
    expect(downloadMock).toHaveBeenCalledWith(APK_PAYLOAD.apkUrl, APK_PAYLOAD.apkSha256);
    expect(installerMock).toHaveBeenCalledWith('/tmp/x.apk');
  });

  it('apkRollout: SHA-256 mismatch → catastrophic event + throws apk_hash_mismatch + NEVER calls launchInstaller', async () => {
    const logEvent = vi.fn();
    downloadMock.mockRejectedValue(new Error('apk_sha256_mismatch'));
    await expect(startUpgrade(APK_PAYLOAD, { logEvent })).rejects.toThrow('apk_hash_mismatch');
    expect(logEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.forceUpgradeApkHashMismatch,
      expect.objectContaining({
        apkUrl: APK_PAYLOAD.apkUrl,
        expectedSha256: APK_PAYLOAD.apkSha256,
      }),
    );
    expect(installerMock).not.toHaveBeenCalled();
  });

  it('apkRollout: also detects HASH_MISMATCH (Kotlin error code) as hash-mismatch', async () => {
    const logEvent = vi.fn();
    downloadMock.mockRejectedValue(new Error('HASH_MISMATCH'));
    await expect(startUpgrade(APK_PAYLOAD, { logEvent })).rejects.toThrow('apk_hash_mismatch');
    expect(logEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.forceUpgradeApkHashMismatch,
      expect.any(Object),
    );
    expect(installerMock).not.toHaveBeenCalled();
  });

  it('apkRollout: generic download error → distinct download_failed event + throws apk_download_failed', async () => {
    const logEvent = vi.fn();
    downloadMock.mockRejectedValue(new Error('connection_reset'));
    await expect(startUpgrade(APK_PAYLOAD, { logEvent })).rejects.toThrow('apk_download_failed');
    expect(logEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.forceUpgradeApkDownloadFailed,
      expect.objectContaining({ apkUrl: APK_PAYLOAD.apkUrl }),
    );
    expect(installerMock).not.toHaveBeenCalled();
  });

  it('playStore: opens market:// with the canonical applicationId', async () => {
    openURLMock.mockResolvedValue(undefined);
    await startUpgrade(PS_PAYLOAD);
    expect(openURLMock).toHaveBeenCalledWith('market://details?id=ai.humynlabs.capture');
  });

  it('playStore: falls back to https URL when market:// rejects', async () => {
    openURLMock.mockRejectedValueOnce(new Error('no_play_store')).mockResolvedValueOnce(undefined);
    await startUpgrade(PS_PAYLOAD);
    expect(openURLMock).toHaveBeenNthCalledWith(1, 'market://details?id=ai.humynlabs.capture');
    expect(openURLMock).toHaveBeenNthCalledWith(
      2,
      'https://play.google.com/store/apps/details?id=ai.humynlabs.capture',
    );
  });

  it('isApkRolloutPayload narrows correctly', () => {
    expect(isApkRolloutPayload(APK_PAYLOAD)).toBe(true);
    expect(isApkRolloutPayload(PS_PAYLOAD)).toBe(false);
  });
});
