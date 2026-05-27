---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 22
id: 02-22-android-manifest-ci-finalize
name: Android manifest CI gate finalization (PERM-04 static check + Crashlytics + RootStack route registry audit)
type: execute
wave: 5
depends_on:
  [
    02-10-permissions-screen-and-manifest,
    02-14-compat-device-caps-and-permissions,
    02-20-force-upgrade-and-soft-banner,
  ]
files_modified:
  - apps/mobile/scripts/verify-merged-manifests.sh
  - apps/mobile/__tests__/manifests/permissions.test.ts
  - apps/mobile/__tests__/navigation/route-registry.test.ts
  - apps/mobile/__tests__/ui/no-hex-literals.test.ts
  - .github/workflows/mobile-ci.yml
autonomous: true
requirements: [PERM-04]
must_haves:
  truths:
    - 'verify-merged-manifests.sh asserts every Phase 2 PERM-04 declaration after Gradle merge: CAMERA, RECORD_AUDIO, ACCESS_COARSE_LOCATION (PERM-03 manifest-only), FOREGROUND_SERVICE, FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC, WAKE_LOCK, ACCESS_NETWORK_STATE — exits 1 on any missing'
    - 'Static-source vitest test `permissions.test.ts` runs the same grep gate against the unmerged source manifest so CI fails fast (under 30 s) without waiting for a Gradle merge step'
    - 'RootStack route registry test asserts every screen registered by plans 02-05 / 02-08 / 02-09 / 02-10 / 02-11 / 02-15 / 02-16 / 02-17 / 02-18 / 02-19 / 02-20 is present in apps/mobile/src/navigation/RootNativeStack.tsx (Splash, Signup, Permissions, CompatRunning, CompatPass, CompatFail, CompatRecovery, RigTutorial, MainTabs, Profile, HelpCenter, LogoutModal, DeleteAccountModal, ForceUpgrade)'
    - 'Phase-wide token-discipline gate (`__tests__/ui/no-hex-literals.test.ts`) asserts ZERO hex-color literals in apps/mobile/src/screens/ and apps/mobile/src/components/ — mirrors the 02-02 primitives gate at the phase level (D-UI-01 / D-UI-02). The 8 UI primitives (apps/mobile/src/ui/primitives/) and the token module (apps/mobile/src/ui/tokens.ts) are intentionally excluded from this scan because they are the canonical source of color values.'
    - 'GitHub Actions workflow `.github/workflows/mobile-ci.yml` runs the static permission test + the route-registry test + the no-hex-literals gate on every PR (the merged-manifest verification is added to the existing apkRollout build job)'
    - 'Crashlytics auto-collection is enabled at runtime for apkRollout build (already shipped in plan 02-04 telemetry-ring); this plan adds a static check that `firebaseCrashlyticsCollectionEnabled` meta-data is true (or absent, which defaults true) in the merged manifest'
  artifacts:
    - path: 'apps/mobile/scripts/verify-merged-manifests.sh'
      provides: 'CI-gate script for merged manifest invariants (PERM-03/04 + REQUEST_INSTALL_PACKAGES per-flavor)'
      contains: 'FOREGROUND_SERVICE_CAMERA'
    - path: 'apps/mobile/__tests__/manifests/permissions.test.ts'
      provides: 'Static source-manifest grep tests (no Gradle dependency)'
      contains: 'FOREGROUND_SERVICE_CAMERA'
    - path: 'apps/mobile/__tests__/navigation/route-registry.test.ts'
      provides: 'RootNativeStack route-registry invariant'
      contains: 'RootNativeStack'
    - path: 'apps/mobile/__tests__/ui/no-hex-literals.test.ts'
      provides: 'Phase-wide D-UI-01 / D-UI-02 hex-literal gate (mirrors 02-02 primitives gate at the phase level)'
      contains: 'no-hex-literals'
  key_links:
    - from: '.github/workflows/mobile-ci.yml'
      to: 'apps/mobile/scripts/verify-merged-manifests.sh'
      via: 'bash apps/mobile/scripts/verify-merged-manifests.sh'
      pattern: 'verify-merged-manifests.sh'
---

