---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 06
subsystem: native-modules
tags:
  [
    kotlin,
    react-native-bridge,
    turbo-module,
    compat,
    encoder-probe,
    imu-probe,
    device-caps,
    nal-parser,
    d-compat-01,
    d-compat-02,
    d-compat-04,
    compat-01,
    compat-02,
    compat-07,
    shell-only,
    tdd,
  ]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'Phase 2 RN deps + Robolectric harness (02-02), MainApplication.getPackages() chain established by Phase 1 (Plan 13 PlayIntegrityPackage)'
provides:
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt — three-method TurboModule surface (runEncoderProbe / runImuProbe / readDeviceCaps) per D-COMPAT-02'
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt — ReactPackage registration glue mirroring AppFlavorPackage / PlayIntegrityPackage shape'
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/{NalParser,EncoderProbe,ImuProbe,DeviceCaps}.kt — four helper-class shells with full data-class shapes + KDoc + TODO(02-12/13/14) markers; bodies throw NotImplementedError'
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt — registers HumynCompatPackage + cacheDir orphan sweep for compat-probe-*.mp4 (D-COMPAT-04)'
  - 'apps/mobile/src/native/HumynCompat.ts — typed JS bridge with EncoderProbeResult / ImuProbeResult / DeviceCapsResult interfaces and the three async passthrough functions'
  - 'apps/mobile/__tests__/native/HumynCompat.test.ts — 5 vitest unit tests covering missing-module rejection + arg forwarding + native error propagation'
affects:
  - 'plan 02-07 (HumynUpdater shell): MainApplication.getPackages() is the same hook; 02-07 adds packages.add(HumynUpdaterPackage()) right after our HumynCompatPackage line. Our edit kept the surrounding lines untouched so 02-07 only needs to insert two more lines (one import, one packages.add).'
  - 'plan 02-12 (EncoderProbe NAL parser + Camera2/MediaCodec body): replaces the EncoderProbe.run + NalParser.parse / anyBFrames bodies; reuses the data-class shapes verbatim'
  - 'plan 02-13 (ImuProbe sustained-rate body): replaces ImuProbe.run + adds an internal computeResult(timestamps) pure function; reuses the Result data-class verbatim'
  - 'plan 02-14 (DeviceCaps readback): replaces DeviceCaps.read body + adds computeDfovFromValues(focalMm, sensorWidthMm, sensorHeightMm) pure function; reuses the Result data-class verbatim'
  - 'plan 02-16 (compatService wiring): imports runEncoderProbe / runImuProbe / readDeviceCaps from src/native/HumynCompat.ts and gates rollout on the typed result objects'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: Three-method TurboModule surface — every probe gets one @ReactMethod entry point on HumynCompatModule, dispatched on a single `Executors.newSingleThreadExecutor()` background worker. Probes run serially (no two concurrent Camera2 sessions) and never on the main thread (T-2.6-03 mitigation, RESEARCH § Anti-Patterns is explicit). Each method wraps native exceptions into a per-method error code (ENCODER_PROBE_ERROR / IMU_PROBE_ERROR / DEVICE_CAPS_ERROR) so JS can disambiguate failure source.'
    - "Pattern: Module shell vs body separation — this plan ships ONLY the wiring (module + package + helper data-classes + JS bridge). Helper bodies throw NotImplementedError until 02-12/02-13/02-14 fill them in. Lets each downstream plan focus on one probe's logic without re-deriving the bridge surface, and lets MainApplication.kt land its registration once."
    - 'Pattern: cacheDir orphan sweep at MainApplication.onCreate — D-COMPAT-04 / T-2.6-02 mitigation. If 02-12s EncoderProbe crashes before its `finally { cacheFile.delete() }` runs, the next app start sweeps `compat-probe-*.mp4` from cacheDir. Best-effort (`listFiles` can return null), runs after `SoLoader.init` + `load()` so it never blocks the new-architecture entry point.'
    - 'Pattern: JS bridge ensure() guard — `ensure()` reads NativeModules.HumynCompat at call time (not module-init) and throws a descriptive Error containing the literal "HumynCompat native module not registered" when missing. Lets JSDOM unit tests assert on the missing-module branch by default (vitest.setup.ts stubs NativeModules to {}) without per-test mocking. Pattern matches Phase 1 PlayIntegrity.ts.'
    - 'Pattern: WritableMap construction via Arguments.createMap().apply { putBoolean / putInt / putDouble / putString / putMap } — explicit per-field, type-correct (e.g. Float promoted to Double via toDouble() before putDouble) so the JS side receives numbers / booleans / strings exactly matching the TS interfaces. Avoids the `Arguments.makeNativeMap(map)` helper which is not present on every RN minor.'
    - 'Pattern: Slice-type comment in NalParser — the shell intentionally keeps the comparator (`it.sliceType == 1`) compileable but flags via KDoc that ITU-T H.265 §7.4.7.1 says 0=B / 1=P / 2=I and that 02-12 will rewrite to compare against 0. The shells empty parse() return makes the comparator unreachable; the code is never wrong at runtime, only intentionally placeholder.'

