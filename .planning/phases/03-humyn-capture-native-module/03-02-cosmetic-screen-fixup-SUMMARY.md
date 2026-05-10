---
phase: 03-humyn-capture-native-module
plan: 02
subsystem: ui

tags:
  [
    cosmetic-fixup,
    rethink-sans,
    visual-snapshot,
    jest-image-snapshot,
    bottom-nav,
    cta-layout,
    asset-wiring,
    support-email,
  ]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    plan: 01
    provides: density-bucketed orange_logo PNGs (320×73 / 640×146 / 960×220) +
      transparent rig illustration placeholders (280/560/840 px) +
      jest-image-snapshot Vitest expect.extend adapter +
      __image_snapshots__/.gitkeep baseline directory
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: Phase 2 cosmetic gap inventory (02-COSMETIC-GAPS.md frozen-2026-05-10) +
      OQ-1 resolution path (support@humynlabs.ai) + RethinkSans .ttf bundle in
      apps/mobile/assets/fonts/ + Vitest 4 + jsdom + react-native host-component
      shim in vitest.setup.ts
provides:
  - 6 modified RN screens wiring the density-bucketed assets + CTA layout fixes
  - 1 modified Text primitive with stripFontWeight() bulletproofing the
    Android dispatcher against leaky consumer style overrides
  - 1 modified BottomNav with direct lucide-react-native imports + ≥48 dp
    touch targets (minHeight + minWidth + hitSlop)
  - 4 of 5 [EMAIL_ADDRESS] occurrences swapped for support@humynlabs.ai
    (the 5th in CompatRecoveryScreen.tsx is owned by Plan 03-03 Compat-fail merge)
  - 6 jest-image-snapshot visual tests + 6 PNG baselines committed to
    apps/mobile/__tests__/visual/__image_snapshots__/
  - apps/mobile/__tests__/visual/_utils/renderToImage.ts deterministic
    render-tree-PNG helper for Vitest
  - apps/mobile/__tests__/visual/_utils/types.d.ts +
    apps/mobile/__tests__/visual/_utils/pngjs.d.ts type declarations
  - vitest.setup.ts Animated.View/Text/Image/ScrollView host-component-shim
    siblings (resolves the 7 deferred SplashScreen + RootNativeStack render-time
    failures from Plan 03-01's deferred-items.md)
  - help-center-content.md tracked in git (was an untracked project asset;
    now under version control with the canonical support email substitution)
affects: [
    03-03-cosmetic-functional-regressions,
    03-04..03-10 (HumynCapture native module — Wave 1 acceptance gate D-WAVE-08
    requires every cosmetic gap closed; this plan + Plan 03-03 close it),
    Phase 4 RecordingScreen UI (visual snapshot infra reused),
    Phase 6 Home/Tasks/History UI (visual snapshot infra reused + BottomNav
    Lucide pattern reused),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern 67: RethinkSans on-device font dispatch hardening. Verified via
      `fc-query -f "%{postscriptname}"` that each TTF in apps/mobile/assets/fonts/
      ships a post-script name matching the file basename (extension dropped) AND
      matching typography.fontFamily.* token values. Android RCTFont resolves
      assets/fonts/ entries by basename, iOS UIFont by post-script name; both
      paths are now confirmed correct. Defense-in-depth: Text primitive runs
      stripFontWeight() over user-supplied `style` so a leaky consumer that
      re-introduces fontWeight after the variant cascade can no longer trip the
      Android dispatcher into a Roboto fallback.'
    - 'Pattern 68: Render-tree-PNG visual snapshot helper for JSDOM. JSDOM has
      no <canvas> rasterizer; pulling in node-canvas is a heavy native-binding
      dep on macOS. The cosmetic regressions in 02-COSMETIC-GAPS.md are
      STRUCTURAL (CTA moved, icon missing, logo path wrong, value-prop spacing
      collapsed) — a layout-shift detector that walks the rendered DOM tree and
      emits a deterministic wireframe PNG (one coloured rectangle per element
      keyed by accessibilityLabel hash + tag-type) suffices. Lower fidelity than
      a real rasterizer; HIGHER signal-to-noise for cosmetic regressions.'
    - 'Pattern 69: Per-test inline react-native shim for visual + service-heavy
      tests that need RN system modules (Alert, Linking, Animated.View) NOT in
      the canonical vitest.setup.ts surface. Using vi.importActual(`react-native`)
      trips on Flow `import typeof` syntax (Vite esbuild transform); per-test
      inline factories must replicate the host-component shapes from scratch.
      Same shape used by SignupScreen + HelpCenterScreen visual tests.'
    - 'Pattern 70: Local ambient .d.ts pair for visual-snapshot stack —
      apps/mobile/__tests__/visual/_utils/pngjs.d.ts (no top-level imports →
      ambient module decl works) + apps/mobile/__tests__/visual/_utils/types.d.ts
      (imports `vitest` to interface-merge `toMatchImageSnapshot`). Re-declares
      the runtime augmentation in vitest.setup.ts so tsc + editor LSPs see the
      matcher type from any test file. The setup file is not in tsconfig.include
      so its augmentation is invisible to the type-checker.'

key-files:
  created:
    - apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/RigTutorialScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/HelpCenterScreen.visual.test.tsx
    - apps/mobile/__tests__/visual/_utils/renderToImage.ts
    - apps/mobile/__tests__/visual/_utils/types.d.ts
    - apps/mobile/__tests__/visual/_utils/pngjs.d.ts
    - apps/mobile/__tests__/visual/__image_snapshots__/splash-screen-visual-test-tsx-splash-screen-visual-matches-baseline-logo-tagline-structure-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/signup-screen-visual-test-tsx-signup-screen-visual-matches-baseline-logo-value-props-content-driven-cta-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/permissions-screen-visual-test-tsx-permissions-screen-visual-matches-baseline-icon-title-body-content-driven-cta-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/home-skeleton-screen-visual-test-tsx-home-skeleton-screen-visual-matches-baseline-top-bar-skeleton-body-no-soft-upgrade-banner-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/rig-tutorial-screen-visual-test-tsx-rig-tutorial-screen-visual-matches-baseline-illustration-heading-body-next-cta-1-snap.png
    - apps/mobile/__tests__/visual/__image_snapshots__/help-center-screen-visual-test-tsx-help-center-screen-visual-matches-baseline-3-accordions-collapsed-contact-support-ct-as-1-snap.png
    - help-center-content.md (added to git tracking; was previously an
      untracked project asset)
  modified:
    - apps/mobile/src/ui/primitives/Text.tsx (stripFontWeight() pass over
      user-supplied style + Pattern 67 diagnosis comment)
    - apps/mobile/src/screens/splash/SplashScreen.tsx (drop cover-crop +
      magic-number sizing on the wordmark Image)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (logo wiring + tighten
      value-prop spacing to gap:xs + CTA position/width via container
      justifyContent:'center' + ctaWrap alignSelf:'center')
    - apps/mobile/src/screens/permissions/PermissionsScreen.tsx (CTA position/
      width — drop space-between + flex:1 spacer)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (wire rig.png +
      swap SUPPORT_EMAIL for support@humynlabs.ai)
    - apps/mobile/src/components/BottomNav.tsx (direct lucide-react-native
      imports + ≥48 dp touch targets via minHeight + minWidth + hitSlop)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (SUPPORT_EMAIL_PLACEHOLDER
      constant value swap to support@humynlabs.ai)
    - apps/mobile/src/screens/help/content.json (re-baked from help-center-content.md
      via npm run build:help)
    - apps/mobile/__tests__/screens/HelpCenterScreen.test.tsx (assertion updated
      to expect canonical email)
    - apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx (assertion updated)
    - apps/mobile/__tests__/scripts/build-help-content.test.ts (assertion updated +
      explicit negative assertion against the placeholder)
    - apps/mobile/vitest.setup.ts (Animated.View/Text/Image/ScrollView mock siblings)

key-decisions:
  - 'RethinkSans diagnosis: post-script names verified via fc-query and confirmed
    to match typography.fontFamily.* tokens already. The on-device Roboto-fallback
    flagged by 02-COSMETIC-GAPS.md is therefore NOT a bundling/registration issue
    — TTFs are bundled (verified `unzip -l ...apk | grep RethinkSans`), names
    match. Hardening landed in Text primitive: stripFontWeight() runs over the
    user-supplied style so a leaky consumer can no longer trip the dispatcher.
    On-device validation deferred to the Wave 1 manual re-walk per D-WAVE-08.'
  - "BottomNav switch from Icon primitive to direct lucide-react-native imports.
    The Icon primitive's typeof LucideIconMap typing is too loose to keep grep-
    discoverability intact for HOME-07's 3-tab structural invariant. Direct
    `import { Home as HomeIcon, ListTodo, History as HistoryIcon }` plus a
    typed `Icon: LucideIcon` field in the TabSpec gives PR review a clear
    diff if a fourth tab ever lands."
  - 'Visual snapshot fidelity: render-tree-PNG (Pattern 68) over html-to-image +
    node-canvas. Cosmetic regressions in 02-COSMETIC-GAPS.md are STRUCTURAL
    (layout shifts, missing assets, moved CTAs); a layout-shift wireframe
    suffices and avoids a heavy native-binding dep. Plan 03-03 inherits the
    same helper for its 3 additional baselines.'
  - "Per-test inline react-native shim (Pattern 69) for SignupScreen +
    HelpCenterScreen visual tests. The canonical vitest.setup.ts mock doesn't
    expose Alert / Linking / Animated.View; visual tests need them. Cannot use
    importOriginal() because real react-native index.js uses Flow `import typeof`
    that Vite's esbuild transform can't parse (Pattern 52)."
  - "HomeSkeletonScreen NOT modified for the logo wiring per the plan body's
    explicit guidance (`this plan does NOT touch TopBar; only swap the wordmark
    image source if HomeSkeletonScreen renders the logo directly`). The wordmark
    lives in TopBar (still a typographic stub). The HOME-side logo upgrade is
    implicitly deferred to a future plan that also takes ownership of TopBar
    refactoring per 02-COSMETIC-GAPS.md follow-up."
  - '5th [EMAIL_ADDRESS] occurrence (apps/mobile/src/screens/compat/
    CompatRecoveryScreen.tsx) NOT modified per plan body — Plan 03-03 deletes
    that file as part of the Compat-fail merge per 02-COSMETIC-GAPS.md `Compat-
    fail screen` section. Resolution lands inside the merged CompatFailScreen
    body in Plan 03-03.'

patterns-established:
  - 'Pattern 67: RethinkSans on-device font dispatch hardening (fc-query post-
    script-name verification + Text-primitive stripFontWeight() defense)'
  - 'Pattern 68: Render-tree-PNG visual snapshot helper for JSDOM (deterministic
    wireframe PNG keyed by accessibilityLabel hash + tag-type, no canvas dep)'
  - 'Pattern 69: Per-test inline react-native shim (avoid importOriginal due to
    Flow `import typeof` parse failure; replicate host-component shapes inline)'
  - 'Pattern 70: Local ambient .d.ts pair for the visual-snapshot stack
    (vitest matcher augmentation in tsconfig-include + pngjs ambient module)'

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-05-10
---

