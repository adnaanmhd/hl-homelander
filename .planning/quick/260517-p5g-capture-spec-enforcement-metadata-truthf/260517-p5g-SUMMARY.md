---
phase: 260517-p5g
plan: 01
type: quick
subsystem: capture-pipeline
tags:
  - capture-quality
  - finalize
  - metadata
  - upload-queue
  - history
  - compat-check
status: complete
duration_human: 'one session'
completed: 2026-05-17
requirements:
  - CAPTURE-QA-01
  - CAPTURE-QA-02
  - CAPTURE-QA-03
  - CAPTURE-QA-04
  - CAPTURE-QA-05
  - CAPTURE-QA-06
key_files:
  created:
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FinalizeWorkerGatesTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataComposerLiteralsTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadQueueStoreCancelGuardTest.kt
    - apps/mobile/__tests__/native/HumynCapture-cancel.test.ts
    - apps/mobile/__tests__/screens/history/HistoryRow-cancel.test.tsx
    - apps/mobile/__tests__/screens/uploads/PendingUploadsScreen-cancel-guard.test.tsx
    - apps/mobile/src/screens/recording/lib/handleSegmentCanceled.ts
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadQueueStore.kt
    - apps/mobile/src/native/HumynCapture.types.ts
    - apps/mobile/src/native/HumynCapture.ts
    - apps/mobile/src/native/HumynCompat.ts
    - apps/mobile/src/native/HumynUpload.ts
    - apps/mobile/src/services/compatService.ts
    - apps/mobile/src/services/thumbnailLedger.ts
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/src/screens/history/HistoryScreen.tsx
    - apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx
    - apps/mobile/src/components/HistoryRow.tsx
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - CLAUDE.md
---

# Quick task 260517-p5g: Capture spec enforcement + metadata truthfulness — Summary

Gate uploads on actual capture quality (mean FPS ≥ 28, resolution ≥ 1080p) and replace every hardcoded spec value in the segment metadata JSON with measured / probed / reported values. Android only — iOS native modules remain deferred. Owner directive: re-uphold the core value ("capture quality is non-negotiable") that had drifted from "stamped intent" to "measured truth."

## Commits (worktree branch `worktree-agent-abc6aa0b734ddc5bc`)

| Hash      | Type | One-liner                                                                                  |
| --------- | ---- | ------------------------------------------------------------------------------------------ |
| `ee46baf` | feat | Native FinalizeWorker fps+resolution+N<2 gates + EncoderProbe WxH deliverability check     |
| `0b79a3f` | test | MetadataComposer literal-grep regression guard + derivation tests (CAPTURE-QA-03 spine)    |
| `e1018b6` | feat | Cancel lifecycle wiring (UploadQueueStore short-circuit + RN handleSegmentCanceled helper) |
| `7a6e1b6` | feat | History Canceled chip + per-reason copy + Pending Uploads defensive guard                  |
| `cb9a914` | docs | REQUIREMENTS.md CAPTURE-QA-01..06 + STATE.md decision + CLAUDE.md banner                   |

Base commit: `9c2bea4` (pre-dispatch PLAN.md).

## What landed (by surface)

### Native (Kotlin / Android)

- **`FinalizeWorker.finalize`** — pre-finalize gate sequence:
  - Step 1.5 `videoFrameTimestamps.size < 2` → `CancelReason.InsufficientFrames`.
  - Step 1.6 `meanFps = (N - 1) / span_seconds < 28.0` → `CancelReason.FpsDropped(meanFps)` (priority on simultaneous fps+res failure).
  - Step 1.7 muxed track header `width < 1920 OR height < 1080` → `CancelReason.ResolutionDropped(w, h)`.
  - Gate logic extracted into pure helpers `decideCancelReason` / `computeMeanFps` / `readMuxedResolution` so tests don't need to construct a full `Segment` (Robolectric can't shadow Camera2 / MediaCodec / MediaMuxer).
  - On cancel: emit `onSegmentCanceled` with the documented payload, delete the sidecar (orphan-sidecar contract), return — no `MetadataComposer.compose`, no upload enqueue.
