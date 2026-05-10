---
phase: 03-humyn-capture-native-module
plan: 9
plan_id: 03-09
subsystem: humyn-capture-native-module
tags:
  - phase-3
  - wave-5
  - capture
  - js-bridge
  - turbomodule
  - orchestrator-entry
  - apk-module-load
requires:
  - 03-04
  - 03-05
  - 03-06
  - 03-07
  - 03-08
provides:
  - humyn-capture-module-bridge-surface
  - capture-session-opts-bridge
  - segment-duration-config
  - capture-launch-sweep
  - manual-smoke-runbook
affects:
  - apps/mobile/android/app/build.gradle
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/
  - apps/mobile/__tests__/native/HumynCapture.test.ts
  - .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md
tech-stack:
  added:
    - 'com.google.firebase:firebase-bom:34.10.0 (platform import)'
    - 'com.google.firebase:firebase-config (transitively from BOM; plain `implementation` so the dep is on the app Kotlin compile classpath)'
  patterns:
    - 'Bridge-first orchestrator (entry-point module ships before the lifecycle; opts validation surface exercised without spinning up Camera2)'
    - 'Dedicated CaptureSessionOptsBridge file (per checker issue #14 — Robolectric-testable in isolation; mirrors JS-side Zod schema)'
    - 'Sidecar-driven re-finalize (.session.json orphan as recovery signal; CaptureLaunchSweep distinguishes corrupt-vs-recoverable)'
    - "Defense-in-depth at Kotlin bridge end (JS-side Zod rejects first; Kotlin parser refuses anything that doesn't match D-API-02 verbatim)"
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt
    - .planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md
  modified:
    - apps/mobile/android/app/build.gradle
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
    - apps/mobile/__tests__/native/HumynCapture.test.ts
decisions:
  - "firebase-bom + firebase-config added as direct app implementation deps because the autolinked :react-native-firebase_remote-config module declares firebase-config as `implementation` (not `api`), so FirebaseRemoteConfig isn't on the app Kotlin compile classpath through autolinking alone."
  - "CaptureSessionOptsBridge in its own file (per checker issue #14) — NOT inlined inside CaptureSession.kt — so a Robolectric test can exercise the validation surface in isolation without bringing up Camera2 + MediaCodec. Plan 03-10's real CaptureSession will call CaptureSessionOptsBridge.fromBridge unchanged."
  - 'HumynCaptureModule.start() in this plan rejects with `not_implemented_in_03_09` AFTER opts validation passes — Plan 03-10 replaces the body. The Promise.reject path is intentional: it makes the JS bridge integration test exercise the validation surface without requiring the full encoder pipeline.'
  - 'KDoc rewrite: glob patterns like `recordings/*.mp4` are unsafe in Kotlin KDoc (the embedded `/*` opens a nested comment that needs a matching `*/` close). Rewrote with `[base]` placeholders to avoid the parser tripping.'
  - 'Test method name `;` semicolons are illegal in JVM method names even when backticked — renamed `practice file older than 24h deletes; fresh kept` to use a hyphen separator.'
metrics:
  duration_minutes: 19
  duration_seconds: 1199
  tasks_completed: 3
  files_created: 8
  files_modified: 3
  commits: 5
  tests_added_green: 18 # 8 CaptureSessionOptsBridgeTest + 7 CaptureLaunchSweepTest + 3 new HumynCapture.test.ts assertions
  full_kotlin_target_pass: 15 # 8 + 7 — both Plan 03-09 Kotlin test classes 100% green
  full_apps_mobile_vitest_pass: 364 # +3 vs Plan 03-07 baseline of 361
  apk_assemble_apk_rollout_debug: 'BUILD SUCCESSFUL in 2m 48s'
  completed_at: 2026-05-10T19:40:15Z
---

# Phase 3 Plan 03-09: Orchestrator Bridge Wireup Summary