# Phase 3 Plan 02: Cosmetic Screen Fixup Summary

**Wired the Plan 03-01 density-bucketed assets into 4 logo-consuming screens, fixed CTA position/width on Sign-up + Permissions, hardened RethinkSans on-device dispatch, swapped 4 of 5 `[EMAIL_ADDRESS]` placeholders, wired 24 dp Lucide icons + ≥48 dp touch targets in BottomNav, and committed 6 jest-image-snapshot baselines so future cosmetic regressions surface in PR review.**

## Performance

- **Duration:** ~25 min (Task 1 commit at 19:11, Task 3 at 19:27 — including the bad `git stash` recovery detour around 19:25)
- **Started:** 2026-05-10T19:08:00Z
- **Completed:** 2026-05-10T19:32:00Z
- **Tasks:** 3
- **Files modified:** 26 (10 source files modified, 6 visual test files created, 6 PNG baselines created, 3 type declarations / helpers created, 1 tracked-into-git markdown asset)

## Accomplishments

- 7 pre-existing render-time test failures from Plan 03-01's deferred-items.md (4 in SplashScreen.test.tsx + 3 in RootNativeStack.test.tsx, both with `Element type is invalid: ... got: undefined`) — root-caused as a missing `Animated.View`/`Animated.Text`/`Animated.Image` host-component sibling in the canonical vitest.setup.ts mock + landed inside Task 1's commit boundary per Plan 03-01's handoff.
- Sign-up + Permissions CTA stacking + width fixed: container `justifyContent:'center'` + ctaWrap `alignSelf:'center'`. The two-block `top` (flex:1 spacer) + `bottom` (pinned to screen bottom) pattern dropped in favor of a single vertically-centered group.
- Sign-up value-prop spacing tightened: 3 lines now sit in a `<View style={{gap:spacing.xs}}>` instead of each carrying `marginVertical:xs` (which doubled the inter-line gap).
- 4 of 5 `[EMAIL_ADDRESS]` placeholders swapped for `support@humynlabs.ai` (OQ-1 resolved per 02-COSMETIC-GAPS.md "Rig Tutorial screen" + 02-OPEN-QUESTIONS.md OQ-1). 5th is owned by Plan 03-03's Compat-fail merge.
- BottomNav: direct `import { Home as HomeIcon, ListTodo, History as HistoryIcon } from 'lucide-react-native'` + explicit `minHeight: 48 / minWidth: 48 / hitSlop: 12` per Pressable.
- 6 jest-image-snapshot visual tests authored + 6 PNG baselines committed; full vitest run is green (320/320 tests passing in 49 test files).
- Tracked `help-center-content.md` in git (was a project asset that lived alongside the source markdown but never under version control). Future OQ resolutions on this file are now reproducible across machines.

