---
status: deferred-to-phase-3-wave-1
phase: 02-mobile-shell-onboarding-permissions-compat-profile
created: 2026-05-09
updated: 2026-05-10
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
- **Layout: content "crammed too far up" / button "too far down".** Top
  block now uses `flex: 1; justifyContent: 'center'` (was
  `justifyContent: 'space-between'` at the container level). On-device
  the bottom block (Continue with Google + consent) was still reported
  as too low. Either reduce screen height we're targeting (Pixel 10a is
  ~933 dp tall — the prototype was tested on a smaller logical height),
  or re-balance the flex layout.
- **Consent checkbox glyph is misleading.** Replaced the
  filled-square indicator with a literal `'✓'` Text glyph but consider
  swapping to an SVG (e.g. `react-native-svg` `<Path d="M…"/>`) for
  weight-correct rendering across font variants.

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