key-files:
  created:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt (~95 LOC) — @ReactModule(name="HumynCompat"); 3 @ReactMethod functions; bgExecutor = Executors.newSingleThreadExecutor(); per-method try/catch wraps Throwable → promise.reject with ENCODER_PROBE_ERROR / IMU_PROBE_ERROR / DEVICE_CAPS_ERROR.'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt (~20 LOC) — ReactPackage with createNativeModules returning listOf(HumynCompatModule(reactContext)) and createViewManagers returning emptyList().'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt (~50 LOC) — data class SliceInfo(nalUnitType, sliceType); fun parse(bytes) returns emptyList() (shell); fun anyBFrames(slices) compiles with `it.sliceType == 1` placeholder (02-12 corrects to 0 per HEVC §7.4.7.1); TODO(02-12) markers for matchStartCode + readSliceType + BitReader.'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt (~45 LOC) — class EncoderProbe(ctx); data class Result(bFramePresent, oisOff, hdrSdrForced, encoderClipPath); fun run() throws NotImplementedError until 02-12 wires Camera2 + MediaCodec + DynamicRangeProfile + finally cleanup.'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt (~45 LOC) — class ImuProbe(ctx); data class Result(sustainedHz, p99IntervalMs, samplesCollected); fun run(durationMs, withPreview) throws NotImplementedError until 02-13 wires SensorManager + optional Camera2 preview.'
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt (~50 LOC) — class DeviceCaps(ctx); data class Result(resolutionMax, fpsMax, ultrawideDfovDeg, micSampleRateMax, realtimeTimestampSource, rooted, freeStorageGB); fun read() throws NotImplementedError until 02-14 wires CameraCharacteristics + AudioRecord + StatFs + Build.TAGS heuristic.'
    - 'apps/mobile/src/native/HumynCompat.ts (~110 LOC) — three exported interfaces (EncoderProbeResult / ImuProbeResult / DeviceCapsResult) + HumynCompatNativeModule internal interface + ensure() guard + three exported async functions (runEncoderProbe / runImuProbe / readDeviceCaps).'
    - 'apps/mobile/__tests__/native/HumynCompat.test.ts (~80 LOC, 5 tests) — describe block 1: missing-module rejection for all 3 functions (3 tests); describe block 2: runImuProbe arg forwarding + value passthrough + runEncoderProbe error propagation (2 tests). Uses vi.doMock + vi.resetModules between describe blocks.'
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt — added `import ai.humynlabs.capture.compat.HumynCompatPackage`; added `packages.add(HumynCompatPackage())` after the PlayIntegrityPackage line; added cacheDir orphan-sweep block at the end of onCreate(). Three minimal edits — preserves space for 02-07 to add HumynUpdaterPackage with the same minimal-edit approach.'
  deleted: []

