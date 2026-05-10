---
phase: 03-humyn-capture-native-module
plan: 7
plan_id: 03-07
subsystem: humyn-capture-native-module
tags:
  - phase-3
  - wave-3
  - capture
  - foreground-service
  - thermal-gate
  - test-stub-flip
requires:
  - 03-04
provides:
  - humyn-foreground-service
  - humyn-foreground-notification
  - thermal-gate
  - 2-wave0-stubs-flipped
affects:
  - apps/mobile/android/app/src/main/AndroidManifest.xml
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt
  - apps/mobile/__tests__/manifests/manifests.test.ts
tech-stack:
  added: []
  patterns:
    - FGS strict-bitmask invariant (Pitfall 6 — manifest string + runtime constant locked together)
    - Two-sided lock (static manifests.test.ts + runtime HumynForegroundServiceTest)
    - Result-based pre-flight + AutoCloseable subscription (ThermalGate)
    - Single-arg `addThermalStatusListener(Listener)` overload (Robolectric ShadowPowerManager 4.16.1 only shadows the single-arg form)
    - Project-semantic THROTTLING/THROTTLING_SEVERE → AOSP MODERATE/SEVERE mapping
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
  modified:
    - apps/mobile/android/app/src/main/AndroidManifest.xml
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt
    - apps/mobile/__tests__/manifests/manifests.test.ts
decisions:
  - Plan-doc THROTTLING references map to AOSP THERMAL_STATUS_MODERATE; THROTTLING_SEVERE maps to THERMAL_STATUS_SEVERE (no THROTTLING constant exists in PowerManager).
  - Switched from two-arg `addThermalStatusListener(Executor, Listener)` to single-arg `addThermalStatusListener(Listener)` because Robolectric ShadowPowerManager 4.16.1 only shadows the single-arg overload.
  - HumynForegroundServiceTest pinned at SDK 34 (Android 14 strict-mode baseline); ThermalGateTest moved to SDK 34 to match the FGS test (was 33; bumped during debugging — no functional difference, ShadowPowerManager behavior is identical at 33 and 34).
  - Notification icon uses framework `android.R.drawable.ic_media_play` placeholder; brand `@drawable/ic_fgs_recording` is a Plan 03-09 polish task.
  - `HumynForegroundService` uses `AtomicBoolean` for `uploadActive` per plan threat T-3.6-01 mitigation (cross-thread safety even though Phase 3 itself never calls setUploadActive — Phase 5 will).
metrics:
  duration_minutes: 28
  duration_seconds: 1685
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  commits: 4
  tests_added_green: 12 # 4 HumynForegroundServiceTest + 8 ThermalGateTest
  wave0_stubs_flipped_to_green: 2 # HumynForegroundServiceTest + ThermalGateTest
  wave0_stubs_remaining: 16 # 18 baseline − 2 = 16, matches plan <verification>
  full_suite_pass: 361 # apps/mobile vitest run, +1 vs Plan 03-04 baseline of 360 (new manifests assertion)
  completed_at: 2026-05-11T00:21:00Z
---

# Phase 3 Plan 03-07: Foreground Service + Thermal Gate Summary

Wave 3 — landed the OS-level surface of Phase 3 capture: `HumynForegroundService` (the host that every Phase 3 capture component runs inside, per CONTEXT.md D-FGS-01), the silent ongoing FGS notification, the manifest `<service>` declaration with the `camera|microphone|dataSync` foreground type bitmask, and the `ThermalGate` that owns both pre-flight refusal (CAP-11) and mid-record graceful-stop subscription (CAP-12). Flipped 2 of the 18 Plan 03-04 Wave 0 stubs from MISSING to GREEN. Added 1 new static manifest assertion that locks the FGS service entry under PR-level CI.

## Decisions Made

