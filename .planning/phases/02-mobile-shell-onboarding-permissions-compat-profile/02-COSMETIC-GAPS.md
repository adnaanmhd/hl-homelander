---
status: deferred-to-phase-3-wave-1
phase: 02-mobile-shell-onboarding-permissions-compat-profile
created: 2026-05-09
updated: 2026-05-10 (smoke-walk findings: §2 sign-up layout/CTA, §3 permissions CTA, §4 compat-fail merge + center, §4 compat-pass auto-advance, §5 rig illustration + support email decided)
---

# Phase 2 — Cosmetic gaps (deferred to Phase 3 Wave 1)

During the Phase 2 manual smoke walk on a Pixel 10a (apkRollout debug),
the following cosmetic / visual issues surfaced. **The user explicitly
deferred these to Phase 3 Wave 1** — Phase 2 acceptance is functional only
(navigation, gates, persistence, API contracts). Phase 3 Wave 1 must open
with a "cosmetic fix-up" plan that addresses every item below before any
HumynCapture native-module work lands on top.

## Splash screen (design-spec §1)

- **Logo too small / awkward padding.** The orange wordmark sits in the
  middle ~20% of an 800×800 PNG with transparent padding. Current
  `<Image source={ORANGE_LOGO} resizeMode="cover" style={{width:360,
height:104}}/>` should crop the padding correctly per prototype.html
  `object-fit: cover`, but visually still looks small — verify on-device
  and bump the box dimensions OR pre-crop the source PNG.
- **Animation not visible / wrong.** The `scalePop` (700 ms,
  cubic-bezier(.2,.8,.2,1)) and the 600 ms-delayed tagline fade are
  implemented in `Animated.parallel(…)` but the on-device perception was
  "wrong animation." Re-verify timing/easing against the prototype.html
  reference and the design-spec §0.4 motion table.

## Sign-up screen (design-spec §2)

- **Logo missing / too small.** Replaced the typographic stub with the
  orange wordmark image at `lg` (310×90) per prototype, but on-device
  it still looked under-sized. Same crop / sizing issue as splash.
- **Fonts not RethinkSans.** Bundled fonts (RethinkSans-{Regular,Medium,
  SemiBold,Bold,ExtraBold}.ttf) are present in
  `apps/mobile/assets/fonts/` and confirmed packaged inside the APK
  (`unzip -l app-apkRollout-debug.apk | grep RethinkSans`). The Text
  primitive maps each variant's fontWeight to a specific bundled file
  via `fontFamilyForWeight()` and strips fontWeight from the cascade so
  Android's font dispatcher picks the file directly. **On-device the
  fonts STILL appeared to be system Roboto** — needs deeper diagnosis
  (possibly a Hermes-side font registration issue, font asset linking
  failure at native build time, or a missing TTF post-script-name
  mismatch). Reproduce, then fix.
- **Reduce vertical spacing between the three value-prop lines.** "Record
  real moments", "Train real intelligence", and "Get paid" currently sit
  with too much vertical breathing room. Tighten so the trio reads as
  one cohesive block, not three independent paragraphs.
- **CTA position: immediately below content, NOT pinned to the bottom.**
  The "Continue with Google" button currently sits far below the
  centered content because the prototype's `justify-content:
