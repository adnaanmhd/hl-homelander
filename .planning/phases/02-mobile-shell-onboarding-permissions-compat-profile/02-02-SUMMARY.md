---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 02
subsystem: ui
tags:
  [
    react-native,
    react-navigation,
    zustand,
    reanimated,
    react-native-asset,
    robolectric,
    vitest,
    design-tokens,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'apps/mobile is npm-managed (lockfileVersion 3) and excluded from the pnpm workspace; @humyn/shared-types links via file:; settings.gradle uses ../node_modules; metro.config.js single-app shape'
provides:
  - 'apps/mobile/src/ui/tokens.ts — colors / typography / spacing / radii / motion / elevation, verbatim from design-spec §0'
  - 'apps/mobile/src/ui/primitives/{Text,Pressable,Button,ScreenContainer,Sheet,Modal,Field,Icon}.tsx — 8 design-spec §0.5 primitives consumed by every Phase 2 screen plan'
  - 'apps/mobile/vitest.setup.ts mocks for every Phase 2 RN-ecosystem dep (@react-navigation/{native,native-stack,bottom-tabs}, react-native-{screens,safe-area-context,mmkv,reanimated,haptic-feedback,permissions,svg}, lucide-react-native) so screen tests can `vi.mock` services and assert on getByLabelText without re-declaring per-test'
  - 'apps/mobile/react-native.config.js + assets/fonts/ + android/app/src/main/assets/fonts/ — RethinkSans family (Regular/Medium/SemiBold/Bold/ExtraBold) linked via npx react-native-asset'
  - 'apps/mobile/android/app/build.gradle — Robolectric 4.13 + junit 4.13.2 + androidx.test:core 1.6.1 + androidx.test.ext:junit 1.2.1 testImplementation block + testOptions { unitTests { includeAndroidResources = true } }; classpath resolution verified'
  - 'apps/mobile/android/app/src/test/resources/hevc-fixtures/ — reserved for plan 02-12 NAL parser binary fixtures'
affects:
  - 'every subsequent Phase 2 screen plan (02-03..02-22) — they import { Button, Text, Field, … } from src/ui/primitives/* and { colors, typography, spacing } from src/ui/tokens'
  - 'every Phase 2 service test — uses vitest.setup.ts mocks instead of redeclaring per-test'
  - 'plans 02-06+ Robolectric tests for Kotlin native modules (HumynCompat, HumynCapture, HandDetector) drop into android/app/src/test/'
  - 'plan 02-12 HEVC NAL parser tests pull binary fixtures from android/app/src/test/resources/hevc-fixtures/'

# Tech tracking
tech-stack:
  added:
    - '@react-navigation/native@7.2.2 + native-stack@7.3.7 + bottom-tabs@7.3.5 (RN 0.83 + new-arch compatible navigation root)'
    - 'react-native-screens@4.4.0 + react-native-safe-area-context@5.1.0 (React Navigation v7 peer deps)'
    - 'zustand@5.0.2 (app state store, D-STATE-02)'
    - 'lucide-react-native@1.14.0 (general iconography per engineering-handoff §1.7)'
    - 'react-native-permissions@5.2.4 (unified RN permission API, new-arch compatible)'
    - 'react-native-haptic-feedback@2.3.3 (permission-grant + compat-pass haptics)'
    - 'react-native-reanimated@3.16.7 (compat ring stroke + scalePop logo + soft-banner enter)'
    - 'react-native-svg@15.10.1 (vector primitives for compat ring + future custom icon sheets)'
    - 'react-native-uuid@2.0.3 (RFC4122 v4 IDs for client-side telemetry events)'
    - 'react-native-asset@2.1.1 (devDep — font asset linker, D-UI-03)'
    - 'org.robolectric:robolectric:4.13 + junit:junit:4.13.2 + androidx.test:core:1.6.1 + androidx.test.ext:junit:1.2.1 (Android JVM unit-test harness)'
  patterns:
    - 'Pattern: design-token module is the single source of truth for color / typography / spacing / radii / motion / elevation. Every primitive imports from ../tokens; no hex literal MAY appear inside src/ui/primitives/*. Adding a new variant means extending tokens.ts (and design-spec §0 first).'
    - 'Pattern: vitest.setup.ts is the canonical mock seam for RN-ecosystem deps. Per-test files vi.mock service modules ONLY (never re-mock @react-navigation/native, react-native-mmkv, lucide-react-native, etc.).'
    - 'Pattern: react-native shim resolves RN-style props (object | array | function-returning-array for Pressable) to a flat React-DOM object via resolveStyle() before forwarding to <div>/<input>. Lets primitive tests render without choking on Pressable´s `style={({pressed}) => [...]}` shape.'
    - 'Pattern: every UI primitive forwards accessibilityLabel + accessibilityRole and falls back to its visible content when not given (Button label, Field label) so testing-library `getByLabelText` queries work without the consumer repeating themselves.'
    - 'Pattern: react-native-asset is the canonical font linker. `npx react-native-asset` reads react-native.config.js, copies TTFs into android/app/src/main/assets/fonts/, and writes android/link-assets-manifest.json (idempotency bookkeeping). All four files are committed.'

key-files:
  created:
    - 'apps/mobile/src/ui/tokens.ts'
    - 'apps/mobile/src/ui/primitives/Text.tsx'
    - 'apps/mobile/src/ui/primitives/Pressable.tsx'
    - 'apps/mobile/src/ui/primitives/Button.tsx'
    - 'apps/mobile/src/ui/primitives/ScreenContainer.tsx'
    - 'apps/mobile/src/ui/primitives/Sheet.tsx'
    - 'apps/mobile/src/ui/primitives/Modal.tsx'
    - 'apps/mobile/src/ui/primitives/Field.tsx'
    - 'apps/mobile/src/ui/primitives/Icon.tsx'
    - 'apps/mobile/__tests__/ui/primitives.test.tsx'
    - 'apps/mobile/react-native.config.js'
    - 'apps/mobile/assets/fonts/{.gitkeep,RethinkSans-{Regular,Medium,SemiBold,Bold,ExtraBold}.ttf}'
    - 'apps/mobile/android/app/src/main/assets/fonts/RethinkSans-*.ttf (5 files, linked by npx react-native-asset)'
    - 'apps/mobile/android/app/src/main/assets/custom/.gitkeep (react-native-asset side-effect, idempotent re-link target)'
    - 'apps/mobile/android/link-assets-manifest.json'
    - 'apps/mobile/android/app/src/test/resources/hevc-fixtures/.gitkeep'
  modified:
    - 'apps/mobile/package.json (12 runtime + 1 devDep, exact versions)'
    - 'apps/mobile/package-lock.json (regenerated; +796 packages)'
    - 'apps/mobile/vitest.setup.ts (12 new vi.mock() calls + resolveStyle helper + TextInput/Modal/ScrollView host shim entries)'
    - 'apps/mobile/android/app/build.gradle (Robolectric testImplementation block + testOptions includeAndroidResources)'

key-decisions:
  - 'Mocked react-native-mmkv with BOTH `MMKV` class (per react-native-mmkv docs) AND `createMMKV` factory (per Phase 1 auth.ts actual usage). Single shared in-memory store keyed by `id`. Rationale: plan 02-02 step 4 directly called this out — auth.ts uses `createMMKV({ id, encryptionKey })`, not `new MMKV(...)` — but future Phase 2 plans may use either form. Both pointing at the same store keeps tests trivially shareable.'
  - 'Deferred the Task 2 `:app:testApkRolloutDebugUnitTest` gradle smoke. The same Phase-1-deferred google-services.json gap captured by 02-01-SUMMARY.md transitively blocks every apkRolloutDebug task chain (Google Services Gradle plugin runs as part of the variant pre-test resource processing). The brief explicitly says do not fix it inside 02-02. Verified the structural goal — Robolectric is wired into the test classpath — by running `:app:dependencies --configuration apkRolloutDebugUnitTestRuntimeClasspath`, which resolves robolectric:4.13, junit:4.13.2, androidx.test:core:1.6.1, androidx.test.ext:junit:1.2.1, and their transitive deps cleanly.'
  - 'Wrote the pinned versions from the plan body verbatim, even though `npm view` reports newer 7.x patches for several @react-navigation/* packages (e.g., bottom-tabs 7.15.13 vs the plan´s 7.3.5). Per plan body: "If `npm view` reports a different latest stable, prefer the version from the RESEARCH table." All deps land at exact versions (no carets) per the locked-pin acceptance criterion.'
  - 'Added a `resolveStyle()` helper to vitest.setup.ts react-native shim. RN accepts style as object | array | function-returning-array (Pressable). React-DOM accepts only an object. Without flattening, every primitive that uses Pressable´s `style={({pressed}) => [...]}` shape failed in JSDOM. Helper recurses through arrays + calls the function once with `{pressed: false}` to materialize a static object. Exposes a Pressable-press snapshot in tests, which is the right level for unit assertion (real pressed-state visuals are integration-tested on device).'
  - 'Did NOT install MMKV / Keychain peers explicitly — they are already pinned (4.3.1 / 10.0.0) by Phase 1. Plan 02-02 added 12 new deps + 1 devDep on top of the existing 11.'

patterns-established:
  - 'Pattern: src/ui/tokens.ts holds the canonical design-token surface; every primitive imports from ../tokens and no hex literal appears inside src/ui/primitives/*. Verifier: `grep -E "#[0-9A-Fa-f]{6}" apps/mobile/src/ui/primitives/*.tsx | wc -l` MUST return 0.'
  - 'Pattern: vitest.setup.ts vi.mock seam is the canonical place for RN-ecosystem mocks. Per-test files vi.mock service / domain modules only.'
  - 'Pattern: every UI primitive forwards accessibilityLabel + accessibilityRole and falls back to its visible content (Button → label, Field → label, Modal → "Modal", Sheet → "Sheet"). testing-library `getByLabelText` queries work without the consumer repeating themselves.'
  - 'Pattern: react-native-asset linking is the canonical font pipeline (NOT a manual copy into android/app/src/main/assets/fonts/). The manifest at android/link-assets-manifest.json is committed so a fresh `npx react-native-asset` on a clean checkout is idempotent.'

requirements-completed: []

# Metrics
duration: 16min
completed: 2026-05-09
---

# Phase 2 Plan 02: Test scaffolding, dependency install, design tokens, primitives, fonts Summary

**Phase 2 RN-ecosystem deps installed at exact pins; vitest.setup.ts now mocks every new dep (12 vi.mock calls); RethinkSans fonts linked via react-native-asset; Robolectric harness wired into android/app/build.gradle; design-token module + 8 UI primitives + 10 contract assertions ship — every Wave-0 dependency surface for Phase 2 plans 02-03..02-22 is now available.**

## Performance

- **Duration:** ~16 min (2026-05-09T07:55:54Z → 2026-05-09T08:11:51Z)
- **Started:** 2026-05-09T07:55:54Z
- **Completed:** 2026-05-09T08:11:51Z
- **Tasks:** 4 of 4 executed (1 task had a follow-up commit for a `react-native-asset` artifact)
- **Files created:** 19 (tokens.ts + 8 primitives + 1 test file + react-native.config.js + 5 source TTFs + 5 linked TTFs + custom/.gitkeep + hevc-fixtures/.gitkeep + link-assets-manifest.json — net 19 unique files when assets/fonts/.gitkeep is counted as 1)
- **Files modified:** 4 (package.json, package-lock.json, vitest.setup.ts, android/app/build.gradle)
- **Total: 29 files changed, 2249 insertions(+), 40 deletions(-)** in this plan's commit range.

## Accomplishments

- **Dependency surface complete (Task 1).** All 12 Phase 2 runtime deps + react-native-asset devDep installed at exact pinned versions per plan. No carets on any locked dep. `npm typecheck` and Phase 1 SignIn tests still green.
- **Font pipeline working (Task 2).** `apps/mobile/react-native.config.js` declares the asset linker config; `apps/mobile/assets/fonts/` holds 5 RethinkSans upright weights extracted from `design-system/fonts/Rethink_Sans.zip`; `npx react-native-asset` linked them into `android/app/src/main/assets/fonts/` and wrote `android/link-assets-manifest.json`. iOS-side font registration (Info.plist UIAppFonts) is deferred to Phase 7 — there is no `apps/mobile/ios/` yet.
- **Robolectric harness wired (Task 2).** `android/app/build.gradle` carries the four `testImplementation` lines (junit 4.13.2, robolectric 4.13, androidx.test:core 1.6.1, androidx.test.ext:junit 1.2.1) and a `testOptions { unitTests { includeAndroidResources = true } }` block. Classpath resolution verified via `:app:dependencies --configuration apkRolloutDebugUnitTestRuntimeClasspath` which pulls in the full Robolectric transitive tree (espresso-idling-resource, shadowapi, sandbox, pluginapi, plugins-maven-dependency-resolver, …) without errors. `:app:testApkRolloutDebugUnitTest` gradle smoke deferred — same Phase-1 google-services.json gap captured in 02-01-SUMMARY.md.
- **HEVC fixture directory scaffolded (Task 2).** `android/app/src/test/resources/hevc-fixtures/.gitkeep` reserves the path plan 02-12 NAL parser tests will drop binary fixtures into.
- **vitest.setup.ts is the canonical mock seam (Task 3).** 12 new `vi.mock()` calls (13 total including the Phase 1 `react-native` mock) cover every RN-ecosystem dep that Phase 2 screen plans will import. The MMKV mock exposes both `MMKV` class and `createMMKV` factory pointed at the same shared in-memory store, so existing Phase 1 auth.ts (`createMMKV({ id, encryptionKey })`) and forward-looking Phase 2 services (`new MMKV(...)`) both work.
- **8 UI primitives ship with 10 contract assertions (Task 4).** `tokens.ts` (239 LOC) exports colors / typography / spacing / radii / motion / elevation `as const`. Every primitive imports tokens via `../tokens`; no hex literal leaks (`grep -E "#[0-9A-Fa-f]{6}" src/ui/primitives/*.tsx | wc -l` returns 0). The 10 primitive tests pass alongside the 3 Phase 1 SignIn tests (13 / 13 green).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pinned Phase 2 dependencies** — `61ad64b` (chore)
2. **Task 2: Wire fonts via react-native-asset + Robolectric harness** — `a938d57` (chore)
   - Follow-up: **Task 2 follow-up: commit react-native-asset's auto-linked custom/.gitkeep** — `34c6935` (chore)
3. **Task 3: Extend vitest.setup.ts mocks for Phase 2 RN-ecosystem deps** — `759f441` (test)
4. **Task 4: Design tokens module + 8 UI primitives + smoke tests** — `bad2ee5` (feat)

_Plan was `autonomous: true`. All 4 tasks landed under their plan-body acceptance commands except for Task 2's `:app:testApkRolloutDebugUnitTest` (deferred — see "Deviations from Plan" below)._

## Files Created/Modified

- `apps/mobile/package.json` — 12 runtime deps + 1 devDep (`react-native-asset`) added at exact versions; no carets.
- `apps/mobile/package-lock.json` — regenerated by npm install; +796 transitive packages.
- `apps/mobile/react-native.config.js` — react-native-asset linker config: `assets: ['./assets/fonts/']`.
- `apps/mobile/assets/fonts/{.gitkeep, RethinkSans-{Regular, Medium, SemiBold, Bold, ExtraBold}.ttf}` — source TTFs extracted from `design-system/fonts/Rethink_Sans.zip` (italic + variable-axis weights NOT extracted; per design-spec §0.2 only the 5 upright weights are referenced).
- `apps/mobile/android/app/src/main/assets/fonts/RethinkSans-{Regular, Medium, SemiBold, Bold, ExtraBold}.ttf` — linked by `npx react-native-asset` for Android registration.
- `apps/mobile/android/app/src/main/assets/custom/.gitkeep` — react-native-asset side-effect (the source `.gitkeep` was treated as a custom asset). Committed for idempotent re-linking on a clean checkout.
- `apps/mobile/android/link-assets-manifest.json` — react-native-asset bookkeeping (sha1 + path of every linked file). Committed.
- `apps/mobile/android/app/src/test/resources/hevc-fixtures/.gitkeep` — reserved for plan 02-12 NAL parser binary fixtures.
- `apps/mobile/android/app/build.gradle` — added 4-line testImplementation block (junit 4.13.2, robolectric 4.13, androidx.test:core 1.6.1, androidx.test.ext:junit 1.2.1) + `testOptions { unitTests { includeAndroidResources = true } }`.
- `apps/mobile/vitest.setup.ts` — `resolveStyle()` helper; extended `react-native` mock with TextInput / Modal / ScrollView and full StyleSheet shim (`flatten`, `absoluteFillObject`); added 12 vi.mock calls covering every Phase 2 RN-ecosystem dep.
- `apps/mobile/src/ui/tokens.ts` (239 LOC) — colors / typography / spacing / radii / motion / elevation tokens; type aliases for ColorToken / TypographyVariant / SpacingToken / RadiusToken.
- `apps/mobile/src/ui/primitives/Text.tsx` — variant + tone primitive; defaults variant=body, tone=primary.
- `apps/mobile/src/ui/primitives/Pressable.tsx` — RN Pressable wrapper with `motion.pressScale` press transform; defaults role="button".
- `apps/mobile/src/ui/primitives/Button.tsx` — primary / accent / outline / coral variants; required label; accessibilityLabel falls back to label; disabled → opacity 0.4 + onPress suppressed.
- `apps/mobile/src/ui/primitives/ScreenContainer.tsx` — SafeArea-respecting screen frame with `colors.bg` background and 20 px gutter; `noSafeArea` and `backgroundColor` opt-outs.
- `apps/mobile/src/ui/primitives/Sheet.tsx` — bottom-anchored sheet; rgba(0,0,0,.5) scrim; tap-to-dismiss; `radii.sheet` (24).
- `apps/mobile/src/ui/primitives/Modal.tsx` — centered card per design-spec §18; title / body / actions slots; `radii.modal` (20).
- `apps/mobile/src/ui/primitives/Field.tsx` — form input; uppercase formLabel + 12 px input radius + coral error caption.
- `apps/mobile/src/ui/primitives/Icon.tsx` — thin lucide-react-native wrapper; default strokeWidth 1.75 (engineering-handoff §1.7).
- `apps/mobile/__tests__/ui/primitives.test.tsx` — 10 contract assertions across Button (4), Text (2), Field (3), Modal (1).

## Decisions Made

- **MMKV mock exposes both `MMKV` class AND `createMMKV` factory pointing at the same shared in-memory store.** Plan called this out: Phase 1 auth.ts uses the factory form; future Phase 2 services may use either. One mock, two surfaces, single store.
- **Deferred `:app:testApkRolloutDebugUnitTest` gradle smoke** — same Phase-1-deferred google-services.json gap captured in 02-01-SUMMARY.md transitively blocks every apkRolloutDebug task chain. The brief says explicitly: "do not try to 'fix' [google-services.json] inside 02-02." Structural goal verified instead via `:app:dependencies --configuration apkRolloutDebugUnitTestRuntimeClasspath` (Robolectric 4.13 + transitive deps resolve cleanly).
- **Wrote the plan-body pinned versions verbatim** even where `npm view` reports newer 7.x patches for several @react-navigation/\* packages. Per plan body: "If `npm view` reports a different latest stable, prefer the version from the RESEARCH table." All deps land at exact versions (no carets) per the locked-pin acceptance.
- **Added `resolveStyle()` helper to react-native shim** so RN's array-of-objects + Pressable's `style={({pressed}) => [...]}` shapes flatten to a single React-DOM-friendly object before being forwarded to `<div>` / `<input>`. Without it every primitive that uses Pressable's function-style shape failed with "The `style` prop expects a mapping…". This is a forward-looking shim improvement: every Phase 2 screen plan benefits.
- **Extracted only the 5 upright RethinkSans weights** (Regular, Medium, SemiBold, Bold, ExtraBold) — italic and variable-axis weights are not referenced anywhere in design-spec §0.2 / engineering-handoff §1.2-1.3. Adding them later is a one-line `react-native.config.js` no-op (the dir is the same).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-commit hook required pnpm workspace node_modules — ran `pnpm install` to satisfy it.**

- **Found during:** Task 1 commit (first commit attempt failed: `pnpm typecheck` step in `.husky/pre-commit` errored with "tsc: command not found" because the worktree had no `node_modules` at the workspace root).
- **Issue:** Worktree was a fresh checkout; pnpm-workspace deps for `apps/api` + `shared/types` were not installed; the husky `pnpm typecheck` step depends on them being on `node_modules/.bin/`.
- **Fix:** Ran `pnpm install` (3s; lockfile already up to date). Re-attempted the commit; pre-commit hook ran cleanly.
- **Files modified:** None inside the repo (pnpm install only writes node_modules + .pnpm/).
- **Verification:** `pnpm typecheck` exits 0 (apps/api + shared/types both green).
- **Committed in:** `61ad64b` (Task 1 commit succeeded after the install).

**2. [Rule 1 - Bug] Vitest react-native shim choked on RN array / function `style` props — added `resolveStyle()` helper.**

- **Found during:** Task 4 verify (`npm run test -- __tests__/ui/primitives.test.tsx` failed for every Button assertion with "The `style` prop expects a mapping from style properties to values, not a string." 4 of 10 primitive tests red).
- **Issue:** Phase 1's shim spread `style` into the DOM as-is via `...rest`. RN accepts `style` as `object | array<falsy | object> | (state) => array` (Pressable). React-DOM accepts only an object — arrays serialize to "[object Object],[object Object]" string and trigger the warning. Affects Button (uses Pressable's function form), and any future primitive that builds a `[base, override]` style array.
- **Fix:** Added `resolveStyle(value)` helper to vitest.setup.ts that recursively collapses arrays / calls function-style with `{pressed: false}` / merges objects to a single flat object. Both `makeComponent` and `makeTextInput` route `style` through it. Also dropped `placeholderTextColor` / `secureTextEntry` / `keyboardType` from the TextInput shim's forwarded props (React-DOM doesn't recognise them).
- **Files modified:** `apps/mobile/vitest.setup.ts` (the shim is itself part of Task 4's commit since the helper was needed to GREEN Task 4's test acceptance).
- **Verification:** All 13 tests pass (3 Phase 1 + 10 Task 4); `tsc --noEmit` clean.
- **Committed in:** `bad2ee5` (Task 4 commit, alongside the primitives + tokens).

