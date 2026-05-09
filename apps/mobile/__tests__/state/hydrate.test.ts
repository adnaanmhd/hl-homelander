// hydrate() unit tests — D-STATE-02 + boot-time MMKV→Zustand seeding.
//
// Pre-seeds MMKV via the canonical singleton (vitest mock keeps a shared
// in-memory store), invokes hydrate(), and asserts the Zustand store
// reflects the persisted values. The malformed-payload test covers the
// graceful-degrade path on a tampered or version-skewed compat blob.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CompatResult } from '@humyn/shared-types';

import { hydrate } from '../../src/state/hydrate';
import { useAppStore } from '../../src/state/appStore';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';

function reset() {
  for (const k of Object.values(KEYS)) {
    secureMmkv.remove(k);
  }
  useAppStore.setState({
    jwt: null,
    consent: null,
    permsGranted: null,
    compatPassed: null,
    compatLastResult: null,
    tutorialDone: false,
    installationId: null,
    appVersionCache: null,
    softUpgradeAvailable: null,
    forceUpgradeBlocked: false,
  });
}

describe('hydrate()', () => {
  beforeEach(reset);

  it('Test 4: pre-seeded jwt + installation_id flow into the store', () => {
    secureMmkv.set(KEYS.AUTH_JWT, 'token123');
    secureMmkv.set(KEYS.INSTALLATION_ID, 'uuid-abc');

    hydrate();

    const s = useAppStore.getState();
    expect(s.jwt).toBe('token123');
    expect(s.installationId).toBe('uuid-abc');
  });

  it('Test 4b: a valid CompatResult JSON pre-seeded under compat.lastResult.v1 hydrates as the parsed object', () => {
    const result: CompatResult = {
      signature: 'sig-xyz',
      runAt: '2026-05-09T08:00:00.000Z',
      checks: {
        resolution: true,
        fps: true,
        ultrawideDfov: { pass: true, measuredDeg: 113 },
        imuSustained100Hz: { pass: true, measuredHz: 110 },
        imuP99Ms: { pass: true, measuredMs: 0.8 },
        micSampleRate: true,
        realtimeTimestamp: true,
        root: { pass: true, verdict: 'MEETS_DEVICE_INTEGRITY' },
        freeStorageGB: { pass: true, warningOnly: false, measuredGB: 12 },
        encoderNoBFrames: true,
        oisOff: true,
        hdrSdrForced: true,
      },
      passed: true,
      failedKeys: [],
    };
    secureMmkv.set(KEYS.COMPAT_LAST_RESULT, JSON.stringify(result));

    hydrate();

    expect(useAppStore.getState().compatLastResult).toEqual(result);
  });

  it('Test 5: malformed compat.lastResult.v1 JSON degrades to null without throwing', () => {
    secureMmkv.set(KEYS.COMPAT_LAST_RESULT, '{ this is not json }');
    secureMmkv.set(KEYS.ONBOARDING_COMPAT_PASSED, '{ also broken }');

    // Spy on console.warn to assert hydrate logged a warning rather than
    // crashing. The helper isn't required to emit a specific message — only
    // that it didn't throw.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => hydrate()).not.toThrow();

    const s = useAppStore.getState();
    expect(s.compatLastResult).toBeNull();
    expect(s.compatPassed).toBeNull();

    warnSpy.mockRestore();
  });
});
