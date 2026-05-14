---
phase: 06-tasks-history-home-tiles-lexical-search
plan: 04
subsystem: mobile-capture
tags:
  - thumbnail
  - mediametadataretriever
  - mmkv
  - finalize-worker
  - history-row
  - kotlin
  - typescript
  - vitest
  - robolectric

# Dependency graph
requires:
  - phase: 03-humyn-capture-native-module
    provides: 'FinalizeWorker.finalize() — the step sequence this plan extends; HashStreamer sibling-helper pattern; Segment data class with mp4File / sidecar.isPractice'
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: 'practiceDoneKey(sub) per-key MMKV stash pattern — the analog this plan mirrors (NOT scoped by user per Pitfall 8)'
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: 'uploadReconcile.ts service-shape pattern; recordingEvents `_events` outbox-drain hook (Plan 06-08 extends); D-03 crash-recovered-fragment discard (so finalize never sees them)'
  - phase: 06-tasks-history-home-tiles-lexical-search
    provides: 'Plan 06-01 — wave 1 ordering; this plan is wave 3 (depends_on: [01])'
provides:
  - 'ThumbnailExtractor.kt — best-effort first-I-frame extraction via MediaMetadataRetriever (~50 LOC + retriever-release + cleanup-on-throw guarantees)'
  - 'FinalizeWorker step 8.5 — post-sidecar-delete, pre-emit thumbnail extraction; practice-skipped; payload extended with thumbnailPath: string | null'
  - 'thumbnailLedger.ts — 5 MMKV CRUD exports (readEntry / writeEntry / clearLocalPath / deleteEntry / cleanupOpportunistic) + ThumbnailLedgerEntry interface'
  - 'pendingThumbKey(recordingId) — `pendingThumb.{id}.v1`, NOT scoped by user sub (Pitfall 8)'
  - 'Vitest mock parity — `getAllKeys(): string[]` added to react-native-mmkv mock (matches Nitro spec)'
affects:
  - '06-05 (appStore homeRange/historyRange + hydrate.ts) — appStore.ts owner; this plan owns state/keys.ts'
  - '06-08 (recordingEvents _events outbox-drain extension) — calls clearLocalPath on verified'
  - '06-09 (HistoryScreen + RecordingScreen segment-complete handler) — calls writeEntry next to HumynUpload.enqueue; calls readEntry on row render'
  - '06-10 (PlayerScreen) — readEntry decides local-vs-stream source'
  - '06-11 (manual smoke) — on-device verification of a non-null bitmap from a real HEVC fixture'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Sibling-helper pattern — ThumbnailExtractor extends FinalizeWorker''s blast radius like HashStreamer does (D-05a smallest-blast-radius choice)'
    - 'Per-key MMKV stash with version suffix — `pendingThumb.{id}.v1` mirrors `tutorial.practice_done.{sub}.v1` (Phase 4 pattern)'
    - 'Native helper read-only + JS-side MMKV write — Kotlin emits thumbnailPath on onSegmentComplete; JS writes the ledger (single MMKV-key derivation source preserves the encryption invariant)'
    - 'Best-effort native helper — try/finally retriever.release() + log + return null on any throwable; never gate-of-finalize (RESEARCH Pitfall 2)'
    - 'Overlay-not-truth — ledger overlays filename + thumbnailPath onto server `/recordings`; absent entries fall back to gradient + first-letter (D-04)'

key-files:
  created:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThumbnailExtractor.kt — the best-effort helper'
    - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThumbnailExtractorTest.kt — Robolectric coverage (3 tests)'
    - 'apps/mobile/src/services/thumbnailLedger.ts — per-key MMKV CRUD (5 exports + ThumbnailLedgerEntry interface)'
    - 'apps/mobile/__tests__/services/thumbnailLedger.test.ts — Vitest coverage (11 tests)'
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt — step 8.5 thumbnail extraction + payload thumbnailPath key'
    - 'apps/mobile/src/state/keys.ts — added pendingThumbKey(recordingId) helper'
    - 'apps/mobile/vitest.setup.ts — added getAllKeys() to react-native-mmkv mock (Rule 3 — required for cleanupOpportunistic coverage)'

