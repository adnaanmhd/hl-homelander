---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 06
subsystem: mobile-android-native
tags:
  [
    upload,
    s3-multipart,
    okhttp,
    chunk-uploader,
    retry-backoff,
    dead-letter,
    network-monitor,
    react-native,
    kotlin,
    mockwebserver,
  ]

# Dependency graph
requires:
  - phase: 05-04
    provides: 'UploadQueueStore (read/upsert/remove/bootstrap), UploadModels (UploadRow/PartState, chunkBytesForNetwork, partsCountFor), HumynUploadModule stub (enqueue/pause/resume/getQueue/clearVerified + emitProgress/emitQueueChanged + bgExecutor), UploadControlState paused flag, HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE seam'
  - phase: 05-05
    provides: 'POST /recordings/:id/reupload (same shape as /init — for a hash-mismatch row), GET /recordings/verified-ids'
  - phase: 03-humyn-capture-native-module
    provides: 'capture/MetadataComposer video_metadata.json structure (recording_id top-level; metadata.{file_sha256, imu_sha256, file_size_bytes, imu_size_bytes, duration_seconds, start_timestamp}); updater/HumynUpdaterModule streaming-over-file + 64 KB buffer + background-executor precedent'
  - phase: 01-foundation-backend-distribution-recon
    provides: 'POST /recordings/init + presigned PUT URLs + POST /recordings/:id/finalize (the server side of the multipart client flow)'
provides:
  - 'apps/mobile/android/.../upload/ChunkUploader.kt — OkHttp streaming PUT-per-part over RandomAccessFile.seek + a 64 KB loop (never loads a multi-GB MP4 into memory), ETag capture, the exact 2/4/8/16/32/64s retry/backoff → DeadLetterException on the 7th failure, uploadPart() never re-PUTs a DONE part (UP-04), a 30s no-progress watchdog cancelling the OkHttp Call → next retry on a fresh socket (the reliable UP-19 half); + MssSocketFactory (best-effort TCP_MAXSEG=1280 clamp — the unreliable UP-19 half, drops silently if it no-ops); + DeadLetterException'
  - 'apps/mobile/android/.../upload/UploadCoordinator.kt — the queue drainer: drainNow() runs /recordings/init (or /reupload via row.reupload) with partsCount pinned ONCE → metadata.json PUT (via the retry/dead-letter machinery) → video parts + the 1 IMU part PUT behind a Semaphore(6)=3∥×2∥ on a fixed thread pool (surplus imuPartUrls ignored — Pitfall 2), persisting {etag,status} after each success → /recordings/:id/finalize with the collected ETags → row → AWAITING_VERIFY (stays in the queue); DeadLetterException → DEAD_LETTER + deadLetterReason + emitQueueChanged(); transient → leave UPLOADING for the next drain; pause/owner-aware; debounced onUploadProgress (≤1/5s/row); never logs presigned URLs; DEFAULT_HTTP_CLIENT = MssSocketFactory + readTimeout(0)/callTimeout(0); cancelInflight(); UploadAuthContext (process-lived API-base-URL/bearer/sub injected from JS)'
  - 'apps/mobile/android/.../upload/NetworkMonitor.kt — isCellular() via ConnectivityManager.getNetworkCapabilities(activeNetwork).hasTransport(TRANSPORT_CELLULAR) && !hasTransport(TRANSPORT_WIFI) (only picks the chunk size — NO Wi-Fi-only gate, UP-17); registerDefaultNetworkCallback (event-driven, no timer poll) → onConnectivityRegained wakes a paused/stalled drain; idempotent exception-tolerant register/unregister'
  - 'apps/mobile/android/.../upload/HumynUploadModule.kt — now owns the coordinator + networkMonitor + a paused AtomicBoolean (mirrors UploadControlState); + setUploadContext(apiBaseUrl, bearerToken, sub) @ReactMethod; enqueue() kicks coordinator.drain() + sends ACTION_SET_UPLOAD_ACTIVE(true); pause() cancels in-flight Calls (rows/parts preserved); resume() kicks drain(); onConnectivityRegained wakes the drain; invalidate() shuts the coordinator down + unregisters the monitor; rowToMap exposes the reupload flag'
  - "apps/mobile/android/.../upload/UploadModels.kt — + UploadRow.reupload flag (Plan 05-08's hash-mismatch re-upload seam), (de)serialised"
  - 'apps/mobile/android/.../test/.../upload/ChunkUploaderRetryTest.kt — 8 MockWebServer-backed tests; apps/mobile/android/.../test/.../upload/UploadCoordinatorTest.kt — 7 MockWebServer-backed tests; apps/mobile/android/.../test/.../upload/NetworkMonitorTest.kt — 5 Robolectric tests'
