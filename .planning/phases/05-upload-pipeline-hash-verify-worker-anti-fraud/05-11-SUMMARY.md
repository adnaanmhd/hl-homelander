---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 11
subsystem: upload
tags: [android, kotlin, upload-queue, concurrency, reentrant-lock, robolectric, mockwebserver]

# Dependency graph
requires:
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: UploadCoordinator (the /init→PUT→/finalize queue drainer, Plan 05-06), UploadQueueStore (durable JSON-on-disk queue, Plan 05-04), the FGS/UIDT-job/module drain callers (Plan 05-07), HumynHandDetectorModuleTest BridgeReactContext fix (Plan 05-01, commit 0a4f4f8)
provides:
  - "UploadCoordinator.drainNow() is serialised by a private ReentrantLock.tryLock() — a second concurrent drain (FGS HandlerThread / UIDT JobService Thread / drainExecutor) returns immediately; only one drain mutates queue state at a time (the design's 'one drain at a time' invariant is now actually enforced)"
  - "the bogus synchronized(queueStore) wrappers in uploadOne's part-PUT futures are removed — a bare queueStore.upsert(row) is already self-synchronised on UploadQueueStore's own private lock"
  - "lastEmitMs is cleaned in the DeadLetterException branch too (WR-08)"
  - "a Robolectric concurrency test (two threads call drainNow() with /recordings/init parked ~400ms) proving exactly one drain does the upload work"