<objective>
Lock the Phase 2 Android manifest invariants and the RootStack route registry as CI-enforced gates before phase completion. PERM-04 is the only Phase-2 requirement explicitly satisfied here, but the work also closes the structural invariants for HOME-07 (3-tab MainTabs already covered in 02-16) and the locked navigator graph (D-NAV-02). Three deliverables: (1) extend verify-merged-manifests.sh with all Phase 2 permission assertions, (2) author a static vitest gate that runs in <30 s on every PR without a full Gradle merge, (3) author a RootStack route-registry test asserting every Phase 2 screen is registered.

Purpose: Closes PERM-04 with CI proof, not just code review. Adds a defense-in-depth fast gate (vitest grep) on top of the slower but more accurate merged-manifest gate (Gradle output). RootStack route-registry test prevents a future plan from accidentally orphaning a screen (e.g. "I added DeleteAccountModal but forgot to register it" — which would fail at runtime, not compile).
Output: a green Phase 2 CI build with all three gates wired.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/android/app/src/main/AndroidManifest.xml
@apps/mobile/android/app/src/apkRollout/AndroidManifest.xml
@apps/mobile/scripts/verify-merged-manifests.sh
@apps/mobile/src/navigation/RootNativeStack.tsx
@.github/workflows/mobile-ci.yml
@idea-brief.md

<interfaces>
<!-- idea-brief §5.3 — Permissions table requirements (PERM-01..04 + ACCESS_COARSE_LOCATION manifest-only at Phase 2; runtime prompt is Phase 4) -->
| Camera                       | runtime prompt   | android.permission.CAMERA                      |
| Microphone                   | runtime prompt   | android.permission.RECORD_AUDIO                |
| Sensors (gyro/accel)         | manifest-only    | (no permission needed; SensorManager is open)  |
| Location (coarse)            | runtime prompt    | android.permission.ACCESS_COARSE_LOCATION (Phase 4 prompt; manifest-only declaration in Phase 2) |
| Foreground service           | manifest-only    | FOREGROUND_SERVICE_CAMERA, FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_DATA_SYNC |
| Wake lock                    | manifest-only    | WAKE_LOCK                                       |
| Network state                | manifest-only    | ACCESS_NETWORK_STATE                            |

<!-- D-NAV-02 — RootNativeStack registered routes after Phase 2 -->

RootNativeStack screens:
Splash, Signup, Permissions, CompatRunning, CompatPass, CompatFail, CompatRecovery, RigTutorial, MainTabs, Profile, HelpCenter, LogoutModal, DeleteAccountModal, ForceUpgrade
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                      | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| CI runner → repo grep         | trusted; runs sandboxed                                    |
| Gradle merged-manifest output | derived deterministically from per-flavor source manifests |

## STRIDE Threat Register

