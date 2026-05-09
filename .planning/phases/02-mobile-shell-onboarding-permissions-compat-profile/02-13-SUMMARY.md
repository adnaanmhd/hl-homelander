---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 13
subsystem: mobile-compat
tags: [android, kotlin, sensor-manager, gyroscope, camera2, robolectric, imu, sustained-rate-probe]

requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'HumynCompat TurboModule shell + ImuProbe.kt scaffold (02-06), Robolectric harness + JUnit/AndroidX test deps (02-02)'
provides:
  - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt — full ImuProbe implementation: SensorManager.registerListener on TYPE_GYROSCOPE at SENSOR_DELAY_FASTEST with maxReportLatency=0 (no batching), 5 s warm-up skip via WARMUP_NS, optional concurrent 1080p Camera2 preview to load the SoC (Pitfall 4), pure-function `internal fun computeResult(timestamps)` for Robolectric injection.'
  - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt — 4 Robolectric tests on the math: 200 Hz baseline (~200 Hz, 6000 samples), 5×200 ms spike injection (p99 > 110 ms), empty stream → zero, warmup-only → zero.'
affects: [02-16-compat-orchestrator-and-gates, 02-21-manual-smoke]

tech-stack:
  added: []
  patterns:
    - 'Pure-function timestamp math (`internal fun computeResult`) split out from the SensorManager-coupled `run()` so Robolectric tests assert behavior with synthetic timestamps, no shadowed-sensor scaffolding required.'
    - 'Reference clock = SensorEvent.timestamp (SystemClock.elapsedRealtimeNanos domain on Android). Stays in the same time base as Phase 3 capture pipeline (Camera2 + MediaCodec timestamps when SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME).'
    - 'Best-effort 1080p Camera2 preview behind `withPreview=true` — opens back camera on a HandlerThread, repeats a TEMPLATE_PREVIEW request to a dummy SurfaceTexture (no `onFrameAvailable` consumer; frames discarded). All preview failures swallowed (Pitfall 4 sustained-load emulation is best-effort, not load-bearing for the math).'

key-files:
  created:
    - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt'
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt (replaced 02-06 NotImplementedError shell with full implementation)'
    - '.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/deferred-items.md (added 02-13 entry for pre-existing Metro `./user.js` resolution failure that blocks the gradle test runner)'

key-decisions:
  - 'computeResult kept `internal` (not private) so the test class in the same package can drive it directly — the alternative (Mockito-shadowed SensorManager + sleep-driven harness) gives no extra coverage and is brittle.'
  - 'Reference clock left as raw SensorEvent.timestamp (not normalized by subtracting first). Computation is invariant to the offset, and downstream consumers (compatService gate in 02-16) can keep raw nanoseconds for Phase 3 alignment.'
  - 'p99 index uses integer floor (`size * 99 / 100`) clamped to `size - 1`. For very small samples (e.g. <= 100 intervals) p99 = max, which is the correct conservative answer.'
  - 'Test-2 spike injection widened from a single 200 ms gap (in the planner-supplied draft) to 5 cumulatively-shifted 200 ms gaps. Single gap is mathematically invisible at p99 with 298 intervals (sorted index 295 falls before the lone outlier at index 297). Five spikes land safely in the p99 tail. Math regression caught during pre-commit review.'

patterns-established:
  - 'Robolectric tests on pure-function math splits: keep the framework-coupled API surface thin; expose an `internal` math kernel; the test class in the same Kotlin package drives the kernel with synthetic input. Pattern used here (ImuProbe.computeResult), to be reused by EncoderProbe (NAL parser) and DeviceCaps (filesystem-probe) tests.'

requirements-completed: [COMPAT-02, COMPAT-07]

duration: 12min
completed: 2026-05-09
---

# Phase 2 Plan 13: HumynCompat ImuProbe Summary

**30-second IMU sustained-rate probe at SENSOR_DELAY_FASTEST with 5 s warm-up skip and optional 1080p Camera2 preview load — `{sustainedHz, p99IntervalMs, samplesCollected}` for the COMPAT-02 / Pitfall 4 gate**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09T17:13:00Z
- **Completed:** 2026-05-09T17:25:00Z
- **Tasks:** 1 / 1
- **Files modified:** 3 (1 production replace, 1 test new, 1 deferred-items append)

## Accomplishments

