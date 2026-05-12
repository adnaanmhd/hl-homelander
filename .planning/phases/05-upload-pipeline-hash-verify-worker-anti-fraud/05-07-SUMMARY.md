---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 07
subsystem: mobile-android-native
tags:
  [
    upload,
    foreground-service,
    fgs-type-downgrade,
    jobscheduler,
    uidt,
    battery-optimization,
    oem-deep-link,
    react-native,
    kotlin,
    robolectric,
    onboarding,
  ]

# Dependency graph
requires:
  - phase: 05-04
    provides: 'HumynUploadModule + UploadQueueStore + UploadModels + the AndroidManifest UploadJobService <service> declaration + RUN_USER_INITIATED_JOBS / REQUEST_IGNORE_BATTERY_OPTIMIZATIONS perms + native/HumynUpload.ts bridge'
  - phase: 05-06
    provides: 'UploadCoordinator (drainNow() — the synchronous drain the FGS thread calls) + ChunkUploader + NetworkMonitor + UploadAuthContext / UploadControlState'
  - phase: 03-humyn-capture-native-module
    provides: 'fgs/HumynForegroundService (the camera|microphone|dataSync FGS + the ACTION_SET_UPLOAD_ACTIVE / setUploadActive Phase-5 seam), HumynForegroundNotification, the two-sided manifest↔bitmask lock (HumynForegroundServiceTest + manifests.test.ts)'
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'ScreenContainer/Text/Button/Pressable primitives + tokens, ForceUpgradeScreen/PermissionsScreen onboarding-style shell, native/AppFlavor.getFlavorContext(), state/keys.ts + state/mmkv.ts (the shared encrypted MMKV — D-STATE-01), util/semver.compareSemver'
provides:
  - 'apps/mobile/android/.../fgs/HumynForegroundService.kt — the FGS type-downgrade lifecycle: recording state `startForeground(NOTIF_ID, notif, FGS_TYPE_RECORDING)` (camera|microphone|dataSync — UNCHANGED) → on ACTION_SET_UPLOAD_ACTIVE(true) when recording NOT active, a SECOND `ServiceCompat.startForeground(..., FGS_TYPE_UPLOADING)` (DATA_SYNC-only, the documented downgrade; the camera/mic privacy indicators disappear) + the "Uploading recordings…" notification + UploadCoordinator.getShared(ctx).drainNow() on a dedicated HandlerThread; a 5-min idle stop (queue empty >5 min → ServiceCompat.stopForeground(STOP_FOREGROUND_REMOVE) + stopSelf()); onTimeout(int,int)+onTimeout(int) → UploadJobService.scheduleUidt + stopSelf (Android-15 6h dataSync cap); onRecordingFinalized() recording→upload handoff seam (re-startForeground with FGS_TYPE_UPLOADING directly, no stopSelf between); onDestroy quitSafely()s the upload thread'
  - 'apps/mobile/android/.../fgs/HumynForegroundNotification.kt — + buildUploading(context): the "Uploading recordings…" / "Keeping your captures safe — you can use other apps" variant (same channel, silent/low-priority, generic copy — T-5-07-05; stat_sys_upload icon)'
  - 'apps/mobile/android/.../upload/UploadJobService.kt — the UIDT JobService: onStartJob → UploadCoordinator.getShared(ctx).drainNow() on a bg thread → jobFinished(params, queueHasWork()); onStopJob = true; scheduleUidt(ctx) → JobScheduler.schedule(JobInfo.Builder(UPLOAD_JOB_ID, ComponentName(...)).setUserInitiated(true).setRequiredNetworkType(NETWORK_TYPE_ANY).build()) (exception-tolerant); BIND_JOB_SERVICE / exported=false manifest declaration was shipped in Plan 05-04'
  - 'apps/mobile/android/.../upload/BatteryOptimizationHelper.kt — isExempt(ctx) → PowerManager.isIgnoringBatteryOptimizations; requestExempt(ctx) ALWAYS tries the stable AOSP ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS first, falling back to ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS (both try/caught + FLAG_ACTIVITY_NEW_TASK); the OEM_AUTOSTART ComponentName list (Xiaomi MIUI/HyperOS, Oppo ColorOS ×2, older Oppo, Vivo FunTouch, Samsung OneUI, Huawei EMUI, Letv); oemAutostartAvailable(ctx) / openOemAutostartIfAvailable(ctx) — TWO-GATE: vendor security-center package installed AND the explicit ComponentName resolves; returns false (no crash) when none reachable; the walkthrough copy stands alone (Pitfall 1 / T-5-07-01)'
  - 'apps/mobile/android/.../upload/UploadCoordinator.kt — + queueHasWork(): Boolean (rows not VERIFIED/DEAD_LETTER), + getShared(context): the process-wide singleton wired to UploadAuthContext/UploadControlState that HumynUploadModule + the FGS + the UIDT JobService all drain (one drain, one queue-store lock), + setEmitters() (the singleton starts with no-op emitters for the FGS/JobService threads; HumynUploadModule installs the real RCTDeviceEventEmitter ones); queueStore made non-private (reused by the module)'
  - 'apps/mobile/android/.../upload/HumynUploadModule.kt — now uses UploadCoordinator.getShared(); + @ReactMethods isBatteryOptimizationExempt / requestBatteryOptimizationExemption / oemAutostartAvailable / openOemAutostart / setUploadActive(active) (each promise.reject(CODE,...) on failure); init installs the real emitters; invalidate detaches them (does NOT shut down the process-wide coordinator)'
  - 'apps/mobile/src/native/HumynUpload.ts — + isBatteryOptimizationExempt / requestBatteryOptimizationExemption / oemAutostartAvailable / openOemAutostart on HumynUpload + try/catch-wrapped *Safe variants (isBatteryOptimizationExemptSafe → false, requestBatteryOptimizationExemptionSafe → no-op, oemAutostartAvailableSafe → false, openOemAutostartSafe → false) for the screen'
  - 'apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx — the first-upload OEM walkthrough: AOSP "Allow unrestricted battery" button → requestBatteryOptimizationExemptionSafe() then re-checks isBatteryOptimizationExemptSafe() (reflects ✓ Allowed / Still restricted); per-vendor steps (Xiaomi MIUI/HyperOS, Oppo ColorOS, Vivo FunTouch, Samsung One UI, stock Android) matching help-center-content.md''s OEM line; the "Open Autostart settings" OEM deep-link button renders only when oemAutostartAvailableSafe() → true → openOemAutostartSafe(); the standalone fallback line ALWAYS shown; "Done"/"Skip for now" sets KEYS.UPLOAD_FIRST_PROMPT_SHOWN + KEYS.UPLOAD_FIRST_PROMPT_VERSION (current app version) in the shared MMKV instance + calls onDone; exports shouldShowBatteryOptimizationPrompt(): true on first run / after a force-upgrade version bump (idea-brief.md §7.4); every native call try/caught via the *Safe variants'
  - 'apps/mobile/src/state/keys.ts — + UPLOAD_FIRST_PROMPT_SHOWN / UPLOAD_FIRST_PROMPT_VERSION'
  - 'apps/mobile/android/.../test/.../fgs/HumynForegroundServiceTest.kt — + FGS_TYPE_UPLOADING is DATA_SYNC-only ⊆ FGS_TYPE_RECORDING (manifest superset still the camera|microphone|dataSync OR) + onTimeout(int,int) is overridden (reflection) + the existing setUploadActive seam test now builds via the Robolectric controller'
  - 'apps/mobile/__tests__/manifests/manifests.test.ts — + the UploadJobService <service> (BIND_JOB_SERVICE / exported=false) + RUN_USER_INITIATED_JOBS + REQUEST_IGNORE_BATTERY_OPTIMIZATIONS declarations + the FGS foregroundServiceType is STILL exactly "camera|microphone|dataSync"'
  - 'apps/mobile/android/.../test/.../upload/BatteryOptimizationHelperTest.kt — stock-device → none reachable (false, no startActivity, no crash); a registered fake MIUI AutoStartManagementActivity → available + launches that ComponentName with FLAG_ACTIVITY_NEW_TASK; requestExempt never throws; isExempt returns a boolean'
  - 'apps/mobile/__tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx — renders without the native module (safe defaults); conditional OEM button; allow-unrestricted re-check + status; Done/Skip set both MMKV flags + call onDone; shouldShowBatteryOptimizationPrompt first-run / already-shown / version-bump'
