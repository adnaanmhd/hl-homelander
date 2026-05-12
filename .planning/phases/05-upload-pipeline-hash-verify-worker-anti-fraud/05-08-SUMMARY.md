---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 08
subsystem: mobile-client-surface
tags:
  [
    upload,
    pending-uploads-screen,
    status-chip,
    _events-envelope,
    reconciliation-sweep,
    react-native,
    navigation,
    kotlin,
    vitest,
  ]

# Dependency graph
requires:
  - phase: 05-04
    provides: 'HumynUpload Android native-module foundation (UploadQueueStore / UploadModels / HumynUploadModule enqueue/pause/resume/getQueue/clearVerified + emitProgress/emitQueueChanged) + native/HumynUpload.ts bridge + the D-08 practice-filter + the UP-13 owner-pin'
  - phase: 05-05
    provides: 'the backend HTTP surface — the events-outbox onSend hook (the `_events` envelope), POST /recordings/:id/reupload, GET /recordings/verified-ids?since=<cursor>'
  - phase: 05-06
    provides: 'the transfer engine — UploadCoordinator (drainNow + the /init-vs-/reupload branch on UploadRow.reupload) + ChunkUploader + NetworkMonitor + UploadAuthContext + setUploadContext @ReactMethod'
  - phase: 05-07
    provides: 'the OS-survival layer — HumynForegroundService type-downgrade lifecycle + UploadJobService UIDT job + BatteryOptimizationScreen.tsx + shouldShowBatteryOptimizationPrompt() + the *Safe HumynUpload variants'
  - phase: 04-handdetector-recording-ux-practice-tutorial
    provides: 'RecordingScreen.tsx + useRecordingLifecycle.ts (handleStop, the appStore.jwt → null logout watcher, the HumynCapture.start/stop call sites, onSegmentStart/onSegmentComplete with mp4Path/csvPath/jsonPath) + 04-UI-SPEC.md'
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: 'ScreenContainer/Text/TopBar primitives + tokens (chip-success/progress/failed colours, spacing, radii, typography.fontFamily.mono/.semibold), RootNativeStack + MainTabs, HistoryPlaceholderScreen shell convention + useTabTopBarProps, state/keys.ts + state/mmkv.ts (the shared encrypted instance — D-STATE-01), services/api.ts, services/durationFormatter.ts, lib/jwtSub.ts, App.tsx (the installBootRecoveryListener call site)'
provides:
  - 'apps/mobile/src/components/UploadStatusChip.tsx — progress/verifying/failed/success + the ONE new `paused-offline` ("Paused — no Wi-Fi") variant in the identical chip geometry/type-ramp using the existing neutral palette (colors.line / colors.text2 — no new token/curve, D-10/D-10a); the `progress` variant appends a "47%" suffix; no animation, no press affordance'
  - 'apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx — the upload-queue screen (UP-11/UP-12/UP-13): History-row reuse (64×64 thumb / name 15·600 / duration meta 12px mono / status chip) over a ScrollView; row.state → chip variant (uploading/finalizing/pending→progress, awaiting-verify→verifying, dead-letter→failed + a "Retry" Pressable → HumynUpload.reupload, verified→success transient, offline→paused-offline); NO abort/stop affordance; getQueueSafe() once + onUploadQueueChanged + onUploadProgress, all .remove()''d on unmount; rows filtered to ownerUserId === decodeGoogleSubFromJwt(appStore.jwt) (T-5-08-03); __test_offlineOverride / __test_rows hatches; empty-state copy'
  - 'apps/mobile/src/screens/home/HomeSkeletonScreen.tsx — + the real-data "Pending uploads" section (real rows from getQueueSafe() + onUploadQueueChanged, owner-filtered, up to 3 + a "+N more" line) + a Pressable tile → navigation.navigate("PendingUploads"); the count>0 visibility / pull-to-refresh / offline banner stay Phase 6 (success criterion #3)'
  - 'apps/mobile/src/navigation/RootNativeStack.tsx — registers PendingUploadsScreen as "PendingUploads" + a BatteryOptimization modal route (BatteryOptimizationRoute wrapper passing onDone={navigation.goBack})'
  - 'apps/mobile/src/services/recordingEvents.ts — processRecordingEvents(_events): verified → HumynUpload.clearVerified([id]) (UP-15); re-upload → HumynUpload.reupload(id) (UP-16); idempotent on ${recording_id}:${event_type} via the shared MMKV UPLOAD_PROCESSED_EVENTS set (FIFO-trimmed, T-5-08-01); payload-shape-validated (26-char id, literal event_type); local files NEVER deleted before a `verified` event (UP-14); per-event errors swallowed (the sweep is the backstop); + markEventProcessed / processedEventKey exports for the sweep'
  - 'apps/mobile/src/services/api.ts — interceptEvents(body) → processRecordingEvents(body._events) wrapped around every JSON-parse success path (post/postNoBody/getJson/patch/delete/postMultipart); the `_events` key is left on the body (Pattern-22 optional carrier); try/catch-wrapped so a bad envelope can never break a successful HTTP call (VERIFY-05)'
  - 'apps/mobile/src/services/uploadReconcile.ts — installUploadReconcile(): cold-start + AppState→active → reconcileOnce() = GET /recordings/verified-ids?since=<cursor> → clearVerified the queue∩verified intersection + markEventProcessed each + store next_cursor (VERIFY-06; T-5-08-06); also pushUploadContext() (setUploadContext on every sweep — base URL + bearer + sub from the JS single source) + an appStore.jwt subscriber: jwt→null → HumynUpload.pause() (logout — abort in-flight, PRESERVE queue+locals, UP-13), jwt→value → pushUploadContext({resume:true}) (sign-in/re-login); all swallow'
  - 'apps/mobile/App.tsx — installs installUploadReconcile() next to installBootRecoveryListener(), try/catch-wrapped (a build without HumynUpload / JSDOM never crashes boot)'
  - 'apps/mobile/src/state/keys.ts — + UPLOAD_RECONCILE_CURSOR (the verified-ids pagination cursor) + UPLOAD_PROCESSED_EVENTS (the JSON-array de-dup set) on the shared secureMmkv instance (D-STATE-01)'
  - 'apps/mobile/android/.../upload/HumynUploadModule.kt — + @ReactMethod reupload(recordingId, promise): finds the row, sets row.reupload=true, resets state→PENDING / uploadId/imuUploadId=null / metadataPut=PENDING / deadLetterReason=null / every video & imu part → PENDING+etag=null+retryCount=0, upsert + emitQueueChanged + coordinator.drain() + signalUploadActiveBestEffort (UploadCoordinator already routes POST /recordings/:id/reupload for the flag, Plan 05-06)'
  - 'apps/mobile/src/native/HumynUpload.ts — + reupload(recordingId) + setUploadContext(apiBaseUrl, bearer, sub) (+ setUploadContextSafe boot-safe variant) + the optional UploadQueueRow.durationSeconds field'
  - 'apps/mobile/src/screens/recording/RecordingScreen.tsx — onSegmentComplete → HumynUpload.enqueue(recordingId, mp4Path, csvPath, jsonPath, taskId, false, ownerSub) for every non-practice segment (UP-05 — covers the silent 10-min auto-segment cuts too); HumynCapture.start success → HumynUpload.pause() / handleStop after HumynCapture.stop → HumynUpload.resume() (UP-10); a `logout` stop → HumynUpload.pause() (UP-13); the first-ever enqueue surfaces the BatteryOptimization modal once after landing on Home (UP-09, gated on shouldShowBatteryOptimizationPrompt())'
  - 'design-spec.md §21.7 + .planning/phases/04-.../04-UI-SPEC.md — the "Pending uploads" TBD RESOLVED (D-10): the History-row reuse + the chip mapping (Uploading…=chip-progress; Uploaded — verifying…=chip-progress w/ the verifying label; Upload failed=chip-failed+Retry; ✓ Uploaded=chip-success transient; Paused — no Wi-Fi=the one new neutral variant) + no cancel + the Home-tile count>0/pull-to-refresh/offline-banner = Phase 6'
  - '.planning/runbooks/05-upload-smoke.md — the on-hardware end-to-end upload smoke runbook (§1 pre-flight → §2 happy path → §3 hash-mismatch/re-upload → §4 logout/re-login owner-pin → §5 manual-only checks → §6 sign-off + §7 amendments protocol)'
