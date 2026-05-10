---
phase: 03-humyn-capture-native-module
plan_id: 03-01
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/package.json
  - apps/mobile/vitest.setup.ts
  - apps/mobile/src/assets/logos/orange_logo@1x.png
  - apps/mobile/src/assets/logos/orange_logo@2x.png
  - apps/mobile/src/assets/logos/orange_logo@3x.png
  - apps/mobile/src/assets/logos/orange_logo.png
  - apps/mobile/src/assets/illustrations/rig@1x.png
  - apps/mobile/src/assets/illustrations/rig@2x.png
  - apps/mobile/src/assets/illustrations/rig@3x.png
  - apps/mobile/src/assets/illustrations/rig.png
  - apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep
requirements: []
autonomous: true
must_haves:
  truths:
    - Pre-cropped @1x/@2x/@3x logo PNGs land under apps/mobile/src/assets/logos/
    - Pre-cropped @1x/@2x/@3x rig illustration PNGs land under apps/mobile/src/assets/illustrations/
    - jest-image-snapshot dev dep + Vitest expect.extend adapter wired in vitest.setup.ts
    - Empty baseline directory apps/mobile/__tests__/visual/__image_snapshots__/ committed via .gitkeep
  artifacts:
    - path: apps/mobile/src/assets/logos/orange_logo@1x.png
      provides: pre-cropped wordmark @1x density
    - path: apps/mobile/src/assets/logos/orange_logo@2x.png
      provides: pre-cropped wordmark @2x density
    - path: apps/mobile/src/assets/logos/orange_logo@3x.png
      provides: pre-cropped wordmark @3x density
    - path: apps/mobile/package.json
      provides: jest-image-snapshot dev dep + react-native-asset prebuild script
      contains: jest-image-snapshot
    - path: apps/mobile/vitest.setup.ts
      provides: expect.extend(toMatchImageSnapshot) adapter
      contains: toMatchImageSnapshot
  key_links:
    - from: apps/mobile/vitest.setup.ts
      to: jest-image-snapshot
      via: import { toMatchImageSnapshot } from 'jest-image-snapshot'
      pattern: import.*toMatchImageSnapshot.*from.*jest-image-snapshot
---

<objective>
Wave 1a — produce the pre-cropped, density-bucketed asset files and wire the jest-image-snapshot infrastructure that Plans 03-02 + 03-03 consume. This plan ships ZERO screen edits — assets land on disk and Vitest learns to compare PNGs. Plan 03-02 wires the assets into screen components and authors the visual baselines.

Purpose: per CONTEXT.md D-WAVE-04..07 + 02-COSMETIC-GAPS.md (frozen-2026-05-10), the Wave 1 acceptance gate (D-WAVE-08) requires every visual issue uncovered during the Phase 2 manual smoke walk be resolved before any HumynCapture native-module work begins. Splitting asset prep + test infra (this plan) from the screen-fixup edits (Plan 03-02) keeps each plan inside the Plan-Phase context budget per checker issue #3.