key-decisions:
  - 'Step 8.5 vs documented "step 7.5" — the design doc numbers it 7.5; the on-disk implementation calls it 8.5 because Plan 03-06 inserted writeAtomic between compose and SidecarManager.delete, shifting the running numbers. The contract is identical: post-orphan-sidecar-signal, pre-onSegmentComplete-emit.'
  - 'MMKV API surface = `.remove(key)`, NOT `.delete(key)` — react-native-mmkv@4.x Nitro spec exposes `remove` (MMKV.nitro.d.ts:443); the existing codebase uses `.remove` uniformly (uploadReconcile.ts / appStore.ts / hydrate.test.ts). Plan example used `.delete` — adapted to match the production singleton.'
  - 'pendingThumb namespace NOT scoped by user `sub` (Pitfall 8) — recordingId is a server-issued ULID and the row truth-source is per-user-authed at the server. Logout/login preserves the ledger; the server fetch effectively GCs orphans on cleanupOpportunistic.'
  - 'Vitest mock extended with getAllKeys() — required by cleanupOpportunistic and on the real Nitro spec; the mock predated this use case (no prior code called getAllKeys).'
  - 'Combined `feat()` commit for Task 1 (test + impl) instead of split RED/GREEN — Kotlin compile-time linking requires the impl to exist for the test to compile. The split-commit RED pattern (06-01 `test(06-01)` / `feat(06-01)`) applies when tests target an existing module; this plan creates the module fresh. Same applies to Task 3 (TS compile-time linking).'

patterns-established:
  - 'Best-effort native helper template — thumbsDir.mkdirs() / try-catch / finally-release / outFile.delete() on throw / return-null contract; reusable for any future first-frame / preview-extract / video-metadata-read path.'
  - 'Step-7.5/8.5-style FinalizeWorker extension point — the orphan-sidecar-delete is the canonical "finalize complete" signal; new best-effort sidecar work runs AFTER delete and BEFORE emit, so a crash leaves a finalized-but-derivative-missing segment (acceptable degrade per D-04).'
  - 'Per-recording-id MMKV ledger with version-suffixed key — survives logout/login, ULID-shaped key validation in cleanupOpportunistic, schema-version-bumps land at `.v2` suffix with no migration code (Phase 5 pattern).'

requirements-completed:
  - HIST-06

# Metrics
duration: ~50 min
completed: 2026-05-14
---

# Phase 06 Plan 04: Native Thumbnail Extraction + JS MMKV Ledger Summary

**MediaMetadataRetriever-driven first-I-frame JPEGs persisted to `filesDir/thumbs/`, indexed in a per-recording MMKV ledger (`pendingThumb.{id}.v1`) that survives the post-`verified` MP4 delete — HIST-06's underlying infrastructure.**

## Performance

- **Duration:** ~50 min (one-shot, no checkpoint pauses)
- **Started:** ~2026-05-14T04:00Z (worktree spawn)
- **Completed:** 2026-05-14T04:50:10Z
- **Tasks:** 3 / 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- **ThumbnailExtractor.kt** — best-effort first-I-frame helper via `MediaMetadataRetriever.getFrameAtTime(0L, OPTION_CLOSEST_SYNC)`. Output: 80%-quality JPEG at `${thumbsDir}/${base}.thumb.jpg`. Returns null + cleans up partial output + always releases the retriever on any throwable (Pitfall 2 — `setDataSource` leaks the underlying media-server handle on throw without a finally block; symptom is "media server died" after hundreds of extracts).
- **FinalizeWorker step 8.5 wiring** — post-orphan-sidecar-delete, pre-`onSegmentComplete`-emit. Skipped for practice segments (`seg.sidecar.isPractice` — those never reach History/upload per ONB-04). Crash-recovered fragments are discarded by Phase 5 D-03 before reaching finalize, so they never hit this code path (D-05b). Payload extended with `thumbnailPath: string | null`.
- **thumbnailLedger.ts** — 5-export per-recording MMKV CRUD: `readEntry` / `writeEntry` / `clearLocalPath` (D-04: empty `mp4LocalPath`, PRESERVE `thumbnailPath` on verified-cleanup) / `deleteEntry` / `cleanupOpportunistic(serverIds)` (D-04a best-effort cold-start GC). NOT scoped by user `sub` (Pitfall 8 — recordingId is the natural index, server row is per-user-authed).
- **Vitest coverage** — 11 tests across pendingThumbKey shape + roundtrip + null handling + JSON-parse-failure defense + opportunistic GC keep/drop + sibling-key isolation. All green; full mobile suite remains 699/699 green.
- **Robolectric coverage** — 3 tests covering the best-effort failure modes (zero-byte mp4, missing file, missing thumbsDir). On-device verification of a non-null bitmap from a real HEVC fixture is part of Plan 06-11 manual smoke.