- Replaced the 02-06 ImuProbe shell with the full implementation per RESEARCH § Code Examples (lines 793–824), wired to `SensorManager.registerListener(listener, gyro, SENSOR_DELAY_FASTEST, 0, handler)` on a dedicated `HandlerThread("ImuProbe")`. Listener appends raw `SensorEvent.timestamp` (elapsedRealtimeNanos) to a list; warmup skip filters everything within the first 5 s.
- Added optional concurrent 1080p Camera2 preview behind `withPreview=true` — opens the back-facing camera, configures a single TEMPLATE_PREVIEW capture session targeting a dummy `SurfaceTexture(0)` sized 1920×1080, and starts a repeating request. All failures swallowed (preview is a best-effort SoC load, not load-bearing for the math). Cleanup in reverse order on the way out.
- Split timestamp math into `internal fun computeResult(timestamps: List<Long>): Result` — pure function, no SensorManager / Camera2 dependency — so Robolectric tests inject synthetic sequences and assert {sustainedHz, p99IntervalMs, samplesCollected} without shadowing.
- Added 4 Robolectric tests (`ImuProbeTest`):
  1. `200 Hz uniform stream after 5s warm-up reports ~200 Hz sustained` — 6000 samples at 5 ms period, asserts sustainedHz ∈ [195, 205] and samplesCollected = 6000.
  2. `dropped samples produce p99 spike` — 350 samples at 100 ms period with 5 cumulatively-shifted 200 ms gaps at samples 100 / 150 / 200 / 250 / 300, asserts p99 > 110 ms.
  3. `empty stream returns zero` — Result(0, 0, 0).
  4. `samples within warmup window only return zero sustainedHz` — 4 samples all under 5 s, sustained.size = 0 → Result(0, 0, 4).

## Task Commits

1. **Task 1: Full ImuProbe implementation + Robolectric math test** — `95c96b3` (feat)