Output: 8 PNG asset files + 1 modified package.json (devDep + prebuild script) + 1 modified vitest.setup.ts (expect.extend adapter) + 1 empty baseline directory committed via .gitkeep.
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-crop logo + rig illustration assets at @1x/@2x/@3x and re-export under apps/mobile/src/assets/</name>
  <files>apps/mobile/src/assets/logos/orange_logo@1x.png, apps/mobile/src/assets/logos/orange_logo@2x.png, apps/mobile/src/assets/logos/orange_logo@3x.png, apps/mobile/src/assets/logos/orange_logo.png, apps/mobile/src/assets/illustrations/rig@1x.png, apps/mobile/src/assets/illustrations/rig@2x.png, apps/mobile/src/assets/illustrations/rig@3x.png, apps/mobile/src/assets/illustrations/rig.png, apps/mobile/package.json</files>
  <read_first>
    - apps/mobile/src/screens/splash/SplashScreen.tsx (current ORANGE_LOGO consumer, see how the require() resolves)
    - apps/mobile/src/screens/signup/SignupScreen.tsx (second consumer; modified state may carry uncommitted changes — surgical-stage)
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx (Home tab consumer)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (consumer of rig illustration slot)
    - design-system/logos/ (source 800×800 transparent-padded PNG)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md (sections "Splash screen", "Sign-up screen", "Home screen", "Rig Tutorial screen", "Cross-cutting")
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-07 — logo asset re-export is Task 1)
  </read_first>
  <action>
    Per D-WAVE-07: pre-crop the source PNGs in `design-system/logos/` to a tight wordmark bounding box (drop the transparent padding around the orange wordmark). Export at THREE density buckets:

      - `apps/mobile/src/assets/logos/orange_logo@1x.png` — 320×96 px (DPI baseline)
      - `apps/mobile/src/assets/logos/orange_logo@2x.png` — 640×192 px
      - `apps/mobile/src/assets/logos/orange_logo@3x.png` — 960×288 px

    React Native picks density buckets automatically when `require('./assets/logos/orange_logo.png')` is called and the `@2x.png` / `@3x.png` siblings exist. Also export a 1x copy at the bare `orange_logo.png` path so older `require()` calls don't break.

    Repeat the same density-bucket pattern for the rig illustration:
      - `apps/mobile/src/assets/illustrations/rig@1x.png` — 280×280 px transparent
      - `apps/mobile/src/assets/illustrations/rig@2x.png` — 560×560 px
      - `apps/mobile/src/assets/illustrations/rig@3x.png` — 840×840 px
      - `apps/mobile/src/assets/illustrations/rig.png` — 1x copy

    Source for rig illustration: prefer the `prototype.html` `#rig-tutorial` block illustration; if no clean source, capture the Phase 2 placeholder + open Open Question OQ for the design pass (operator picks).

    Add a `prebuild` step to `apps/mobile/package.json` `scripts` block that runs `npx --yes react-native-asset` so Metro picks up the new buckets through any `require()` path. If `react-native-asset` is not already a devDep, add `"react-native-asset": "^2.1.1"` to `devDependencies`.

    DO NOT edit `apps/mobile/src/screens/splash/SplashScreen.tsx`, `SignupScreen.tsx`, `HomeSkeletonScreen.tsx`, or `RigTutorialScreen.tsx` in this task — Plan 03-02 wires the new asset paths into the screen components. This task is asset-and-config only.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && ls src/assets/logos/orange_logo@1x.png src/assets/logos/orange_logo@2x.png src/assets/logos/orange_logo@3x.png src/assets/logos/orange_logo.png src/assets/illustrations/rig@1x.png src/assets/illustrations/rig@2x.png src/assets/illustrations/rig@3x.png src/assets/illustrations/rig.png && grep -q react-native-asset package.json && grep -q '"prebuild"' package.json</automated>
  </verify>
  <acceptance_criteria>
    - `ls apps/mobile/src/assets/logos/orange_logo@1x.png apps/mobile/src/assets/logos/orange_logo@2x.png apps/mobile/src/assets/logos/orange_logo@3x.png apps/mobile/src/assets/logos/orange_logo.png` exits 0
    - `ls apps/mobile/src/assets/illustrations/rig@1x.png apps/mobile/src/assets/illustrations/rig@2x.png apps/mobile/src/assets/illustrations/rig@3x.png apps/mobile/src/assets/illustrations/rig.png` exits 0
    - `apps/mobile/package.json` contains `"react-native-asset"` in `devDependencies` (string match)
    - `apps/mobile/package.json` contains `"prebuild":` key under `scripts` (string match)
    - Each `@1x.png` is exactly 320×96 px (logo) or 280×280 px (rig); each `@2x.png` is exactly twice the @1x dimensions; each `@3x.png` is exactly thrice — verify with `file apps/mobile/src/assets/logos/orange_logo@1x.png` (output line includes "320 x 96")
  </acceptance_criteria>
  <done>Density-bucketed logo + rig illustration assets exist on disk; package.json carries the prebuild hook; no screen file edited yet (Plan 03-02 wires).</done>
</task>