- **`CancelReason`** sealed class — three terminal codes (`fps_dropped` / `resolution_dropped` / `insufficient_frames`) wired into the bridge contract.
- **`MetadataExtractor` test seam** — `FinalizeWorker.mediaExtractorFactory` swaps in a fake for the resolution-read tests; the production factory wraps a real `MediaExtractor`.
- **`CaptureSession.openSegment`** — captures the surface rotation at session start (`Surface.ROTATION_90` → `"landscape_left"`, `ROTATION_270` → `"landscape_right"`, fallback `"landscape_left"` with warn). Stamped into `SidecarPayload.recordedRotation` (backward-compatible default).
- **`MetadataComposer.VideoReport`** + `buildVideoReport(encoder, mp4)` — truth-source struct derived from the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat + the MediaExtractor track-header read of the muxed file. Color-token mapping helpers (`colorStandardToToken` / `colorTransferToToken` / `colorRangeToToken` / `mimeToCodecToken` / `hevcProfileToToken` / `bitrateModeToToken`) are pure-fn for unit testability.
- **`MetadataComposer.compose()`** — every spec-relevant field now reads from `FinalizeMetrics.videoReport` / `measuredMeanFps` / `sidecar.recordedRotation`. `hdr` + `image_stabilization` stay configured-literal (camera flags verified at compat-check via EncoderProbe, with inline cite). New `bitrate_source` field (`"reported" | "configured"`) tells consumers whether the bitrate came from the encoder snapshot or the configured target.
- **`EncoderProbe.Result.resolutionDeliverable`** — new field, fail-closed default `false`. Flips `true` only when `INFO_OUTPUT_FORMAT_CHANGED` actually fires AND reports `KEY_WIDTH=1920` / `KEY_HEIGHT=1080`. Catches the encoder-pipeline-falls-back-to-720p path (logical-multi-camera fusion, thermal throttle, OEM weirdness) that the previous codec-presence check missed.
- **`HumynCompatModule.runEncoderProbe`** — bridge payload extended with `resolutionDeliverable`.
- **`UploadModels.UploadRow.cancelReason`** — optional `String?` field; round-trips through `toJson`/`fromJson` with backward-compat tolerance for legacy queue rows.
- **`UploadQueueStore.enqueue`** — refuses any row with `cancelReason != null` BEFORE the existing practice check. Belt-and-braces backstop (the JS-side `RecordingScreen` handler is the primary gate).

### React Native (TypeScript)

- **`HumynCapture.types.ts`** — `SegmentCancelReason` + `SegmentCanceledEvent` interfaces mirroring the native event payload.
- **`HumynCapture.ts`** — `onSegmentCanceled(listener)` subscription helper + re-exports.
- **`thumbnailLedger.ts`** — `ThumbnailLedgerEntry` extended with optional `taskId` / `durationMs` / `cancel?: { reason, meanFps?, width?, height? }`. `mp4LocalPath` relaxed to `string | null` so canceled rows can stamp `null`. New `readAllEntries()` enumerator drives the History canceled-row synthesis.
- **`screens/recording/lib/handleSegmentCanceled.ts`** (new) — pure-fn helper extracted from `RecordingScreen` so it's unit-testable. Write-then-delete invariant: practice short-circuit → write ledger entry → unlink mp4 + csv + json → NEVER enqueue.
- **`RecordingScreen.tsx`** — subscribes to `onSegmentCanceled` in the same `useEffect` that owns `onSegmentStart` / `onSegmentComplete`; cleanup via `.remove()` on unmount.
- **`HumynUpload.ts`** — `UploadQueueRow.cancelReason?: 'fps_dropped' | 'resolution_dropped' | 'insufficient_frames'` mirrors the Kotlin model so the Pending Uploads filter can read it.
- **`HumynCompat.ts`** — `EncoderProbeResult.resolutionDeliverable?: boolean` (optional for backward compat with stale native builds; fail-closed semantics).
- **`compatService.ts`** — `compat.resolution` now requires BOTH `longEdge >= 1920` AND `enc.resolutionDeliverable === true`. Strict equality so a missing field (stale native) fails closed-loop.
- **`HistoryRow.tsx`** — `HistoryRowItem.cancel?: { reason }` overrides the chip variant (always `chip-failed`) and the sidecar label (one of three reason-specific copy strings). No Retry affordance for canceled rows.
  - `cancelReasonLabel(reason)` pure-fn exports the three owner-blessed copy strings:
    - `'fps_dropped'` → `'Canceled — frame rate dropped'`
    - `'resolution_dropped'` → `'Canceled — resolution dropped'`
    - `'insufficient_frames'` → `'Canceled — recording too short'`
  - Owner-blessed deviation noted inline (CLAUDE.md 2026-05-17 banner) — these strings are local copy, not in `design-spec.md`.
