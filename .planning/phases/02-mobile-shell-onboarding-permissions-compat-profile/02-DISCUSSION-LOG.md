# Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 2-mobile-shell-onboarding-permissions-compat-profile
**Areas discussed:** Nav library & onboarding gating, Compat-check execution path (COMPAT-07), Design tokens & primitive components, Forced-upgrade flow per-flavor, pnpm migration

---

## Nav library & onboarding gating

### Q1 — Which navigation library?

| Option                                           | Description                                                                                                         | Selected |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| React Navigation v7 (native-stack + bottom-tabs) | RN 0.83 + Hermes new-arch compatible; native-stack uses platform UINavigationController/Fragment; battle-tested     | ✓        |
| Expo Router (file-based)                         | Adds Expo packaging assumptions; we're on bare RN; some friction with custom Kotlin native modules + Gradle flavors |          |
| Hand-rolled stack (Context + screen array)       | Smallest deps; we re-implement deep links, hardware-back, replace/reset, modal stacks, transitions                  |          |

### Q2 — Navigator graph shape (HOME-08 nav suppression)

| Option                                                                                                        | Description                                                                                                                                                 | Selected |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Root native-stack > {Onboarding stack, Main tabs (Home/Tasks/History), Recording, Player, ForceUpgrade modal} | Bottom tabs only mounted inside MainTabs; Profile pushes onto root via avatar tap; suppression automatic                                                    | ✓        |
| Single bottom-tab root with custom tabBar that hides itself per route                                         | Simpler tree but harder to satisfy 'no back to splash/sign-up' (replace semantics) and harder to model recording surface as a full-bleed overlay above tabs |          |
| Two roots toggled by app state (onboarding vs main)                                                           | Avoids any nav suppression logic but transitions between roots are unnatural; deep links across boundaries get awkward                                      |          |

### Q3 — Onboarding-state persistence

| Option                                                                | Description                                                                                     | Selected |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| MMKV keys in `humyn.secure` instance + tiny in-memory store (Zustand) | Single MMKV instance already wired; Zustand hydrates on boot; selectors handy for Phase 6 tiles | ✓        |
| MMKV + React Context only (no Zustand)                                | Lower dep count, fine at this scale; loses Zustand selectors                                    |          |
| AsyncStorage instead of MMKV                                          | AsyncStorage is slower and not encrypted; contradicts PROJECT.md / STACK.md MMKV lock           |          |

### Q4 — Background-mid-onboarding resume

| Option                                                                                      | Description                                                                                                               | Selected |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Resume at last completed onboarding step; transient screens (Compat run) restart themselves | Navigator initialRoute computed from MMKV flags; OS-Settings permission grants picked up via AppState foreground re-check | ✓        |
| Always restart onboarding from the last screen the user _saw_                               | Closer to native iOS behavior, but persists half-state we don't want                                                      |          |
| Always restart onboarding from Sign-up after any cold start                                 | Fails AUTH-07 (session persistence) for users past sign-up but not past compat                                            |          |

---

## Compat-check execution path (COMPAT-07)

### Q1 — Native-module structure

| Option                                                           | Description                                                                            | Selected |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Slim `HumynCompat` native module — separate from HumynCapture    | Two focused modules; Phase 3 starts fresh on full pipeline; no shared library overhead | ✓        |
| Pull HumynCapture forward into Phase 2; Compat is a thin wrapper | Avoids duplication; but Phase 2 takes on Phase 3's risk                                |          |
| Shared `humynkit-camera` Kotlin library — both modules consume   | Cleanest engineering but adds Gradle subproject + module-publishing config             |          |

### Q2 — `compatSignature` definition (for COMPAT-04 re-run)

| Option                                                            | Description                                                                                          | Selected |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| `appVersionCode + Build.FINGERPRINT + installation_id`            | UUID minted at first launch in MMKV; honors AUTH-11 because reinstall on new device mints fresh UUID | ✓        |
| `appVersionCode + Build.FINGERPRINT + Settings.Secure.ANDROID_ID` | ANDROID_ID is per-app-signing-key; survives reinstall — fails 'new device' detection                 |          |
| `appVersionCode + osBuildNumber` only                             | Simpler but fails AUTH-11 unless wired separately on backend                                         |          |

### Q3 — Probe clip storage

| Option                                                              | Description                                                                                       | Selected |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| App cache dir, deleted immediately after parse                      | 5 MB temp file; finally-block delete; app-launch sweep removes orphans; never enters upload queue | ✓        |
| In-memory only — MediaCodec output buffer parsed without disk write | Lowest disk impact; higher complexity for the encoder feed path                                   |          |
| Files-dir under `probes/` subfolder — explicit retention            | Allows post-hoc debugging; raises DPDP/LGPD scope questions                                       |          |

