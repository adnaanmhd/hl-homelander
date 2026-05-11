// initialRoute unit tests — RESEARCH § "Initial route gate-decision tree"
// + AUTH-11 (cross-device compat re-run via stale signature).
//
// Each test constructs a synthetic AppState (we don't use the real
// useAppStore here — the helper is a pure function over the state shape)
// and asserts the route returned by computeInitialRoute().

import { describe, it, expect } from 'vitest';

import { computeInitialRoute } from '../../src/state/initialRoute';
import type { AppState } from '../../src/state/appStore';

function baseState(overrides: Partial<AppState> = {}): AppState {
  // Defaults represent a "passed everything" state; individual tests
  // toggle one gate at a time. Action functions are stubbed to no-ops
  // because computeInitialRoute() reads only the data fields.
  return {
    jwt: 'jwt-token',
    consent: { acceptedAt: '2026-05-09T07:00:00.000Z', consentVersion: 'v1' },
    permsGranted: { camera: true, mic: true, grantedAt: '2026-05-09T07:01:00.000Z' },
    compatPassed: { signature: 'sig-fresh', runAt: '2026-05-09T07:02:00.000Z' },
    compatLastResult: null,
    tutorialDone: true,
    installationId: 'inst-uuid-1',
    appVersionCache: null,
    softUpgradeAvailable: null,
    forceUpgradeBlocked: false,
    user: null,
    setJwt: () => {},
    signOut: () => {},
    setConsent: () => {},
    setPermsGranted: () => {},
    setCompatResult: () => {},
    clearCompatPassed: () => {},
    setTutorialDone: () => {},
    setPracticeDone: () => {},
    setInstallationId: () => {},
    setAppVersionCache: () => {},
    setSoftUpgradeAvailable: () => {},
    setForceUpgradeBlocked: () => {},
    setUser: () => {},
    ...overrides,
  };
}

describe('computeInitialRoute', () => {
  it('Test 6: forceUpgradeBlocked=true → ForceUpgrade', () => {
    const route = computeInitialRoute(baseState({ forceUpgradeBlocked: true }), 'sig-fresh');
    expect(route).toEqual({ stack: 'ForceUpgrade', params: { hardBlock: true } });
  });

  it('Test 7: no JWT → OnboardingStack/Signup', () => {
    const route = computeInitialRoute(baseState({ jwt: null }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Signup' });
  });

  it('Test 8: JWT present, perms missing → OnboardingStack/Permissions', () => {
    const route = computeInitialRoute(baseState({ permsGranted: null }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Permissions' });
  });

  it('Test 8b: JWT present, perms missing camera grant → OnboardingStack/Permissions', () => {
    const route = computeInitialRoute(
      baseState({
        permsGranted: { camera: false, mic: true, grantedAt: '2026-05-09T07:01:00.000Z' },
      }),
      'sig-fresh',
    );
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Permissions' });
  });

  it('Test 9: JWT + perms but compatSignature stale (different installation_id) → OnboardingStack/Compat (AUTH-11)', () => {
    const route = computeInitialRoute(
      baseState({ compatPassed: { signature: 'sig-old', runAt: '2026-05-09T07:02:00.000Z' } }),
      'sig-NEW-after-reinstall',
    );
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Compat' });
  });

  it('Test 9b: JWT + perms but compatPassed=null → OnboardingStack/Compat', () => {
    const route = computeInitialRoute(baseState({ compatPassed: null }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Compat' });
  });

  it('Test 10: all gates passed but tutorialDone=false → OnboardingStack/RigTutorial', () => {
    const route = computeInitialRoute(baseState({ tutorialDone: false }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'RigTutorial' });
  });

  it('Test 11: all gates green → MainTabs', () => {
    const route = computeInitialRoute(baseState(), 'sig-fresh');
    expect(route).toEqual({ stack: 'MainTabs' });
  });

  it('Test 11b: when currentCompatSignature is null we accept the stored compat result (offline boot)', () => {
    // If we cannot compute the current signature (no Build.FINGERPRINT or
    // installation_id available — e.g. a service crash during compatService
    // init), trust the stored value rather than forcing a re-run on every cold
    // boot. AUTH-11 is the only signature mismatch that should trip the gate.
    const route = computeInitialRoute(baseState(), null);
    expect(route).toEqual({ stack: 'MainTabs' });
  });
});