Wave 5 — orchestrator part 1 (the JS-callable surface). This plan wires `HumynCaptureModule` + `HumynCapturePackage` + `SegmentDurationConfig` + `CaptureSessionOptsBridge` into `MainApplication` so JS `NativeModules.HumynCapture` resolves at runtime; ships `CaptureLaunchSweep` alongside the existing Phase 2 compat-probe sweep; extends the JS bridge integration test (`HumynCapture.test.ts`) with a 5th describe block covering the full-module-wired surface; and authors `03-MANUAL-SMOKE.md` for the apkRollout module-load + JS bridge contract smoke walk on Pixel 10a.

Per checker issue #9 split: this plan does NOT ship the segment lifecycle. `CaptureSession.kt` + `FinalizeWorker.kt` + the 5 remaining Wave 0 stub flips (StartGateCarryover, EventEmission, ClockAlignment, RealtimeGate, FileFidelity) live in Plan 03-10. The `HumynCaptureModule.start()` shipped in this plan rejects with `not_implemented_in_03_09` after `CaptureSessionOptsBridge.fromBridge(...)` parses the opts cleanly and `SegmentDurationConfig.load()` reads the duration default — so the JS bridge integration test exercises the validation surface end-to-end without spinning up Camera2 + MediaCodec.

## Decisions Made

| Decision                                                                                                                   | Rationale / Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`firebase-bom` + `firebase-config` direct app deps** (not relying on autolinking-only)                                   | The autolinked `:react-native-firebase_remote-config` module declares `com.google.firebase:firebase-config` as `implementation` (not `api`) in its own `build.gradle`. That keeps the dep off the consuming app's Kotlin compile classpath. `SegmentDurationConfig.load()` calls `FirebaseRemoteConfig.getInstance()` from app-side Kotlin — it must compile against the app's classpath, not the autolinked module's. BOM pinned at v34.10.0 (matches the remote-config module's default). |
| **`CaptureSessionOptsBridge.kt` is its own file (not inlined in `HumynCaptureModule.kt`)**                                 | Checker issue #14 — surfaced in PLAN.md `<must_haves.truths>`. Lets a Robolectric test exercise the ReadableMap → CaptureSessionOpts validator in isolation without bringing up Camera2 + MediaCodec. Plan 03-10's real `CaptureSession` calls `CaptureSessionOptsBridge.fromBridge(...)` unchanged.                                                                                                                                                                                        |
| **`start()` rejects with `not_implemented_in_03_09` after opts validation passes**                                         | The Promise.reject path is intentional: it makes the JS bridge integration test exercise this validation surface without requiring the full encoder pipeline. Plan 03-10 replaces the rejection with the real CaptureSession allocation. The error message includes `durationMs=$durationMs` + `taskId=...` so the smoke operator can confirm both `CaptureSessionOptsBridge.fromBridge` AND `SegmentDurationConfig.load()` ran end-to-end.                                                 |
| **`stop()` rejects with `no_active_session` (always, in Plan 03-09)**                                                      | Plan 03-09 has no path to set `sessionActive = true` (no real start). `stop()`'s reject code lands the right shape for Phase 4 / 5 callers regardless of whether Plan 03-10 has lit up the orchestrator yet.                                                                                                                                                                                                                                                                                |
| **`SegmentDurationConfig.load()` uses imperative `if (raw > 0L)` instead of `takeIf { it > 0 } ?: DEFAULT_MINUTES`**       | Kotlin 2.0 type inference on the chained `Long?.takeIf { ... } ?: Long` failed with `Cannot infer type for this parameter` (the elvis operator's K-type generic couldn't bind). Inline `if/else` typechecks cleanly and reads identically. Pure Rule 1 bug-fix; no semantic change.                                                                                                                                                                                                         |
| **KDoc rewrite to avoid `/*` patterns inside doc blocks**                                                                  | First draft of `CaptureLaunchSweepTest.kt` had `recordings/*.mp4` etc inside the file-level KDoc. Kotlin treats `/*` literally as a nested-comment open even inside `/** ... */`. With 4 `/*` opens and only 1 `*/` close, the parser failed at line 157 col 1 with `Syntax error: Unclosed comment`. Replaced glob wildcards with `[base]` / `[any]` placeholders. Same KDoc fix applied to `CaptureLaunchSweep.kt`.                                                                       |
| **Test name semicolons stripped**                                                                                          | JVM method names disallow `;` even when backticked at the source level. Renamed `practice file older than 24h deletes; fresh kept` → `practice file older than 24h deletes - fresh kept`.                                                                                                                                                                                                                                                                                                   |
| **`HumynForegroundNotification.ensureChannel(this)` called from `MainApplication.onCreate` AS WELL AS the FGS `onCreate`** | Plan 03-07 calls `ensureChannel` from the FGS service's `onCreate` (correct + sufficient — `NotificationManager.createNotificationChannel` is idempotent). PLAN.md's Task 1E mandates a second call from `MainApplication.onCreate` so the channel exists at app boot before the first `start()` runs. Both call sites are no-ops on duplicate ids; defense-in-depth.                                                                                                                       |

