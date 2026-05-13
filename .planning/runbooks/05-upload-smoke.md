# Phase 5 — Upload Pipeline End-to-End Smoke Runbook

**Status:** authored by Plan 05-08 (Wave 5). The on-hardware checklist that exercises the whole Phase-5 upload path — record → auto-enqueue → background/force-quit survival → land in S3 → hash-verify worker flips `qa_status='verified'` → the `_events` envelope piggy-backs the next authed API call → the local mp4/csv/json triple is deleted → the app-relaunch reconciliation sweep finds nothing left — plus the hash-mismatch / re-upload path, the logout/re-login owner-pin path, and the `05-VALIDATION.md` Manual-Only checks (OEM walkthrough, Doze, the Android-15 `onTimeout` handoff, the TCP no-progress watchdog, the MSS-clamp check). Run this after Phase-5 implementation lands and before Phase-5 sign-off.

**Reference:** `05-CONTEXT.md` (D-03/D-07/D-08/D-10); `05-RESEARCH.md` § Validation Architecture "Phase gate" + Pitfall 3 (the lost-event self-heal) + Pitfall 7 (the MSS-clamp takes-or-no-ops check); `05-VALIDATION.md` Manual-Only Verifications table; `04-MANUAL-SMOKE.md` §7 (the amendments protocol this file mirrors); `.planning/runbooks/05-wave1-cleanup-smoke.md` (the §-numbered convention). CLAUDE.md drift banner: the three `imu_video_drift_{max,mean,p99}_ms` figures are RECORDED, NOT GATED — do not block this smoke on them.

> **Conventions.** The `apkRollout` flavor's package id is `ai.humynlabs.capture.apk` — every `adb shell run-as` below uses that. Run `adb logcat -c` before each section so the greps match the latest run. The app NEVER runs CLI commands; the operator only visits screens, taps UI, evaluates visuals, and runs the `adb` / `aws` / `psql` diagnostics quoted inline. Mid-smoke **cosmetic** findings go to a `*-COSMETIC-GAPS.md` (the §7 amendments protocol — a Phase-5 `05-COSMETIC-GAPS.md` for Phase-5-owned surface), **never** into the FROZEN Phase-2/3/4 amendment files. **Functional regressions** (broken behavior, spec violations) block §6 sign-off and get a `/gsd-debug` session, not an amendment-file entry.

---

## §1 Pre-flight

