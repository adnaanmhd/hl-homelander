// versionService unit tests — D-UPG-04 / D-UPG-05 / D-UPG-06 / D-UPG-07
// + UPG-01 / UPG-02 / UPG-05.
//
// Covers cache hit / cache miss / network failure / schema mismatch /
// computeUpgradeAction matrix (force-upgrade via min-supported, soft-banner
// via latest, none, force-upgrade via flag-set escape hatch).
//
// Pattern: rely on the canonical react-native-mmkv mock from vitest.setup.ts.
// We vi.mock both the apiClient (avoiding real fetch) and the AppFlavor
// native surface (so `flavor` in the request can be deterministic).
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';

// Hoisted spy: import the apiClient through this so each test can reset
// + tweak `getJson`'s mocked behaviour.
const getJsonMock = vi.fn();
vi.mock('../../src/services/api', () => ({
  apiClient: {
    post: vi.fn(),
    postNoBody: vi.fn(),
    getJson: (path: string, opts?: { query?: Record<string, string>; timeoutMs?: number }) =>
      getJsonMock(path, opts),
  },
}));

vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '0.1.0',
    versionCode: 1,
    deviceModel: 'Test',
  }),
  getOrMintInstallationId: vi.fn(async () => 'uuid-fake-001'),
}));

// telemetryRing is reached via util/analytics; don't open that surface here.
// Instead, mock the analytics module so logEvent is a no-op spy.
vi.mock('../../src/util/analytics', () => ({
  EVENT_NAMES: [],
  logEvent: vi.fn(),
}));

const apkRolloutResponse = {
  flavor: 'apkRollout' as const,
  minSupported: '1.0.0',
  latest: '1.5.0',
  forceUpgrade: false,
  apkUrl: 'https://example.com/foo.apk',
  apkSha256: 'a'.repeat(64),
  playStoreUrl: null,
};

function freshMmkv() {
  for (const k of Object.values(KEYS)) {
    secureMmkv.remove(k);
  }
}

describe('fetchAppVersion', () => {
  beforeEach(() => {
    freshMmkv();
    getJsonMock.mockReset();
  });

  it('Test 7: returns cached response if cache age < 6h', async () => {
    const fresh = { response: apkRolloutResponse, fetchedAt: Date.now() - 60_000 };
    secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(fresh));

    const { fetchAppVersion } = await import('../../src/services/versionService');
    const out = await fetchAppVersion();

    expect(out).toEqual(apkRolloutResponse);
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it('Test 8: stale cache → calls apiClient.getJson and persists fresh response', async () => {
    const stale = {
      response: { ...apkRolloutResponse, latest: '1.4.0' },
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000, // 7 h ago
    };
    secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(stale));

    getJsonMock.mockResolvedValueOnce(apkRolloutResponse);

    const { fetchAppVersion } = await import('../../src/services/versionService');
    const out = await fetchAppVersion();

    expect(out).toEqual(apkRolloutResponse);
    expect(getJsonMock).toHaveBeenCalledTimes(1);
    expect(getJsonMock).toHaveBeenCalledWith(
      '/app/version',
      expect.objectContaining({
        query: { flavor: 'apkRollout' },
        timeoutMs: 5000,
      }),
    );
    // Persisted to MMKV.
    const raw = secureMmkv.getString(KEYS.APP_VERSION_CACHE);
    expect(raw).toBeDefined();
    const persisted = JSON.parse(raw as string) as { response: unknown; fetchedAt: number };
    expect(persisted.response).toEqual(apkRolloutResponse);
  });

  it('Test 9: network failure returns stale cache if any, else null', async () => {
    // Case A: stale cache exists → returns it.
    const stale = {
      response: { ...apkRolloutResponse, latest: '1.4.0' },
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000,
    };
    secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(stale));
    getJsonMock.mockRejectedValueOnce(new Error('network fail'));

    const { fetchAppVersion } = await import('../../src/services/versionService');
    const outA = await fetchAppVersion();
    expect(outA).toEqual(stale.response);

    // Case B: no cache → returns null.
    freshMmkv();
    getJsonMock.mockReset();
    getJsonMock.mockRejectedValueOnce(new Error('network fail again'));
    const outB = await fetchAppVersion();
    expect(outB).toBeNull();
  });
});

describe('computeUpgradeAction', () => {
  it('Test 10: installed < minSupported → force-upgrade (below-min-supported)', async () => {
    const { computeUpgradeAction } = await import('../../src/services/versionService');
    const action = computeUpgradeAction('0.5.0', { ...apkRolloutResponse, minSupported: '1.0.0' });
    expect(action).toEqual({ action: 'force-upgrade', reason: 'below-min-supported' });
  });

  it('Test 11: installed in [minSupported, latest) → soft-banner with latest', async () => {
    const { computeUpgradeAction } = await import('../../src/services/versionService');
    const action = computeUpgradeAction('1.2.0', {
      ...apkRolloutResponse,
      minSupported: '1.0.0',
      latest: '1.5.0',
    });
    expect(action).toEqual({ action: 'soft-banner', latest: '1.5.0' });
  });

  it('Test 12: installed == latest → none', async () => {
    const { computeUpgradeAction } = await import('../../src/services/versionService');
    const action = computeUpgradeAction('1.5.0', {
      ...apkRolloutResponse,
      minSupported: '1.0.0',
      latest: '1.5.0',
    });
    expect(action).toEqual({ action: 'none' });
  });

  it('Test 13: forceUpgrade=true overrides even when installed >= latest', async () => {
    const { computeUpgradeAction } = await import('../../src/services/versionService');
    const action = computeUpgradeAction('1.5.0', {
      ...apkRolloutResponse,
      minSupported: '1.0.0',
      latest: '1.5.0',
      forceUpgrade: true,
    });
    expect(action).toEqual({ action: 'force-upgrade', reason: 'flag-set' });
  });
});