## Implementation Notes

### `HumynCaptureModule` surface (the file Phase 4 / Phase 5 bind onto)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`:

- `companion object NAME = "HumynCapture"` — JS resolves `NativeModules.HumynCapture` via this string.
- `private val captureExecutor = Executors.newSingleThreadExecutor()` — single-thread serialises start/stop and never runs heavy work on the main thread (mirrors `HumynCompatModule.bgExecutor`).
- `@Volatile private var sessionActive: Boolean = false` — Plan 03-10 flips this on a successful CaptureSession start, false on stop. Volatile because Plan 03-10's thermal-abort and segment-rotate paths read this from the captureExecutor's worker thread.
- `start(optsMap, promise)`:
  1. parses `CaptureSessionOpts` via `CaptureSessionOptsBridge.fromBridge(optsMap)`;
  2. reads `SegmentDurationConfig.load() * 60_000L`;
  3. rejects with code `not_implemented_in_03_09` (Plan 03-10 replaces this body);
  4. `IllegalArgumentException` mapped to `consent_invalid` (when the message is exactly `"consent_invalid"`) or `invalid_opts` (otherwise);
  5. any other `Throwable` → `internal_error`.
- `stop(promise)` — rejects with `no_active_session` unconditionally (Plan 03-09 cannot start sessions); Plan 03-10 fills in the real stop logic.
- `internal fun emitEvent(name, payload)` — Plan 03-10 hook; pushes a payload into the JS NativeEventEmitter via `DeviceEventManagerModule.RCTDeviceEventEmitter`. Internal (package-private) so only same-package callers (CaptureSession) emit; outside callers go through the JS bridge.

### `CaptureSessionOptsBridge` validation surface (D-API-02 verbatim)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt`:

- Three Kotlin data classes mirror D-API-02: `CaptureSessionOpts`, `Contributor`, `StartGateOpts`.
- `object CaptureSessionOptsBridge.fromBridge(ReadableMap): CaptureSessionOpts` — extracts every D-API-02 field; validates non-empty strings; `taskSetting ∈ {indoor, outdoor}`; `gender ∈ {male, female, non-binary, prefer-not-to-say, null}`; `contributor.consent === true`; `dfovDegrees > 0`; `appVersion` matches the semver shape `^\d+\.\d+\.\d+(?:[+-].+)?$`; `startGate.type === "hand_detection"`; numeric startGate fields > 0 (or ≥ 0 for `durationMs`).
- Throws `IllegalArgumentException("consent_invalid")` for the consent-bypass attempt (T-3.9-01 mitigation).
- Throws `IllegalArgumentException("invalid_opts: $field")` for every other failure — message carries the failing field name so the JS side can disambiguate.
- No filename / session-id / segment-id field is accepted — those are server-side (Kotlin) sourced from `FilenameGenerator.nextBase()` + `UlidGenerator.next()` (Plan 03-05). Mitigation for T-3.9-02 path-traversal threat.

### `CaptureLaunchSweep` orphan recovery (D-FS-04)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt`:

