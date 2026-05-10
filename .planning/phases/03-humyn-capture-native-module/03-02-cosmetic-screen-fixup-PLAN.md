---
phase: 03-humyn-capture-native-module
plan_id: 03-02
plan: 2
type: execute
wave: 1
depends_on: [03-01]
files_modified:
  - apps/mobile/src/ui/primitives/Text.tsx
  - apps/mobile/src/screens/splash/SplashScreen.tsx
  - apps/mobile/src/screens/signup/SignupScreen.tsx
  - apps/mobile/src/screens/permissions/PermissionsScreen.tsx
  - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/src/components/BottomNav.tsx
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/screens/help/content.json
  - help-center-content.md
  - apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/RigTutorialScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/HelpCenterScreen.visual.test.tsx
  - apps/mobile/__tests__/visual/_utils/renderToImage.ts
requirements: []
autonomous: true
must_haves:
  truths:
    - Splash, Sign-up, Permissions, Home, RigTutorial render the wordmark generously without per-screen `<Image resizeMode="cover">` magic numbers
    - Sign-up and Permissions stack their primary CTA immediately under the centered content block (no flex spacer pinning to bottom) with content-driven CTA width (alignSelf:'center')
    - Bottom nav renders 24 dp Lucide icons (Home / ListTodo / History) above each label with ≥48 dp touch targets
    - RethinkSans renders on-device (root cause: font asset linking; Text.tsx fontFamilyForWeight() points at post-script names not file basenames)
    - 4 of 5 [EMAIL_ADDRESS] occurrences are replaced with support@humynlabs.ai (the 5th is owned by Plan 03-03 inside the merged CompatFail)
    - Vitest visual snapshot suite passes against committed PNG baselines under apps/mobile/__tests__/visual/__image_snapshots__/ (6 baselines)
  artifacts:
    - path: apps/mobile/__tests__/visual/__image_snapshots__/
      provides: jest-image-snapshot baselines for 6 Phase 2 surfaces (Splash, Sign-up, Permissions, Home, RigTutorial, HelpCenter)
    - path: apps/mobile/__tests__/visual/_utils/renderToImage.ts
      provides: deterministic renderToImage helper for jsdom-driven Vitest visual tests
      exports: ['renderToImage']
  key_links:
    - from: apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
      to: apps/mobile/src/assets/logos/orange_logo@2x.png
      via: require('../../assets/logos/orange_logo.png')
      pattern: require\(.*assets/logos/orange_logo
    - from: apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx
      to: apps/mobile/__tests__/visual/__image_snapshots__/SignupScreen.visual.test.tsx-snap.png
      via: toMatchImageSnapshot()
      pattern: toMatchImageSnapshot
---

<objective>
Wave 1b — wire the Plan 03-01 assets into the four logo-consuming screens, ship the RethinkSans + value-prop spacing fix on Sign-up, fix CTA position/width on Sign-up + Permissions, wire BottomNav Lucide icons + ≥48 dp touch targets, swap 4 of the 5 [EMAIL_ADDRESS] occurrences, and author the 6 jest-image-snapshot baselines this Wave 1 surface needs.

Purpose: per CONTEXT.md D-WAVE-04..07 + 02-COSMETIC-GAPS.md (frozen-2026-05-10), the Wave 1 acceptance gate (D-WAVE-08) requires every visual issue uncovered during the Phase 2 manual smoke walk be resolved before any HumynCapture native-module work begins. This plan executes the screen edits + visual baselines on top of the asset infrastructure landed by Plan 03-01.

Output: 6 modified RN screens + 1 modified Text primitive + 1 modified BottomNav + 4 of 5 [EMAIL_ADDRESS] substitutions + 6 visual snapshot tests + 6 PNG baselines committed.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/03-humyn-capture-native-module/03-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md
@.planning/phases/03-humyn-capture-native-module/03-PATTERNS.md

<interfaces>
<!-- The TopBar prop wiring already in HomeSkeletonScreen.tsx is the analog for any other surface that consumes the avatar. NOTE: This plan does NOT touch Tasks/History TopBars — those land in Plan 03-03. -->

From apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (lines 31–45):

```tsx
const navigation = useNavigation<{ navigate: (route: string) => void }>();
const user = useAppStore((s) => s.user);
const avatarInitial = (
  (user?.name ?? user?.email ?? 'U').trim().slice(0, 1) || 'U'
).toUpperCase();

return (
  <ScreenContainer accessibilityLabel="Home screen" padding={0}>
    <TopBar
      onAvatarPress={() => navigation.navigate('Profile')}
      avatarInitial={avatarInitial}
      {...(user?.avatarUrl ? { avatarUrl: user.avatarUrl } : {})}
    />
    {/* ... */}
```

The Phase 2 protected-file surgical-stage protocol applies (Phase 2 `.continue-here.md` row 1): when staging changes to `SignupScreen.tsx` or `Text.tsx`, do NOT use `git add -A`. Stage only the files this plan owns by name.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose + fix RethinkSans + tighten value-prop spacing in Sign-up</name>
  <files>apps/mobile/src/ui/primitives/Text.tsx, apps/mobile/src/screens/signup/SignupScreen.tsx</files>
  <read_first>
    - apps/mobile/src/ui/primitives/Text.tsx (the Text primitive with `fontFamilyForWeight()` mapping — protected file, surgical-stage)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (protected file, surgical-stage; consumer of Text)
    - apps/mobile/assets/fonts/RethinkSans-Regular.ttf (verify TTF is bundled)
    - apps/mobile/android/app/build.gradle (look for any react-native-asset or font config block)
    - apps/mobile/android/app/src/main/res/font/ (font resources directory if it exists)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md ("Sign-up screen" section — "Fonts not RethinkSans" + "Reduce vertical spacing between the three value-prop lines")
  </read_first>
  <action>
    **1A — RethinkSans diagnosis + fix:** The 02-COSMETIC-GAPS.md "Fonts not RethinkSans" entry calls out three candidate root causes — Hermes font registration, font asset linking failure at native build time, missing TTF post-script-name mismatch. Walk through them in order:

      1. **Confirm bundling:** run `unzip -l apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk | grep RethinkSans` (if APK exists; otherwise grep the assets dir). If TTFs are not present, run `cd apps/mobile && npx react-native-asset` and re-bundle.
      2. **Check `react-native-asset` config:** verify `apps/mobile/react-native.config.js` (or `apps/mobile/package.json` `react-native` block) declares `"assets": ["./assets/fonts/"]`. If absent, add it.
      3. **TTF post-script-name probe:** Use `fc-query` (if available) or inspect with `fontTools.ttLib` to verify each TTF's `name.psName` (post-script name) matches what `Text.tsx`'s `fontFamilyForWeight()` returns. The mapping must point to the post-script name, NOT the file basename — RN's Android font dispatcher resolves by post-script name. Common failure: the file is `RethinkSans-Bold.ttf` but its psName is `RethinkSans-Bold` (no `.ttf` suffix) and `fontFamilyForWeight()` returns `'RethinkSans-Bold.ttf'` — drop the suffix.
      4. **Update `apps/mobile/src/ui/primitives/Text.tsx`:** if the `fontFamilyForWeight()` map is wrong, fix the mapping. Document the exact diagnosis in a Pattern 65 comment.

    Apply the minimal Text.tsx surgical edit. If `RethinkSans-Regular`'s post-script name is just `RethinkSans-Regular` (most likely) and the existing map already strips the `.ttf` extension, the issue may be Hermes-side: also confirm `apps/mobile/android/app/build.gradle` has `enableHermes = true` (it does per Phase 2; just verify no font-asset filter blocks the bundle).

    **1B — Tighten value-prop spacing in Sign-up:** in `apps/mobile/src/screens/signup/SignupScreen.tsx`, locate the three value-prop lines ("Record real moments", "Train real intelligence", "Get paid") and reduce the inter-line vertical margin so the trio reads as one cohesive block. Concrete: if each line currently uses `marginBottom: spacing.lg` (24 px), drop to `spacing.xs` (4 px) so the three lines sit ~4 px apart with the line-height already providing visual breathing. If the current implementation uses a `<View style={{ gap: spacing.lg }}>`, change to `gap: spacing.xs`. Test by checking pixel-level snapshot in Task 4.

    **DO NOT** modify the SignupScreen body layout (CTA position is a separate concern in Task 2) — only the value-prop spacing.

    **DO NOT** use `git add -A`; stage exactly `apps/mobile/src/ui/primitives/Text.tsx` and `apps/mobile/src/screens/signup/SignupScreen.tsx` by name (Phase 2 surgical-stage protocol). If `apps/mobile/src/screens/signup/SignupScreen.tsx` already carries uncommitted backlog work for an unrelated concern (it's listed as `M` in `git status`), inspect with `git diff apps/mobile/src/screens/signup/SignupScreen.tsx` first and **stage hunks** with `git add -p` rather than the whole file.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npx tsc --noEmit && grep -q 'RethinkSans' src/ui/primitives/Text.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/src/ui/primitives/Text.tsx` contains `RethinkSans` (mapping references)
    - `apps/mobile/src/ui/primitives/Text.tsx` does NOT contain literal `'.ttf'` inside the `fontFamilyForWeight()` return values (post-script name only)
    - `apps/mobile/src/screens/signup/SignupScreen.tsx` value-prop block uses `spacing.xs` (or equivalent ≤8 px) between lines — verify with `grep -E "(gap|marginBottom):\s*spacing\.(xs|sm)" apps/mobile/src/screens/signup/SignupScreen.tsx`
    - `cd apps/mobile && npx tsc --noEmit` exits 0
    - Optional smoke (manual): build apkRollout debug + install + open Sign-up. Visual confirmation deferred to operator re-walk per D-WAVE-08.
  </acceptance_criteria>
  <done>Text primitive font mapping fixed; value-prop spacing tightened in Sign-up.</done>
</task>

<task type="auto">
  <name>Task 2: Wire new logo + rig assets, fix CTA position/width on Sign-up + Permissions, wire BottomNav Lucide icons, swap support email (4 of 5 occurrences)</name>
  <files>apps/mobile/src/screens/splash/SplashScreen.tsx, apps/mobile/src/screens/signup/SignupScreen.tsx, apps/mobile/src/screens/permissions/PermissionsScreen.tsx, apps/mobile/src/screens/home/HomeSkeletonScreen.tsx, apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx, apps/mobile/src/components/BottomNav.tsx, apps/mobile/src/screens/help/HelpCenterScreen.tsx, apps/mobile/src/screens/help/content.json, help-center-content.md</files>
  <read_first>
    - apps/mobile/src/screens/splash/SplashScreen.tsx (current ORANGE_LOGO require)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (CTA position, value-prop block, ORANGE_LOGO require)
    - apps/mobile/src/screens/permissions/PermissionsScreen.tsx (CTA position rule)
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (TopBar wordmark consumer; the file uses a `<Text>` wordmark today — see line 39+ for current shape)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (illustration slot + email reference + body copy)
    - apps/mobile/src/components/BottomNav.tsx (text-only labels currently — needs Lucide icons + touch-target sizing)
    - apps/mobile/src/screens/help/HelpCenterScreen.tsx (1 of 5 [EMAIL_ADDRESS] occurrences)
    - apps/mobile/src/screens/help/content.json (1 of 5 [EMAIL_ADDRESS] occurrences)
    - help-center-content.md (1 of 5 [EMAIL_ADDRESS] occurrences — canonical source for content.json)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md (sections "Sign-up screen", "Permissions / Camera & Mic screen", "Home screen", "Rig Tutorial screen" — and "How Phase 3 Wave 1 should pick this up")
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md (OQ-1 — support email decided as `support@humynlabs.ai`)
    - design-spec.md §6 (BottomNav icon spec — 24 dp Lucide icons)
  </read_first>
  <action>
    **2A — Wire new logo asset paths:** In each of the four logo consumers, replace the existing `<Image source={ORANGE_LOGO} resizeMode="cover" style={{width:N, height:M}}/>` with:

      ```tsx
      <Image
        source={require('../../assets/logos/orange_logo.png')}
        accessibilityLabel="Humyn Labs Capture wordmark"
      />
      ```

    No `resizeMode="cover"`, no explicit `width`/`height` style — the @Nx PNG bucket dimensions are correct. RN auto-picks @1x/@2x/@3x by device density. Apply to:

      - `apps/mobile/src/screens/splash/SplashScreen.tsx` (Splash logo)
      - `apps/mobile/src/screens/signup/SignupScreen.tsx` (Sign-up logo — surgical-stage protected file)
      - `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` (Home top wordmark — currently inside TopBar logic; the wordmark may already live in TopBar — this plan does NOT touch TopBar; only swap the wordmark image source if HomeSkeletonScreen renders the logo directly)
      - `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (rig illustration slot — wire `require('../../assets/illustrations/rig.png')`)

    **2B — CTA position + width on Sign-up + Permissions:** per 02-COSMETIC-GAPS.md "Sign-up screen" + "Permissions" sections. Concrete edits:

      - `apps/mobile/src/screens/signup/SignupScreen.tsx`: locate the outer container with `justify-content: 'space-between'` (or equivalent). Change to `justifyContent: 'center'` and remove any `<View style={{flex:1}} />` spacer between the value-prop block and the "Continue with Google" button. Wrap the button in `<View style={{alignSelf:'center'}}>` with no parent `flex:1` spacer. Drop any `width: '100%'` on the button — replace with content-driven width via `<Pressable style={{ paddingHorizontal: spacing.xl, alignSelf: 'center' }}>` so the natural Google-logo + label + horizontal padding sums to ~280-300 dp.
      - `apps/mobile/src/screens/permissions/PermissionsScreen.tsx`: same surgical edit — replace `justifyContent: 'space-between'` with `'center'`, drop the spacer, wrap the "Next" button in `alignSelf:'center'` with content-driven width.

    Surgical-stage SignupScreen.tsx (protected file).

    **2C — BottomNav Lucide icons + touch targets:** in `apps/mobile/src/components/BottomNav.tsx`:

      ```tsx
      import { Home as HomeIcon, ListTodo, History as HistoryIcon } from 'lucide-react-native';
      ```

      For each tab button, render a 24 dp Lucide icon above the label:

      ```tsx
      <Pressable
        accessibilityLabel={`${label.toLowerCase()}-tab`}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={24} strokeWidth={1.75} color={active ? colors.accent : colors.muted} />
        <Text variant="caption" tone={active ? 'primary' : 'secondary'}>{label}</Text>
      </Pressable>
      ```

      Map: `Home` → `HomeIcon`, `Tasks` → `ListTodo`, `History` → `HistoryIcon`. The `vitest.setup.ts` lucide mock already lists these icons (verify; if any is missing, add to the mock).

    **2D — Support email substitution (4 of 5 occurrences):** replace literal `[EMAIL_ADDRESS]` with `support@humynlabs.ai` in each of:

      - `help-center-content.md` (canonical content source)
      - `apps/mobile/src/screens/help/content.json` (will be re-emitted from `help-center-content.md` if `npm run prebuild` is run; for safety also edit directly)
      - `apps/mobile/src/screens/help/HelpCenterScreen.tsx` (any inline mailto fallback)
      - `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` (the "Don't have a rig" off-ramp Contact Support mailto)
      - `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` — DO NOT EDIT in this plan; Plan 03-03 deletes this file as part of the Compat-fail merge. The substitution lands inside the merged CompatFailScreen in Plan 03-03.

    Note this means **only 4 of 5 occurrences land here**; the 5th is owned by Plan 03-03. Document this in 02-OPEN-QUESTIONS.md OQ-1's resolution path during commit.

    Run `cd apps/mobile && npm run build:help` after editing `help-center-content.md` to regenerate `content.json` deterministically (per Pattern from Phase 2 plan 02-18).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/screens/HomeSkeletonScreen.test.tsx __tests__/screens/SignupScreen.test.tsx __tests__/screens/PermissionsScreen.test.tsx __tests__/screens/HelpCenterScreen.test.tsx __tests__/screens/RigTutorialScreen.test.tsx --reporter=verbose && grep -c '\[EMAIL_ADDRESS\]' src/screens/help/HelpCenterScreen.tsx src/screens/help/content.json src/screens/tutorial/RigTutorialScreen.tsx ../../help-center-content.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -v '^#' apps/mobile/src/screens/help/HelpCenterScreen.tsx | grep -c '\[EMAIL_ADDRESS\]'` returns `0`
    - `grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/help/content.json` returns `0`
    - `grep -c '\[EMAIL_ADDRESS\]' apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` returns `0`
    - `grep -c '\[EMAIL_ADDRESS\]' help-center-content.md` returns `0`
    - `grep -c 'support@humynlabs.ai' apps/mobile/src/screens/help/HelpCenterScreen.tsx apps/mobile/src/screens/help/content.json help-center-content.md apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` returns 4 lines each ≥ 1
    - `grep -q "from 'lucide-react-native'" apps/mobile/src/components/BottomNav.tsx`
    - `grep -E "ListTodo|History|HomeIcon" apps/mobile/src/components/BottomNav.tsx | wc -l` returns ≥ 3
    - `grep -E "minHeight:\s*48|minHeight: 48" apps/mobile/src/components/BottomNav.tsx` matches
    - `grep -q "require('.*assets/logos/orange_logo" apps/mobile/src/screens/splash/SplashScreen.tsx apps/mobile/src/screens/signup/SignupScreen.tsx`
    - `grep -q "require('.*assets/illustrations/rig" apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`
    - `grep -q "alignSelf: 'center'" apps/mobile/src/screens/signup/SignupScreen.tsx apps/mobile/src/screens/permissions/PermissionsScreen.tsx`
    - `grep -q "justifyContent: 'space-between'" apps/mobile/src/screens/signup/SignupScreen.tsx apps/mobile/src/screens/permissions/PermissionsScreen.tsx` returns no match (we replaced it with 'center')
    - `cd apps/mobile && npm test -- --run __tests__/screens/SignupScreen.test.tsx __tests__/screens/PermissionsScreen.test.tsx __tests__/screens/HelpCenterScreen.test.tsx __tests__/screens/RigTutorialScreen.test.tsx __tests__/screens/HomeSkeletonScreen.test.tsx` exits 0
  </acceptance_criteria>
  <done>Logo + rig assets wired through 4 surfaces; CTA-position + width fixed on Sign-up + Permissions; BottomNav Lucide icons + ≥48 dp touch targets; 4 of 5 [EMAIL_ADDRESS] occurrences replaced (5th deferred to Plan 03-03 Compat-fail merge).</done>
</task>

<task type="auto">
  <name>Task 3: Author 6 jest-image-snapshot visual tests + commit baselines</name>
  <files>apps/mobile/__tests__/visual/SplashScreen.visual.test.tsx, apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx, apps/mobile/__tests__/visual/PermissionsScreen.visual.test.tsx, apps/mobile/__tests__/visual/HomeSkeletonScreen.visual.test.tsx, apps/mobile/__tests__/visual/RigTutorialScreen.visual.test.tsx, apps/mobile/__tests__/visual/HelpCenterScreen.visual.test.tsx, apps/mobile/__tests__/visual/_utils/renderToImage.ts, apps/mobile/__tests__/visual/__image_snapshots__/</files>
  <read_first>
    - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx (existing screen test pattern with @testing-library/react)
    - apps/mobile/vitest.setup.ts (after Plan 03-01 — has the toMatchImageSnapshot adapter)
    - apps/mobile/vitest.config.ts (existing config)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md ("Visual snapshot tests (D-WAVE-06)" section)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-06 — baselines committed in repo, not gitignored)
  </read_first>
  <action>
    Author one Vitest visual test per Phase 2 surface that this plan touched. Each test:

      1. Renders the screen via `@testing-library/react` (using the existing host-component shim).
      2. Serializes the rendered DOM tree to a stable PNG via the helper described below.
      3. Asserts `expect(png).toMatchImageSnapshot()`.

    PNG generation helper — `jsdom` does NOT render to canvas, so the helper must convert the rendered DOM to a deterministic PNG via `html-to-image` or by falling back to a structural-render-tree-PNG (e.g., serialize accessibility tree and run through `pngjs` to encode a 1-bit "presence map"). Choose the LOWEST-fidelity approach that catches the gaps in `02-COSMETIC-GAPS.md`:

      - **Recommended:** install `html-to-image@^1.11.13` as a dev dep (works in jsdom with a polyfilled XMLSerializer + canvas mock from `canvas` npm pkg). If `canvas` install on macOS proves heavy, fall back to:
      - **Alternative:** render-tree-PNG via `pngjs` — serialize each `<View>` / `<Text>` / `<Image>` as a colored rectangle keyed by accessibilityLabel hash. Lower fidelity but catches structural shifts (CTA moved, icon missing, asset path wrong).

    Add a small helper at `apps/mobile/__tests__/visual/_utils/renderToImage.ts`:

      ```ts
      // Helper that consumes RTL render output and returns a deterministic PNG buffer.
      // Implementation chosen at task-time per the canvas-vs-pngjs note above.
      export async function renderToImage(container: HTMLElement): Promise<Buffer> { /* ... */ }
      ```

    Each test file (one per surface):

      ```tsx
      // apps/mobile/__tests__/visual/SignupScreen.visual.test.tsx
      import { describe, it, afterEach } from 'vitest';
      import { render, cleanup } from '@testing-library/react';
      import SignupScreen from '../../src/screens/signup/SignupScreen';
      import { renderToImage } from './_utils/renderToImage';

      afterEach(cleanup);

      describe('SignupScreen visual', () => {
        it('matches baseline (logo + value-props + CTA position)', async () => {
          const { container } = render(<SignupScreen />);
          const png = await renderToImage(container);
          expect(png).toMatchImageSnapshot();
        });
      });
      ```

    Surfaces to cover (one test file each):
      - SplashScreen
      - SignupScreen
      - PermissionsScreen
      - HomeSkeletonScreen
      - RigTutorialScreen
      - HelpCenterScreen

    Run `cd apps/mobile && npm test -- --run __tests__/visual --update` once to capture baselines. Inspect each generated PNG manually before committing — if a baseline shows the wrong layout (CTA still at the bottom, logo still tiny), fix the underlying screen first, NOT the baseline. Commit the PNGs to `apps/mobile/__tests__/visual/__image_snapshots__/`.

    **DO NOT** add Compat-fail / Compat-pass / Tasks / History visual tests — Plan 03-03 owns those (post-merge baseline; auto-advance baseline; Tasks/History TopBar avatar baseline).

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && npm test -- --run __tests__/visual --reporter=verbose && ls __tests__/visual/__image_snapshots__/*.png | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - 6 test files exist under `apps/mobile/__tests__/visual/`: `SplashScreen.visual.test.tsx`, `SignupScreen.visual.test.tsx`, `PermissionsScreen.visual.test.tsx`, `HomeSkeletonScreen.visual.test.tsx`, `RigTutorialScreen.visual.test.tsx`, `HelpCenterScreen.visual.test.tsx`
    - 6 PNG baselines exist under `apps/mobile/__tests__/visual/__image_snapshots__/` (`ls apps/mobile/__tests__/visual/__image_snapshots__/*.png | wc -l` returns ≥ 6)
    - `apps/mobile/__tests__/visual/_utils/renderToImage.ts` exists with an exported `renderToImage` function
    - `cd apps/mobile && npm test -- --run __tests__/visual` exits 0 (all 6 tests pass against committed baselines)
    - Baselines NOT in `.gitignore` — `grep -q __image_snapshots__ .gitignore` returns no match (or returns a `!__image_snapshots__` allow-list entry)
  </acceptance_criteria>
  <done>6 visual snapshot tests authored + 6 PNG baselines committed; suite passes locally.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                     | Description                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| user device → app build      | Asset bundling: bundle could include unintended files (PII in source PNG metadata) |
| user device → on-disk assets | App-private `assets/` directory; world-readable on rooted devices                  |

## STRIDE Threat Register

| Threat ID | Category               | Component                                            | Disposition | Mitigation Plan                                                                                                                                                                                               |
| --------- | ---------------------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.2-01  | Tampering              | jest-image-snapshot baselines                        | mitigate    | PNG baselines committed to git; PR review surfaces unintended baseline churn (D-WAVE-06 stated rationale).                                                                                                    |
| T-3.2-02  | Tampering              | `[EMAIL_ADDRESS]` substitution                       | mitigate    | Static grep gate (acceptance_criteria) ensures all 4 of 5 occurrences replaced; the 5th (Compat-fail merge) is explicitly deferred to Plan 03-03 with a tracker note. Plan 03-03 acceptance includes the 5th. |
| T-3.2-03  | Information disclosure | `help-center-content.md` → `content.json` build hash | accept      | Pattern from Phase 2 plan 02-18 — content is non-sensitive Help Center copy; no secrets.                                                                                                                      |

</threat_model>

<verification>
- All 5 modified RN screens render without TypeScript errors: `cd apps/mobile && npx tsc --noEmit` exits 0.
- Existing Phase 2 screen tests still pass: `cd apps/mobile && npm test -- --run __tests__/screens` exits 0.
- All 4 of 5 `[EMAIL_ADDRESS]` occurrences resolved (5th is Plan 03-03 — verified by grep across the file set in Task 2 acceptance).
- Visual snapshot suite green against committed baselines.
- Asset density buckets exist on disk + are bundled by Metro (re-run `npx react-native-asset` confirms).
- Surgical-stage protocol honored: `git status` shows only the files this plan owns are staged (no `git add -A` collateral on `SignupScreen.tsx` / `Text.tsx` / `CLAUDE.md`).
</verification>

<success_criteria>

- ✓ Splash + Sign-up + Home + RigTutorial wire the new asset paths through `require('../../assets/logos/orange_logo.png')`.
- ✓ Sign-up + Permissions CTA stacks immediately under content with `alignSelf: 'center'` content-driven width.
- ✓ BottomNav renders 24 dp Lucide icons (Home / ListTodo / History) above each label with ≥48 dp touch targets.
- ✓ RethinkSans font mapping fix lands in `Text.tsx`.
- ✓ Sign-up value-prop spacing tightened to `spacing.xs`.
- ✓ 4 of 5 `[EMAIL_ADDRESS]` → `support@humynlabs.ai` replacements applied (5th deferred to Plan 03-03 Compat-fail merge per Task 2D).
- ✓ 6 jest-image-snapshot visual tests authored + 6 PNG baselines committed to `apps/mobile/__tests__/visual/__image_snapshots__/`.
- ✓ `cd apps/mobile && npm test` exits 0 (all Phase 2 + new visual tests green).
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-02-SUMMARY.md` per the canonical summary template — including:

- Pattern callouts for any new pattern discovered (e.g., the `renderToImage` Vitest helper).
- Note that the 5th `[EMAIL_ADDRESS]` substitution is deferred to Plan 03-03 and update OQ-1 resolution path in `02-OPEN-QUESTIONS.md`.
- Any RethinkSans diagnosis findings (Pattern 65 candidate).
  </output>
