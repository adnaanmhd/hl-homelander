---
phase: 03-humyn-capture-native-module
plan: 6
plan_id: 03-06
subsystem: humyn-capture-native-module
tags:
  - phase-3
  - wave-2
  - capture
  - metadata
  - schema-1-1-0
  - atomic-write
  - test-stub-flip
requires:
  - 03-04
provides:
  - metadata-composer-schema-1-1-0
  - atomic-json-write
  - schema-conformance-test-green
  - imu-min-rate-hz-observed-p1-emit-boundary
affects:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
  - apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
  - shared/types/src/recording.ts (verified, no edit)
  - .planning/phases/03-humyn-capture-native-module/deferred-items.md
tech-stack:
  added: []
  patterns:
    - 'Atomic JSON write: write to {file}.partial then File.renameTo({file}); .partial residue at sweep time = unambiguous mid-write-crash signal.'
    - 'Schema-version-tied fixture: per-schema-rev test resource (video_metadata_v1_X_Y_template.json) — adding a metadata field without bumping fixture/schema fails the key-set equality test (T-3.5-01 schema-creep guard).'
    - "Plan-local nested data classes: SidecarPayload + Drift + FinalizeMetrics nested inside MetadataComposer object so this plan ships independently of Plan 03-05's parallel SidecarManager work; Plan 03-09 wireup adapts at the call site."
key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
    - apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
  modified:
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt
    - .planning/phases/03-humyn-capture-native-module/deferred-items.md
key-decisions:
  - "Sidecar/Drift/FinalizeMetrics data classes nested inside MetadataComposer object (not top-level) — avoids merge collision with Plan 03-05's parallel SidecarManager + DriftCalculator."
  - 'Pitfall 7 verified: shared/types/src/recording.ts already declares imuMinRateHzObservedP1 (line 33). No edit needed; touched recording.ts is purposely empty.'
  - "Repo-root video_metadata.json (untracked, schema 1.0.0) intentionally NOT modified per the plan's 1C constraint — Phase 5 refreshes it later. The Phase 3 emit boundary uses the test-resource fixture instead."
patterns-established:
  - "Atomic JSON write — writeAtomic({file}, json): write to {parent}/{name}.partial, fsync via writeText close, File.renameTo({file}); fallback to copy+delete on cross-mount rename rejection; on throwable delete .partial so caller's retry sees a clean slate. T-3.5-02 mitigation."
  - 'Schema fixture pattern — apps/mobile/android/app/src/test/resources/video_metadata_v1_X_Y_template.json carries the canonical key set for schema X.Y.Z. Test asserts keySet(composer.output) == keySet(fixture). Future schema bumps add a new fixture file + bump CURRENT_SCHEMA_VERSION; old fixture stays for back-compat history.'
requirements-completed: [CAP-08, CAP-15, CAP-16, CAP-19]

duration: 7min
completed: 2026-05-10
---

# Phase 3 Plan 03-06: MetadataComposer Summary

**`MetadataComposer.compose()` emits `video_metadata.json` schema 1.1.0 per segment with all locked spec values hard-coded; `writeAtomic()` provides crash-safe metadata persistence; `MetadataSchemaConformanceTest` flipped from MISSING to GREEN (7/7 cases pass).**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-10T18:38:26Z
- **Completed:** 2026-05-10T18:45:25Z
- **Tasks:** 2
- **Files modified:** 4 (2 created + 2 modified)

## Accomplishments

