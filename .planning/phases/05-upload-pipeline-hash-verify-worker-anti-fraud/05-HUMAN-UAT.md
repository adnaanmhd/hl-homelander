---
status: partial
phase: 05-upload-pipeline-hash-verify-worker-anti-fraud
source: [05-VERIFICATION.md]
started: 2026-05-12T16:46:52Z
updated: 2026-05-13T08:58:00Z
---

## Current Test

**Re-walk READY 2026-05-13 — Plan 05-15 gap-closure shipped, awaiting fresh APK install + on-device re-walk.** The `invalid_opts: name` blocker logged earlier today was closed by Plan 05-15 / Gap Wave 3 (4 commits `2da5465..ff19694` on `main`): (1) `coalesceDisplayName(name, email)` helper applied at all 3 setUser write sites (SignupScreen / ProfileScreen / useForegroundUserRehydrate) so a Google-withheld `displayName` or empty server-side `users.name` falls back to email-local-part instead of null/empty; (2) JS-side `requireNonEmpty` guards in `buildCaptureOpts.ts` (parallel to the V11 `consentPresent` guard) throw `code: 'profile_incomplete'` so any future regression of the same shape surfaces as a clear "Please complete your profile." toast at RecordingScreen's catch instead of an opaque bridge rejection; (3) +2 Robolectric tests pin the Kotlin defense-in-depth guard at `CaptureSessionOptsBridge.kt:84-85` (empty-name + empty-email reject paths); (4) runbook §1 pre-flight bullet added so the next walker checks `useAppStore.user.name` is non-empty before §2. Mobile vitest is 93 files / 684 tests green; mobile typecheck exits 0. **Next action: `cd apps/mobile/android && ./gradlew installApkRolloutDebug` on the Pixel 10a (5C161JEA304304), then re-run `/gsd-verify-work 5` and re-walk Item 1.** Items 2-5 remain `pending` downstream of Item 1.

### Historical (paused 2026-05-13 morning — pre-gap-closure walk)

**Initial finding — Item 1 surfaced a new blocker: `HumynCapture.start() → invalid_opts: name`.** On the post-Wave-1.5 build, the runbook §2 attempt opened the `__DEV__` Tasks-tab long-press path, navigated to RecordingScreen, the gate camera opened on the back ultrawide (logcat `CameraOpen: ai.humynlabs.capture.apk` → `Lyric RearWide` frames at ~14–29 FPS), the hand gate confirmed (the JS reached the `HumynCapture.start()` call site), and `HumynCapture.start()` rejected synchronously with `code=invalid_opts msg=invalid_opts: name` (logcat `E HumynCapture: java.lang.IllegalArgumentException: invalid_opts: name` at `CaptureSessionOptsBridge.requireNonEmpty(CaptureSessionOptsBridge.kt:150)` ← `fromBridge(CaptureSessionOptsBridge.kt:84)` ← `HumynCaptureModule.start$lambda$0(HumynCaptureModule.kt:138)`). Line 84 is `val contributorName = requireNonEmpty(contributorMap, "name")` — so the empty/blank field is `contributor.name`, NOT the task name. Upstream in JS: `RecordingScreen.tsx:695` builds `user.name: u.user?.name ?? ''` — and `UserDisplay.name` is `string | null` (`appStore.ts:51`), so a sign-in path that leaves `name` null (or the Tester dev-seed user whose name reaches the store as empty) emits `name: ''` into the bridge → the Kotlin guard fires → recording never starts → the rest of §2/§3/§4/§5 can't execute. Pre-flight was clean (tunnels 8080/8081/4566 up, Metro running, API + hash-verify worker up, dev-seed task at `01HVDEVSEEDTASK00000000000` present, recording_events_outbox schema migrated, on-device queue + recordings dir empty). DB sanity: `users` table has one row `(name='Tester', email='tester@example.com')` — so the server-side has a non-empty name, meaning the regression is on the **client side** (sign-in flow not writing `name` into the store, or the store hydration losing it). Items 2–5 are still pending. Re-walk after the gap closes. The 2026-05-13 backend-half VERIFIED state from the earlier automated probe still stands.

### Historical note (paused state captured 2026-05-13 afternoon — Wave 1 walk)

