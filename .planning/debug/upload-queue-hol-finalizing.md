---
name: upload-queue-hol-finalizing
status: resolved
trigger: 'BUG-260518-02: upload queue HOL-blocked by stuck FINALIZING — see E2E-WALK-BUGS-260518.md'
created: 2026-05-18
updated: 2026-05-18
source_doc: E2E-WALK-BUGS-260518.md
severity: critical
fix_path: C-concurrent-uploads-with-parallelism-cap
---

# Debug: upload-queue-hol-finalizing

## Symptoms

### Expected behavior

After a recording is captured and finalized server-side (i.e. server-side `qa_status = verified`,
all video parts + IMU multipart returned valid S3 ETags), the device's upload queue should:

- mark that recording's queue entry DONE
- proceed to upload the next PENDING entry
- and otherwise tolerate any single transient `/finalize` failure (5xx, lost response, server restart,
  BullMQ enqueue failure) by retrying with backoff and/or reconciling against `GET /recordings/:id`.

### Actual behavior

A single recording stuck in state `FINALIZING` permanently strangles the device's entire upload queue.
All subsequent recordings stay queued forever, eating the device's `files/` storage at ~600 MB / 10 min.

**Observed snapshot (host time 00:51 IST):**

| Device                       | Queue depth                                              | State distribution                                                       |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Pixel 8a (`4B301XEKB1H8D2`)  | 28 entries, 16 GB of mp4+csv+json in `files/recordings/` | 1 × `FINALIZING` (parts 72/72 DONE), **27 × `PENDING` with `parts 0/0`** |
| Pixel 10a (`5C161JEA304304`) | 14 entries, 8.2 GB of mp4+csv+json                       | 1 × `AWAITING_VERIFY`, 1 × `UPLOADING`, 12 × `PENDING`                   |

The stuck head on 8a is recording `01KRVPP7RKSYXD3DK2H5KKXYXA`:

- All 71 video parts + 1 IMU multipart are `status: "DONE"` with valid S3 ETags.
- Server side: `qa_status = verified`; sha matches the metadata.json (`63840c889c59…`).
- **The server has the recording — the client just doesn't know.**

User quote: _"That's NOT concurrency, that's stupidity."_

### Error messages

None surfaced in-app. No UI affordance to retry. Failure mode is silent + permanent.

(Upstream trigger from BUG-03 chain: `/finalize` 5xx because BullMQ couldn't enqueue jobs against an
I/O-erroring Redis container during the Docker.raw disk-pressure cascade.)

### Timeline

- 2026-05-17 → 2026-05-18 orchestrated E2E walk on Pixel 8a + Pixel 10a (parallel session).
- Build: `app-apkRollout-debug.apk` from `22ffec5` (`apkRollout` flavor, Play-Integrity install-source bypass).
- During the ~90-minute walk both devices captured continuously. The 8a queue stuck mid-walk;
  10a's kept progressing.

### Reproduction

1. Begin a multi-segment capture session on a device.
2. Either induce or naturally observe one `/finalize` failure (5xx / TCP drop / server restart /
   BullMQ enqueue failure during disk pressure). On this walk it happened naturally as part of BUG-03's
   Docker.raw cascade.
3. Continue recording further segments.
4. Observe: the failed entry stays `FINALIZING` forever; every subsequent entry stays `PENDING` with
   `parts 0/0`. The coordinator never advances.

## Root cause hypothesis (from bug doc — to be validated by gsd-debugger)

1. **Strict FIFO serialization across the queue.** `UploadCoord` advances one entry at a time;
   queue entry N+1 cannot move from `PENDING` → `INITING` until entry N reaches a terminal state.
   Entries behind a stuck head show `parts 0/0` because `/recordings/init` was never called.

2. **No reconciliation for the `FINALIZING` state.** If `POST /recordings/:id/finalize` returns 5xx,
   hangs, or the response is lost, the entry stays `FINALIZING` forever. There is no:
   - retry-with-backoff on transient finalize failure
   - poll of `GET /recordings/:id` to detect "server says it's already finalized/verified"
   - timeout + skip to next queue entry
   - manual-retry affordance in the UI

## Locations to look (from bug doc)

- `apps/mobile/android/.../upload/UploadCoordinator*.kt` (or whatever owns the queue.json round-robin)
- `apps/mobile/android/.../upload/FinalizeWorker.kt`
- The MMKV-backed queue persistence — `files/upload-queue/queue.json` schema lives in the native upload module

## Fix surface (from bug doc)

- Make per-recording state-machine progress independent of queue order (true concurrent uploads with a
  configurable parallelism cap, OR at minimum drop the FIFO lock and treat each entry as an
  independent reconciliation loop).