| Decision                                                                                                  | Rationale / Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan-doc `THROTTLING` ↦ AOSP `THERMAL_STATUS_MODERATE`; `THROTTLING_SEVERE` ↦ `THERMAL_STATUS_SEVERE`** | Verified against `/Users/adnaan/Library/Android/sdk/platforms/android-36/data/api-versions.xml`: AOSP `PowerManager` ships `THERMAL_STATUS_{NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN}` since API 29. There is **no** `THERMAL_STATUS_THROTTLING` constant. Both CONTEXT.md (line 70: "Pre-record thermal refuse `≥ THROTTLING`") and RESEARCH.md Code Example 6 (line 876: `if (status >= PowerManager.THERMAL_STATUS_THROTTLING)`) use a constant that doesn't compile. Mapping `THROTTLING → MODERATE` and `THROTTLING_SEVERE → SEVERE` preserves the plan's "pre-flight is one tier more conservative than mid-record" intent on real Android.                                                                                                                                                                                   |
| **Single-arg `addThermalStatusListener(Listener)` (NOT the two-arg Executor overload)**                   | Robolectric ShadowPowerManager 4.16.1 only shadows the single-arg overload. Verified by disassembling `~/.gradle/caches/modules-2/files-2.1/org.robolectric/shadows-framework/4.16.1/.../shadows-framework-4.16.1.jar` (`javap -c`): the shadow's `addThermalStatusListener(Object)` adds to a `thermalListeners` set; `setCurrentThermalStatus(int)` iterates and synchronously invokes `OnThermalStatusChangedListener.onThermalStatusChanged(status)` on each. The two-arg overload from RESEARCH.md Code Example 6 falls through to the real Android binder path, which throws `RuntimeException("Listener failed to set")` because the binder isn't connected in JVM tests. On real devices the single-arg form delivers callbacks on the OS's binder dispatch thread, which is fine for our short `if (status >= SEVERE) onSevere(status)` check. |
| **HumynForegroundServiceTest @Config(sdk = [34])**                                                        | Android 14 (API 34) introduced FGS strict-mode (`MissingForegroundServiceTypeException`) — the test's primary assertion (FGS_TYPE_RECORDING bitmask matches manifest exactly) is a strict-mode invariant, so SDK 34 is the right baseline. ThermalGateTest also pinned at SDK 34 for symmetry; ShadowPowerManager behavior is identical at 33 and 34.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **AtomicBoolean for `uploadActive`**                                                                      | T-3.6-01 (FGS-downgrade race) mitigation. Phase 3 never calls `setUploadActive`; Phase 5 will. `AtomicBoolean` makes the seam thread-safe for free — Phase 5 won't have to retrofit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Brand icon TODO**                                                                                       | `android.R.drawable.ic_media_play` is a placeholder. The brand `@drawable/ic_fgs_recording` resource is a Plan 03-09 polish task (not blocking — system-renders without lookup failure on every Android version).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Implementation Notes

### Foreground service surface (the file every Phase 3 capture component runs inside)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt`:

- `class HumynForegroundService : Service()` — lifecycle host for camera + audio + IMU.
- `companion object FGS_TYPE_RECORDING` — `FOREGROUND_SERVICE_TYPE_CAMERA or _MICROPHONE or _DATA_SYNC` bitmask. **Pitfall 6 lock:** matches `AndroidManifest.xml`'s `android:foregroundServiceType="camera|microphone|dataSync"` exactly. Drift on either side fails:
  - `manifests.test.ts` — static (vitest, no Gradle): asserts the manifest string.
  - `HumynForegroundServiceTest` — runtime (Robolectric SDK 34): asserts the bitmask equals the OR of the same three constants.
- `onStartCommand` — calls `ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)`. `START_STICKY` so the OS restarts the service after force-kill if memory permits.
- `setUploadActive(boolean)` — D-FGS-02 Phase 5 seam. Phase 3 never invokes; Phase 5 toggles when its background-upload pipeline starts a `dataSync`-only post-recording transfer. `AtomicBoolean` for cross-thread safety (T-3.6-01).
- `onCreate` — calls `HumynForegroundNotification.ensureChannel(this)` (idempotent — `NotificationManager.createNotificationChannel` no-ops for an existing channel-id with the same params).

### Thermal gate (pre-flight + mid-record listener)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`:

- `preFlight()` — reads `pm.currentThermalStatus`; returns `Result.failure(ThermalRefuseException(status))` at `THERMAL_STATUS_MODERATE` and above; else `Result.success(Unit)`. Plan 03-09's bridge maps the `ThermalRefuseException` to `{code: 'thermal_throttling', recoverable: true, currentStatus}`.
- `subscribeMidRecord(onSevere: (Int) -> Unit): AutoCloseable` — registers a `PowerManager.OnThermalStatusChangedListener` via the **single-arg overload**. The listener fires `onSevere(status)` only when `status ≥ THERMAL_STATUS_SEVERE`. Returns `AutoCloseable` so `CaptureSession.stop()`'s `finally` block can call `close()` and remove the listener (T-3.6-03 leak mitigation).
- `class ThermalRefuseException(val currentStatus: Int) : RuntimeException("thermal_throttling")` — `message="thermal_throttling"` is the JS-bridge code string and part of the public Plan 03-09 contract.

### Notification surface (one-time addition; project's first NotificationChannel)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt`:

- `CHANNEL_ID = "humyn_capture_fgs"` — stable across builds.
- `ensureChannel(ctx)` — `IMPORTANCE_LOW`, `setShowBadge(false)`, `enableVibration(false)`, `setSound(null, null)`. Idempotent.
- `build(ctx, text)` — `NotificationCompat.Builder` with `setOngoing(true)` (system-policy non-dismissible while the service runs), `PRIORITY_LOW`, `setSilent(true)`, framework `ic_media_play` placeholder icon (Plan 03-09 swap to brand resource).
- **Project hard-rule clarification.** PROJECT.md "no notifications channel" applies to user-facing FCM/APNs alerts (marketing, retention), not to OS-mandated FGS notifications which are system chrome the OS forces every foreground service to display while a user-initiated capture is running.

### Pattern callouts (for downstream Wave 3+ plans to reuse)

1. **FGS strict-bitmask invariant.** Runtime constant + manifest declaration in lock-step. Always assert both: a static gate (vitest grep) and a runtime gate (Robolectric SDK 34). One-sided locks let drift land silently and fire `MissingForegroundServiceTypeException` only on a real Android 14 device.
2. **Thermal pre-flight + listener.** Result-based `preFlight()` returning a typed exception (`ThermalRefuseException(currentStatus)`) maps cleanly through the JS bridge to a typed Promise reject. Mid-record subscription returns `AutoCloseable` so the caller's `finally` block guarantees no leak.
3. **Single-arg `addThermalStatusListener(Listener)`.** Robolectric 4.16.1 doesn't shadow the two-arg Executor overload; future Phase 3 code subscribing to `PowerManager` thermal status MUST use the single-arg form or every Robolectric test will throw `Listener failed to set`. On a real device the OS dispatches on its own binder thread which is sufficient for short conditional callbacks.
4. **Project-semantic → AOSP thermal mapping.** `THROTTLING` ↦ `THERMAL_STATUS_MODERATE`, `THROTTLING_SEVERE` ↦ `THERMAL_STATUS_SEVERE`. Plan 03-08 / 03-10 should reference these AOSP constants directly, not the project-semantic labels (which can land in CONTEXT.md / RESEARCH.md doc text but not in code).

### Wave 0 stub flip targets — running counter

| Plan                  | Stubs flipped this plan | Cumulative flipped | Stubs MISSING after this plan                                                                                                                                                                       |
| --------------------- | ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03-04 (Wave 2 entry)  | n/a (created 18 stubs)  | 0                  | 18                                                                                                                                                                                                  |
| 03-05                 | 6                       | 6                  | 12                                                                                                                                                                                                  |
| 03-06                 | 1                       | 7                  | 11                                                                                                                                                                                                  |
| **03-07 (this plan)** | **2**                   | **9**              | **16** ← reverts to 16 because parallel Wave 3 agents may not have all completed yet — count is independent across worktrees and merges to a single number when the orchestrator collapses the wave |

Note: this counter assumes Plans 03-05 and 03-06 have ALREADY landed by the time the orchestrator merges Wave 3. If they're still in flight, this worktree only flips 2 of its own assigned stubs (HumynForegroundServiceTest + ThermalGateTest), leaving 16 in this worktree's view (= 18 baseline − 2). The "cumulative flipped" column reflects the post-merge target; the orchestrator's wave-collapse merge is responsible for accumulating the per-worktree totals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `THERMAL_STATUS_THROTTLING` constant does not exist in AOSP**