Three sweeps run from `MainApplication.onCreate` after the existing compat-probe sweep:

1. `recordings/[base].mp4` without matching `.json`:
   - if `.session.json` exists AND parseable → log + leave (Phase 4 re-finalize candidate).
   - if no sidecar OR `SidecarManager.read` throws `IllegalArgumentException("sidecar_corrupt")` → delete the triple (mp4 + csv + corrupt sidecar). T-3.4-01 mitigation.
2. `recordings/[base].json` (non-`.session.json`) without matching `.mp4` → delete (orphan JSON; metadata wrote successfully but the muxer crashed before a frame landed).
3. `practice/[any]` files older than 24 h → delete (defensive; old practice files are crash residue per ONB-08 single-practice-per-install rule).

Idempotent: missing `recordings/` or `practice/` dirs are skipped silently.

### `SegmentDurationConfig` — D-SEG-01

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt`:

- `KEY = "capture.segment_minutes"`, `DEFAULT_MINUTES = 10L`.
- `load(): Long` — reads `FirebaseRemoteConfig.getInstance().getLong(KEY)`; falls back to `DEFAULT_MINUTES` on any error (no Firebase init, no network, fetch timeout, zero/negative value).
- `MainApplication.onCreate` calls `setDefaultsAsync(KEY → DEFAULT_MINUTES)` BEFORE the JS side ever invokes `start()`, so `getLong(KEY)` returns 10L even before the first network fetch completes.

### `MainApplication.onCreate` — full extension chain

```
super.onCreate()
SoLoader.init(this, OpenSourceMergedSoMapping)
load()                                                    // existing — new architecture entry point
cacheDir.listFiles { startsWith("compat-probe-") ... }    // existing — Phase 2 sweep
   ?.forEach { it.delete() }