affects: [05-07, 05-08]

# Tech tracking
tech-stack:
  added:
    - 'com.squareup.okhttp3:okhttp:4.9.2 (pinned explicitly — RN already bundles it transitively; the upload code uses it as the chunk-PUT transport)'
    - 'com.squareup.okhttp3:mockwebserver:4.9.2 (testImplementation — stands in for the Phase-1 API + S3 in the upload tests)'
  patterns:
    - 'Streaming PUT-per-part over a RandomAccessFile-ranged OkHttp RequestBody (writeTo + a 64 KB buffer loop) — a multi-GB MP4 is never loaded into memory; only `chunkBytes` (5–8 MiB) of range is touched per PUT, and even that is streamed not buffered (T-5-06-04)'
    - 'Two-half UP-19 mitigation: (a) a 30s no-progress watchdog (per-Call ScheduledExecutorService — if no body bytes moved in 30s, cancel the Call; the next retry gets a fresh socket / new TCP handshake / possibly new MSS) — the RELIABLE, portable half; (b) MssSocketFactory (best-effort TCP_MAXSEG=1280 clamp via a Socket subclass attempting Os.setsockoptInt before connect(), wrapped in try/catch) — the UNRELIABLE half, dropped silently if it no-ops. The SMOKE runbook gets a manual step to verify whether (b) takes on-device. (per 05-RESEARCH.md Pitfall 7)'
    - "partsCount = ceil(videoSizeBytes / chunkBytesForNetwork(isCellular)) decided ONCE at /init time and pinned on the row — a mid-upload Wi-Fi↔cellular flip keeps the layout; a re-drain re-issues fresh presigned URLs but KEEPS the row's per-part {etag,status} (a DONE part is never re-PUT, UP-04 — no whole-file restart)"
    - 'readTimeout(0)/callTimeout(0) on the upload OkHttpClient — stall-handling is deferred to the 30s no-progress watchdog (a fixed readTimeout would kill a slow-but-progressing transfer on a bad-but-not-dead cellular link, T-5-06-05)'
    - 'Auth context (API base URL + bearer JWT + signed-in sub) pushed from the JS side via HumynUploadModule.setUploadContext(...) into a process-lived UploadAuthContext — the JWT lives in encrypted MMKV which is awkward to read from Kotlin, so the bridge injects it (refreshed on resume()); presigned S3 PUTs carry NO bearer, only /init,/finalize,/reupload do'
    - 'Bounded concurrency: a Semaphore(6) over a fixed thread pool used as 3 video ∥ + 3 IMU ∥ (the IMU CSV is tiny → part 1 only, surplus imuPartUrls ignored — Pitfall 2), futures collected + .get()-joined so drainNow() returns only when all parts have landed; a DeadLetterException from any part is rethrown → the row dead-letters'

key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/NetworkMonitor.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/ChunkUploaderRetryTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/NetworkMonitorTest.kt
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt
    - apps/mobile/android/app/build.gradle

