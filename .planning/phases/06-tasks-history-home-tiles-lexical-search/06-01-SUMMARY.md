---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 01
subsystem: mobile-audio
tags: [android, kotlin, soundpool, vibrator, robolectric, react-native, observability]

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    provides: HumynBeep native module 3-file triad (kotlin SoundPool wrapper)
  - phase: 04-recording-flow-rec-screen-cuesvoices
    provides: useRecordingLifecycle.ts Vibration.vibrate call sites + playTone wiring
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: Phase-5 close-out finding (05-COSMETIC-GAPS.md D-06 -- audibility silence at MAX media volume on Pixel 10a / Android 16)
provides:
  - HumynBeep SoundPool flipped to AudioAttributes.USAGE_MEDIA (cue routes to user-controlled STREAM_MUSIC)
  - SoundPool load/play observability via Log.i("HumynBeep", ...) at every boundary (load, loadComplete, playTone request, play return, pendingPlay)
  - streamId == 0 BEEP_FAILED guard extracted as a @VisibleForTesting @JvmStatic helper (single contract for production + unit test)
  - VIBRATE permission explicitly declared in the base AndroidManifest (auto-merge timing-independent)
  - JS-side `[HumynBeep][haptic]` __DEV__ log lines at both Vibration.vibrate call sites
  - HumynBeepModuleTest Robolectric coverage (3 @Test methods: USAGE_MEDIA + streamIdGuard branches)
affects: [phase-06-wave-2, phase-06-manual-smoke-runbook, phase-07-observability]

# Tech tracking
tech-stack:
  added: [] # no new deps; reuses existing androidx.annotation + robolectric harness
  patterns:
    - 'Companion-object @VisibleForTesting @JvmStatic helpers for unit-testing private-by-default native-module logic without standing up the catalyst instance'
    - 'RecordingPromise test double (mirrors HumynHandDetectorModuleTest pattern) -- no mockito on classpath'

key-files:
  created:
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/beep/HumynBeepModuleTest.kt
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt
    - apps/mobile/android/app/src/main/AndroidManifest.xml
    - apps/mobile/src/screens/recording/useRecordingLifecycle.ts

key-decisions:
  - "USAGE_MEDIA replaces USAGE_ASSISTANCE_SONIFICATION on the SoundPool AudioAttributes (D-09): the previous usage routed to the silent-at-MAX-media-volume system stream on Android 16 / Pixel 10a; USAGE_MEDIA puts the cue on STREAM_MUSIC where the operator's volume control IS the relevant control."
  - "Extracted streamIdGuard(...) helper for parity between the production playTone path and the Robolectric test contract; the inline Log.i('play returned ...') line stays so the operator's logcat shape is unchanged."
  - 'Extracted buildAudioAttributes() helper (Task 1) specifically for the Task-3 Robolectric assertion; the body is identical to what ensurePool() inlines into SoundPool.Builder.setAudioAttributes(...).'
  - 'VIBRATE permission declared in the BASE manifest (not the apkRollout source-set) since the runtime use is flavor-independent; explicit declaration insulates the merged manifest from RN library auto-merge timing changes.'
  - 'JS-side haptic logs are __DEV__-guarded -- prod build stays quiet; logcat tail is the only consumer.'

patterns-established:
  - "Pattern: native-module audibility instrumentation -- Log.i('Tag', ...) at each observable boundary (load / loadComplete / request / play return), wrapped streamId guard for genuine failures."
  - 'Pattern: companion-object @VisibleForTesting @JvmStatic helpers -- the single contract surface tested by Robolectric AND called from production. Avoids mockito-kotlin classpath additions.'

requirements-completed: [] # plan has no requirements: field (D-09 Wave 1 is Phase-5 carry-over cleanup, not a new REQUIREMENTS entry)

# Metrics
duration: ~30min
completed: 2026-05-14
---

# Phase 6 Plan 01: HumynBeep Audibility + Haptic Restore (D-09 Wave 1) Summary