CaptureLaunchSweep(filesDir).run()                        // NEW — Plan 03-09 D-FS-04
FirebaseRemoteConfig.getInstance().setDefaultsAsync(...)  // NEW — Plan 03-09 D-SEG-01 default
HumynForegroundNotification.ensureChannel(this)           // NEW — Plan 03-09 ensures channel pre-start
```

`getPackages()` extension:

```
packages.add(AppFlavorPackage())
packages.add(PlayIntegrityPackage())
packages.add(HumynCompatPackage())
packages.add(HumynUpdaterPackage())
packages.add(HumynCapturePackage())   // NEW — Plan 03-09 Phase 3 capture pipeline entry
```

## Pattern Callouts (for Plan 03-10 + downstream waves to reuse)

1. **Bridge-first orchestrator** — entry-point module ships before the lifecycle, so the JS bridge integration test exercises the validation surface without spinning up Camera2. The `not_implemented_in_03_09` Promise.reject is the explicit hand-off point Plan 03-10 replaces.
2. **Dedicated `CaptureSessionOptsBridge`** (per checker issue #14) — Robolectric-testable in isolation; mirrors the JS Zod schema. Future bridge contracts that need defense-in-depth at the Kotlin end should follow the same per-file factoring.
3. **Sidecar-driven re-finalize** — `.session.json` orphan as recovery signal; `CaptureLaunchSweep` distinguishes corrupt-vs-recoverable. Plan 03-10's `RecordingScreen` will pick up the recoverable orphans on cold launch.
4. **Defense-in-depth at the Kotlin bridge end** — JS-side Zod rejects malformed input first; Kotlin bridge refuses anything that doesn't match D-API-02 verbatim. Both reject `consent: false` independently.
5. **KDoc `*/` hazard** — globs like `recordings/*.mp4` inside `/** ... */` blocks parse as nested-comment opens. Use `[base]` / `[any]` placeholders or escape with backticks instead.

## Wave 0 Stub Flip Targets — Running Counter

| Plan                  | Stubs flipped this plan | Cumulative flipped | Stubs MISSING after this plan                                                                                              |
| --------------------- | ----------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 03-04 (Wave 2 entry)  | n/a (created 18 stubs)  | 0                  | 18                                                                                                                         |
| 03-05                 | 6                       | 6                  | 12                                                                                                                         |
| 03-06                 | 1                       | 7                  | 11                                                                                                                         |
| 03-07                 | 2                       | 9                  | 9                                                                                                                          |
| 03-08                 | 4                       | 13                 | 5                                                                                                                          |
| **03-09 (this plan)** | **0**                   | **13**             | **5** ← Plan 03-09 ships the bridge surface + sweep; does NOT flip Wave 0 stubs (those land in Plan 03-10's orchestrator). |
| 03-10 (Wave 6)        | 5                       | 18                 | 0                                                                                                                          |

Plan 03-09's deliverable is orthogonal to the Wave 0 stub flip count: this plan ships the JS bridge entry point (`HumynCaptureModule`), the validation surface (`CaptureSessionOptsBridge`), the segment-duration config seam (`SegmentDurationConfig`), and the orphan recovery sweep (`CaptureLaunchSweep`) — none of which are scoped to a specific Wave 0 stub. The remaining 5 stubs (StartGateCarryover, EventEmission, ClockAlignment, RealtimeGate, FileFidelity) all flip when Plan 03-10 ships `CaptureSession.kt` + `FinalizeWorker.kt`.

## Phase 3 Acceptance State at Plan 03-09 Commit

Per CONTEXT.md D-WAVE-01: Phase 3 acceptance is module-ready + Kotlin pure-fn unit tests + JS bridge contract.

**Module-ready (✓):** `MainApplication` registers `HumynCapturePackage`; JS `NativeModules.HumynCapture` resolves; `start()` validates opts and reads segment duration before the explicit `not_implemented_in_03_09` reject; `CaptureLaunchSweep` runs at boot.

**Kotlin pure-fn unit tests:** Plans 03-04 (FragmentedMuxerWrapperTest GREEN) + 03-05 (6 stubs flipped) + 03-06 (1 stub) + 03-07 (2 stubs) + 03-08 (4 stubs) + this plan's 8 + 7 = 15 new GREEN tests (CaptureSessionOptsBridgeTest 8 + CaptureLaunchSweepTest 7). 5 remaining MISSING — Wave 0 stubs flip when Plan 03-10 ships.

**JS bridge contract (✓):** `HumynCapture.test.ts` 18/18 GREEN across 5 describe blocks (not-registered / registered / event-subscriptions / **full-module-wired Plan 03-09 surface (NEW)** / Zod cross-validation). Full `apps/mobile` vitest suite 364/364 GREEN, +3 vs Plan 03-07 baseline.

**Awaiting:** Plan 03-10 (Wave 6) for the orchestrator (CaptureSession + FinalizeWorker + the 5 remaining stub flips); operator on-device smoke walk per `03-MANUAL-SMOKE.md` after Plan 03-10 lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] firebase-config not on Kotlin compile classpath through autolinking alone**

- **Found during:** Task 1 first compile run after wiring `SegmentDurationConfig.kt`. `Unresolved reference 'FirebaseRemoteConfig'` for both `MainApplication.kt` and `SegmentDurationConfig.kt`.
- **Issue:** Verified by inspecting `node_modules/@react-native-firebase/remote-config/android/build.gradle` lines 84-89: `firebase-config` is declared as `implementation` (not `api`), so the dep doesn't propagate to the consuming app's Kotlin compile classpath. The autolinked module's own Java code can use `FirebaseRemoteConfig`, but the app's Kotlin can't.
- **Fix:** Added `implementation platform('com.google.firebase:firebase-bom:34.10.0')` + `implementation 'com.google.firebase:firebase-config'` to `apps/mobile/android/app/build.gradle`. BOM pinned at v34.10.0 matches the autolinked remote-config module's default (via `apps/mobile/node_modules/@react-native-firebase/app/sdkVersions.android.firebase`).
- **Files modified:** `apps/mobile/android/app/build.gradle` (Plan 03-09 dep block).
- **Commit:** `84f98ec`

**2. [Rule 1 — Bug] Kotlin 2.0 type-inference fail on `Long?.takeIf {} ?: Long` chain**

- **Found during:** Task 1 first compile run. `Argument type mismatch: actual type is 'K#1 (of fun <K> ELVIS_CALL)', but 'K#2 (of fun <K> TRY_CALL)' was expected.`
- **Issue:** `rc.getLong(KEY).takeIf { it > 0 } ?: DEFAULT_MINUTES` — Kotlin 2.0's improved type inference can't bind the elvis operator's K-type generic against the `takeIf` chain when both sides are `Long`. The compiler emits 6 cascading errors against the same expression.
- **Fix:** Inline `if/else` typechecks cleanly: `val raw: Long = rc.getLong(KEY); if (raw > 0L) raw else DEFAULT_MINUTES`. Reads identically; no semantic change.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt`.
- **Commit:** `84f98ec`