key-decisions:
  - 'ChunkUploader takes its backoff array + no-progress window as constructor params (defaults 2/4/8/16/32/64s and 30s) so the unit tests inject SHORT values — the dead-letter / watchdog tests run in ~10s, not ~2 minutes. The DEFAULT_HTTP_CLIENT in UploadCoordinator is the production wiring (MssSocketFactory + readTimeout/callTimeout 0).'
  - 'metadata.json is PUT through ChunkUploader.putPart (offset 0, whole file) rather than a separate one-shot helper — so a permanently-failing metadata PUT goes through the same retry/backoff → DeadLetterException machinery and dead-letters the recording instead of spinning forever on transient retries.'
  - 'Added UploadRow.reupload (Boolean, default false) to UploadModels.kt — the hash-mismatch re-upload seam Plan 05-08 sets (when true → UploadCoordinator calls POST /recordings/:id/reupload re-using the recordings row, instead of POST /recordings/init); cleared when the (re-)upload finishes (row → AWAITING_VERIFY). At Plan 05-06 nothing sets it. Avoided the alternative of reusing the FINALIZING state as the marker (FINALIZING is also set transiently right before postFinalize — a transient finalize failure would then wrongly look like a re-upload on the next drain).'
  - 'The bearer JWT + API base URL + signed-in sub are pushed across the bridge via setUploadContext(...) rather than having Kotlin read the encrypted MMKV instance directly — keeps the auth plumbing single-sourced on the JS side (services/api.ts BASE_URL() + secureMmkv AUTH_JWT). Documented as a header note in UploadCoordinator.kt. Plan 05-08 wires the actual setUploadContext call (launch / post-sign-in / on-resume).'
  - 'OkHttp 4.9.2 pinned explicitly in app/build.gradle (it was already on the compile classpath transitively via react-native — see node_modules/react-native/gradle/libs.versions.toml `okhttp = "4.9.2"`) so the upload code does not depend on a transitive coincidence; same minor as RN''s bundled version — do NOT bump independently of RN. mockwebserver:4.9.2 added to testImplementation.'

patterns-established:
  - 'Streaming chunk PUT: object : RequestBody() { writeTo(sink) over RandomAccessFile.seek(offset) + a 64 KB loop, contentLength = the range length, onBytes callback feeding the watchdog + the debounced progress emit }'
  - 'Per-attempt retry with the exact 2/4/8/16/32/64s backoff → DeadLetterException on exhaustion; a DONE PartState (status==DONE && etag!=null) short-circuits uploadPart with the cached etag'
  - "Per-Call no-progress watchdog: a ScheduledExecutorService polling every ~window/6; if now - lastProgressAt >= window and the Call isn't already cancelled, Call.cancel() — the retry loop then re-runs on a fresh Call"
  - 'Queue-drainer flow: drainExecutor.execute { for row in store.read(): skip AWAITING_VERIFY/VERIFIED/DEAD_LETTER, skip foreign-owned, skip if paused; uploadOne(row) catch DeadLetterException → DEAD_LETTER+reason+emitQueueChanged, catch Exception → log transient (leave UPLOADING) }'
  - 'Process-lived context object (UploadAuthContext) holding an AtomicReference<Triple<baseUrl, bearer, sub>> — survives a catalyst reload; mirrors the Plan-05-04 UploadControlState paused flag'

requirements-completed: [UP-01, UP-03, UP-04, UP-17, UP-19]

# Metrics
duration: ~95min
completed: 2026-05-12
---

# Phase 5 Plan 06: HumynUpload Transfer Engine Summary

