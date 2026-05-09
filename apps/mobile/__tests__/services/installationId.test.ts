// installationId service unit tests — D-COMPAT-03 + RESEARCH Open Question 3.
//
// First call mints (or fetches existing) via the Kotlin AppFlavor module and
// mirrors the value into MMKV at `installation_id.v1` for sync access from
// compat-signature computation. Subsequent calls short-circuit on the MMKV
// cache without touching the bridge.
//
// Pattern: rely on the canonical react-native-mmkv mock from vitest.setup.ts.
// We vi.mock the native AppFlavor surface so a faked installationId can be
// asserted against (and the bridge call counted).
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';

// Hoisted spy so tests can both inspect call count and override per-test.
const nativeMintOrFetch = vi.fn(async () => 'uuid-fake-001');

vi.mock('../../src/native/AppFlavor', () => ({
  // The service imports `getOrMintInstallationId` from this module. Other
  // exports aren't used by the service; stub them as no-ops for type peace.
  getOrMintInstallationId: () => nativeMintOrFetch(),
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '0.1.0',
    versionCode: 1,
    deviceModel: 'Test',
  }),
}));

describe('installationId service', () => {
  beforeEach(() => {
    secureMmkv.remove(KEYS.INSTALLATION_ID);
    nativeMintOrFetch.mockReset();
    nativeMintOrFetch.mockResolvedValue('uuid-fake-001');
  });

  it('Test 1: mints + persists to MMKV on first call', async () => {
    // Fresh install: MMKV cache is empty.
    expect(secureMmkv.getString(KEYS.INSTALLATION_ID)).toBeUndefined();

    const { getInstallationId } = await import('../../src/services/installationId');
    const result = await getInstallationId();

    expect(result).toBe('uuid-fake-001');
    expect(secureMmkv.getString(KEYS.INSTALLATION_ID)).toBe('uuid-fake-001');
    expect(nativeMintOrFetch).toHaveBeenCalledTimes(1);
  });

  it('Test 2: second call returns the cached value without hitting the bridge', async () => {
    secureMmkv.set(KEYS.INSTALLATION_ID, 'uuid-fake-001');

    const { getInstallationId } = await import('../../src/services/installationId');
    const result = await getInstallationId();

    expect(result).toBe('uuid-fake-001');
    expect(nativeMintOrFetch).not.toHaveBeenCalled();
  });
});
