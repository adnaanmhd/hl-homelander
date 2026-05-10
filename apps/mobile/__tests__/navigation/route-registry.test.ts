// D-NAV-02 — RootStack + OnboardingStack route registry invariant.
//
// Plan 02-22 wave 5. Asserts every Phase 2 navigation surface is registered
// in the canonical pair of navigator files (D-NAV-02):
//   - apps/mobile/src/navigation/RootNativeStack.tsx (top-level siblings:
//     OnboardingStack, MainTabs, Profile, HelpCenter, ForceUpgrade,
//     LogoutModal, DeleteAccountModal)
//   - apps/mobile/src/navigation/OnboardingStack.tsx (pre-MainTabs flow:
//     Splash, Signup, Permissions, Compat, CompatPass, CompatFail,
//     RigTutorial)
//
// Plan 03-03 update: CompatRecovery removed. CompatRecoveryScreen.tsx +
// its test file deleted; the recovery body merged into CompatFailScreen
// (02-COSMETIC-GAPS.md § Compat-fail screen). Pre-merge the registry
// listed CompatRecovery; post-merge it does NOT.
//
// Why scan BOTH files: the plan body's task description listed every Phase 2
// route under RootNativeStack, but Splash/Signup/Permissions/Compat-* /
// RigTutorial are nested inside OnboardingStack as a child stack of Root
// (per plan 02-05's navigation skeleton). The structural-source-of-truth
// invariant the gate enforces — "every Phase 2 screen the navigator graph
// reaches must be registered SOMEWHERE in the locked navigator pair" —
// is preserved by reading the union of both files. Future plans that add a
// route MUST update the corresponding navigator AND this test list.
//
// Why the registered name is "Compat" not "CompatRunning": the screen module
// is CompatRunningScreen, but OnboardingStack registers it as
//   <Stack.Screen name="Compat" component={CompatRunningScreen} />
// per plan 02-05. Calling code (PermissionsScreen, CompatPassScreen, etc.)
// navigates to "Compat", so that string is the navigator's source of truth.
//
// T-2.22-02 mitigation: prevents an accidental orphan screen (referenced in
// navigate() but never registered, which would crash at runtime, not
// compile time).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read a navigator source file and strip line comments before grep so a
 *  doc-comment naming a route can't false-match the registry assertion. */
function readNavigator(relPath: string): string {
  const full = resolve(__dirname, '../../', relPath);
  const raw = readFileSync(full, 'utf-8');
  return raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const ROOT_STACK = readNavigator('src/navigation/RootNativeStack.tsx');
const ONBOARDING_STACK = readNavigator('src/navigation/OnboardingStack.tsx');
const ALL_NAVIGATOR_SOURCE = `${ROOT_STACK}\n${ONBOARDING_STACK}`;

/**
 * Phase 2 — every route registered across RootNativeStack + OnboardingStack
 * after plans 02-05 / 02-08 / 02-09 / 02-10 / 02-11 / 02-15 / 02-16 / 02-17 /
 * 02-18 / 02-19 / 02-20, with the Plan 03-03 CompatRecovery removal applied.
 *
 * NB: the registered name is "Compat" (not "CompatRunning") — see file
 * header for rationale. The screen MODULE is CompatRunningScreen; the
 * navigator route NAME is Compat.
 *
 * "OnboardingStack" itself is an entry inside RootNativeStack (it's the
 * parent of Splash/Signup/Permissions/Compat-{Pass,Fail}/RigTutorial). Both
 * the parent registration AND each child registration must be present.
 *
 * Plan 03-03: CompatRecovery removed from the locked-routes list. The
 * recovery body merged into CompatFailScreen; the standalone screen + its
 * test file are deleted. A post-merge regression that re-introduces the
 * route should fail this gate.
 */
const REQUIRED_PHASE_2_ROUTES = [
  // RootNativeStack siblings
  'OnboardingStack',
  'MainTabs',
  'Profile',
  'HelpCenter',
  'ForceUpgrade',
  'LogoutModal',
  'DeleteAccountModal',
  // OnboardingStack children (post Plan 03-03 CompatRecovery merge)
  'Splash',
  'Signup',
  'Permissions',
  'Compat',
  'CompatPass',
  'CompatFail',
  'RigTutorial',
];

/**
 * Phase 2 routes that were REMOVED by later plans. The invariant test asserts
 * each removed name is NOT registered anywhere in the navigator pair so an
 * accidental re-introduction surfaces in PR review.
 */
const REMOVED_PHASE_2_ROUTES = [
  // Plan 03-03 — CompatRecovery merged into CompatFail (02-COSMETIC-GAPS.md
  // § Compat-fail screen). Standalone screen + test file deleted.
  'CompatRecovery',
];

describe('Navigator route registry — Phase 2 screens (D-NAV-02)', () => {
  for (const name of REQUIRED_PHASE_2_ROUTES) {
    it(`registers screen name="${name}"`, () => {
      // Look for either name="X" or name='X' in either navigator file.
      expect(ALL_NAVIGATOR_SOURCE).toMatch(new RegExp(`name=["']${name}["']`));
    });
  }

  for (const name of REMOVED_PHASE_2_ROUTES) {
    it(`does NOT re-register removed route name="${name}" (Plan 03-03 CompatRecovery merge)`, () => {
      expect(ALL_NAVIGATOR_SOURCE).not.toMatch(new RegExp(`name=["']${name}["']`));
    });
  }

  it('does not register any unrecognized Phase-3+ routes (early-warning check)', () => {
    // Phase 4 will add Recording; Phase 6 will add Player. Until those plans
    // land, asserting they are absent prevents an accidental early commit.
    // When Phase 4 lands, the corresponding name moves into
    // REQUIRED_PHASE_2_ROUTES (or a new test file).
    const phase3Plus = ['Recording', 'Player'];
    for (const route of phase3Plus) {
      expect(ALL_NAVIGATOR_SOURCE).not.toMatch(new RegExp(`name=["']${route}["']`));
    }
  });
});