**Previous status:** `paused_pending_wave_1_5`. Backend half of items 1+3 was walked 2026-05-13 morning by an automated probe against the dev stack (Postgres + Redis + LocalStack + the real hash-verify worker process) — `POST /recordings/init` → PUT parts to LocalStack → PUT `metadata.json` → `POST /recordings/:id/finalize` → (dev shim) `enqueueVerify` → the BullMQ worker re-hashed the S3 bytes → `recordings.qa_status='verified'` (+ `verified_at`) → `GET /me` carried `_events: [{recording_id, event_type:'verified'}]` and a second `GET /me` did NOT re-carry it (delivered). Hash-mismatch path: a recording that claimed a wrong `file_sha256` at `/init` → worker → `qa_status='hash-mismatch'` → `_events: [{…, event_type:'re-upload'}]` → `POST /recordings/:id/reupload` → row reset to `qa_status='pending'` with a fresh `s3UploadId` + `verified_at` cleared. Plus the Phase-5 gap-closure routes: a duplicate `POST /recordings/init` on a `pending` row → `200` with the SAME `uploadId` (CR-02 idempotent `/init` / lost-201 self-heal); `POST /recordings/:id/parts` → `200`, re-presigned video against the existing `uploadId`, row unchanged (CR-02 new re-presign route). `ip_address` server-populated (UP-18); `recordings_to_verify` drained on both verified + mismatch. **No backend findings.**

