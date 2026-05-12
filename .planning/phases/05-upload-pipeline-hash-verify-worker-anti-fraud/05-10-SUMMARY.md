---
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
plan: 10
subsystem: upload
tags:
  [
    android,
    kotlin,
    upload-coordinator,
    s3-multipart,
    re-presign,
    idempotency,
    robolectric,
    mockwebserver,
  ]

# Dependency graph
requires:
  - phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
    provides: 'POST /recordings/:id/parts re-presign route + idempotent POST /recordings/init (Plan 05-09); UploadCoordinator.drainNow() serialised by a ReentrantLock (Plan 05-11); UploadCoordinator /init→PUT→/finalize flow + UploadQueueStore + the FGS/UIDT-job drain callers (Plans 05-04/05-06/05-07); reupload @ReactMethod that resets parts to PENDING + drops cached ETags (Plan 05-08)'
provides:
  - "UploadCoordinator.uploadOne() picks the init route via a 3-way when: row.reupload → POST /recordings/:id/reupload (fresh ids); row.uploadId != null → POST /recordings/:id/parts (re-presign against the EXISTING video+IMU multipart uploads — preserves already-DONE parts' ETags, UP-04); else → POST /recordings/init (idempotent since Plan 05-09 — a lost 201 self-heals)"
  - 'row.reupload is cleared (queueStore.upsert) IMMEDIATELY after postReupload returns + the fresh ids are persisted — so a re-drain of a process-killed re-upload takes the /parts branch (no second /reupload → no orphaned ETags — CR-01 on the re-upload path, WARNING 4)'
  - 'postRePresign maps 404/409 from /recordings/:id/parts → DeadLetterException; postInit maps 409/403 from /recordings/init → DeadLetterException — a stuck row dead-letters instead of spinning forever (T-5-10-02). A 5xx / network error stays transient (the next drain retries).'
  - 'parseInitResponse(text, label) — single response parser for /init | /reupload | /parts (identical shape); on org.json.JSONException it re-throws IOException("<label> response not valid JSON") carrying ONLY the static label, never the body — no presigned-URL leak into the transient-error log (WR-06 / T-5-10-01)'
  - 'Robolectric/MockWebServer coverage in UploadCoordinatorTest.kt: re-drain hits /parts not /init + DONE part not re-PUT + uploadId unchanged; a re-upload drain clears reupload then a re-drain uses /parts not /reupload; 409 from /parts and /init → DEAD_LETTER (no loop); a non-JSON /parts body → transient + the exception message contains no http/X-Amz/<html'