<task type="auto">
  <name>Task 2: Add jest-image-snapshot dev dep + Vitest expect.extend adapter</name>
  <files>apps/mobile/package.json, apps/mobile/vitest.setup.ts, apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep</files>
  <read_first>
    - apps/mobile/vitest.setup.ts (current setup — host-component shim from Pattern 39)
    - apps/mobile/vitest.config.ts (existing config — no test-pattern restrictions expected)
    - apps/mobile/__tests__/screens/HomeSkeletonScreen.test.tsx (the existing screen test pattern)
    - .planning/phases/03-humyn-capture-native-module/03-CONTEXT.md (D-WAVE-06 — jest-image-snapshot driven through Vitest)
    - .planning/phases/03-humyn-capture-native-module/03-PATTERNS.md (Wave 1 visual snapshot tests section)
  </read_first>
  <action>
    Add `jest-image-snapshot` dev dep to `apps/mobile/package.json`:

      `"jest-image-snapshot": "^6.4.0"` under `devDependencies`

    Then add a Vitest adapter to `apps/mobile/vitest.setup.ts`. The adapter calls `expect.extend({ toMatchImageSnapshot })` so screen tests in Plan 03-02 can call `expect(png).toMatchImageSnapshot()`. Place the import + extend at the top of the setup file (after the existing host-component shim block, before any `vi.mock(...)`):

    ```ts
    import { toMatchImageSnapshot } from 'jest-image-snapshot';
    import { expect } from 'vitest';
    expect.extend({ toMatchImageSnapshot });
    declare module 'vitest' {
      interface Assertion<T = unknown> {
        toMatchImageSnapshot(opts?: Parameters<typeof toMatchImageSnapshot>[0]): T;
      }
      interface AsymmetricMatchersContaining {
        toMatchImageSnapshot(opts?: Parameters<typeof toMatchImageSnapshot>[0]): unknown;
      }
    }
    ```

    Create the baseline directory `apps/mobile/__tests__/visual/__image_snapshots__/` (the default jest-image-snapshot output path) with a `.gitkeep` so it commits empty until Plan 03-02 generates the first PNGs.

    Do NOT add a separate vitest config for visual tests — they run through the existing Vitest 4.x runner. The default `customSnapshotsDir` is `__image_snapshots__` adjacent to each test file; jest-image-snapshot resolves it automatically. PNG baselines are committed (not gitignored) per D-WAVE-06.

  </action>
  <verify>
    <automated>cd /Users/adnaan/Documents/hl-homelander/apps/mobile && grep -q '"jest-image-snapshot"' package.json && grep -q "toMatchImageSnapshot" vitest.setup.ts && test -d __tests__/visual/__image_snapshots__</automated>
  </verify>
  <acceptance_criteria>
    - `apps/mobile/package.json` contains `"jest-image-snapshot"` in `devDependencies`
    - `apps/mobile/vitest.setup.ts` contains `import { toMatchImageSnapshot } from 'jest-image-snapshot'`
    - `apps/mobile/vitest.setup.ts` contains `expect.extend({ toMatchImageSnapshot })`
    - `apps/mobile/vitest.setup.ts` contains a `declare module 'vitest'` block exposing `toMatchImageSnapshot` on `Assertion`
    - `apps/mobile/__tests__/visual/__image_snapshots__/.gitkeep` exists
    - `cd apps/mobile && npx tsc --noEmit` exits 0 (vitest setup compiles cleanly under existing tsconfig)
  </acceptance_criteria>
  <done>jest-image-snapshot dev dep + Vitest adapter wired; baseline dir exists.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                     | Description                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| user device → app build      | Asset bundling: bundle could include unintended files (PII in source PNG metadata) |
| user device → on-disk assets | App-private `assets/` directory; world-readable on rooted devices                  |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                | Disposition | Mitigation Plan                                                                                                                        |
| --------- | ---------------------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| T-3.1-01  | Information disclosure | logo @1x/@2x/@3x PNGs in `apps/mobile/src/assets/logos/` | accept      | Source PNGs from `design-system/logos/` are brand assets with no PII; ImageMagick re-export strips EXIF by default. No further action. |
| T-3.1-02  | Tampering              | jest-image-snapshot baselines (Plan 03-02 produces them) | mitigate    | PNG baselines committed to git; PR review surfaces unintended baseline churn (D-WAVE-06 stated rationale).                             |

</threat_model>

<verification>
- 8 PNG files (4 logo + 4 rig variants) exist on disk with the correct pixel dimensions.
- `cd apps/mobile && npx tsc --noEmit` exits 0 (vitest.setup.ts compiles cleanly).
- `package.json` carries the prebuild script + jest-image-snapshot devDep.
- `__tests__/visual/__image_snapshots__/.gitkeep` exists (baseline dir committed empty).
- No screen file edited (Plan 03-02 owns wiring + tests).
</verification>

<success_criteria>

- ✓ Pre-cropped @1x/@2x/@3x logo + rig illustration assets exist under `apps/mobile/src/assets/{logos,illustrations}/`.
- ✓ `apps/mobile/package.json` carries the `jest-image-snapshot` dev dep + `prebuild` script.
- ✓ `apps/mobile/vitest.setup.ts` has `expect.extend({ toMatchImageSnapshot })` adapter.
- ✓ Empty baseline directory `apps/mobile/__tests__/visual/__image_snapshots__/` committed via `.gitkeep`.
- ✓ Existing Phase 2 screen tests still pass (no regressions).
  </success_criteria>

<output>
After completion, create `.planning/phases/03-humyn-capture-native-module/03-01-SUMMARY.md` per the canonical summary template — including the density-bucket asset pattern + the Vitest jest-image-snapshot adapter pattern callouts. Plan 03-02 will reference these patterns when wiring screens + authoring baselines.
</output>