space-between` (or equivalent flex layout instruction in design-spec
  §2) anchors it to the screen bottom. **Required behavior:** the
  button stacks immediately under the centered content block (logo +
  three value props) — no extra growing spacer between content and
  button. The block + button + consent all sit as a single
  vertically-centered group on the screen.
- **CTA width: adaptive, NOT full-width.** "Continue with Google" is
  currently full bleed minus container padding. Make it
  `alignSelf: 'center'` with content-driven width (Google logo + label
  - horizontal padding ≈ ~280–300 dp on a Pixel-class screen). Same
    rule applies to other primary CTAs in this Phase 2 surface — see
    Permissions and Compat-fail entries below.
- **Consent checkbox glyph is misleading.** Replaced the
  filled-square indicator with a literal `'✓'` Text glyph but consider
  swapping to an SVG (e.g. `react-native-svg` `<Path d="M…"/>`) for
  weight-correct rendering across font variants.

## Permissions / Camera & Mic screen (design-spec §3)

- **CTA position: immediately below content, NOT pinned to the bottom.**
  The "Next" button currently sits far below the centered content
  (camera + mic permission rows). Required: stack the button immediately
  under the centered content block. The whole group (title + permission
  rows + button) sits as a single vertically-centered group, not
  content-up + button-down with a flex spacer between.
- **CTA width: adaptive, NOT full-width.** "Next" is currently full
  bleed minus container padding. Make it `alignSelf: 'center'` with
  content-driven width (matches the Sign-up CTA rule above).

## Compat-fail screen (design-spec §4 + §4 recovery)

> **Scope note:** these items collapse `CompatFailScreen.tsx` +
> `CompatRecoveryScreen.tsx` into a single screen and change the
> Phase 2 navigation graph (the Recovery route disappears). Larger than
> a pure visual tweak; explicitly approved by the user as Phase 3
> Wave 1 scope.

- **Center-align the content** both horizontally and vertically on the
  screen. Currently the failure list + diagnostic copy stack toward the
  top of the screen with a flex spacer pushing the CTA down.
- **Merge "What now" into the same screen.** Today, tapping a "What
  now?" CTA navigates to a separate `CompatRecoveryScreen` (COMPAT-08).
  Required: list the failure reasons (the bulleted check list from
  CompatFailScreen) AND immediately below them, render the
  CompatRecoveryScreen body (the 3-bullet recovery + Contact Support).
  No second screen, no extra navigation hop. The user wants the entire
  fail UX in one scrollable screen.
- **CTA position: immediately below content, NOT pinned to the bottom.**
  After the merge, the "Contact Support" button sits immediately under
  the recovery block (which sits under the failure list).
- **CTA width: adaptive, NOT full-width.** "Contact Support" follows
  the same `alignSelf: 'center'` content-width rule as Sign-up and
  Permissions.
- **Consequence (planning):** the `CompatRecovery` route + screen file
  - its test file get deleted. The CompatFail navigator entry stays;
    CompatRecoveryScreen's body merges into CompatFailScreen. Pattern 54
    (navigator route-registry invariant test) needs the `CompatRecovery`
    entry removed from the locked-routes list. OQ-2 (compat-fail "what
    now" recovery copy — final wording) is **superseded** — the wording
    pass now happens against the merged screen, not the standalone
    recovery screen. Update OQ-2's resolution path during the cleanup.

## Compat-pass screen (design-spec §4)

- **Auto-advance — no intermediary "tap to continue" gate.** Currently
  CompatPassScreen renders "You're in. All checks passed." with a CTA
  the user has to tap before continuing into the Tutorial Rig flow.
  Required: when all checks pass, the screen briefly displays the
  success state (≤1.5 s with the existing 40 ms haptic) and then
  auto-routes to the next onboarding step without any tap. Treat the
  pass state as a transient confirmation, not a gate.
- **Consequence (planning):** the existing CompatPass→next CTA test
  becomes "auto-routes after N ms" — update the unit test alongside
  the screen change.

## Rig Tutorial screen (design-spec §5 / ONB-01..02)

- **Head-rig illustration is missing.** The screen currently shows
  copy + an empty illustration slot. The illustration asset must be
  added (likely a transparent-PNG export from `design-system/` or
  `prototype.html`'s `#rig-tutorial` block). Pre-cropped at known
  device-density buckets to match the cross-cutting recommendation
  below.
- **Support email is now decided: `support@humynlabs.ai`.** This
  resolves OQ-1 in `02-OPEN-QUESTIONS.md`. The actual code substitution
  (5 `[EMAIL_ADDRESS]` occurrences across `help-center-content.md`,
  `apps/mobile/src/screens/help/content.json`,
  `apps/mobile/src/screens/help/HelpCenterScreen.tsx`,
  `apps/mobile/src/screens/compat/CompatRecoveryScreen.tsx` (or its
  merged successor — see Compat-fail entry above), and
  `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`) lands as
  part of the Phase 3 Wave 1 cleanup commit. Run
  `cd apps/mobile && npm run build:help` after editing
  `help-center-content.md` so the JSON is regenerated.

## Cross-cutting

- The `<Image resizeMode="cover">` approach for the wordmark is
  pixel-fragile against the source 800×800 canvas. **Recommended fix:**
  pre-crop the source PNGs in `design-system/logos/` to a tight wordmark
  bounding box and re-export at known device-density buckets
  (`@1x.png`, `@2x.png`, `@3x.png`) so RN can pick the right asset
  density. Drops the `cover` crop and removes the magic numbers.
- **`react-native-asset` may not have run for assets** beyond the
  fonts directory. Re-run `npx react-native-asset` after pre-cropping
  the logos, OR move the logos under
  `apps/mobile/src/assets/logos/` (where they are now) and verify Metro
  is serving them through the `require()` path.

## How Phase 3 Wave 1 should pick this up

The first plan of Phase 3 (a `cosmetic-fixup-PLAN.md` or similar) should:

1. Re-walk Splash → Sign-up → Permissions → Compat → RigTutorial on a
   Pixel 7a/8a/10a-class device.
2. For every screen, reference the design-spec § that defines its layout
   and the corresponding `prototype.html` block.
3. Resolve every item in this file plus any new items the operator
   surfaces during the re-walk.
4. Add a `__tests__/visual/` directory with Pixel-snapshot tests per
   screen, gated behind the same vitest run, so future cosmetic
   regressions surface in CI before they hit a smoke walk.

Until that plan ships, **do NOT close any of these as a `failed` UAT gap
in `02-HUMAN-UAT.md`** — they are explicitly deferred (`status:
deferred-to-phase-3-wave-1`), not failed.