- Schema 1.1.0 emit boundary established (CAP-16). The composer is the single Kotlin object that produces the per-segment `video_metadata.json` payload that every downstream finalize call (Plan 03-10's `FinalizeWorker`) writes to disk.
- D-IMU-02 implemented at the emit boundary: `imu_min_rate_hz_observed_p1` is the only new field vs schema 1.0.0; all other fields stay byte-identical to the canonical template.
- Atomic write contract landed (T-3.5-02 mitigation): `writeAtomic()` writes to `{file}.partial` then `renameTo({file})`; readers of `recordings/` never see a half-written JSON; `.partial` residue at Plan 03-10's app-launch sweep is an unambiguous crash signal.
- `MetadataSchemaConformanceTest` flipped MISSING → GREEN: 7 distinct test cases (schema_version, full key-set equality vs fixture, new-field guard, start_gate verbatim, locked-spec assertions, writeAtomic round-trip, null-drift/null-floor JSON-null rendering).
- Wave 0 stub progress: **2 of 18 stubs GREEN** (FragmentedMuxerWrapperTest from 03-04 + MetadataSchemaConformanceTest from 03-06). Remaining 16 capture/ + 1 fgs/ = 17 stubs still MISSING for Plans 03-05 / 03-07 / 03-08 / 03-10 to flip per the partition table in 03-04 SUMMARY.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate video_metadata_v1_1_0_template.json fixture + verify Pitfall 7** — `b8cc847` (test) — added the schema-1.1.0 fixture with exactly 2 line edits vs the canonical 1.0.0 source (schema_version bump + `imu_min_rate_hz_observed_p1: 95.5` insertion). `shared/types/src/recording.ts` line 33 already declares `imuMinRateHzObservedP1` per Pitfall 7 — verified, no edit.
2. **Task 2: Implement MetadataComposer.kt + atomic write + flip test to GREEN** — `f30ee1e` (feat) — `object MetadataComposer { fun compose, fun writeAtomic, CURRENT_SCHEMA_VERSION = "1.1.0" }` + nested data classes + 7-case test rewrite that asserts key-set equality against the fixture.

**Plan-local chore (out-of-scope discovery):** `10572f6` (chore) — logged the pre-existing Phase-2 compat/ SoLoader NPE family (DeviceCapsTest + EncoderProbeTest + ImuProbeTest + NalParserTest = 15 failures) into `deferred-items.md` per the GSD scope-boundary rule. Confirmed pre-existing via `git stash` round-trip.

_Note: TDD gate satisfied at the plan level — `test(03-06)` commit (b8cc847) precedes `feat(03-06)` commit (f30ee1e)._

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` (NEW, 230 lines) — the schema 1.1.0 composer + nested data classes (SidecarPayload, TaskInfoPartial, ContributorInfo, CaptureDeviceInfoPartial, StartGate, Drift, FinalizeMetrics) + `writeAtomic()`. All locked spec values from `idea-brief.md §2.1` hard-coded inline.
- `apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json` (NEW, 76 lines) — schema 1.1.0 conformance fixture. Diff vs canonical `/Users/adnaan/Documents/hl-homelander/video_metadata.json` (1.0.0): exactly 2 lines (`schema_version` 1.0.0 → 1.1.0; insert `"imu_min_rate_hz_observed_p1": 95.5,` after `imu_video_drift_p99_ms`).
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt` (MODIFIED) — replaced the MISSING-stub `fail(...)` body with 7 Robolectric-backed test cases (`@Config(sdk = [33], application = Application::class)` matching the 03-04 stub pattern).
- `.planning/phases/03-humyn-capture-native-module/deferred-items.md` (MODIFIED) — appended an entry for the pre-existing compat/ SoLoader NPE.

## Decisions Made

| Decision                                                                                                | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidecar / Drift / FinalizeMetrics data classes are NESTED inside `MetadataComposer`** (not top-level) | Plan 03-05 lands its own top-level `SidecarManager.SidecarPayload` + `DriftCalculator.Drift` in a parallel worktree. Top-level redefinition would cause a duplicate-class compile error after both worktrees merge. Nesting them under `MetadataComposer.SidecarPayload` etc. keeps this plan independently shippable + testable. Plan 03-09's orchestrator/bridge wireup is responsible for adapting the 03-05 types to the nested ones at the finalize-worker call site (one constructor-style mapping, no semantic loss). |
| **Pitfall 7 NOT re-implemented — only verified**                                                        | RESEARCH.md Pitfall 7 line 647 said `shared/types/src/recording.ts:33` already declares `imuMinRateHzObservedP1: z.number().int().nullable().optional()`. Verified by `grep`; the file is untouched by this plan. The Phase 5 wire-shape reconciliation (D-FLAG-04 — decimal vs int constraint on the drift fields) remains a Phase 5 concern as documented.                                                                                                                                                                 |
| **Repo-root `video_metadata.json` left at schema 1.0.0**                                                | Per plan action 1C: the repo-root file stays as historical reference until Phase 5 refreshes it. The Phase 3 emit boundary uses the test-resource fixture (`video_metadata_v1_1_0_template.json`) instead, which is what the schema-conformance test pins against.                                                                                                                                                                                                                                                           |
| **Hard-coded locked spec values inlined directly in `compose()`, not pulled from a constants file**     | The plan body's `must_haves.truths` and `<behavior>` block are explicit about which values are locked. Inlining them keeps T-3.5-04 mitigation visible at the call site (PR review surfaces any drift). The dedicated test case `locked spec values are hard-coded` enumerates each one as an assertion.                                                                                                                                                                                                                     |

## Pattern callouts

### 1. Atomic JSON write (`MetadataComposer.writeAtomic`)

```kotlin
val partial = File(file.parentFile, "${file.name}.partial")
partial.writeText(json.toString(2))
if (!partial.renameTo(file)) {
    file.writeText(partial.readText())  // cross-mount fallback
    partial.delete()
}
// on throwable: partial.delete() + rethrow
```

The OS guarantees same-filesystem `renameTo` is atomic — observers see either the old file (or no file) or the fully-written one, never half-written. The `.partial` residue across a process crash is **intentional** and unambiguous: Plan 03-10's app-launch sweep treats it as a mid-write-crash signal and routes the affected segment through re-finalize-or-discard.

Reusable for any future per-segment artifact (`.csv` writes, `.session.json` writes) where torn-write detection matters.

### 2. Schema-version-tied fixture pattern

`apps/mobile/android/app/src/test/resources/video_metadata_v1_X_Y_template.json` is the canonical key set for schema `X.Y.Z`. The test asserts:

```kotlin
assertEquals(keySet(template), keySet(out))  // top-level + nested keys
```

Adding a new metadata field without bumping the schema_version + adding a new fixture file fails this assertion at PR time — T-3.5-01 schema-creep guard. Future schema bumps follow the same pattern: drop a `video_metadata_v1_2_0_template.json`, bump `CURRENT_SCHEMA_VERSION`, update the test, ship.

## Wave 0 progress (after Plan 03-06)

| Plan                              | Stubs flipped                                                 | Remaining MISSING                 |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| 03-04                             | 0 (created stubs) + 1 wrapper test added GREEN                | 18                                |
| **03-06**                         | **+1 (`MetadataSchemaConformanceTest`)**                      | **17** (16 capture/ + 1 fgs/)     |
| 03-05 (parallel)                  | (in-flight; 6 stubs)                                          | TBD                               |
| 03-07 (parallel)                  | (in-flight; 2 stubs)                                          | TBD                               |
| Cumulative GREEN at end of Wave 3 | 1 + 6 + 2 + this plan's 1 = 10 (if all parallel waves finish) | 8 (deferred to Plan 03-08, 03-10) |

Phase-3 stub partition table in Plan 03-04 SUMMARY (`Wave 0 stub-flip targets`) is the source of truth.

## Pitfall 7 verification result

**Status: pre-empted, no edit needed.** RESEARCH.md Pitfall 7 line 647 was correct: `shared/types/src/recording.ts:33` already carries:

```ts
imuMinRateHzObservedP1: z.number().int().nullable().optional(),
```

`grep -q "imuMinRateHzObservedP1" shared/types/src/recording.ts` exits 0; `cd shared/types && npx tsc --noEmit` exits 0; the workspace-wide `pnpm -r typecheck` exits 0. No change to the file in this plan.

The wire-shape decimal-vs-int reconciliation flagged in Assumption A7 (drift-figure types are `.int()` in the wire schema but decimals in the on-disk metadata) remains a Phase 5 concern (D-FLAG-04 in 03-CONTEXT.md ## Deferred Ideas).

## Drift between repo-root `video_metadata.json` and the schema 1.1.0 fixture

```
$ diff /Users/adnaan/Documents/hl-homelander/video_metadata.json \
       apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json
2c2
<   "schema_version": "1.0.0",
---
>   "schema_version": "1.1.0",
41a42
>     "imu_min_rate_hz_observed_p1": 95.5,
```

Exactly 2 line changes (1 substitution + 1 addition), as the plan acceptance criteria required. The repo-root file stays at 1.0.0 per action 1C.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree node_modules + `local.properties` + `google-services.json` infra**

- **Found during:** Task 2 verification (first `./gradlew :app:compileApkRolloutDebugSources` failed: "Included build does not exist" → "SDK location not found" → "google-services.json missing").
- **Issue:** This Claude Code worktree only checks out tracked files. `node_modules`, `apps/mobile/android/local.properties`, and `apps/mobile/android/app/src/apkRollout/google-services.json` are gitignored and don't replicate. Without them gradle can't resolve the React Native gradle plugin, find the Android SDK, or accept the Firebase plugin. Identical blocker to Plan 03-04 Deviation 4.
- **Fix:**
  - `cd apps/mobile && npm ci --prefer-offline` (835 packages, ~9 s).
  - `pnpm install --frozen-lockfile --prefer-offline` at workspace root for husky pre-commit hook + `lint-staged`.
  - `cp /Users/adnaan/Documents/hl-homelander/apps/mobile/android/local.properties apps/mobile/android/local.properties`.
  - `cp /Users/adnaan/Documents/hl-homelander/apps/mobile/android/app/src/apkRollout/google-services.json apps/mobile/android/app/src/apkRollout/google-services.json`.
- **Files modified:** None tracked (all infra is gitignored).
- **Commit:** N/A (infra side-effect; no commit).

**2. [Rule 2 — Missing critical surface] Plan-local nested data classes (not Rule-4 architectural)**

- **Found during:** Task 2 implementation planning (the plan body's `<action>` block referenced bare `SidecarPayload`/`DriftCalculator.Drift` types that land in Plan 03-05's parallel worktree, not in this one).
- **Issue:** This plan and Plan 03-05 are wave-3 siblings running in parallel worktrees. The plan body's recipe reads as if 03-05's classes already existed (`fun compose(sidecar: SidecarPayload, ...)` bare). In a parallel-execution context, top-level types defined in both worktrees cause a duplicate-class compile error after merge.
- **Fix:** Defined the necessary data classes (SidecarPayload + 5 nested types + Drift + FinalizeMetrics) **nested inside the `MetadataComposer` object** (e.g. `MetadataComposer.SidecarPayload`). Plan 03-09's orchestrator/bridge wireup adapts `SidecarManager.SidecarPayload` → `MetadataComposer.SidecarPayload` at the finalize-worker call site (one constructor-style mapping, no semantic loss). Documented in the file's KDoc + this SUMMARY.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt` (test references the nested types).
- **Verification:** `:app:compileApkRolloutDebugSources` exit 0; `:app:testApkRolloutDebugUnitTest --tests MetadataSchemaConformanceTest` 7/7 GREEN.
- **Committed in:** `f30ee1e` (Task 2 commit).

### Out of Scope (Deferred / Logged)

- **Pre-existing Phase-2 compat/ SoLoader NPE family.** 15 failures across `DeviceCapsTest` + `EncoderProbeTest` + `ImuProbeTest` + `NalParserTest`, all with the same NPE that Plan 03-04 patched for the Phase-3 stubs but did NOT patch for the Phase-2 compat/ tests. Pre-existing on the worktree's branch base — confirmed by `git stash` round-trip. Logged to `deferred-items.md` for a future Phase-2 cleanup or any Wave-2 plan that touches compat/ sources. Not introduced by this plan; not in this plan's `<files>` scope.
- **Pre-existing `RootNativeStack.test.tsx` 3 unhandled rejections** — already documented in 03-WAVE1-SMOKE.md line 235 + Plan 03-04 SUMMARY's deferred-items; full apps/mobile vitest suite still passes 360/360 tests despite them.

### Architectural Changes

**None.** Both deviations were narrow infra (Rule 3) or missing-mitigation (Rule 2) fixes. No Rule-4 escalations to the user.

---

**Total deviations:** 2 auto-fixed (1 blocking infra, 1 missing critical surface).
**Impact on plan:** All deviations were necessary for plan execution to complete. No scope creep — the plan's deliverable (MetadataComposer + schema 1.1.0 conformance test GREEN) shipped with byte-equivalent behavior to the plan body.

## Issues Encountered

- Initial full `:app:testApkRolloutDebugUnitTest` run (across the worktree's first build) showed 32 failures total. Investigation: 15 are the pre-existing compat/ SoLoader NPE family (logged to deferred-items.md), 16 capture/ are the still-MISSING Wave 0 stubs (expected — Plans 03-05/07/08/10 own them), and 1 fgs/ is the still-MISSING `HumynForegroundServiceTest` stub (expected — Plan 03-07 owns it). MetadataSchemaConformanceTest itself: 7/7 GREEN. No new failures introduced.

## Threat Surface

The plan's threat register is honored:

- **T-3.5-01 (schema-creep tampering):** mitigated by `composer output keys exactly match template` test — adding a metadata field without updating the fixture + bumping schema_version fails the assertion.
- **T-3.5-02 (half-written metadata.json):** mitigated by `writeAtomic({file}.partial → renameTo({file}))`. `writeAtomic creates final file and removes partial` test verifies the post-write filesystem state.
- **T-3.5-03 (PII in metadata.json — accept):** unchanged accept disposition; same trust model as the .session.json sidecar (app-private filesDir until Phase 5 uploads).
- **T-3.5-04 (locked-spec drift tampering):** mitigated by inlining all 17 locked spec values directly in `compose()`. The `locked spec values are hard-coded` test enumerates each one as an explicit assertion (resolution, fps, codec, profile, bitrate, gop, color depth/space, hdr/b_frames/IS, audio rate/codec/bitrate/channels).

No new threat surface introduced beyond the plan's `<threat_model>`.

## Verification Results

- `MetadataSchemaConformanceTest`: **7 tests / 0 failures / 0 errors** — GREEN.
- `:app:compileApkRolloutDebugSources`: BUILD SUCCESSFUL (exit 0).
- 16 of 17 remaining capture/ Wave 0 stubs still fail with `MISSING — Wave 0 stub` (expected; partitioned to Plans 03-05/07/08/10).
- 1 fgs/ Wave 0 stub still fails with `MISSING — Wave 0 stub` (expected; Plan 03-07 owns).
- `cd shared/types && npx tsc --noEmit` exits 0.
- `pnpm -r typecheck`: 2/2 workspace projects pass.
- `cd apps/mobile && npx vitest run`: **360/360 tests pass** (62 test files) — matches Plan 03-04 baseline. The 3 `RootNativeStack.test.tsx` unhandled-rejection errors are pre-existing per Plan 03-04 SUMMARY.

## Self-Check: PASSED

All created/modified files exist:

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` — FOUND
- `apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt` — FOUND (modified)
- `.planning/phases/03-humyn-capture-native-module/deferred-items.md` — FOUND (modified)

All 3 commits exist in `git log`:

- `b8cc847` — `test(03-06): add video_metadata_v1_1_0_template fixture (CAP-16)`
- `f30ee1e` — `feat(03-06): implement MetadataComposer (CAP-16) — schema 1.1.0 GREEN`
- `10572f6` — `chore(03-06): log pre-existing compat/ SoLoader NPE in deferred-items`

## Known Stubs

None introduced by this plan. The 17 Wave 0 stubs that still carry `MISSING — Wave 0 stub` are inherited from Plan 03-04 and are partitioned to Plans 03-05 (in-flight), 03-07 (in-flight), 03-08, and 03-10 per the Plan 03-04 SUMMARY's "Wave 0 stub-flip targets" table. Each is intentional Wave 0 contract per the deep-work rules — no production-code stubs (no `TODO` / `FIXME` / `placeholder` / `not implemented` strings) ship in `MetadataComposer.kt`.

## Next Phase Readiness

- `MetadataComposer.compose()` + `writeAtomic()` are ready for Plan 03-10's `FinalizeWorker` to call at every segment cut.
- Plan 03-09's orchestrator/bridge wireup must adapt `SidecarManager.SidecarPayload` (from Plan 03-05) → `MetadataComposer.SidecarPayload` (nested types in this plan). Mapping is constructor-style, no semantic loss.
- `MetadataComposer.FinalizeMetrics` collects everything the composer needs from the finalize pipeline: SHA hashes (Plan 03-05's `HashStreamer`), drift figures (Plan 03-05's `DriftCalculator`), IMU floor Hz (Plan 03-05's `ImuRateObserver`), file sizes + filenames (Plan 03-05's `FilenameGenerator`), and the ISO-8601 timestamps + environment/time-of-day strings (Plan 03-08's segment timer + Plan 03-10's finalize worker fill these in).
- No new blockers or concerns for the rest of Wave 3.

---

_Phase: 03-humyn-capture-native-module — Plan 03-06 (metadata-composer)_
_Completed: 2026-05-10T18:45:25Z (7 minutes wall time)_