**3. [Rule 1 — Bug] KDoc with embedded `/*` patterns parses as unclosed comment**

- **Found during:** Task 2 first compile run. `Syntax error: Unclosed comment` at the test file's last-line column 1.
- **Issue:** Both `CaptureLaunchSweep.kt` and `CaptureLaunchSweepTest.kt` had glob-shape doc comments like `recordings/*.mp4` and `practice/*` inside the file-level `/** ... */` block. Kotlin treats `/*` literally as a nested-comment open even within `/** ... */`. The test file had 4 `/*` opens and only 1 `*/` close, so the parser hit EOF still inside an open comment.
- **Fix:** Replaced glob wildcards with `[base]` / `[any]` placeholders. KDoc still reads cleanly; doesn't trip the parser.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt`.
- **Commit:** `df2aef9`

**4. [Rule 1 — Bug] Test method name with `;` semicolon — JVM-illegal even backticked**

- **Found during:** Task 2 second compile run. `Name contains illegal characters: ;` at the offending `@Test fun`.
- **Issue:** Backticked test names allow most non-identifier characters but JVM method names (per JVMS §4.2.2) disallow `.`, `;`, `[`, `/`, `<`, `>`. The Kotlin compiler enforces this at the source level even when the name is backticked.
- **Fix:** Renamed `practice file older than 24h deletes; fresh kept` → `practice file older than 24h deletes - fresh kept`. No test-behavior change.
- **Files modified:** `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt`.
- **Commit:** `df2aef9`

**5. [Rule 3 — Blocking] Worktree node_modules + local.properties + google-services.json infra**

- **Found during:** First gradle run.
- **Issue:** Fresh Claude Code worktree only checks out tracked files. `node_modules/`, `apps/mobile/android/local.properties`, and `apps/mobile/android/app/src/apkRollout/google-services.json` are gitignored and don't replicate. Without them gradle can't resolve the React Native gradle plugin, find the Android SDK, or accept the Firebase plugin. Same blocker Plans 03-04 / 03-05 / 03-07 documented.
- **Fix:**
  - `cd apps/mobile && npm ci --prefer-offline` (cached install, ~7 s).
  - `pnpm install --prefer-offline` at workspace root (cached, ~3 s) — restores `lint-staged` + per-package `node_modules` so the husky pre-commit hook runs.
  - Wrote `apps/mobile/android/local.properties` with `sdk.dir=/Users/adnaan/Library/Android/sdk` (mirrors main repo, gitignored — never committed).
  - Copied `apps/mobile/android/app/src/apkRollout/google-services.json` from the main repo (gitignored — never committed).
- **Files modified:** None tracked (all infra is gitignored).
- **Commit:** N/A (infra side-effect; no commit).

### Architectural Changes

**None.** All deviations were narrow bug-fixes (KDoc parsing, JVM naming, type inference) and missing-classpath wiring (firebase-config). All documented inline in the modified files. No architectural decisions changed; no Rule-4 escalations.

### Out of Scope (Deferred / Logged)