affects: [upload-pipeline, force-quit-recovery-smoke, 05-VERIFICATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Choose the init route on a per-drain basis: re-upload marker first → mint-fresh-ids route; else if the row already has an upload-id → re-presign-only route (preserves DONE parts' ETags); else → the create route. The create route being idempotent (a re-call returns the same id) makes a lost-201 self-heal; the re-upload marker being cleared right after the mint means no drain after the first re-upload drain mints again."
    - "Static-label-only exception messages on a parser of a body that may contain secrets: catch the JSON-parse exception (whose message embeds a body snippet) and re-throw a body-free exception carrying only a static label — the caller's catch-and-log path can never leak the body."
    - 'Reflective unit-call of a private parser in a Robolectric test (getDeclaredMethod + isAccessible) to assert the exact exception message on a leaky non-JSON body — keeps the assertion precise without widening the production surface.'

key-files:
  created: []
  modified:
    - 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt — uploadOne: wasReupload captured before the when; 3-way when (row.reupload → postReupload / row.uploadId != null → postRePresign / else → postInit); row.reupload = false + queueStore.upsert(row) right after when when wasReupload; new postRePresign (POST /recordings/:id/parts; 404/409 → DeadLetterException); postInit gains a 409/403 → DeadLetterException mapping; parseInitResponse(text, label) wrapped in try/catch(JSONException) → IOException("$label response not valid JSON"); postReupload + postInit call-sites pass a label; class KDoc step 1 updated to describe the 3-way route choice'
    - 'apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt — dispatcher gains a /recordings/:id/parts branch + partsCalls counter + lastPartsBody + initResponseCode / partsResponseCode / partsRawBody override seams; initBody(partsCount, uploadId, imuUploadId); 5 new tests (reDrain uses parts route not init; reupload drain clears the reupload flag then a re-drain uses parts not reupload; a 409 from the parts route dead-letters; a 409 from the init route dead-letters; a non-JSON parts response does not leak presigned URLs and is treated as transient)'

key-decisions:
  - 'The /parts branch is gated on `row.uploadId != null` (not on a separate flag): once /init (or /reupload) has returned and the ids are persisted, every subsequent drain re-presigns against those ids. The first-ever drain (uploadId == null) hits /init — which is idempotent since Plan 05-09, so even a lost-201-then-re-/init self-heals (the server returns the same uploadId).'
  - "row.reupload is checked FIRST in the when (before `row.uploadId != null`) and is cleared the instant the fresh /reupload ids are persisted — so the FIRST drain of a hash-mismatch re-upload hits /reupload (the reupload @ReactMethod already reset every part to PENDING + dropped the cached ETags — Plan 05-08, so the fresh ids are correct), and EVERY drain after that hits /parts (re-presign against those ids → preserves any re-upload parts that have already landed). The redundant `row.reupload = false` in uploadOne's success tail is left as-is (harmless, and clearer for the non-re-upload row)."
  - "403 from /init is mapped to DeadLetterException alongside 409 (per the plan's 'prefer adding it') — a wrong-owner /init is extremely unlikely from this client but if it ever happens it's non-retryable, so dead-letter instead of looping via IOException."
  - 'The non-JSON-leak test asserts via a reflective unit-call of `parseInitResponse(text, label)` (getDeclaredMethod / isAccessible) — the message assertion is exact (`/recordings/:id/parts response not valid JSON`, no `http` / `X-Amz` / `<html`) and no @VisibleForTesting accessor was added to the production class.'

patterns-established:
  - 'Per-drain init-route selection in UploadCoordinator.uploadOne (reupload-marker → mint / has-upload-id → re-presign / else → create)'
  - 'Body-free static-label exception messages on a parser of a secret-bearing body'

requirements-completed: [UP-01, UP-04]

# Metrics
duration: ~20min (excluding the cold first build — npm ci + a cold assembleApkRolloutDebug + the root pnpm install for the pre-commit hook)
completed: 2026-05-12
---

# Phase 5 Plan 10: mobile UploadCoordinator re-drain re-presign (CR-01 + WARNING-4 gap closure) Summary

**`UploadCoordinator.uploadOne()` now picks its init route per-drain — `row.reupload` → `POST /recordings/:id/reupload`, else `row.uploadId != null` → `POST /recordings/:id/parts` (Plan 05-09's re-presign route, preserving already-DONE parts' ETags), else `POST /recordings/init` (idempotent since Plan 05-09) — and clears `row.reupload` the instant the fresh `/reupload` ids land so a re-drain of a process-killed re-upload also takes the `/parts` branch; `409`/`404` from `/parts` and `409`/`403` from `/init` dead-letter instead of spinning; `parseInitResponse` no longer leaks presigned URLs on a non-JSON body (CR-01 mobile side, WARNING 4, WR-06 — UP-01, UP-04).**

## Performance

- **Duration:** ~20 min of work (the bulk of wall time was the cold first build: `npm ci` in `apps/mobile`, a cold `:app:assembleApkRolloutDebug`, plus a root `pnpm install` so the husky pre-commit hook's `pnpm exec lint-staged` + `pnpm typecheck` could run)
- **Tasks:** 1 (TDD — implementation + tests in one commit)
- **Files modified:** 2

## Accomplishments

- `uploadOne` step 3 is now `val initResp = when { row.reupload -> postReupload(...); row.uploadId != null -> postRePresign(...); else -> postInit(...) }` with `wasReupload` captured BEFORE the `when` (the `when` reads `row.reupload`).
- Step 4 unchanged (`row.uploadId = initResp.uploadId; row.imuUploadId = initResp.imuUploadId; row.state = UPLOADING; queueStore.upsert(row)` — a no-op `uploadId` assign for the `/parts` branch since the response echoes the same id). Immediately after: `if (wasReupload) { row.reupload = false; queueStore.upsert(row) }` — so a subsequent re-drain of that row (process-killed mid-flight) sees `row.uploadId != null && !row.reupload` → `/parts`, not another `/reupload` (no orphaned ETags — CR-01 on the re-upload path, WARNING 4).
- New `postRePresign(baseUrl, row, partsCount)`: `imuUploadId` from the row (none → `DeadLetterException`); `POST /recordings/:id/parts` with `{ partsCount, imuUploadId }`; `404`/`409` → `DeadLetterException("/recordings/:id/parts -> <code> (upload not resumable)")`; other non-2xx → transient `IOException`; success → `parseInitResponse(body, "/recordings/:id/parts")`.
- `postInit` gains `if (resp.code == 409 || resp.code == 403) throw DeadLetterException(...)` before the `!resp.isSuccessful` check (a `409` = the row moved to a non-`pending` state, e.g. an ops takedown — terminal; a `403` = wrong owner — terminal; both non-retryable, so dead-letter rather than loop via `IOException`).
- `parseInitResponse(text: String, label: String)` — the body parse + `parts(...)` helper are wrapped in `try { ... } catch (e: org.json.JSONException) { throw IOException("$label response not valid JSON") }`; the `IOException` carries ONLY the static label (the `drainNow` transient catch logs `e.message`, which is now body-free — WR-06 / T-5-10-01). `postReupload` (`"/recordings/:id/reupload"`) and `postInit` (`"/recordings/init"`) call-sites updated.
- Class KDoc step 1 rewritten to describe the 3-way route choice (was just `/init` or `/reupload`).
- `UploadCoordinatorTest.kt`: the MockWebServer dispatcher gains a `path.endsWith("/parts")` branch (echoes the row's existing `uploadId`/`imuUploadId` back unchanged per Plan 05-09's contract; honours `partsResponseCode` for the 409 case + `partsRawBody` for the non-JSON case), a `partsCalls` counter, `lastPartsBody`, and `initResponseCode` (for the `/init` 409 case); `initBody` gains `uploadId`/`imuUploadId` params. 5 new tests:
  - `reDrain uses parts route not init - DONE part not re-PUT, uploadId unchanged (CR-01, UP-04)` — a row with `uploadId="VID-UPLOAD-ID"`, part 1 DONE → the drain hits `/recordings/:id/parts` (1 call, 0 `/init`), the request body carries `{ partsCount:2, imuUploadId:"IMU-UPLOAD-ID" }`, part 1 is not re-PUT, part 2 + IMU are, `/finalize` carries part 1's cached `"etag-1"` + part 2's fresh ETag against the SAME ids, the row's `uploadId`/`imuUploadId` are unchanged, state ends `AWAITING_VERIFY`.
  - `reupload drain clears the reupload flag then a re-drain uses parts not reupload (WARNING 4)` — first drain (`reupload=true`) hits `/reupload`, after it `read().first().reupload == false` and `uploadId == "VID-UPLOAD-ID"`; then a simulated second-drain (a row with `reupload=false`, `uploadId="new-vid"`, both parts DONE) hits `/recordings/:id/parts` (1 call, 0 `/reupload`), no part PUT, `/finalize` carries `"e-v"`/`"e-i"`, state `AWAITING_VERIFY`.
  - `a 409 from the parts route dead-letters the row, no infinite loop` — `/parts` returns 409 → the row goes `DEAD_LETTER` with a reason; a 2nd `drainNow()` makes no further requests (the dead-lettered row is skipped).
  - `a 409 from the init route dead-letters the row, no infinite loop` — `/recordings/init` returns 409 → `DEAD_LETTER`; a 2nd drain makes no further requests.
  - `a non-JSON parts response does not leak presigned URLs and is treated as transient` — `/parts` returns `"<html>oops https://s3.example/...?X-Amz-Signature=abc...</html>"` with 200 → the row is NOT dead-lettered (transient, stays for retry); a reflective call of `parseInitResponse(rawBody, "/recordings/:id/parts")` throws `IOException` whose message is exactly `"/recordings/:id/parts response not valid JSON"` and contains no `http` / `X-Amz` / `<html`.

## Task Commits

1. **Task 1: re-drain calls POST /recordings/:id/parts (not re-/init); clear row.reupload right after postReupload; 409/404 from /parts and 409 from /init → dead-letter; harden parseInitResponse against leaking presigned URLs** — `09e3921` (fix)

_(TDD task — the implementation + the test landed in one commit; the test target was run to confirm green before committing.)_

## Files Created/Modified

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt` — `wasReupload` capture; 3-way `when` route choice; `row.reupload = false` + `queueStore.upsert(row)` after the `when` when `wasReupload`; new `postRePresign(...)` (`POST /recordings/:id/parts`; `404`/`409` → `DeadLetterException`); `postInit` `409`/`403` → `DeadLetterException`; `parseInitResponse(text, label)` wrapped in `try/catch(JSONException)`; `postReupload`/`postInit` call-sites pass a label; class KDoc step 1 rewritten.
- `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt` — dispatcher `/parts` branch + `partsCalls`/`lastPartsBody`/`initResponseCode`/`partsResponseCode`/`partsRawBody` seams; `initBody(partsCount, uploadId, imuUploadId)`; 5 new tests.

## Decisions Made

- The `/parts` branch is gated on `row.uploadId != null` (no separate flag) — the first-ever drain hits `/init` (idempotent since Plan 05-09: a re-`/init` returns the same `uploadId`, so a lost 201 self-heals); every drain after the ids are persisted re-presigns against them.
- `row.reupload` checked FIRST in the `when` and cleared the instant the fresh `/reupload` ids are persisted — so no drain after the first re-upload drain mints fresh ids, and a re-drain of that re-upload takes `/parts` (preserves any re-upload parts already landed).
- `403` from `/init` mapped to `DeadLetterException` alongside `409` (the plan's "prefer adding it") — non-retryable, so dead-letter rather than loop.
- The non-JSON-leak test asserts via a reflective unit-call of the private `parseInitResponse(text, label)` — exact message assertion, no `@VisibleForTesting` accessor added to production.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The worktree was spawned without `node_modules` (both `apps/mobile`'s npm tree and the root pnpm workspace), `apps/mobile/android/local.properties`, and `apps/mobile/android/app/src/apkRollout/google-services.json` — all gitignored and not carried into a fresh worktree. Resolved: `npm ci` in `apps/mobile`; copied `local.properties` + `google-services.json` from the main checkout; `pnpm install` at the repo root so the husky pre-commit hook's `pnpm exec lint-staged` + `pnpm typecheck` (apps/api + shared/types — unaffected by this plan but the hook typechecks them) could run. None of these are tracked, so none were staged/committed.

## User Setup Required

None — no external service configuration required.

## Verification

- `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.upload.UploadCoordinatorTest'` → BUILD SUCCESSFUL; `TEST-...UploadCoordinatorTest.xml`: `tests="13" failures="0" errors="0"` — the 8 pre-existing tests + the 5 new ones.
- `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug -x lint` → BUILD SUCCESSFUL.
- `grep -n 'row.uploadId != null' UploadCoordinator.kt` → hit inside `uploadOne` (the `when`) + the comment above it.
- `grep -n '/recordings/${row.recordingId}/parts' UploadCoordinator.kt` → hits in `postRePresign` (the request URL + the 404/409 `DeadLetterException` + the transient `IOException`).
- `grep -n 'postRePresign' UploadCoordinator.kt` → the `when` arm + the function decl.
- `grep -n 'row.reupload = false' UploadCoordinator.kt` → 2 hits: line ~292 (the new clear after the `when`, BEFORE the metadata-PUT step) + line ~385 (the existing success-tail one).
- `grep -n 'response not valid JSON' UploadCoordinator.kt` → 1 hit in `parseInitResponse`'s `catch`; the surrounding `catch` interpolates only `$label`, never `text` / `resp.body`.
- `grep -n 'DeadLetterException' UploadCoordinator.kt` → mappings for `/recordings/:id/parts` 404/409 (`postRePresign`) AND `/recordings/init` 409/403 (`postInit`), plus the `imuUploadId`-missing case in `postRePresign`.

## Next Phase Readiness

- The mobile half of the CR-01 fix (re-presign on a re-drain) is in: an already-DONE part keeps its valid ETag across a process-kill / presigned-TTL expiry, `/finalize` uses the upload id the client uploaded against, and a re-drain — including a re-drain of a re-upload — orphans nothing. CR-02 (the server side — idempotent `/init` + the `/parts` route) landed in Plan 05-09; CR-03 (`drainNow()` serialisation) in Plan 05-11. The CR-01/02/03 trio for the upload pipeline is closed.
- This unblocks the force-quit-recovery on-hardware smoke test recorded as a human-verification item in `05-VERIFICATION.md`.
- No blockers.

## Self-Check: PASSED

- File created: `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-10-SUMMARY.md` — present.
- Files modified (per commit `09e3921`): `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`, `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/UploadCoordinatorTest.kt` — both present in the commit.
- Commit: `09e3921` (Task 1) — present in `git log`.
- `:app:testApkRolloutDebugUnitTest --tests 'ai.humynlabs.capture.upload.UploadCoordinatorTest'` → 13 tests, 0 failures. `:app:assembleApkRolloutDebug -x lint` → BUILD SUCCESSFUL.

---

_Phase: 05-upload-pipeline-hash-verify-worker-anti-fraud_
_Completed: 2026-05-12_
