// Initial-route gate-decision tree. Pure function over AppState — no MMKV
// reads, no side-effects. Consumed once at App.tsx mount (after hydrate())
// to pick the navigator's initialRouteName.
//
// Decision order, top to bottom (RESEARCH § "Initial route gate-decision tree"):
//   1. forceUpgradeBlocked        → ForceUpgrade (hardBlock)
//   2. JWT missing                → OnboardingStack/Splash
//   3. perms missing or partial   → OnboardingStack/Permissions
//   4. compatPassed missing OR
//      stale (signature mismatch  → OnboardingStack/Compat   (AUTH-11)
//      against currentCompatSignature)
//   5. tutorialDone false         → OnboardingStack/RigTutorial
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

export type InitialRoute =
  | { stack: 'ForceUpgrade'; params: { hardBlock: true } }
  | { stack: 'OnboardingStack'; screen: 'Splash' }
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

  // 2. Sign-up gate.
  if (!s.jwt) {
    return { stack: 'OnboardingStack', screen: 'Splash' };
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

  // 5. Tutorial gate (per-Google-sub, but persistence-side; the bool is
  //    enough at this layer).
  if (!s.tutorialDone) {
    return { stack: 'OnboardingStack', screen: 'RigTutorial' };
  }

  // 6. All green.
  return { stack: 'MainTabs' };
}