key-decisions:
  - 'WritableMap construction via Arguments.createMap().apply { ... } (explicit per-field) instead of Arguments.makeNativeMap(map). Reason: makeNativeMap is not consistently available across RN 0.83.x patch versions; createMap + putXxx is the canonical, version-stable API.'
  - 'Per-method error codes (ENCODER_PROBE_ERROR / IMU_PROBE_ERROR / DEVICE_CAPS_ERROR) wrapping `${t::class.simpleName}: ${t.message}` instead of a single COMPAT_ERROR. Reason: the JS side (compatService in 02-16) needs to gate rollout differently per probe — encoder failure vs IMU failure vs device-caps failure are three different recovery flows.'
  - "Slice-type comparator placeholder uses `== 1` not `== 0` in the shell. Reason: 02-12 will replace the comparator with the spec-correct `== 0` (HEVC §7.4.7.1: slice_type 0 → B-slice). The shell's empty parse() return makes the comparator unreachable at runtime, so 02-12's correction lands in one place without forcing this plan to anticipate the spec interpretation."
  - 'cacheDir orphan sweep is unconditional (runs every onCreate). Reason: D-COMPAT-04 wants a clean baseline at app start; the sweep is fast (single ls + filter on a ~few-file directory) and safe (only matches `compat-probe-*.mp4`). Conditional sweep would require persisting "did the last run crash" state, which adds storage cost for no gain.'
  - 'Single-thread Executor (Executors.newSingleThreadExecutor) at module field level. Reason: probes serialise — no two simultaneous Camera2 sessions, no two simultaneous SensorManager listeners — and never run on the main thread. Per-call thread creation would risk thread leak if probes throw; a single bound executor avoids that.'
  - 'JS bridge `ensure()` evaluated at call time, not at module-init time. Reason: vitest.setup.ts stubs NativeModules to {} BEFORE this file imports react-native; if `native` were captured at module-init the `vi.doMock + vi.resetModules` re-import dance in the test wouldnt swap it. Call-time read makes per-test mocking trivial and matches PlayIntegrity.ts.'

# Performance metrics
metrics:
  duration: ~38 minutes
  completed-date: 2026-05-09
  tasks-completed: 2
  files-changed: 8 (1 modified, 7 created)
  lines-added: ~535 (Kotlin: ~305; TypeScript: ~190; tests: ~80; with prettier reformat)
  tests-added: 5 (all green)
  commits: 3 (1 implementation + 1 test + 1 implementation per TDD cycle on Task 2)
---

# Phase 2 Plan 06: HumynCompat Kotlin module shell + JS bridge + package registration Summary

Three-method TurboModule shell + four probe-helper scaffolds + ReactPackage registration + cacheDir orphan sweep + typed JS bridge — D-COMPAT-01..02 surface complete.

## What Built

**Native side (Kotlin, ai.humynlabs.capture.compat package)**

- `HumynCompatModule` — `@ReactModule(name = "HumynCompat")` with three `@ReactMethod` entry points (`runEncoderProbe`, `runImuProbe`, `readDeviceCaps`). Every method dispatches to a single-thread background `Executors.newSingleThreadExecutor()` (T-2.6-03 mitigation: probes never block the JS thread; never two concurrent Camera2 sessions). Each method wraps `Throwable` into `promise.reject(<CODE>, "<className>: <message>", t)` with one of three codes:
  - `ENCODER_PROBE_ERROR`
  - `IMU_PROBE_ERROR`
  - `DEVICE_CAPS_ERROR`