- **Pre-existing `compat/` test NPEs** (`DeviceCapsTest`, `EncoderProbeTest`, `ImuProbeTest`, `NalParserTest`) — 15 failures total, all NPE root-cause from `MainApplication.onCreate`'s `SoLoader.init` Robolectric NPE. Confirmed pre-existing at the merge-base 96ed810 by a checked-in compat test run. The fix is the `@Config(application = Application::class)` override Plan 03-04 documented; applying it across all compat tests is a separate cleanup task (cosmetic/test-infra, not Plan 03-09 scope). Same out-of-scope deferral Plans 03-04 / 03-05 / 03-07 documented.
- **Pre-existing `RootNativeStack.test.tsx` unhandled rejections (3 errors, 0 test failures).** Same Plan 03-04 deferral. Not introduced by this plan; out of scope per the per-plan scope-boundary rule.
- **5 remaining MISSING — Wave 0 stubs** (StartGateCarryover, EventEmission, ClockAlignment, RealtimeGate, FileFidelity). Intentional Wave 0 contract; flip when Plan 03-10 ships the orchestrator. Documented in Plan 03-04 SUMMARY's stub-flip table.
- **Brand FGS notification icon (`@drawable/ic_fgs_recording`).** Plan 03-07 SUMMARY noted as a Plan 03-09 polish task but the brand resource isn't pinned in PLAN.md; kept the framework `android.R.drawable.ic_media_play` placeholder. Future plan can swap when the asset is finalised.

## Threat Surface

The plan's `<threat_model>` register is honored verbatim:

- **T-3.9-01 (Tampering — `consent: false` bypass):** mitigated. `CaptureSessionOptsBridge.fromBridge` rejects `consent !== true` with `IllegalArgumentException("consent_invalid")` (test: `consent false throws consent_invalid`); `HumynCaptureModule.start()` maps that to `promise.reject("consent_invalid", ...)`. Plus the JS-side Zod schema (Plan 03-04) rejects on `z.literal(true)`. Defense-in-depth at both bridge ends.
- **T-3.9-02 (Spoofing — path traversal via filenameBase injection from JS):** mitigated. JS NEVER provides filename. Plan 03-05's `FilenameGenerator.nextBase()` is the sole filename source — server-side (Kotlin) and uses date-pattern + ls-derived NNN. `CaptureSessionOptsBridge` has no `filename` field.
- **T-3.9-03 (DoS — start() called twice without intervening stop()):** mitigated to the extent Plan 03-09's surface allows. The `captureExecutor` single-thread serialises start/stop calls. The `sessionActive` flag is the seam Plan 03-10's CaptureSession allocation path enforces (rejects re-start while a session runs); Plan 03-09 cannot start a session at all so the threat is structurally absent here.
- **T-3.9-04 (Information disclosure — `.session.json` sidecar PII after a crash):** mitigated. App-launch sweep (`CaptureLaunchSweep`) deletes corrupt sidecars (`SidecarManager.read` throws `sidecar_corrupt` → triple discarded); valid sidecars stay until Phase 4 re-finalize completes. App-private filesDir is Linux UID-scoped. PII exposure window equals "from crash to next cold launch" — bounded.
- **T-3.9-05 (Tampering — Gradle dep substitution attack on firebase-config):** accept disposition preserved. `apps/mobile/android/app/build.gradle` uses the `mavenCentral()` + `google()` repositories already declared at the project level (Phase 1 baseline). The new `firebase-bom` + `firebase-config` deps come from the GPG-signed `com.google.firebase` namespace published by Google.

No new threat surface introduced beyond what the plan anticipated.

## Verification Results