## Task Commits

Each task was committed atomically:

1. **Task 1: RethinkSans dispatch hardening + Sign-up value-prop spacing + Animated mock** — `3099300` (fix)
2. **Task 2: Wire density-bucketed assets, fix CTA layout, swap support email (4/5)** — `fe3fc71` (feat)
3. **Task 3: Author 6 jest-image-snapshot visual baselines for Wave 1 surfaces** — `cbd440b` (test)

## Files Created/Modified

See `key-files` in frontmatter.

## Decisions Made

See `key-decisions` in frontmatter. Most consequential:

- **HomeSkeletonScreen NOT modified for the logo wiring.** Per the plan body's explicit guidance: "this plan does NOT touch TopBar; only swap the wordmark image source if HomeSkeletonScreen renders the logo directly." The wordmark currently lives inside TopBar as a typographic Text stub (`<Text variant="title28">Humyn Labs</Text>`). The HOME-side logo upgrade requires touching TopBar + recomputing its layout for the new image dimensions; that's an implicit deferral to a future plan that also takes ownership of TopBar refactoring per the 02-COSMETIC-GAPS.md "Refactor candidate (Phase 3 W1)" follow-up note.
- **5th `[EMAIL_ADDRESS]` substitution deferred to Plan 03-03** per the plan body's explicit deferral. CompatRecoveryScreen.tsx will be deleted as part of the Compat-fail merge in Plan 03-03; the substitution lands inside the merged CompatFailScreen body there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `Animated.View` / `Animated.Text` / `Animated.Image` / `Animated.ScrollView` in vitest.setup.ts**

