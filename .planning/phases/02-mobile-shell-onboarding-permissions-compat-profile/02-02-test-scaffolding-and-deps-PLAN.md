---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 02
id: 02-02-test-scaffolding-and-deps
name: Test scaffolding, dependency install, design tokens, primitives, fonts
type: execute
wave: 0
depends_on: [02-01-mobile-npm-migration]
files_modified:
  - apps/mobile/package.json
  - apps/mobile/vitest.setup.ts
  - apps/mobile/react-native.config.js
  - apps/mobile/assets/fonts/.gitkeep
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/test/resources/hevc-fixtures/.gitkeep
  - apps/mobile/src/ui/tokens.ts
  - apps/mobile/src/ui/primitives/Text.tsx
  - apps/mobile/src/ui/primitives/Button.tsx
  - apps/mobile/src/ui/primitives/Pressable.tsx
  - apps/mobile/src/ui/primitives/ScreenContainer.tsx
  - apps/mobile/src/ui/primitives/Sheet.tsx
  - apps/mobile/src/ui/primitives/Modal.tsx
  - apps/mobile/src/ui/primitives/Field.tsx
  - apps/mobile/src/ui/primitives/Icon.tsx
  - apps/mobile/__tests__/ui/primitives.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - 'All Phase 2 RN-ecosystem deps are installed and pinned (no caret on locked versions)'
    - 'Design tokens exported from a single typed-constant module verbatim from engineering-handoff §1 / design-spec §0'
    - 'Eight UI primitives exist and import tokens (no hex literals)'
    - 'Fonts are linked via react-native-asset and registered in Android assets/fonts'
    - 'Robolectric testImplementation block lets `./gradlew :app:testApkRolloutDebugUnitTest` run'
    - 'vitest.setup.ts mocks @react-navigation/native, react-native-screens, react-native-mmkv, react-native-reanimated'
    - 'HEVC fixture directory exists for plan 02-12 NAL parser tests'
  artifacts:
    - path: 'apps/mobile/src/ui/tokens.ts'
      provides: 'colors, typography, spacing, radii, motion typed constants'
      contains: 'export const colors'
    - path: 'apps/mobile/src/ui/primitives/Button.tsx'
      provides: 'btn-primary / btn-accent / btn-outline / btn-coral variants'
      contains: 'tokens.colors'
    - path: 'apps/mobile/react-native.config.js'
      provides: 'react-native-asset font linker config'
      contains: 'assets:'
    - path: 'apps/mobile/android/app/build.gradle'
      provides: 'Robolectric testImplementation block + testOptions includeAndroidResources'
      contains: 'robolectric'
  key_links:
    - from: 'apps/mobile/src/ui/primitives/Text.tsx'
      to: 'apps/mobile/src/ui/tokens.ts'
      via: "import { colors, typography } from '../tokens'"
      pattern: "from '../tokens'"
    - from: 'apps/mobile/vitest.setup.ts'
      to: '@react-navigation/native'
      via: 'vi.mock'
      pattern: "vi.mock\\(.@react-navigation/native"
---

<objective>
Stand up the Phase 2 test infrastructure (Vitest mocks for the new RN-ecosystem deps + Robolectric for Kotlin probes), install every Phase 2 npm dep at pinned versions, wire fonts through `react-native-asset`, and ship the design-token module + 8 UI primitives that every screen plan imports.

Purpose: every subsequent plan (03..22) consumes tokens, primitives, and the test-mock setup. Wave 0 means nothing visible to the user; everything visible to other plans.
Output: a green `npm run test` (existing Phase 1 tests still pass under the expanded vitest.setup.ts) + a green `./gradlew :app:testApkRolloutDebugUnitTest` (no Kotlin tests yet, but the Robolectric block is wired so plan 02-06+ can drop tests in).

Executor MUST run the per-task `<verify>` command after every task to catch context degradation before the next task starts. This plan has 4 tasks + 16 files modified — at the warning threshold for scope; per-task green-CI gating is non-negotiable. Wave-0 work that under-tests itself silently breaks every downstream plan in the phase.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-VALIDATION.md
@.planning/research/STACK.md
@apps/mobile/vitest.setup.ts
@apps/mobile/vitest.config.ts
@apps/mobile/__tests__/SignIn.test.tsx
@apps/mobile/android/app/build.gradle
@design-spec.md
@engineering-handoff.md
@design-system