**SoundPool flipped to USAGE_MEDIA, load/play paths instrumented, VIBRATE permission audited, streamIdGuard extracted with Robolectric coverage -- Phase-5 Item-5 silence-at-MAX-media-volume cosmetic gap is structurally addressed; hardware verdict deferred to 06-MANUAL-SMOKE.md §1 at end-of-phase per D-09b.**

## Performance

- **Duration:** ~30 min (planning load + 4 commits + verification + summary)
- **Started:** 2026-05-13T20:30:00Z (approximate -- worktree spawn)
- **Completed:** 2026-05-13T21:04:20Z
- **Tasks:** 3 (Task 3 is `tdd="true"` and produced 2 commits: RED + GREEN)
- **Commits:** 4 atomic commits
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **Audibility fix landed:** `HumynBeepModule.kt` SoundPool now uses `AudioAttributes.USAGE_MEDIA`. The cue (520 Hz battery / 440→560→680 Hz thermal) will route through STREAM_MUSIC, which IS what the operator's MAX media-volume control adjusts. Phase-5 Item-5 silence root cause: `USAGE_ASSISTANCE_SONIFICATION` routes to the system stream which is silent at MAX media volume on Android 16 / Pixel 10a (06-RESEARCH Pattern 8, [CITED: developer.android.com/reference/android/media/AudioAttributes]).
- **Diagnosability:** `Log.i("HumynBeep", ...)` at every observable boundary: `load`, `loadComplete`, `playTone request` (with `streamVolume` / `maxVolume`), `play returned`, `pendingPlay fired`. The operator can `adb logcat -s HumynBeep` and see the entire cue lifecycle in one stream.
- **Guard correctness:** `streamId == 0` BEEP_FAILED guard now also covers the queued (`OnLoadCompleteListener`) playback branch — previously only the synchronous `playTone()` path checked the return value.
- **Manifest audit:** `<uses-permission android:name="android.permission.VIBRATE" />` is now explicit in the base manifest, insulating the merged manifest from RN library auto-merge timing.
- **JS-side logs:** Both `Vibration.vibrate(...)` call sites in `useRecordingLifecycle.ts` emit a `__DEV__`-guarded `[HumynBeep][haptic]` log so JS-side haptic intent correlates against the Kotlin Log.i audibility logs in a single logcat tail.
- **Robolectric coverage:** 3 `@Test` methods asserting USAGE_MEDIA on the AudioAttributes + both branches of the new `streamIdGuard` helper (zero → reject BEEP_FAILED, non-zero → no reject).
- **TDD gate sequence intact:** `test(06-01)` (RED) → `feat(06-01)` (GREEN), in that order.

## Task Commits