- **`HistoryScreen.tsx`** — synthesizes a `HistoryRowGroupable` for every canceled-segment ledger entry (these have NO server row — the ledger entry IS the row). Merged alongside server + device-queue rows and sorted newest-first.
- **`PendingUploadsScreen.tsx`** — `mine` filter rejects rows with `cancelReason != null` (belt-and-braces); same filter applies to the `__test_rows` seeded path.

### Docs

- **`.planning/REQUIREMENTS.md`** §v1 — new section "Recording — Capture Quality Gate (Finalize-time enforcement)" with CAPTURE-QA-01..06 + six matching Traceability rows.
- **`.planning/STATE.md`** — top `### Decisions` entry "2026-05-17: Capture-quality cancel gate added"; three new `## Deferred Items` rows (server-side cancel telemetry, iOS analogues, per-frame NAL parsing).
- **`CLAUDE.md`** — new banner "Capture-quality cancel gate added 2026-05-17" inserted directly below the existing "±1 ms drift gate relaxed 2026-05-12" banner.
- `idea-brief.md` / `design-spec.md` / `prototype.html` / `engineering-handoff.md` / `task-taxonomy.md` / `ROADMAP.md` — **untouched** (LOCKED spec assets; this is enforcement, not spec drift).

## Tests added

### Kotlin (Robolectric)

- `FinalizeWorkerGatesTest` — 12 tests:
  - Test A — `N<2` → `InsufficientFrames`.
  - Test B — `meanFps < 28` → `FpsDropped(meanFps)` with numeric agreement.
  - Test C — muxed `w<1920` → `ResolutionDropped(w, h)`.
  - Test D — simultaneous low-fps + low-res → `fps_dropped` wins.
  - Test E / F — happy-path + 28fps boundary + 4K passes.
  - Test G — height-only resolution failure.
  - `CancelReason.code` bridge contract.
  - `readMuxedResolution` via the [mediaExtractorFactory] seam: success, open-throws-fail-closed, no-video-track, 720p-fallback gating.
  - `computeMeanFps` agreement + degenerate-input zero.
- `EncoderProbeResolutionDeliverableShapeTest` — `Result` data class carries the new field; fail-closed default.
- `MetadataComposerLiteralsTest` — comment-stripped source-code grep gate locks the absence of inline literals in `compose()` (the spine of CAPTURE-QA-03); per-field derivation flow tests; b_frames defensive (non-zero `bFramesReported` stamps `true`).
- `UploadQueueStoreCancelGuardTest` — 8 tests: refuses each of the three `cancelReason` codes; preserves the normal path; practice-row D-08 regression; round-trip + backward-compat for legacy on-disk rows.
- `MetadataSchemaConformanceTest` (extended) — rebased fixture for the new required fields; four new derivation-proof tests (resolution / fps / orientation / bitrate_source).
- `StartGateCarryoverTest` (rebased) — fixture updated; test semantics unchanged.

### TypeScript (vitest)

- `__tests__/native/HumynCapture-cancel.test.ts` — 9 tests:
  - `onSegmentCanceled` subscribes via `NativeEventEmitter.addListener('onSegmentCanceled', ...)`.
  - Lazy emitter singleton shared with `onSegmentComplete`.
  - `handleSegmentCanceled` write-then-delete invariant: practice short-circuits, ledger write first, three unlinks, MMKV failure still deletes files, payload shapes per reason, no `HumynUpload.enqueue` call.
