---
phase: 03-humyn-capture-native-module
plan_id: 03-11
plan: 11
type: execute
wave: 1
depends_on: [03-03]
files_modified:
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/src/components/BottomNav.tsx
  - apps/mobile/src/components/TopBar.tsx
  - apps/mobile/src/screens/compat/CompatFailScreen.tsx
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/assets/illustrations/rig.png
  - apps/mobile/src/assets/illustrations/rig@1x.png
  - apps/mobile/src/assets/illustrations/rig@2x.png
  - apps/mobile/src/assets/illustrations/rig@3x.png
  - apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/__image_snapshots__/
  - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md
requirements: []
autonomous: true
must_haves:
  truths:
    - "(A1) PermissionsScreen idle body copy reads exactly 'Used only while you hit record' (no trailing 'Nothing leaves your phone…' clause); recovery-state body strings unchanged"
    - '(A2) RigTutorial illustration renders real artwork — `rig.png` / `rig@2x.png` / `rig@3x.png` byte size each ≥ 4096 bytes (real PNG threshold; current placeholder is 405–2836 bytes), OR Task 5 deviates with `escalate-to-user` if no source artwork is available in `design-system/illustrations/`'
    - '(A3) BottomNav lifts above the gesture indicator using `useSafeAreaInsets()`; `paddingBottom: insets.bottom + 12` (or equivalent in the same file)'
    - "(A4) TopBar renders the orange wordmark Image — `<Image source={require('../assets/logos/orange_logo.png')} ... />` — and no longer contains the literal 'Humyn Labs' text node; HomeSkeletonScreen, TasksPlaceholderScreen, and HistoryPlaceholderScreen all surface the new wordmark via the shared TopBar"
    - "(A5) CompatFailScreen no longer renders the bullet-list 'What Now' recovery block (3 `recovery-bullet-*` Text nodes deleted); failure list + ≤1 contextual line + Contact Support button remain"
    - "(A6) SplashScreen + SignupScreen logos shrink ~20% — explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` (or aspect-equivalent within ±2 px) lands on both surfaces; preserves 320:73 aspect"
    - 'Visual snapshot baselines refreshed for every modified surface (Permissions, Home, Tasks, History, CompatFail, Splash, Signup) and committed; Vitest visual suite stays green'
    - 'Surgical-stage protocol honored — protected files (SignupScreen.tsx, PermissionsScreen.tsx) staged by name only; `git status` after staging shows zero unrelated tracked-file inclusions'
  artifacts:
    - path: apps/mobile/__tests__/visual/__image_snapshots__/
      provides: refreshed jest-image-snapshot baselines for the 7 surfaces this plan modifies (Splash, Signup, Permissions, Home, Tasks, History, CompatFail)
    - path: apps/mobile/src/components/TopBar.tsx
      provides: post-Plan-03-11 TopBar that ships the orange wordmark Image (no 'Humyn Labs' text node)
      contains: require('../assets/logos/orange_logo
    - path: apps/mobile/src/components/BottomNav.tsx
      provides: post-Plan-03-11 BottomNav lifted above the gesture indicator via useSafeAreaInsets()
      contains: useSafeAreaInsets
  key_links:
    - from: apps/mobile/src/components/TopBar.tsx
      to: apps/mobile/src/assets/logos/orange_logo.png
      via: require('../assets/logos/orange_logo.png')
      pattern: require\(.*assets/logos/orange_logo
    - from: apps/mobile/src/components/BottomNav.tsx
      to: react-native-safe-area-context
      via: useSafeAreaInsets()
      pattern: useSafeAreaInsets\(\)
    - from: apps/mobile/src/screens/compat/CompatFailScreen.tsx
      to: (deleted "What Now" recovery bullets)
      via: file no longer contains `recovery-bullet-` accessibilityLabels
      pattern: recovery-bullet-
---

<objective>
Land the six amendments (A1–A6) surfaced during the 2026-05-10 Pixel 10a re-walk of `03-WAVE1-SMOKE.md`. Per D-WAVE-09, post-Wave-1 amendments go to a new plan that lands BEFORE Wave 2 capture-foundation work begins (D-WAVE-08 acceptance gate).

Purpose: the operator re-walk caught six bounded UX gaps that were not in the frozen `02-COSMETIC-GAPS.md`. Wave 2's `HumynCapture` Kotlin native module work is gated on these amendments landing AND a fresh on-device re-walk on Pixel 10a. Keeping the polish plan separate from Wave 2 honors the "no UI-polish noise mixing in" rule from D-WAVE-09 and matches the precedent set by Plans 03-01 / 03-02 / 03-03 (single-concern Wave 1 plans).

Plan 03-04's `depends_on` was amended to `[03-03, 03-11]` as part of this plan's authoring step so the orchestrator dep-graph honors D-WAVE-08 — Wave 2 entry (Plan 03-04 capture-foundation-muxer-bridge) cannot start until Plan 03-11 lands AND the operator stamps the Pixel 10a re-walk in `03-WAVE1-SMOKE.md`.

Output: 5 modified RN screens (Splash, Signup, Permissions, CompatFail) + 2 modified components (TopBar, BottomNav) + 4 replaced rig illustration PNGs (or escalation deviation entry if source artwork unavailable) + 7 refreshed jest-image-snapshot baselines + amendments doc updated with closure stamps.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md
@.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md
@apps/mobile/src/components/TopBar.tsx
@apps/mobile/src/components/BottomNav.tsx
@apps/mobile/src/screens/permissions/PermissionsScreen.tsx
@apps/mobile/src/screens/compat/CompatFailScreen.tsx
@design-spec.md

<interfaces>
<!-- Asset facts (verified by `file ... orange_logo*.png` 2026-05-10): -->
<!-- - `apps/mobile/src/assets/logos/orange_logo.png`     320 x 73   (intrinsic) -->
<!-- - `apps/mobile/src/assets/logos/orange_logo@2x.png`  640 x 146 -->
<!-- - `apps/mobile/src/assets/logos/orange_logo@3x.png`  960 x 220 -->
<!-- Aspect: 320 / 73 ≈ 4.38 : 1 -->
<!-- Plan 03-02 dropped the explicit width/height on Splash + Signup; the @Nx PNG -->
<!-- intrinsic dimensions are the rendered dimensions today. To shrink ~20% per A6, -->
<!-- ADD an explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` -->
<!-- back onto the Image. (256/58 ≈ 4.41:1 — within ±1% of source aspect.) -->

<!-- Rig illustration current state (placeholders from Plan 03-01): -->
<!-- - `apps/mobile/src/assets/illustrations/rig.png`     405 bytes  (transparent placeholder) -->
<!-- - `apps/mobile/src/assets/illustrations/rig@1x.png`  405 bytes -->
<!-- - `apps/mobile/src/assets/illustrations/rig@2x.png` 1317 bytes -->
<!-- - `apps/mobile/src/assets/illustrations/rig@3x.png` 2836 bytes -->
<!-- Real PNGs at 280/280/560/840 px will be ≥ 4 KB each (line art) up to ~50 KB -->
<!-- (full-color illustration). The 4096-byte threshold cleanly separates real -->
<!-- artwork from the existing transparent placeholders. -->

<!-- TopBar current state (verified 2026-05-10): TopBar.tsx line 67 -->
<!-- renders `<Text variant="title28" tone="primary">Humyn Labs</Text>`. -->
<!-- A4 replaces this Text node with an Image of the orange wordmark. -->
<!-- This is the same component consumed by all three MainTabs tab bodies via -->
<!-- `useTabTopBarProps()` (Pattern 71); a single edit propagates to Home/Tasks/History. -->
<!-- The two grep gates already inside the file (line 16: "Humyn Labs wordmark (grep)" and -->
<!-- line 67: the literal Text node) MUST be updated together — replace the literal -->
<!-- and update the docstring grep gate to reference the require() path instead. -->

<!-- BottomNav current state (verified 2026-05-10): BottomNav.tsx lines 47–58 -->
<!-- declare `paddingBottom: 10` as a flat 10px against the bottom edge. A3 -->
<!-- replaces this with `useSafeAreaInsets()`-derived padding so the nav row -->
<!-- floats ~12 dp above the gesture indicator (Instagram-style). -->
<!-- `react-native-safe-area-context` is already installed (^5.7.0; verified -->
<!-- via apps/mobile/package.json) and consumed by `ScreenContainer.tsx`. -->

<!-- PermissionsScreen current state (verified 2026-05-10): line 209 declares -->
<!-- `body = 'Used only while you hit record. Nothing leaves your phone until -->
<!--  you stop and we encrypt-upload.';` Strip the second sentence — leave -->
<!-- only `'Used only while you hit record'`. The denied / partial branches -->
<!-- (`'... Open Settings to enable.'`) are unchanged; A1 only touches the idle -->
<!-- branch's body string. -->

<!-- CompatFailScreen current state (verified 2026-05-10): the merged screen -->
<!-- (post-Plan-03-03) renders 3 recovery bullets at lines 68–88 with -->
<!-- accessibilityLabels `recovery-bullet-different-device`, `recovery-bullet-not-rooted`, -->
<!-- `recovery-bullet-rerun`, plus the `recoveryBody` Text at line 63. A5 deletes -->
<!-- the entire <View style={styles.bullets}> block (the 3 bullets) and tightens -->
<!-- the `recoveryBody` to ≤ 1 sentence. Keep the failure list + Contact Support -->
<!-- button. Also drop the `bullets` and `bullet` style entries from styles since -->
<!-- they're orphaned. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Permissions copy (A1) + BottomNav lift (A3)</name>
  <files>apps/mobile/src/screens/permissions/PermissionsScreen.tsx, apps/mobile/src/components/BottomNav.tsx, apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/permissions/PermissionsScreen.tsx (PROTECTED FILE — surgical-stage; line 209 `body = 'Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload.';` is the literal to edit)
    - apps/mobile/src/components/BottomNav.tsx (lines 47–58 — current `paddingBottom: 10` declaration)
    - apps/mobile/src/ui/primitives/ScreenContainer.tsx (lines 12 + 35 — existing `useSafeAreaInsets()` consumer; pattern reference for the BottomNav edit)
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (A1 + A3 sections)
    - design-spec.md §3 (Permissions copy) + §6 (BottomNav structural spec)
    - apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx (existing visual baseline test — no edit, baseline PNG only refreshes via `--update`)
  </read_first>
  <action>
    **1A — A1 Permissions copy (PROTECTED FILE — `git add` by name only):**

      In `apps/mobile/src/screens/permissions/PermissionsScreen.tsx`, locate line 208–210:

      ```tsx
      } else {
        body =
          'Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload.';
      }
      ```

      Replace the body string with `'Used only while you hit record'` (no period, no second sentence — verbatim per A1):

      ```tsx
      } else {
        body = 'Used only while you hit record';
      }
      ```

      Do NOT touch the `partial` or `denied` branches above (lines 202–207); their copy stays unchanged. Do NOT touch `permissions title` or any other Text node.

      Update the `accessibilityLabel="permissions body"` Text node — no change needed (the body prop is read from `body`).

      Update the existing screen test at `apps/mobile/__tests__/screens/PermissionsScreen.test.tsx` IF it asserts against the literal `Nothing leaves your phone` substring — search with `grep -n "Nothing leaves" apps/mobile/__tests__/screens/PermissionsScreen.test.tsx`; if it matches, replace the assertion with `expect(getByLabelText('permissions body')).toHaveTextContent('Used only while you hit record')` and DROP the trailing-clause assertion. If grep returns nothing, no test edit needed.

      **Surgical-stage protocol:** stage the file by name with `git add apps/mobile/src/screens/permissions/PermissionsScreen.tsx` — NEVER `git add -A`. Inspect with `git diff --staged apps/mobile/src/screens/permissions/PermissionsScreen.tsx` before committing.

    **1B — A3 BottomNav lift (component file — no protected-file collision):**

      In `apps/mobile/src/components/BottomNav.tsx`:

      1. Add the import at the top of the file (after the existing `lucide-react-native` import block, before the local primitives imports):
         ```tsx
         import { useSafeAreaInsets } from 'react-native-safe-area-context';
         ```
      2. Inside the `BottomNav` function body, add as the first line:
         ```tsx
         const insets = useSafeAreaInsets();
         ```
      3. Replace the existing `paddingBottom: 10` (line 49) inside the outer `<View>` style with:
         ```tsx
         paddingBottom: insets.bottom + 12,
         ```
         Keep `paddingTop: spacing.m`, `flexDirection: 'row'`, etc. unchanged. Bump the `height: 68` to `height: 68 + insets.bottom` so the row visually sits where the design intends and the nav doesn't compress when the inset is non-zero — concretely:
         ```tsx
         height: 68 + insets.bottom,
         paddingBottom: insets.bottom + 12,
         ```
         Per A3: lift ~8–12 dp; the `+ 12` constant lands at the upper end (most legible against the gesture indicator). Document this with a Plan 03-11 comment block above the style declaration referencing A3.

      **Vitest mock for `react-native-safe-area-context` is already in place.** The vitest mock for `react-native-safe-area-context` exists at `apps/mobile/vitest.setup.ts` lines 332–339 (verified 2026-05-10). The mock returns `{ top: 0, bottom: 0, left: 0, right: 0 }`, so BottomNav under test renders `paddingBottom: 0 + 12 = 12` and `height: 68 + 0 = 68` — pre-edit behavior preserved on jsdom. **No mock change required.** Verify the mock is still present:
      ```
      grep -n "useSafeAreaInsets" apps/mobile/vitest.setup.ts
      ```
      Expected: a hit between lines 320–350.

    **1C — Refresh PermissionsScreen visual baseline:**

      Run `cd apps/mobile && npm test -- --run __tests__/visual/PermissionsScreen.visual.test.tsx --update` to refresh the existing baseline. Inspect the new PNG (open in Preview / `qlmanage -p`) — verify the body copy now reads "Used only while you hit record" and is the only sentence. Commit the refreshed baseline.

      Note: PermissionsScreen does NOT consume BottomNav (it's a pre-tab onboarding screen), so the A3 lift does not affect this baseline.

    **ORDER MATTERS:** do NOT run the <verify> command until AFTER the
    `npm test -- --run __tests__/visual/PermissionsScreen.visual.test.tsx --update`
    baseline refresh has completed AND you have manually inspected the
    new PNG (the one that landed in
    `apps/mobile/__tests__/visual/__image_snapshots__/`). The verify
    command runs WITHOUT `--update` and will fail against a stale
    pre-edit baseline. Stage the refreshed baseline file before running
    the verify gate.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && grep -q "Used only while you hit record$\|Used only while you hit record';" src/screens/permissions/PermissionsScreen.tsx && ! grep -q "Nothing leaves your phone" src/screens/permissions/PermissionsScreen.tsx && grep -q "useSafeAreaInsets" src/components/BottomNav.tsx && grep -q "insets.bottom" src/components/BottomNav.tsx && npx tsc --noEmit && npm test -- --run __tests__/screens/PermissionsScreen.test.tsx __tests__/visual/PermissionsScreen.visual.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Used only while you hit record" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` returns ≥ 1
    - `grep -c "Nothing leaves your phone" apps/mobile/src/screens/permissions/PermissionsScreen.tsx` returns 0
    - `grep -q "useSafeAreaInsets" apps/mobile/src/components/BottomNav.tsx` matches
    - `grep -E "paddingBottom:\s*insets\.bottom\s*\+\s*12" apps/mobile/src/components/BottomNav.tsx` matches
    - `grep -E "height:\s*68\s*\+\s*insets\.bottom" apps/mobile/src/components/BottomNav.tsx` matches
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/screens/PermissionsScreen.test.tsx` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/visual/PermissionsScreen.visual.test.tsx` exits 0 (baseline refreshed and committed)
    - `git status --short` after staging shows ONLY the 3 files this task owns staged (PermissionsScreen.tsx, BottomNav.tsx, the refreshed PNG baseline) — no collateral file inclusions per surgical-stage protocol
  </acceptance_criteria>
  <done>A1 + A3 land surgically; PermissionsScreen visual baseline refreshed; surgical-stage protocol honored on the protected PermissionsScreen.tsx.</done>
</task>

<task type="auto">
  <name>Task 2: TopBar orange wordmark on Home/Tasks/History (A4)</name>
  <files>apps/mobile/src/components/TopBar.tsx, apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx, apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx, apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx</files>
  <read_first>
    - apps/mobile/src/components/TopBar.tsx (lines 1–108 — full file; the literal `<Text variant="title28">Humyn Labs</Text>` at line 65–69 is the edit site; lines 1–20 docstring grep gates need updating in lockstep)
    - apps/mobile/src/assets/logos/orange_logo.png (intrinsic 320×73; verified `file` 2026-05-10)
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (consumer — no change; Pattern 71 hook-spread reaches TopBar through `useTabTopBarProps`)
    - apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx (consumer — no change)
    - apps/mobile/src/screens/history/HistoryPlaceholderScreen.tsx (consumer — no change)
    - apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx (existing baseline; refreshes via --update)
    - apps/mobile/__tests__/visual/TasksPlaceholderScreen.visual.test.tsx (existing baseline)
    - apps/mobile/__tests__/visual/HistoryPlaceholderScreen.visual.test.tsx (existing baseline)
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (A4 section)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md (Pattern 71 — useTabTopBarProps consumer chain)
    - design-spec.md §0.5 + §5.6 + §15 (TopBar wordmark spec)
  </read_first>
  <action>
    **A4 single-component edit propagates to all three tabs via Pattern 71.**

    In `apps/mobile/src/components/TopBar.tsx`:

      1. Update the import block to bring in `Image` already (it's imported — line 23 confirms `import { Image, View, ... } from 'react-native'`). No new import.
      2. Locate the existing `<View accessibilityLabel="top-bar-logo">` block at lines 65–69:
         ```tsx
         <View accessibilityLabel="top-bar-logo">
           <Text variant="title28" tone="primary">
             Humyn Labs
           </Text>
         </View>
         ```
         Replace with:
         ```tsx
         <View accessibilityLabel="top-bar-logo">
           <Image
             source={require('../assets/logos/orange_logo.png')}
             accessibilityLabel="Humyn Labs Capture wordmark"
             accessibilityIgnoresInvertColors
             style={{ height: 28, width: undefined, aspectRatio: 320 / 73, resizeMode: 'contain' }}
           />
         </View>
         ```
         Why these dimensions: design-spec §0.5 specifies TopBar minHeight 48 dp; the wordmark sits inside with vertical breathing. 28 dp tall × (320/73) ≈ 122.7 dp wide preserves the 320:73 source aspect exactly. The `width: undefined` + `aspectRatio` pattern is the canonical RN idiom for height-bound aspect-preserving Image.
      3. Drop the now-unused `Text` import IF and only IF `Text` is no longer referenced anywhere else in `TopBar.tsx` — after the edit, `Text` is still consumed by the `title` branch (line 71) and the avatarInitial fallback (line 99), so the import stays. Verify with `grep -c "<Text" apps/mobile/src/components/TopBar.tsx` returns ≥ 2 after the edit.
      4. Update the docstring grep gates at lines 1–20:
         - Line 3: `// 48 px min-height. "Humyn Labs" wordmark on the left. 36 px circular avatar` → change to `// 48 px min-height. Orange wordmark Image (Plan 03-11 / A4) on the left. 36 px circular avatar`
         - Line 16: `//   - "Humyn Labs"        wordmark (grep)` → change to `//   - require('../assets/logos/orange_logo  wordmark Image source path (grep)`
         - Add a Plan 03-11 callout above the docstring's `Acceptance gates` line:
           ```
           // Plan 03-11 (A4) — TopBar wordmark promoted from the Phase 2 Text stub
           // ("Humyn Labs") to the orange wordmark Image. Single-component edit
           // propagates to Home + Tasks + History via Pattern 71's
           // useTabTopBarProps() consumer chain.
           ```

    **Visual baseline refresh — 3 surfaces:**

      Run `cd apps/mobile && npm test -- --run __tests__/visual/HomeSkeletonScreen.visual.test.tsx __tests__/visual/TasksPlaceholderScreen.visual.test.tsx __tests__/visual/HistoryPlaceholderScreen.visual.test.tsx --update`. Three baselines refresh.

      Manually inspect each PNG before committing:
        - HomeSkeletonScreen — orange wordmark visible top-left, NOT "Humyn Labs" Text.
        - TasksPlaceholderScreen — same.
        - HistoryPlaceholderScreen — same.

      If any baseline still shows the text stub, the require() path is wrong or the Pattern 68 wireframe encoder doesn't recognize the asset — investigate by running `cd apps/mobile && grep -rn "top-bar-logo" __tests__/visual/_utils/` and checking how the renderToImage helper hashes Image vs Text nodes. The DOM tree shape changed (Text → Image inside the same parent View) so the wireframe rectangle hash WILL differ — that's the expected baseline diff.

      Commit refreshed baselines.

    **NO HumynCapture / Camera2 / MediaCodec / native-module work in this task** — A4 is a pure JSX edit on a shared component.

    **ORDER MATTERS:** do NOT run the <verify> command until AFTER the
    `npm test -- --run __tests__/visual/HomeSkeletonScreen.visual.test.tsx __tests__/visual/TasksPlaceholderScreen.visual.test.tsx __tests__/visual/HistoryPlaceholderScreen.visual.test.tsx --update`
    baseline refresh has completed AND you have manually inspected the
    new PNGs (the ones that landed in
    `apps/mobile/__tests__/visual/__image_snapshots__/`). The verify
    command runs WITHOUT `--update` and will fail against stale
    pre-edit baselines. Stage the refreshed baseline files before running
    the verify gate.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && ! grep -E ">\s*Humyn Labs\s*<" src/components/TopBar.tsx && [ "$(grep -c 'Humyn Labs' src/components/TopBar.tsx)" -le 1 ] && grep -q "require('.*assets/logos/orange_logo" src/components/TopBar.tsx && grep -q "aspectRatio: 320 / 73" src/components/TopBar.tsx && npx tsc --noEmit && npm test -- --run __tests__/screens/HomeSkeletonScreen.test.tsx __tests__/screens/TasksPlaceholderScreen.test.tsx __tests__/screens/HistoryPlaceholderScreen.test.tsx __tests__/visual/HomeSkeletonScreen.visual.test.tsx __tests__/visual/TasksPlaceholderScreen.visual.test.tsx __tests__/visual/HistoryPlaceholderScreen.visual.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -E ">\s*Humyn Labs\s*<" apps/mobile/src/components/TopBar.tsx` (no Text-content "Humyn Labs" inside any JSX element — JSX-shape-independent positive shape gate)
    - `grep -c "Humyn Labs" apps/mobile/src/components/TopBar.tsx` returns ≤ 1 (allows up to 1 docstring/comment mention; 0 is also fine)
    - `grep -q "require('.*assets/logos/orange_logo" apps/mobile/src/components/TopBar.tsx` matches
    - `grep -q "aspectRatio: 320 / 73" apps/mobile/src/components/TopBar.tsx` matches
    - `grep -q "accessibilityLabel=\"Humyn Labs Capture wordmark\"" apps/mobile/src/components/TopBar.tsx` matches
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/screens/HomeSkeletonScreen.test.tsx __tests__/screens/TasksPlaceholderScreen.test.tsx __tests__/screens/HistoryPlaceholderScreen.test.tsx` exits 0
    - 3 visual snapshot tests pass after `--update`: HomeSkeletonScreen, TasksPlaceholderScreen, HistoryPlaceholderScreen
    - 3 PNG baselines under `apps/mobile/__tests__/visual/__image_snapshots__/` are updated (file mtime ≥ task-start time) and committed
  </acceptance_criteria>
  <done>TopBar ships the orange wordmark Image; Home + Tasks + History TopBars all render the new wordmark via Pattern 71's consumer chain; 3 visual baselines refreshed.</done>
</task>

<task type="auto">
  <name>Task 3: CompatFail "What Now" recovery bullets removal (A5)</name>
  <files>apps/mobile/src/screens/compat/CompatFailScreen.tsx, apps/mobile/__tests__/screens/CompatFailScreen.test.tsx, apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/compat/CompatFailScreen.tsx (lines 60–88 — `recoveryBody` + 3 `recovery-bullet-*` Text nodes; lines 178–179 — `bullets` + `bullet` styles to drop)
    - apps/mobile/__tests__/screens/CompatFailScreen.test.tsx (existing tests assert against `recovery-bullet-different-device`, `recovery-bullet-not-rooted`, `recovery-bullet-rerun` accessibilityLabels — these tests will need to be removed or refactored)
    - apps/mobile/__tests__/visual/CompatFailScreen.visual.test.tsx (existing baseline; refreshes via --update)
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (A5 section — "Drop the entire 'What Now' block; keep only failure list + ≤1 contextual line + Contact Support")
    - design-spec.md §4d (CompatFail layout spec)
  </read_first>
  <action>
    **A5 — strip the bullet-list recovery block; keep ≤1 contextual line + Contact Support CTA.**

    In `apps/mobile/src/screens/compat/CompatFailScreen.tsx`:

      1. **Tighten `recoveryBody` text (lines 63–66) to ≤ 1 sentence.** Replace:
         ```tsx
         <Text variant="body" tone="secondary" style={styles.recoveryBody}>
           This phone doesn&apos;t meet the recording requirements. Try a different qualifying
           device, or reach out to support — share your phone model and roughly when this happened.
         </Text>
         ```
         with:
         ```tsx
         <Text variant="body" tone="secondary" style={styles.recoveryBody}>
           This phone doesn&apos;t meet the recording requirements.
         </Text>
         ```
         (single sentence — failure list above already itemizes WHAT failed; bullets below were filler.)
      2. **Delete the entire `<View style={styles.bullets}>` block (lines 68–88)** — all three `<Text accessibilityLabel="recovery-bullet-*">` nodes plus the wrapping View.
      3. **Drop orphaned styles** at lines 178–179:
         ```ts
         bullets: { width: '100%', marginBottom: spacing.xxxl },
         bullet: { marginBottom: spacing.ms },
         ```
         Remove both entries from the `styles` object. The remaining `recoveryBody` style stays (still used by the now-shorter Text).
      4. **Update the file docstring header (lines 1–22)** — Plan 03-11 / A5 callout:
         ```
         * Plan 03-11 (A5) — "What Now" recovery bullets dropped per Pixel 10a
         * re-walk amendment. Screen now renders: failure list + 1-sentence
         * contextual line + Contact Support CTA. The 3 recovery bullets felt
         * like filler between the failure reason and the action.
         ```
      5. **NO change** to the `failureLines()` helper, the failure list rendering, or the `Contact Support` button.

    **Update screen tests at `apps/mobile/__tests__/screens/CompatFailScreen.test.tsx`:**

      Search with `grep -n "recovery-bullet-" apps/mobile/__tests__/screens/CompatFailScreen.test.tsx`. For each matching test:
        - If the test asserts the bullet renders → DELETE the test (`it(...)` block).
        - If the test references the bullet accessibilityLabel as a setup-only `getByLabelText` → drop that line; the assertion that survives is for the failure list / mailto / etc.

      Keep tests for: failure list rendering, `support@humynlabs.ai` mailto, Contact Support button presence, post-merge centered layout.

      Add ONE new test asserting the bullets are GONE (regression guard):
        ```tsx
        it('Plan 03-11 / A5 — does NOT render the legacy "What Now" recovery bullets', () => {
          const { queryByLabelText } = render(<CompatFailScreen />);
          expect(queryByLabelText('recovery-bullet-different-device')).toBeNull();
          expect(queryByLabelText('recovery-bullet-not-rooted')).toBeNull();
          expect(queryByLabelText('recovery-bullet-rerun')).toBeNull();
        });
        ```

    **Refresh visual baseline:**

      Run `cd apps/mobile && npm test -- --run __tests__/visual/CompatFailScreen.visual.test.tsx --update`. Inspect the refreshed baseline — confirm 3 bullet rectangles are gone from the wireframe; failure list + 1-line recovery body + Contact Support button remain. Commit baseline.

    **ORDER MATTERS:** do NOT run the <verify> command until AFTER the
    `npm test -- --run __tests__/visual/CompatFailScreen.visual.test.tsx --update`
    baseline refresh has completed AND you have manually inspected the
    new PNG (the one that landed in
    `apps/mobile/__tests__/visual/__image_snapshots__/`). The verify
    command runs WITHOUT `--update` and will fail against a stale
    pre-edit baseline. Stage the refreshed baseline file before running
    the verify gate.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && ! grep -q "recovery-bullet-" src/screens/compat/CompatFailScreen.tsx && ! grep -q "styles.bullets\b" src/screens/compat/CompatFailScreen.tsx && grep -q "support@humynlabs.ai" src/screens/compat/CompatFailScreen.tsx && grep -q "compat-fail-contact-support" src/screens/compat/CompatFailScreen.tsx && npx tsc --noEmit && npm test -- --run __tests__/screens/CompatFailScreen.test.tsx __tests__/visual/CompatFailScreen.visual.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "recovery-bullet-" apps/mobile/src/screens/compat/CompatFailScreen.tsx` returns 0
    - `grep -c "styles.bullets\b\|styles.bullet\b" apps/mobile/src/screens/compat/CompatFailScreen.tsx` returns 0
    - `grep -q "support@humynlabs.ai" apps/mobile/src/screens/compat/CompatFailScreen.tsx` matches (Plan 03-03 invariant preserved)
    - `grep -q "compat-fail-contact-support" apps/mobile/src/screens/compat/CompatFailScreen.tsx` matches (Contact Support button preserved)
    - `grep -c "Try a different phone\|Make sure the device is not rooted\|If you&apos;ve changed phones" apps/mobile/src/screens/compat/CompatFailScreen.tsx` returns 0 (bullet copy gone)
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/screens/CompatFailScreen.test.tsx __tests__/visual/CompatFailScreen.visual.test.tsx` exits 0
    - CompatFail visual baseline PNG mtime ≥ task-start time and committed
  </acceptance_criteria>
  <done>CompatFail bullet-list recovery block removed; 1-sentence contextual line + Contact Support CTA remain; visual baseline refreshed.</done>
</task>

<task type="auto">
  <name>Task 4: Splash + Sign-up logo shrink ~20% (A6)</name>
  <files>apps/mobile/src/screens/splash/SplashScreen.tsx, apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx, apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/splash/SplashScreen.tsx (lines 162–207 — current Image at line 182 has NO explicit style; intrinsic dimensions render today)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (PROTECTED FILE — surgical-stage; lines 123–135 — current Image at line 130 has NO explicit style; lines 259–262 — `logoWell` style is alignItems-only)
    - apps/mobile/src/assets/logos/orange_logo.png (intrinsic 320×73 verified `file` 2026-05-10)
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (A6 section — target ~248×72 or aspect-equivalent)
    - apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx + SignupScreen.visual.test.tsx (existing baselines; refresh via --update)
    - design-spec.md §1 (Splash) + §2 (Sign-up) — logo placement spec
  </read_first>
  <action>
    **A6 — Shrink Splash + Sign-up logos ~20% via explicit style on the Image.**

    Source aspect: 320 × 73 = 4.38:1. Target dimensions: 256 × 58 (4.41:1 — within ±1% of source aspect, ~20% smaller than the @1x intrinsic 320×73 dp render). The 256×58 target reads cleanly as integer dp values and avoids fractional pixel rounding.

    **4A — `apps/mobile/src/screens/splash/SplashScreen.tsx` (lines 182–186):**

      Replace:
      ```tsx
      <Image
        source={ORANGE_LOGO}
        accessibilityLabel="Humyn Labs Capture wordmark"
        accessibilityIgnoresInvertColors
      />
      ```
      with:
      ```tsx
      {/* Plan 03-11 (A6) — explicit shrunk dimensions per Pixel 10a re-walk
          amendment. Aspect-preserving: 256/58 ≈ 4.41:1 vs source 320/73 ≈ 4.38:1
          (within ±1%). resizeMode 'contain' guards against pixel rounding. */}
      <Image
        source={ORANGE_LOGO}
        accessibilityLabel="Humyn Labs Capture wordmark"
        accessibilityIgnoresInvertColors
        style={{ width: 256, height: 58, resizeMode: 'contain' }}
      />
      ```

      Update the docstring/comment block at lines 175–181 (which still claims the asset's intrinsic dimensions are the rendered dimensions) — replace the Plan 03-02 narrative with:
      ```
      // Plan 03-11 (A6) — explicit 256×58 dp render, ~20% smaller than the
      // Plan 03-02 intrinsic-only render. The @Nx PNG buckets still let Metro
      // pick the right resolution per device DPI; the explicit width/height +
      // resizeMode 'contain' bound the visual size deterministically.
      ```

    **4B — `apps/mobile/src/screens/signup/SignupScreen.tsx` (lines 130–134) — PROTECTED FILE:**

      Same edit shape:
      ```tsx
      {/* Plan 03-11 (A6) — explicit shrunk dimensions per Pixel 10a re-walk
          amendment. Sign-up logo no longer dominates the top of the screen. */}
      <Image
        source={ORANGE_LOGO}
        accessibilityLabel="Humyn Labs Capture wordmark"
        accessibilityIgnoresInvertColors
        style={{ width: 256, height: 58, resizeMode: 'contain' }}
      />
      ```

      **Surgical-stage protocol:** stage by name with `git add apps/mobile/src/screens/signup/SignupScreen.tsx`. Inspect with `git diff --staged apps/mobile/src/screens/signup/SignupScreen.tsx`. NEVER `git add -A`. If any unrelated tracked-file changes are in the working tree, use `git add -p` and stage only the Image style hunk.

      No `styles` object change needed — the existing `logoWell` style stays.

    **4C — Refresh visual baselines:**

      Run `cd apps/mobile && npm test -- --run __tests__/visual/SplashScreen.visual.test.tsx __tests__/visual/SignupScreen.visual.test.tsx --update`.

      Inspect both refreshed PNGs:
        - Splash: orange wordmark visible at the centered position; ~20% smaller relative to the prior baseline. Tagline `Real Humyns. Real Intelligence.` still visible below.
        - Sign-up: orange wordmark at top of screen; smaller relative to prior; value-props + CTA + consent block still rendered correctly.

      Commit refreshed baselines.

    **Animation note:** SplashScreen has a 700 ms scalePop + 600 ms fade animation. The `Animated.View` wraps the `<Image>`; the explicit Image style does NOT interact with the parent's transform. The animation behavior is preserved.

    **ORDER MATTERS:** do NOT run the <verify> command until AFTER the
    `npm test -- --run __tests__/visual/SplashScreen.visual.test.tsx __tests__/visual/SignupScreen.visual.test.tsx --update`
    baseline refresh has completed AND you have manually inspected the
    new PNGs (the ones that landed in
    `apps/mobile/__tests__/visual/__image_snapshots__/`). The verify
    command runs WITHOUT `--update` and will fail against stale
    pre-edit baselines. Stage the refreshed baseline files before running
    the verify gate.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && grep -q "width: 256, height: 58" src/screens/splash/SplashScreen.tsx && grep -q "width: 256, height: 58" src/screens/signup/SignupScreen.tsx && grep -q "resizeMode: 'contain'" src/screens/splash/SplashScreen.tsx && grep -q "resizeMode: 'contain'" src/screens/signup/SignupScreen.tsx && npx tsc --noEmit && npm test -- --run __tests__/screens/SplashScreen.test.tsx __tests__/screens/SignupScreen.test.tsx __tests__/visual/SplashScreen.visual.test.tsx __tests__/visual/SignupScreen.visual.test.tsx --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "width:\s*256,\s*height:\s*58" apps/mobile/src/screens/splash/SplashScreen.tsx` matches
    - `grep -E "width:\s*256,\s*height:\s*58" apps/mobile/src/screens/signup/SignupScreen.tsx` matches
    - `grep -q "resizeMode: 'contain'" apps/mobile/src/screens/splash/SplashScreen.tsx` matches
    - `grep -q "resizeMode: 'contain'" apps/mobile/src/screens/signup/SignupScreen.tsx` matches
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test -- --run __tests__/screens/SplashScreen.test.tsx __tests__/screens/SignupScreen.test.tsx` exits 0 (existing screen tests still pass)
    - Splash + Signup visual baselines refreshed (mtime ≥ task-start time) and committed
    - `git status --short` after staging Sign-up shows ONLY the 4 files this task owns staged — no collateral inclusions per surgical-stage protocol
  </acceptance_criteria>
  <done>Splash + Sign-up logos render at 256×58 dp (~20% smaller); aspect preserved within ±1%; visual baselines refreshed; surgical-stage protocol honored on SignupScreen.tsx.</done>
</task>

<task type="auto">
  <name>Task 5: Rig illustration replacement (A2) — conditional on source artwork</name>
  <files>apps/mobile/src/assets/illustrations/rig.png, apps/mobile/src/assets/illustrations/rig@1x.png, apps/mobile/src/assets/illustrations/rig@2x.png, apps/mobile/src/assets/illustrations/rig@3x.png, .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md</files>
  <read_first>
    - apps/mobile/src/assets/illustrations/rig.png (placeholder; 405 bytes — verified 2026-05-10)
    - apps/mobile/src/assets/illustrations/rig@1x.png + rig@2x.png + rig@3x.png (placeholders; 405 / 1317 / 2836 bytes)
    - design-system/illustrations/ (source asset directory; verified 2026-05-10 contains ONLY logo PNGs — no rig artwork present)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (consumer; reads rig.png via require — no code change needed if the asset replaces in-place)
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (A2 section + this task's deviation entry on conditional escalation)
  </read_first>
  <action>
    **A2 is a CONDITIONAL task.** Plan 03-01 scaffolded transparent placeholder PNGs. Real rig artwork must come from design (or be cropped from a source illustration).

    **Step 1 — Probe for source artwork:**

    Run:
    ```bash
    ls -la /Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig.png \
           /Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig.svg \
           /Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig*.png 2>&1 | grep -v "No such" | head -5
    ```

    Also probe alternative likely paths the user may have stashed source artwork at:
    ```bash
    find /Users/adnaan/Documents/hl-homelander/design-system -iname "rig*" -type f 2>/dev/null
    find /Users/adnaan/Documents/hl-homelander -maxdepth 2 -iname "rig*" -type f 2>/dev/null | grep -v ".planning" | grep -v "apps/mobile/src/assets"
    ```

    **Step 2 — Branch on result:**

    **BRANCH A — Source artwork present** (e.g., a 1024×1024 transparent-padded PNG in `design-system/illustrations/rig.png` or `idea-brief.md`-adjacent):

      1. Use the same Plan 03-01 / Pattern 65 technique: `sharp(source).trim()` to detect the tight bounding box, then re-export at @1x / @2x / @3x widths preserving aspect.
      2. Target widths: 280 / 560 / 840 dp (the original placeholder widths from Plan 03-01 — see `03-W1-AMENDMENTS.md` A2 "sizes 280/280/560/840 px"). The 280 dp width is per design-spec §6 RigTutorial illustration slot.
      3. Write the four files (rig.png + rig@1x.png both at 280-bucket; rig@2x.png at 560-bucket; rig@3x.png at 840-bucket).
      4. Verify each file size ≥ 4096 bytes (real artwork; placeholder threshold).
      5. RigTutorialScreen.tsx requires NO change — the require path is unchanged.

    **BRANCH B — No source artwork found**:

      Do NOT generate fake/AI-generated artwork. Do NOT ship a hand-rolled line-art SVG without design sign-off (per CLAUDE.md: "Designs LOCKED — no new design work").

      Instead, mark A2 as a **deviation** with `escalate-to-user`:

      1. Edit `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md`:
         - Add a new section after the existing A2 block:
           ```
           ### A2 — closure attempt (Plan 03-11 Task 5)

           **Disposition:** escalate-to-user.
           **Reason:** No source rig artwork found in `design-system/illustrations/`
           or anywhere under `/Users/adnaan/Documents/hl-homelander/` outside the
           transparent placeholders. Per CLAUDE.md "Designs LOCKED" rule, the
           planner does not generate substitute artwork.
           **Required from user:** drop a real rig PNG (≥ 4096 bytes, transparent
           background, ~280 dp wide intrinsic) at
           `/Users/adnaan/Documents/hl-homelander/design-system/illustrations/rig.png`
           and re-run `cd apps/mobile && npx ts-node scripts/reexport-rig.ts`
           (this script lands as part of Branch A in Plan 03-11 Task 5; absent
           in Branch B because there's nothing to re-export).
           **Status:** A2 remains OPEN; A1, A3, A4, A5, A6 closed by Plan 03-11.
           ```
         - Stamp the section header `### A2` with a `status: open-escalated` annotation in the YAML frontmatter at the top of the file:
           ```
           a2_status: open-escalated  # Plan 03-11 Task 5 — no source artwork
           ```
      2. Surface the deviation in the Plan 03-11 SUMMARY.md (Task 6 / output block) so verify-work flags it for the user.
      3. The 03-WAVE1-SMOKE.md re-walk (operator-driven) will note A2 still flags — operator's call whether to ship Wave 2 with the rig page still showing transparent placeholder. (Functional regression remains; severity Medium.)

    **Surgical-stage** for either branch: stage the asset files (or the AMENDMENTS.md edit) by name only.

    **NO HumynCapture / native-module work** in this task.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander && (test -f apps/mobile/src/assets/illustrations/rig.png && [ "$(wc -c < apps/mobile/src/assets/illustrations/rig.png)" -ge 4096 ]) || grep -q "open-escalated" .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - EITHER (Branch A): `wc -c apps/mobile/src/assets/illustrations/rig.png apps/mobile/src/assets/illustrations/rig@2x.png apps/mobile/src/assets/illustrations/rig@3x.png` shows each file ≥ 4096 bytes
    - OR (Branch B): `grep -q "open-escalated\|escalate-to-user" .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` matches AND `grep -q "Plan 03-11 Task 5" .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` matches
    - `cd apps/mobile && npm test -- --run __tests__/screens/RigTutorialScreen.test.tsx` exits 0 (regardless of branch — test reads the require path, not the byte content)
    - `cd apps/mobile && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>A2 either closes with real artwork landing in 4 density buckets, OR escalates to user with an explicit deviation entry in 03-W1-AMENDMENTS.md.</done>
</task>

<task type="auto">
  <name>Task 6: Stamp closure on 03-W1-AMENDMENTS.md + final test sweep</name>
  <files>.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md</files>
  <read_first>
    - .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md (current frontmatter `status: open` line 2; `Sign-off` section at bottom)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-08 — operator re-walk gate; D-WAVE-09 — amendment protocol)
    - .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md (operator runbook — verify it still references the post-polish state correctly OR file a follow-up if it doesn't)
  </read_first>
  <action>
    **Stamp closure on 03-W1-AMENDMENTS.md.**

      1. **Update frontmatter** (lines 1–10):
         - Change `status: open` → `status: closed-by-03-11-2026-MM-DD` (where MM-DD is today). If Task 5 went Branch B, change instead to `status: partial-closed-by-03-11-2026-MM-DD-a2-escalated`.
         - Update `updated: 2026-05-10T20:25:00+05:30` to today's ISO timestamp.
         - Add a new line: `closed-by: Plan 03-11 (Tasks 1–5 — A1+A3 / A4 / A5 / A6 / A2)`.
      2. **Add a per-amendment closure column.** For each amendment section (A1–A6), append a `**Closure:**` line beneath `**Severity:**`:
         - A1: `**Closure:** Plan 03-11 Task 1 — body string tightened to 'Used only while you hit record' verbatim. Visual baseline refreshed.`
         - A2: Branch A → `**Closure:** Plan 03-11 Task 5 — real rig artwork landed at @1x/@2x/@3x density buckets (≥ 4096 bytes each).` OR Branch B → `**Closure:** ESCALATED — see "A2 closure attempt" subsection. No source artwork found; user must provide real rig PNG before this closes.`
         - A3: `**Closure:** Plan 03-11 Task 1 — useSafeAreaInsets()-driven `paddingBottom: insets.bottom + 12` lifts the nav above the gesture indicator.`
         - A4: `**Closure:** Plan 03-11 Task 2 — TopBar wordmark Image (256×58 dp aspect-bound) replaces the literal "Humyn Labs" Text. Single component edit propagates to Home/Tasks/History via Pattern 71. 3 visual baselines refreshed.`
         - A5: `**Closure:** Plan 03-11 Task 3 — `<View style={styles.bullets}>` block + 3 recovery-bullet- Text nodes deleted; recoveryBody tightened to 1 sentence. CompatFail visual baseline refreshed.`
         - A6: `**Closure:** Plan 03-11 Task 4 — explicit `style={{ width: 256, height: 58, resizeMode: 'contain' }}` on Splash + Sign-up Image; ~20% smaller than the Plan 03-02 intrinsic render. Aspect within ±1% of source. 2 visual baselines refreshed.`

         The closure lines MUST start at column 1 with literal `**Closure:**` (Markdown bold). The grep gates below (verify + acceptance) anchor to that line-start form for an unambiguous match.
      3. **Update the "Sign-off" section at the bottom** to reference Plan 03-11 closure + the next operator action: re-walk Pixel 10a per `03-WAVE1-SMOKE.md` to verify amendments closure on-device, then stamp `re-walked-on: 2026-MM-DD` to unblock D-WAVE-08 step 4 + Wave 2 plan-phase.

    **Verify 03-WAVE1-SMOKE.md still aligns with post-polish state.**

      Search for `Humyn Labs` text references that should now read "orange wordmark" or similar:
      ```bash
      grep -n "Humyn Labs\|wordmark\|What Now\|recovery bullet" .planning/phases/03-humyn-capture-native-module/03-WAVE1-SMOKE.md | head -20
      ```
      If any line still expects the OLD state (e.g., "observe 'Humyn Labs' text in TopBar"), file a follow-up note in the SUMMARY.md — do NOT silently rewrite the operator runbook (it's the operator's source of truth; the operator will note misalignments during re-walk and amend if needed). Document the misalignment in the SUMMARY for transparency.

    **Final test sweep — full mobile suite green:**

      ```bash
      cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npx tsc --noEmit && npm test -- --reporter=verbose
      ```

      Expect: ALL tests pass. The Wave-1 baseline count (10 baselines from Plan 03-03) stays at 10 — Plan 03-11 REFRESHES baselines, doesn't add new test files. (Task 1 refreshes Permissions; Task 2 refreshes Home + Tasks + History; Task 3 refreshes CompatFail; Task 4 refreshes Splash + Sign-up = 7 refreshes.)

      If the count differs (e.g., a stale baseline references the pre-polish state), inspect with `ls apps/mobile/__tests__/visual/__image_snapshots__/` and verify each PNG's mtime against the task's commit time.

      **Note on the verify command:** the `<verify><automated>` below intentionally does NOT pipe `npm test` through `tail` — piping through tail swallows the upstream exit code (tail always exits 0), masking npm test failures. Run npm test pure so the gate fails fast on regressions.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander && grep -q "closed-by-03-11\|partial-closed-by-03-11" .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md && [ "$(grep -c '^\*\*Closure:\*\*' .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md)" -ge 6 ] && cd apps/mobile && npx tsc --noEmit && npm test -- --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "closed-by-03-11\|partial-closed-by-03-11" .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` matches
    - `grep -c '^\*\*Closure:\*\*' .planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md` returns ≥ 6 (one per amendment A1–A6; line-start anchored, escaped-asterisk form — same string used in `<verify><automated>`)
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - `cd apps/mobile && npm test` exits 0 (full mobile suite green; expected ≥ 344/344 since Plan 03-11 refreshes baselines but does NOT add new test files)
    - 03-W1-AMENDMENTS.md frontmatter `updated:` timestamp is today's ISO date
  </acceptance_criteria>
  <done>03-W1-AMENDMENTS.md frontmatter stamped closed (or partial-closed if A2 escalated); per-amendment Closure lines present; full mobile test suite green.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                           | Description                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| user device → bundled assets       | Asset bundling: Image asset path swap (text→Image) could mis-bundle the orange wordmark           |
| jest-image-snapshot baselines → CI | PNG baseline churn surfaces in PR review; intentional vs accidental visual regressions            |
| protected files → git index        | SignupScreen.tsx + PermissionsScreen.tsx surgical-stage protocol prevents collateral file staging |

## STRIDE Threat Register

| Threat ID | Category               | Component                                            | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                           |
| --------- | ---------------------- | ---------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.11-01 | Tampering              | TopBar wordmark Image require() path                 | mitigate    | Acceptance criteria grep gate `require('.*assets/logos/orange_logo` matches at PR time; Plan 03-11 changes the file shape so a regression to the Text stub fails CI on the same gate. Pattern 65 (density-bucketed asset re-export from Plan 03-01) keeps the @1x/@2x/@3x buckets in sync.                |
| T-3.11-02 | Tampering              | jest-image-snapshot baselines (7 surfaces refreshed) | mitigate    | PNG baselines committed to git; PR review surfaces unintended baseline churn (D-WAVE-06 stated rationale). Each refreshed baseline has a Plan 03-11 task association documented in 03-W1-AMENDMENTS.md per-amendment Closure line.                                                                        |
| T-3.11-03 | Tampering              | Surgical-stage protocol on protected files           | mitigate    | Acceptance criteria includes `git status --short` gate; Phase 2 `.continue-here.md` row 1 protocol carries forward; staged files inspected with `git diff --staged` before each commit. The plan body explicitly enumerates the 2 protected files (SignupScreen.tsx, PermissionsScreen.tsx) that need it. |
| T-3.11-04 | Information disclosure | Rig artwork asset (Branch A — real PNG)              | accept      | Real rig artwork is brand-public — design-spec §6 already shows the rig surface. No PII or secrets in image bytes. Source asset (if found in design-system/illustrations/) is committed-public material.                                                                                                  |
| T-3.11-05 | Denial of service      | useSafeAreaInsets() in BottomNav consumed in tests   | mitigate    | Vitest mock for `react-native-safe-area-context` returns `{top:0, bottom:0, left:0, right:0}` so the test path returns `paddingBottom: 0 + 12 = 12`, height `68 + 0 = 68`. Pre-fix behavior preserved on jsdom (mock matches the renderer's pre-Plan-03-11 layout) — test suite stability not affected.   |

</threat_model>

<verification>
- All 6 amendments (A1–A6) closed (A2 may escalate per Task 5 Branch B).
- `cd apps/mobile && npm test` exits 0 (full mobile suite green; ≥ 344/344 across all test files).
- `cd apps/mobile && npx tsc --noEmit` exits 0.
- 7 visual snapshot baselines refreshed: Permissions, Home, Tasks, History, CompatFail, Splash, Signup.
- 03-W1-AMENDMENTS.md frontmatter stamped `closed-by-03-11-2026-MM-DD` (or `partial-closed-by-03-11-2026-MM-DD-a2-escalated` if Task 5 went Branch B).
- Per-amendment `**Closure:**` lines present in 03-W1-AMENDMENTS.md (one per A1–A6).
- Surgical-stage protocol honored: `git status --short` after staging shows only the files this plan owns; no `git add -A` collateral on SignupScreen.tsx, PermissionsScreen.tsx, or CLAUDE.md.

Operator-driven follow-up (D-WAVE-08 acceptance gate — NOT in this plan's executable scope):

- Operator re-walks Pixel 10a per `03-WAVE1-SMOKE.md` to verify A1–A6 closures on-device.
- Operator stamps `re-walked-on: 2026-MM-DD` in `03-WAVE1-SMOKE.md` (D-WAVE-08 step 4 sign-off).
- Wave 2 plan-phase (HumynCapture native module — Plan 03-04 onward via the Wave 2 sequence) is gated on this sign-off.
- If Task 5 went Branch B (A2 escalated), the operator's call whether to ship Wave 2 with the rig page still showing transparent placeholder.
  </verification>

<success_criteria>

- ✓ A1 — PermissionsScreen idle body reads exactly `Used only while you hit record` (no second sentence).
- ✓ A2 — RigTutorial illustration replaced with real artwork (≥ 4096 bytes per density bucket) OR escalated with deviation entry in 03-W1-AMENDMENTS.md.
- ✓ A3 — BottomNav lifts above gesture indicator via `useSafeAreaInsets()` + `paddingBottom: insets.bottom + 12` + `height: 68 + insets.bottom`.
- ✓ A4 — TopBar renders `<Image source={require('../assets/logos/orange_logo.png')} ... />`; literal `Humyn Labs` Text node removed; Home + Tasks + History TopBars all surface the new wordmark via Pattern 71's consumer chain.
- ✓ A5 — CompatFailScreen "What Now" recovery bullets removed; recoveryBody tightened to 1 sentence; Contact Support CTA preserved.
- ✓ A6 — Splash + Sign-up logos render at explicit 256×58 dp (~20% smaller than Plan 03-02 intrinsic; aspect within ±1% of source 320×73).
- ✓ 7 visual snapshot baselines refreshed and committed.
- ✓ Surgical-stage protocol honored on SignupScreen.tsx + PermissionsScreen.tsx.
- ✓ 03-W1-AMENDMENTS.md frontmatter stamped closed (or partial-closed); per-amendment Closure lines added.
- ✓ Full mobile test suite green; TypeScript check passes.

</success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-11-SUMMARY.md` per the canonical summary template — including:

- **Per-amendment closure roll-up** — A1 through A6, each with the executing task ID, the file(s) touched, and the closure status. Branch B for A2 if the source artwork was not found; surface the escalation prominently so verify-work flags it for the user.
- **Wave 2 gate state reminder** — note that conditions (3) + (4) of D-WAVE-08 (operator re-walk on Pixel 10a + `re-walked-on:` stamp in `03-WAVE1-SMOKE.md`) remain operator-driven hard gates before Wave 2 plan-phase (Plan 03-04 capture-foundation-muxer-bridge) starts. Plan 03-11 closes the planning-side of D-WAVE-09 amendment protocol; the operator owns the on-device verification.
- **Visual baseline refresh inventory** — list the 7 PNG baselines whose mtime should advance; note that the Wave-1 baseline COUNT stays at 10 (Plan 03-11 refreshes 7, leaves 3 unchanged: HelpCenter, RigTutorial, CompatPass).
- **No new patterns expected** — Plan 03-11 is a polish plan, not a pattern-introducing plan. If a pattern emerges (e.g., a refined surgical-stage workflow), document it inline.
- **03-WAVE1-SMOKE.md alignment note** — record any misalignments found between the post-polish state and the operator runbook (Task 6 `grep -n "Humyn Labs\|wordmark\|What Now\|recovery bullet"` audit). Do NOT silently rewrite the runbook; operator owns it.
- **Reminder to operator (in SUMMARY)** — surface the next action explicitly: "Re-walk Pixel 10a per `03-WAVE1-SMOKE.md` to verify A1–A6 closures; stamp `re-walked-on: 2026-MM-DD` to unblock Wave 2."
  </output>