| #         | Task                                                      | Hash      | Type  | Files                                                                                                                |
| --------- | --------------------------------------------------------- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| 1         | Instrument SoundPool path + flip USAGE_MEDIA              | `cdfeb5b` | fix   | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt`                                 |
| 2         | Declare VIBRATE perm + log haptic intent at JS call sites | `c6ec798` | chore | `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` |
| 3 (RED)   | Failing Robolectric tests for audibility-fix contract     | `3f1723f` | test  | `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/beep/HumynBeepModuleTest.kt` (created)                   |
| 3 (GREEN) | streamIdGuard helper -- makes RED tests resolvable        | `391e3f1` | feat  | `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt`                                 |

**Plan metadata commit:** to be added with SUMMARY.md (this file).

## Files Created/Modified

- **`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt`** _(modified)_ — USAGE_ASSISTANCE_SONIFICATION → USAGE_MEDIA flip; `buildAudioAttributes()` + `streamIdGuard(...)` @VisibleForTesting @JvmStatic helpers on the companion object; cached AudioManager for STREAM_MUSIC volume logging; Log.i instrumentation at every observable boundary; queued-play branch also runs the streamId guard (Log.w only — the queued path is fire-and-forget). Imports added: `android.util.Log`, `android.media.AudioManager`, `android.content.Context`, `androidx.annotation.VisibleForTesting`.
- **`apps/mobile/android/app/src/main/AndroidManifest.xml`** _(modified)_ — Explicit `<uses-permission android:name="android.permission.VIBRATE" />` in the base manifest. RN's Vibration module's own manifest already auto-merges this in, but the explicit declaration insulates against future auto-merge timing changes on Android 16 / Pixel 10a (06-RESEARCH Pattern 8 "Vibrator fix candidates").
- **`apps/mobile/src/screens/recording/useRecordingLifecycle.ts`** _(modified)_ — `__DEV__`-guarded `console.log('[HumynBeep][haptic] battery-low pattern=[0,100,50,100]')` line before the battery-low `Vibration.vibrate([0, 100, 50, 100])` call (~line 309); analogous thermal-kill `[HumynBeep][haptic] thermal-kill pattern=800ms` line before `Vibration.vibrate(800)` (~line 341). No call-shape changes — RN's Vibration module already translates the long-array overload to `VibrationEffect.createWaveform` on API ≥26 per RCTVibrator (06-RESEARCH Pattern 8 §"Vibrator fix candidates"); no native VibratorManager binding introduced.
- **`apps/mobile/android/app/src/test/java/ai/humynlabs/capture/beep/HumynBeepModuleTest.kt`** _(created)_ — 3 Robolectric `@Test` methods (sdk=33, application=Application::class), 171 lines including the RecordingPromise test double (mirrors `HumynHandDetectorModuleTest`'s pattern; no mockito on classpath). Tests: `audioAttributes_usageIsMedia`, `streamIdGuard_rejectsPromise_whenStreamIdZero`, `streamIdGuard_resolvesPromise_whenStreamIdNonZero`.

## Decisions Made

- **D-09 flip applied as specified.** USAGE_ASSISTANCE_SONIFICATION → USAGE_MEDIA on the SoundPool AudioAttributes. The owner-mandated instrument-then-flip heuristic (CONTEXT D-09: "Wave 1 is allowed to leave the SoundPool flip behind a Log-I gate if the instrumentation pass shows a different root cause") is satisfied because the instrumentation + the flip are co-authored in this single commit, AND 06-RESEARCH Pattern 8 already documents the root cause with AOSP-doc citation. Logs + flip ship together.
- **streamIdGuard contract extraction (Task 3 GREEN refactor).** The post-`SoundPool.play()` guard is extracted into a `@VisibleForTesting @JvmStatic` companion-object helper so Robolectric can exercise both branches without standing up the full SoundPool / native catalyst instance (Robolectric's `ShadowSoundPool` does not simulate the audio framework's stream-id allocation). The single `playTone()` call site funnels through the same helper, keeping the production and test contracts identical.
- **JS-side logs `__DEV__`-guarded.** The CLAUDE.md "no notifications / no extra logging at MVP" spirit means production builds stay quiet; logcat tail is the only consumer.
- **VIBRATE in base manifest, not apkRollout source-set.** Vibrate is flavor-independent (both Play Store + apkRollout flavors need haptics during recording). Per the manifest header comment, only the in-app install-source permission is flavor-scoped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan's `useRecordingLifecycle.ts` path was wrong**

- **Found during:** Task 2 (VIBRATE permission + JS-side logs)
- **Issue:** Plan frontmatter `files_modified` and Task 2 `<files>` reference `apps/mobile/src/hooks/useRecordingLifecycle.ts`. That path does not exist. The actual file is at `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` (Phase 4 plan 04-08's authored location).
- **Fix:** Edited the real path. Plan-stated path is preserved verbatim in this SUMMARY's deviation log for future planner audit; the next plan in this phase should reference the actual `screens/recording/...` path.
- **Files modified:** `apps/mobile/src/screens/recording/useRecordingLifecycle.ts`
- **Verification:** `grep -c "Vibration.vibrate(\[0, 100, 50, 100\])" apps/mobile/src/screens/recording/useRecordingLifecycle.ts` returns `1` (the canonical battery-low call site); `grep -c "Vibration.vibrate(800)" apps/mobile/src/screens/recording/useRecordingLifecycle.ts` returns `2` (one real call + one pre-existing reference in the file-header `§10 policy table` comment — see note below).
- **Committed in:** `c6ec798` (Task 2 commit)

**2. [Rule 2 — Missing critical functionality] streamId == 0 guard extended to the queued/pending-play branch**

- **Found during:** Task 1 (SoundPool instrumentation)
- **Issue:** The previous code only checked the `SoundPool.play()` return value on the synchronous "sample already loaded" branch. When a `playTone()` arrived BEFORE the decode completed (the rare race the `pendingPlays` set guards against), the deferred `sp.play(...)` invocation inside `OnLoadCompleteListener.onLoadComplete` did NOT check the return value — a late `play() == 0` would have been silently inaudible without operator-visible signal, defeating the whole point of the Task-1 instrumentation pass.
- **Fix:** Mirror the streamId == 0 guard inside the `OnLoadCompleteListener`. Log.w only — the queued path is fire-and-forget by design (the promise has already resolved by the time the late decode fires), so a reject would be unobservable; the Log.w surfaces the failure in logcat where the operator can see it. Production behavior unchanged on the success path.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt`
- **Verification:** `grep -c 'pendingPlay returned 0'` returns `1`.
- **Committed in:** `cdfeb5b` (Task 1 commit)