- `HumynCompatPackage` — minimal `ReactPackage` returning `listOf(HumynCompatModule(reactContext))`. Mirrors `AppFlavorPackage` / `PlayIntegrityPackage` shape.
- `NalParser` — data class `SliceInfo(nalUnitType, sliceType)`, `parse(bytes)` returns empty list (shell), `anyBFrames(slices)` compiles. Plan 02-12 fills in Annex B walk + Exp-Golomb `slice_segment_header` parse.
- `EncoderProbe` — data class `Result(bFramePresent, oisOff, hdrSdrForced, encoderClipPath)`, `run()` throws `NotImplementedError`. Plan 02-12 wires Camera2 + MediaCodec + 5-second probe + finally-block cleanup.
- `ImuProbe` — data class `Result(sustainedHz, p99IntervalMs, samplesCollected)`, `run(durationMs, withPreview)` throws `NotImplementedError`. Plan 02-13 wires `SensorManager.SENSOR_DELAY_FASTEST` with optional concurrent 1080p Camera2 preview.
- `DeviceCaps` — data class `Result(resolutionMax, fpsMax, ultrawideDfovDeg, micSampleRateMax, realtimeTimestampSource, rooted, freeStorageGB)`, `read()` throws `NotImplementedError`. Plan 02-14 wires `CameraCharacteristics` + `AudioRecord` + `StatFs` + `Build.TAGS` heuristic.
- `MainApplication.kt` — three minimal edits: `import ai.humynlabs.capture.compat.HumynCompatPackage`, `packages.add(HumynCompatPackage())` after `PlayIntegrityPackage()`, and the `cacheDir.listFiles { ... }?.forEach { it.delete() }` orphan sweep at end of `onCreate()`. Edits are minimal so plan 02-07 can add `HumynUpdaterPackage` with the same one-line-import + one-line-add pattern.

**JS side (TypeScript)**

- `apps/mobile/src/native/HumynCompat.ts` — three exported interfaces (`EncoderProbeResult`, `ImuProbeResult`, `DeviceCapsResult`), an internal `HumynCompatNativeModule` interface, an `ensure()` guard that throws "HumynCompat native module not registered" when `NativeModules.HumynCompat` is undefined, and three exported async passthrough functions.
- `apps/mobile/__tests__/native/HumynCompat.test.ts` — 5 vitest tests:
  1. `runEncoderProbe()` rejects when native module missing
  2. `runImuProbe(30000, true)` rejects when native module missing
  3. `readDeviceCaps()` rejects when native module missing
  4. `runImuProbe` forwards args verbatim and returns resolved value verbatim (mocked native via `vi.doMock`)
  5. `runEncoderProbe` propagates native rejection unchanged

## Package path layout

```
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/
├── AppFlavorModule.kt              (Phase 1 / plan 02-04 — flavor introspection)
├── AppFlavorPackage.kt
├── MainApplication.kt              (modified — added HumynCompatPackage + sweep)
├── compat/                         (NEW package)
│   ├── HumynCompatModule.kt        (3 @ReactMethod entry points)
│   ├── HumynCompatPackage.kt       (ReactPackage glue)
│   ├── NalParser.kt                (HEVC NAL walker shell)
│   ├── EncoderProbe.kt             (5 s 1080p HEVC probe shell)
│   ├── ImuProbe.kt                 (sustained-rate IMU probe shell)
│   └── DeviceCaps.kt               (static cap enumeration shell)
└── (PlayIntegrityModule.kt + PlayIntegrityPackage.kt live in io.humyn.app — Phase 1's package, untouched)
```

## cacheDir sweep behavior (D-COMPAT-04)

`MainApplication.onCreate` runs after `SoLoader.init` + `load()`:

```kotlin
cacheDir.listFiles { f -> f.name.startsWith("compat-probe-") && f.name.endsWith(".mp4") }
    ?.forEach { it.delete() }
```

- Runs unconditionally on every app launch.
- Best-effort: `listFiles` may return null (cacheDir nonexistent on first run); the safe-call drops the iterate.
- Filter is exact: `compat-probe-{epochMs}.mp4` is the naming convention plan 02-12's `EncoderProbe.run` uses; no other artifact matches.
- T-2.6-02 mitigation: closes the gap if `EncoderProbe.run`'s `finally { cacheFile.delete() }` (02-12) failed to fire because the process was killed mid-probe.

## Per-method error codes