### Q4 — Result reporting

| Option                                                                | Description                                                                                                 | Selected |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Structured `CompatResult` Zod schema in shared/types/, stored in MMKV | failedKeys drives COMPAT-06 fail screen; signature drives re-run; measured fields drive 'yours: 44 Hz' copy | ✓        |
| Boolean + opaque error string                                         | COMPAT-06 needs the _list_ of failed checks, not a string                                                   |          |
| Send all results to backend; backend is source of truth               | Heavyweight; conflicts with offline-friendly local-only design                                              |          |

---

## Design tokens & primitive components

### Q1 — Tokens implementation

| Option                                                                        | Description                                                                                                                           | Selected |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typed-constants module `apps/mobile/src/ui/tokens.ts` + StyleSheet primitives | Zero runtime dep; works with Hermes new-arch; consistent with Phase 1's inline-hex pattern; light-only at MVP needs no theme provider | ✓        |
| Restyle (Shopify) — typed theme + responsive variants                         | Stronger type safety; overkill at light-only MVP                                                                                      |          |
| NativeWind / Tamagui (utility-first)                                          | Big DX win but build-system complexity on top of already-flaky Gradle setup                                                           |          |

### Q2 — Primitive set

| Option                                                                                | Description                                                                            | Selected |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Minimal: Text, Button, Pressable, ScreenContainer, Sheet, Modal, Field + Icon wrapper | Eight primitives covering every Phase 2 screen + setting precedent for Phase 6         | ✓        |
| Bigger set including TaskCard, Tile, Accordion, ProgressRing, Toast                   | Faster Phase 6 if set up now; risks API churn when Phase 6 reveals unanticipated needs |          |
| Just the screens — no shared primitive layer                                          | Inline StyleSheet per screen; bad fit for 41-requirement Phase 2                       |          |

### Q3 — Font loading

| Option                                                                      | Description                                                                         | Selected |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Bundle via `react-native-asset` link — fonts in `apps/mobile/assets/fonts/` | Standard RN font wiring; one-shot link into Android assets/fonts and iOS Info.plist | ✓        |
| Use Expo Font (loads at runtime)                                            | Adds Expo runtime; we're on bare RN                                                 |          |
| Manual copy into platform asset dirs — no asset-link tooling                | Fragile; hard to keep in sync between platforms                                     |          |

### Q4 — Icons

| Option                                                                                  | Description                                                                 | Selected |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| `lucide-react-native` for general icons + reuse existing `<TaskIcon>` for task-specific | LucideIconName taxonomy locked at compile-time; both render same Lucide set | ✓        |
| `react-native-svg` only — inline SVG strings copied from lucide.dev                     | Smallest bundle; highest maintenance                                        |          |
| react-native-vector-icons + Lucide font subset                                          | Inconsistent with existing taxonomy                                         |          |

---

## Forced-upgrade flow per-flavor

### Q1 — Per-flavor routing

| Option                                                                                | Description                                                                                | Selected |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Flavor-aware single screen — reads `flavor` from AppFlavor module, routes accordingly | apkRollout → in-app PackageInstaller; playStore → market://; reuses existing flavor wiring | ✓        |
| Two screens — ApkRolloutForceUpgrade + PlayStoreForceUpgrade                          | Cleaner separation but duplicated layout                                                   |          |
| Always Play-Store deep-link — ignore the apkRollout PackageInstaller path             | Breaks D-APK-02; apkRollout users have no path to new APK                                  |          |

### Q2 — Version-check timing

| Option                                                                                      | Description                                                                                              | Selected |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| Fire during Splash (cold start) before any other UI; cache in MMKV with fetchedAt timestamp | Splash mounts → reads MMKV cache → calls /app/version if stale; force-block decisions fire after resolve | ✓        |
| Fire after sign-in completes — don't gate splash                                            | Wastes work; force-upgrade-required user sees full sign-in before being told to upgrade                  |          |
| Fire continuously every N minutes while app is foreground                                   | Increases backend load needlessly                                                                        |          |

### Q3 — APK install consent + hash failure handling

| Option                                                    | Description                                                                                | Selected |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Just-in-time consent + abort + telemetry on hash mismatch | SHA-256 verify; on mismatch, delete file, show error, emit force_upgrade_apk_hash_mismatch | ✓        |
| Verify on demand without telemetry                        | Loses visibility into real-world hash failures                                             |          |
| Skip SHA-256 verify; trust HTTPS                          | A misconfigured CloudFront origin / stale apk_sha256 could ship a bad bundle               |          |

### Q4 — Soft-upgrade banner placement + dismiss