**3. [Rule 3 — Blocking, environmental] Worktree environment cannot run Gradle test/manifest/compile gates**

- **Found during:** Task 1 (compile gate), Task 2 (manifest-merge gate), Task 3 (test gate)
- **Issue:** Plan's `<verify>` blocks call for `./gradlew :app:compileApkRolloutDebugKotlin`, `./gradlew :app:processApkRolloutDebugManifest`, and `./gradlew :app:testApkRolloutDebugUnitTest --tests ai.humynlabs.capture.beep.HumynBeepModuleTest`. All three are blocked by the same root cause: the Claude Code worktree spawn does NOT carry `apps/mobile/node_modules` (correct behavior — node_modules is gitignored). The RN settings.gradle file references `node_modules/@react-native/gradle-plugin` as an included build, which cannot be resolved when node_modules is absent.
- **Mitigation attempted:** Symlinked `node_modules`, `apps/api/node_modules`, and `apps/mobile/node_modules` from the parent repo into the worktree. The settings.gradle plugin then resolved, but the Metro `createBundleApkRolloutDebugJsAndAssets` task fails with `Unable to resolve module @babel/runtime/helpers/interopRequireDefault from .../apps/mobile/index.js` — Metro's haste resolver follows the symlink target (parent repo path) but the project root it's given is the worktree path; the dep is reachable from neither rooted lookup.
- **Fix:** Static grep gates on each file (the acceptance-criteria gates the plan author wrote alongside the gradle gates) all pass. The compile / manifest-merge / test-execution gradle gates are deferred to the orchestrator's post-merge build job, which runs in the main repo with a fully-populated node_modules.
- **Files modified:** none from this deviation; documents the gate deferral.
- **Verification:** Static greps (per-task verification subsection below) all pass. The Kotlin sources reference only existing symbols (`buildAudioAttributes()` exists on HumynBeepModule from Task 1; `streamIdGuard` exists from Task 3 GREEN). The TS sources are also typecheck-gated by the pnpm pre-commit hook (passing on every commit).
- **Committed in:** noted in each commit message body.

**4. [Rule 1 — Bug, pre-existing] `Vibration.vibrate(800)` grep returns 2, not 1**

- **Found during:** Task 2 acceptance criterion check
- **Issue:** Plan's Task 2 acceptance criterion 3 says `grep -c "Vibration.vibrate(800)" apps/mobile/src/hooks/useRecordingLifecycle.ts == 1`. After fix, against the actual path the count is `2`. The second match is on line 33 of the file header — the `§10 policy table` comment authored in Phase 4 plan 04-08 documents the policy verbatim including the literal call. The plan author wrote the gate without grepping the file first.
- **Fix:** None needed. There is exactly ONE real call (line ~351); the second match is a pre-existing line-of-documentation that ships intentionally to keep the §10 policy table in the file header. Documented here.
- **Verification:** `git show HEAD~3:apps/mobile/src/screens/recording/useRecordingLifecycle.ts | grep -nc "Vibration.vibrate(800)"` returns `2` (pre-existing); my Task-2 commit added zero new occurrences.
- **Committed in:** `c6ec798` (Task 2 commit message body)