- [ ] Install the **Phase-5 build** — `cd apps/mobile/android && ./gradlew installApkRolloutDebug` (or the release/staging build per the `__DEV__` caveat in `04-MANUAL-SMOKE.md` §1 if a substate's `__DEV__`-gated affordance is in the way).
- [ ] Bring up the dev stack: `docker compose up -d postgres redis localstack` (the `redis` container is the BullMQ store for the hash-verify worker; LocalStack is S3). Confirm all three are healthy (`docker ps`).
- [ ] Run the schema migration (lands `recording_events_outbox` + the `recording_event_type` enum + the partial index): `pnpm --filter @humyn/api db:migrate` (or `db:push`, matching the repo convention). Sanity: `psql "$DATABASE_URL" -c '\d recording_events_outbox'` shows the 6 cols; `psql "$DATABASE_URL" -c '\dT recording_event_type'` shows `verified` / `re-upload`.
- [ ] Run the API + the worker locally:
  - API: `pnpm --filter @humyn/api dev` (tsx watch — serves `/recordings/init`, `/finalize`, `/reupload`, `/verified-ids`, `/contributions`, `/me`; the events-outbox onSend hook is registered).
  - Hash-verify worker: `pnpm --filter @humyn/api worker:hash-verify:dev` (tsx watch — drains the BullMQ queue; re-hashes the S3 object vs the metadata SHA → `verified` or `hash-mismatch`; appends an outbox event in the same transaction).
  - (Dev path: `/recordings/:id/finalize` fire-and-forget `enqueueVerify(recordingId)` when `AWS_ENDPOINT_URL` is set — Pitfall 6. Prod uses S3→EventBridge→SQS→poller; not exercised here.)
- [ ] Confirm `apps/mobile/.env.apkRollout` (or whichever flavor you installed) points `API_BASE_URL` at the locally-running API (reachable from the device — use the host LAN IP, not `localhost`, if testing on real hardware).
- [ ] Confirm a head rig is available, the device has a full media volume, ≥5 GB free storage, ≥15 % battery. Sign in with a real Google account. `adb logcat -c`.

---

## §2 Happy path — record → auto-upload → S3 → worker `verified` → `_events` → locals deleted → reconciliation finds nothing

Requirements: **UP-05** (auto-enqueue on stop), **UP-06** (FGS survival), **UP-10** (pause-while-recording / resume-on-stop), **UP-12** (Pending Uploads screen/tile), **UP-14** (locals not deleted before `verified`), **UP-15** (locals deleted on `verified`), **VERIFY-01..06** (worker re-hash, `_events` delivery, reconciliation sweep).

- [ ] Start a non-practice recording (the `__DEV__` Tasks-tab long-press affordance is fine), reach the **active substate**, let it run **≥ 60 s**, then stop via the X-modal ("Stop").
  - [ ] On stop: confirm the toast `"{Hh Mm} added to your contribution."` (NOT `"Recording too short — discarded."`) and the app lands on **Home**.
  - [ ] Confirm the recording **auto-enqueued**: the Home **"Pending uploads"** section shows the row (filename + duration + a status chip); tap the section → the **Pending Uploads** screen shows the row with **"Uploading…"** (or **"Uploading… 47%"** mid-transfer). There is **NO cancel affordance** anywhere (UP-11).
  - [ ] `adb shell run-as ai.humynlabs.capture.apk cat files/upload-queue/queue.json` shows the row with `ownerUserId` = the signed-in `sub` (UP-13 owner-pin).
  - [ ] (First-ever upload only — UP-09) confirm the **BatteryOptimizationScreen** modal is presented once after landing on Home (the AOSP "Allow unrestricted battery" button + the per-vendor steps + the optional OEM "Open Autostart settings" deep-link + the standalone fallback line); dismiss with "Done"/"Skip for now" — it does not re-appear on a subsequent upload (unless a force-upgrade bumps the version).
- [ ] **Background + force-quit while the upload is in flight:** `adb shell input keyevent KEYCODE_HOME` then `adb shell am force-stop ai.humynlabs.capture.apk`.
  - [ ] Confirm the **FGS keeps the upload going**: `adb shell dumpsys activity services | grep -i HumynForegroundService` shows the service with the `dataSync` foreground type and the "Uploading recordings…" notification; the upload progresses (re-check the S3 listing below grows).
  - [ ] (If the upload is long enough to cross the Android-15 6-hour `dataSync` cap, see §5 for the `onTimeout` → UIDT JobService handoff; for a normal-length recording the FGS alone finishes it.)
- [ ] **Confirm the bundle landed in S3:** `aws --endpoint-url=http://localhost:4566 s3 ls s3://humyn-recordings-dev/ --recursive | grep <recordingId>` shows the `.mp4` + the `.csv` + the `metadata.json` object keys (the three byte-for-byte travelers — CLAUDE.md "Files never re-encoded").
- [ ] **Confirm the worker re-hashed + flipped `qa_status`:** `psql "$DATABASE_URL" -c "SELECT id, qa_status, verified_at FROM recordings WHERE id = '<recordingId>';"` shows `qa_status = 'verified'` and a non-null `verified_at`. (The worker re-streams the S3 object, recomputes SHA-256, compares to `metadata.file_sha256`; on match → `verified` + an outbox `verified` event for `req.user.sub`.)
- [ ] **Trigger the `_events` delivery:** relaunch the app (or just bring it to foreground) so it makes ANY authenticated API call (Home → `/contributions` / `/me`, or the reconciliation sweep's `GET /recordings/verified-ids`). The events-outbox onSend hook drains the `verified` event onto that response's `_events` envelope.
  - [ ] Confirm the **local triple is deleted**: `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` no longer lists `<recordingId>.mp4` / `.csv` / `.json` (the `verified` handler calls `HumynUpload.clearVerified([recordingId])` → native unlinks the triple + drops the row). The path is recomputed natively from the recording's known location — never from the server payload (T-5-08-02).
  - [ ] Confirm the **row disappears from Pending Uploads** (the queue-changed event re-renders without it; D-10 discretion — a row drops the moment its bundle is verified, so the `✓ Uploaded` chip only flashes briefly if at all).
- [ ] **Confirm the reconciliation sweep is the convergent backstop:** force-quit + relaunch the app again. On cold start the sweep runs `GET /recordings/verified-ids?since=<cursor>`; with the triple already deleted there is nothing to clear → no error, no stale row, the cursor advances. (`adb logcat | grep -i 'verified-ids\|uploadReconcile'` shows the swept run with 0 cleared.)

**§2 Acceptance:** a ≥60 s recording auto-enqueues; the Pending Uploads tile/screen shows "Uploading…"; the upload survives background + force-quit on the FGS; the bundle lands in S3 byte-for-byte; the worker flips `qa_status='verified'`; the next authed API call carries the `_events` envelope; the local mp4/csv/json triple is deleted and the row disappears; the relaunch reconciliation sweep finds nothing left.

---

## §3 Hash-mismatch / re-upload path

Requirements: **VERIFY-04** (worker → `hash-mismatch`), **UP-16** (re-upload from the still-present local copy).

- [ ] Record + auto-enqueue + let it upload + verify a NEW recording (or re-use one **before** it's deleted by the `verified` path — if it's already deleted, record a fresh one).
- [ ] **Deliberately corrupt the S3 object:** `aws --endpoint-url=http://localhost:4566 s3 cp <any-other-file> s3://humyn-recordings-dev/<the .mp4 key of the recording>` (this overwrites the object; S3 versioning retains the good version). Then re-trigger the worker for that recording (a dev re-enqueue: `aws --endpoint-url=http://localhost:4566 ...` SQS send if you're on the SQS path, or — on the LocalStack dev path — call the API's dev re-finalize/`enqueueVerify` shim for `<recordingId>`, or restart the worker so the `recordings_to_verify` row / verify-sweep cron re-picks it).
  - [ ] Confirm `psql "$DATABASE_URL" -c "SELECT qa_status FROM recordings WHERE id = '<recordingId>';"` shows `qa_status = 'hash-mismatch'`, and an outbox `re-upload` event was appended.
- [ ] **Trigger the `_events` delivery:** make any authenticated API call from the app.
  - [ ] Confirm the app **re-uploads from the still-present local copy**: `adb logcat | grep -i 'reupload\|recordings/.*/reupload'` shows the coordinator calling `POST /recordings/<recordingId>/reupload` (NOT `/init`) — `row.reupload = true`, the row reset (state PENDING, `uploadId`/parts/metadataPut cleared, `deadLetterReason` cleared), the local mp4/csv/json **untouched** (`adb shell run-as ... ls files/recordings/` still shows them); the Pending Uploads row goes back to "Uploading…".
  - [ ] After the re-upload + re-verify: `psql "$DATABASE_URL" -c "SELECT qa_status FROM recordings WHERE id = '<recordingId>';"` shows `qa_status = 'verified'` again; the next authed call carries the `verified` `_events` row; the local triple is deleted and the row disappears.
- [ ] (Sanity — the dead-letter "Retry" affordance hits the same path: if the row dead-letters after 7 retries, the Pending Uploads row shows the `chip-failed` "Upload failed" chip + a "Retry" Pressable; tapping it calls `HumynUpload.reupload(recordingId)` — same row reset + `POST /recordings/:id/reupload` on the next drain.)

**§3 Acceptance:** corrupting the S3 object → worker `qa_status='hash-mismatch'` → a `re-upload` `_events` row → the app re-uploads from the local copy via `POST /recordings/:id/reupload` → re-verify → `qa_status='verified'` → locals deleted; the dead-letter "Retry" button drives the same path.

---

## §4 Logout / re-login owner-pin

Requirements: **UP-13** (logout pauses + preserves the queue/locals; same-user re-login resumes; a different user does not see/resume the first user's rows).

- [ ] Record + auto-enqueue a recording (User A); while it's **mid-upload**, log out (Profile → Logout → confirm).
  - [ ] Confirm the **in-flight PUT aborts** (`adb logcat | grep -i 'cancelInflight\|HumynUpload.*pause'` shows the pause/abort).
  - [ ] Confirm the **queue + local files are PRESERVED** (do NOT clear): `adb shell run-as ai.humynlabs.capture.apk cat files/upload-queue/queue.json` still has User A's row; `adb shell run-as ai.humynlabs.capture.apk ls files/recordings/` still shows `<recordingId>.mp4` / `.csv` / `.json`.
  - [ ] Confirm the **Pending Uploads screen is empty while logged out** (no JWT → `decodeGoogleSubFromJwt` returns `''` → no rows match the owner filter; the live `getQueueSafe()` path also returns the rows but they're filtered out).
- [ ] **Log back in as the SAME user (User A).**
  - [ ] Confirm the upload **resumes** (`adb logcat | grep -i 'HumynUpload.*resume\|bootstrap'` shows the resume; `pushUploadContext` re-pushes the auth context + calls `resume()` on the jwt change); the Pending Uploads row reappears and progresses; the upload eventually verifies + the locals delete + the row disappears (same as §2's tail).
- [ ] **Log out, then log in as a DIFFERENT user (User B).**
  - [ ] Confirm User A's row does **NOT** appear in User B's Pending Uploads screen (the screen filters `ownerUserId === currentSub`; the native `bootstrap(currentSub)` only resumes own-rows — T-5-08-03 / T-5-08-04). User A's row + local files stay on disk untouched (they resume when User A signs back in).

**§4 Acceptance:** a logout aborts the in-flight PUT but preserves the queue + local files; the Pending Uploads screen is empty while logged out; a same-user re-login resumes; a different user does not see or resume the first user's rows.

---

## §5 Manual-only checks (carried from `05-VALIDATION.md` Manual-Only — verify on hardware where available)

- [ ] **OEM battery-optimization walkthrough (UP-09).** On real Xiaomi (MIUI/HyperOS) / Oppo (ColorOS) / Vivo (FunTouch) / Samsung (One UI) hardware **if available**: trigger the first-upload walkthrough (§2), confirm each per-vendor step opens the right settings screen or the AOSP `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` fallback, and the "Open Autostart settings" deep-link button only renders when the vendor security-center package is installed AND its explicit ComponentName resolves (a renamed/removed activity is a silent no-op, not a crash — Pitfall 1). **Else** (on the Pixel): confirm the AOSP fallback + the always-shown standalone walkthrough copy. After "Allow unrestricted", confirm the status line re-checks (`✓ Allowed` / `Still restricted`).
- [ ] **Doze survival (UP-06).** Background the app with an upload in flight, leave the device idle (overnight, or `adb shell dumpsys deviceidle force-idle` to force Doze) — confirm the upload **resumes** when connectivity/Doze allows (the FGS / the UIDT JobService picks it up; the queue + local files are intact). A true-background resume goes through the UIDT JobService, never an FGS-started-from-background (Pitfall 4/5).
- [ ] **Android-15 `dataSync` 6-hour cap → `Service.onTimeout()` → UIDT handoff (UP-07).** On an **API-35** device with a long-running upload (or `adb shell cmd ...` to fast-forward the FGS time budget if possible): observe `adb logcat | grep -i 'onTimeout\|UploadJobService\|scheduleUidt'` — the FGS `onTimeout(int,int)` fires → `UploadJobService.scheduleUidt(...)` schedules a `setUserInitiated(true)` / `NETWORK_TYPE_ANY` job → `stopSelf()`; the UIDT job's `onStartJob` drains the queue on a bg thread → `jobFinished(params, queueHasWork())`. The upload completes via the job.
- [ ] **TCP no-progress watchdog (UP-19) — the RELIABLE half.** On a CGNAT cellular link (Jio / Vivo Brasil): induce a stalled chunk (e.g. flap airplane-mode mid-PUT, or a throttled hotspot). Confirm `adb logcat | grep -i 'no-progress\|watchdog\|Call.cancel'` — after ~30 s with no body bytes moving, the OkHttp `Call` is cancelled; the retry loop re-runs on a fresh socket (new TCP handshake) and the upload completes. No `readTimeout` kills a slow-but-progressing transfer (the upload client uses `readTimeout(0)` / `callTimeout(0)`; the 30 s watchdog is the only stall handler).
- [ ] **MSS clamp takes-or-no-ops (UP-19) — the UNRELIABLE half, Pitfall 7.** During a PUT on a real device, check `adb logcat | grep -i 'MssSocketFactory\|TCP_MAXSEG\|setsockopt\|ErrnoException'` — see whether the `setsockopt(TCP_MAXSEG, 1280)` clamp actually takes. If it `ErrnoException`s / is silently a no-op (common on a hidden-API-blocked socket), **NOTE it** — the 30 s no-progress watchdog carries UP-19 alone and the clamp can be dropped; this is a known-flaky best-effort optimization, not a gate.
- [ ] **Drift telemetry recorded (CLAUDE.md banner — NOT a gate).** Confirm the uploaded `metadata.json` for a smoke recording carries the three `imu_video_drift_{max,mean,p99}_ms` figures (on the Phase-4 ultrawide path these are ~1.7–6.2 ms — that's expected and accepted; do **not** block sign-off on them). `aws --endpoint-url=http://localhost:4566 s3 cp s3://humyn-recordings-dev/<the metadata.json key> - | python3 -m json.tool | grep -i drift`.

---

## §6 Sign-off

- [ ] **Verdict:** YES / NO. Note the device model + OS version + build flavor used for the walk (and any second device used for §5 OEM/CGNAT checks).
- [ ] **Findings:** any failure or cosmetic nit goes to a `*-COSMETIC-GAPS.md` (the §7 amendments protocol — a Phase-5 `05-COSMETIC-GAPS.md` for Phase-5-owned surface), **never** into the FROZEN Phase-2/3/4 amendment files. Functional regressions block this sign-off and get a `/gsd-debug` session, not an amendment-file entry.

### Walk log

- **2026-05-13 — backend half of §2 + §3 (no device): PASS, no findings.** Automated probe against the dev stack (`humyn-postgres` + `humyn-redis` + `humyn-localstack` + the real `tsx src/workers/hash-verify.ts` worker process). Exercised: `POST /recordings/init` (201) → `PUT` video+IMU parts to LocalStack presigned URLs → `PUT metadata.json` → `POST /recordings/:id/finalize` (200, `qa_status` pending→uploaded, `ip_address` server-populated — UP-18) → (dev `/finalize` shim) `enqueueVerify` → BullMQ worker re-hashed the S3 bytes → `qa_status='verified'` + `verified_at` (§2) → `GET /me` carried `_events: [{recording_id, event_type:'verified'}]`, second `GET /me` did not re-carry it (delivered). Hash-mismatch (§3): a recording that claimed a deliberately-wrong `file_sha256` at `/init` → worker → `qa_status='hash-mismatch'` → `_events: [{…, event_type:'re-upload'}]` → `POST /recordings/:id/reupload` (200) → row reset to `qa_status='pending'` with a fresh `s3UploadId`, `verified_at` cleared. Phase-5 gap-closure routes: a duplicate `POST /recordings/init` on a `pending` row → 200 with the SAME `uploadId` (CR-02 idempotent `/init` / lost-201 self-heal); `POST /recordings/:id/parts` → 200, re-presigned video against the existing `uploadId`, row unmutated (CR-02 new re-presign route). `recordings_to_verify` drained on both the verified and the mismatch row. **Still pending — the on-device half:** record on real Pixel 7a/8a-class hardware, FGS survival through background+force-quit (`dataSync` notification), the local mp4/csv/json delete via `HumynUpload.clearVerified` on the `verified` event, the app-relaunch reconciliation sweep, the logout/re-login owner-pin (§4), and all of §5 (OEM deep-links, Doze, the Android-15 `onTimeout` handoff, the CGNAT MSS-clamp + 30 s watchdog).

---

## §7 Amendments protocol (D-WAVE-09 pattern)

New **cosmetic** gaps surfaced during this smoke walk (visual nits, copy tweaks, spacing) go into a NEW file: `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` (create it on first use). They are picked up either by Phase 6's plan-phase (it may roll them into an early plan) OR by a dedicated Wave-fix-up plan before Phase 6 starts — per memory `feedback_functionality_first_during_smoke.md` (do NOT rebuild mid-smoke; defer cosmetics to a later cleanup wave).

**Never** write Phase-5 amendments back into the FROZEN `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-COSMETIC-GAPS.md`, `.planning/phases/03-humyn-capture-native-module/03-W1-AMENDMENTS.md`, or `.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-COSMETIC-GAPS.md` — those are closed.

Functional regressions (broken behavior, spec violations) are NOT cosmetic — they block §6 sign-off and get a debug session (`/gsd-debug`), not an amendment-file entry.

---

## Note — the UP-08 iOS clause

Per Plan 05-02's runbook note: UP-08's iOS clause (the iOS `URLSession` background-config upload path + the iOS native-module analogues) is a **documented gap** — nothing iOS is built in Phase 5 (MVP is Android-only via the signed APK; the iOS App Store channel is deferred — see CLAUDE.md "MVP descoped 2026-05-11" + `.planning/REQUIREMENTS.md` §v2 IOS-01..07). This runbook is Android-only by design.
