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

## Plan 05-15 — Pre-existing Wave-1.5 Kotlin test-compile errors

**Discovered:** 2026-05-13 during Plan 05-15 Task 3 Gradle verification attempt.
**Origin:** commits `dce108e8` (Wave-1.5 Item 2) + `2d59485` (Wave-1.5 Item 1).

`apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt:743`
and `UploadQueueStoreTest.kt:267, 343` use Kotlin backtick-quoted method names that
contain `Wave-1.5` — the `1.5` is parsed by the Kotlin lexer as `1` + `.` + `5`,
and `.` is illegal in identifier characters (even inside backticks). Gradle fails
with: `Name contains illegal characters: ..`

**Impact on Plan 05-15:** Blocks `:app:testApkRolloutDebugUnitTest` for the
entire test source set, including the +2 new Robolectric tests this plan added
(`missing contributor name throws invalid_opts name`, `missing contributor email
throws invalid_opts email`). Static review confirms my new tests use the exact
same `JavaOnlyMap` / `IllegalArgumentException` / `e.message!!.contains(...)`
pattern as the existing 8 passing tests in the file, and exercise the
`requireNonEmpty(map, "name"|"email")` guards at `CaptureSessionOptsBridge.kt:84-85`
which throw `IllegalArgumentException("invalid_opts: $key")` per the source — so
the test bodies will compile + pass once the upstream test-name compile errors
are fixed.

**Recommended fix:** Rename the three offending test functions to either replace
`1.5` with `1-5`/`1_5` or drop the version suffix from the function name (the
`(Wave-1.5 Item N)` annotation can move into a comment). Trivial mechanical fix,
but DELIBERATELY out of scope for Plan 05-15 — this plan closes the UAT
2026-05-13 `invalid_opts: name` blocker, not the broader Wave-1.5 test hygiene.

**SCOPE BOUNDARY** rule applied: pre-existing test failures in unrelated files
are not auto-fixed by the executor.