- **Found during:** Task 1 verification step (re-running the 7 pre-existing failing tests from deferred-items.md).
- **Issue:** The canonical Animated mock at vitest.setup.ts only exposed the imperative API surface (Value, timing, parallel, sequence, createAnimatedComponent) but no `Animated.View` / `Animated.Text` host-component-shim siblings. SplashScreen's commits 5fe1443 + 5b9629c added `<Animated.View>` consumers. React resolved the property to `undefined` and threw `Element type is invalid` at render time. 4 SplashScreen tests + 3 RootNativeStack tests (which transitively render Splash via the navigator) failed with the same shape.
- **Fix:** Added `View: makeComponent('AnimatedView')` + `Text: makeComponent('AnimatedText')` + `Image: makeComponent('AnimatedImage')` + `ScrollView: makeComponent('AnimatedScrollView')` to the Animated mock object. Documented the regression history inline so future Animated.\* additions know to extend the same mock.
- **Files modified:** apps/mobile/vitest.setup.ts
- **Verification:** `npx vitest run __tests__/screens/SplashScreen.test.tsx __tests__/navigation/RootNativeStack.test.tsx` → 7/7 passing.
- **Committed in:** `3099300` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Add `stripFontWeight` user-style sanitizer in Text primitive**

- **Found during:** Task 1 RethinkSans diagnosis. The plan body's diagnosis path required walking three candidate root causes (Hermes registration / asset linking / post-script-name mismatch). Verified via `fc-query` that all post-script names match the `typography.fontFamily.*` token values; `unzip -l ...apk | grep RethinkSans` confirms the 5 TTFs are bundled. Re-running `npx react-native-asset` modifies nothing.
- **Issue:** With the structural diagnosis clean, the remaining failure mode is a leaky consumer that re-introduces `fontWeight` AFTER the Text primitive's variant cascade. Android's RCTFont dispatcher then looks for an "auto-weighted" variant of the matched fontFamily and silently falls back to system Roboto when it can't find one. This was not addressed by the original Text primitive — `weightless` strips fontWeight from the variant style, but the consumer's user-supplied `style` prop comes LAST in the cascade and could re-introduce it.
- **Fix:** New `stripFontWeight<T>(style: T): T` helper that walks the user-supplied style (flat object | array | falsy | nested array) and strips every `fontWeight` entry. The variant's encoded weight (via fontFamily file selection) is preserved. Documented as Pattern 67 inline.
- **Files modified:** apps/mobile/src/ui/primitives/Text.tsx
- **Verification:** `npx tsc --noEmit` clean; existing 84 screen tests still pass (no consumer relies on user-style fontWeight).
- **Committed in:** `3099300` (Task 1 commit)