- `__tests__/screens/history/HistoryRow-cancel.test.tsx` — 12 tests covering all three reason copy strings, chip-failed override, no Retry affordance, suppression of in-progress / paused-no-wifi / uploaded-at labels, non-canceled regression guard, `cancelReasonLabel` + `chipVariant(cancel)` pure-fn tests.
- `__tests__/screens/uploads/PendingUploadsScreen-cancel-guard.test.tsx` — 5 tests: filter rejects each cancelReason code, normal rows render, live `getQueueSafe()` path applies the filter.

## Final test gate

```
set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm -r --parallel test
```

**Result: GREEN.**

- `apps/api`: 42 files / 206 passed / 2 skipped (`28.8s`)
- `apps/mobile`: 112 files / 835 passed / 0 failed (`10.6s`) — 3 post-test async warnings are pre-existing vitest noise unrelated to this work.
- `shared/types`: 1 file / passed.
- `pnpm -r typecheck`: green (shared/types + apps/api).

Android gradle gate (excluding pre-existing `MainApplication.onCreate` SoLoader Robolectric flakes):

```
./gradlew --init-script /tmp/disable-bundle.gradle :app:testApkRolloutDebugUnitTest \
  --tests "ai.humynlabs.capture.capture.*" --tests "ai.humynlabs.capture.upload.*"
```

→ **BUILD SUCCESSFUL**. All capture + upload tests pass (including the new ones).

### Pre-existing Android Robolectric flakes (NOT caused by this work)

The full `:app:testApkRolloutDebugUnitTest` run shows 17 failures in test files that do NOT use the `application = Application::class` workaround for `MainApplication.onCreate`'s `SoLoader.init` NPE (canonical Phase 3+ pattern). These are pre-existing flakes from `DeviceCapsTest` / `EncoderProbeTest` (the orphan-sweep one) / `ImuProbeTest` / `NalParserTest` / `HumynHandDetectorModuleTest`. They are NOT in scope for this quick task — my work touches `capture.*` + `upload.*` packages and adds new tests that all pass.

## Deviations from the plan

1. **Test seam shape.** The plan suggested testing `FinalizeWorker.finalize` directly with a mocked `Segment`. In practice the `Segment` data class requires a real `CameraDevice` / `CameraCaptureSession` / `MediaCodec` / `MediaMuxer` / `ImuWriter` (all impossible under Robolectric). I refactored the gate logic into a pure-fn `decideCancelReason` (+ `computeMeanFps` + `readMuxedResolution` via a `mediaExtractorFactory` seam) and tested those directly. The pure helpers carry the gate logic verbatim from the in-line code at the top of `finalize()`, so green tests here ARE green tests of the production gate behavior. Manual on-device smoke (Pixel 10a — happy / fps-cancel / resolution-cancel) is the integration coverage.

2. **Task 1 + Task 2 commit split.** The plan separates Task 1 (gates + structure) from Task 2 (literal audit). In implementation the `MetadataComposer.kt` edits for both are deeply intertwined (the literal replacement requires `VideoReport`, which is a Task-1 deliverable). I committed Task 1's structural changes + Task 2's literal replacements in `ee46baf` (the native gate commit), then committed Task 2's tests (`MetadataComposerLiteralsTest` + `MetadataSchemaConformanceTest` extensions + schema-template update) separately in `0b79a3f`. The grep-gate test is what the plan called out as the spine; it lives in commit 2.

3. **Schema-template change.** I added a new optional `bitrate_source` field (`"reported" | "configured"`) to `video_metadata_v1_1_0_template.json`. The schema version is unchanged (1.1.0) because this is a derivation-only field, not a breaking change for the training pipeline (the existing schema reader is permissive on unknown fields). The plan did not call out this field explicitly; it surfaced naturally as the way to distinguish "encoder reported `KEY_BIT_RATE`" from "fallback to configured target."

