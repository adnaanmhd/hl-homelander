# Phase 5 — Deferred / Out-of-Scope Items

Items discovered during execution that are **not** caused by the current plan's changes
and were intentionally left untouched (per the executor scope-boundary rule).

## DEF-5-01 — `HumynHandDetectorModuleTest.kt` no longer compiles (RN 0.83)

- **Discovered during:** Plan 05-01, Task 1 (running `:app:testApkRolloutDebugUnitTest`).
- **Symptom:** `app:compileApkRolloutDebugUnitTestKotlin` FAILS:
  `HumynHandDetectorModuleTest.kt:65 / :85 — Cannot create an instance of an abstract class`
  at `HumynHandDetectorModule(ReactApplicationContext(ctx))`.
- **Root cause:** In `react-native@0.83`, `com.facebook.react.bridge.ReactApplicationContext`
  is now `abstract` (`ReactApplicationContext.kt:16: public abstract class ReactApplicationContext`).
  The test directly instantiates it; the concrete replacement is
  `com.facebook.react.bridge.BridgeReactContext(ctx)`.
- **Impact:** the failure aborts the _entire_ `app` module unit-test compilation, so
  `CaptureLaunchSweepTest` (and every other Robolectric test in `apps/mobile/android/app`)
  cannot be executed until this is fixed. Confirmed pre-existing — reproduces on a clean
  tree with all Plan 05-01 changes stashed.
- **Pre-existing since:** the RN 0.83 / reanimated-4 bump round (`57ed029`, `c4c38e3`, etc.)
  — `HumynHandDetectorModuleTest.kt` last edited at `395fafa fix(04-12)`, before the bump
  surfaced this.
- **Suggested fix (NOT applied here — out of scope for 05-01):** replace
  `ReactApplicationContext(ctx)` with `BridgeReactContext(ctx)` (import
  `com.facebook.react.bridge.BridgeReactContext`) in `HumynHandDetectorModuleTest.kt`.
  Should be a 2-line change. Best folded into the next Android plan in this phase
  (05-02) or a `/gsd-quick`.