| Threat ID | Category  | Component                                                                                                                                             | Disposition | Mitigation Plan                                                                                                                                                                                              |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-2.22-01 | Tampering | A future plan removes a Phase 2 permission from AndroidManifest.xml (e.g. accidentally drops FOREGROUND_SERVICE_CAMERA, breaking Phase 3 capture)     | mitigate    | This plan asserts each one explicitly. CI fails on the missing line; reviewer sees the regression.                                                                                                           |
| T-2.22-02 | Tampering | An accidental orphan screen is added to RootNativeStack but never used, OR a screen is referenced via navigate() but never registered — runtime crash | mitigate    | Route-registry test enumerates the expected screen names. Future plans that add a real screen update the test in the same PR; future plans that drop a screen fail until the registry is updated explicitly. |
| T-2.22-03 | Spoofing  | Crashlytics opt-out via injected meta-data on a tampered build                                                                                        | accept      | Build flavor + signing key gate this; out of scope for Phase 2 manifest-level gates. Phase 8 staged rollout enforces signed Play Store builds.                                                               |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Static manifest permissions test (vitest grep gate)</name>
  <files>apps/mobile/__tests__/manifests/permissions.test.ts</files>
  <read_first>
    - apps/mobile/android/app/src/main/AndroidManifest.xml (current — verify the 7 manifest-only permissions are present from plans 02-10 / 02-14)
    - apps/mobile/android/app/src/apkRollout/AndroidManifest.xml (REQUEST_INSTALL_PACKAGES — verified in 02-20)
    - REQUIREMENTS.md PERM-04 verbatim
    - idea-brief.md §5.3 (Permissions table)
  </read_first>
  <action>
    Author `apps/mobile/__tests__/manifests/permissions.test.ts`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync } from 'node:fs';
    import { resolve, dirname } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ROOT = resolve(__dirname, '../../');

    function strip(file: string): string {
      return readFileSync(file, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');
    }

    /** PERM-04 requires manifest-only declarations for sensors, foreground service, wake lock, network state. */
    const REQUIRED_BASE_PERMISSIONS = [
      'android.permission.CAMERA',                          // PERM-01 runtime prompt + manifest declaration
      'android.permission.RECORD_AUDIO',                    // PERM-02
      'android.permission.ACCESS_COARSE_LOCATION',          // PERM-03 (manifest-only at Phase 2; runtime in Phase 4)
      'android.permission.FOREGROUND_SERVICE',              // PERM-04
      'android.permission.FOREGROUND_SERVICE_CAMERA',       // PERM-04 (Phase 3 capture FGS type)
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',   // PERM-04
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',    // PERM-04 (Phase 5 upload FGS type)
      'android.permission.WAKE_LOCK',                       // PERM-04
      'android.permission.ACCESS_NETWORK_STATE',            // PERM-04
    ];

    describe('PERM-04 — main AndroidManifest.xml declarations', () => {
      const main = strip(resolve(ROOT, 'android/app/src/main/AndroidManifest.xml'));
      for (const perm of REQUIRED_BASE_PERMISSIONS) {
        it(`declares ${perm}`, () => {
          expect(main).toMatch(new RegExp(`android:name="${perm.replace(/\./g, '\\.')}"`));
        });
      }
    });

    describe('apkRollout-only flavor manifest', () => {
      const apkRollout = strip(resolve(ROOT, 'android/app/src/apkRollout/AndroidManifest.xml'));
      const main = strip(resolve(ROOT, 'android/app/src/main/AndroidManifest.xml'));

      it('apkRollout declares REQUEST_INSTALL_PACKAGES (UPG-03)', () => {
        expect(apkRollout).toMatch(/android.permission.REQUEST_INSTALL_PACKAGES/);
      });

      it('main does NOT declare REQUEST_INSTALL_PACKAGES (Play policy)', () => {
        expect(main).not.toMatch(/REQUEST_INSTALL_PACKAGES/);
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- manifests/permissions --run` — must pass.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/__tests__/manifests/permissions.test.ts` succeeds.
    - `grep -c "android.permission" apps/mobile/__tests__/manifests/permissions.test.ts` returns >= 9 (count of REQUIRED_BASE_PERMISSIONS entries).
    - `grep -q "FOREGROUND_SERVICE_DATA_SYNC" apps/mobile/__tests__/manifests/permissions.test.ts` succeeds.
    - `grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/__tests__/manifests/permissions.test.ts` succeeds.
    - `cd apps/mobile && npm run test -- manifests/permissions --run` exits 0; ≥ 11 tests pass (9 base perms + 2 flavor cases).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- manifests/permissions --run</automated>
  </verify>
  <done>Static permission gate runs in <5 s on every PR; PERM-04 codified as a test, not a code-review checklist item.</done>
</task>

<task type="auto">
  <name>Task 2: RootStack route-registry test</name>
  <files>apps/mobile/__tests__/navigation/route-registry.test.ts</files>
  <read_first>
    - apps/mobile/src/navigation/RootNativeStack.tsx (current — should have all 14 Phase 2 screens registered after plans 02-05/08/09/10/11/15/16/17/18/19/20 land)
    - apps/mobile/src/navigation/MainTabs.tsx (already structurally tested in 02-16; this test focuses on RootStack)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-NAV-02 (navigator graph)
  </read_first>
  <action>
    Author `apps/mobile/__tests__/navigation/route-registry.test.ts`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync } from 'node:fs';
    import { resolve, dirname } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const SOURCE = readFileSync(
      resolve(__dirname, '../../src/navigation/RootNativeStack.tsx'),
      'utf-8',
    );

    /**
     * D-NAV-02 — every screen consumed by Phase 2 navigation paths must be registered in
     * RootNativeStack.tsx. Adding a Phase 4/6 screen (e.g. Recording, Player) MUST update
     * this list explicitly so the gate stays meaningful.
     */
    const REQUIRED_PHASE_2_ROUTES = [
      'Splash',
      'Signup',
      'Permissions',
      'CompatRunning',
      'CompatPass',
      'CompatFail',
      'CompatRecovery',
      'RigTutorial',
      'MainTabs',
      'Profile',
      'HelpCenter',
      'LogoutModal',
      'DeleteAccountModal',
      'ForceUpgrade',
    ];

    describe('RootNativeStack route registry — Phase 2 screens', () => {
      // Strip line comments before matching to avoid false positives.
      const code = SOURCE.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

      for (const name of REQUIRED_PHASE_2_ROUTES) {
        it(`registers screen name="${name}"`, () => {
          expect(code).toMatch(new RegExp(`name=["']${name}["']`));
        });
      }

      it('does not register any unrecognized Phase-3+ routes (early-warning check)', () => {
        // Phase 4 will add Recording; Phase 6 will add Player. Until those plans land, asserting
        // they are absent prevents an accidental early commit. When Phase 4 lands, this list
        // moves into REQUIRED_PHASE_2_ROUTES (or the corresponding new test file).
        const phase3Plus = ['Recording', 'Player'];
        for (const route of phase3Plus) {
          expect(code).not.toMatch(new RegExp(`name=["']${route}["']`));
        }
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- route-registry --run` — must pass.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/__tests__/navigation/route-registry.test.ts` succeeds.
    - `grep -c "REQUIRED_PHASE_2_ROUTES" apps/mobile/__tests__/navigation/route-registry.test.ts` returns >= 1.
    - `grep -c "'Splash'\|'Signup'\|'Permissions'\|'CompatRunning'\|'CompatPass'\|'CompatFail'\|'CompatRecovery'\|'RigTutorial'\|'MainTabs'\|'Profile'\|'HelpCenter'\|'LogoutModal'\|'DeleteAccountModal'\|'ForceUpgrade'" apps/mobile/__tests__/navigation/route-registry.test.ts` returns >= 14.
    - `cd apps/mobile && npm run test -- route-registry --run` exits 0; ≥ 15 tests pass (14 routes + 1 phase-3+ guard).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- route-registry --run</automated>
  </verify>
  <done>Route-registry gate prevents orphan screens / missing registrations; Phase-3+ guard reminds the next planner to update the registry list when adding Recording/Player.</done>
</task>

<task type="auto">
  <name>Task 3: Extend verify-merged-manifests.sh + wire into mobile-ci workflow</name>
  <files>apps/mobile/scripts/verify-merged-manifests.sh, .github/workflows/mobile-ci.yml</files>
  <read_first>
    - apps/mobile/scripts/verify-merged-manifests.sh (Phase 1 / plan 02-20 output — extend, don't rewrite)
    - .github/workflows/mobile-ci.yml (Phase 1 plan 01-12 output — add a `Verify merged manifests` step into the existing Mobile build job)
  </read_first>
  <action>
    Step 1 — extend `apps/mobile/scripts/verify-merged-manifests.sh` to include Phase 2 PERM-04 + PERM-03 assertions on the merged manifest. Append (or weave into existing assertions) a block that for each flavor (apkRollout + playStore):

    1. Locates the merged manifest at `apps/mobile/android/app/build/intermediates/merged_manifests/${flavor}Debug/AndroidManifest.xml` (Gradle output path).
    2. Asserts each of the 7 PERM-04 manifest-only permissions is present:
       - `FOREGROUND_SERVICE`
       - `FOREGROUND_SERVICE_CAMERA`
       - `FOREGROUND_SERVICE_MICROPHONE`
       - `FOREGROUND_SERVICE_DATA_SYNC`
       - `WAKE_LOCK`
       - `ACCESS_NETWORK_STATE`
       - `ACCESS_COARSE_LOCATION`
    3. Asserts CAMERA + RECORD_AUDIO are present (PERM-01 / PERM-02 manifest declaration).
    4. Re-asserts the per-flavor REQUEST_INSTALL_PACKAGES invariants from 02-20 (apkRollout has it; playStore does NOT).

    The script `exit 1`s on any missing/unexpected line, with a clear `echo` of which permission failed which flavor.

    Step 2 — extend `.github/workflows/mobile-ci.yml`:
    - In the existing apkRollout build job that runs `./gradlew assembleApkRolloutDebug`, ADD a step AFTER assemble:
      ```yaml
      - name: Verify merged manifests
        working-directory: apps/mobile
        run: bash scripts/verify-merged-manifests.sh
      ```
    - Also add a duplicate Gradle step `./gradlew :app:processPlayStoreDebugManifest` so the script can also inspect the playStore merged manifest in the same workflow run.

    Step 3 — sanity check the script runs locally on a freshly assembled APK:
    ```
    cd apps/mobile/android && ./gradlew :app:processApkRolloutDebugManifest :app:processPlayStoreDebugManifest && cd .. && bash scripts/verify-merged-manifests.sh
    ```
    Must exit 0.

  </action>
  <acceptance_criteria>
    - `grep -c "FOREGROUND_SERVICE_CAMERA\|FOREGROUND_SERVICE_DATA_SYNC\|FOREGROUND_SERVICE_MICROPHONE" apps/mobile/scripts/verify-merged-manifests.sh` returns >= 3.
    - `grep -q "ACCESS_COARSE_LOCATION" apps/mobile/scripts/verify-merged-manifests.sh` succeeds.
    - `grep -q "REQUEST_INSTALL_PACKAGES" apps/mobile/scripts/verify-merged-manifests.sh` succeeds (carry-forward from 02-20 also OK).
    - `grep -q "Verify merged manifests" .github/workflows/mobile-ci.yml` succeeds.
    - `grep -q "processPlayStoreDebugManifest" .github/workflows/mobile-ci.yml` succeeds.
    - Manual: locally `cd apps/mobile/android && ./gradlew :app:processApkRolloutDebugManifest :app:processPlayStoreDebugManifest && cd .. && bash scripts/verify-merged-manifests.sh` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>grep -c "FOREGROUND_SERVICE_CAMERA\|FOREGROUND_SERVICE_DATA_SYNC\|FOREGROUND_SERVICE_MICROPHONE" apps/mobile/scripts/verify-merged-manifests.sh | grep -q '^[3-9]\|^[1-9][0-9]'</automated>
  </verify>
  <done>Merged-manifest CI gate covers every Phase 2 permission invariant; CI workflow runs both the static (vitest) and dynamic (Gradle merged) gates on every PR.</done>
</task>

<task type="auto">
  <name>Task 4: Phase-wide token-discipline gate (no hex literals in screens / components)</name>
  <files>apps/mobile/__tests__/ui/no-hex-literals.test.ts, .github/workflows/mobile-ci.yml</files>
  <read_first>
    - apps/mobile/src/ui/tokens.ts (THE canonical source of color values — intentionally excluded from the gate)
    - apps/mobile/__tests__/ui/primitives.test.tsx (analog: how 02-02 enforces the primitives-only token gate; this task lifts the same idea phase-wide)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UI-01 + D-UI-02 (token discipline + locked design)
    - apps/mobile/src/screens/ (current — every Phase 2 screen must already be token-bound after the 02-15..20 revisions)
    - apps/mobile/src/components/ (current — every Phase 2 component must already be token-bound)
  </read_first>
  <action>
    Author `apps/mobile/__tests__/ui/no-hex-literals.test.ts`. The test enumerates every `.tsx` / `.ts` file under `apps/mobile/src/screens/` and `apps/mobile/src/components/`, strips line + block comments, and asserts the result contains ZERO hex-color literals (`'#RGB'`, `'#RRGGBB'`, or 4/8-digit shorthand).

    Exclusions:
    - `apps/mobile/src/ui/primitives/*.tsx` — the 8 primitives are excluded because they are the boundary that consumes tokens; the 02-02 gate already enforces token-binding there.
    - `apps/mobile/src/ui/tokens.ts` — THE canonical source of color values.
    - Files matching `*.test.tsx` / `*.test.ts` — tests are allowed to assert specific hex values (e.g., asserting `colors.coral` equals its known hex token value in primitives.test.tsx).

    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync, readdirSync, statSync } from 'node:fs';
    import { resolve, dirname, join } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ROOT = resolve(__dirname, '../../');

    /** Recursively list .tsx and .ts files under a directory; excludes test files. */
    function listSourceFiles(dir: string): string[] {
      const out: string[] = [];
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return out;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          out.push(...listSourceFiles(full));
        } else if (
          (full.endsWith('.tsx') || full.endsWith('.ts')) &&
          !full.endsWith('.test.tsx') &&
          !full.endsWith('.test.ts')
        ) {
          out.push(full);
        }
      }
      return out;
    }

    /** Strip // line comments and /* block comments before grep so doc-comments
     *  illustrating tokens (e.g., '#FAF7F2 → colors.bg') don't trigger the gate. */
    function stripComments(src: string): string {
      return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
    }

    const SCREENS_DIR = resolve(ROOT, 'src/screens');
    const COMPONENTS_DIR = resolve(ROOT, 'src/components');

    const HEX_LITERAL = /'#[0-9A-Fa-f]{3,8}'/g;

    describe('Phase 2 token discipline (D-UI-01 / D-UI-02) — no hex-color literals in screens or components', () => {
      const screenFiles = listSourceFiles(SCREENS_DIR);
      const componentFiles = listSourceFiles(COMPONENTS_DIR);

      it('finds at least one screen file (sanity check that the scan ran)', () => {
        expect(screenFiles.length).toBeGreaterThan(0);
      });

      it('finds at least one component file (sanity check that the scan ran)', () => {
        expect(componentFiles.length).toBeGreaterThan(0);
      });

      for (const file of [...screenFiles, ...componentFiles]) {
        const relative = file.slice(ROOT.length + 1);
        it(`${relative} contains no hex-color literals`, () => {
          const stripped = stripComments(readFileSync(file, 'utf-8'));
          const matches = stripped.match(HEX_LITERAL) ?? [];
          // If matches are found, fail with a clear message naming the offending literals.
          expect(matches, `Hex literal(s) found in ${relative}: ${matches.join(', ')}. Use colors.* tokens from apps/mobile/src/ui/tokens.ts instead.`).toEqual([]);
        });
      }
    });
    ```

    Sanity-check the gate locally:
    ```
    cd apps/mobile && npm run test -- no-hex-literals --run
    ```
    Must exit 0 (every Phase 2 screen + component is already token-bound after the 02-15..20 revisions).

    Then extend `.github/workflows/mobile-ci.yml` to add the new test to the existing vitest job (it should already run via `npm run test`, but verify the wildcard matches the new path). If the workflow runs `npm run test -- --run` without a glob, no edit is needed; if it runs a specific subset, add the new path.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/__tests__/ui/no-hex-literals.test.ts` succeeds.
    - `grep -q "HEX_LITERAL" apps/mobile/__tests__/ui/no-hex-literals.test.ts` succeeds.
    - `grep -q "src/screens" apps/mobile/__tests__/ui/no-hex-literals.test.ts` succeeds (gate scope correct).
    - `grep -q "src/components" apps/mobile/__tests__/ui/no-hex-literals.test.ts` succeeds.
    - `cd apps/mobile && npm run test -- no-hex-literals --run` exits 0 — i.e. every Phase 2 screen + component is already token-bound.
    - `grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/ apps/mobile/src/components/ -r` returns 0 matches at phase-completion time (defense-in-depth check the gate enforces).
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- no-hex-literals --run</automated>
  </verify>
  <done>Phase-wide hex-literal gate ships; every Phase 2 screen + component is token-bound; D-UI-01 / D-UI-02 is now enforceable on every PR (any future regression fails CI loudly).</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(manifests|route-registry|no-hex-literals)" --run` — all green (≥ 26 tests + the per-file no-hex-literals matrix).
- `cd apps/mobile/android && ./gradlew :app:processApkRolloutDebugManifest :app:processPlayStoreDebugManifest` — both succeed.
- `bash apps/mobile/scripts/verify-merged-manifests.sh` exits 0 (after the Gradle merge step above).
- `grep -rnE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/ apps/mobile/src/components/` returns no matches (token-discipline gate green).
</verification>

<success_criteria>

- PERM-04 codified as static + dynamic CI gates (the only Phase 2 requirement explicitly closed by this plan).
- RootStack route registry asserts every Phase 2 screen present; phase-3+ early-warning guard for Recording/Player.
- D-UI-01 / D-UI-02 token discipline codified as a phase-wide CI gate (no hex literals in screens / components).
- Mobile CI workflow wires all three gates to run on every PR — Phase 2 cannot regress structurally OR visually.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-22-SUMMARY.md` per templates/summary.md. This is the last plan of Phase 2; the SUMMARY should include a Phase 2 retrospective bullet list.
</output>