- **Plan 03-09 Kotlin tests:** 15/15 GREEN (8 `CaptureSessionOptsBridgeTest` + 7 `CaptureLaunchSweepTest`).
- **`apps/mobile` full vitest suite:** **364/364 tests pass** (62 test files), +3 vs Plan 03-07 baseline of 361 — the 3 new full-module-wired assertions in `HumynCapture.test.ts`. Pre-existing 3 unhandled rejections in `RootNativeStack.test.tsx` remain out-of-scope.
- **Gradle compile sources:** `./gradlew :app:compileApkRolloutDebugSources` exits 0.
- **Gradle full APK assemble:** `./gradlew :app:assembleApkRolloutDebug` exits 0 (BUILD SUCCESSFUL in 2m 48s) — release-shaped APK at `app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`.
- **Acceptance grep checks (Task 1):** All 7 grep assertions pass (`HumynCapturePackage()`, `HumynForegroundNotification.ensureChannel`, `NAME = "HumynCapture"`, `captureExecutor`, `not_implemented_in_03_09`, `KEY = "capture.segment_minutes"`, `DEFAULT_MINUTES = 10L`).
- **Acceptance grep checks (Task 2):** All 3 grep assertions pass (`CaptureLaunchSweep(filesDir).run()`, `session.json` in sweep, 7 `@Test` blocks).
- **Acceptance grep checks (Task 3):** All 4 grep assertions pass (`Smoke-walked-on:`, `deferred`, `not_implemented_in_03_09`, file exists).

## Self-Check: PASSED

All 11 created/modified files exist and all 5 commits exist on the worktree branch:

- `49d9e31` — test(03-09): RED — CaptureSessionOptsBridge ReadableMap → CaptureSessionOpts parser
- `84f98ec` — feat(03-09): GREEN — HumynCaptureModule + Package + Bridge + SegmentDurationConfig
- `3d56901` — test(03-09): RED — CaptureLaunchSweep + JS bridge full-module describe block
- `df2aef9` — feat(03-09): GREEN — CaptureLaunchSweep wired to MainApplication.onCreate
- `028f04b` — docs(03-09): 03-MANUAL-SMOKE.md — apkRollout module-load + JS bridge runbook

File presence verification (all FOUND):

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCapturePackage.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SegmentDurationConfig.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridgeTest.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt` (modified — registers `HumynCapturePackage`, calls `CaptureLaunchSweep`, `setDefaultsAsync`, `ensureChannel`)
- `apps/mobile/android/app/build.gradle` (modified — `firebase-bom` + `firebase-config` deps)
- `apps/mobile/__tests__/native/HumynCapture.test.ts` (modified — 5th describe block)
- `.planning/phases/03-humyn-capture-native-module/03-MANUAL-SMOKE.md`

## TDD Gate Compliance

Plan 03-09 is `type: execute` (not `type: tdd`), but Tasks 1 and 2 are `tdd="true"`. Per-task gate sequence:

- **Task 1:** RED `49d9e31` (`test(03-09): RED — CaptureSessionOptsBridge ...`) → GREEN `84f98ec` (`feat(03-09): GREEN — ...`). REFACTOR not needed.
- **Task 2:** RED `3d56901` (`test(03-09): RED — CaptureLaunchSweep + JS bridge full-module describe block`) → GREEN `df2aef9` (`feat(03-09): GREEN — CaptureLaunchSweep wired to MainApplication.onCreate`). REFACTOR not needed.
- **Task 3:** `type: auto` (not TDD); single `docs` commit `028f04b`.

Both TDD tasks land RED before GREEN. Both RED commits compile-fail with unresolved-reference errors against the production classes (the canonical "test-doesn't-pass-without-implementation" signal). Both GREEN commits include the implementation that makes the prior RED commit's tests pass.

## Known Stubs

None new. Plan 03-04's 5 remaining capture/ Wave 0 stubs (StartGateCarryover, EventEmission, ClockAlignment, RealtimeGate, FileFidelity) all flip when Plan 03-10 ships the orchestrator. No production-code stubs (no `TODO` / `FIXME` / `placeholder` / `not implemented` strings introduced in shipped source files; the one inline `not_implemented_in_03_09` Promise reject in `HumynCaptureModule.start()` is the explicit Plan 03-10 hand-off contract documented above and tested in `HumynCapture.test.ts`).

---

_Plan: 03-09 — orchestrator-bridge-wireup_
_Completed: 2026-05-10T19:40:15Z (~19 minutes wall time including infra restore + KDoc parsing debug + firebase-config dep addition)_