affects: [upload-pipeline, force-quit-recovery-smoke, 05-VERIFICATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: serialise a public method that's invoked off N independent threads with a private ReentrantLock + tryLock() (skip-if-busy semantics) — chosen over lock()/synchronized because the contending thread's work is already covered by the in-progress run, so it must NOT block; release in a finally wrapping the whole body so any thrown exception still unlocks"
    - "Pattern: don't wrap a self-synchronised store call in an outer synchronized(storeInstance) — the store's own private lock is the real monitor; an outer synchronized on the instance reference serialises nothing"
    - "Test pattern: add a @Volatile delay seam to the MockWebServer Dispatcher (e.g. setHeadersDelay on /recordings/init) so a test can park one thread mid-drain and reliably observe a second thread losing the lock"

key-files:
  created: []
  modified:
    - "apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt — drainLock = ReentrantLock(); drainNow() body guarded by tryLock()/try/finally; synchronized(queueStore) wrappers dropped; lastEmitMs.remove in the dead-letter branch; getShared KDoc updated"
    - "apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt — added `drainNow is serialised - two concurrent drains, only one does the upload work (CR-03)`; added an initHeadersDelayMs seam on the dispatcher"

key-decisions:
  - "No change to UploadQueueStore.kt — upsert() is already a single synchronized(lock) { read-modify-write keyed on recordingId } (Plan 05-04 wrote it that way); the optional `withLock` helper was not needed and not added (the plan said only add it if upsert wasn't atomic)"
  - "No edit to HumynHandDetectorModuleTest.kt — DEF-5-01 was already closed (it imports com.facebook.react.bridge.BridgeReactContext, commit 0a4f4f8); re-verified by running :app:testApkRolloutDebugUnitTest which compiled + ran clean"

patterns-established:
  - "ReentrantLock.tryLock() skip-if-busy for cross-thread serialisation of a singleton's public entrypoint"

requirements-completed: [UP-06, UP-01, UP-04]

# Metrics
duration: ~25min
completed: 2026-05-12
---

# Phase 5 Plan 11: drainNow() Serialisation (CR-03 gap closure) Summary

**`UploadCoordinator.drainNow()` is now serialised by a private `ReentrantLock.tryLock()` — a second concurrent drain off the FGS HandlerThread / UIDT JobService Thread / drainExecutor returns immediately, so no two threads run `uploadOne(row)` on the same row; the bogus `synchronized(queueStore)` no-op wrappers are removed; a Robolectric concurrency test proves it.**

## Performance

- **Duration:** ~25 min (most of it was first-build cost: `npm ci` + a cold `assembleApkRolloutDebug` in the fresh worktree)
- **Started:** 2026-05-12 (worktree spawn)
- **Completed:** 2026-05-12
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `private val drainLock = ReentrantLock()` and wrapped `drainNow()`'s entire body in `if (!drainLock.tryLock()) { Log.d(...); return }; try { ... } finally { drainLock.unlock() }` — the "only one drain at a time" invariant the whole upload design depends on is now actually enforced regardless of which of the three threads enters first (CR-03 fixed).
- Dropped the two `synchronized(queueStore) { queueStore.upsert(row) }` wrappers in `uploadOne`'s part-PUT futures → bare `queueStore.upsert(row)` (the store self-synchronises on its own private `lock`; the instance reference was never the monitor `upsert()` uses, so the wrapper serialised nothing).
- Folded in WR-08: `lastEmitMs.remove(row.recordingId)` in the `DeadLetterException` branch of the per-row loop, mirroring the success-tail cleanup.
- Updated the `getShared` KDoc to describe the `ReentrantLock` serialisation (the old comment falsely claimed `drainExecutor` serialised the two direct `drainNow()` callers).
- Confirmed DEF-5-01 closed — `HumynHandDetectorModuleTest.kt` already uses `BridgeReactContext` (commit `0a4f4f8`); `:app:compileApkRolloutDebugUnitTestKotlin` succeeds, so the new Kotlin tests run. No edit to that file.
- Added `UploadCoordinatorTest.drainNow is serialised - two concurrent drains, only one does the upload work (CR-03)`: parks the first drain inside `uploadOne` (`/recordings/init` response delayed ~400 ms via a new `initHeadersDelayMs` dispatcher seam), starts a second `drainNow()` 50 ms later, joins both, then asserts exactly one `/recordings/init` + one `/finalize` + one queue row (`AWAITING_VERIFY`) + no part PUT twice, and that the `tryLock()` loser returned in < 300 ms (well before the 400 ms delay).

## Task Commits

1. **Task 1: serialise drainNow() with a ReentrantLock.tryLock(); drop the bogus synchronized(queueStore) wrappers; re-verify DEF-5-01; add a concurrency test** — `c1b7311` (fix)

_(TDD task — the implementation + the test landed in one commit; the test target was run to confirm green before committing.)_

## Files Created/Modified
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt` — `import java.util.concurrent.locks.ReentrantLock`; `private val drainLock = ReentrantLock()` (with a KDoc explaining the three caller threads + why `tryLock()` not `lock()`); `drainNow()` body wrapped in `tryLock()/try/finally`; the two `synchronized(queueStore) { ... }` → bare `queueStore.upsert(row)`; `lastEmitMs.remove(row.recordingId)` added to the dead-letter branch; `getShared` KDoc rewritten.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt` — `import java.util.concurrent.TimeUnit`; `@Volatile private var initHeadersDelayMs = 0L` + `setHeadersDelay(...)` applied to the `/recordings/init` MockResponse; new `drainNow is serialised ...` test.

## Decisions Made
- **No change to `UploadQueueStore.kt`.** Re-read `upsert()` — it's already `synchronized(lock) { read list, replace-or-append by recordingId, atomic .partial-then-rename write }`, i.e. a true single-lock read-modify-write keyed on `recordingId` (Plan 05-04). The optional `withLock` helper was explicitly conditional ("only add if `upsert` isn't atomic") — it isn't needed, so it was not added.
- **No edit to `HumynHandDetectorModuleTest.kt`.** DEF-5-01 (the `ReactApplicationContext` abstract-class compile break) was already closed in commit `0a4f4f8` — the file imports `com.facebook.react.bridge.BridgeReactContext` and constructs `HumynHandDetectorModule(BridgeReactContext(ctx))`. Re-verified by running `:app:testApkRolloutDebugUnitTest` (it compiled + ran clean). The file stays untouched and is NOT in this plan's `files_modified` (the conditional entry in the plan frontmatter remains conditional/unused).

## Deviations from Plan

None — plan executed exactly as written. (The plan's "conditional" `HumynHandDetectorModuleTest.kt` edit and "optional" `UploadQueueStore.withLock` helper were both correctly determined to be unnecessary per the plan's own conditions — that's the plan's intended branch, not a deviation.)

## Issues Encountered
- The worktree was spawned without `node_modules` / `local.properties` / `google-services.json` (all gitignored and not carried into a fresh worktree). Resolved by running `npm ci` in `apps/mobile` (the mobile app is npm-with-committed-`package-lock.json`, intentionally excluded from the root pnpm workspace) and copying `apps/mobile/android/local.properties` + `apps/mobile/android/app/src/apkRollout/google-services.json` from the main checkout. These are local-only build artifacts — none are tracked, so none were staged/committed.

## User Setup Required
None - no external service configuration required.

## Verification

- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.upload.UploadCoordinatorTest'` → BUILD SUCCESSFUL; `TEST-...UploadCoordinatorTest.xml`: tests=8, failures=0, errors=0 — including the new `drainNow is serialised - two concurrent drains, only one does the upload work (CR-03)` (0.469 s).
- `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug -x lint` → BUILD SUCCESSFUL.
- `grep -n 'drainLock' UploadCoordinator.kt` → field decl (line 124) + `tryLock` (175) + `unlock` (207) + KDoc.
- `grep -n 'synchronized(queueStore)' UploadCoordinator.kt` → nothing (exit 1).
- `grep -n 'BridgeReactContext' HumynHandDetectorModuleTest.kt` → import + 2 usages (DEF-5-01 closed).
- `:app:compileApkRolloutDebugUnitTestKotlin` → succeeds.

## Next Phase Readiness
- CR-03 is closed: the single-drain invariant is now enforced, which is the prerequisite the CR-01 fix (Plan 05-10's re-presign-on-redrain) relies on (two concurrent re-presigns would still race without it).
- This is the **unblocker** for the force-quit-recovery on-hardware smoke test recorded as a human-verification item in `05-VERIFICATION.md` — the FGS / UIDT-job / module drains can no longer corrupt each other's state on a process-kill recovery.
- No blockers.

---
*Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud*
*Completed: 2026-05-12*