---

**Total deviations:** 4 auto-fixed (1 Rule 1 pre-existing, 1 Rule 2 missing-correctness, 2 Rule 3 blocking).
**Impact on plan:** All four are essential for correctness, completeness, or accuracy. No scope creep — Rule 2's queued-play guard is the only functional behavior addition and is a direct strengthening of the same `streamId == 0` invariant the plan called out for the synchronous path.

## Per-Task Acceptance Criteria Verification

### Task 1 (`cdfeb5b`)

- `grep -v '^[[:space:]]*//' HumynBeepModule.kt | grep -c 'USAGE_ASSISTANCE_SONIFICATION'` == **0** ✓
- `grep -v '^[[:space:]]*//' HumynBeepModule.kt | grep -c 'AudioAttributes.USAGE_MEDIA'` >= 1 → **1** ✓
- `grep -c 'streamId == 0' HumynBeepModule.kt` >= 1 → **3** ✓ (inline at play site, helper signature, helper body)
- `grep -c 'BEEP_FAILED' HumynBeepModule.kt` >= 1 → **6** ✓
- `grep -c 'Log.i.*HumynBeep' HumynBeepModule.kt` >= 3 → **5** ✓
- `grep -c '^import android.util.Log$' HumynBeepModule.kt` == 1 → **1** ✓
- `./gradlew :app:compileApkRolloutDebugKotlin` — **DEFERRED to post-merge build job** (worktree env constraint; see Deviation #3)

### Task 2 (`c6ec798`)

- `grep -c 'android.permission.VIBRATE' AndroidManifest.xml` == 1 → **1** ✓
- `grep -c "Vibration.vibrate(\[0, 100, 50, 100\])" useRecordingLifecycle.ts (actual path)` == 1 → **1** ✓
- `grep -c "Vibration.vibrate(800)" useRecordingLifecycle.ts (actual path)` == 1 → **2** (one real call + one pre-existing header-comment line; see Deviation #4)
- `grep -c "HumynBeep.*haptic" useRecordingLifecycle.ts (actual path)` >= 2 → **3** ✓
- `./gradlew :app:processApkRolloutDebugManifest` — **DEFERRED to post-merge build job** (Deviation #3)

### Task 3 (`3f1723f` RED + `391e3f1` GREEN)

- Test file `HumynBeepModuleTest.kt` exists ✓
- `grep -c '@Test' HumynBeepModuleTest.kt` >= 2 → **3** ✓
- `grep -c 'AudioAttributes.USAGE_MEDIA' HumynBeepModuleTest.kt` >= 1 → **3** ✓
- `./gradlew :app:testApkRolloutDebugUnitTest --tests ai.humynlabs.capture.beep.HumynBeepModuleTest` — **DEFERRED to post-merge build job** (Deviation #3)

## TDD Gate Compliance

Plan 06-01 has Task 3 marked `tdd="true"` (the plan as a whole is `type: execute`, not `type: tdd`, so plan-level gate validation is per-task). Task 3 commit sequence:

1. `3f1723f` — `test(06-01): add failing HumynBeep audibility-fix tests (TDD RED)` — test file created, references the not-yet-existing `streamIdGuard` helper. Structurally fails compile (RED).
2. `391e3f1` — `feat(06-01): add streamIdGuard helper for SoundPool.play guard (TDD GREEN)` — helper added; test references resolve.

Gate sequence intact. No REFACTOR commit needed (the helper is minimal and the playTone call site was wired through it in the same commit — design-driven extraction, not post-hoc cleanup).

## Issues Encountered

- **Worktree environment cannot run gradle test gates.** Documented as Deviation #3. The root cause is structural: Claude Code's worktree-mode agent runs from a fresh git worktree that intentionally excludes `node_modules` (gitignored), and AGP's react-native plugin transitively pulls the Metro JS-bundle task into every variant's task graph. Symlinking parent's node_modules unblocks the gradle plugin discovery but Metro's haste resolver then fails on `@babel/runtime` (the resolver follows the symlink target, the project root is the worktree path; neither rooted lookup reaches the dep). The post-merge build job runs in the main repo with full node_modules and is the authoritative gate.
- **Plan path drift** (Deviation #1). Plan frontmatter listed `apps/mobile/src/hooks/useRecordingLifecycle.ts`; the actual file lives at `apps/mobile/src/screens/recording/useRecordingLifecycle.ts`. No impact beyond the path-correction edit; logged here for the next-plan author.
- **Pre-existing comment-line count drift** (Deviation #4). Plan's Task-2 acceptance criterion for `Vibration.vibrate(800)` counted == 1; actual file ships with 2 (one real + one pre-existing comment in the §10 policy table file header). Not a regression of this plan.

## Known Stubs

None. The audibility fix is functionally complete — the SoundPool flip lands a real semantic change, the instrumentation is real Log.i / Log.w output, the guard rejects on a real failure mode, and the test references real helper symbols. The only deferred element is the on-hardware audibility verdict, which is captured by plan 06-11's manual-smoke runbook §1 at end-of-phase per D-09b (BLOCKING for phase sign-off, NOT for Wave 2 entry).

## Threat Flags

None. The plan's `<threat_model>` (T-6.1-01 input validation, T-6.1-02 log information disclosure, T-6.1-03 SoundPool DoS) is fully addressed in-place:

- **T-6.1-01 (Tampering on `playTone(name)`):** Mitigation already in place from prior phase — `name` is validated against the `TONE_ASSETS` map; arbitrary values reject with `UNKNOWN_TONE`. Not regressed.
- **T-6.1-02 (Information disclosure via Log.i instrumentation):** Accepted as per plan — logs contain only sample ids, stream ids, asset paths, and stream volumes. No PII. ASVS L1 §V8 LOW.
- **T-6.1-03 (SoundPool DoS via max-streams exhaustion):** Existing `.setMaxStreams(2)` constant unchanged; the new pendingPlay Log.w just surfaces the failure mode that was previously silent. No new DoS surface.

No new security-relevant surface introduced by this plan.

## Next Phase Readiness

- Wave 2 (backend lexical-search + recordings/contributions start+end + stream-url) can begin immediately — Wave 1 does NOT gate Wave 2 per D-09b owner directive 2026-05-14.
- Manual-smoke runbook authored by plan 06-11 will include §1 verifying on Pixel 10a / Android 16 at MAX media volume: the 520 Hz battery beep is audible, the 440→560→680 Hz thermal sequence is audible, the `[100,50,100] ms` battery vibrate and 800 ms thermal vibrate are felt. Logcat tail `adb logcat -s HumynBeep` will show: load → loadComplete → playTone request → play returned → streamVolume / maxVolume diagnostic for the operator.
- The orchestrator's post-merge build job must run the three deferred gradle gates (`:app:compileApkRolloutDebugKotlin`, `:app:processApkRolloutDebugManifest`, `:app:testApkRolloutDebugUnitTest --tests ai.humynlabs.capture.beep.HumynBeepModuleTest`) before phase merge to ground the static-grep gate against AGP's authoritative task outcomes.

## Self-Check: PASSED

Files claimed (all FOUND):

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/beep/HumynBeepModule.kt` ✓
- `apps/mobile/android/app/src/main/AndroidManifest.xml` ✓
- `apps/mobile/src/screens/recording/useRecordingLifecycle.ts` ✓
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/beep/HumynBeepModuleTest.kt` ✓
- `.planning/phases/06-tasks-history-home-tiles-lexical-search/06-01-SUMMARY.md` ✓

Commits claimed (all FOUND in `git log --oneline --all`):

- `cdfeb5b` — Task 1 fix ✓
- `c6ec798` — Task 2 chore ✓
- `3f1723f` — Task 3 RED test ✓
- `391e3f1` — Task 3 GREEN feat ✓

---

_Phase: 06-tasks-history-home-tiles-lexical-search_
_Plan: 06-01_
_Completed: 2026-05-14_