- Add a "reconcile FINALIZING" pass on app foreground + on coordinator tick: `GET /recordings/:id` and
  if server already shows `uploaded`/`verified`, mark local entry as DONE and remove from queue.
- Cap retries on stuck states; after N failures, mark entry as `NEEDS_ATTENTION` and surface in
  History UI as a retry-able row (don't silently strangle).
- Telemetry on time-in-state per queue entry so we can alert on entries stuck > 5 min.

## Current Focus

- hypothesis: **VALIDATED** — the bug doc's "FIFO blocks N+1 forever" mental model is directionally
  correct but mechanically incomplete. The actual strangler is the combination of (a)
  `readTimeout(0)` / `callTimeout(0)` on the API client + no `/finalize` watchdog → a hung
  `/finalize` POST holds the `drainLock` indefinitely; AND (b) no `GET /recordings/:id`
  reconciliation → the client can never learn "server already verified".
- test: code-walk + 7 new Robolectric tests landed in `UploadCoordinatorTest.kt`.
- expecting: ✅ done.
- next_action: ✅ Fix C landed across 4 coordinated changes; see Resolution below.

## Evidence

- timestamp: 2026-05-18T (session-manager validation)
  source: `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`
  finding: **The drain IS strictly serial across queue entries (validates hypothesis #1).**
  details: `drainNow()` (line 197–257) iterates `for (row in queueStore.read())` under a single
  `ReentrantLock` (`drainLock`, line 147–148, 198) acquired via `tryLock()`. Concurrent
  drain calls from FGS / UIDT JobService / module just `return` (line 199). Within the loop
  `uploadOne(row)` runs to completion or exception PER ROW before the next row is attempted.
  There is NO per-row independent reconciliation loop; the iteration order is queue order.

- timestamp: 2026-05-18T
  source: `UploadCoordinator.kt:197–257` (`drainNow`)
  finding: **No reconciliation path for FINALIZING (validates hypothesis #2).**
  details: The row-skip filter at lines 209–214 skips `AWAITING_VERIFY | VERIFIED | DEAD_LETTER`
  but EXPLICITLY DOES NOT SKIP `FINALIZING`. So on a re-drain a FINALIZING row IS re-entered
  into `uploadOne()`. But `uploadOne()` has only ONE control flow — start from `/init` (or
  `/parts` on re-drain), walk every part (all `continue`'d when `status == DONE`), then re-POST
  `/finalize` again. There is NO `GET /recordings/:id` poll. There is NO check for
  "server says verified" before re-POSTing finalize. The client cannot detect a recording
  that succeeded server-side but whose finalize response was lost.

- timestamp: 2026-05-18T
  source: `UploadCoordinator.kt:660` (`postFinalize`) + `:726-732` (`DEFAULT_HTTP_CLIENT`)
  finding: **The TRUE strangler — `/finalize` has no read or call timeout and no watchdog.**
  details: `DEFAULT_HTTP_CLIENT` is configured with `connectTimeout(30s)` BUT `readTimeout(0)` and
  `callTimeout(0)` (lines 729–731). The comment explains the rationale: "stall-handling is the
  `ChunkUploader` 30s no-progress watchdog's job (a fixed `readTimeout` would kill a slow-but-
  progressing transfer on a bad cellular link)". **But that 30s no-progress watchdog only
  wraps part PUTs via ChunkUploader. `/finalize` is a plain `apiClient.newCall(req).execute()`
  via `executeTracked` (line 507–515) — NO watchdog.** So if the server hangs mid-handler
  (BUG-03's Redis-erroring `/finalize` is a plausible cause: BullMQ enqueue blocking on a
  broken Redis pool), the OkHttp call sits in the read forever. The `drainLock` is held the
  entire time; every subsequent FGS / JobService / module-drain trigger `tryLock`s, fails,
  and silently returns. **The queue is frozen until the process is killed.**

- timestamp: 2026-05-18T
  source: `UploadCoordinator.kt:225–252` (bounded transient retry)
  finding: **Per-row bounded retry budget is irrelevant to FINALIZING hangs.**
  details: The 3-attempt × 5s `Thread.sleep` retry inside the row loop ONLY fires on
  `uploadOne()` THROWING. If `/finalize` returns `5xx`, `postFinalize` throws `IOException`
  and the outer loop catches → attempt++ → sleep 5s → retry. After 3 such failures the loop
  moves to the next row (the `break` on line 244 exits ONLY the inner `while`, not the outer
  `for`). So a fast-failing `5xx` finalize does NOT strangle. But a HANG (or a stream that
  takes minutes per attempt) does, because `uploadOne()` never returns and the bounded budget
  never fires. ALSO: on the next external drain trigger the loop starts from the top of the
  queue again, re-encounters the FINALIZING row first, and burns its 3-attempt budget AGAIN
  before reaching the PENDING entries. So even on fast-fail the throughput collapses to
  `3 × 5s = 15s per drain trigger` of useful work after which the queue resumes — but on the
  8a walk, drain triggers are minutes apart and `/finalize` was hanging (not fast-failing),
  so the queue froze completely.

- timestamp: 2026-05-18T
  source: `UploadCoordinator.kt:660–662` (`postFinalize`)
  finding: **`/finalize` has no replay-against-server-state check.**
  details: The body just throws IOException on `!resp.isSuccessful`. There is no branch for
  "200 OK with the recording already verified" — but since the server's idempotency
  pre-handler returns the cached 2xx on a re-POST, this is mostly fine IF the original
  response was cached. It is NOT fine when the original `/finalize` was 5xx (no cache) or
  hung (no cache). In those cases the client has no way to recover except keep POSTing
  `/finalize` and hope the server eventually accepts. A `GET /recordings/:id` poll would
  short-circuit: if the server-side `qa_status` is `verified` (which it is for
  `01KRVPP7RKSYXD3DK2H5KKXYXA` per the bug doc), the client can mark the row
  `AWAITING_VERIFY` locally and move on.

## Eliminated

- "the row state filter skips FINALIZING": NO — line 209–214 only skips `AWAITING_VERIFY | VERIFIED
| DEAD_LETTER`. FINALIZING rows ARE re-attempted on every drain.
- "the idempotency-key replay protects us": only when the original `/finalize` got a server-cached
  2xx response. If it 5xx'd or hung, no cache entry exists, every retry hits a fresh handler that
  may also fail (especially during the Redis-down window).

## Resolution

**Status: FIXED + VERIFIED via 7 new Robolectric tests (all 28 UploadCoordinatorTest cases pass).**

Fix C landed as four coordinated changes:

### 1. Bounded concurrent workers (item 1)

`UploadCoordinator.kt`:

- Replaced the single `ReentrantLock` cross-row mutex (`drainLock`) with:
  - `inProgressIds: MutableSet<String>` — per-row reservation via thread-safe `Set#add`/`remove`
  - `dispatchLock: ReentrantLock` — re-entry guard so concurrent `drainNow()` callers (FGS / UIDT JobService / module-drain trio) don't each fire dispatch ticks
- Added `workerExecutor: ExecutorService` (fixed thread pool of `parallelismCap=2` by default).
- `drainNow()` now:
  1. Acquires `dispatchLock.tryLock()`
  2. Walks the eligible-row snapshot, reserves each row via `inProgressIds.add()`, submits to `workerExecutor`
  3. Synchronously waits on every dispatched `Future<*>` so callers see "synchronous from outside, parallel inside" semantics
  4. Releases the lock in `finally`
- `runWorker(row)` runs the bounded-retry loop for a single row (the per-row state machine the old serial loop ran inline).

A hung row blocks only its own worker; other workers continue draining the rest of the queue.

### 2. `/finalize` watchdog (item 2)

`UploadCoordinator.kt`:

- New `executeTrackedWithTimeout(req, timeoutMs)` — applies `okhttp3.Call.timeout()` per call.
- `postFinalize()` now uses this with `finalizeCallTimeoutMs=60_000`. The client-wide `callTimeout(0)` is preserved (part PUTs still delegate stall-handling to `ChunkUploader`'s 30s no-progress watchdog, which correctly handles slow-but-progressing cellular transfers).
- A hung `/finalize` fails into the transient-retry loop instead of pinning the worker forever.

### 3. FINALIZING reconciliation (item 3)

`UploadCoordinator.kt`:

- New `getRecordingQaStatus(baseUrl, recordingId)` — `GET /recordings/:id`, returns the server's current `qa_status` string (or null on failure).
- `uploadOne()` top-of-function: if `row.state == FINALIZING`, first call `getRecordingQaStatus`. If `qa_status ∈ {verified, uploaded}`, mark row `AWAITING_VERIFY` locally and bail (no re-POST). Else fall through.
- This recovers `01KRVPP7RKSYXD3DK2H5KKXYXA`-shape stuck rows without a process kill.

### 4. `NEEDS_ATTENTION` terminal-but-recoverable state (item 4)

`UploadModels.kt` + `UploadCoordinator.kt` + `HumynUploadModule.kt`:

- New `UploadState.NEEDS_ATTENTION` enum value.
- New persistent fields on `UploadRow`: `attemptCount`, `lastFailureAt`, `lastFailureState`, `lastFailureReason`. All optional, default 0/null, only persisted on rows that have failed.
- After `needsAttentionThreshold=6` failed automatic recovery attempts, the worker transitions the row to NEEDS_ATTENTION and stops the auto-retry loop.
- Per-row exponential backoff: 30s → 60s → 2m → 5m → 15m → 1h. A row in backoff is skipped by `drainNow` until `lastFailureAt + schedule[attemptCount]` elapses.
- New `HumynUploadModule.retryNeedsAttention(recordingId)` ReactMethod — user-driven retry from the History UI's "Retry" affordance. Resets the counter + transitions back to UPLOADING/PENDING.

### JS-side changes

- `HumynUpload.ts`: extended `UploadQueueRow['state']` union with `'needs-attention'`; added new optional fields (`attemptCount`, `lastFailureAt`, `lastFailureState`, `lastFailureReason`); added `retryNeedsAttention` + `retryNeedsAttentionSafe` to the facade.
- `HistoryRow.tsx`: `'needs-attention'` maps to `chip-failed` visual (same as dead-letter); new optional `needsAttentionReason` prop produces a reason-prefixed Retry label.
- `HistoryScreen.tsx`: `onRowRetry` dispatches `retryNeedsAttention` for `'needs-attention'` rows, falls back to existing `reupload` path otherwise; passes `needsAttentionReason={dr.lastFailureReason}` to `<HistoryRow>`.
- `PendingUploadsScreen.tsx`: same dispatch logic in its `onRetry`; surfaces `lastFailureReason` in the deadReason slot for NEEDS_ATTENTION rows.
- `HomeScreen.tsx` + `HomeSkeletonScreen.tsx`: `chipVariantFor` maps `'needs-attention'` → `'failed'`. The Home pending-uploads tile's tap handler does NOT auto-revive NEEDS_ATTENTION (auto-revive is for DEAD_LETTER only — NEEDS_ATTENTION explicitly waits on user action).

### Behavior that is deliberately NOT changed

- The auto-revive sweep in `uploadReconcile.ts` for DEAD_LETTER rows on cold-start + AppState→active continues to work; NEEDS_ATTENTION rows are NOT auto-revived (the whole point of the state).
- Part-PUT path is unchanged — still bounded by the device-level `partSemaphore(6)`. With 2 concurrent rows, the total in-flight HTTPS in the worst case stays at 6 (not 12), preserving the existing cellular-friendly behavior.
- The 30s ChunkUploader no-progress watchdog on part PUTs is preserved.

### Files changed

```
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt  +369 -36
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt        +106 -2
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt    +47 -4
apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt +208 -3
apps/mobile/src/native/HumynUpload.ts                                                     +75 -5
apps/mobile/src/components/HistoryRow.tsx                                                 +57 -4
apps/mobile/src/screens/history/HistoryScreen.tsx                                         +37 -7
apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx                                  +33 -6
apps/mobile/src/screens/home/HomeScreen.tsx                                               +6 -1
apps/mobile/src/screens/home/HomeSkeletonScreen.tsx                                       +4 -1
```

### Verification

- `./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.upload.*"` — **28/28 tests pass** (7 new + 21 existing).
- `npx vitest run` — **112 test files, 835 tests, all pass.**
- `npx tsc --noEmit` — clean (one pre-existing unrelated error in `TaskIcon.tsx`).
- `./gradlew :app:compileApkRolloutDebugKotlin` — clean (only pre-existing deprecation warnings).

### Hardware verification (DEFERRED to a smoke walk)

The bug was reproduced on a Pixel 8a during the 2026-05-18 walk. Hardware verification of the fix
requires re-running the same scenario: walk + induce a transient `/finalize` 5xx or hang and observe
that (a) other rows continue uploading, (b) the stuck row reconciles via GET when the server is healthy,
(c) the watchdog fires at 60s instead of hanging forever, (d) repeated failures surface as NEEDS_ATTENTION
in History with a retry affordance. Recommended verification plan in the bug doc:

1. **5xx path:** add a debug-only override that returns 503 on the next `/finalize` for one recording.
2. **Hang path:** pause the API container mid-walk for ~2 min then resume.

Test infrastructure for both paths exists (the new `finalizeHangCount` / `finalizeHangMs` knobs in
`UploadCoordinatorTest.kt` simulate the hang; the existing `initResponseCode` knob can simulate
5xx). The hardware walk validates that the in-test behavior reproduces on real cellular / Wi-Fi.