- **Found during:** Task 2 first compile run (`Unresolved reference 'THERMAL_STATUS_THROTTLING'`).
- **Issue:** Both the plan-doc (must*haves: "preFlight() returns Result.failure when getCurrentThermalStatus() >= THERMAL_STATUS_THROTTLING") and RESEARCH.md Code Example 6 (line 876) reference `PowerManager.THERMAL_STATUS_THROTTLING`. AOSP only ships `THERMAL_STATUS*{NONE, LIGHT, MODERATE, SEVERE, CRITICAL, EMERGENCY, SHUTDOWN}`— verified against`~/Library/Android/sdk/platforms/android-36/data/api-versions.xml` lines 50036–50042. The constant simply does not compile.
- **Fix:** Mapped project-semantic labels to AOSP constants — `THROTTLING ↦ MODERATE`, `THROTTLING_SEVERE ↦ SEVERE` — preserving the "pre-flight is one tier more conservative than mid-record" intent. Documented inline in `ThermalGate.kt`'s class KDoc, the test class KDoc, and this SUMMARY's `Decisions Made` table.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt`.
- **Commit:** `1f3c0db`

**2. [Rule 1 — Bug] Robolectric ShadowPowerManager 4.16.1 doesn't shadow the two-arg `addThermalStatusListener(Executor, Listener)` overload**

- **Found during:** Task 2 first test run (3 of 8 cases red with `RuntimeException: Listener failed to set` from `android.os.PowerManager.addThermalStatusListener(PowerManager.java:2469)`).
- **Issue:** RESEARCH.md Code Example 6 (line 884: `pm.addThermalStatusListener(Executors.newSingleThreadExecutor(), listener)`) uses the two-arg overload. Disassembling `shadows-framework-4.16.1.jar` showed only the single-arg `addThermalStatusListener(Object)` is shadowed; the two-arg variant falls through to the real Android binder path which throws because the binder isn't connected in JVM tests.
- **Fix:** Switched to `pm.addThermalStatusListener(listener)` (single arg). On real devices the OS dispatches callbacks on its own binder thread — fine for our short `if (status >= SEVERE) onSevere(status)` check. If Plan 03-10's `CaptureSession` needs Executor-bounded dispatch (it almost certainly doesn't — it'll post the 2.5 s graceful-stop work to its own recording-thread Handler regardless), that's a Plan 03-10 layering concern, not a `ThermalGate` concern.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt`.
- **Commit:** `1f3c0db`

**3. [Rule 3 — Blocking] Worktree node_modules + `local.properties` + `google-services.json` infra**

- **Found during:** Task 1 first gradle compile run (`Included build does not exist` for the React Native gradle plugin → `SDK location not found` → `google-services.json missing`).
- **Issue:** A fresh Claude Code worktree only checks out tracked files. `node_modules/`, `apps/mobile/android/local.properties`, and `apps/mobile/android/app/src/apkRollout/google-services.json` are gitignored and don't replicate. Without them gradle can't resolve the React Native gradle plugin, find the Android SDK, or accept the Firebase plugin. Same blocker Plan 03-04 documented.
- **Fix:**
  - `cd apps/mobile && npm ci --prefer-offline` (cached install, ~7 s).
  - `pnpm install --prefer-offline` at workspace root (cached, ~7 s) — restores `lint-staged` + per-package `node_modules` so the husky pre-commit hook runs.
  - Wrote `apps/mobile/android/local.properties` with `sdk.dir=/Users/adnaan/Library/Android/sdk` (mirrors main repo, gitignored — never committed).
  - Copied `apps/mobile/android/app/src/apkRollout/google-services.json` from the main repo (gitignored — never committed).
- **Files modified:** None tracked (all infra is gitignored).
- **Commit:** N/A (infra side-effect; no commit).

### Architectural Changes

**None.** All deviations were narrow bug-fixes and missing-mitigations, all documented inline in the modified files. No architectural decisions changed; no Rule-4 escalations.

### Out of Scope (Deferred / Logged)

- **Pre-existing `RootNativeStack.test.tsx` unhandled rejections (3 errors, 0 test failures).** Same Plan 03-04 deferral. Not introduced by this plan; out of scope per the per-plan scope-boundary rule.
- **Brand FGS notification icon (`@drawable/ic_fgs_recording`).** Plan 03-09 polish task; placeholder `android.R.drawable.ic_media_play` ships now and renders cleanly on every Android version.
- **Ensure-channel hook in `MainApplication.onCreate`.** PATTERNS.md line 745 mentions calling `HumynForegroundNotification.ensureChannel(this)` from `MainApplication.onCreate` after the orphan sweep. The plan task 1B specifies calling `ensureChannel` from the SERVICE's `onCreate` instead (which is what shipped). Service-side is correct + sufficient — `NotificationManager.createNotificationChannel` is idempotent, and the channel only needs to exist by the time `ServiceCompat.startForeground` fires. If a future plan wants the channel created earlier (e.g. for cold-start notification testing), that's a one-line addition in `MainApplication.onCreate` — captured here for traceability.
- **`@OptIn(UnstableApi::class)` Kotlin warning** (carried over from Plan 03-04). Not introduced or aggravated by this plan.

## Threat Surface

The plan's `<threat_model>` register is honored:

