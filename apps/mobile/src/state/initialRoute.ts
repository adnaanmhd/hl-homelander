// Initial-route gate-decision tree. Reads the per-account practice-tutorial
// flag from MMKV (ONB-08); otherwise pure over AppState — no other
// side-effects. Consumed once at App.tsx mount (after hydrate()) to pick the
// navigator's initialRouteName.
//
// Decision order, top to bottom (RESEARCH § "Initial route gate-decision tree"):
//   1. forceUpgradeBlocked        → ForceUpgrade (hardBlock)
//   2. JWT missing                → OnboardingStack/Signup
//   3. perms missing or partial   → OnboardingStack/Permissions
//   4. compatPassed missing OR
//      stale (signature mismatch  → OnboardingStack/Compat   (AUTH-11)
//      against currentCompatSignature)
//   5. per-account practice flag  → OnboardingStack/RigTutorial   (ONB-08, D-NAV-04)
//      missing for the JWT's sub
//   6. all green                  → MainTabs
//
// AUTH-11 satisfaction: a fresh install on a new device mints a new
// installation_id, which feeds into the freshly-computed
// currentCompatSignature (sha256(versionCode|fingerprint|installation_id)).
// The persisted compatPassed.signature was computed on the previous device
// and won't match → the user is routed to Compat for a re-run, with no
// backend round-trip. D-STATE-04 + D-COMPAT-03.
//
// Offline-boot caveat: if currentCompatSignature is null (the caller
// couldn't compute it — e.g. compatService crashed on init), we DO NOT
// invalidate the stored compatPassed. Forcing a Compat re-run on every
// transient init failure would be far worse UX than trusting the last
// known-good signature for that boot.

import type { AppState } from './appStore';
import { secureMmkv } from './mmkv';
import { practiceDoneKey } from './keys';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';
import { localeMmkv, LOCALE_KEYS } from '../i18n/storage';

export type InitialRoute =
  | { stack: 'ForceUpgrade'; params: { hardBlock: true } }
  // Phase 7 plan 07-04 — D-22 first-launch language picker. Slots in BEFORE
  // the JWT gate so a fresh-install user picks a locale once, then the gate
  // is transparent until delete-account / fresh install wipes MMKV.
  | { stack: 'OnboardingStack'; screen: 'ChooseLanguage' }
  | { stack: 'OnboardingStack'; screen: 'Signup' }
  | { stack: 'OnboardingStack'; screen: 'Permissions' }
  | { stack: 'OnboardingStack'; screen: 'Compat' }
  | { stack: 'OnboardingStack'; screen: 'RigTutorial' }
  | { stack: 'MainTabs' };

export function computeInitialRoute(
  s: AppState,
  currentCompatSignature: string | null,
): InitialRoute {
  // 1. Hard block first — overrides every other gate.
  if (s.forceUpgradeBlocked) {
    return { stack: 'ForceUpgrade', params: { hardBlock: true } };
  }

  // 1.5 Phase 7 plan 07-04 — first-launch language pick (D-22). Gates ALL
  //     non-force-upgrade routing on locale being chosen. Cleared by
  //     delete-account flow (DeleteAccountModal) and by fresh install
  //     since localeMmkv is wiped on uninstall/reinstall.
  //
  //     The gate is a best-effort MMKV read; on read failure we fall through
  //     to treating the locale as already chosen (the localeBootstrap default
  //     is 'en', so the user lands in English without re-prompting).
  try {
    if (!localeMmkv.contains(LOCALE_KEYS.CHOSEN_AT)) {
      return { stack: 'OnboardingStack', screen: 'ChooseLanguage' };
    }
  } catch {
    // MMKV best-effort — treat as already chosen on read failure.
  }

  // 2. Sign-up gate. Splash is the launch screen but never a destination —
  //    when JWT is missing we route to Signup so Splash → replace('Signup')
  //    actually leaves the splash screen instead of looping back to itself.
  if (!s.jwt) {
    return { stack: 'OnboardingStack', screen: 'Signup' };
  }

  // 3. Permissions gate — both grants must be true.
  if (!s.permsGranted || !s.permsGranted.camera || !s.permsGranted.mic) {
    return { stack: 'OnboardingStack', screen: 'Permissions' };
  }

  // 4. Compat gate — missing run OR (signature stale, when we have a fresh
  //    one to compare against). AUTH-11: same Google account, new device →
  //    fresh installation_id → fresh signature → mismatch → re-run.
  if (
    !s.compatPassed ||
    (currentCompatSignature !== null && s.compatPassed.signature !== currentCompatSignature)
  ) {
    return { stack: 'OnboardingStack', screen: 'Compat' };
  }

  // 5. Practice-tutorial gate (ONB-08, D-NAV-04) — per Google account, keyed
  //    by the JWT's `sub` claim. The legacy s.tutorialDone bool flips when the
  //    user reaches RigTutorial (set in RigTutorialScreen.handleNext), but the
  //    CANONICAL gate is the per-account MMKV flag written by
  //    PracticeCompleteScreen.Continue (plan 04-06): a user must complete the
  //    60-s practice before reaching MainTabs. Reinstall wipes MMKV → re-run.
  //    Decode-without-verify is fine here — the JWT was already verified at
  //    sign-in and `sub` is only a local cache key (never an authz decision).
  const sub = decodeGoogleSubFromJwt(s.jwt);
  const practiceDone = secureMmkv.getBoolean(practiceDoneKey(sub)) ?? false;
  if (!practiceDone) {
    return { stack: 'OnboardingStack', screen: 'RigTutorial' };
  }

  // 6. All green.
  return { stack: 'MainTabs' };
}