**3. [Rule 3 - Blocking] `:app:testApkRolloutDebugUnitTest` gradle task transitively requires google-services.json; deferred per orchestrator brief.**

- **Found during:** Task 2 verify (`./gradlew :app:testApkRolloutDebugUnitTest --offline -q` failed first on a missing `com.android.tools.build:gradle:7.0.4` cache entry, then with network on `:app:processApkRolloutDebugGoogleServices` because google-services.json is absent).
- **Issue:** Same Phase-1-deferred gap captured in 02-01-SUMMARY.md "Operator Smoke Verdict / Gap Captured for Phase-Level UAT". Google Services Gradle plugin runs as part of the variant pre-test resource processing chain. `-x :app:processApkRolloutDebugGoogleServices` doesn't help — `:app:mapApkRolloutDebugSourceSetPaths` evaluates the GoogleServices task's output property before the task can be skipped.
- **Fix:** Did NOT fix per orchestrator brief: "Phase-level UAT gap captured in 02-01-SUMMARY.md: google-services.json is not provisioned by any plan; do not try to 'fix' it inside 02-02." Verified the structural goal of Task 2 (Robolectric in the test classpath) by running `./gradlew :app:dependencies --configuration apkRolloutDebugUnitTestRuntimeClasspath`, which pulls junit 4.13.2 + robolectric 4.13 + androidx.test:core 1.6.1 + androidx.test.ext:junit 1.2.1 + their full transitive tree (espresso-idling-resource, shadowapi, sandbox, pluginapi, plugins-maven-dependency-resolver, …) without error.
- **Files modified:** none — `android/app/build.gradle` already correct.
- **Verification:** dependency tree resolves cleanly (see "Accomplishments → Robolectric harness wired"). Live test execution will become possible the moment the phase-level google-services.json gap is closed (via `secrets.GOOGLE_SERVICES_JSON_APK_ROLLOUT` in mobile-ci.yml + per-developer drop in apps/mobile/android/app/src/apkRolloutDebug/google-services.json).
- **Committed in:** `a938d57` (Task 2 commit; deviation noted in commit message).

