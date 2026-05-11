// appStore unit tests — D-STATE-02 + D-STATE-04 + D-COMPAT-05.
//
// Pattern: rely on the canonical react-native-mmkv mock from vitest.setup.ts
// (one shared in-memory store keyed by id). Each test resets the store via
// useAppStore.setState(...) at the top so test order doesn't matter.
//
// We do NOT vi.mock the appStore itself — these tests cover its real
// behaviour (set/clear of state + MMKV side-effects).
import { describe, it, expect, beforeEach } from 'vitest';
import type { CompatResult } from '@humyn/shared-types';

import { useAppStore } from '../../src/state/appStore';
import { secureMmkv } from '../../src/state/mmkv';
import { KEYS, practiceDoneKey } from '../../src/state/keys';

function freshState() {
  // Reset every persistent key + every store field so tests are isolated.
  for (const k of Object.values(KEYS)) {
    secureMmkv.remove(k);
  }
  secureMmkv.remove(practiceDoneKey('sub-A'));
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

const baseCompatResult: CompatResult = {
  signature: 'sig-abc-123',
  runAt: '2026-05-09T12:00:00.000Z',
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

describe('useAppStore', () => {
  beforeEach(freshState);

  it('Test 1: a fresh store has all fields nullable/empty per D-STATE-02', () => {
    const s = useAppStore.getState();
    expect(s.jwt).toBeNull();
    expect(s.consent).toBeNull();
    expect(s.permsGranted).toBeNull();
    expect(s.compatPassed).toBeNull();
    expect(s.compatLastResult).toBeNull();
    expect(s.tutorialDone).toBe(false);
    expect(s.installationId).toBeNull();
    expect(s.appVersionCache).toBeNull();
    expect(s.softUpgradeAvailable).toBeNull();
    expect(s.forceUpgradeBlocked).toBe(false);
  });

  it('Test 2: setCompatResult(passed=true) populates compatPassed + compatLastResult', () => {
    const result: CompatResult = { ...baseCompatResult, passed: true };
    useAppStore.getState().setCompatResult(result);

    const s = useAppStore.getState();
    expect(s.compatLastResult).toEqual(result);
    expect(s.compatPassed).toEqual({
      signature: result.signature,
      runAt: result.runAt,
    });
    // Persistence side-effects: full result + passed-summary in MMKV.
    expect(secureMmkv.getString(KEYS.COMPAT_LAST_RESULT)).toBe(JSON.stringify(result));
    expect(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED)).toBe(
      JSON.stringify({ signature: result.signature, runAt: result.runAt }),
    );
  });

  it('Test 2b (failed-result side): setCompatResult(passed=false) clears compatPassed but keeps compatLastResult', () => {
    // Seed a passed run first so we can prove the second call clears it.
    useAppStore.getState().setCompatResult({ ...baseCompatResult, passed: true });
    expect(useAppStore.getState().compatPassed).not.toBeNull();

    const failed: CompatResult = {
      ...baseCompatResult,
      passed: false,
      failedKeys: ['ultrawideDfov'],
      checks: {
        ...baseCompatResult.checks,
        ultrawideDfov: { pass: false, measuredDeg: 95 },
      },
    };
    useAppStore.getState().setCompatResult(failed);

    const s = useAppStore.getState();
    expect(s.compatLastResult).toEqual(failed);
    expect(s.compatPassed).toBeNull();
    expect(secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED)).toBeUndefined();
  });

  it('Test 3: signOut() clears jwt and removes KEYS.AUTH_JWT from MMKV', () => {
    // Seed via setJwt so the singleton store reflects both layers.
    useAppStore.getState().setJwt('token-abc');
    expect(useAppStore.getState().jwt).toBe('token-abc');
    expect(secureMmkv.getString(KEYS.AUTH_JWT)).toBe('token-abc');

    useAppStore.getState().signOut();

    expect(useAppStore.getState().jwt).toBeNull();
    expect(secureMmkv.getString(KEYS.AUTH_JWT)).toBeUndefined();
  });

  it('Test 4: setPracticeDone(sub) writes true to MMKV at practiceDoneKey(sub) and is idempotent (ONB-08)', () => {
    expect(secureMmkv.getBoolean(practiceDoneKey('sub-A'))).toBe(false);
    useAppStore.getState().setPracticeDone('sub-A');
    expect(secureMmkv.getBoolean(practiceDoneKey('sub-A'))).toBe(true);
    // Idempotent — a second call is a no-op (still true, no throw).
    useAppStore.getState().setPracticeDone('sub-A');
    expect(secureMmkv.getBoolean(practiceDoneKey('sub-A'))).toBe(true);
  });
});