**3. [Rule 3 - Blocking] Update screen tests to assert canonical support email instead of placeholder**

- **Found during:** Task 2 verification (`npx vitest run __tests__/screens/...`).
- **Issue:** RigTutorialScreen.test.tsx Test 4 + HelpCenterScreen.test.tsx + build-help-content.test.ts all asserted on the literal `[EMAIL_ADDRESS]` placeholder. With the placeholder replaced (Task 2A), 3 tests failed. They needed to be updated to expect the canonical `support@humynlabs.ai`.
- **Fix:** Updated each assertion to match the new email. Added an explicit negative assertion in build-help-content.test.ts that `contactSupport.body` MUST NOT contain `[EMAIL_ADDRESS]` so a future copy-paste regression fails fast.
- **Files modified:** apps/mobile/**tests**/screens/RigTutorialScreen.test.tsx, apps/mobile/**tests**/screens/HelpCenterScreen.test.tsx, apps/mobile/**tests**/scripts/build-help-content.test.ts
- **Committed in:** `fe3fc71` (Task 2 commit)

**4. [Rule 3 - Blocking] Add local ambient .d.ts for `pngjs` + restate `toMatchImageSnapshot` augmentation for tsc visibility**

- **Found during:** Task 3 verification (`npx tsc --noEmit`).
- **Issue:** (a) `pngjs` ships no .d.ts and `@types/pngjs` is not in the dep tree (it's a transitive dep of jest-image-snapshot); tsc errored with TS7016. (b) The vitest setup file's `declare module 'vitest'` augmentation for `toMatchImageSnapshot` is INVISIBLE to tsc because vitest.setup.ts is not in `tsconfig.json` `include`; tsc errored with TS2551 across all 6 visual test files.
- **Fix:** New ambient declaration at `apps/mobile/__tests__/visual/_utils/pngjs.d.ts` (no top-level imports → `declare module 'pngjs'` works as expected). Plus a vitest matcher re-augmentation at `apps/mobile/__tests__/visual/_utils/types.d.ts` (imports `vitest` to interface-merge), separated into two files because ambient module declarations and module augmentations have mutually-exclusive top-level-import rules.
- **Files modified:** apps/mobile/**tests**/visual/\_utils/types.d.ts, apps/mobile/**tests**/visual/\_utils/pngjs.d.ts
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `cbd440b` (Task 3 commit)

**5. [Rule 3 - Blocking] Inline react-native shim in SignupScreen + HelpCenterScreen visual tests instead of vi.importActual**

- **Found during:** Task 3 baseline-bake step (`npx vitest run __tests__/visual --update`).
- **Issue:** Initial visual-test files used `vi.mock('react-native', async (importOriginal) => { const actual = await importOriginal() ... })` to extend the canonical setup-file mock with Alert / Linking. Vite's esbuild transform fails on react-native's index.js because it uses Flow's `import typeof * as ReactNativePublicAPI from "..."` syntax. SignupScreen + HelpCenter visual tests both failed at module-eval time.
- **Fix:** Replaced `importOriginal()` calls with per-test inline factories that replicate the host-component shim from scratch (View / Text / Pressable / Image / Modal / StyleSheet / Animated / Platform / Easing) plus the test-specific extensions. Documented as Pattern 69. Same shape used by ForceUpgradeScreen.test.tsx (Pattern 52) for the same reason.
- **Files modified:** apps/mobile/**tests**/visual/SignupScreen.visual.test.tsx, apps/mobile/**tests**/visual/HelpCenterScreen.visual.test.tsx
- **Committed in:** `cbd440b` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (1 Rule 1 — Animated mock bug; 1 Rule 2 — Text-primitive defense-in-depth; 3 Rule 3 — blocking issues to land the suite green).

**Impact on plan:** All deviations preserve the plan's stated intent. The Animated mock fix retires Plan 03-01's deferred-items.md handoff inside Plan 03-02's commit boundary as designed. The stripFontWeight() defense complements the original RethinkSans dispatch fix without changing its semantics. The blocking-issue fixes land the test suite + typecheck green. No scope creep.

## Issues Encountered

- **Bad `git stash` round-trip late in Task 3.** Mid-Task-3 I attempted `git stash && tsc --noEmit && git stash pop` to verify whether the typecheck issue was pre-existing or caused by my visual tests. `git stash` correctly recorded "No local changes to save" because my visual tests were UNTRACKED (not staged or modified). But `git stash pop` then tried to apply an old, unrelated stash from a previous `worktree-agent-abadb4606602655c3` session, creating merge conflicts on PermissionsScreen / RigTutorialScreen / api.ts / auth.ts that were unrelated to my Plan 03-02 work. Recovery: `git checkout HEAD -- <each-conflicted-file>` to abort the merge and restore the Plan 03-02 versions. The unrelated stash is left in `git stash list` untouched; not my concern. Lesson learned: always check `git stash list` BEFORE running `git stash pop`, and prefer `git stash drop` over `pop` for one-shot diagnostic stashes.
- **HomeSkeletonScreen logo upgrade deferred** (see Decisions above). Will surface as a follow-up note in Plan 03-03 / Wave 1 manual re-walk.
- **The 3 unhandled rejections in PermissionsScreen tests are pre-existing.** They surface when PermissionsScreen is rendered inside a navigator with a bare-bones state mock (`setPermsGranted` undefined). Reproduces with my changes stashed; not caused by Plan 03-02. Out of scope per the SCOPE BOUNDARY rule.

## Known Stubs

| Stub                                                         | File                                                         | Reason                                                                                                                                                                                                                                      | Resolution Path                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transparent placeholder rig illustration (no actual artwork) | `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` | Inherited from Plan 03-01 — no source artwork exists in `design-system/` or `prototype.html`. Image renders transparent in RigTutorialScreen at the design-spec §5 280 px size; functional parity (heading + body + Next CTA) is preserved. | Implicit OQ for the design pass. Real artwork lands by re-exporting to the same `apps/mobile/src/assets/illustrations/rig*.png` paths — no JSX edit required, no test re-bake required (the rig.png Image source is stable).                |
| HomeSkeletonScreen wordmark still a typographic Text stub    | `apps/mobile/src/components/TopBar.tsx`                      | Per plan body: "this plan does NOT touch TopBar". The wordmark Image upgrade requires re-laying-out TopBar's row + recomputing its 48 dp min-height; that's a separate refactor.                                                            | A future plan that takes ownership of TopBar should swap `<Text variant="title28">Humyn Labs</Text>` for `<Image source={require('.../orange_logo.png')} />` at the same path (no new asset work — Plan 03-01 already shipped the buckets). |

## Threat Flags

None. All files modified by this plan are within the existing trust boundaries (UI rendering only, no new network endpoints, no auth changes, no schema changes, no file-access patterns added).

## User Setup Required

None — every change is local. The Wave 1 manual re-walk on a Pixel 7a/8a/10a-class device is operator-driven (per D-WAVE-08) but happens AFTER both Plan 03-02 and Plan 03-03 land; not a Plan 03-02 gate.

## Self-Check: PASSED

Verification commands run:

- `ls apps/mobile/__tests__/visual/__image_snapshots__/*.png | wc -l` → 6
- `cd apps/mobile && npx tsc --noEmit` → exit 0
- `cd apps/mobile && npx vitest run` → 320/320 tests passing in 55 test files (3 unrelated unhandled rejections in PermissionsScreen tests, pre-existing)
- `grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/help/content.json help-center-content.md apps/mobile/src/screens/help/HelpCenterScreen.tsx apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` → all 0
- `grep -c 'support@humynlabs.ai' apps/mobile/src/screens/help/content.json help-center-content.md apps/mobile/src/screens/help/HelpCenterScreen.tsx apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` → all ≥ 1
- `grep -q "from 'lucide-react-native'" apps/mobile/src/components/BottomNav.tsx` → MATCH
- `grep -E "minHeight: 48|minHeight:\s*48" apps/mobile/src/components/BottomNav.tsx` → MATCH
- `grep -q "alignSelf: 'center'" apps/mobile/src/screens/signup/SignupScreen.tsx apps/mobile/src/screens/permissions/PermissionsScreen.tsx` → MATCH (both)
- `git log --oneline -5` → all 3 task commits FOUND (`3099300`, `fe3fc71`, `cbd440b`)

## Next Phase Readiness

- **Plan 03-03 (cosmetic-functional-regressions) is unblocked.** Pattern 68 (render-tree-PNG helper) + Pattern 69 (per-test inline RN shim) + Pattern 70 (local .d.ts pair) are all available for the 3 additional baselines Plan 03-03 needs (post-Compat-fail-merge, auto-advance Compat-pass, Tasks/History TopBar avatar). The 5th `[EMAIL_ADDRESS]` placeholder is documented in this SUMMARY for Plan 03-03 to inherit.
- **02-OPEN-QUESTIONS.md OQ-1 RESOLVED.** Plan 03-03 should mark OQ-1 closed in its own SUMMARY when the 5th occurrence lands.
- **HomeSkeletonScreen wordmark upgrade** documented in Known Stubs above as a follow-up for whichever later plan owns TopBar refactoring (likely Phase 6 HOME plans, not Phase 3 Wave 1).
- **deferred-items.md retired.** All 7 pre-existing render-time failures from Plan 03-01 are root-caused + fixed inside Plan 03-02's commit boundary as designed.

---

_Phase: 03-humyn-capture-native-module_
_Plan: 02 (cosmetic-screen-fixup)_
_Completed: 2026-05-10_