- **T-3.6-01 (DoS — FGS-downgrade race):** mitigated. `uploadActive` is `AtomicBoolean`. Phase 5 owns the higher-level lifecycle contract (don't call `setUploadActive` after the service has stopped); Phase 3 surfaces a thread-safe seam.
- **T-3.6-02 (Tampering — manifest bitmask drift):** mitigated. Two-sided lock — `manifests.test.ts` asserts the manifest string and `HumynForegroundServiceTest` asserts the runtime bitmask. Both must agree or one of the tests fails.
- **T-3.6-03 (DoS — thermal listener leak):** mitigated. `subscribeMidRecord` returns `AutoCloseable`; the contract that Plan 03-10 must call `close()` in its `finally` block is documented in the gate's KDoc.
- **T-3.6-04 (Information disclosure — FGS notification visibility):** accepted. OS-mandated; user just initiated capture. Notification has no PII (no contributor name, no task name).
- **T-3.6-05 (DoS — bugged-OEM PowerManager):** accepted. RESEARCH.md notes Pixel 7a/8a/10a target devices honor `PowerManager` cleanly. OEM matrix expansion is Phase 4 thermal walk.

No new threat surface introduced beyond what the plan anticipated.

## Verification Results

- **Manifest static gate:** `cd apps/mobile && npx vitest run __tests__/manifests/` — 19/19 GREEN (12 PERM + 7 invariant; +1 new HumynForegroundService assertion).
- **HumynForegroundServiceTest:** 4/4 GREEN — bitmask invariant, channel creation, ongoing notification, setUploadActive seam.
- **ThermalGateTest:** 8/8 GREEN — preFlight succeeds at NONE/LIGHT, fails at MODERATE/SEVERE/CRITICAL with `ThermalRefuseException(currentStatus)`, mid-record listener fires only at SEVERE+, close() unregisters.
- **Plan 03-04 wrapper test (regression):** `FragmentedMuxerWrapperTest` 2/2 still GREEN.
- **Wave 0 stub counter:** 16 capture/ stubs still MISSING (was 18 from Plan 03-04 — minus the 2 we just flipped). Matches the plan's `<verification>` math.
- **APK compile:** `./gradlew :app:compileApkRolloutDebugSources` exits 0 — manifest + service + gate compile cleanly.
- **Full apps/mobile vitest suite:** 62/62 test files, **361/361 tests pass** (+1 vs the Plan 03-04 baseline of 360 — the new manifests assertion).
- **Typecheck:** husky pre-commit hook ran `pnpm -r typecheck` on each commit — `apps/api` + `shared/types` both exit 0.

## Self-Check: PASSED

All created/modified files exist and all 4 commits exist on the worktree branch:

- `faef944` — test(03-07): RED — assert HumynForegroundService strict-bitmask invariant + Notification contract
- `f6bf995` — feat(03-07): GREEN — HumynForegroundService + Notification + manifest entry (CAP-14 / D-FGS-01)
- `703b5d6` — test(03-07): RED — assert ThermalGate preFlight + subscribeMidRecord (CAP-11/CAP-12)
- `1f3c0db` — feat(03-07): GREEN — ThermalGate preFlight + subscribeMidRecord (CAP-11/CAP-12)

File presence verification:

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt` — FOUND
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — modified (contains `.fgs.HumynForegroundService` and `foregroundServiceType="camera|microphone|dataSync"`)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt` — modified (no `MISSING — Wave 0 stub`)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt` — modified (no `MISSING — Wave 0 stub`)
- `apps/mobile/__tests__/manifests/manifests.test.ts` — modified (new HumynForegroundService assertion)

## TDD Gate Compliance

Plan 03-07 is `type: execute` (not `type: tdd`), but each task is `tdd="true"`. Per-task gate sequence:

- **Task 1:** RED `faef944` (`test(03-07): RED — ...`) → GREEN `f6bf995` (`feat(03-07): GREEN — ...`). REFACTOR not needed.
- **Task 2:** RED `703b5d6` (`test(03-07): RED — ...`) → GREEN `1f3c0db` (`feat(03-07): GREEN — ...`). REFACTOR not needed.

Both tasks land RED before GREEN. Both RED commits compile-fail with unresolved-reference errors against the production classes (the canonical "test-doesn't-pass-without-implementation" signal). Both GREEN commits include the implementation that makes the prior RED commit's tests pass.

## Known Stubs

None new. Plan 03-04's 16 capture/ Wave 0 stubs remain (Plan 03-08 takes 4, Plan 03-10 takes 5, Plan 03-05 took 6, Plan 03-06 took 1, with this plan taking 2 of the 18 baseline). No production-code stubs (no `TODO` / `FIXME` / `placeholder` / `not implemented` strings introduced in shipped source files; the one inline TODO in `HumynForegroundNotification.kt` is for the Plan 03-09 brand-icon swap and is documented above).

---

_Plan: 03-07 — foreground-service-thermal_
_Completed: 2026-05-11T00:21:00Z (~28 minutes wall time including infra restore + threshold-mapping debugging)_
