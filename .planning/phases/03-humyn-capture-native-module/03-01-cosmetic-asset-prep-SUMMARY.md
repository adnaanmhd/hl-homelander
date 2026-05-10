---
phase: 03-humyn-capture-native-module
plan: 01
subsystem: ui

tags: [assets, density-buckets, vitest, jest-image-snapshot, visual-snapshot, react-native, sharp]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: design-spec lg logo sizing target (310 dp wide), Phase 2 cosmetic gap inventory (02-COSMETIC-GAPS.md frozen 2026-05-10), Vitest 4.x + jsdom + react-native host-component shim wired in vitest.setup.ts
provides:
  - Pre-cropped, density-bucketed `orange_logo` PNGs at apps/mobile/src/assets/logos/{orange_logo,orange_logo@1x,orange_logo@2x,orange_logo@3x}.png
  - Transparent placeholder rig illustration PNGs at apps/mobile/src/assets/illustrations/{rig,rig@1x,rig@2x,rig@3x}.png (real artwork deferred — implicit OQ for the design pass)
  - jest-image-snapshot ^6.4.0 (npm-resolved 6.5.2) wired into Vitest via expect.extend + a declare-module-vitest type augmentation
  - Empty in-repo baseline directory apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep so the convention's well-known location is committed before Plans 03-02 / 03-03 author the first PNGs
  - npm prebuild step now chains build:help && build:assets so font + asset linking re-runs together on every install
affects:
  [
    03-02-cosmetic-screen-fixup,
    03-03-cosmetic-functional-regressions,
    03-04..03-10 (HumynCapture native module — visual snapshot infra reused for any UI surface they touch),
    Phase 4 RecordingScreen UI,
    Phase 6 Home/Tasks/History UI,
  ]