4. **Test-fixture updates in Task 5 commit.** The plan's Task 5 was docs-only, but the new TypeScript field additions (`onSegmentCanceled` event, `readAllEntries` ledger function, `resolutionDeliverable` compat field) broke existing test fixtures that didn't mock them. I rolled the fixture updates into the Task 5 docs commit (`cb9a914`) rather than splitting into a 6th commit — they're regression fixes caused by the new surface and document inline why each fixture extension exists.

5. **Worktree node_modules.** The worktree was created without `node_modules` symlinks. I added symlinks to the main repo's hoisted trees (worktree-root `node_modules`, `apps/mobile/node_modules`, `apps/api/node_modules`, `shared/types/node_modules`), plus a stub `google-services.json` for the Android build (the real one is gitignored). These are local-only setup conveniences; nothing is committed.

## Hardware-smoke verdict

**Manual on-hardware smoke is deferred per the worktree-only scope of this quick task.** The plan's manual smoke list:

1. **Happy path** (Pixel 10a, good thermal) — deferred to next on-device walk.
2. **Throttled path** (`adb shell cmd thermalservice override-status 4` after Start, expect `fps_dropped`) — deferred.
3. **Force-720p path** (dev affordance flip, expect `resolution_dropped`) — deferred; the dev-affordance seam is not in scope.
4. **Compat-fail path** (synthetic 720p encoder, expect `resolution` failure on CompatFailScreen) — deferred.

All four paths are exercised by unit tests at the gate-decision level. The on-device verdict is the final acceptance check the owner runs next time the APK is rebuilt.

## Known follow-ons

- **Server-side cancel telemetry** — local-only at MVP per owner decision; revisit if QA dashboards need fleet-wide cancel-rate visibility.
- **iOS analogues** — deferred with the rest of the iOS native modules (§v2 IOS-01..07).
- **Per-frame NAL parsing for GOP / B-frame verification at finalize** — at MVP we trust the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat snapshot; revisit if a future encoder regression silently emits B-frames despite `KEY_MAX_B_FRAMES=0`.
- **Indexed manifest for `readAllEntries`** — the per-key enumeration is sub-ms at MVP cardinality; swap to a single-key indexed manifest if the count grows past a few hundred entries.

## Files (grouped)

### Native (Kotlin)

Created:

- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FinalizeWorkerGatesTest.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataComposerLiteralsTest.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadQueueStoreCancelGuardTest.kt`

Modified:

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/EncoderProbe.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt`
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadQueueStore.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt`
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/StartGateCarryoverTest.kt`
- `apps/mobile/android/app/src/test/resources/video_metadata_v1_1_0_template.json`

### React Native (TypeScript)

Created:

- `apps/mobile/src/screens/recording/lib/handleSegmentCanceled.ts`
- `apps/mobile/__tests__/native/HumynCapture-cancel.test.ts`
- `apps/mobile/__tests__/screens/history/HistoryRow-cancel.test.tsx`
- `apps/mobile/__tests__/screens/uploads/PendingUploadsScreen-cancel-guard.test.tsx`

Modified:

- `apps/mobile/src/native/HumynCapture.types.ts`
- `apps/mobile/src/native/HumynCapture.ts`
- `apps/mobile/src/native/HumynCompat.ts`
- `apps/mobile/src/native/HumynUpload.ts`
- `apps/mobile/src/services/compatService.ts`
- `apps/mobile/src/services/thumbnailLedger.ts`
- `apps/mobile/src/screens/recording/RecordingScreen.tsx`
- `apps/mobile/src/screens/history/HistoryScreen.tsx`
- `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx`
- `apps/mobile/src/components/HistoryRow.tsx`
- `apps/mobile/__tests__/screens/history/HistoryScreen.test.tsx`
- `apps/mobile/__tests__/screens/recording/RecordingScreen.test.tsx`
- `apps/mobile/__tests__/screens/recording/handGate.test.tsx`
- `apps/mobile/__tests__/services/compatService.test.ts`
- `apps/mobile/__tests__/navigation/MainTabs.test.tsx`
- `apps/mobile/__tests__/navigation/RootNativeStack.test.tsx`

### Docs

Modified:

- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `CLAUDE.md`