<interfaces>
<!-- Phase 1 vitest.setup.ts host-component shim that Phase 2 extends -->
<!-- (excerpt from 02-PATTERNS.md lines 615-637) -->

vi.mock('react-native', () => {
function makeComponent(name) {
return React.forwardRef(function HostComponent(props, ref) {
const { children, accessibilityLabel, accessibilityRole, onPress, ...rest } = props;
const dom = { ref, 'data-testid': name, ...rest };
if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
if (typeof onPress === 'function') dom['onClick'] = onPress;
return React.createElement('div', dom, children);
});
}
return { View: makeComponent('View'), Text: makeComponent('Text'), Pressable: makeComponent('Pressable'), /_ ... _/ };
});

<!-- Design tokens shape (engineering-handoff §1 + design-spec §0) -->

export const colors = {
bg: '#FAF7F2', surface: '#FFFFFF', text: '#1A1A1A', text2: '#6B6B6B', text3: '#9A9590',
line: '#E8E5E0', accent: '#FF6A2D', accentSoft: '#FFE6D8', coral: '#E84A38',
success: '#2EB872', amber: '#F2A53C', info: '#2D7CFF', infoSoft: '#E5EEFF',
} as const;
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                           | Description                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| local dev → npm registry           | new transitive dep tree (~12 packages); same as 02-01                              |
| Vitest test code → production code | mocks must not leak into prod bundle (handled by vitest.config.ts setupFiles only) |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                       | Disposition | Mitigation Plan                                                                                                                       |
| --------- | ---------------------- | --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.2-01  | Tampering              | npm postinstall scripts (react-native, reanimated)              | accept      | required by RN ecosystem; package-lock.json integrity hashes pinned in 02-01                                                          |
| T-2.2-02  | Tampering              | mock seam in vitest.setup.ts replaces production module imports | mitigate    | vitest config `test.setupFiles` lists vitest.setup.ts ONLY for the test environment; bundler config (Metro) does not load setup files |
| T-2.2-03  | Information Disclosure | font asset files committed to repo                              | accept      | brand fonts have a font-license; design-system/ already tracks them                                                                   |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Install pinned Phase 2 dependencies</name>
  <files>apps/mobile/package.json, apps/mobile/package-lock.json</files>
  <read_first>
    - apps/mobile/package.json (post 02-01 form)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Standard Stack" + "New in Phase 2" lines 217-265 (pinned versions table)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § "Locked from upstream" (LOCKED stack pins line)
    - .planning/research/STACK.md (cross-check OEM compat notes for each new dep)
  </read_first>
  <action>
    1. From `apps/mobile/`:
       Run `npm view <pkg> version` for each dep below to confirm the registry hasn't moved past the RN 0.83 + new-arch supported version (per RESEARCH § "Version verification protocol"). Use `npm view @react-navigation/native version` etc.
    2. Install runtime deps with EXACT versions (no carets — RESEARCH lines 261-265 enforces this):
       ```
       npm install --save-exact @react-navigation/native@7.2.2 @react-navigation/native-stack@7.3.7 @react-navigation/bottom-tabs@7.3.5 react-native-screens@4.4.0 react-native-safe-area-context@5.1.0 zustand@5.0.2 lucide-react-native@1.14.0 react-native-permissions@5.2.4 react-native-haptic-feedback@2.3.3 react-native-reanimated@3.16.7 react-native-svg@15.10.1 react-native-uuid@2.0.3
       ```
       (If `npm view` reports a different "latest stable" for any package, prefer the version from the RESEARCH table; if RESEARCH says `^x.y` use the highest x.y compatible.)
    3. Install devDep:
       ```
       npm install --save-dev --save-exact react-native-asset@2.1.1
       ```
    4. Confirm `package-lock.json` is regenerated and stage/commit it.
    5. Run `npm run typecheck` to confirm new deps don't break Phase 1 typecheck (they shouldn't — none are imported yet).
  </action>
  <acceptance_criteria>
    - `node -e "const p = require('./apps/mobile/package.json'); for (const d of ['@react-navigation/native','@react-navigation/native-stack','@react-navigation/bottom-tabs','react-native-screens','react-native-safe-area-context','zustand','lucide-react-native','react-native-permissions','react-native-haptic-feedback','react-native-reanimated','react-native-svg','react-native-uuid']) { if (!p.dependencies[d]) { console.error('missing', d); process.exit(1); } if (p.dependencies[d].startsWith('^')) { console.error('caret on locked', d); process.exit(1); } }"` exits 0.
    - `node -e "const p = require('./apps/mobile/package.json'); if (!p.devDependencies['react-native-asset']) process.exit(1)"` exits 0.
    - `cd apps/mobile && npm run typecheck` exits 0.
    - `cd apps/mobile && npm run test` (existing Phase 1 SignIn.test.tsx) still passes.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test</automated>
  </verify>
  <done>All Phase 2 deps installed at exact pinned versions, package-lock.json updated, no regression on Phase 1 tests.</done>