**The `HumynUpload` Android transfer engine on top of Plan 05-04's queue store: `ChunkUploader` (streaming OkHttp PUT-per-part over a `RandomAccessFile` range + `ETag` capture + the exact 2/4/8/16/32/64 s retry → dead-letter + a 30 s no-progress abandon-and-retry-with-fresh-socket watchdog + a best-effort `TCP_MAXSEG=1280` clamp), `UploadCoordinator` (the queue drainer running `/recordings/init` → metadata + parts PUTs behind a 6-permit semaphore → `/recordings/:id/finalize` → `AWAITING_VERIFY`, persisting per-part `{etag,status}`, pause/owner-aware, debounced progress, dead-lettering cleanly), `NetworkMonitor` (`isCellular()` + the event-driven `registerDefaultNetworkCallback` resume trigger, no Wi-Fi-only gate), and the `HumynUploadModule` wiring + the 3 JUnit/Robolectric test files.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-05-12T12:13Z (approx)
- **Completed:** 2026-05-12T13:10Z (approx)
- **Tasks:** 2
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- `ChunkUploader.kt` — streaming PUT-per-part (a 4 GB MP4 is never loaded into memory), `ETag` capture, the exact `2/4/8/16/32/64 s` retry/backoff → `DeadLetterException` on the 7th failure, `uploadPart()` never re-PUTs a `DONE` part (UP-04), a 30 s no-progress watchdog cancelling the `Call` → the next retry uses a fresh socket (the reliable UP-19 half); `MssSocketFactory` is the best-effort `TCP_MAXSEG=1280` clamp (the unreliable UP-19 half, drops silently if it no-ops). `ChunkUploaderRetryTest` — 8 tests green.
- `UploadCoordinator.kt` — `drainNow()` runs the Phase-1 multipart flow (`/recordings/init` or `/reupload` with `partsCount` pinned once → `metadata.json` PUT → video parts + the 1 IMU part PUT behind a `Semaphore(6)` = 3 video ∥ + 3 IMU ∥ on a fixed thread pool → `/recordings/:id/finalize` → `AWAITING_VERIFY`), persists per-part `{etag,status}` after each success, debounces `onUploadProgress` to ≤ once/5 s/row, is pause-aware (UP-10) + owner-aware (UP-13), dead-letters on a `DeadLetterException` (`DEAD_LETTER` + `deadLetterReason` + `emitQueueChanged()` so the Pending-Uploads UI shows `chip-failed`), never logs presigned URLs (T-5-06-02). `UploadCoordinatorTest` — 7 tests green.
- `NetworkMonitor.kt` — `isCellular()` only picks the S3 part size (5 MiB cellular / 8 MiB Wi-Fi); there is no Wi-Fi-only gate anywhere (UP-17); `registerDefaultNetworkCallback` (event-driven, no timer poll) wakes a paused/stalled drain when connectivity returns. `NetworkMonitorTest` — 5 tests green.
- `HumynUploadModule.kt` — now owns the coordinator + the network monitor + a `paused` `AtomicBoolean`; new `setUploadContext(apiBaseUrl, bearerToken, sub)` `@ReactMethod`; `enqueue()` kicks `coordinator.drain()` + sends `ACTION_SET_UPLOAD_ACTIVE(true)`; `pause()` cancels in-flight `Call`s (rows/parts preserved — they resume); `resume()` kicks `drain()`; `invalidate()` shuts the coordinator down + unregisters the monitor.
- `UploadModels.kt` — `+ UploadRow.reupload` (the Plan-05-08 hash-mismatch re-upload seam), (de)serialised.
- `app/build.gradle` — pinned `okhttp:4.9.2` explicitly + added `mockwebserver:4.9.2` to `testImplementation`.

## Task Commits

Each task was committed atomically:

1. **Task 1: ChunkUploader.kt — streaming PUT-per-part + ETag + retry/backoff/dead-letter + 30s watchdog + best-effort MSS clamp** — `410ce9c` (feat) — also: build.gradle okhttp/mockwebserver pins, ChunkUploaderRetryTest.kt
2. **Task 2: NetworkMonitor.kt + UploadCoordinator.kt + HumynUploadModule wiring** — `070d99a` (feat) — also: UploadModels.kt reupload flag, NetworkMonitorTest.kt, UploadCoordinatorTest.kt