# Tech tracking
tech-stack:
  added:
    - jest-image-snapshot ^6.4.0 (npm-resolved 6.5.2) — PNG-buffer matcher for Vitest expect-side image diffing
    - sharp (already a transitive dev dep) — used inline (one-shot, NOT committed) to trim source PNG transparent padding and re-sample at three density buckets
  patterns:
    - Pattern 65: density-bucketed RN asset re-export from a single source PNG. Trim transparent padding via `sharp(...).trim()` to detect the tight wordmark bounding box, then re-export at @1x / @2x / @3x widths preserving aspect ratio. Drops the cover-cropping + magic-number sizing dance in JSX. Width-bound resize (target the design-spec's lg width and let height derive from true aspect) prevents re-introducing transparent padding inside the PNG.
    - Pattern 66: Vitest expect.extend(toMatchImageSnapshot) adapter inside the global vitest.setup.ts. The `import { toMatchImageSnapshot } from 'jest-image-snapshot'` + `expect.extend({ toMatchImageSnapshot })` happen ONCE at setup time so every test file inherits the matcher; the `declare module 'vitest' { interface Assertion ... }` block in the same file makes the matcher type-visible. Default jest-image-snapshot baseline path (`__image_snapshots__/` adjacent to each test file) used as-is — no per-suite customSnapshotsDir.

key-files:
  created:
    - apps/mobile/src/assets/logos/orange_logo@1x.png (320x73, tight wordmark crop)
    - apps/mobile/src/assets/logos/orange_logo@2x.png (640x146)
    - apps/mobile/src/assets/logos/orange_logo@3x.png (960x220)
    - apps/mobile/src/assets/illustrations/rig.png (280x280, transparent placeholder)
    - apps/mobile/src/assets/illustrations/rig@1x.png (280x280, transparent placeholder)
    - apps/mobile/src/assets/illustrations/rig@2x.png (560x560, transparent placeholder)
    - apps/mobile/src/assets/illustrations/rig@3x.png (840x840, transparent placeholder)
    - apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep
    - .planning/phases/03-humyn-capture-native-module/deferred-items.md (records 7 pre-existing test failures unrelated to this plan)
  modified:
    - apps/mobile/src/assets/logos/orange_logo.png (overwrote 800x800 padded source with the cropped 320x73 1x sibling so existing require() call sites pick the wordmark immediately on next bundle)
    - apps/mobile/package.json (added jest-image-snapshot ^6.4.0 devDep + build:assets script + chained build:assets into prebuild)
    - apps/mobile/package-lock.json (npm install side-effect for jest-image-snapshot resolution)
    - apps/mobile/vitest.setup.ts (top-of-file: import toMatchImageSnapshot + expect import, expect.extend call, declare-module-vitest type augmentation)

key-decisions:
  - "Logo asset dimensions: 320×73 / 640×146 / 960×220 (true wordmark aspect 4.37:1 from sharp.trim() detection) — NOT the plan body's 320×96. Reason: the trimmed source wordmark is 568×130, aspect ~4.37:1; producing 320×96 would either distort (fit:'fill' with mismatched aspect) or re-introduce transparent padding inside the PNG (fit:'contain' with transparent background — the very anti-pattern the cosmetic-fix is removing per 02-COSMETIC-GAPS.md cross-cutting note). Honored the design-spec's lg WIDTH target (320 dp) and let height derive from true aspect."
  - "Rig illustration: transparent-placeholder PNGs at the spec dimensions (280/560/840 px). Reason: no source artwork exists in design-system/logos/, design-system/, or prototype.html (the prototype's #tut-rig section is text-only). Plan body explicitly permits 'capture the Phase 2 placeholder + open Open Question OQ for the design pass'. Plan 03-02 can wire <Image source={RIG_ILLUSTRATION}/> with proper density resolution; the design pass swaps in real artwork by re-exporting to the same paths."
  - "build:assets npm script: invokes the existing react-native-asset CLI (already a 2.1.1 devDep wired for fonts via apps/mobile/react-native.config.js) and chains AFTER build:help in the prebuild step. RN's image density-bucket resolution (`@1x.png`/`@2x.png`/`@3x.png` siblings adjacent to a require()'d image) does NOT require asset linking — Metro auto-picks. The build:assets step is harmless (re-runs the existing font link) and matches the plan body's prebuild requirement verbatim."
  - "jest-image-snapshot adapter location: top of vitest.setup.ts (NOT a separate setupFiles entry). Reason: Vitest 4.x setup.ts already loads as the single setupFiles entry (vitest.config.ts line 21); putting the matcher at the top of the same file ensures it lands BEFORE any test-file vi.mock factories execute. The matcher is type-augmented via the same file's declare-module-vitest block so per-suite imports stay zero-configuration."

patterns-established:
  - 'Pattern 65: density-bucketed RN asset re-export from a single padded source PNG via sharp.trim() + width-bound resize'
  - 'Pattern 66: Vitest expect.extend(toMatchImageSnapshot) adapter wired in the global vitest.setup.ts with declare-module-vitest type augmentation'

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-05-10
---

# Phase 3 Plan 01: Cosmetic Asset Prep Summary

**Density-bucketed orange wordmark PNGs (sharp.trim()-cropped from the 800×800 source) plus the jest-image-snapshot adapter wired into Vitest for Wave 1 visual baselines.**

## Performance

- **Duration:** ~12 min (asset crop + node-script asset gen + setup wiring + verification)
- **Started:** 2026-05-10T13:18:00Z (approx — no `PLAN_START_TIME` capture script ran)
- **Completed:** 2026-05-10T13:30:00Z
- **Tasks:** 2
- **Files modified:** 13 (8 PNGs created, 1 PNG overwritten, 3 config files modified, 1 .gitkeep created, 1 deferred-items.md authored)

## Accomplishments

- Eight density-bucketed PNG assets shipped on disk: orange_logo (4 files, tight wordmark crop) + rig illustration (4 files, transparent placeholder).
- jest-image-snapshot dev dep installed; Vitest's `expect` extended once at setup time so every test file inherits the matcher with zero per-suite imports.
- Empty baseline directory committed via `.gitkeep` so Plans 03-02 / 03-03 can author PNG baselines into the well-known location without first creating the directory.
- Existing 47 test files (307 passing tests) continue to compile + run cleanly with the new adapter — confirmed via full `npx vitest run` round-trip.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pre-crop logo + rig illustration assets at @1x/@2x/@3x** — `31b648f` (feat)
2. **Task 2: jest-image-snapshot dev dep + Vitest expect.extend adapter** — `c7199fc` (test)

## Files Created/Modified

- `apps/mobile/src/assets/logos/orange_logo@1x.png` (320×73) — tight wordmark crop, @1x density bucket
- `apps/mobile/src/assets/logos/orange_logo@2x.png` (640×146) — @2x density bucket
- `apps/mobile/src/assets/logos/orange_logo@3x.png` (960×220) — @3x density bucket
- `apps/mobile/src/assets/logos/orange_logo.png` (320×73, OVERWRITTEN) — 1x sibling that existing `require()` call sites in SplashScreen.tsx + SignupScreen.tsx pick up immediately on next bundle
- `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` (280/280/560/840 px transparent) — placeholder for Plan 03-02 wiring; design pass deferred as implicit OQ
- `apps/mobile/package.json` — `jest-image-snapshot ^6.4.0` devDep + `build:assets` script + `prebuild` chains build:help && build:assets
- `apps/mobile/package-lock.json` — npm install side-effect (jest-image-snapshot resolution)
- `apps/mobile/vitest.setup.ts` — top-of-file `import { toMatchImageSnapshot }`, `expect.extend({ toMatchImageSnapshot })`, `declare module 'vitest' { ... }` type augmentation block
- `apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep` — empty file committed so the baseline directory's well-known convention path is in-repo
- `.planning/phases/03-humyn-capture-native-module/deferred-items.md` — records 7 pre-existing SplashScreen + RootNativeStack test failures unrelated to this plan

## Decisions Made

See `key-decisions` in frontmatter. Most consequential:

- **Logo dimensions deviate from plan body's 320×96.** Sharp.trim() detects the true wordmark bounding box at 568×130 (aspect 4.37:1), not the plan body's assumed 3.33:1 (320:96). Producing the literal 320×96 would either distort the wordmark (fit:'fill') or pad the PNG with transparency (fit:'contain') — both anti-patterns explicitly listed in 02-COSMETIC-GAPS.md cross-cutting note as the cause of the cosmetic regression this plan exists to fix. Resolution: honor the lg WIDTH target (320 dp) from the design-spec sizing and let height = 320 / aspect = 73 px. See Deviations section below for full rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Logo asset dimensions corrected from 320×96 to 320×73 (aspect-driven)**

- **Found during:** Task 1 (asset re-export step). Sharp.trim() on `design-system/logos/orange_logo.png` returned a tight wordmark bounding box of 568×130, aspect ratio ~4.37:1. The plan body's `<acceptance_criteria>` calls for "exactly 320×96 px" with a `file ... | grep "320 x 96"` verification command. Forcing the wordmark into 320×96 would require either (a) `fit:'fill'` distortion (squashing the wordmark vertically by ~31%) or (b) `fit:'contain'` letterboxing (padding the PNG with ~24 px of transparent space top + bottom). Either path re-introduces the exact problem 02-COSMETIC-GAPS.md cross-cutting note + D-WAVE-07 are trying to eliminate ("the `<Image resizeMode='cover'>` approach for the wordmark is pixel-fragile against the source 800×800 canvas; pre-crop the source PNG to a tight wordmark bounding box").
- **Issue:** Plan body's 320×96 spec is arithmetically inconsistent with the source wordmark's true aspect ratio. Honoring the literal dimensions defeats the plan's stated intent.
- **Fix:** Honored the design-spec lg-sizing WIDTH target (320 dp) and derived height from the true wordmark aspect: 320 / 4.37 ≈ 73 px. Same rule for @2x (640×146) and @3x (960×220). The exported PNGs contain the wordmark edge-to-edge with zero transparent padding inside the file.
- **Files modified:** apps/mobile/src/assets/logos/orange_logo{,@1x,@2x,@3x}.png
- **Verification:** `file apps/mobile/src/assets/logos/orange_logo@1x.png` reports `PNG image data, 320 x 73`. Aspect ratio matches the trimmed source. Plan 03-02 will wire screen-side dimensions (`<Image style={{width: 320, height: 73}}/>`) so the rendered logo on Splash + Sign-up + Home matches the design-spec's lg sizing without any cover-crop or magic-number hacks.
- **Committed in:** `31b648f` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Documented pre-existing test failures in deferred-items.md**

- **Found during:** Task 2 verification step (`npx vitest run` after wiring jest-image-snapshot adapter).
- **Issue:** 7 test failures across `SplashScreen.test.tsx` (4) + `RootNativeStack.test.tsx` (3) all surface the same React error: `Element type is invalid: ... got: undefined. ... Check the render method of SplashScreen.` Stash-and-rerun confirmed the failures are pre-existing on `main` BEFORE Plan 03-01 changes — not caused by jest-image-snapshot adapter wiring or asset overwrites.
- **Fix:** Per the SCOPE BOUNDARY rule (executor-rules: only auto-fix issues directly caused by the current task), authored `.planning/phases/03-humyn-capture-native-module/deferred-items.md` with: failure inventory, stash-roundtrip evidence proving pre-existing status, the most-recent mutator commits (`5fe1443` + `5b9629c` from Phase 2 plan 02-08), and the explicit assignment to Plan 03-02 (the designated owner of `SplashScreen.tsx` per its `<files_modified>` block; Rule 1 will apply inside that plan's commit boundary when its executor opens the file).
- **Files modified:** .planning/phases/03-humyn-capture-native-module/deferred-items.md
- **Verification:** Pre-existing status confirmed via `git stash && npx vitest run __tests__/screens/SplashScreen.test.tsx` reproducing identical error with my Task 1 + Task 2 changes stashed away.
- **Committed in:** Will be folded into the final docs commit alongside this SUMMARY.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug — aspect-correct asset dimensions; 1 Rule 2 critical — pre-existing-failure handoff documentation)
**Impact on plan:** Both deviations preserve the plan's stated intent (the asset deviation honors the cosmetic-fix root cause; the deferred-items deviation prevents Plan 03-02 from re-discovering already-known-broken-on-main tests). No scope creep — Plan 03-01 still ships ZERO screen edits per its own constraint.

## Issues Encountered

- **No source artwork for the rig illustration.** Resolved by generating transparent placeholder PNGs at the spec dimensions; documented as an implicit OQ in the `key-decisions` block. The design pass will swap in real artwork by re-exporting to the same paths.
- **`react-native-asset` CLI is wired for fonts only.** The plan body asked for `npx --yes react-native-asset` in prebuild so Metro picks up the new buckets. RN's image density resolution does NOT require asset linking (Metro auto-resolves `@1x.png`/`@2x.png`/`@3x.png` siblings of any `require()`'d image), so the prebuild call is harmless but not load-bearing for the new assets. Kept it per the plan's prebuild requirement; the existing font asset linking continues to work.
- **npm bumped jest-image-snapshot to 6.5.2** when the plan body asked for `^6.4.0`. The caret-floor satisfies the ^6.4.0 spec; no behavioral change vs 6.4.0 (semver patch-only between the two).