affects: [05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'FGS type-downgrade (Pitfall 4): a SECOND `ServiceCompat.startForeground` with a STRICT-SUBSET bitmask (FGS_TYPE_UPLOADING = DATA_SYNC ⊆ FGS_TYPE_RECORDING = the manifest superset) is the documented downgrade — NOT an in-place bit-clear; the manifest `foregroundServiceType` string never changes; only ever started while the app is foreground (right after HumynCapture.stop()) — a true-background resume uses the UIDT JobService'
    - 'UIDT JobScheduler job for true-background uploads past the Android-15 6h dataSync cap: JobInfo.Builder(...).setUserInitiated(true).setRequiredNetworkType(NETWORK_TYPE_ANY) + RUN_USER_INITIATED_JOBS; onStartJob returns true and calls jobFinished(params, queueHasWork()) on a bg thread; onTimeout(int,int) on the FGS hands off to it'
    - 'Process-wide shared UploadCoordinator (getShared(context)): the module + the FGS thread + the UIDT JobService all call drainNow() on ONE instance — single internal drainExecutor (serialises drains) + a single UploadQueueStore lock. The singleton starts with no-op event emitters (the FGS/JobService threads have no React bridge); HumynUploadModule installs the real RCTDeviceEventEmitter emitters via setEmitters() in init, detaches them in invalidate (the singleton itself is never shut down on a catalyst reload)'
    - 'Two-gate OEM deep-link: vendor security-center package installed (getPackageInfo) AND the explicit ComponentName resolves (resolveActivity), then try/caught on startActivity — a renamed/removed activity inside an installed vendor app is a silent no-op, never a crash; the walkthrough copy stands alone (Pitfall 1)'
    - 'AOSP-first battery-optimization request: ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (the direct "allow unrestricted for Homelander" dialog) ALWAYS tried first, falling back to ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS (the list), both try/caught; the OEM deep-link is purely additive'
    - 'Re-show-on-update gate: a screen exports shouldShow<X>Prompt() that returns true if a "shown" flag is unset OR a "last-shown-app-version" flag is older than the current app version (compareSemver < 0) — re-surfaces a one-time onboarding screen after a force-upgrade (MIUI may revert the battery-opt exemption on an app update)'

key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadJobService.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/BatteryOptimizationHelper.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/BatteryOptimizationHelperTest.kt
    - apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx
    - apps/mobile/__tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundService.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/HumynForegroundNotification.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt
    - apps/mobile/src/native/HumynUpload.ts
    - apps/mobile/src/state/keys.ts
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt
    - apps/mobile/__tests__/manifests/manifests.test.ts

key-decisions:
  - 'UploadCoordinator became a process-wide singleton via getShared(context) (the plan flagged this as "add if Plan 05-06 didn''t"). The module no longer constructs its own coordinator/NetworkMonitor — it uses getShared() and reuses its UploadQueueStore (queueStore made non-private), so there is ONE drain serialiser and ONE queue-store lock across the module + the FGS thread + the UIDT JobService. Emitters are mutable (`setEmitters`) so the singleton starts with no-ops (FGS/JobService threads have no React bridge) and the module installs the real RCTDeviceEventEmitter-backed ones in init / detaches them in invalidate without ever shutting the singleton down.'
  - "OEM autostart detection is TWO-gate (vendor package installed AND the explicit ComponentName resolves) rather than resolveActivity alone — more ROM-honest (a non-Xiaomi phone has no com.miui.securitycenter at all) AND it sidesteps Robolectric's ShadowPackageManager fabricating a non-null ResolveInfo for an explicit-component intent whose package isn't installed (which made the unit test impossible with the resolveActivity-only design). Documented in BatteryOptimizationHelper.kt + the test header."
  - "onRecordingFinalized() is shipped on HumynForegroundService as the recording→upload handoff seam (recordingActive=false → if queueHasWork() re-startForeground directly with FGS_TYPE_UPLOADING, no stopSelf in between). The JS-side call site (HumynCapture.stop() → this) is Plan 05-08's wiring — HumynCaptureModule.kt is NOT touched here (it's not in the plan's files_modified, and the existing capture stop/stopService flow would conflict)."
  - "The JS test runs under vitest (`npm test` / `npx vitest run`), not Jest, and TS is checked with `npx tsc --noEmit` (= `npm run typecheck`) — the plan's `pnpm jest ... && pnpm tsc --noEmit` is wrong for this repo (it uses npm + vitest). Recorded so a future verifier doesn't chase a phantom `pnpm jest`."
  - "HumynForegroundNotification.buildUploading uses android.R.drawable.stat_sys_upload (the recording variant's ic_media_play TODO for a brand icon still stands from Phase 3) and generic copy with no recording id / task name / count beyond a vague plural (T-5-07-05 accepted disposition)."

patterns-established:
  - 'FGS type-downgrade via a second startForeground with a strict-subset bitmask (recording → dataSync), the manifest type string unchanged'
  - 'UIDT JobScheduler job (setUserInitiated(true)) as the true-background upload path past the Android-15 6h dataSync cap; the FGS onTimeout hands off to it'
  - 'Process-wide shared coordinator with mutable event emitters (no-op for background-thread callers, real RCTDeviceEventEmitter for the module instance)'
  - 'Two-gate OEM deep-link (package-installed + component-resolves + try/catch on startActivity → silent no-op when unreachable) with standalone walkthrough copy'
  - 'shouldShow<X>Prompt() re-show-on-update gate (shown flag + last-shown-app-version flag, compareSemver) for one-time onboarding screens'

requirements-completed: [UP-06, UP-07, UP-09, UP-10]

# Metrics
duration: ~70min
completed: 2026-05-12
---

# Phase 5 Plan 07: HumynUpload OS-Survival Hardening Summary

**The `HumynUpload` OS-survival layer: the `HumynForegroundService` type-downgrade lifecycle (recording `camera|microphone|dataSync` → a second `startForeground` with `dataSync`-only → 5-min idle stop; `onTimeout` → UIDT `UploadJobService` handoff for the Android-15 6-hour `dataSync` cap; the upload drain on the FGS thread), the `UploadJobService` UIDT JobService, the `BatteryOptimizationHelper` (AOSP-first exemption request + the package-installed + `resolveActivity`-gated OEM autostart deep-links with the AOSP fallback), the `BatteryOptimizationScreen.tsx` first-upload walkthrough, the `HumynUploadModule` `@ReactMethod`s + the `native/HumynUpload.ts` `*Safe` variants, and the extended two-sided manifest↔bitmask lock — plus `UploadCoordinator.getShared()` making the module + the FGS + the JobService share one drain.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-05-12T18:55Z (approx)
- **Completed:** 2026-05-12T19:40Z (approx)
- **Tasks:** 3
- **Files modified:** 13 (5 created, 8 modified)

## Accomplishments

- `HumynForegroundService.kt` — the recording→`dataSync`→idle-stop type-downgrade lifecycle (UP-06), the `onTimeout(int,int)`+`onTimeout(int)` → `UploadJobService.scheduleUidt` handoff (UP-07), the upload `drainNow()` on a dedicated `HandlerThread`, the `onRecordingFinalized()` recording→upload handoff seam (UP-10) — the recording superset + the manifest `foregroundServiceType="camera|microphone|dataSync"` UNCHANGED. `HumynForegroundServiceTest` (7 tests) green.
- `UploadJobService.kt` — the UIDT JobService: `onStartJob` → `drainNow()` on a bg thread → `jobFinished(params, queueHasWork())`; `scheduleUidt` → `JobInfo.setUserInitiated(true)` + `NETWORK_TYPE_ANY` (UP-17 — no Wi-Fi gate). The manifest `<service>` (BIND_JOB_SERVICE / exported=false) was shipped in Plan 05-04.
- `BatteryOptimizationHelper.kt` (UP-09) — `requestExempt` always tries the stable AOSP `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` first then the settings-list fallback (both try/caught); the OEM autostart deep-links (Xiaomi MIUI/HyperOS, Oppo ColorOS ×2, older Oppo, Vivo FunTouch, Samsung One UI, Huawei EMUI, Letv) are TWO-gated (vendor package installed AND the explicit component resolves) and try/caught — `false` (no crash) when none reachable; the walkthrough copy stands alone (Pitfall 1 / T-5-07-01). `BatteryOptimizationHelperTest` (5 tests) green.
- `BatteryOptimizationScreen.tsx` — the first-upload walkthrough: AOSP exemption button + post-prompt status reflect, per-vendor steps matching `help-center-content.md`, the conditional OEM "Open Autostart settings" deep-link, the always-shown standalone fallback line, the dismiss → MMKV flags, `shouldShowBatteryOptimizationPrompt()` (re-show on a force-upgrade — idea-brief.md §7.4). Every native call try/caught via the `*Safe` `HumynUpload` variants. `BatteryOptimizationScreen.test.tsx` (8 tests) green.
- `UploadCoordinator.kt` — `queueHasWork()` + `getShared(context)` (the process-wide singleton the module + the FGS + the JobService all drain — one drain serialiser, one queue-store lock) + mutable `setEmitters()`. `HumynUploadModule.kt` — now uses `getShared()`, adds the four `@ReactMethod`s + `setUploadActive(active)`, installs/detaches the real emitters.
- The two-sided lock extended: `HumynForegroundServiceTest` asserts `FGS_TYPE_UPLOADING` is `DATA_SYNC`-only ⊆ `FGS_TYPE_RECORDING` (manifest superset unchanged) + `onTimeout(int,int)` overridden; `manifests.test.ts` asserts the `UploadJobService` `<service>` + `RUN_USER_INITIATED_JOBS` + `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` + the unchanged FGS type string.

## Task Commits

Each task was committed atomically:

1. **Task 1: HumynForegroundService type-downgrade lifecycle + onTimeout + UploadJobService + the extended two-sided lock** — `b1c37e0` (feat) — HumynForegroundService.kt, HumynForegroundNotification.kt, UploadJobService.kt, UploadCoordinator.kt (queueHasWork/getShared/setEmitters), HumynUploadModule.kt (use getShared), HumynForegroundServiceTest.kt, manifests.test.ts
2. **Task 2: BatteryOptimizationHelper.kt + HumynUploadModule @ReactMethods + native/HumynUpload.ts extension + BatteryOptimizationHelperTest.kt** — `6c55ad7` (feat)
3. **Task 3: BatteryOptimizationScreen.tsx — the first-upload OEM walkthrough** — `eb5889f` (feat) — BatteryOptimizationScreen.tsx, state/keys.ts, BatteryOptimizationScreen.test.tsx

**Plan metadata:** see the docs commit that lands this SUMMARY.

## Files Created/Modified

- `apps/mobile/android/.../fgs/HumynForegroundService.kt` — the type-downgrade lifecycle (recording→dataSync→idle-stop), onTimeout→UIDT handoff, the upload drain on a HandlerThread, onRecordingFinalized() seam, onDestroy quitSafely
- `apps/mobile/android/.../fgs/HumynForegroundNotification.kt` — + buildUploading(): "Uploading recordings…" variant
- `apps/mobile/android/.../upload/UploadJobService.kt` — the UIDT JobService (setUserInitiated(true), NETWORK_TYPE_ANY, drainNow() on a bg thread, jobFinished(params, queueHasWork()))
- `apps/mobile/android/.../upload/BatteryOptimizationHelper.kt` — isExempt / requestExempt (AOSP-first + fallback) / oemAutostartAvailable / openOemAutostartIfAvailable (two-gate, try/caught)
- `apps/mobile/android/.../upload/UploadCoordinator.kt` — + queueHasWork() + getShared(context) singleton + setEmitters() (mutable emitters) + queueStore made non-private
- `apps/mobile/android/.../upload/HumynUploadModule.kt` — uses getShared(); + isBatteryOptimizationExempt / requestBatteryOptimizationExemption / oemAutostartAvailable / openOemAutostart / setUploadActive @ReactMethods; installs/detaches the real emitters
- `apps/mobile/src/native/HumynUpload.ts` — + the four battery-opt methods on HumynUpload + the try/catch-wrapped \*Safe variants
- `apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx` — the first-upload OEM walkthrough screen + shouldShowBatteryOptimizationPrompt()
- `apps/mobile/src/state/keys.ts` — + UPLOAD_FIRST_PROMPT_SHOWN / UPLOAD_FIRST_PROMPT_VERSION
- `apps/mobile/android/.../test/.../fgs/HumynForegroundServiceTest.kt` — + FGS_TYPE_UPLOADING ⊆ FGS_TYPE_RECORDING + onTimeout overridden; the seam test now uses the Robolectric controller
- `apps/mobile/__tests__/manifests/manifests.test.ts` — + UploadJobService <service> + RUN_USER_INITIATED_JOBS + REQUEST_IGNORE_BATTERY_OPTIMIZATIONS + the unchanged FGS type string
- `apps/mobile/android/.../test/.../upload/BatteryOptimizationHelperTest.kt` — the 5 Robolectric tests
- `apps/mobile/__tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx` — the 8 vitest tests

## Decisions Made

See `key-decisions` frontmatter — highlights: `UploadCoordinator.getShared()` makes the module + FGS + JobService share one drain (one serialiser, one queue-store lock) with mutable no-op-by-default emitters; OEM autostart is two-gated (package installed AND component resolves) — more ROM-honest and unit-testable under Robolectric; `onRecordingFinalized()` is the seam, Plan 05-08 wires the JS call (HumynCaptureModule.kt untouched); the JS test runs under vitest + `tsc --noEmit`, not Jest/`pnpm`; the uploading notification uses `stat_sys_upload` + generic copy (T-5-07-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two-gated the OEM autostart detection (package-installed + component-resolves) instead of resolveActivity-alone**

- **Found during:** Task 2 (BatteryOptimizationHelperTest)
- **Issue:** Robolectric's `ShadowPackageManager` fabricates a non-null `ResolveInfo` for an explicit-`ComponentName` intent whose _package_ isn't installed, so `oemAutostartAvailable` (resolveActivity-only) returned `true` on a stock Robolectric device — making the "nothing resolves → false, no crash, no startActivity" assertion impossible.
- **Fix:** `BatteryOptimizationHelper.oemAutostartAvailable` / `openOemAutostartIfAvailable` now require BOTH the vendor security-center package being installed (`getPackageInfo`) AND the explicit `ComponentName` resolving. This is also more ROM-honest production behaviour (a non-Xiaomi phone has no `com.miui.securitycenter` at all — skip immediately). Documented in `BatteryOptimizationHelper.kt` + the test header.
- **Files modified:** `apps/mobile/android/.../upload/BatteryOptimizationHelper.kt`
- **Verification:** `BatteryOptimizationHelperTest` (5 tests) green — stock-device → none reachable (false, no startActivity, no crash); a registered fake MIUI activity (which also makes its package "installed") → available + launches that ComponentName with FLAG_ACTIVITY_NEW_TASK.
- **Committed in:** `6c55ad7` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Made UploadCoordinator a process-wide singleton (getShared) + mutable emitters; the module no longer owns a duplicate coordinator/queue-store/NetworkMonitor**

- **Found during:** Task 1 (HumynForegroundService.kt)
- **Issue:** The FGS thread and the UIDT JobService need a `UploadCoordinator` too. The plan's interfaces sketch said "if Plan 05-06 didn't add `getShared(context)` + `queueHasWork()`, add them here" — Plan 05-06 hadn't. Plus: two `UploadCoordinator` instances (the module's + a fresh one for the FGS) would mean two `UploadQueueStore` instances writing the same `queue.json` with _separate_ per-instance locks (a race).
- **Fix:** Added `UploadCoordinator.getShared(context)` (the process-wide singleton wired to `UploadAuthContext`/`UploadControlState`), `queueHasWork()`, and a mutable `setEmitters()` (the singleton starts with no-op emitters for the FGS/JobService threads that have no React bridge; `HumynUploadModule` installs the real `RCTDeviceEventEmitter` ones in `init`, detaches them in `invalidate`, and never shuts the singleton down). `queueStore` was made non-private so the module reuses the singleton's instance. The module dropped its own `NetworkMonitor`.
- **Files modified:** `apps/mobile/android/.../upload/UploadCoordinator.kt`, `apps/mobile/android/.../upload/HumynUploadModule.kt`
- **Verification:** The full upload + fgs Robolectric suite green (BatteryOptimizationHelperTest 5 + NetworkMonitorTest 5 + ChunkUploaderRetryTest 8 + UploadCoordinatorTest 7 + UploadQueueStoreTest 13 + HumynForegroundServiceTest 7); `assembleApkRolloutDebug -x lint` BUILD SUCCESSFUL; `tsc --noEmit` exit 0.
- **Committed in:** `b1c37e0` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical)
**Impact on plan:** Both were flagged or implied by the plan's interfaces / `read_first` (the `getShared`/`queueHasWork` "add it here" note; the OEM deep-link resolveActivity-gate). No scope creep — `HumynCaptureModule.kt` (the `HumynCapture.stop()` → upload-resume / `onRecordingFinalized()` JS-side wiring) and the reconcile sweep / `setUploadContext`-call wiring stay out of scope as Plan 05-08's work.

## Issues Encountered

- The first Kotlin build via `:app:compileApkRolloutDebugKotlin` also re-ran the Metro JS bundle (a stale `transform cache was reset` notice) — harmless; the Kotlin compile succeeded. Subsequent runs were incremental.
- The plan's verification commands name `pnpm jest` / `pnpm tsc` — this repo uses npm + vitest (`npm test` = `vitest run`) and `npx tsc --noEmit` (`npm run typecheck`); used those instead. Recorded in `key-decisions`.

## TDD Gate Compliance

The plan's tasks are `type="auto"` (not `tdd="true"`), and the phase is not in MVP+TDD mode (`config.json` `workflow.tdd_mode: false`). The Kotlin/Robolectric tests were written alongside the production code (the established pattern for this codebase's native-module work — see Plan 05-04/05-06's SUMMARYs); the screen's vitest test was written after the screen. No RED/GREEN gate sequence applies.

## User Setup Required

None — no external service configuration required. (Several behaviours here are manual-only on real hardware — the OEM-walkthrough deep-links on real ROMs, OS-survival through Doze / force-quit, the Android-15 `onTimeout` handoff, the `dataSync` 6h cap — they're in VALIDATION.md's Manual-Only table; the upload smoke runbook (Plan 05-08) carries them. The JS-side `HumynCapture.stop()` → `onRecordingFinalized()` / upload-resume wiring is also Plan 05-08.)

## Next Phase Readiness

- **Plan 05-08** (`uploadReconcile.ts` + the wire-up): `HumynForegroundService.onRecordingFinalized()` is the recording→upload handoff seam to call from `HumynCapture.stop()` (right after stop returns — the app is foreground; do NOT also `stopService` the FGS in that path or the dataSync transition can't happen). `HumynUpload.setUploadActive(active)` is the explicit FGS-toggle `@ReactMethod`. `BatteryOptimizationScreen` + `shouldShowBatteryOptimizationPrompt()` are ready for the first-upload call site (surface the screen once when `shouldShowBatteryOptimizationPrompt()` is true). The `UploadJobService.scheduleUidt(ctx)` path is also available for a BOOT_COMPLETED / Doze-wake resume if Plan 05-08 wants one (Pitfall 4/5: never resume via an FGS from the background — only via the UIDT job).
- **CLAUDE.md `Conventions`/`Architecture` are still empty** — the FGS-type-downgrade / UIDT-job / process-wide-shared-coordinator / two-gate-OEM-deep-link / re-show-on-update-gate patterns above are candidates if/when those sections get populated.

## Self-Check: PASSED

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadJobService.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/BatteryOptimizationHelper.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/BatteryOptimizationHelperTest.kt` — FOUND
- `apps/mobile/src/screens/onboarding/BatteryOptimizationScreen.tsx` — FOUND
- `apps/mobile/__tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx` — FOUND
- commit `b1c37e0` — in `git log`
- commit `6c55ad7` — in `git log`
- commit `eb5889f` — in `git log`
- `:app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.fgs.HumynForegroundServiceTest' --tests 'ai.humynlabs.capture.upload.BatteryOptimizationHelperTest'` — BUILD SUCCESSFUL (7 + 5 tests, 0 failures)
- `:app:assembleApkRolloutDebug -x lint` — BUILD SUCCESSFUL
- `npx vitest run __tests__/screens/onboarding/BatteryOptimizationScreen.test.tsx` — 8 passed; `npx vitest run __tests__/manifests/manifests.test.ts` — 10 passed; `npx vitest run` (full) — 618 passed; `npx tsc --noEmit` — exit 0
- `grep 'foregroundServiceType="camera|microphone|dataSync"' AndroidManifest.xml` — 1 hit (unchanged); `grep 'setUserInitiated(true)' UploadJobService.kt` — 1 hit; `grep 'FOREGROUND_SERVICE_TYPE_DATA_SYNC' HumynForegroundService.kt` — 3 hits

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
