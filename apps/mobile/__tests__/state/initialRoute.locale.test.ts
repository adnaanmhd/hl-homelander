// initialRoute — Phase 7 plan 07-04 locale gate (D-22 / I18N-02).
//
// Three cases pin the new gate's behaviour:
//   1. Fresh install (no MMKV locale.chosen_at) → ChooseLanguage.
//   2. ForceUpgrade still beats the locale gate (priority order preserved).
//   3. After locale.chosen_at is set (and JWT still missing) → Signup.
//
// Test path under `apps/mobile/__tests__/state/` matches the existing
// convention (`initialRoute.test.ts` lives here too). The plan's frontmatter
// pointed at `apps/mobile/src/state/__tests__/` but that path is outside the
// vitest `include` glob — see 07-01-SUMMARY.md + 07-03-SUMMARY.md Rule-3
// deviation. The naming `.locale.test.ts` (vs the existing `.test.ts`) keeps
// the two test files separate but discoverable.

import { describe, it, expect, beforeEach } from 'vitest';

import { computeInitialRoute } from '../../src/state/initialRoute';
import type { AppState } from '../../src/state/appStore';
import { localeMmkv, LOCALE_KEYS } from '../../src/i18n/storage';

function clearLocale() {
  try {
    localeMmkv.remove(LOCALE_KEYS.CODE);
  } catch {
    /* best-effort */
  }
  try {
    localeMmkv.remove(LOCALE_KEYS.CHOSEN_AT);
  } catch {
    /* best-effort */
  }
}

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
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
    user: null,
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

describe('computeInitialRoute — locale gate (D-22 / I18N-02)', () => {
  beforeEach(() => {
    clearLocale();
  });

  it('routes to ChooseLanguage on fresh install (no locale.chosen_at)', () => {
    const r = computeInitialRoute(baseState(), null);
    expect(r).toEqual({ stack: 'OnboardingStack', screen: 'ChooseLanguage' });
  });

  it('routes to ForceUpgrade if hard-blocked regardless of locale gate', () => {
    const r = computeInitialRoute(baseState({ forceUpgradeBlocked: true }), null);
    expect(r.stack).toBe('ForceUpgrade');
  });

  it('routes to Signup once locale.chosen_at is set and JWT is missing', () => {
    localeMmkv.set(LOCALE_KEYS.CODE, 'en');
    localeMmkv.set(LOCALE_KEYS.CHOSEN_AT, new Date().toISOString());
    const r = computeInitialRoute(baseState(), null);
    expect(r).toEqual({ stack: 'OnboardingStack', screen: 'Signup' });
  });
});
