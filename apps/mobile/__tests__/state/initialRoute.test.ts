// initialRoute unit tests — RESEARCH § "Initial route gate-decision tree"
// + AUTH-11 (cross-device compat re-run via stale signature)
// + ONB-08 / D-NAV-04 (per-Google-account practice-tutorial gate, plan 04-03).
//
// Each test constructs a synthetic AppState (we don't use the real
// useAppStore here — the helper is mostly a pure function over the state
// shape) and asserts the route returned by computeInitialRoute(). The one
// side-effect computeInitialRoute now has is reading the per-account
// practice-tutorial flag from MMKV; we seed/clear that via the canonical
// react-native-mmkv mock (vitest.setup.ts — one in-memory store keyed by id).

import { describe, it, expect, beforeEach } from 'vitest';

import { computeInitialRoute } from '../../src/state/initialRoute';
import type { AppState } from '../../src/state/appStore';
import { secureMmkv } from '../../src/state/mmkv';
import { practiceDoneKey } from '../../src/state/keys';
import { decodeGoogleSubFromJwt } from '../../src/lib/jwtSub';
// Phase 7 plan 07-04 — the new D-22 locale gate sits ABOVE every other
// non-force-upgrade gate. Tests below assume the gate is already satisfied
// (the user picked a locale at first launch); see `seedLocaleGate()` in the
// beforeEach. Tests that exercise the locale-gate behavior itself live in
// `initialRoute.locale.test.ts`.
import { localeMmkv, LOCALE_KEYS } from '../../src/i18n/storage';

// Build a JWS-shaped token whose payload carries `sub`. Node's base64url
// encoding is the exact inverse of decodeGoogleSubFromJwt's decode path.
function makeJwt(sub: string): string {
  const b64 = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `eyJhbGciOiJSUzI1NiJ9.${b64}.signature-bytes`;
}

const JWT_SUB_A = makeJwt('A');
const JWT_SUB_B = makeJwt('B');

function baseState(overrides: Partial<AppState> = {}): AppState {
  // Defaults represent a "passed everything" state; individual tests
  // toggle one gate at a time. Action functions are stubbed to no-ops
  // because computeInitialRoute() reads only the data fields.
  //
  // NOTE: the default jwt now encodes sub="A" so the practice-flag gate
  // (which keys off decodeGoogleSubFromJwt(s.jwt)) is exercised by the
  // "all green" cases — those tests seed practiceDoneKey('A') = true.
  return {
    jwt: JWT_SUB_A,
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
    // Phase 6 Wave 3 — Home / History range defaults. computeInitialRoute
    // never reads these but the AppState type now requires them, so the
    // baseState builder stubs the canonical defaults.
    homeRange: 'today',
    homeRangeCustom: null,
    historyRange: 'all',
    historyRangeCustom: null,
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
    setHomeRange: () => {},
    setHomeRangeCustom: () => {},
    setHistoryRange: () => {},
    setHistoryRangeCustom: () => {},
    ...overrides,
  };
}

function clearPracticeFlags() {
  secureMmkv.remove(practiceDoneKey('A'));
  secureMmkv.remove(practiceDoneKey('B'));
  secureMmkv.remove(practiceDoneKey(''));
}

/**
 * Phase 7 plan 07-04 — seed the locale gate so the (newly-added) D-22
 * first-launch picker doesn't catch these legacy gate tests. Without this,
 * every test below would route to ChooseLanguage. The locale-gate's own
 * coverage lives in `initialRoute.locale.test.ts`.
 */
function seedLocaleGate() {
  localeMmkv.set(LOCALE_KEYS.CODE, 'en');
  localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, '2026-05-24T00:00:00.000Z');
}

describe('computeInitialRoute', () => {
  beforeEach(() => {
    clearPracticeFlags();
    seedLocaleGate();
  });

  it('Test 6: forceUpgradeBlocked=true → ForceUpgrade', () => {
    const route = computeInitialRoute(baseState({ forceUpgradeBlocked: true }), 'sig-fresh');
    expect(route).toEqual({ stack: 'ForceUpgrade', params: { hardBlock: true } });
  });

  it('Test 7: no JWT → OnboardingStack/Signup (never reaches the practice gate, no MMKV read)', () => {
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

  it('Test 9c: practice gate is composed AFTER compat — compatPassed missing wins regardless of the practice flag', () => {
    // Even with the per-account practice flag set, a missing/stale compat run
    // still routes to Compat (Pitfall 8 — composition order).
    secureMmkv.set(practiceDoneKey('A'), true);
    const route = computeInitialRoute(baseState({ compatPassed: null }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'Compat' });
  });

  it('Test 10: all compat gates passed but the per-account practice flag is missing → OnboardingStack/RigTutorial (ONB-08)', () => {
    // No practiceDoneKey('A') seeded — the user has not completed the 60-s
    // practice for this Google account yet, so re-run the tutorial. (The
    // legacy s.tutorialDone bool is true here; it alone is no longer the gate.)
    const route = computeInitialRoute(baseState(), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'RigTutorial' });
  });

  it('Test 10b: per-account semantics — sub A routed to RigTutorial when only sub B has the practice flag', () => {
    // Seed the practice flag for a DIFFERENT account; sub A's gate is not
    // satisfied by sub B's flag.
    secureMmkv.set(practiceDoneKey('B'), true);
    const route = computeInitialRoute(baseState({ jwt: JWT_SUB_A }), 'sig-fresh');
    expect(route).toEqual({ stack: 'OnboardingStack', screen: 'RigTutorial' });
    // And: with B's jwt, the flag IS satisfied → MainTabs (cross-check).
    const routeB = computeInitialRoute(baseState({ jwt: JWT_SUB_B }), 'sig-fresh');
    expect(routeB).toEqual({ stack: 'MainTabs' });
  });

  it('Test 11: all gates green AND the per-account practice flag set → MainTabs', () => {
    secureMmkv.set(practiceDoneKey('A'), true);
    const route = computeInitialRoute(baseState(), 'sig-fresh');
    expect(route).toEqual({ stack: 'MainTabs' });
  });

  it('Test 11b: when currentCompatSignature is null we accept the stored compat result (offline boot)', () => {
    // If we cannot compute the current signature (no Build.FINGERPRINT or
    // installation_id available — e.g. a service crash during compatService
    // init), trust the stored value rather than forcing a re-run on every cold
    // boot. AUTH-11 is the only signature mismatch that should trip the gate.
    // (Practice flag set so the only thing under test is the compat-null path.)
    secureMmkv.set(practiceDoneKey('A'), true);
    const route = computeInitialRoute(baseState(), null);
    expect(route).toEqual({ stack: 'MainTabs' });
  });

  it('Test 11c: practice flag set under the empty-sub key satisfies a malformed/empty jwt (no soft-lock parity)', () => {
    // decodeGoogleSubFromJwt('not-a-jwt') → '' → practiceDoneKey('') key. A
    // malformed jwt that nevertheless reached this gate uses the deterministic
    // empty-sub key; if set, the user goes to MainTabs (mirrors the
    // setPracticeDone('') write-through contract).
    secureMmkv.set(practiceDoneKey(decodeGoogleSubFromJwt('not-a-jwt')), true);
    const route = computeInitialRoute(baseState({ jwt: 'not-a-jwt' }), 'sig-fresh');
    expect(route).toEqual({ stack: 'MainTabs' });
  });
});