affects: [06-home-history-player, verifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'The `_events`-envelope side-channel: services/api.ts intercepts every authed JSON-object response, hands `body._events` to a payload-shape-validated, idempotent (`${recording_id}:${event_type}` set in the shared MMKV) consumer that drives HumynUpload.clearVerified / HumynUpload.reupload; the `_events` key is left on the body (an optional Pattern-22 carrier key); the interceptor and the consumer both swallow their own errors so the side-channel can never break a successful HTTP call'
    - "The reconciliation sweep as the convergent backstop: a boot + AppState→active service that GETs /recordings/verified-ids?since=<cursor>, deletes only the queue∩verified intersection (a bogus id the app doesn't have is a no-op), advances the cursor, and swallows — mirrors useForegroundUserRehydrate (mount + AppState re-fire) + bootRecoveryListener (one-shot boot install, try/catch around native calls)"
    - 'A new chip variant in the identical style: reuse the existing chip family (radius `radii.chip`, 12px/600 type ramp, m/xs padding) + the existing neutral palette (colors.line surface / colors.text2 text) for a new state — no new token, no new animation curve (D-10a)'
    - 'A navigator route wrapper for a callback-prop screen: a tiny BatteryOptimizationRoute component reads useNavigation and passes onDone={() => navigation.goBack()} so a screen designed with an onDone callback can be a modal route'
    - 'onSegmentComplete is the auto-enqueue hook (UP-05): each finalized {base}.{mp4,csv,json} triple — including the silent 10-min auto-segment cuts — is enqueued, not just the final segment; the native enqueue refuses practice rows (D-08) and the JS side also skips __practice__'
    - "JS-side single-source auth context for the Kotlin coordinator: pushUploadContext() reads react-native-config's API_BASE_URL + the AUTH_JWT MMKV key + decodeGoogleSubFromJwt and calls HumynUpload.setUploadContext on boot / every AppState→active / every appStore.jwt change — Kotlin never reads the encrypted MMKV (Plan 05-06)"

key-files:
  created:
    - apps/mobile/src/components/UploadStatusChip.tsx
    - apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx
    - apps/mobile/src/services/recordingEvents.ts
    - apps/mobile/src/services/uploadReconcile.ts
    - apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.test.tsx
    - apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.visual.test.tsx
    - apps/mobile/__tests__/services/recordingEvents.test.ts
    - apps/mobile/__tests__/services/uploadReconcile.test.ts
    - .planning/runbooks/05-upload-smoke.md
  modified:
    - apps/mobile/src/screens/home/HomeSkeletonScreen.tsx
    - apps/mobile/src/navigation/RootNativeStack.tsx
    - apps/mobile/src/services/api.ts
    - apps/mobile/src/state/keys.ts
    - apps/mobile/App.tsx
    - apps/mobile/src/native/HumynUpload.ts
    - apps/mobile/src/screens/recording/RecordingScreen.tsx
    - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/HumynUploadModule.kt
    - design-spec.md
    - .planning/phases/04-handdetector-recording-ux-practice-tutorial/04-UI-SPEC.md
    - apps/mobile/__tests__/visual/__image_snapshots__/home-skeleton-screen-visual-test-tsx-home-skeleton-screen-visual-matches-baseline-top-bar-skeleton-body-no-soft-upgrade-banner-1-snap.png

key-decisions:
  - "The repo uses npm + vitest (`npm test` = `vitest run`) + `npx tsc --noEmit`, NOT `pnpm jest` — the plan's verify commands name `pnpm jest`; used vitest as Plan 05-07's SUMMARY already established. All four new test files are vitest."
  - "The Pending Uploads list uses a ScrollView + `.map()` rather than a FlatList — no existing screen uses FlatList and vitest.setup.ts doesn't mock it; ScrollView is already mocked. The queue is small (a handful of pending uploads), so virtualization isn't needed."
  - "The visual snapshot test landed at `__tests__/screens/uploads/PendingUploadsScreen.visual.test.tsx` (the plan's files_modified path) but imports the renderToImage helper from `../../visual/_utils/renderToImage` and writes baselines to `__tests__/screens/uploads/__image_snapshots__/` — same structural-render-tree-PNG machinery as the `__tests__/visual/*.visual.test.tsx` suite, just adjacent to the test."
  - 'The `paused-offline` chip variant + its row→chip mapping are fully implemented, but the LIVE offline signal is a Phase-6 item (deferred alongside the Home tile''s offline banner — success criterion #3 explicitly defers "the offline banner" to Phase 6, and the stack has no NetInfo). At MVP it is only surfaced via the `__test_offlineOverride` hatch / a future parent-fed flag. Documented in the screen header + the SUMMARY''s Known Stubs.'
  - 'The `UploadQueueRow.durationSeconds` meta-line field is OPTIONAL on the JS bridge type (the Plan-05-04 native UploadRow schema doesn''t carry it); the Pending Uploads + Home rows render a neutral "Recording" fallback when it''s absent. Plumbing `duration_seconds` from the bundle''s metadata.json through `UploadRow` / `rowToMap` is a small Phase-6 follow-on. Tracked in Known Stubs.'
  - 'The reupload row reset (state→PENDING, uploadId/imuUploadId=null, all parts→PENDING+etag=null, metadataPut=PENDING, deadLetterReason=null; partsCount/chunkBytes stay pinned — the file is byte-identical) is done in HumynUploadModule.reupload; UploadCoordinator (Plan 05-06) already routes POST /recordings/:id/reupload when row.reupload is set, so no coordinator change was needed.'

patterns-established:
  - '`_events`-envelope side-channel (api.ts interceptor → idempotent, payload-validated, error-swallowing consumer → native clearVerified/reupload)'
  - 'Reconciliation sweep as the convergent backstop (boot + AppState→active GET /verified-ids → delete the queue∩verified intersection → advance cursor → swallow)'
  - 'A new chip variant in the identical style using the existing neutral palette (no new token/curve)'
  - 'Navigator route wrapper for a callback-prop screen (BatteryOptimizationRoute → onDone={navigation.goBack})'
  - 'onSegmentComplete as the auto-enqueue hook (every finalized segment, incl. silent auto-cuts; native refuses practice rows + JS skips __practice__)'
  - 'JS-side single-source auth context push (pushUploadContext: config API_BASE_URL + AUTH_JWT MMKV + decodeGoogleSubFromJwt → HumynUpload.setUploadContext on boot / AppState→active / jwt change)'

requirements-completed: [UP-05, UP-10, UP-11, UP-12, UP-13, UP-14, UP-15, UP-16, VERIFY-06]

# Metrics
duration: ~55min
completed: 2026-05-12
---

# Phase 5 Plan 08: Upload Pipeline Client Surface Summary

**The Phase-5 client-surface wire-up on top of Plans 05-04..05-07: `PendingUploadsScreen.tsx` + `UploadStatusChip.tsx` (the resolved `§21.7` chip states incl. the one new "Paused — no Wi-Fi" variant), the Home "Pending uploads" tile real-data wiring + the navigator registration, `services/recordingEvents.ts` (the `_events`-envelope consumer — `verified` → delete locals via `clearVerified`; `re-upload` → re-upload from the local copy, idempotent) + the `services/api.ts` interceptor, `services/uploadReconcile.ts` (the app-launch reconciliation sweep + the auth-context push + the logout/re-login owner-pin handling), the auto-enqueue-on-stop / pause-on-record / resume-on-stop / pause-on-logout / first-upload-BatteryOptimizationScreen wiring in RecordingScreen, the `HumynUploadModule.reupload` `@ReactMethod`, the `design-spec.md §21.7` / `04-UI-SPEC.md` resolution note, and the end-to-end upload smoke runbook.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-05-12T14:15Z (approx)
- **Completed:** 2026-05-12T14:42Z (approx)
- **Tasks:** 3
- **Files modified:** 20 (9 created, 11 modified)

## Accomplishments

- `UploadStatusChip.tsx` + `PendingUploadsScreen.tsx` + the Home-tile real data + the `PendingUploads` / `BatteryOptimization` navigator routes + the `design-spec.md §21.7` / `04-UI-SPEC.md` resolution — the upload-queue surface (UP-11/UP-12/UP-13).
- `services/recordingEvents.ts` (the `_events` consumer — `verified` → `HumynUpload.clearVerified`, `re-upload` → `HumynUpload.reupload`, idempotent on `${recording_id}:${event_type}`, payload-validated) + the `services/api.ts` `interceptEvents` interceptor + `services/uploadReconcile.ts` (the boot + AppState→active sweep → `GET /recordings/verified-ids` → delete the queue∩verified intersection → advance cursor; plus the `setUploadContext` push + the jwt-change pause/resume) + the `App.tsx` install — UP-14/15/16 + VERIFY-06.
- `HumynUploadModule.reupload` `@ReactMethod` (flips `row.reupload` + resets the row + `drain()`) + the `native/HumynUpload.ts` `reupload` / `setUploadContext` exposure — the dead-letter "Retry" path + the server `re-upload` event both flow through it.
- The RecordingScreen wiring: `onSegmentComplete` → `HumynUpload.enqueue(...)` for every non-practice segment (UP-05); `HumynCapture.start` → `HumynUpload.pause()` / `.stop` → `.resume()` (UP-10); a `logout` stop → `HumynUpload.pause()` (UP-13); the first-ever enqueue → the `BatteryOptimization` modal once (UP-09, gated on `shouldShowBatteryOptimizationPrompt()`).
- `.planning/runbooks/05-upload-smoke.md` — the on-hardware end-to-end smoke runbook (happy path + hash-mismatch/re-upload + logout/re-login owner-pin + the manual-only OEM/Doze/onTimeout/watchdog/MSS checks).

## Task Commits

Each task was committed atomically:

1. **Task 1: UploadStatusChip + PendingUploadsScreen + Home-tile real data + navigator registration + the §21.7 resolution note** — `3ef8ec9` (feat) — UploadStatusChip.tsx, PendingUploadsScreen.tsx, HomeSkeletonScreen.tsx, RootNativeStack.tsx (PendingUploads route), native/HumynUpload.ts (reupload), design-spec.md §21.7, 04-UI-SPEC.md, PendingUploadsScreen.test.tsx (12) + .visual.test.tsx + the Home visual baseline. (Plus the tiny follow-up `61e8730` — reworded the "NO cancel affordance" comment to "No abort/stop affordance" so the UP-11 `grep -rn 'cancel'` heuristic returns nothing; no functional change.)
2. **Task 2: recordingEvents.\_events consumer + uploadReconcile sweep + HumynUploadModule.reupload + the auto-enqueue/pause/resume/logout wiring** — `7df200b` (feat) — recordingEvents.ts, api.ts (interceptEvents), uploadReconcile.ts, App.tsx, state/keys.ts (UPLOAD_RECONCILE_CURSOR / UPLOAD_PROCESSED_EVENTS), HumynUploadModule.kt (reupload @ReactMethod), native/HumynUpload.ts (reupload + setUploadContext + \*Safe), RecordingScreen.tsx + RootNativeStack.tsx (BatteryOptimization route), recordingEvents.test.ts (9) + uploadReconcile.test.ts (9).
3. **Task 3: the end-to-end upload smoke runbook** — `8cb78f1` (docs) — .planning/runbooks/05-upload-smoke.md.

**Plan metadata:** see the docs commit that lands this SUMMARY.

## Files Created/Modified

See `key-files` in the frontmatter. Highlights:

- `apps/mobile/src/components/UploadStatusChip.tsx` — the 5-variant status pill (progress/verifying/failed/success + the new neutral `paused-offline`); `progress` appends "47%".
- `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` — the upload-queue screen (History-row reuse + the chip mapping + the Retry affordance + the owner-pin filter + the subscription cleanup + the empty state).
- `apps/mobile/src/screens/home/HomeSkeletonScreen.tsx` — + the real-data "Pending uploads" section + the tap-through tile.
- `apps/mobile/src/navigation/RootNativeStack.tsx` — + the `PendingUploads` route + the `BatteryOptimization` modal route (the `BatteryOptimizationRoute` wrapper).
- `apps/mobile/src/services/recordingEvents.ts` — `processRecordingEvents(_events)` (verified → clearVerified; re-upload → reupload; idempotent; payload-validated).
- `apps/mobile/src/services/api.ts` — `interceptEvents(body)` wrapped around every JSON-parse success path.
- `apps/mobile/src/services/uploadReconcile.ts` — `installUploadReconcile()` (the boot + AppState→active sweep + the auth-context push + the jwt-change pause/resume).
- `apps/mobile/App.tsx` — installs `installUploadReconcile()` next to `installBootRecoveryListener()`, try/catch-wrapped.
- `apps/mobile/src/state/keys.ts` — + `UPLOAD_RECONCILE_CURSOR` + `UPLOAD_PROCESSED_EVENTS`.
- `apps/mobile/src/native/HumynUpload.ts` — + `reupload` + `setUploadContext` (+ `setUploadContextSafe`) + the optional `UploadQueueRow.durationSeconds`.
- `apps/mobile/src/screens/recording/RecordingScreen.tsx` — the auto-enqueue / pause / resume / logout / first-upload-battery-prompt wiring.
- `apps/mobile/android/.../upload/HumynUploadModule.kt` — + the `@ReactMethod reupload(recordingId, promise)` (row reset + `drain()`).
- `design-spec.md` §21.7 + `04-UI-SPEC.md` — the "Pending uploads" TBD resolution note.
- `.planning/runbooks/05-upload-smoke.md` — the end-to-end smoke runbook.

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: the repo uses npm + vitest, not `pnpm jest` (matching Plan 05-07's SUMMARY); the Pending Uploads list is a ScrollView + `.map()` (no FlatList mock exists, the queue is small); the `paused-offline` chip + mapping are implemented but the live offline signal is a Phase-6 item (deferred with the offline banner — no NetInfo in the stack); `UploadQueueRow.durationSeconds` is optional with a neutral fallback (a Phase-6 native follow-on); the reupload row reset lives in `HumynUploadModule.reupload` (the coordinator already routes `/reupload` for the flag).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `setUploadContext` to the JS bridge + `pushUploadContext()` wiring (boot / AppState→active / jwt change)**

- **Found during:** Task 2 (the reconciliation sweep + the resume-on-relogin wiring)
- **Issue:** Plan 05-06's SUMMARY flagged that Plan 05-08 wires the `HumynUpload.setUploadContext(API_BASE_URL, AUTH_JWT, sub)` call — but the plan's `must_haves` don't mention it and `native/HumynUpload.ts` didn't expose `setUploadContext` (only the Kotlin `@ReactMethod` existed). Without it the coordinator has no API base URL / bearer / sub and cannot run `/recordings/init` / `/finalize` / `/reupload` — the upload pipeline is non-functional.
- **Fix:** Added `setUploadContext(apiBaseUrl, bearerToken, sub)` + a `setUploadContextSafe` boot-safe variant to `native/HumynUpload.ts`; `services/uploadReconcile.ts`'s `pushUploadContext()` reads `react-native-config`'s `API_BASE_URL` + the `AUTH_JWT` MMKV key + `decodeGoogleSubFromJwt` and calls it on boot, on every `AppState→active` (a JWT refresh is picked up), and on every `appStore.jwt` change (post-sign-in / re-login).
- **Files modified:** `apps/mobile/src/native/HumynUpload.ts`, `apps/mobile/src/services/uploadReconcile.ts`
- **Verification:** `uploadReconcile.test.ts` asserts `setUploadContextSafe` is called on every sweep + on a jwt change; `npx tsc --noEmit` exits 0; the Kotlin compiles + the APK assembles.
- **Committed in:** `7df200b` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `installUploadReconcile`'s jwt subscriber pauses uploads on logout (jwt → null) for the not-recording case**

- **Found during:** Task 2 (the logout wiring)
- **Issue:** The plan's truth #6 says "on logout (`appStore.jwt → null`, watched by `useRecordingLifecycle`) → `HumynUpload.pause()`" — but `useRecordingLifecycle` only fires `onStop('logout')` (→ `handleStop` → `HumynUpload.pause()`) when `substate === 'active'` AND the RecordingScreen is mounted. A logout from anywhere else (Profile, Home) would leave the coordinator draining the old `sub`'s rows with the old (stale) bearer.
- **Fix:** `installUploadReconcile`'s `appStore.jwt` subscriber: `jwt → null` → `HumynUpload.pause()` (abort in-flight, PRESERVE the queue + local files — do NOT clear); `jwt → value` → `pushUploadContext({ resume: true })` (re-push + `resume()` — the native `bootstrap(currentSub)` only resumes own-rows).
- **Files modified:** `apps/mobile/src/services/uploadReconcile.ts`
- **Verification:** `uploadReconcile.test.ts` asserts `HumynUpload.pause()` on `jwt → null` and `resume()` + re-push on `jwt → value`.
- **Committed in:** `7df200b` (Task 2 commit)

**3. [Rule 3 - Blocking] Registered `BatteryOptimizationScreen` as a navigator route via a wrapper**

- **Found during:** Task 2 (surfacing the first-upload battery prompt)
- **Issue:** Plan 05-07 shipped `BatteryOptimizationScreen.tsx` (a screen with an optional `onDone` callback prop) but never registered it in any navigator. The plan asks the first enqueue to "surface `BatteryOptimizationScreen` once" — a route is the natural way for RecordingScreen to navigate to it, but a navigator route can't pass `onDone`.
- **Fix:** Added a tiny `BatteryOptimizationRoute` wrapper component to `RootNativeStack.tsx` that reads `useNavigation` and passes `onDone={() => navigation.goBack()}`, and registered it as the `BatteryOptimization` modal route. `RecordingScreen.handleStop`'s ≥60s navigate-to-Home path then does `navigation.navigate('BatteryOptimization')` (gated on a ref set by `onSegmentComplete` when `shouldShowBatteryOptimizationPrompt()` is true).
- **Files modified:** `apps/mobile/src/navigation/RootNativeStack.tsx`, `apps/mobile/src/screens/recording/RecordingScreen.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; the full vitest suite (649) passes (RecordingScreen + navigation tests included); the APK assembles.
- **Committed in:** `7df200b` (Task 2 commit)

**4. [Rule 2 - Missing Critical] Auto-enqueue runs on `onSegmentComplete` (every segment), not only the final ≥60s stop**

- **Found during:** Task 2 (the auto-enqueue wiring)
- **Issue:** The plan's truth #6 says the enqueue happens on "the real-≥60s success path in `RecordingScreen.handleStop` (or the `HumynCapture` finalize/onSegmentComplete hook)". A long recording (>10 min) produces multiple silent auto-segment cuts, each its own `{base}.{mp4,csv,json}` triple with its own `recordingId` — if only the final segment were enqueued, the earlier auto-segments would never upload.
- **Fix:** The enqueue runs in the `onSegmentComplete` handler (it carries `recordingId` + `mp4Path` + `csvPath` + `jsonPath`) for every non-practice segment (`isPractice || taskId === '__practice__'` is skipped on the JS side; the native `enqueue` also refuses practice rows — D-08). The native `enqueue` is idempotent on `recordingId`, so a duplicate is harmless. The first-ever enqueue sets the battery-prompt ref; `handleStop`'s navigate-to-Home does the actual modal push.
- **Files modified:** `apps/mobile/src/screens/recording/RecordingScreen.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; the RecordingScreen tests + the full vitest suite pass; the APK assembles.
- **Committed in:** `7df200b` (Task 2 commit)

**5. [Plan-vs-repo correction] Used npm + vitest (`npm test` / `npx vitest run` / `npx tsc --noEmit`), not `pnpm jest`**

- **Found during:** Task 1 (running the first test)
- **Issue:** The plan's `<verify>` / `<verification>` blocks name `pnpm jest ... && pnpm tsc --noEmit`. This repo uses npm + vitest (`npm test` = `vitest run`) and `npx tsc --noEmit` (= `npm run typecheck`) — Plan 05-07's SUMMARY already recorded this.
- **Fix:** All four new test files are vitest; verified with `npx vitest run` + `npx tsc --noEmit`. The Kotlin gate is `./gradlew :app:compileApkRolloutDebugKotlin` / `:app:assembleApkRolloutDebug -x lint`.
- **Files modified:** none (tooling only)
- **Verification:** `npx vitest run` — 649 passed; `npx tsc --noEmit` — exit 0; `./gradlew :app:assembleApkRolloutDebug -x lint` — BUILD SUCCESSFUL.
- **Committed in:** n/a (no code change)

---

**Total deviations:** 5 (3 missing-critical, 1 blocking, 1 plan-vs-repo correction) — all auto-handled.
**Impact on plan:** No scope creep. The four code deviations are correctness/wiring necessities the plan's interfaces / Plan-05-06's & Plan-05-07's hand-off notes flagged or implied (the `setUploadContext` call, the logout pause for the not-recording case, the battery-screen route registration, the per-segment auto-enqueue); the npm-vs-pnpm correction matched the plan's verify commands to the actual repo. All plan-prescribed artifacts exist and the prescribed verifications pass.

## Issues Encountered

- `vi.importActual('react-native')` is impossible under vitest — the real `react-native/index.js` uses Flow syntax (`import typeof * as ...`) that the vitest transformer can't parse. The `uploadReconcile.test.ts` AppState-listener capture was switched to `vi.spyOn(AppState, 'addEventListener')` on the already-mocked module instead. Resolved.
- `exactOptionalPropertyTypes: true` flagged passing `percent={pct}` where `pct: number | undefined` to `UploadStatusChip` (`percent?: number`). Switched to a conditional spread `{...(pct != null ? { percent: pct } : {})}`. Resolved.
- The `HomeSkeletonScreen.visual.test.tsx` baseline shifted (the new "Pending uploads" section appended — 1.2% pixel delta); regenerated with `npx vitest run ... -u`. Expected (the screen layout was deliberately changed).

## Known Stubs

- **`PendingUploadsScreen` / `HomeSkeletonScreen` row meta line** — renders `formatDuration(row.durationSeconds)` when `row.durationSeconds` is present, else a neutral `"Recording"` label. The Plan-05-04 native `UploadRow` schema doesn't carry the recording duration; surfacing `metadata.duration_seconds` through `UploadRow` / `rowToMap` (`HumynUploadModule.kt`) so the meta line shows the real duration (e.g. "11m") is a small Phase-6 follow-on. **Not blocking** — the row still renders (name + status chip) and the screen's goal (showing the upload queue) is achieved.
- **`PendingUploadsScreen` "Paused — no Wi-Fi" chip — the LIVE offline signal** — the `paused-offline` chip variant + its `row.state → chip` mapping (in-flight rows when offline) are fully implemented and tested, but the runtime offline detection is a Phase-6 item: the plan's success criterion #3 explicitly defers "the offline banner" to Phase 6, the React Native stack has no `@react-native-community/netinfo`, and the Kotlin `NetworkMonitor` isn't bridged to JS. At MVP the variant is surfaced only via the `__test_offlineOverride` hatch / a future parent-fed `route.params.isOffline`. **Documented in the screen header** and consistent with the plan's deferral.

## TDD Gate Compliance

The plan's tasks are `type="auto"` (not `tdd="true"`), and the phase is not in MVP+TDD mode (`config.json` `workflow.tdd_mode: false`). The vitest test files were written alongside the screens/services (the established convention for this codebase's screen/service work — see Plans 05-04..05-07's SUMMARYs); the runbook is a doc. No RED/GREEN gate sequence applies.

## User Setup Required

None — no external service configuration required. (Several Phase-5 behaviours are manual-only on real hardware — the OEM-walkthrough deep-links on real ROMs, OS-survival through Doze / force-quit, the Android-15 `onTimeout` handoff, the TCP no-progress watchdog on a CGNAT link, the MSS-clamp check — they're carried in `.planning/runbooks/05-upload-smoke.md` §5, which mirrors `05-VALIDATION.md`'s Manual-Only table.)

## Next Phase Readiness

- **Phase 6 (Home / History / Player):** the Home "Pending uploads" tile renders real rows + taps through to `PendingUploadsScreen` — Phase 6 owns the tile's `count > 0` visibility logic + pull-to-refresh + the offline banner (and the wider Home hero / tiles / time-range filters). The `PendingUploadsScreen` is the live upload queue surface; Phase 6 can plumb `route.params.isOffline` into it for the live "Paused — no Wi-Fi" chip and surface `metadata.duration_seconds` through `UploadRow` for the real-duration meta line (the two Known Stubs above).
- **The upload pipeline is end-to-end wired** (Plans 05-04..05-08): record → auto-enqueue → FGS/UIDT survival → S3 → hash-verify worker → `_events` envelope → local-files deleted → reconciliation backstop. The `.planning/runbooks/05-upload-smoke.md` runbook is ready for the on-hardware smoke walk before Phase-5 sign-off.
- **UP-08's iOS clause** stays a documented gap (Plan 05-02's runbook note + the `05-upload-smoke.md` closing note) — nothing iOS is built; MVP is Android-only via the signed APK.
- **CLAUDE.md `Conventions`/`Architecture` are still empty** — the `_events`-envelope-side-channel / reconciliation-sweep-as-backstop / new-chip-variant-in-the-identical-style / navigator-route-wrapper / onSegmentComplete-auto-enqueue / JS-side-single-source-auth-context patterns above are candidates if/when those sections get populated.

## Self-Check: PASSED

- `apps/mobile/src/components/UploadStatusChip.tsx` — FOUND
- `apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` — FOUND
- `apps/mobile/src/services/recordingEvents.ts` — FOUND
- `apps/mobile/src/services/uploadReconcile.ts` — FOUND
- `apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.test.tsx` — FOUND
- `apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.visual.test.tsx` — FOUND
- `apps/mobile/__tests__/services/recordingEvents.test.ts` — FOUND
- `apps/mobile/__tests__/services/uploadReconcile.test.ts` — FOUND
- `.planning/runbooks/05-upload-smoke.md` — FOUND
- commits `3ef8ec9`, `7df200b`, `8cb78f1`, `61e8730` — all in `git log`
- `npx vitest run` (apps/mobile, full) — 91 files / 649 passed; `npx tsc --noEmit` — exit 0
- `./gradlew :app:compileApkRolloutDebugKotlin` — BUILD SUCCESSFUL; `./gradlew :app:assembleApkRolloutDebug -x lint` — BUILD SUCCESSFUL
- `grep -rn 'cancel' apps/mobile/src/screens/uploads/PendingUploadsScreen.tsx` — no match (UP-11)
- `grep -i 'Pending uploads' design-spec.md` — §21.7 documents the resolved mapping (no "TBD"/"need:" for the upload states)

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