| Option                                                           | Description                                                             | Selected |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| Top of Home screen; dismiss persists per-version-string in MMKV  | Per-`latest` key auto-resets when version advances; matches design-spec | ✓        |
| Global app-shell banner above the bottom nav, visible everywhere | Visually heavier; design-spec doesn't show this                         |          |
| Profile > Help Center entry only — no Home banner                | Contradicts UPG-04 'dismissible soft banner on Home'                    |          |

---

## pnpm migration

### Q1 — Migration scope

| Option                                                                                     | Description                                                                                                        | Selected |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Isolate `apps/mobile/` from the pnpm workspace; keep pnpm at the root for backend + shared | Targets actual broken thing without churning backend; two install commands at root but each canonical for its half | ✓        |
| Migrate the whole monorepo to npm (or yarn 4 workspaces)                                   | Largest blast radius; backend doesn't have the problem                                                             |          |
| Stay on pnpm + `public-hoist-pattern[]=*` and `shamefully-hoist=true`                      | Aggressive hoisting; loses pnpm's strict-deps benefits                                                             |          |
| You decide                                                                                 | Researcher reads actual Gradle logs and picks                                                                      |          |

### Q2 — Mobile package manager + shared/types consumption

| Option                                                       | Description                                                                       | Selected |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------- |
| npm + `file:` link to shared/types                           | Flat, no symlinks, no surprise resolution; canonical for RN + Gradle expectations | ✓        |
| yarn classic (1.22) with `nohoist` + workspaces              | yarn 1 in maintenance mode; three package managers in CI is bad                   |          |
| Mobile uses pnpm with its own pnpm-workspace at apps/mobile/ | Doesn't solve the symlink problem                                                 |          |
| Bun install                                                  | Risky to bet a Phase 2 critical-path migration on still-maturing tool             |          |

### Q3 — Cleanup aggressiveness

| Option                                                                 | Description                                                            | Selected |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| Update only what breaks: CI workflow, root scripts, lint-staged config | Phase 1 historical docs left intact; describe state at their timestamp | ✓        |
| Full sweep — rewrite Phase 1 docs, .planning/STATE.md, summaries       | Throws Phase 1 history into 'what we did then vs now' confusion        |          |
| Big-bang rewrite — move backend to npm too, single tool                | Already rejected                                                       |          |

### Q4 — Plan layout

| Option                                                                         | Description                                                                     | Selected |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------- |
| Dedicated first plan (`02-01-mobile-npm-migration`) — lands before any RN work | Atomic migration; once green, every subsequent plan builds on stable foundation | ✓        |
| Folded into the existing scaffolding plan                                      | Violates 'one PR, one concern' rule                                             |          |
| Keep pnpm; spike `shamefully-hoist` first                                      | Already decided to migrate                                                      |          |

---

## Claude's Discretion

- Motion / animation library (default: Reanimated 3)
- Haptics library (default: `react-native-haptic-feedback`)
- Toast implementation (default: hand-rolled using `Sheet` primitive)
- Inline-edit Field UX micro-details (keyboard avoidance, focus management, error display position)
- Help-Center markdown parsing tool (default: small Node script using `marked`)
- Semver comparison helper for `installedVersion` (default: hand-rolled)
- Splash duration / animation specifics (~2.4 s minimum)
- Deep-link route handling for Phase-4/6 surfaces (default: placeholder handlers resolving to "Coming soon")
- `react-native-permissions` vs platform-direct (default: `react-native-permissions`)
- Profile Joined-date formatting

## Deferred Ideas

- PROJECT.md / REQUIREMENTS.md / ROADMAP.md cleanup of stale clan-chief / KGeN narrative (carried forward from Phase 1)
- Practice recording, hand-gate UX, recording surface (Phase 4)
- Tasks browsing, Task details sheet, Send Request form, History list, Player (Phase 6)
- Upload pipeline + diagnostic-snapshot delivery via piggy-backing (Phase 5)
- iOS analogues — `HumynCompat` Swift analogue, fonts wired into iOS (Phase 7)
- Reanimated motion tuning, fancy transitions (planner-level inside each Phase 2 plan)
- Profile name validation specifics (length limits, profanity filtering)
- Coarse Location permission prompt (Phase 4 — delayed to first recording)
- Help-Center markdown live-reload during dev (nice-to-have)
- In-app restore-account UX (v2)
- APK download progress UI polish (planner-level)
- Soft-banner copy A/B testing (v2)
- Compat-tightening propagation flow (Remote Config bar-raising — planner-level inside Phase 2 if scope allows, else slips to Phase 4)
- APK SHA-256 fingerprint disclosure UX in Profile / Help Center (planner picks within Phase 2)