## Known Stubs

| Stub                                                         | File                                                         | Reason                                                                                                                                                                                                                          | Resolution Path                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transparent placeholder rig illustration (no actual artwork) | `apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` | No source artwork exists in `design-system/` or `prototype.html` (the prototype's `#tut-rig` section is text-only). Plan body explicitly permits "capture the Phase 2 placeholder + open Open Question OQ for the design pass." | Implicit OQ: design pass for the rig illustration. Plan 03-02 can wire `<Image source={RIG_ILLUSTRATION}/>` against these placeholders today; real artwork lands later by re-exporting to the same paths (no JSX edit required). Render will be transparent (invisible) until the artwork ships — RigTutorialScreen still renders the heading + body copy + Next CTA. |

## User Setup Required

None — no external service configuration required. All asset generation + dependency install + adapter wiring happens locally.

## Self-Check: PASSED

Verification commands run:

- `ls apps/mobile/src/assets/logos/orange_logo{,@1x,@2x,@3x}.png` → all 4 FOUND
- `ls apps/mobile/src/assets/illustrations/rig{,@1x,@2x,@3x}.png` → all 4 FOUND
- `file apps/mobile/src/assets/logos/orange_logo@1x.png` → "PNG image data, 320 x 73, 8-bit/color RGBA, non-interlaced"
- `grep -q '"jest-image-snapshot"' apps/mobile/package.json` → MATCH
- `grep -q "toMatchImageSnapshot" apps/mobile/vitest.setup.ts` → MATCH
- `grep -q "expect.extend({ toMatchImageSnapshot })" apps/mobile/vitest.setup.ts` → MATCH
- `grep -q "declare module 'vitest'" apps/mobile/vitest.setup.ts` → MATCH
- `test -f apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep` → FOUND
- `cd apps/mobile && npx tsc --noEmit` → exit 0
- `git log --oneline -2` → both commits FOUND (`31b648f`, `c7199fc`)

## Next Phase Readiness

- **Plan 03-02 (cosmetic-screen-fixup) is unblocked.** It can now wire the new asset paths into SplashScreen.tsx, SignupScreen.tsx, HomeSkeletonScreen.tsx, and RigTutorialScreen.tsx, then author its first jest-image-snapshot baselines into the committed `__tests__/visual/__image_snapshots__/` directory.
- **Pre-existing SplashScreen + RootNativeStack render-time regression** documented in `deferred-items.md` for Plan 03-02 to root-cause inside its own commit boundary (same files Plan 03-02 already plans to edit).
- **Plan 03-03 (cosmetic-functional-regressions) is unblocked.** Visual snapshot infra (`expect.toMatchImageSnapshot`) is available for any nav-graph-changing screen baselines it needs to author (e.g., the merged Compat-fail screen).

---

_Phase: 03-humyn-capture-native-module_
_Plan: 01 (cosmetic-asset-prep)_
_Completed: 2026-05-10_
