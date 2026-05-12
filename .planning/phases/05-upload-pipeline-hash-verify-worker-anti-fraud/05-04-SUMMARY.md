---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 04
subsystem: mobile-android-native
tags:
  [
    upload,
    queue,
    native-module,
    react-native,
    kotlin,
    s3-multipart,
    foreground-service,
    manifest,
    robolectric,
  ]

# Dependency graph
requires:
  - phase: 05-02
    provides: Wave-1 cosmetic/housekeeping cleanup closed
  - phase: 03-humyn-capture-native-module
    provides: capture/MetadataComposer.writeAtomic atomic-write idiom, CaptureLaunchSweep `.partial`-residue sweep + `files/practice/` + `__practice__` segregation, the canonical Kotlin native-module triad shape (battery/HumynBatteryModule, updater/HumynUpdaterModule), fgs/HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE seam
  - phase: 04-recording-surface-hand-gate
    provides: native/HumynBattery.ts (the exact JS-bridge shape to mirror), MainApplication.getPackages() packages.add(...) family
provides:
  - 'apps/mobile/android/.../upload/UploadModels.kt — UploadRow/PartState row schema (org.json (de)serialisers), chunkBytesForNetwork(isCellular) → 8 MiB Wi-Fi / 5 MiB cellular, partsCountFor(videoSizeBytes, chunkBytes) → ceil floored to 1, PRACTICE_TASK_ID = "__practice__", rowsToJsonString/rowsFromJsonString'
  - 'apps/mobile/android/.../upload/UploadQueueStore.kt — native-owned durable queue at filesDir/upload-queue/queue.json, atomic .partial-then-rename writes, enqueue() refusing practice rows (D-08), bootstrap(currentSub)/rowsForUser(currentSub) ownerUserId-pin (UP-13), upsert/remove, markVerifiedAndDeleteLocal (UP-15), corrupt-file-tolerant read()'
  - 'apps/mobile/android/.../upload/HumynUploadModule.kt — @ReactModule(NAME="HumynUpload"); @ReactMethod enqueue/pause/resume/getQueue/clearVerified on a single-thread bgExecutor; emits onUploadQueueChanged + onUploadProgress via RCTDeviceEventEmitter; invalidate() teardown; NO user-driven abort affordance (UP-11); UploadControlState process-lived paused flag'
  - 'apps/mobile/android/.../upload/HumynUploadPackage.kt — createNativeModules → listOf(HumynUploadModule), createViewManagers → emptyList()'
  - 'MainApplication.kt — packages.add(HumynUploadPackage())'
  - 'AndroidManifest.xml — REQUEST_IGNORE_BATTERY_OPTIMIZATIONS + RUN_USER_INITIATED_JOBS perms; <service .upload.UploadJobService BIND_JOB_SERVICE exported=false> (class ships in 05-07); FGS camera|microphone|dataSync declaration untouched'
  - 'apps/mobile/src/native/HumynUpload.ts — JS bridge: ensure() guard + canonical "not registered" error, lazy NativeEventEmitter, onUploadQueueChanged/onUploadProgress (caller MUST .remove()), HumynUpload facade incl. getQueueSafe() boot-safe variant, UploadQueueRow/UploadPartState/UploadProgressEvent TS types'
  - 'apps/mobile/android/.../test/.../upload/UploadQueueStoreTest.kt — Robolectric round-trip, practice-filter refusal (taskId + practice/ dir), owner-pin bootstrap, null-sub bootstrap, corrupt-json tolerance, chunk-size constants, partsCountFor, markVerifiedAndDeleteLocal/remove/upsert/verified-housekeeping'