## Task Commits

Each task was committed atomically:

1. **Task 1: ThumbnailExtractor.kt + Robolectric test** — `426cb96` (`feat`)
2. **Task 2: FinalizeWorker step 8.5 + onSegmentComplete payload** — `a515bc3` (`feat`)
3. **Task 3: thumbnailLedger.ts + pendingThumbKey + Vitest** — `30bf3c1` (`feat`)

_Note: Tasks 1 and 3 are TDD plans; the test files were authored before the production code, but committed alongside the impl in a single `feat()` commit (vs. split `test()` + `feat()`) because Kotlin / TypeScript compile-time linking requires the impl symbol to exist for the test file to compile. Acceptance gates (Robolectric green; Vitest green) covered the RED→GREEN intent procedurally._

**Plan metadata:** SUMMARY.md (this file) — committed as a follow-up after worktree merge by the orchestrator.

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThumbnailExtractor.kt` (NEW, 84 lines) — best-effort first-I-frame extractor.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThumbnailExtractorTest.kt` (NEW, 92 lines) — 3 Robolectric tests for the failure-tolerant behavior surface.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` (MODIFIED, +31 lines) — `import java.io.File`; step 8.5 thumbnail extraction (practice-skipped); `thumbnailPath` payload key.
- `apps/mobile/src/services/thumbnailLedger.ts` (NEW, 152 lines) — 5 CRUD exports + ThumbnailLedgerEntry interface.
- `apps/mobile/__tests__/services/thumbnailLedger.test.ts` (NEW, 175 lines) — 11 Vitest tests covering pendingThumbKey shape + CRUD + cleanupOpportunistic + JSON-parse-failure defense + non-pendingThumb-key isolation.
- `apps/mobile/src/state/keys.ts` (MODIFIED, +24 lines) — appended `pendingThumbKey(recordingId)` helper (preserves all existing exports — see Cross-Plan Awareness section).
- `apps/mobile/vitest.setup.ts` (MODIFIED, +9 lines) — added `getAllKeys(): string[]` to the in-memory react-native-mmkv mock; required by `cleanupOpportunistic` and present on the real Nitro spec.

## Decisions Made

- **Followed CONTEXT D-05a's smallest-blast-radius option** — extending FinalizeWorker rather than a dedicated `HumynThumbnail` native module. FinalizeWorker already runs on its own `finalizeExecutor` thread, so the extractor inherits the safe-from-encoder-pump isolation for free. A dedicated module would add a `MainApplication` registration + a JS bridge stub + a `package.json` line for ~30 extra LOC of glue without a second consumer.
- **MMKV API = `.remove(key)`** — the plan example used `.delete(key)` (which exists on the vitest mock but NOT on the real Nitro spec). Followed the production API + the existing codebase convention (`uploadReconcile.ts`, `appStore.ts`, `hydrate.test.ts` all use `.remove`).
- **Step numbering deviation (8.5 vs docs' 7.5)** — the design doc and PATTERNS.md call the insertion point "step 7.5". The on-disk FinalizeWorker numbers SidecarManager.delete as step 8 (Plan 03-06 inserted `writeAtomic` between compose and delete, shifting the running step numbers — see FinalizeWorker.kt:127-149 comments). The contract is identical: post-orphan-sidecar-signal, pre-emit. Kept the doc's "8.5" comment + a note explaining the renumbering.
- **Vitest mock parity** — `getAllKeys()` added to the mock to match the real react-native-mmkv@4.x Nitro spec (`MMKV.nitro.d.ts:443`). Required by `cleanupOpportunistic`; no prior code touched it (the mock predated this use case). Documented inline in `vitest.setup.ts`.
- **Combined feat commits for TDD Tasks 1 + 3** — Kotlin / TS compile-time linking made a strict RED-first commit impossible (the test file references symbols the impl introduces). The closest practical RED→GREEN sequencing was: author test first, author impl second, run-to-green, single commit. The 06-01 split-commit pattern (`test(06-01)` then `feat(06-01)`) applied to tests against an existing module; this plan creates the module fresh.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - MMKV API mismatch] Plan example used `.delete(key)`, production API is `.remove(key)`**

- **Found during:** Task 3 (thumbnailLedger.ts implementation)
- **Issue:** The 06-04 plan example + the 06-PATTERNS.md sketch both wrote `secureMmkv.delete(...)` / `secureMmkv.remove(...)` inconsistently. The real `react-native-mmkv@4.x` Nitro spec (`MMKV.nitro.d.ts:443`) exposes `remove(key: string): boolean` only; `.delete` is NOT on the real type. Every existing service in the codebase uses `.remove` (verified via `grep secureMmkv.* apps/mobile/src/`).
- **Fix:** Used `.remove()` throughout `thumbnailLedger.ts` for parity with the production API + the existing codebase convention.
- **Files modified:** `apps/mobile/src/services/thumbnailLedger.ts`
- **Verification:** Typecheck green (`npm run typecheck` exits 0); 11 Vitest tests green; full 699-test suite green.
- **Committed in:** `30bf3c1` (Task 3 commit)

**2. [Rule 3 - Blocking] Vitest mock missing `getAllKeys()`**

- **Found during:** Task 3 (Vitest run for cleanupOpportunistic coverage)
- **Issue:** `thumbnailLedger.cleanupOpportunistic` iterates every MMKV key via `secureMmkv.getAllKeys()`. The vitest.setup.ts in-memory mock did not expose `getAllKeys` (the method exists on the real Nitro spec). Tests 8 + 9 — opportunistic-cleanup keep/drop + non-pendingThumb-key isolation — would have crashed with `secureMmkv.getAllKeys is not a function`.
- **Fix:** Added `getAllKeys(): string[] => Array.from(getStore(id).keys())` to both the `makeInstance` factory and the `MMKV` class shim in vitest.setup.ts. Documented inline with a reference to the Nitro spec.
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Verification:** 699 Vitest tests pass (no regression on any other test file's mock-dependent paths).
- **Committed in:** `30bf3c1` (Task 3 commit, alongside the impl + tests)

**3. [Rule 3 - Minor count slip on `pendingThumbKey(` acceptance gate]**

- **Found during:** Task 3 acceptance-criteria verification
- **Issue:** Plan said `grep -c "pendingThumb\.\${entry.recordingId}\|pendingThumbKey(" apps/mobile/src/services/thumbnailLedger.ts >= 4`. The plan's alternation regex anticipated someone might inline the literal template string. My implementation uses the helper everywhere, so the actual count is 3 invocations (`pendingThumbKey(entry.recordingId)` in writeEntry, `pendingThumbKey(recordingId)` in readEntry + deleteEntry). Functionally cleaner; numerically below the gate.
- **Fix:** None — the count gate's spirit ("keep the key derivation centralized through the helper") is over-satisfied (3/3 invocations route through the helper; 0 inlined literals).
- **Verification:** `grep -c "pendingThumbKey(" thumbnailLedger.ts` = 3; `grep -c 'pendingThumb\.\${'` = 0 (the inline literal does not exist in the file — the only `pendingThumb.{...}.v1` string is in the helper's body in keys.ts).
- **Status:** Numeric gate slipped; semantic gate (key derivation = single source) cleanly met.

---

**Total deviations:** 3 auto-fixed (1 production-API correction, 1 blocking-mock extension, 1 acceptance-gate count over-strictness).
**Impact on plan:** Both API + mock fixes were correctness-essential. The count slip is a brittle-gate cosmetic — no scope creep, no functional regression.

## Issues Encountered

- **Worktree node_modules empty + Android SDK location missing + google-services.json missing** — fresh parallel-executor worktrees do not carry installed dependencies. Recovered by:
  - `npm ci` in `apps/mobile/` (850 packages added in 15s)
  - Copied `apps/mobile/android/local.properties` from main repo (gitignored — `sdk.dir=...`)
  - Copied `apps/mobile/android/app/src/apkRollout/google-services.json` from main repo (gitignored — Firebase config)
  - The worktree-spawn-time bootstrap doesn't propagate these gitignored configs; verified the verification command `./gradlew :app:testApkRolloutDebugUnitTest` worked after the copy.

## Cross-Plan Awareness

This plan ran in Wave 3 parallel to Plan 06-05. Plan 06-05 modifies `apps/mobile/src/state/appStore.ts` + `apps/mobile/src/state/hydrate.ts`; I own `apps/mobile/src/state/keys.ts`. The file boundaries are disjoint. Per the runtime note in the spawn brief: "preserve all existing exports and only ADD a new key for the thumbnail ledger". Verified — `keys.ts` retains every prior export (`KEYS` const, `softBannerDismissKey`, `practiceDoneKey`) and appends `pendingThumbKey` at the end. The orchestrator merges 06-05 first, then this worktree; any cross-plan typecheck regression will surface on the post-merge gate.

## User Setup Required

None — no external service configuration. The Robolectric coverage runs entirely on the JVM; the Vitest coverage runs in jsdom; on-device verification of a real HEVC first-frame bitmap is part of Plan 06-11 manual smoke (the operator records a 60 s segment on Pixel 10a and checks the History row's thumbnail rendering).

## Next Phase Readiness

**Ready for Wave 4 (Plans 06-06 .. 06-11) consumers:**

- **Plan 06-09 (HistoryScreen + RecordingScreen segment-complete handler):** `readEntry(recordingId)` returns the row overlay; the existing `onSegmentComplete` listener in `RecordingScreen.tsx` should call `writeEntry({...})` next to the existing `HumynUpload.enqueue(...)`. The payload now carries `thumbnailPath: string | null` (read it from the event body).
- **Plan 06-10 (PlayerScreen):** `readEntry(recordingId).mp4LocalPath` non-empty + the file exists on disk → play `file://`. Otherwise call the Plan 06-06 `GET /recordings/:id/stream-url` endpoint.
- **Plan 06-08 (recordingEvents `_events` outbox-drain hook):** call `clearLocalPath(recordingId)` on the `verified` event consumer — empties `mp4LocalPath` but PRESERVES `thumbnailPath` (D-04 invariant).
- **Plan 06-11 (manual smoke):** record a 60 s segment on Pixel 10a; verify `filesDir/thumbs/<base>.thumb.jpg` exists; verify the History row renders the JPEG (not the gradient + first-letter fallback).

**No blockers carried forward.** The Robolectric shadow's inability to decode real HEVC bytes is a known limitation (RESEARCH §A4 — the on-device first-non-null-bitmap verification is explicitly deferred to Plan 06-11).

## Self-Check: PASSED

**Files created (verified):**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThumbnailExtractor.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThumbnailExtractorTest.kt` — FOUND
- `apps/mobile/src/services/thumbnailLedger.ts` — FOUND
- `apps/mobile/__tests__/services/thumbnailLedger.test.ts` — FOUND

**Files modified (verified):**

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt` — `ThumbnailExtractor.extractFirstFrame` reference present
- `apps/mobile/src/state/keys.ts` — `pendingThumbKey` export present
- `apps/mobile/vitest.setup.ts` — `getAllKeys` mock method present

**Commits (verified via `git log --oneline -5`):**

- `426cb96` — FOUND (Task 1)
- `a515bc3` — FOUND (Task 2)
- `30bf3c1` — FOUND (Task 3)

**Test gates:**

- `./gradlew :app:testApkRolloutDebugUnitTest --tests ai.humynlabs.capture.capture.ThumbnailExtractorTest` → BUILD SUCCESSFUL (3 tests, 0 failures, 0 errors)
- `./gradlew :app:compileApkRolloutDebugKotlin` → BUILD SUCCESSFUL
- `npm run test -- --run thumbnailLedger` → 11 passed (11)
- `npm run test` (full mobile suite) → 699 passed (699)
- `npm run typecheck` → exits 0 with no output

---

_Phase: 06-tasks-history-home-tiles-lexical-search_
_Completed: 2026-05-14_