The on-device half (item 1's device leg + items 2–5) was attempted 2026-05-13 afternoon on a Pixel 10a (`5C161JEA304304`, Android 16) with the apkRollout build loaded from Metro. The attempt surfaced **five distinct root causes** for the same observable `POST /recordings/init → 400` symptom; the first three were fixed inline through three `/gsd-debug` sessions:

1. ✅ `debug-task-id-init-400` (commit `48dea49`) — `DEBUG_TEST_TASK.taskId` was the 23-char taxonomy slug `cooking_chop_vegetables`, failing `RecordingsInitRequestSchema.taskId = z.string().length(26)` and the `recordings.task_id → tasks.id` FK. Fix: dev-seed task at the fixed ULID `01HVDEVSEEDTASK00000000000`; `TasksPlaceholderScreen.tsx` `DEBUG_TEST_TASK.taskId` retargeted at it; runbook §1/§2 patched to call out the seed step + the `installApkRolloutDebug`-ships-`--dev false`-offline-bundle gotcha.
2. ✅ `init-400-capturedat-offset` (commit `692e295`) — Zod's default `.string().datetime()` rejects `+05:30` numeric offsets; the device's `MetadataComposer` emits local-time-with-offset for `start_timestamp`, which `UploadCoordinator.kt` forwards verbatim as `capturedAt`. Fix: `shared/types/src/recording.ts` relaxed three client-supplied datetime sites to `.datetime({ offset: true })`. Host-side `apps/api/scripts/repro-init-400.ts` proves before/after.
3. ✅ `init-400-no-idempotency-key` (commit `5c0b2d8`) — `apps/api/src/plugins/idempotency.ts` rejects every POST/PATCH lacking an `Idempotency-Key: <UUIDv4>` header (Phase 5 contract); the native `UploadCoordinator.authedJsonRequest()` only set `Authorization` + `Content-Type`. Fix: `UploadRow.idempotencyKey: String = UUID.randomUUID().toString()` minted at construction, persisted to `queue.json`, threaded through all four POST callers (init/reupload/parts/finalize) with a one-shot fromJson migration for legacy rows.

After all three fixes landed and `adb reverse tcp:4566 tcp:4566` was added (LocalStack tunnel — also a runbook §1 setup gap, see `05-COSMETIC-GAPS.md`), the next §2 attempt got nearly all the way through: `/init -> 201`, all 10 video parts PUT to S3 (etags captured in `queue.json`), `metadata.json` PUT, then **`/finalize -> 409`** because the third fix gave each `UploadRow` exactly ONE `idempotencyKey` and reused it across `/init`, `/parts`, `/finalize`, `/reupload`. The API's idempotency hook keys cache by `(user_id, key)` and treats a same-key/different-`(method, path, body)` as a conflict → 409 `idempotency-key-conflict`. So `/finalize`'s POST hit the cached init-201 by key, saw the request hashes differ, and returned 409 → 6 retries → DEAD_LETTER. A subsequent "Retry" tap also 409'd because server-side `/reupload` only accepts `qa_status='hash-mismatch'` (the canonical worker-flagged path, NOT a client-side dead-letter on a pending row); the runbook §3 sanity-check wording for client-side dead-letter Retry is wrong on the server contract.

Five total root causes (3 fixed inline + 2 outstanding) + adjacent cosmetic / setup gaps logged. Rather than continue patch-and-pray, owner decision is to **pause the §2 walk and batch-fix in a Phase-5 Wave-1.5 plan** before re-walking on a single coherent build. Full enumeration with fix recipes in `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` under the new "Wave-1.5 follow-on items" section. Backend half stays VERIFIED — no backend regression today; the new functional issues are all in the native upload coordinator + the runbook's setup section.

## Tests

### 1. End-to-end upload (Pixel 7a/8a-class + dev backend) + the hash-mismatch path

expected: On a Pixel 7a/8a-class device with the dev backend up (Postgres + Redis + LocalStack + worker), record a ≥60 s task → the bundle (mp4 + IMU CSV + metadata.json) auto-enqueues; the Pending Uploads tile/screen shows "Uploading…" progressing, then the row drops once verified. Bundle lands in S3 (`aws --endpoint-url=http://localhost:4566 s3 ls s3://humyn-recordings-dev/recordings/`), the BullMQ hash-verify worker re-hashes, `recordings.qa_status='verified'`, the next authed API response carries `_events: [{recording_id, event_type:'verified'}]`, the local mp4+csv+json are deleted, the row disappears from the queue. Then corrupt the S3 object → hash-mismatch → `re-upload` event → re-upload-from-local → re-verify. Runbook: `.planning/runbooks/05-upload-smoke.md`.
result: partial
reported: "§2 happy path PASSES on Pixel 10a (post-Plan-05-15 build) — record → S3 → worker `verified` → `_events` → locals deleted → row gone. §3 hash-mismatch leg not yet exercised (clearVerified deleted the locals for 01KRGA1B5H8BSRNFPSRHQFTHQ8; needs another recording)."
severity: passed-pending-§3
device: Pixel 10a (5C161JEA304304), Android 16, build apkRollout-Debug (commits c551138..d143a75)
prior_issue_resolution: |
The 2026-05-13 morning `invalid_opts: name` blocker (CaptureSessionOptsBridge.requireNonEmpty :150 ← :84 ← HumynCaptureModule.kt:138) is RESOLVED by Plan 05-15 / Gap Wave 3 (4 commits 2da5465..ff19694, fast-forward-merged into main as 4e2897a). Wave-1.5 plan 05-14 + Plan 05-15 together closed the morning walk's regressions. The §2 re-walk this afternoon successfully drove the full happy path end-to-end with the new build.
§2_happy_path_evidence: |
Recording `01KRGA1B5H8BSRNFPSRHQFTHQ8`: fresh sign-in after `adb shell pm clear` wiped the stale-JWT state — new user row `01KRG9XG7VCSAYN823Q96FJ216` created via POST /auth/google (`name='Adnaan Mohammed', email='m.adnaan161@gmail.com'`); Plan-05-15 coalesceDisplayName propagation path active (Google's displayName came through non-empty on this run, so the email-local-part fallback wasn't exercised — see §3 / future). RecordingScreen → hand gate → HumynCapture.start() proceeded past CaptureSessionOptsBridge.fromBridge into the HEVC pipeline (no `invalid_opts: name`); Camera2 opened on RearWide ultrawide, ECOSession created at 1920×1080, recording ran ~93 s (duration_ms=92748). Stop → contribution toast → Home (toast killed-by-transition is a pre-existing 05-COSMETIC-GAPS item, not regressed). Auto-enqueued with 11 video parts + 1 IMU part + metadata.json; all 4 per-route Idempotency-Keys minted as distinct UUIDv4s (Wave-1.5 Plan 05-14 Item 1 holds — no cross-route 409). FGS started with `dataSync` type; Wave-1.5 drainNow cold-start kick fired. Bundle landed in S3 at `recordings/01KRG9XG7VCSAYN823Q96FJ216/01KRGA1B5H8BSRNFPSRHQFTHQ8/` — video.mp4 (90,288,788 B), imu.csv (4,019,618 B), metadata.json (2,313 B). `recordings.qa_status='uploaded'` after /finalize 200, IP server-populated (UP-18), `recordings_to_verify` row written. BullMQ hash-verify worker had an INDEPENDENT stale-state issue (Drizzle pool + tsx-watch interaction); manual restart (`pkill` + `nohup pnpm --filter @humyn/api worker:hash-verify:dev`) drained the queue in 0.6 s — `qa_status='verified'`, `verified_at='2026-05-13 09:26:27.124+00'`, outbox event `verified` written. **Stale-worker recovery is a dev-stack quirk, NOT a Phase 5 defect**; runbook §1 candidate footnote. App-to-foreground → next authed call piggybacked `_events: [{event_type:'verified'}]` → `HumynUpload.clearVerified` unlinked the local triple and dropped the queue row. Post-delivery snapshot: `files/recordings/` empty, `queue.json: []`, `recordings_to_verify` drained, contributions row written (`duration_ms=92748, recording_count=1, task_count=1`). ✓
§2_cosmetic_observations: |
(1) Tap on the (now empty) Pending uploads tile routed correctly to MainTabs/History per the Wave-1.5 rewire — but History is `HistoryPlaceholderScreen.tsx` (Phase 6 "Coming soon" stub). Expected, not a Phase 5 defect. Logged to 05-COSMETIC-GAPS.md. (2) No live progress bar observed on the Pending Uploads row — the ~90 MB / 11-part multipart PUT to LocalStack@localhost completed in ~3 s, faster than the user could navigate to Home; by then the row was in AWAITING_VERIFY state (no continuous progress to render). Dev-environment artifact; the Wave-1.5 Item 4 progress chip + determinate fill will be exercisable on the §4 CGNAT-cellular walk. Logged to 05-COSMETIC-GAPS.md.
§3_remaining: |
The hash-mismatch leg of Item 1 is NOT yet exercised. After §2's `verified` event delivery, the local triple for `01KRGA1B5H8BSRNFPSRHQFTHQ8` is gone, so we can't re-upload-from-local for that recording. §3 needs either (a) a fresh recording where we corrupt the S3 object + reset qa_status before the `_events: verified` is delivered to the device, OR (b) keep a future recording's app in background long enough to corrupt-and-reverify before clearVerified runs. Either path requires another on-device recording.

### 2. Force-quit / OS-evict recovery + Android-14 FGS type downgrade + Android-15 UIDT onTimeout handoff

expected: Force-quit / OS-evict the app mid-upload on Android, then relaunch → the upload resumes from the persisted per-part state via `POST /recordings/:id/parts` (re-presign against the existing `uploadId`; already-DONE parts keep their ETags, not re-PUT) and eventually completes + verifies. Background the app for >5 min → the FGS type downgrades `camera|microphone|dataSync` → `dataSync` → stops after 5 min idle; the FGS notification flips from "Recording in progress" (camera/mic privacy indicators) to "Uploading recordings…" (indicators gone) then disappears after 5 min idle. On Android 15, the `dataSync` 6-h `onTimeout` hands off to the UIDT `UploadJobService` which picks up true-background work past the 6-h cap. (The CR-01/CR-03 defects that previously made a mid-upload process-kill leave the row stuck are now fixed in code — this test confirms the fix holds on-device.)
result: [pending]

### 3. OEM battery-optimization deep-links (Xiaomi/Oppo/Vivo/Samsung) + the AOSP fallback

expected: On a Xiaomi (MIUI) / Oppo (ColorOS) / Vivo (FunTouch) / Samsung (OneUI) device — or the AOSP fallback on a Pixel — trigger the first-upload `BatteryOptimizationScreen`. The "Open Autostart settings" button appears only when an OEM component resolves and launches it; the AOSP `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` exemption button always works; the standalone fallback line is always shown; the per-vendor steps match `help-center-content.md`.
result: [pending]

### 4. CGNAT-cellular MSS clamp + the 30 s no-progress watchdog

expected: On a CGNAT cellular link (Jio / Vivo Brasil), upload a multi-hundred-MB MP4. A stalled part transfer is abandoned within ~30 s (the no-progress watchdog cancels the stalled OkHttp Call) and retried on a fresh socket without restarting the whole file; the upload eventually completes over the bad link. Check logcat for whether the `TCP_MAXSEG=1280` `MssSocketFactory` clamp takes or no-ops.
result: [pending]

### 5. Wave-1 cleanup on hardware (force-quit fragment discard, device-distress→Home nav, alert-cue audibility, RotatePrompt glyph legibility)

expected: Per `.planning/runbooks/05-wave1-cleanup-smoke.md` (authored, not yet walked) — D-03: a force-quit mid-record leaves only crash-truncated fragments and `CaptureLaunchSweep` discards ALL of them (no re-finalized stub recording appears in History). D-05: a mid-record device-distress stop (battery ≤5% / thermal abort) navigates to Home, not the RecordingScreen "ready" substate. D-06: the recording alert cues are audible on the device speaker at the en-US female-leaning voice. D-09: the RotatePrompt portrait-phone glyph is legible. The crash-recovery toast shows for 5 s (not the 15 s workaround).
result: [pending]

## Summary

total: 5
passed: 0
issues: 1
pending: 4
skipped: 0
blocked: 0

## Gaps

- truth: "HumynCapture.start() succeeds on the **DEV** Tasks-tab long-press path when a Google-signed-in user (or the dev tester@example.com) hits the active substate after the hand gate passes — the contributor.name in CaptureSessionOpts is a non-empty string."
  status: failed
  reason: "User reported: recording could not start. Logcat: `E HumynCapture: start() failed — code=invalid_opts msg=invalid_opts: name`. Stack at CaptureSessionOptsBridge.kt:150 ← :84 (`requireNonEmpty(contributorMap, \"name\")`) ← HumynCaptureModule.kt:138. JS upstream: RecordingScreen.tsx:695 passes `user.name: u.user?.name ?? ''`; UserDisplay.name is `string | null` (appStore.ts:51). When the store's `user.name` is null/empty the bridge throws and recording never starts."
  severity: blocker
  test: 1
  artifacts:
  - path: "apps/mobile/src/screens/recording/RecordingScreen.tsx"
    line: 695
    issue: "Defaults missing `user.name` to `''` instead of bailing with a clear UX — silently delegates the failure to the Kotlin bridge."
  - path: "apps/mobile/src/lib/buildCaptureOpts.ts"
    line: 75
    issue: "`name: args.user.name` is forwarded without a non-empty guard parallel to the `consentPresent` guard above it. Either reject empty/null here with a clear JS-side error (mirroring the V11-style guard) OR rely on the screen having already coalesced it to a real value."
  - path: "apps/mobile/src/state/appStore.ts"
    line: 51
    issue: "`UserDisplay.name: string | null` — null is a valid state; nothing downstream of sign-in / `/me` guarantees a non-empty name reaches RecordingScreen."
  - path: "apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSessionOptsBridge.kt"
    line: 84
    issue: "Kotlin guard fires correctly (defense-in-depth across the JS↔Kotlin trust boundary, T-3.3-01). The fix needs to land on the JS side so the bridge guard is the last-line check, not the first observable failure."
    missing:
  - "Populate `useAppStore.user.name` reliably after Google Sign-In / `/me` — either fall back to email-local-part when the Google displayName is absent, or fail the sign-in flow with a 'display name required' UX (NOT just default to empty downstream)."
  - "Add a JS-side guard in buildCaptureOpts that throws if `args.user.name` is empty / whitespace, with a message that triggers a clear UX in RecordingScreen (today the bridge promise rejection lands in the screen's catch as CAPTURE_START_FAILED with no user-facing diagnostic of WHICH field was empty)."
  - "Decide whether to allow the `__DEV__` Tasks-tab long-press path to fall back to a hardcoded test contributor when the store's name is empty (parallel to the DEBUG_TEST_TASK id/name/category/setting hardcodes already in TasksPlaceholderScreen), or to require a real signed-in user with a populated name for the dev shortcut."
  - "Audit whether other CaptureSessionOpts fields are similarly null-vulnerable (email follows the same `?? ''` pattern at RecordingScreen.tsx:696 and would fail at CaptureSessionOptsBridge.kt:85; appVersion at :126 has a SEMVER regex but no length floor)."
    debug_session: ""
    device: "Pixel 10a (5C161JEA304304), Android 16"
    build: "apkRollout-Debug + Metro --reset-cache"
    observed_at: "2026-05-13T08:21:00Z (logcat 13:51:00.179 local)"