**Plan metadata:** _final docs commit (this file + deferred-items.md update) follows below._

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` — full SensorManager + optional Camera2-preview implementation; `internal fun computeResult` math kernel; companion `WARMUP_NS = 5_000_000_000L`.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt` (NEW) — 4 Robolectric tests on `computeResult`.
- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/deferred-items.md` — added 02-13 row for pre-existing Metro `./user.js` resolution failure (blocks gradle test runner; affects ALL `:app:test*UnitTest` and `:app:assemble*` paths; reproducible on `main` HEAD).

## Decisions Made

- **`internal fun computeResult` instead of private + Mockito-shadowed SensorManager.** Same-package Robolectric test access is cleaner and avoids brittle reflection. Documented as the pattern for sibling probes (EncoderProbe, DeviceCaps).
- **Five spike injections in Test-2 instead of the planner's single 200 ms gap.** A single outlier sits at sorted-index 297 of 298 intervals; p99 lands at index 295 = 100 ms (the period). Five cumulative spikes land safely in the p99 tail. Test name and intent preserved.
- **Reference clock left as raw `SensorEvent.timestamp`.** Phase 3 capture pipeline timestamps live in elapsedRealtimeNanos when `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`. Keeping the probe in the same domain avoids a translation layer in 02-16.
- **Camera preview path entirely best-effort.** `try/catch` around camera open + session creation + repeating-request start; any failure leaves `withPreview=true` running in IMU-only mode. The probe's gate values (sustainedHz / p99) are still meaningful even if preview fails to start, and Pitfall 4's "sustained rate under camera load" is the strict condition we want — if the device can't open Camera2, the IMU is the only signal anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test-2 (`dropped samples produce p99 spike`) math was incorrect with a single 200 ms gap**

- **Found during:** Task 1 (pre-commit review of the test math the planner supplied verbatim).
- **Issue:** The planner's draft injected one 200 ms gap into 350 timestamps at 100 ms period. After the 5 s warm-up filter, 299 samples / 298 intervals remain — 297 of value 100 ms and 1 of value 200 ms. p99 index = `min(298 * 99 / 100, 297) = 295`, which falls before the lone 200 ms outlier (sorted index 297). Test would assert `p99 > 110 ms` but receive 100 ms → false negative.
- **Fix:** Inject 5 cumulatively-shifted 200 ms gaps at samples 100 / 150 / 200 / 250 / 300. All 5 are within the post-warmup range; the 200 ms entries occupy sorted indices 293..297, so index 295 = 200 ms ≥ 110 ms ✓.
- **Files modified:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt`
- **Verification:** Hand-walked the math; comment in the test documents the reasoning. (Gradle Robolectric run deferred — see Deferred Issues below.)
- **Committed in:** `95c96b3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test correctness — the planner's draft would have asserted incorrectly. No scope creep; behavior under test unchanged.

## Deferred Issues

**1. Gradle Robolectric test execution deferred — pre-existing Metro `./user.js` resolution failure**

- **Found during:** Task 1 verification step (`./gradlew :app:testApkRolloutDebugUnitTest --tests "*ImuProbeTest*"`).
- **Failure mode:** `:app:createBundleApkRolloutDebugJsAndAssets` fails because Metro cannot resolve `./user.js` from `shared/types/src/index.ts`. The `shared/types/src/index.ts` source uses NodeNext-style `.js` extensions on TypeScript imports (`export * from './user.js'`) — Metro's default resolver does not rewrite `.js → .ts` for source files, only for `node_modules` outputs. This task is a hard gradle-graph dependency of every `:app:test*UnitTest` and `:app:assemble*` task.
- **Out of scope:** Reproducible on `main` HEAD against `apps/mobile` (verified by running `./gradlew :app:testApkRolloutDebugUnitTest --tests "*EncoderProbeTest*"` in the main repo — same `./user.js` error). NOT introduced by 02-13. Per `<deviation_rules>` SCOPE BOUNDARY: "Only auto-fix issues DIRECTLY caused by the current task's changes."
- **Precedent:** The 02-06 SUMMARY documented exactly this class of environmental failure ("Metro's symlink resolution from inside the gradle-spawned `node` subprocess returns a project-root that walks 5 levels up to a non-existent `node_modules`") and deferred to phase orchestrator. Same pattern followed here.
- **What was verified instead:**
  - All 5 plan-mandated `grep` acceptance criteria pass against `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt`:
    - `SENSOR_DELAY_FASTEST` ✓
    - `WARMUP_NS` ✓
    - `withPreview` ✓
    - `TYPE_GYROSCOPE` ✓
    - `internal fun computeResult` ✓
  - Test file exists at the canonical path: `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt`
  - Test math hand-walked for all 4 cases (see Decisions Made above for Test-2 reasoning).
- **Logged to:** `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/deferred-items.md` row 5 (the 02-13 row appended this run).
- **Owner / fix path:** Either (a) a follow-up infra plan adds `babel-plugin-transform-import-extensions` to `apps/mobile/babel.config.js` so Metro / Hermes rewrite `./user.js → ./user`, or (b) `shared/types/src/index.ts` drops `.js` extensions (which would break NodeJS ESM consumers, so option (a) is preferable), or (c) Metro's `resolver.resolveRequest` is overridden in `apps/mobile/metro.config.js` to strip the `.js` suffix when the source file is `.ts`. Real-device IMU validation lives in plan 02-21 manual smoke regardless.

## Authentication Gates

None.

## Self-Check: PASSED

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt` — FOUND (modified, 124 lines)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/ImuProbeTest.kt` — FOUND (created, 58 lines)
- Commit `95c96b3` — FOUND in `git log --oneline --all`
- All 5 grep acceptance criteria pass against `ImuProbe.kt` (verified above).
- All 4 test cases hand-walked for math correctness (Test-2 fix documented as Deviation 1).

## Threat Flags

None — no new network endpoints, auth paths, file-system access patterns, or schema changes at trust boundaries introduced by this plan. The threat model from PLAN.md (T-2.13-01: DoS on main thread mitigated by HumynCompatModule's bgExecutor; T-2.13-02: Camera preview frames accepted as ephemeral / never-read) is unchanged.

## Issues Encountered

- Pre-existing Metro `./user.js` resolution failure in the gradle test path — see Deferred Issues. Workarounds attempted: (a) symlinked node_modules from main repo; (b) `npm ci` fresh install in worktree; (c) cleared metro cache; (d) `-x createBundleApkRolloutDebugJsAndAssets` exclusion. None bypass the issue because the `BundleHermesCTask` is hard-wired into `:app:mapApkRolloutDebugSourceSetPaths`.

## Next Phase Readiness

- 02-16 (compat orchestrator and gates) can now wire `HumynCompatModule.runImuProbe` → `ImuProbe(reactApplicationContext).run(durationMs, withPreview)` and gate on `result.sustainedHz >= 100 && result.p99IntervalMs <= 12`. The shape returned matches the JS-side `ImuProbeResult` interface in `apps/mobile/src/native/HumynCompat.ts` (verified during 02-06).
- Real-device IMU sustained-rate validation lives in plan 02-21 manual smoke (Pixel 7a + a low-end ₹30K Snapdragon device + a Dimensity-class chassis). Robolectric coverage here is for the math kernel only; SoC-bound thermal behavior under sustained Camera2 preview cannot be modeled in JVM.

---

*Phase: 02-mobile-shell-onboarding-permissions-compat-profile*
*Completed: 2026-05-09*