affects: [05-06, 05-07, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Native-owned durable JSON-on-disk queue (NOT a 2nd react-native-mmkv instance — resolves D-STATE-01: the JS side reads the queue via the HumynUpload bridge, never via MMKV)'
    - 'Atomic .partial-then-rename queue writes (mirrors capture/MetadataComposer.writeAtomic; Files.move ATOMIC_MOVE with a renameTo fallback)'
    - 'D-08 practice-filter at the queue-store boundary — enqueue() refuses any row whose taskId == "__practice__" OR whose mp4Path is under a practice/ dir; the isPractice flag is cross-checked'
    - 'UP-13 ownerUserId-pin — every row carries the signed-in sub at finalize time; bootstrap(currentSub)/rowsForUser(currentSub) only return own-rows; logout preserves rows on disk'
    - 'partsCount = ceil(videoSizeBytes / chunkBytes) pinned ONCE at init from the bigger file (video) + the then-current network type — a mid-upload Wi-Fi↔cellular flip keeps the layout (the Plan 05-06 watchdog is the cellular mitigation, not a re-layout)'
    - 'UploadControlState — process-lived (module-scope object) @Volatile paused flag so pause/resume survive a catalyst reload; read by the Plan 05-06 coordinator'

key-files:
  created:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadQueueStore.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadPackage.kt
    - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadQueueStoreTest.kt
    - apps/mobile/src/native/HumynUpload.ts
  modified:
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt
    - apps/mobile/android/app/src/main/AndroidManifest.xml

decisions:
  - 'Cellular S3 part size = 5 MiB, NOT the spec''s "2 MB on cellular" — S3''s minimum non-final part size is 5 MiB so a literal 2 MiB UploadPart would be rejected; 5 MiB is the S3-legal value closest to spec intent (per 05-RESEARCH.md Pitfall 2). Documented in the UploadModels.kt header. The 8 MiB Wi-Fi figure is unchanged. idea-brief.md §7.1 / REQUIREMENTS.md UP-02 still say "2 MB" — not edited.'
  - 'The UploadJobService <service> declaration ships here (Plan 05-04) but the UploadJobService Kotlin class ships in Plan 05-07 — an undeclared-but-referenced JobService class is harmless until something schedules it; the APK assembles fine. Documented in the manifest comment.'
  - 'The queue store is a native-owned JSON-on-disk file, not a react-native-mmkv instance (D-STATE-01) — the JS side never touches the queue via MMKV; it reads via HumynUpload.getQueue() / the onUploadQueueChanged event.'

# Metrics
metrics:
  duration: ~25m
  completed: 2026-05-12
---

# Phase 5 Plan 04: HumynUpload Android Native-Module Foundation Summary

The `HumynUpload` Android native-module foundation for the Phase-5 background upload pipeline — the RN bridge triad, the durable upload queue store, the chunk-size / parts-count model, the manifest perms + the `UploadJobService` `<service>` declaration, and the JS bridge — with the D-08 practice filter and the UP-13 owner-pin baked into the queue store. No transferring (that's Plan 05-06); no FGS lifecycle / OEM walkthrough (Plan 05-07).

## What Shipped

**`UploadModels.kt`** — `UploadRow` (the full queue-row schema: `recordingId`, `ownerUserId`, the three bundle paths, `taskId`, `isPractice`, `state ∈ {PENDING, UPLOADING, FINALIZING, AWAITING_VERIFY, VERIFIED, DEAD_LETTER}`, `uploadId`/`imuUploadId`, `partsCount`/`chunkBytes`, `videoParts`/`imuParts` lists of `PartState`, `metadataPut`, timestamps, `deadLetterReason`), `PartState` (`n`, `status ∈ {PENDING, DONE, FAILED}`, `etag`, `retryCount`), `org.json`-based `toJson()`/`fromJson()` (no Gson/Moshi added), `WIFI_CHUNK_BYTES = 8 MiB`, `CELLULAR_CHUNK_BYTES = 5 MiB`, `chunkBytesForNetwork(isCellular)`, `partsCountFor(videoSizeBytes, chunkBytes)` (ceil, floored to 1), `PRACTICE_TASK_ID = "__practice__"`, `rowsToJsonString`/`rowsFromJsonString`. Header comment documents the 2-MiB→5-MiB S3-minimum deviation.

**`UploadQueueStore.kt`** (~190 lines) — native-owned durable queue at `filesDir/upload-queue/queue.json`. `read()` (missing → empty; corrupt → empty + log, never crashes), `writeAtomic()` (`.partial`-then-`Files.move(ATOMIC_MOVE)` with a `renameTo` fallback, mirroring `MetadataComposer.writeAtomic`), `enqueue()` (refuses practice rows — `taskId == "__practice__"` OR `mp4Path` under a `practice/` dir, with an `isPractice`-flag cross-check; idempotent on `recordingId`), `upsert()`, `remove()`, `bootstrap(currentSub)` (drops `VERIFIED`-with-missing-file rows; returns only `ownerUserId == currentSub && state != VERIFIED` rows; `null` sub → resume nothing), `rowsForUser(currentSub)`, `markVerifiedAndDeleteLocal(recordingId)` (mark VERIFIED → unlink mp4/csv/json → drop the row). All reads/writes `synchronized(lock)`. NOT a `react-native-mmkv` instance (D-STATE-01).

**`HumynUploadModule.kt`** — `@ReactModule(name = NAME)` / `companion object { const val NAME = "HumynUpload" }` / `getName() = NAME`; single-thread `bgExecutor`; `@ReactMethod` `enqueue(recordingId, mp4Path, csvPath, jsonPath, taskId, isPractice, ownerUserId, promise)` / `pause(promise)` / `resume(promise)` / `getQueue(promise)` / `clearVerified(recordingIds: ReadableArray, promise)` — each on `bgExecutor.execute { try { ... promise.resolve(...) } catch (t) { promise.reject(CODE, msg, t) } }`. Emits `onUploadQueueChanged(<WritableArray of rows>)` on every mutation; `emitProgress(recordingId, bytesUploaded, bytesTotal)` → `onUploadProgress` (called by the Plan 05-06 coordinator). `enqueue()` also fires the FGS `ACTION_SET_UPLOAD_ACTIVE` seam intent (best-effort). `invalidate()` shuts down the executor. **No user-driven abort affordance** anywhere (UP-11). `UploadControlState` — a module-scope `@Volatile` paused flag for the Plan 05-06 coordinator.

**`HumynUploadPackage.kt`** — `createNativeModules → listOf(HumynUploadModule(reactContext))`, `createViewManagers → emptyList()`.

**`MainApplication.kt`** — `packages.add(HumynUploadPackage())` after `HumynBeepPackage()`.

**`AndroidManifest.xml`** — added `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` + `RUN_USER_INITIATED_JOBS` perms; added `<service android:name=".upload.UploadJobService" android:permission="android.permission.BIND_JOB_SERVICE" android:exported="false"/>` (class ships in Plan 05-07). The FGS `camera|microphone|dataSync` declaration is untouched (the `manifests.test.ts` two-sided lock still passes).

**`native/HumynUpload.ts`** — mirrors `HumynBattery.ts`: `ensure()` guard with `'HumynUpload native module not registered — check apps/mobile/android/app/src/main/java/ai/humynlabs/capture/MainApplication.kt'`; lazy `NativeEventEmitter`; `onUploadQueueChanged(listener)` / `onUploadProgress(listener)` returning `EmitterSubscription` (caller MUST `.remove()`); `HumynUpload` facade (`enqueue`/`pause`/`resume`/`getQueue`/`clearVerified` + `getQueueSafe()` boot-safe variant returning `[]` on a missing module); `UploadQueueRow` / `UploadPartState` / `UploadProgressEvent` TS types matching the Kotlin schema (state strings hyphenated to match the bridge map: `'awaiting-verify'`, `'dead-letter'`).

**`UploadQueueStoreTest.kt`** — Robolectric (`@Config(sdk = [33], application = Application::class)`, the canonical Phase-3/4 pattern). Covers: enqueue→read round-trip (incl. all optional fields + part lists); idempotent enqueue; practice-filter refusal via `taskId == "__practice__"`; practice-filter refusal via a `practice/` dir path; `bootstrap("userA")` returns only userA's rows (and userB's stay on disk); `bootstrap(null)` resumes nothing; corrupt-json reads as empty; the 8 MiB / 5 MiB chunk-size constants; `partsCountFor` (ceil, floor-to-1, a 200 MiB-on-cellular case → 40 parts); `markVerifiedAndDeleteLocal`; `remove`; `upsert`; `bootstrap` housekeeping (drops a `VERIFIED` row whose mp4 is gone).

## Verification

- `./gradlew :app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.upload.UploadQueueStoreTest'` — BUILD SUCCESSFUL
- `./gradlew :app:compileApkRolloutDebugKotlin` — BUILD SUCCESSFUL
- `./gradlew :app:assembleApkRolloutDebug -x lint` — BUILD SUCCESSFUL
- `npx tsc --noEmit` (apps/mobile) — exit 0
- `npx vitest run __tests__/manifests/` — 19 passed (the FGS bitmask lock still holds; the new perms don't trip it)
- `grep -rn 'cancel' .../upload/HumynUploadModule.kt` — no match (UP-11)
- `grep -n 'HumynUploadPackage' MainApplication.kt` — present
- `grep -n 'RUN_USER_INITIATED_JOBS|REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' AndroidManifest.xml` — both present

## Deviations from Plan

None — plan executed as written. The 2-MiB→5-MiB cellular-chunk-size reconciliation and the "land the `UploadJobService` `<service>` line here, class in 05-07" choice were both prescribed by the plan (and 05-RESEARCH.md Pitfall 2); they're recorded in the `decisions` frontmatter and in code comments, not deviations.

## Notes for Downstream Plans

- **Plan 05-06** (`ChunkUploader.kt` + `UploadCoordinator.kt`): consume `UploadQueueStore` (`read`/`upsert`/`remove`), `UploadModels` (`chunkBytesForNetwork`, `partsCountFor`, the `PartState` mutation), and `UploadControlState.isPaused()`. Call `HumynUploadModule.emitProgress(...)` for the `onUploadProgress` event (debounce to ≤ once/5s). `partsCount`/`chunkBytes` are pinned at init — don't re-layout on a network flip.
- **Plan 05-07** (`UploadJobService.kt` + FGS extension): the `<service .upload.UploadJobService>` manifest declaration already exists — only the class is missing. The `enqueue()` path already fires `HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE`; wire the `dataSync` `startForeground` transition there.
- **Plan 05-08** (`uploadReconcile.ts` + wire-up): the JS bridge exports `HumynUpload.getQueueSafe()` (boot-safe), `HumynUpload.clearVerified(ids)`, and the `onUploadQueueChanged`/`onUploadProgress` subscriptions. The `reupload` `@ReactMethod` is Plan 05-08's add. `enqueue()` already exists for the auto-enqueue wiring; `pause()`/`resume()` for the record-start/stop wiring; the `ownerUserId` arg is the logout-preserves-rows pivot (UP-13).

## Self-Check: PASSED

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadQueueStore.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt` — FOUND
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadPackage.kt` — FOUND
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadQueueStoreTest.kt` — FOUND
- `apps/mobile/src/native/HumynUpload.ts` — FOUND
- commits 19b98bc, 53d443f, de52332 — all in `git log`