_Both tasks are `tdd="true"` in the plan. The realistic Kotlin + Robolectric/MockWebServer pattern here (consistent with Plan 05-04's `UploadQueueStoreTest`) is to co-commit the production code + its test as a single `feat(...)` commit — a test referencing a not-yet-existing Kotlin class is a compile error (not a runtime test failure), so a separate "RED" commit would break the whole test module. The tests were written before the code was finalised and were used to drive the design; both committed together. See TDD Gate Compliance below._

**Plan metadata:** see the docs commit that lands this SUMMARY.

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt` — the OkHttp streaming-PUT-per-part + ETag capture + retry/backoff(2/4/8/16/32/64s)/dead-letter + the 30s no-progress watchdog + the best-effort MSS clamp (MssSocketFactory) + DeadLetterException (~292 lines)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt` — the queue drainer: /init→PUT(metadata+parts, 3∥×2∥ semaphore)→/finalize, persisting per-part state, debounced progress, pause/owner-aware + UploadAuthContext (~462 lines)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/NetworkMonitor.kt` — isCellular() + the event-driven registerDefaultNetworkCallback resume trigger (~86 lines)
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt` — wired the coordinator + paused flag + setUploadContext + the ACTION_SET_UPLOAD_ACTIVE(true) signal + drain-on-enqueue/resume/connectivity + coordinator/monitor teardown in invalidate
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt` — + UploadRow.reupload flag
- `apps/mobile/android/app/build.gradle` — okhttp:4.9.2 (implementation, pinned to RN's bundled minor) + mockwebserver:4.9.2 (testImplementation)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/ChunkUploaderRetryTest.kt` — 8 MockWebServer-backed tests (ETag-on-2xx, 6-retries-then-success, 7-failures→DeadLetterException, no-ETag→dead-letter, watchdog-cancel-then-fresh-retry, DONE-part-not-re-PUT, success marks DONE+etag, dead-letter marks FAILED+rethrows)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt` — 7 MockWebServer-backed tests (full flow→AWAITING_VERIFY-still-queued, owner-pin skip, paused short-circuit, no-signed-in-user, dead-letter→DEAD_LETTER+emitQueueChanged, DONE-part-not-re-PUT-across-drains, cellular 5-MiB chunk partsCount)
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/NetworkMonitorTest.kt` — 5 Robolectric tests (cellular-only→isCellular, Wi-Fi-present→not-cellular, no-active-network→false, register/unregister idempotent, onConnectivityRegained fires on onAvailable)

## Decisions Made

See `key-decisions` frontmatter — the highlights: ChunkUploader's backoff/window are constructor params for fast tests; metadata.json PUT goes through `putPart` so a permanent failure dead-letters; `UploadRow.reupload` is the new Plan-05-08 seam (not the FINALIZING-state hack); the bearer/base-URL/sub are pushed across the bridge via `setUploadContext` not read from MMKV in Kotlin; OkHttp 4.9.2 pinned explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added OkHttp + MockWebServer Gradle dependencies**

- **Found during:** Task 1 (ChunkUploader.kt) — `ChunkUploader` needs OkHttp directly; the unit tests need MockWebServer.
- **Issue:** OkHttp 4.9.2 was only on the compile classpath transitively (via `react-native`); MockWebServer wasn't present at all.
- **Fix:** `implementation 'com.squareup.okhttp3:okhttp:4.9.2'` (pinned to RN's bundled minor — see `node_modules/react-native/gradle/libs.versions.toml`) + `testImplementation 'com.squareup.okhttp3:mockwebserver:4.9.2'` in `app/build.gradle`, with a comment explaining the pin.
- **Files modified:** `apps/mobile/android/app/build.gradle`
- **Verification:** `:app:compileApkRolloutDebugKotlin`, `:app:testApkRolloutDebugUnitTest`, `:app:assembleApkRolloutDebug -x lint` all exit 0.
- **Committed in:** `410ce9c` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Routed the metadata.json PUT through the retry/dead-letter machinery**

- **Found during:** Task 2 (UploadCoordinator.kt) — a permanently-failing metadata PUT (e.g. an expired/bad presign) would have spun forever as a "transient" retry and the row would stay `UPLOADING`, never dead-lettering — surfaced by the dead-letter unit test (it 500s ALL PUTs incl. `/s3/metadata`).
- **Issue:** The plan's sketch had `metadata.json` as a bare one-shot PUT that throws a plain `IOException` on failure (which `drainNow` treats as transient).
- **Fix:** PUT `metadata.json` via `ChunkUploader.putPart(metadataUrl, jsonFile, 0, jsonFile.length())` — same retry/backoff → `DeadLetterException` path as the data parts. Removed the now-unused `putOneShot` helper.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`
- **Verification:** `UploadCoordinatorTest."a part that always 500s dead-letters the row with a reason"` green.
- **Committed in:** `070d99a` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Added UploadRow.reupload as the hash-mismatch re-upload seam (instead of the FINALIZING-state hack the plan sketch implied)**

- **Found during:** Task 2 — the plan's `uploadOne` sketch checked `row.state == FINALIZING` to decide `/reupload` vs `/init`, but `FINALIZING` is also set transiently right before `postFinalize`, so a transient finalize failure would wrongly look like a re-upload on the next drain.
- **Issue:** Ambiguous re-upload marker.
- **Fix:** `+ UploadRow.reupload: Boolean = false` in `UploadModels.kt` (the plan's `files_modified` already lists `UploadModels.kt`), (de)serialised; `UploadCoordinator` gates on it; cleared on a successful (re-)upload. Plan 05-08 wires the JS-side flag-set.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt` (rowToMap exposes it)
- **Verification:** `UploadCoordinatorTest` (full flow + DONE-part-not-re-PUT) green; the round-trip through `UploadQueueStore` is exercised by the existing `UploadQueueStoreTest` (which still passes).
- **Committed in:** `070d99a` (Task 2 commit)

**4. [Rule 2 - Missing Critical] Added setUploadContext @ReactMethod for the auth context**

- **Found during:** Task 2 — `UploadCoordinator` needs the API base URL, bearer JWT, and signed-in `sub`; the plan's `read_first` flagged "pick whichever fits the existing auth plumbing; document the choice". The JWT lives in encrypted MMKV (`secureMmkv` `AUTH_JWT`) which is awkward to read from Kotlin, and the base URL is `react-native-config` `API_BASE_URL` on the JS side.
- **Issue:** No native-side path to the auth context existed.
- **Fix:** `setUploadContext(apiBaseUrl, bearerToken, sub)` `@ReactMethod` on `HumynUploadModule` → a process-lived `UploadAuthContext` the coordinator reads; the JS side calls it on launch / post-sign-in / on-resume (Plan 05-08 wires the call). Presigned S3 PUTs never carry the bearer.
- **Files modified:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt`, `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`
- **Verification:** APK assembles; `UploadCoordinatorTest` passes the auth context via the same lambdas.
- **Committed in:** `070d99a` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 missing-critical)
**Impact on plan:** All four are correctness/wiring necessities the plan's `read_first` / sketches flagged or implied. No scope creep — the FGS lifecycle (Plan 05-07) and the auto-start-on-stop / Pending-Uploads-UI / reconciliation / `setUploadContext`-call wiring (Plan 05-08) remain out of scope as the plan states.

## Issues Encountered

- A stale Gradle daemon stalled the first `:app:testApkRolloutDebugUnitTest` run for ~37 min (the test code was sound — confirmed via `jstack`; the suite re-ran in 17 s after `./gradlew --stop`). Added a 10 s `callTimeout` backstop to the _test_ OkHttp client (production stays `callTimeout(0)`) so a future watchdog regression can't hang the suite indefinitely.
- `ShadowConnectivityManager.activeNetwork` is `protected` in Robolectric — switched the tests to call the real `ConnectivityManager.getActiveNetwork()` (shadow-backed) for reads and `shadowOf(cm).setNetworkCapabilities(...)` for writes.

## TDD Gate Compliance

Both Task 1 and Task 2 are `tdd="true"`. The repo-established pattern for Kotlin native modules (see Plan 05-04's `UploadQueueStoreTest`, co-committed with `UploadQueueStore`) is a single `feat(...)` commit carrying the production code + its test together — a Kotlin test referencing a not-yet-existing class is a compile error, not a runtime test failure, so a standalone "RED" commit would break the entire `:app:testApkRolloutDebugUnitTest` module. Tests were written alongside the code and used to drive the design (the dead-letter / DONE-part / cellular-chunk-size behaviours were all test-first), but committed together: `410ce9c` (ChunkUploader + ChunkUploaderRetryTest), `070d99a` (NetworkMonitor + UploadCoordinator + HumynUploadModule + the two test files). No separate RED `test(...)` commit precedes the GREEN `feat(...)` commits — this is the consistent, intentional convention for this codebase's Kotlin-side TDD tasks.

## User Setup Required

None — no external service configuration required. (The JS-side `setUploadContext(...)` call + the FGS `dataSync` `startForeground` transition are wired in Plans 05-08 and 05-07 respectively.)

## Next Phase Readiness

- **Plan 05-07** (`UploadJobService.kt` + FGS extension): `HumynUploadModule.enqueue()` already fires `HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE(true)`; `UploadCoordinator.drainNow()` is the synchronous drain the FGS thread should call directly on its own background thread (the coordinator's `drainExecutor` serialises `drain()` calls — the FGS can also just call `drainNow()`); `UploadCoordinator.shutdown()` for teardown.
- **Plan 05-08** (`uploadReconcile.ts` + wire-up): set `row.reupload = true` (via a new `@ReactMethod` or the queue store) on a server `hash-mismatch` event → the coordinator calls `/recordings/:id/reupload`; call `HumynUpload.setUploadContext(API_BASE_URL, secureMmkv.getString(AUTH_JWT), sub)` on launch / post-sign-in / on-resume; the auto-enqueue-on-stop, record-start/stop pause/resume, logout, Pending-Uploads-UI, and `clearVerified(verifiedIds)` reconciliation wiring all sit on top of the bridge surface that's now complete (`enqueue`/`pause`/`resume`/`getQueue`/`clearVerified`/`setUploadContext` + `onUploadQueueChanged`/`onUploadProgress`).
- **UP-19 manual smoke step (open for the runbook):** verify on-device whether the `MssSocketFactory` `TCP_MAXSEG=1280` clamp actually takes (it may `ErrnoException` or no-op on a hidden-API-blocked socket) — if it no-ops, drop it; the 30 s no-progress watchdog carries UP-19 alone. This is a manual-only check (it can't be exercised under Robolectric/JVM — `java.net.Socket` has no `getFileDescriptor$()`).
- The hand-off doc note in CLAUDE.md (`Conventions`/`Architecture` are still empty) — the upload-pipeline patterns above are candidates if/when those sections get populated.

## Self-Check: PASSED

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/ChunkUploader.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/NetworkMonitor.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/ChunkUploaderRetryTest.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/NetworkMonitorTest.kt` — FOUND
- commit `410ce9c` — in `git log`
- commit `070d99a` — in `git log`
- `:app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.upload.*'` — 33 tests (8 ChunkUploaderRetry + 7 UploadCoordinator + 5 NetworkMonitor + 13 UploadQueueStore), 0 failures
- `:app:assembleApkRolloutDebug -x lint` — BUILD SUCCESSFUL
- `npx tsc --noEmit` (apps/mobile) — exit 0; `npx vitest run __tests__/manifests/` — 19 passed

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