</task>

<task type="auto">
  <name>Task 2: Wire fonts via react-native-asset + extend Android build.gradle for Robolectric</name>
  <files>apps/mobile/react-native.config.js (NEW), apps/mobile/assets/fonts/.gitkeep (NEW), apps/mobile/android/app/build.gradle, apps/mobile/android/app/src/test/resources/hevc-fixtures/.gitkeep (NEW)</files>
  <read_first>
    - apps/mobile/android/app/build.gradle (current dependencies block at lines 89-98 per 02-PATTERNS.md)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UI-03 (fonts) + D-COMPAT-01 (Robolectric)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "apps/mobile/android/app/build.gradle (modify — Robolectric testImplementation)" lines 770-792
    - design-system/ (locate brand font TTF files — RethinkSans family per design-spec §0.2)
  </read_first>
  <action>
    1. Create `apps/mobile/react-native.config.js`:
       ```js
       module.exports = {
         project: { android: {} },
         assets: ['./assets/fonts/'],
       };
       ```
    2. Create `apps/mobile/assets/fonts/` directory with a `.gitkeep` file. Copy the RethinkSans family TTF files from `design-system/` into this directory (filenames: `RethinkSans-Regular.ttf`, `RethinkSans-Medium.ttf`, `RethinkSans-SemiBold.ttf`, `RethinkSans-Bold.ttf`, `RethinkSans-ExtraBold.ttf`). If the design-system/ files are differently named, rename the copies to match. If the files are absent in `design-system/`, leave the directory empty with `.gitkeep` and note in summary that font assets need to be obtained — DO NOT block on this.
    3. Run `cd apps/mobile && npx react-native-asset` to link fonts into `android/app/src/main/assets/fonts/`. (Skip if Task 2 step 2 left the dir empty.)
    4. Edit `apps/mobile/android/app/build.gradle`:
       - Inside the existing `dependencies { ... }` block, append:
         ```
         testImplementation 'junit:junit:4.13.2'
         testImplementation 'org.robolectric:robolectric:4.13'
         testImplementation 'androidx.test:core:1.6.1'
         testImplementation 'androidx.test.ext:junit:1.2.1'
         ```
       - Inside the `android { ... }` block, add or extend:
         ```
         testOptions {
             unitTests {
                 includeAndroidResources = true
             }
         }
         ```
    5. Create `apps/mobile/android/app/src/test/resources/hevc-fixtures/.gitkeep` so plan 02-12's NAL parser fixture dir exists. (Actual `.h265` fixture binaries are generated by 02-12.)
    6. Run `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --offline` — should succeed with "no tests found" (no Kotlin tests yet).
  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/react-native.config.js && grep -q "assets:" apps/mobile/react-native.config.js` succeeds.
    - `test -d apps/mobile/assets/fonts` returns 0.
    - `test -d apps/mobile/android/app/src/test/resources/hevc-fixtures` returns 0.
    - `grep -c "robolectric" apps/mobile/android/app/build.gradle` returns ≥ 1.
    - `grep -q "includeAndroidResources" apps/mobile/android/app/build.gradle` succeeds.
    - `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --offline` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>test -f apps/mobile/react-native.config.js && grep -q "robolectric" apps/mobile/android/app/build.gradle && grep -q "includeAndroidResources" apps/mobile/android/app/build.gradle && cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --offline -q</automated>
  </verify>
  <done>react-native.config.js exists with fonts dir; build.gradle has Robolectric block + testOptions; HEVC fixture dir scaffolded; Gradle unit-test task runs (no tests yet, passes).</done>
</task>

<task type="auto">
  <name>Task 3: Extend vitest.setup.ts mocks for new RN-ecosystem deps</name>
  <files>apps/mobile/vitest.setup.ts</files>
  <read_first>
    - apps/mobile/vitest.setup.ts (current Phase 1 host-component shim at lines 10-50 per 02-PATTERNS.md)
    - apps/mobile/__tests__/SignIn.test.tsx (sample test — confirm new mocks don't break it)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "apps/mobile/vitest.setup.ts" lines 615-637
  </read_first>
  <action>
    Append the following `vi.mock` calls to `apps/mobile/vitest.setup.ts` (do NOT remove or alter the existing Phase 1 `react-native` mock):

    1. Mock `@react-navigation/native`:
       ```ts
       vi.mock('@react-navigation/native', () => ({
         NavigationContainer: ({ children }: { children: React.ReactNode }) => children as any,
         useNavigation: () => ({
           replace: vi.fn(),
           reset: vi.fn(),
           navigate: vi.fn(),
           goBack: vi.fn(),
           push: vi.fn(),
         }),
         useRoute: () => ({ params: {} }),
         useFocusEffect: (cb: () => void) => { cb(); },
       }));
       ```

    2. Mock `@react-navigation/native-stack` and `@react-navigation/bottom-tabs`:
       ```ts
       vi.mock('@react-navigation/native-stack', () => ({
         createNativeStackNavigator: () => ({
           Navigator: ({ children }: any) => children,
           Screen: ({ component: Component }: any) => Component ? React.createElement(Component) : null,
         }),
       }));
       vi.mock('@react-navigation/bottom-tabs', () => ({
         createBottomTabNavigator: () => ({
           Navigator: ({ children }: any) => children,
           Screen: ({ component: Component }: any) => Component ? React.createElement(Component) : null,
         }),
       }));
       ```

    3. Mock `react-native-screens` and `react-native-safe-area-context`:
       ```ts
       vi.mock('react-native-screens', () => ({ enableScreens: () => null }));
       vi.mock('react-native-safe-area-context', () => ({
         SafeAreaProvider: ({ children }: any) => children,
         SafeAreaView: ({ children }: any) => children,
         useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
       }));
       ```

    4. Mock `react-native-mmkv` (shared across all tests):
       ```ts
       vi.mock('react-native-mmkv', () => {
         const stores = new Map<string, Map<string, string>>();
         return {
           MMKV: class {
             id: string;
             constructor(opts: { id?: string } = {}) {
               this.id = opts.id ?? 'default';
               if (!stores.has(this.id)) stores.set(this.id, new Map());
             }
             set(k: string, v: string | number | boolean) {
               stores.get(this.id)!.set(k, String(v));
             }
             getString(k: string) { return stores.get(this.id)!.get(k); }
             getNumber(k: string) { const v = stores.get(this.id)!.get(k); return v ? Number(v) : undefined; }
             getBoolean(k: string) { const v = stores.get(this.id)!.get(k); return v === 'true'; }
             delete(k: string) { stores.get(this.id)!.delete(k); }
             contains(k: string) { return stores.get(this.id)!.has(k); }
             clearAll() { stores.get(this.id)!.clear(); }
           },
         };
       });
       ```
       (Phase 1 `auth.ts` uses `new MMKV(...)` — confirm shape against `apps/mobile/src/services/auth.ts` and adjust mock to match.)

    5. Mock `react-native-reanimated`:
       ```ts
       vi.mock('react-native-reanimated', () => ({
         default: { View: 'View', Text: 'Text' },
         useSharedValue: (v: any) => ({ value: v }),
         useAnimatedStyle: (cb: any) => cb(),
         withTiming: (v: any) => v,
         withSequence: (...vs: any[]) => vs[vs.length - 1],
         withSpring: (v: any) => v,
         Easing: { inOut: () => () => 0, linear: () => 0 },
       }));
       ```

    6. Mock `react-native-haptic-feedback`:
       ```ts
       vi.mock('react-native-haptic-feedback', () => ({
         default: { trigger: vi.fn() },
         trigger: vi.fn(),
       }));
       ```

    7. Mock `react-native-permissions`:
       ```ts
       vi.mock('react-native-permissions', () => ({
         PERMISSIONS: { ANDROID: { CAMERA: 'android.permission.CAMERA', RECORD_AUDIO: 'android.permission.RECORD_AUDIO' } },
         RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked', UNAVAILABLE: 'unavailable' },
         request: vi.fn(async () => 'granted'),
         check: vi.fn(async () => 'granted'),
         openSettings: vi.fn(),
       }));
       ```

    8. Mock `lucide-react-native` (general icons used across screens):
       ```ts
       vi.mock('lucide-react-native', () => new Proxy({}, {
         get: (_, prop) => {
           if (typeof prop !== 'string') return undefined;
           const name = String(prop);
           const Component = (props: any) => React.createElement('span', { 'data-icon': name, ...props });
           Component.displayName = name;
           return Component;
         },
       }));
       ```

    9. Mock `react-native-svg`:
       ```ts
       vi.mock('react-native-svg', () => ({
         default: ({ children, ...rest }: any) => React.createElement('svg', rest, children),
         Svg: ({ children, ...rest }: any) => React.createElement('svg', rest, children),
         Circle: (props: any) => React.createElement('circle', props),
         Path: (props: any) => React.createElement('path', props),
         G: ({ children, ...rest }: any) => React.createElement('g', rest, children),
       }));
       ```

    Run `npm run test` and confirm Phase 1's `SignIn.test.tsx` still passes (no new mocks should break it).

  </action>
  <acceptance_criteria>
    - `grep -c "vi.mock(" apps/mobile/vitest.setup.ts` returns ≥ 9 (Phase 1 `react-native` mock + 8 new ones above).
    - `grep -q "@react-navigation/native" apps/mobile/vitest.setup.ts` succeeds.
    - `grep -q "react-native-mmkv" apps/mobile/vitest.setup.ts` succeeds.
    - `grep -q "react-native-permissions" apps/mobile/vitest.setup.ts` succeeds.
    - `grep -q "lucide-react-native" apps/mobile/vitest.setup.ts` succeeds.
    - `cd apps/mobile && npm run test` passes the existing `SignIn.test.tsx` suite.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && grep -c "vi.mock(" vitest.setup.ts | awk '$1 >= 9 { exit 0 } { exit 1 }' && npm run test</automated>
  </verify>
  <done>vitest.setup.ts mocks all Phase 2 RN-ecosystem deps; existing Phase 1 tests unbroken; new tests can rely on the standard mock seam without redeclaring.</done>
</task>

<task type="auto">
  <name>Task 4: Author design-token module + 8 UI primitives</name>
  <files>apps/mobile/src/ui/tokens.ts (NEW), apps/mobile/src/ui/primitives/Text.tsx, Button.tsx, Pressable.tsx, ScreenContainer.tsx, Sheet.tsx, Modal.tsx, Field.tsx, Icon.tsx (all NEW), apps/mobile/__tests__/ui/primitives.test.tsx (NEW)</files>
  <read_first>
    - design-spec.md §0.1 (color tokens — verbatim hex values), §0.2 (typography table), §0.3 (spacing 4/6/8/10/12/14/16/18/20/22/24/28/32/48 + radii), §0.4 (motion curves), §0.5 (universal components: top bar, bottom nav, avatar, icons, buttons)
    - engineering-handoff.md §1.1-§1.6 (design tokens) + §1.7 (iconography) + §2 (component inventory)
    - apps/mobile/src/screens/SignIn.tsx (Phase 1 StyleSheet pattern — line ~69-89 in 02-PATTERNS.md)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-UI-01..05
  </read_first>
  <action>
    1. Create `apps/mobile/src/ui/tokens.ts`:
       Export typed `as const` constants verbatim from design-spec §0:

       ```ts
       export const colors = {
         bg: '#FAF7F2',
         surface: '#FFFFFF',
         text: '#1A1A1A',
         text2: '#6B6B6B',
         text3: '#9A9590',
         line: '#E8E5E0',
         accent: '#FF6A2D',
         accentSoft: '#FFE6D8',
         coral: '#E84A38',
         success: '#2EB872',
         amber: '#F2A53C',
         info: '#2D7CFF',
         infoSoft: '#E5EEFF',
         chipSuccessBg: '#DEF7E5', chipSuccessText: '#1F7A3A',
         chipProgressBg: '#FFF4E5', chipProgressText: '#8C5A1A',
         chipFailedBg: '#FFE3DD', chipFailedText: '#B5331E',
         bannerWarnBg: '#FFF4E5', bannerWarnBorder: '#FFD9A8', bannerWarnText: '#8C5A1A',
         recBg: '#0A0A0A',
       } as const;

       export const typography = {
         fontFamily: { regular: 'RethinkSans-Regular', medium: 'RethinkSans-Medium', semibold: 'RethinkSans-SemiBold', bold: 'RethinkSans-Bold', extrabold: 'RethinkSans-ExtraBold', mono: 'Menlo' },
         displayHero: { fontSize: 46, lineHeight: 46, fontWeight: '700' as const, letterSpacing: -1.5 },
         lifetimeNumber: { fontSize: 44, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -1 },
         tileNumber: { fontSize: 28, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.8 },
         title28: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
         tutorialHeading: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
         sheetTitle: { fontSize: 24, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
         pitch: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.4 },
         compatTitle: { fontSize: 20, lineHeight: 24, fontWeight: '700' as const },
         bodyLg: { fontSize: 18, lineHeight: 26, fontWeight: '400' as const },
         body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
         btnLabel: { fontSize: 16, lineHeight: 20, fontWeight: '600' as const },
         tutBody: { fontSize: 17, lineHeight: 25, fontWeight: '400' as const },
         caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
         pillLabel: { fontSize: 14, lineHeight: 18, fontWeight: '500' as const },
         eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
         formLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
         comingSoonBadge: { fontSize: 10, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
         tabLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
         monoTimer: { fontSize: 32, lineHeight: 32, fontWeight: '600' as const, letterSpacing: 1 },
       } as const;

       export const spacing = { xs: 4, s: 6, m: 8, ms: 10, md: 12, mdl: 14, l: 16, ll: 18, xl: 20, xxl: 22, xxxl: 24, h: 28, hh: 32, xxxxl: 48 } as const;

       export const radii = { tile: 18, sheet: 24, modal: 20, button: 14, pill: 999, input: 12, chip: 6, chipPill: 999 } as const;

       export const motion = {
         curveStandard: 'cubic-bezier(.2,.8,.2,1)' as const,
         fadeInMs: 200,
         slideUpMs: 250,
         scalePopMs: 700,
         compatRingStrokeMs: 350,
         pressScale: 0.98,
       } as const;

       export const elevation = { card: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 28, elevation: 4 } } as const;
       ```

    2. Create the 8 primitives at `apps/mobile/src/ui/primitives/`. Each consumes tokens and matches the design-spec §0.5 contract:

       - `Text.tsx`: typed variant prop (`'title28' | 'body' | 'caption' | 'eyebrow' | 'btnLabel' | 'pitch' | 'sheetTitle' | 'lifetimeNumber' | 'tileNumber' | ...`); maps to `typography[variant]`; uses `colors.text` as default; supports `tone` prop (`'primary' | 'secondary' | 'tertiary'` → `colors.text/.text2/.text3`). Wraps RN `Text`.
       - `Pressable.tsx`: thin wrapper over RN `Pressable` that adds `style={({pressed}) => ({transform: pressed ? [{scale: 0.98}] : []})}`. Forwards all RN Pressable props. accessibilityRole defaults to "button".
       - `Button.tsx`: variant prop = `'primary' | 'accent' | 'outline' | 'coral'` (matches design-spec §0.5). Uses `Pressable` internally + `Text` for label. `disabled` → opacity 0.4 + no onPress. Required `accessibilityLabel` prop. Width 100% by default. 14 px radius, 16/20 px padding (16 fontSize, 20 lineHeight via tokens).
       - `ScreenContainer.tsx`: wraps RN `SafeAreaView` with `colors.bg` background, default 20 px horizontal padding (overridable via `padding` prop). Uses `useSafeAreaInsets` for top/bottom respect.
       - `Sheet.tsx`: bottom-anchored sheet primitive. White surface, top radius `radii.sheet` (24), 20 px sides. Internally uses RN `Modal` with `transparent` + a tap-to-dismiss scrim (rgba(0,0,0,.5)). Children rendered inside.
       - `Modal.tsx`: centered modal card per design-spec §18 base shape: scrim rgba(0,0,0,.5), centered card 20 px radius (`radii.modal`), 24 px padding, scale-pop entry. Title prop, children body, action row support. Internally uses RN `Modal`.
       - `Field.tsx`: form-input primitive. Label (uses `typography.formLabel`), TextInput (12-14 px radius input), error line (13 px coral). Supports `value`, `onChangeText`, `placeholder`, `error`, `secureTextEntry`, `keyboardType`. `accessibilityLabel` auto-generated from label.
       - `Icon.tsx`: thin wrapper over `lucide-react-native`. Props: `name: keyof LucideIconNames`, `size`, `color`, `strokeWidth=1.75`. Re-exports `LucideIconName` type from `lucide-react-native`.

       Each primitive file MUST:
       - Have a `// @doc` JSDoc block citing the design-spec section it implements.
       - Import tokens via `import { colors, typography, spacing, radii } from '../tokens';` (NO hex literals).
       - Forward `accessibilityLabel` and `accessibilityRole` to maintain the testing contract.

    3. Create `apps/mobile/__tests__/ui/primitives.test.tsx`:
       Snapshot/render tests for each primitive:
       - `Button`: renders with variant=primary; disabled=true halves opacity; `onPress` called on click.
       - `Text`: variant=title28 produces fontSize:28; tone=secondary uses colors.text2.
       - `Field`: error prop renders coral error text.
       - `Modal`: renders title + children when `visible`.

       Each test ~5-10 LOC, follows the Phase 1 `SignIn.test.tsx` `vi.mock` + `render` + `getByLabelText` pattern.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/src/ui/tokens.ts && grep -q "^export const colors" apps/mobile/src/ui/tokens.ts && grep -q "^export const typography" apps/mobile/src/ui/tokens.ts && grep -q "^export const spacing" apps/mobile/src/ui/tokens.ts` succeeds.
    - `ls apps/mobile/src/ui/primitives/*.tsx | wc -l` returns 8.
    - `grep -L "from '../tokens'" apps/mobile/src/ui/primitives/*.tsx | wc -l` returns 0 (every primitive imports tokens; -L lists files NOT matching → expect 0).
    - `grep -E "#[0-9A-Fa-f]{6}" apps/mobile/src/ui/primitives/*.tsx | wc -l` returns 0 (no hex literals leaked into primitives).
    - `cd apps/mobile && npm run typecheck` exits 0.
    - `cd apps/mobile && npm run test -- __tests__/ui/primitives.test.tsx` passes.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && test -f src/ui/tokens.ts && (ls src/ui/primitives/*.tsx | wc -l | awk '$1 == 8 { exit 0 } { exit 1 }') && (grep -E "#[0-9A-Fa-f]{6}" src/ui/primitives/*.tsx | wc -l | awk '$1 == 0 { exit 0 } { exit 1 }') && npm run typecheck && npm run test -- __tests__/ui/primitives.test.tsx</automated>
  </verify>
  <done>tokens.ts published with verbatim design-spec §0 values; 8 primitives exist, import tokens, no hex literals; primitives.test.tsx passes; typecheck clean.</done>
</task>

</tasks>

<verification>
- All Phase 2 npm deps installed at exact pinned versions.
- Robolectric block in build.gradle; Gradle unit-test task runs (zero tests, exits 0).
- vitest.setup.ts has 9+ vi.mock calls covering every Phase 2 RN dep.
- `apps/mobile/src/ui/tokens.ts` and 8 primitives exist; no hex literals leaked.
- Existing Phase 1 SignIn.test.tsx still passes.
</verification>

<success_criteria>

- D-UI-01..05 implemented (tokens + primitives + light-only + fonts + lucide).
- Wave 0 test infrastructure ready: vitest mocks + Robolectric harness + HEVC fixture dir.
- Subsequent plans can `import { colors, typography } from '../ui/tokens'` and `import { Button, Text, Field, ... } from '../ui/primitives/...'` without further setup.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-02-SUMMARY.md` listing exact pinned versions installed (any deviation from RESEARCH §Standard Stack with rationale), font-link outcome, and Robolectric verification.
</output>