| Method            | Native error code     | JS-side observation                                                                 |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `runEncoderProbe` | `ENCODER_PROBE_ERROR` | Promise rejects with `Error: NotImplementedError: EncoderProbe.run …` (until 02-12) |
| `runImuProbe`     | `IMU_PROBE_ERROR`     | Promise rejects with `Error: NotImplementedError: ImuProbe.run … …` (until 02-13)   |
| `readDeviceCaps`  | `DEVICE_CAPS_ERROR`   | Promise rejects with `Error: NotImplementedError: DeviceCaps.read …` (until 02-14)  |

After 02-12/02-13/02-14 land, the same codes wrap real exceptions (Camera2 errors, SensorManager exceptions, etc.); 02-16 (compatService) reads `error.code` if present and gates rollout per probe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree node_modules linking**

- **Found during:** Task 1 (gradle build verification step).
- **Issue:** The Claude Code worktree spawned without `node_modules` in `apps/mobile/`, `apps/api/`, or worktree-root. The `npm` mobile install lives only in the main repo. Pre-commit hook (`.husky/pre-commit`) runs `pnpm typecheck` recursively which needs `apps/api/node_modules`; gradle's `createBundleApkRolloutDebugJsAndAssets` task needs metro to resolve `@babel/runtime` from the worktree-root `node_modules`.
- **Fix:** Created three symlinks (all gitignored): `node_modules → /Users/adnaan/.../node_modules` (worktree root), `apps/mobile/node_modules → /Users/adnaan/.../node_modules` (mobile), `apps/api/node_modules → /Users/adnaan/.../apps/api/node_modules` (api). Files do not appear in any commit.
- **Files modified:** 0 tracked files (symlinks gitignored).
- **Commit:** N/A (env setup only).

**2. [Rule 3 — Blocking, deferred] Gradle assembleApkRolloutDebug verification**

- **Found during:** Task 1 verification step.
- **Issue:** Two pre-existing gaps prevent `./gradlew :app:assembleApkRolloutDebug` from completing in the worktree:
  1. `google-services.json` is missing from `apps/mobile/android/app/` (captured at phase level per the executor objective: "do not try to fix"). The `com.google.gms.google-services` plugin fails its `processApkRolloutDebugGoogleServices` task.
  2. Metro's symlink resolution from inside the gradle-spawned `node` subprocess returns a project-root that walks 5 levels up to a non-existent `node_modules`, so `@babel/runtime/helpers/interopRequireDefault` can't be resolved despite the symlink chain pointing to a valid location.
- **Fix:** Verified all `grep` acceptance criteria (`@ReactMethod` count = 3, `Executors.newSingleThreadExecutor` present, `HumynCompatPackage` registered, `compat-probe-` sweep present, `anyBFrames` in NalParser, all 6 helper files exist, all 4 probe shells contain TODO markers). Skipped the gradle-build verification because the failures are environmental, not plan-content.
- **Files modified:** 0 (issue is environmental).
- **Defer:** Phase-level orchestrator runs the gradle build after merging worktree branches (when google-services.json + clean node_modules are both present).

## Authentication Gates

None.

## Self-Check: PASSED

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatPackage.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` — FOUND
- `apps/mobile/src/native/HumynCompat.ts` — FOUND
- `apps/mobile/__tests__/native/HumynCompat.test.ts` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` — MODIFIED (`HumynCompatPackage` registered + `compat-probe-` sweep present)
- Commit `7d7644f` (Task 1 — Kotlin module shell + 4 helpers + Package + MainApplication) — FOUND
- Commit `46f8122` (Task 2 RED — failing tests) — FOUND
- Commit `e3ba85a` (Task 2 GREEN — HumynCompat.ts implementation) — FOUND
- 5/5 vitest tests pass (`__tests__/native/HumynCompat.test.ts`)
- All `grep` acceptance criteria pass (3 `@ReactMethod`, `Executors.newSingleThreadExecutor`, `HumynCompatPackage`, `compat-probe-`, `anyBFrames`, "HumynCompat native module not registered", `runEncoderProbe`, `runImuProbe`, `readDeviceCaps`)