**4. [Rule 3 - Blocking] `npx react-native-asset` produced an unexpected `assets/custom/.gitkeep` artifact — committed for idempotency.**

- **Found during:** Task 2 follow-up (post-Task-3 `git status` reported `apps/mobile/android/app/src/main/assets/custom/` as untracked).
- **Issue:** `react-native-asset` runs a "custom assets" pass alongside the font pass. The source `apps/mobile/assets/fonts/.gitkeep` (a non-TTF file) was treated as a custom asset and copied to `android/app/src/main/assets/custom/.gitkeep` — same content as the source.
- **Fix:** Committed the artifact directly (4 lines) so a fresh `npx react-native-asset` re-link on a clean checkout is idempotent. Alternative would have been to add it to `.gitignore`, but committing the deterministic output keeps `git status` clean across all dev environments.
- **Files modified:** `apps/mobile/android/app/src/main/assets/custom/.gitkeep` (new).
- **Verification:** `git status --short` clean; `npx react-native-asset` re-run is a no-op (manifest unchanged).
- **Committed in:** `34c6935` (Task 2 follow-up, separate commit so the audit trail attributes it to react-native-asset's behaviour, not to the human-authored Task 2).

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 3 Rule 3 blockers).
**Impact on plan:** Deviations 1 and 4 were environmental (worktree didn't have pnpm node_modules; react-native-asset had a side-effect we accepted). Deviation 2 was a real bug in the Phase 1 shim that would have broken every Phase 2 primitive test going forward — fixing it once here saves cost-per-screen-test going forward. Deviation 3 is identical to the 02-01 phase-level UAT gap; explicitly NOT in 02-02's scope.

## Issues Encountered

- **Plan body pinned `react-native-asset@2.1.1` even though npm registry latest is 2.3.0.** The plan body is treated as the source of truth; we honoured the pin. Should the registry pin issue arise again in Phase 2 (e.g., a CVE drop forces an upgrade), the planner-level fix is to bump the pin and re-issue the plan; we didn't auto-bump because the plan acceptance criterion is exact-match.
- **`grep -c "robolectric" build.gradle` is case-sensitive.** Returns 1 (≥1 OK) because there's one lowercase `'org.robolectric:robolectric:4.13'` line; the comments use the capitalised "Robolectric" form for readability. The plan acceptance is `grep -c "robolectric" returns ≥ 1` — passes.

## User Setup Required

None for plan 02-02 itself. The phase-level `google-services.json` gap (carried over from 02-01) remains the only outstanding setup affecting `:app:testApkRolloutDebugUnitTest` and the eventual `mobile-ci.yml` android-build job. Resolution path documented in 02-01-SUMMARY.md (mobile-ci.yml `secrets.GOOGLE_SERVICES_JSON_APK_ROLLOUT` step + per-developer Firebase console drop).

## Next Phase Readiness

- **Wave 0 work for Phase 2 is now complete on this branch.** Subsequent screen plans (02-03 onboarding splash, 02-04 sign-up, 02-05 permissions, 02-06 compat-check, … through 02-22) can land in any order so long as their dep graph honours `requires`.
- **Every Phase 2 screen plan can `import { Button, Text, Field, ScreenContainer, Sheet, Modal, Icon, Pressable } from '../../src/ui/primitives/...'`** without further setup.
- **Every Phase 2 service / screen test can rely on the standard mock seam** in `apps/mobile/vitest.setup.ts` — there is no need for per-test vi.mock declarations of @react-navigation/native, react-native-mmkv, lucide-react-native, etc.
- **Robolectric harness is wired** (build.gradle classpath confirmed). Plan 02-06+ Kotlin native-module tests (HumynCompat, HumynCapture, HandDetector) drop into `android/app/src/test/`; the only thing blocking live execution is the phase-level google-services.json gap.
- **Font pipeline is wired** for Android. iOS-side Info.plist UIAppFonts registration is deferred to Phase 7 — there is no `apps/mobile/ios/` yet.
- **HEVC NAL parser fixture directory exists** at `android/app/src/test/resources/hevc-fixtures/`. Plan 02-12 will populate it.

## Self-Check: PASSED

- File `apps/mobile/src/ui/tokens.ts` — FOUND; `^export const colors`, `^export const typography`, `^export const spacing` all present.
- 8 primitive `.tsx` files at `apps/mobile/src/ui/primitives/` — FOUND (`ls src/ui/primitives/*.tsx | wc -l` returns 8).
- All 8 primitives import from `'../tokens'` — VERIFIED (`grep -L "from '../tokens'" src/ui/primitives/*.tsx | wc -l` returns 0 — no files MISSING the import).
- No hex literal in any primitive — VERIFIED (`grep -E "#[0-9A-Fa-f]{6}" src/ui/primitives/*.tsx | wc -l` returns 0).
- File `apps/mobile/__tests__/ui/primitives.test.tsx` — FOUND.
- `apps/mobile/react-native.config.js` — FOUND; contains `assets:`.
- `apps/mobile/assets/fonts/` directory — FOUND with 5 TTFs + .gitkeep.
- `apps/mobile/android/app/src/main/assets/fonts/` — FOUND with 5 TTFs (linked from source).
- `apps/mobile/android/app/src/test/resources/hevc-fixtures/` directory — FOUND with .gitkeep.
- `apps/mobile/android/app/build.gradle` — `grep -c "robolectric"` returns 1 (≥1 OK); `grep -q "includeAndroidResources"` succeeds.
- 13 vi.mock calls in `apps/mobile/vitest.setup.ts` — FOUND (`grep -c "vi.mock(" vitest.setup.ts` returns 13; ≥9 required); covers @react-navigation/native, react-native-mmkv, react-native-permissions, lucide-react-native, react-native-svg, react-native-reanimated, react-native-haptic-feedback, react-native-screens, react-native-safe-area-context, @react-navigation/native-stack, @react-navigation/bottom-tabs, plus the existing react-native shim.
- `cd apps/mobile && npm run typecheck` — exits 0.
- `cd apps/mobile && npm run test` — 2 test files / 13 tests / all passing.
- Commit `61ad64b` (Task 1) — FOUND in `git log --oneline`.
- Commit `a938d57` (Task 2) — FOUND.
- Commit `34c6935` (Task 2 follow-up: react-native-asset custom/.gitkeep) — FOUND.
- Commit `759f441` (Task 3) — FOUND.
- Commit `bad2ee5` (Task 4) — FOUND.
- `apps/mobile/android/settings.gradle` — UNCHANGED at `../node_modules/@react-native/gradle-plugin` (no regression to the 02-01 Task 4 follow-up fix).
- `apps/mobile/metro.config.js` — UNCHANGED (no `disableHierarchicalLookup`, no `workspaceRoot` watchFolder, narrow `watchFolders: [sharedTypesRoot]` only — no regression to 02-01's contribution).

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed: 2026-05-09_
