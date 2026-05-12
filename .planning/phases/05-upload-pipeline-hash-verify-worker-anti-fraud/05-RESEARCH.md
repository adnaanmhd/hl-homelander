# Phase 5: Upload Pipeline & Hash-Verify Worker — Research

**Researched:** 2026-05-12
**Domain:** Android background upload pipeline (S3 multipart from a native module surviving Android 14/15 FGS restrictions + OEM battery managers) + a Node BullMQ-on-Redis hash-verify worker fed by S3→EventBridge→SQS + a server→client event-piggyback channel + a cosmetic/cleanup pass (Wave 1)
**Confidence:** HIGH on backend wiring + Android FGS rules (verified against Phase-1 code, AOSP docs, npm); MEDIUM on OEM deep-link intent strings (the OEM ROMs change them and many newer ROMs block them — fall back to AOSP); MEDIUM on TCP_MAXSEG reachability from Java/Kotlin sockets (the literal `TCP_MAXSEG=1280` is a SYN-time option that's hard to set portably — see Pitfall 7).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-04 — ALL anti-fraud is descoped to §v2.** FRAUD-05 (per-account daily upload-rate cap) and FRAUD-06 (pre-payout fraud monitoring dashboard) move to REQUIREMENTS.md §v2 alongside the already-deferred FRAUD-03/04. MVP anti-fraud stays exactly `idea-brief.md §11`: Play Integrity at sign-in + the on-device one-shot hand gate. **Nothing new.**
- **D-04a — No per-account upload-rate cap of any kind at MVP** — not a fraud cap, not a "generous safety cap". The upload path is fully uncapped per account. No server-side rejection-on-cap logic, no client-side "retry tomorrow" path.
- **D-04b — No fraud dashboard** — no web UI, no admin API route, no scheduled export job, no SQL-views deliverable. (Bull-Board for the worker queue is a separate Phase-7 observability item, unaffected.)
- **D-04c** — `recordings.flavor` column stays (also build-cohort analysis for Phase 7). `recordings.liveness_score` column stays (harmless; stays NULL at MVP). No schema changes needed for the descope.
- **D-04d** — Roadmap/requirements housekeeping the planner should fold in: re-title the phase to **"Upload Pipeline & Hash-Verify Worker"**; move FRAUD-05/06 to §v2 in REQUIREMENTS.md with a dated note; update the §v2 "Anti-fraud" group; trim the Phase 5 ROADMAP success criterion #5 (the fraud-surface bullet) and the requirements list (drop FRAUD-05, FRAUD-06). (Directory slug stays `05-upload-pipeline-hash-verify-worker-anti-fraud`.)
- **D-03 — Crash-recovered segments are DISCARDED, never uploaded.** `CaptureLaunchSweep` discards ALL crash-truncated fragments, not just the sub-30 s `ftyp`+`moov` stubs. The post-30 s fragment is deleted (mp4 + csv + `.session.json` sidecar) on next launch instead of being re-finalized. No degenerate bundle ever reaches the upload queue.
- **D-03a — The ROADMAP's "Phase 5's upload path should tolerate `duration_seconds: 0` + null drift" note is RESCINDED.** The upload-bundle validation / hash-verify worker do NOT need to special-case `duration_seconds: 0` or null drift. (A belt-and-suspenders guard against a malformed bundle is fine but not a requirement.)
- **D-03b** — The `CaptureLaunchSweep` change goes in **Wave 1** (capture/recovery code, not the upload pipeline). Reconcile D-03 with the D-07 toast: if no recovery path can produce an upload-able segment any more, the "recovered — uploading" toast is dead code and D-07 is moot. **Verify against the actual `CaptureLaunchSweep` / `bootRecoveryListener.ts` code.** _(This research has done that — see "Runtime / Code Reconciliation" below: D-03 does NOT make the toast dead — the `tryReFinalize` path still produces a "recovered" triple; D-03 says delete it. So the recovery path needs an active edit to delete instead of re-finalize, and then the toast IS dead and the D-07 work collapses to "annotate the file so nobody re-bumps it" or "remove the toast wiring entirely" — planner's call.)_
- **D-05** — Device-distress mid-record stop (battery ≤5 % REC-11, or thermal abort) — **navigate to Home** after finalizing, instead of resetting to RecordingScreen-`'ready'`. Normal sub-60 s discard keeps current behavior (re-pressing record starts a fresh recording). Edge to resolve in planning: a _practice_ recording mid-onboarding that hits device-distress — planner picks the sane destination (resume onboarding vs Home), keep it simple.
- **D-06** — Alert-cue tones (`HumynBeep.playTone`) — **re-check on hardware with media volume turned up** (they were inaudible at ~3.6 % media volume, the TTS cue rode a louder path and was audible). Action = a verification step in the Wave-1 smoke runbook; only chase a `HumynBeep`/SoundPool fix if still silent at full media volume.
- **D-07** — Crash-recovery toast — **keep the current architecture** (fires from `App.tsx`'s mount effect during splash bootstrap; `<ToastHost />` is a navigator sibling so the pill persists across splash → Home) **but set the toast duration back to 5 s** (down from the 15 s workaround). Do NOT do the "stash + trigger from Home mount" refactor. Annotate `bootRecoveryListener.ts` so a future contributor doesn't re-bump it. **See D-03b** — if D-03 makes the recovery path produce nothing upload-able, this toast may be dead; reconcile.
- **D-08** — `is_practice` in the finalized metadata JSON — **leave it out.** Practice recordings stay segregated by the `files/practice/` directory + `task_id == __practice__`; the `.session.json` sidecar keeps its `is_practice` field, the finalized `{base}.json` does not gain one. The Phase-5 upload filter keys off the `files/practice/` path + `task_id == __practice__`.
- **D-09** — The doc-only polish bucket from `04-COSMETIC-GAPS.md` ships in Wave 1: refresh stale `04-MANUAL-SMOKE.md` §2/§3 step text (120 ms not 80 ms vibrate; en-US female not en-IN; 2 × 250 ms gate dwell not 5 × 400 ms; live camera preview from `'ready'` onward; `onSegmentStart`/`onSegmentComplete` are the RN-bridge events, not `onSessionStart`/`onSessionStop` logcat lines; no `is_practice` in finalized metadata); reflect shipped owner deviations into `design-spec.md §6` / `04-UI-SPEC.md § Copywriting` (PracticeIntro shortened copy commit `eaaa1fe`; en-US female cue voice; RigTutorial camera-framing tip); eyeball the `RotatePrompt.tsx` portrait-phone glyph on-device. The two items already FIXED in the `/gsd-debug phase4-smoke-fixes` round need nothing.
- **D-10** — The upload-queue screen (UP-12) is **built by reusing the existing History row layout** (`design-spec.md §13`/§16: 64×64 thumbnail + name 15/600 + meta line 12 px secondary + status chip). **No `/gsd-ui-phase 5`.** `design-spec.md §21.7` flags the screen's states (queued / paused-no-wifi / failed-with-retry / completed) as a TBD → resolve them inside the locked design system: reuse `chip-progress` "Uploading…", `chip-failed` "Upload failed", `chip-success` "✓ Uploaded", and add **one** new chip variant in the identical style for "Paused — no Wi-Fi" (offline). The Home "Pending uploads" tile already exists in `prototype.html`/`design-spec.md §14` (returning-state) — wire it to real data; its `count > 0` visibility logic + pull-to-refresh + offline banner are explicitly **Phase 6's** job, not Phase 5.
- **D-10a** — No new visual language, no new tokens, no animation curves beyond what `design-spec.md` already defines. New-state copy strings match the History/upload-status vocabulary already in `design-spec.md` (and `help-center-content.md`'s "Pending uploads" mentions).

### Claude's Discretion

- The exact wire shape of the server→client event-piggyback channel (a per-user events-outbox table drained on each authenticated response via an `onSend` hook? response-envelope key vs. header? at-least-once with client-side idempotency on `recording_id` + event-type?) — researcher/planner's call, grounded in `engineering-handoff.md` and the existing API response patterns. The behavioral contract is fixed (VERIFY-03/04/05, UP-14/15/16, VERIFY-06); the mechanism is not. **→ This research recommends a `recording_events_outbox` table + an `onSend` hook on authenticated responses with a `_events` response-envelope key — see Pattern 3.**
- The dev-environment wiring for the hash-verify worker (a local Redis container in `docker-compose.yml` + a worker process you run locally + LocalStack EventBridge→SQS? or a simpler synchronous "poll S3 / call the worker inline" dev shim?) — researcher's call. **CLAUDE.md tension to resolve:** "Do NOT Use → Redis at MVP — Postgres-only; queue lives on device" refers to the _upload_ queue (on-device, MMKV-backed); the _hash-verify worker_ queue is BullMQ-on-Redis-on-ECS per VERIFY-01/07 and the ROADMAP. The planner should add a one-line carve-out to CLAUDE.md's "Do NOT Use" entry (or Conventions) so this isn't read as a contradiction, and add the Redis/BullMQ pin to `research/STACK.md` if missing. **→ This research recommends: add a Redis container to `docker-compose.yml` and run the worker locally; in dev, skip LocalStack EventBridge and have `/recordings/:id/finalize` enqueue the BullMQ job directly (the `recordings_to_verify` Postgres row is the durable fallback). In prod, S3→EventBridge→SQS→a tiny SQS-poller→`queue.add()`. See Pattern 2 + the Dev/Infra section.**
- The reconciliation-sweep backend surface (a new query param on `GET /recordings` filtering `qa_status = 'verified' AND id IN (...)`? a dedicated `GET /recordings/verified` since-cursor endpoint? piggy-back the verified set on an existing response?) — planner's call. **→ This research recommends a dedicated `GET /recordings/verified-ids?since=<cursor>` returning `{ ids: string[], next_cursor }` — see Pattern 4.**
- Whether the upload-queue screen also surfaces _completed-this-session_ rows briefly (the History pattern shows `chip-success`) or drops a row the moment its bundle is `verified` — planner's call within the design system.

### Deferred Ideas (OUT OF SCOPE)

- **All MVP anti-fraud beyond Play Integrity + the on-device hand gate → §v2 (Anti-fraud).** FRAUD-05 (per-account daily upload-rate cap), FRAUD-06 (pre-payout fraud dashboard — hash-mismatch rate / account-fingerprint clustering / OEM-region anomalies / `liveness_score` panel), plus the already-deferred FRAUD-03 (server-side IMU-liveness check) / FRAUD-04 (`liveness_score ∈ [0,1]` rollup), per-upload Play Integrity attestation, perceptual-hash duplicate detection, device-fingerprint binding, liveness gestures. The upload bundle still carries the IMU CSV (training consumes it); it is just not analysed server-side at MVP.
- **The "stash recovered list + trigger the toast from post-bootstrap / Home mount" proper fix** — rejected for MVP (D-07 keeps the App.tsx-mount workaround at 5 s). If the toast survives D-03's reconciliation at all, the refactor is a §v2 nicety.
- **A polished, bespoke upload-queue screen** beyond the History-row reuse — D-10 keeps it inside the existing design system.
- **iOS upload path** (`URLSessionConfiguration.background`, the iOS native-module analogues) — already §v2 (IOS-01..07); UP-08's iOS clause is **not built** this phase — document the gap only.
- **Switching the hash-verify worker from BullMQ-on-ECS to S3-EventBridge→Lambda** — explicitly a §v2 concern per VERIFY-07; MVP is BullMQ + ECS, autoscaled on queue depth.
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID                         | Description                                                                                                                                                                                       | Research Support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| UP-01                      | Each segment's 3 files (MP4 + IMU CSV + metadata JSON) upload via S3 multipart with presigned URLs                                                                                                | Backend already mints them — `recordings/init.ts` (video multipart parts, IMU multipart parts, metadata single PUT). `HumynUpload` is the _client_. Pattern 1 + Code Examples.                                                                                                                                                                                                                                                                                                                                                                                                    |
| UP-02 `[research]`         | Chunk size = 8 MB Wi-Fi (last chunk may be smaller); 2 MB cellular                                                                                                                                | `ConnectivityManager.getNetworkCapabilities(activeNetwork).hasTransport(TRANSPORT_CELLULAR)`. **Caveat:** `partsCount` is fixed at `/init` time and the same count covers video + IMU — chunk-size choice affects how many of those `partsCount` part-URLs the client actually uses. Pattern 1 + Pitfall 2.                                                                                                                                                                                                                                                                       |
| UP-03                      | Concurrency = 3 chunks parallel per file × 2 files parallel                                                                                                                                       | A bounded semaphore (max 6 concurrent PUTs split 3/3). Pattern 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UP-04                      | Failed chunks retry independently, exp backoff 2/4/8/16/32/64 s → dead-letter; no whole-file restart                                                                                              | Per-part state in the MMKV queue (`partN: pending                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | done | failed`, `retryCount`). After 64 s attempt fails → mark recording `dead-letter`locally + surface`chip-failed` "Upload failed". Pattern 5. |
| UP-05                      | Uploads start automatically once a recording stops                                                                                                                                                | `HumynUpload.enqueue(recordingId, paths)` called from `HumynCapture`'s finalize path. Integration Points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UP-06 `[research]`         | Uploads run in an FGS that survives backgrounding/force-quit; Android 14+ type downgrades `camera\|microphone\|dataSync` → `dataSync` → stops after 5 min idle                                    | Re-use `HumynForegroundService` — the `ACTION_SET_UPLOAD_ACTIVE` intent seam already exists. **The type-downgrade is a stop+restart of `startForeground` with the new bitmask** (you can't shrink a running FGS's type set in place — see Pitfall 4). Code Examples + Pitfall 4.                                                                                                                                                                                                                                                                                                  |
| UP-07 `[research]`         | Android 15+: true-background uploads via a UIDT JobService (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS`) to survive the 6-hr `dataSync` cap                                              | `JobInfo.Builder(...).setUserInitiated(true).setRequiredNetworkType(NETWORK_TYPE_ANY)`; the FGS handles `Service.onTimeout(int,int)` by `stopSelf()` then schedules the UIDT job. Pitfall 5 + State of the Art.                                                                                                                                                                                                                                                                                                                                                                   |
| UP-08                      | iOS: `URLSessionConfiguration.background(...)` + `sessionSendsLaunchEvents=true` + `isDiscretionary=false`; multipart-complete POST as a foreground `dataTask` inside `urlSessionDidFinishEvents` | **OUT OF SCOPE this phase (iOS deferred §v2).** Document as a gap. No `HumynUploadIOS` built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| UP-09 `[research]`         | First-upload battery-optimization exemption + OEM-specific walkthrough (Xiaomi/Oppo/Vivo/Samsung/stock)                                                                                           | `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (AOSP) + best-effort `resolveActivity`-gated deep-links to OEM autostart screens — many newer ROMs have removed/renamed the components, so **always fall back to the AOSP battery-optimization settings screen**. Pattern 6 + Pitfall 1 + Code Examples.                                                                                                                                                                                                                                                                            |
| UP-10                      | Uploads pause during active recording and resume on stop                                                                                                                                          | `HumynUpload.pause()` from `HumynCapture.start()`, `.resume()` from `.stop()` — coordinate via the FGS upload-active flag. Integration Points.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| UP-11                      | User cannot manually cancel an upload                                                                                                                                                             | No cancel affordance on the queue screen; queue rows are read-only. D-10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UP-12                      | Per-file upload progress visible: Pending Uploads tile → upload-queue screen (filename / duration / thumbnail / state)                                                                            | Reuse History row layout (D-10). Per-file rows. Architecture Patterns + the UI section.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| UP-13                      | Logout cancels in-flight upload but preserves the local queue; same-user re-login resumes                                                                                                         | On logout: abort in-flight PUTs, keep the MMKV queue + local files; on login with the same `sub`, resume. The MMKV instance is per-app (not per-account) so cross-account leakage must be guarded — store the owning `userId` on each queue row and only resume rows whose owner == the logged-in `sub`. Pitfall 8.                                                                                                                                                                                                                                                               |
| UP-14                      | Local files NEVER deleted before backend posts `verified` for that segment                                                                                                                        | Delete only on the `verified` event (or the reconciliation sweep finding it `verified`). Pattern 3 + Pattern 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| UP-15                      | On `verified` event → app deletes local MP4 + CSV + JSON for that segment                                                                                                                         | Pattern 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| UP-16                      | On `re-upload` event (hash mismatch) → app re-uploads from the still-present local copy                                                                                                           | Re-`/init` the recording? **No** — the row already exists; need a re-upload entry point. See Open Question 2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| UP-17                      | Cellular uploads allowed by default at MVP (no Wi-Fi-only toggle)                                                                                                                                 | No toggle. Cellular uploads proceed; the only cellular-specific behavior is 2 MB chunks (UP-02) + TCP_MAXSEG/no-progress-abandon (UP-19).                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UP-18                      | Client sends `null` for `ip_address`; server populates from request headers                                                                                                                       | Already wired: `RecordingsInitRequestSchema` has no `ipAddress`, `RecordingCreateSchema` has `ipAddress: z.null()`, the `recordings.ipAddress` column is nullable + server-populated. Phase 5 should actually populate it (currently `toRecordingResponse` hard-codes `ipAddress: null`). Open Question 3.                                                                                                                                                                                                                                                                        |
| UP-19 `[research]`         | TCP_MAXSEG=1280 + 30 s no-progress abandon-and-retry-with-fresh-socket on cellular (defeat MTU-blackhole retry storms on Jio CGNAT / Vivo Brasil)                                                 | The literal `TCP_MAXSEG=1280` socket option is **not reliably settable from Java/Kotlin** — `java.net.Socket`/OkHttp expose no MSS knob, and `android.system.Os.setsockoptInt` can't reach an OkHttp-managed socket's fd before `connect()`. **Recommendation: ship the 30 s no-progress watchdog (the reliable, portable half) as the primary defense; treat literal MSS-clamping as best-effort via an OkHttp `socketFactory` that calls `setsockopt` in `createSocket()` before connect — and verify on-device whether it actually takes (it may silently no-op).** Pitfall 7. |
| VERIFY-01 `via [research]` | Worker subscribes to S3 multipart-complete events via EventBridge → SQS → BullMQ on Redis                                                                                                         | Pattern 2 + Dev/Infra. In dev, the EventBridge→SQS leg is shimmed (finalize enqueues directly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| VERIFY-02                  | Worker re-hashes the MP4 and the IMU CSV from S3, compares to `file_sha256`/`imu_sha256` from the metadata JSON                                                                                   | Streaming `crypto.createHash('sha256')` over `GetObject().Body` (Node Readable). Read the _metadata JSON_ object too, parse, compare against `metadata.file_sha256` / `metadata.imu_sha256` (and the `recordings.fileSha256`/`imuSha256` columns — they should agree). Pattern 8 + Code Examples.                                                                                                                                                                                                                                                                                 |
| VERIFY-03                  | On match → `qa_status = 'verified'`, emit `verified` event for the client                                                                                                                         | `recording-state.canTransition('uploaded','verified')` already allowed. Worker writes the outbox row in the same tx. Pattern 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| VERIFY-04                  | On mismatch → `qa_status = 'hash-mismatch'`, emit `re-upload` event                                                                                                                               | `canTransition('uploaded','hash-mismatch')` allowed. Pattern 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| VERIFY-05                  | Verified events delivered piggy-backed on every API response (no FCM/APNs at MVP)                                                                                                                 | Pattern 3 — `onSend` hook drains `recording_events_outbox` for `req.user.sub` into `reply` envelope's `_events` key (or a header).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| VERIFY-06 `[research]`     | App-launch reconciliation sweep queries backend for the verified-but-undeleted set and deletes local files                                                                                        | Pattern 4 — `GET /recordings/verified-ids?since=...`; client diffs against its MMKV queue, deletes local triples for any `verified` recording it still has.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| VERIFY-07                  | Worker scales on queue depth (BullMQ + ECS at MVP; S3 EventBridge → Lambda is a v2 concern)                                                                                                       | ECS service-autoscaling on a CloudWatch custom metric "BullMQ waiting count" (or "SQS ApproximateNumberOfMessages / running tasks"). Infra; not deeply coded in Phase 5 — the worker just needs to be horizontally safe (BullMQ workers are by design). State of the Art.                                                                                                                                                                                                                                                                                                         |
| FRAUD-05                   | Per-account daily upload-rate cap                                                                                                                                                                 | **DESCOPED to §v2 (D-04/D-04a). Not built. Note the descope in the plan and move on.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| FRAUD-06                   | Pre-payout fraud monitoring dashboard                                                                                                                                                             | **DESCOPED to §v2 (D-04/D-04b). Not built. Note the descope.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

</phase_requirements>

---

## Summary

Phase 5 has four moving parts and a Wave-0/Wave-1 cleanup pass. (1) **Wave 1** is the cosmetic/cleanup pass that runs FIRST — `04-COSMETIC-GAPS.md` doc polish, the `CaptureLaunchSweep` discard change (D-03), device-distress→Home nav (D-05), the recovery-toast duration revert + annotation (D-07, after the D-03 reconciliation), the `is_practice`-stays-out doc note (D-08), and the on-hardware re-checks (D-06 tones, D-09 rotate glyph). (2) **`HumynUpload`** is a new Android Kotlin native module that is the _client_ of the already-shipped Phase-1 multipart backend (`/recordings/init` → presigned part URLs → direct S3 PUTs → `/recordings/:id/finalize`). The hard parts are all OS-survival: running inside the existing `HumynForegroundService` with a _type downgrade_ from `camera|microphone|dataSync` to `dataSync` post-recording (which on Android 14+ means a stop+restart of `startForeground` with a smaller bitmask, not an in-place shrink), a UIDT `JobService` for true-background work past the Android-15 6-hour `dataSync` cap, an OEM battery-optimization walkthrough that **must not assume the deep-link components still exist** (newer MIUI/ColorOS/FunTouch ROMs have removed or renamed them — always fall back to the AOSP screen), and an MMKV-backed queue that survives app kill plus an app-launch reconciliation sweep. (3) The **hash-verify worker** is a new Node process in the existing `apps/api` codebase (same Docker image, different entrypoint `node dist/workers/hash-verify.js`) using `bullmq` on Redis, fed by S3 → EventBridge → SQS → a thin SQS-poller in prod, and by a direct `queue.add()` from `/recordings/:id/finalize` in dev (the existing `recordings_to_verify` Postgres row is the durable fallback either way); it streams-SHA-256 the MP4 + IMU CSV from S3, compares to the metadata-JSON hashes, flips `qa_status`, and writes a `verified`/`re-upload` row into a new `recording_events_outbox` table. (4) The **server→client event channel** is that outbox table drained by a Fastify `onSend` hook on authenticated responses, delivered in a `_events` response-envelope key, at-least-once, with client-side idempotency on `(recording_id, event_type)` — on `verified` the app deletes the local triple, on `re-upload` it re-uploads from the still-present copy.

Note that **all anti-fraud is descoped (D-04)** — FRAUD-05 and FRAUD-06 are out, nothing anti-fraud-flavoured gets added, and the upload path is fully uncapped per account at MVP. **iOS is out** (UP-08 documented as a gap). **The `[research]`-tagged items have real gotchas** — the OEM deep-links are fragile (Pitfall 1), the literal `TCP_MAXSEG=1280` is barely reachable from a JVM socket (Pitfall 7), and the Android 14 FGS-type-downgrade has non-obvious semantics (Pitfall 4).

**Primary recommendation:** Wave 1 (cleanup) → Wave 2 backend (Redis + `bullmq` worker + outbox table + EventBridge/SQS infra + dev shim) ∥ Wave 3 mobile (`HumynUpload` module + FGS lifecycle + OEM walkthrough + MMKV queue) → Wave 4 (Pending Uploads UI + reconciliation sweep + wire-up + smoke). Backend and mobile are file-disjoint and parallel-OK; the UI/sweep wave depends on both.

---

## Architectural Responsibility Map

| Capability                                                                                          | Primary Tier                                                                                    | Secondary Tier                                                    | Rationale                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chunk-PUT transfer, retry/backoff, queue persistence, FGS/UIDT survival                             | Android native module (`HumynUpload` Kotlin)                                                    | —                                                                 | Must survive RN-runtime teardown + process kill; can't live in JS. The existing `HumynCapture`/`HumynForegroundService` are the precedent.                                         |
| Upload queue model (which recordings, per-file part state), app-launch reconciliation orchestration | Android native module + RN/JS bridge                                                            | MMKV (storage)                                                    | Native owns active transfers + writes the durable queue; JS reads the queue for the Pending-Uploads UI and triggers the reconciliation sweep on cold start / foreground rehydrate. |
| Presigned-URL minting, multipart `CompleteMultipartUpload`, `qa_status` state machine               | Fastify HTTP API (`apps/api`)                                                                   | —                                                                 | Already shipped (Phase 1) — `recordings/{init,complete-part,finalize}.ts`. Server never reads bytes.                                                                               |
| S3 object bytes → re-hash → `qa_status` flip → outbox write                                         | Hash-verify worker (Node, separate ECS task, same `apps/api` image)                             | Redis (BullMQ broker), Postgres (state)                           | The **one** component allowed to read recording bytes (read-only). Scales on queue depth independent of HTTP traffic.                                                              |
| S3 multipart-complete event → queue                                                                 | AWS S3 → EventBridge → SQS → thin SQS-poller → BullMQ (prod); `/finalize` → `queue.add()` (dev) | `recordings_to_verify` Postgres table (durable fallback for both) | EventBridge is the "object landed" signal AWS gives for free; LocalStack's S3-notification path is flaky enough that a dev shim is cleaner (Pitfall 9).                            |
| `verified` / `re-upload` event delivery to client                                                   | Fastify `onSend` hook on authenticated responses (`_events` envelope key)                       | `recording_events_outbox` Postgres table                          | No FCM/APNs at MVP (CLAUDE.md / `idea-brief.md §13`). Piggy-back on the next API call.                                                                                             |
| Local-file deletion on `verified`                                                                   | Android native (or JS) consuming the `_events` payload                                          | —                                                                 | Files live on device FS; the delete is a `react-native-fs` unlink of the triple.                                                                                                   |
| Pending Uploads screen + Home tile real data                                                        | RN/JS screens (`apps/mobile/src/screens/`)                                                      | `HumynUpload` queue-state events                                  | Pure presentation; reuses the History row + chip vocabulary (D-10).                                                                                                                |
| Battery-optimization exemption prompt + OEM walkthrough                                             | Android native (intent dispatch) + RN/JS (the walkthrough screen copy)                          | —                                                                 | Needs `Context`/`PowerManager`/`PackageManager`; the screen is RN.                                                                                                                 |

---

## Standard Stack

### Core — new for Phase 5

| Library                       | Version                                                                                                                                                                  | Purpose                                                                                | Why Standard                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bullmq`                      | **5.76.8** (verified `npm view bullmq version`, 2026-05-12)                                                                                                              | The hash-verify worker queue (Redis-backed, retries, concurrency, queue-depth metrics) | Industry-standard Redis job queue for Node; the ROADMAP/STACK/ARCHITECTURE research already names it; supersedes `bee-queue`/`bull` v3. `[VERIFIED: npm registry]`                             |
| `ioredis`                     | **5.10.1** (verified `npm view ioredis version`, 2026-05-12)                                                                                                             | Redis client BullMQ uses (`connection: { host, port }` or an `ioredis` instance)       | BullMQ's documented/recommended client. `[VERIFIED: npm registry]`                                                                                                                             |
| `@aws-sdk/client-sqs`         | **3.1045.0** (verified, 2026-05-12) — **pin to the same minor as the existing `@aws-sdk/client-s3@3.1044.0`** (CLAUDE.md: "always same minor"). Use `3.1044.0` to match. | The thin SQS-poller (prod) — `ReceiveMessage` long-poll, `DeleteMessage` on success    | AWS SDK v3 modular; consistent with the existing `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + `@aws-sdk/client-secrets-manager` all pinned at 3.1044.x. `[VERIFIED: npm registry]` |
| `@aws-sdk/client-eventbridge` | **3.1044.x** (match the S3 client minor) — _only if Phase 5 manages the EventBridge rule programmatically_; otherwise Terraform owns it and no SDK dep is needed.        | EventBridge rule wiring (optional — Terraform is the preferred surface)                | Same v3-modular convention. Likely **not needed** — put the rule in `infra/terraform/`. `[ASSUMED]`                                                                                            |
| Redis                         | **7.x** (ElastiCache `cache.t4g.micro` prod; `redis:7-alpine` container dev)                                                                                             | BullMQ broker                                                                          | Redis 7+ is the BullMQ baseline; ARCHITECTURE research says "Redis 7+, single replica at MVP". `[CITED: .planning/research/ARCHITECTURE.md]`                                                   |

### Mobile — already pinned (CLAUDE.md), used by `HumynUpload`

| Library                    | Version                                                  | Purpose                                                                                                                                                                                      | Notes                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-mmkv`        | 4.3.1 (pinned)                                           | The on-device upload-queue persistence (survives app kill)                                                                                                                                   | A dedicated MMKV instance, e.g. `id: 'uploads'`. Encrypted-but-not-secrets — fine for a queue index. NOT AsyncStorage (CLAUDE.md "Do NOT Use").                                                                             |
| `react-native-fs`          | 2.20.0 (pinned)                                          | Read the local triple for SHA-256-on-device (already done by `HashStreamer.kt` at capture time — Phase 5 just _uploads_ the bytes), and `unlink` the triple on `verified`                    | The hashes are already in the metadata JSON; the upload module doesn't re-hash, it streams the file as the PUT body.                                                                                                        |
| OkHttp                     | bundled with RN (`okhttp` is RN's HTTP stack on Android) | The chunk-PUT transport — per-part `PUT` with the file-range body, ETag from the response header                                                                                             | Use OkHttp directly from Kotlin (not `fetch` from JS — JS can't survive process kill). Streaming request body via `RequestBody.create(...)` over a `RandomAccessFile`-backed source so a 4 GB MP4 isn't loaded into memory. |
| `react-native-permissions` | (pinned, used for camera perms today)                    | `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is _not_ a runtime permission — dispatch it as an `Intent` from Kotlin; `react-native-permissions` is not the tool here. Note for the planner. | —                                                                                                                                                                                                                           |

### Alternatives Considered

| Instead of                                   | Could Use                                                   | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bullmq`                                     | `aws-sdk` SQS-consumer directly (no Redis)                  | The ROADMAP **locks** BullMQ-on-Redis-on-ECS for VERIFY-01/07; switching to "S3 EventBridge → Lambda" is explicitly a §v2 concern. SQS-only would lose BullMQ's retry/backoff/concurrency ergonomics and the queue-depth metric BullMQ exposes for autoscaling. Don't deviate.                                                                                                                                                                                                                           |
| Per-part-state in MMKV                       | A SQLite DB on device                                       | MMKV is already a pinned dep and the queue is small (a few rows × a few hundred part-states). SQLite is heavier and not in the stack.                                                                                                                                                                                                                                                                                                                                                                    |
| `react-native-fs` streaming PUT body         | Loading the file into a JS `Blob` and `fetch`-PUT           | A JS `fetch` dies when the RN runtime is torn down on backgrounding/kill — the whole point of `HumynUpload` is to survive that. Native OkHttp from a foreground-service thread.                                                                                                                                                                                                                                                                                                                          |
| Server-side re-hash by streaming `GetObject` | Lambda triggered by S3, or S3's own `x-amz-checksum-sha256` | The locked design is "phone SHA-256s → server re-hashes" (`idea-brief.md §7.3`) — S3's built-in checksums are CRC32/CRC32C/SHA1/SHA256 _but only if the uploader requested them_, and the multipart-complete checksum is a checksum-of-checksums, not a whole-object SHA-256. The worker must do a full streaming re-hash. (Also: `s3-client.ts` deliberately runs `requestChecksumCalculation: 'WHEN_REQUIRED'` for LocalStack compat — S3 checksums aren't a reliable signal in this codebase anyway.) |

**Installation (backend):**

```bash
cd apps/api
pnpm add bullmq ioredis @aws-sdk/client-sqs@3.1044.0
# (@aws-sdk/client-eventbridge only if managing the rule in code rather than Terraform — prefer Terraform)
```

**Version verification done (2026-05-12):**

- `bullmq` → **5.76.8** (latest) `[VERIFIED: npm registry]`
- `ioredis` → **5.10.1** (latest) `[VERIFIED: npm registry]`
- `@aws-sdk/client-sqs` → **3.1045.0** latest; **pin 3.1044.0** to match the existing S3 client minor per CLAUDE.md `[VERIFIED: npm registry]`
- `@aws-sdk/client-eventbridge` → 3.1045.x latest; pin 3.1044.0 if used `[VERIFIED: npm registry]`

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────── ANDROID DEVICE ──────────────────────────────┐
                    │                                                                          │
  HumynCapture      │  finalize() produces {base}.{mp4,csv,json} triple + recording_id         │
  finalize ─────────┼──▶  HumynUpload.enqueue(recordingId, paths)                               │
                    │         │                                                                │
                    │         ▼  writes a queue row → MMKV instance 'uploads'                   │
                    │   ┌──────────────────────┐  { recordingId, ownerUserId, paths,            │
                    │   │ MMKV upload queue     │    state, perFilePartState[], retryCount }     │
                    │   └──────────────────────┘                                                │
                    │         │ drained by                                                      │
                    │         ▼                                                                 │
                    │   ┌──────────────────────────────────────────────┐                        │
                    │   │ HumynUploadService thread (inside the         │  paused while          │
                    │   │ existing HumynForegroundService —             │  HumynCapture is        │
                    │   │ FGS type DOWNGRADES camera|mic|dataSync →     │  recording (UP-10)     │
                    │   │ dataSync after record stops; stops after      │                        │
                    │   │ 5 min idle; UIDT JobService re-schedules      │                        │
                    │   │ true-background work past the 6 h cap)        │                        │
                    │   └──────────────────────────────────────────────┘                        │
                    │         │ 1. POST /recordings/init  (or re-use existing row on re-upload) │
                    └─────────┼──────────────────────────────────────────────────────────────┬─┘
                              │ 2. PUT each part → S3 directly (presigned URLs)               │
                              │    8 MB Wi-Fi / 2 MB cellular; 3 parts ∥ × 2 files ∥;         │
                              │    per-part retry 2/4/8/16/32/64 s → dead-letter;              │
                              │    30 s no-progress ⇒ abandon socket, retry fresh             │
                              │ 3. POST /recordings/:id/parts/:n/complete (state probe)        │
                              │ 4. POST /recordings/:id/finalize  (ETags) ───────────────┐    │
                              ▼                                                           │    │
  ┌───────────────────────────────────────────┐                                          │    │
  │ Fastify HTTP API (apps/api, N ECS tasks)  │   server-side CompleteMultipartUpload     │    │
  │  - mints presigned part URLs              │   (AWS reassembles bytes; API never       │    │
  │  - canTransition(): pending→uploaded      │    reads them)                            │    │
  │  - INSERT recordings_to_verify row        │◀──────────────────────────────────────────┘   │
  │  - onSend hook: drain recording_events_   │                                                │
  │    outbox for req.user.sub → reply._events│                                                │
  └───────────────────────────────────────────┘                                                │
        ▲           │                       │ (dev: also queue.add() directly here)            │
        │ _events    │ writes outbox rows    └──────────────────────────┐                       │
        │ payload    │ (verified / re-upload)                           │                       │
        │ on every   ▼                                                  ▼                       │
        │ authed   ┌─────────────────────┐   ┌──────────────────────────────────────────┐       │
        │ response │ Postgres (RDS)      │   │ Hash-verify worker (separate ECS task,   │       │
        │          │  recordings         │◀──│ same image: node dist/workers/hash-       │       │
        │          │  recordings_to_verify│   │ verify.js; BullMQ consumer; scales on    │       │
        │          │  recording_events_  │   │ queue depth)                             │       │
        │          │    outbox  (NEW)    │   │  - GetObject(video.mp4).Body → stream    │       │
        │          └─────────────────────┘   │    sha256; same for imu.csv               │       │
        │                  ▲                  │  - GetObject(metadata.json) → parse       │       │
        │                  │ qa_status flip   │  - match → 'verified' + outbox 'verified' │       │
        │                  │ + outbox write   │  - mismatch → 'hash-mismatch' + outbox    │       │
        │                  │ (one tx)         │    're-upload'                             │       │
        │                  └──────────────────│  - on error/transient → BullMQ retry      │       │
        │                                     └──────────────────────────────────────────┘       │
        │                                          ▲                                              │
        │  prod: S3 "Object Created"               │ BullMQ job (recordingId) from:               │
  ┌─────┴───────────────┐  EventBridge rule  ┌─────┴──────────┐  - prod: SQS-poller             │
  │ App: on verified →  │  ───────────────▶  │ SQS queue      │  - dev:  /finalize queue.add()  │
  │ unlink local triple │  (filters key      │ humyn-verify-q │  - both: a "scan recordings_    │
  │ on re-upload →      │   suffix .mp4/.csv │                │    to_verify" cron sweeps any   │
  │ re-upload from copy │   /metadata.json)  └────────────────┘    rows that slipped through    │
  └─────────────────────┘                                                                        │
        ▲                                                                                        │
        │ GET /recordings/verified-ids?since=<cursor>  (app-launch reconciliation sweep)          │
        └────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additive — extends existing layout)

```
apps/api/src/
├── workers/
│   └── hash-verify.ts          # NEW — BullMQ Worker entrypoint; node dist/workers/hash-verify.js
├── lib/
│   ├── queue.ts                # NEW — getQueue()/getRedisConnection() — shared by /finalize + worker
│   ├── recording-events.ts     # NEW — appendOutboxEvent(tx, recordingId, type), drainOutbox(userId)
│   └── sha256-stream.ts        # NEW — sha256OfS3Object(bucket, key) — streaming, memory-bounded
├── routes/recordings/
│   ├── verified-ids.ts         # NEW — GET /recordings/verified-ids (reconciliation sweep)
│   └── reupload.ts             # NEW or extend — re-issue presigned URLs for a hash-mismatch row (UP-16)
├── plugins/
│   └── events-outbox.ts        # NEW — onSend hook: drain outbox for req.user.sub → reply envelope
└── db/migrations/
    └── 00XX_recording_events_outbox.sql   # NEW table + index

apps/mobile/android/app/src/main/java/ai/humynlabs/capture/
├── upload/
│   ├── HumynUploadModule.kt         # NEW — RN bridge: enqueue/pause/resume/getQueue + queue-state events
│   ├── HumynUploadPackage.kt         # NEW — register in MainApplication
│   ├── UploadQueueStore.kt           # NEW — MMKV-backed queue rows + per-file part-state
│   ├── ChunkUploader.kt              # NEW — OkHttp PUT per part, ETag capture, retry/backoff, no-progress watchdog
│   ├── UploadCoordinator.kt          # NEW — drains the queue, 3∥×2∥ semaphore, /init→PUT→/finalize calls
│   ├── UploadJobService.kt           # NEW — UIDT JobService (setUserInitiated) for true-background past 6 h cap
│   └── BatteryOptimizationHelper.kt  # NEW — AOSP request + best-effort OEM deep-links (resolveActivity-gated)
├── fgs/HumynForegroundService.kt     # EXTEND — implement Service.onTimeout(); add a startForeground-with-dataSync-only path

apps/mobile/src/
├── screens/uploads/PendingUploadsScreen.tsx   # NEW — reuses History row + chip components (D-10)
├── screens/onboarding/BatteryOptimizationScreen.tsx  # NEW (or a modal) — the OEM walkthrough copy
├── native/HumynUpload.ts                       # NEW — JS bridge typings + event subscriptions
├── services/uploadReconcile.ts                 # NEW — VERIFY-06 cold-start/foreground sweep
└── boot/bootRecoveryListener.ts                # EDIT (Wave 1) — RECOVERY_TOAST_MS 15_000 → 5_000 + annotation
```

### Pattern 1: Client-side S3 multipart from a native module (the `HumynUpload` flow)

**What:** `HumynUpload` is the _client_ of the Phase-1 backend — it does not mint URLs, it consumes them.

**Flow (Kotlin, inside the FGS thread):**

1. `POST /recordings/init` with `{ recordingId, taskId, practice, partsCount, durationMs, fileSha256, imuSha256, fileSizeBytes, imuSizeBytes, capturedAt }` (all of these are already in the finalized metadata JSON — `MetadataComposer` produced them). `partsCount` must be `ceil(fileSizeBytes / chunkBytes)` where `chunkBytes = 8 MiB` on Wi-Fi, `2 MiB` on cellular — and **the same `partsCount` covers both video and IMU streams**, so it must be sized for the bigger one (video). The IMU CSV is tiny (~200 KB) so it uses part 1 only; the server returns more `imuPartUrls` than needed and the client uses just what it needs.
2. Response gives `partUrls[]` (video), `imuPartUrls[]` (IMU), `metadataUrl` (single PUT), `uploadId`, `imuUploadId`, `expiresAt` (15 min TTL — `PRESIGNED_TTL_SECONDS`).
3. PUT `metadata.json` to `metadataUrl` (small, one shot).
4. For video + IMU, PUT each part to its presigned URL with the byte range as the body (range read from a `RandomAccessFile`, never the whole file in memory). Capture the `ETag` response header per part. Concurrency: a semaphore of 6, used as 3 video + 3 IMU (IMU only has 1 part so effectively 3 video at a time + the 1 IMU). Per-part retry with 2/4/8/16/32/64 s backoff; on the 7th failure mark the _part_ dead-letter → the _recording_ dead-letter (`chip-failed`). **No whole-file restart** — a successful part stays successful in the MMKV queue.
5. Optionally `POST /recordings/:id/parts/:n/complete` as a state probe (Phase 1 left this as a "is the row still pending?" check — Phase 5 may skip it or use it after a long pause to detect an aborted window).
6. `POST /recordings/:id/finalize` with `{ videoParts: [{partNumber, etag}], imuParts: [...], imuUploadId }`. The server calls `CompleteMultipartUpload` for both, flips `pending → uploaded`, inserts the `recordings_to_verify` row.
7. (Prod) S3 emits an "Object Created" event → EventBridge → SQS → BullMQ. (Dev) `/finalize` does `queue.add('verify', { recordingId })` directly.

**When to use:** Always — this is the upload path.

**Example:** see Code Examples — the streaming PUT body + ETag capture.

### Pattern 2: Hash-verify worker as a separate ECS task in the same codebase

**What:** `apps/api` is one TS codebase, one Docker image, **two** ECS task definitions. `node dist/server.js` = the Fastify API; `node dist/workers/hash-verify.js` = the BullMQ consumer. They share the DB schema, the S3 client, the types — but scale and deploy independently. `[CITED: .planning/research/ARCHITECTURE.md Pattern 5]`

**Worker shape:**

```ts
// apps/api/src/workers/hash-verify.ts  (Source: BullMQ docs https://docs.bullmq.io/ + ARCHITECTURE.md)
import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/queue.js';
import { verifyRecording } from '../lib/verify-recording.js';

const worker = new Worker(
  'verify',
  async (job) => {
    await verifyRecording(job.data.recordingId);
  },
  { connection: getRedisConnection(), concurrency: 4 },
);
worker.on('failed', (job, err) => {
  /* pino log; BullMQ already retries per the queue's attempts/backoff */
});
```

- `verifyRecording`: `GetObject(video.mp4).Body` → pipe through `crypto.createHash('sha256')` → hex; same for `imu.csv`; `GetObject(metadata.json)` → parse → compare `metadata.file_sha256` / `metadata.imu_sha256` (and cross-check the `recordings.fileSha256`/`imuSha256` columns). Match → `db.transaction`: `update recordings set qa_status='verified', verifiedAt=now()` + `insert recording_events_outbox (recordingId, userId, type='verified')` + `delete from recordings_to_verify`. Mismatch → `qa_status='hash-mismatch'` + outbox `type='re-upload'` + leave the `recordings_to_verify` row? No — delete it (a hash-mismatch is terminal until the client re-uploads, which goes through a fresh `/init`/`/finalize` cycle). Transient S3 error → throw → BullMQ retries (`attempts: 5, backoff: { type: 'exponential', delay: 5000 }` on `queue.add` or as worker defaults).
- A small **cron sweep** (the existing `apps/api/src/cron/` surface) scans `recordings_to_verify` for rows older than N minutes with `attempts < max` and re-`queue.add()`s them — catches anything where the EventBridge→SQS leg dropped a message. Belt-and-suspenders for at-least-once.

**When to use:** This is the verification path.

### Pattern 3: Server→client event delivery via an outbox table + `onSend` hook (RECOMMENDED mechanism)

**What:** A new `recording_events_outbox` table; the worker appends a row when it flips `qa_status`; a Fastify `onSend` hook on authenticated responses drains the rows for `req.user.sub` and attaches them to the response. At-least-once: rows are marked `delivered_at` only after a successful send, and the client de-dups on `(recording_id, event_type)`.

**Why this mechanism (vs. a header, vs. reusing the `events` table):**

- The existing `events` table is _telemetry ingest only_ (client→server, `POST /events`) — wrong direction, and CONTEXT.md explicitly says the server→client channel is NEW, not that table.
- A response **envelope key** (`{ ...payload, _events: [...] }`) is cleaner than a header — headers are size-limited and awkward for arrays; and many of this API's GET responses are already objects (the `GET /recordings` list, `GET /me`, `GET /contributions/...`). For the few that aren't easily wrappable, the hook can skip them (the _next_ GET picks the events up — at-least-once tolerates that).
- The `onSend` hook pattern is already in this codebase — `plugins/idempotency.ts` uses an `onSend` hook to persist responses. Mirror it.
- **Pattern 22 (STATE.md)** — don't declare strict `response.200` schemas on the routes the hook touches (it would forbid the extra `_events` key). The hook mutates the payload at `onSend` time, after Zod serialization; for routes that _do_ have a strict response schema (`GET /recordings` has `RecordingsListResponseSchema`), either (a) add `_events` to that schema as optional, or (b) have the hook only attach to a small set of "carrier" endpoints (e.g. `GET /me`, a new `GET /recordings/verified-ids`) that have no strict schema. Planner's call — (a) is simpler if you're touching the list schema anyway.

**Table:**

```sql
-- apps/api/src/db/migrations/00XX_recording_events_outbox.sql
CREATE TABLE recording_events_outbox (
  id            varchar(26) PRIMARY KEY,             -- ULID
  user_id       varchar(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id  varchar(26) NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  event_type    varchar(20) NOT NULL,                -- 'verified' | 're-upload'
  created_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at  timestamptz                          -- NULL until drained onto a response
);
CREATE INDEX recording_events_outbox_user_undelivered_idx
  ON recording_events_outbox (user_id) WHERE delivered_at IS NULL;
```

- Drain query (in the `onSend` hook, only when `req.user?.sub`): `SELECT recording_id, event_type FROM recording_events_outbox WHERE user_id = $1 AND delivered_at IS NULL ORDER BY created_at LIMIT 50`; then `UPDATE ... SET delivered_at = now() WHERE id IN (...)`. (Mark-delivered-after-send is at-most-once-loss-risk-free in practice because the client de-dups; if you want strict at-least-once, defer the `UPDATE` to an `onResponse` hook after the bytes are on the wire — but `onResponse` can't see the payload, so you'd need to stash the drained ids on `req`. Simpler: mark in `onSend`, accept the tiny window, rely on client idempotency. The reconciliation sweep (Pattern 4) is the ultimate backstop anyway.)
- Client: on receiving `_events: [{recording_id, event_type}]`, for each — if `verified` and not already processed: unlink the local triple, drop the queue row; if `re-upload`: re-enter the upload path from the still-present local copy. Keep a small `processedEvents` set in MMKV keyed `${recording_id}:${event_type}` so a redelivered event is a no-op.

### Pattern 4: App-launch reconciliation sweep (VERIFY-06)

**What:** On cold start (and on foreground rehydrate), the app asks the backend "which of my recordings are `verified`?" and deletes any local triple it still has for a `verified` recording. This catches the case where the `verified` `_events` payload never reached the client (app was offline / killed between the worker flip and the next API call).

**Endpoint (RECOMMENDED):** `GET /recordings/verified-ids?since=<cursor>` → `{ ids: [recordingId, ...], next_cursor: recordingId | null }` where the cursor is the last-seen recording_id ordered by `verified_at DESC, id DESC` (same pattern as `GET /recordings`'s pagination). The client passes the highest cursor it has stored; on first run it has none and gets the recent page. (Alternative: a `?qa_status=verified` filter on `GET /recordings` — but that returns full rows and the client only needs ids; a dedicated thin endpoint is cleaner and Pattern-22-friendly since it can carry the `_events` envelope key too.)

- Client logic: `GET /recordings/verified-ids` → for each id, if the MMKV queue still has a row with local files → unlink the triple, drop the row, mark processed. Store `next_cursor` for next time.

### Pattern 5: MMKV-backed upload queue that survives app kill

**What:** A dedicated MMKV instance (`new MMKV({ id: 'uploads' })`) holds the queue. Each row:

```
{
  recordingId: string,
  ownerUserId: string,            // for UP-13 cross-account guard
  paths: { mp4: string, csv: string, json: string },
  state: 'pending' | 'uploading' | 'finalizing' | 'awaiting-verify' | 'verified' | 'dead-letter',
  uploadId?: string, imuUploadId?: string,   // from /init; null until /init succeeds
  partsCount?: number, chunkBytes?: number,
  videoParts: { n: number, status: 'pending'|'done'|'failed', etag?: string, retryCount: number }[],
  imuParts:   { n: number, status: ..., etag?: string, retryCount: number }[],
  metadataPut: 'pending' | 'done',
  enqueuedAt: number, lastProgressAt: number, deadLetterReason?: string
}
```

- Written by `HumynUpload.enqueue()`, mutated by `UploadCoordinator` as parts complete.
- Read by JS (`HumynUpload.getQueue()` + a `onQueueChanged` event) for the Pending Uploads UI.
- On app launch: native `UploadCoordinator.bootstrap()` reads the queue, drops `verified` rows whose files are already gone, and resumes any `pending`/`uploading`/`finalizing`/`awaiting-verify` row whose `ownerUserId == currentSignedInSub` (if no one is signed in, do nothing — wait for login). Then the JS reconciliation sweep (Pattern 4) runs and cleans up `verified`-on-server-but-still-local triples.
- This is the "queue lives on device" part of the CLAUDE.md "Do NOT Use → Redis at MVP" line — it's already correct; only the _worker_ queue is Redis (Pattern 2).

### Pattern 6: OEM battery-optimization walkthrough (resolveActivity-gated, AOSP-fallback-first)

**What:** At first upload (gate on a `firstUploadPromptShown` MMKV flag), show a screen that (a) requests the AOSP ignore-battery-optimizations exemption and (b) offers a "How to keep uploads running on your phone" walkthrough whose deep-link button is **only shown if the OEM activity actually resolves** — and whose copy says "if that screen isn't here, open Settings → Apps → Homelander → Battery → Unrestricted".

**Why the gating matters:** The OEM activities are not part of any public API. Newer ROMs have removed or renamed many of them (HyperOS folded autostart into notification handling; some ColorOS/FunTouch builds throw `Permission Denial` requiring an OEM-only permission). `dontkillmyapp.com` documents that even when the user grants the exemption, MIUI/HyperOS may revert it on app update, and the full defeat path can need 3–4 separate user actions. So: try the OEM deep-link with `intent.resolveActivity(packageManager) != null` (or wrap `startActivity` in try/catch) and **always** fall through to `Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (the AOSP list screen) or `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (the AOSP per-app prompt). `[VERIFIED: dontkillmyapp.com via .planning/research/PITFALLS.md Pitfall 11]`

**The intent strings (best-effort; verify-on-device, expect some to be dead):** see Code Examples for the table. Source: the widely-mirrored "OEM battery optimization" gist `[CITED: gist.github.com/moopat/e9735fa8b5cff69d003353a4feadcdbc]` — but this list is community-maintained and stale on newer ROMs; do not rely on any single entry resolving.

### Pattern 7: FGS type-downgrade lifecycle (one service, three states)

**What:** One `HumynForegroundService` whose `foregroundServiceType` transitions over time. The manifest declares the **superset** `camera|microphone|dataSync` (already does). At runtime:

- **Recording active:** `startForeground(NOTIF_ID, notif, FGS_TYPE_RECORDING)` where `FGS_TYPE_RECORDING = CAMERA | MICROPHONE | DATA_SYNC` (already does).
- **Recording stopped, uploads in flight:** call `startForeground(NOTIF_ID, notif2, FOREGROUND_SERVICE_TYPE_DATA_SYNC)` again — **a second `startForeground` call with a narrower type set is the documented way to downgrade.** The notification changes ("Uploading recordings…"). The `camera`/`microphone` privacy indicators disappear. (You cannot "OR-off" a bit from a running FGS in place; you re-call `startForeground` with the new bitmask.)
- **Queue empty for > 5 min:** `ServiceCompat.stopForeground(...)` + `stopSelf()`.
- **Android 15 6-hour `dataSync` cap hit:** the service's `onTimeout(int startId, int fgsType)` fires — `stopSelf()` within a few seconds, and schedule a UIDT `JobService` (Pattern under UP-07) so the queue keeps draining in true background. When the user next foregrounds the app, the 6-hour budget resets and the FGS can take over again.

The `ACTION_SET_UPLOAD_ACTIVE` intent seam already exists in `HumynForegroundService` for the recording↔upload handoff — Phase 5 wires it and adds the actual `startForeground`-with-`dataSync` call (the `setUploadActive(boolean)` method's comment says "Phase 5 will downgrade … here").

### Anti-Patterns to Avoid

- **Re-encoding / re-muxing the MP4 to "fix" it before upload.** CLAUDE.md: "Files never re-encoded. MP4, IMU CSV, metadata JSON travel byte-for-byte device → S3." The PUT body is the raw file bytes. Period.
- **Hashing on the UI/JS thread, or re-hashing at upload time.** The SHA-256s are already in the metadata JSON (`HashStreamer.kt` did them at finalize). The upload module streams the file as the PUT body; it does not re-hash. The _worker_ re-hashes — on a worker thread, streaming, never `readFileSync` of a 4 GB object.
- **Loading a 4 GB MP4 into memory** — on either side. Client: `RandomAccessFile`-ranged PUT body. Worker: `GetObject().Body` (a Node Readable) piped into the hash, never `Buffer`-collected.
- **Relying on the FGS to deliver the `verified` event to the client.** It can't survive a multi-day cold period. The `verified` event rides the _next API call_ (Pattern 3); the reconciliation sweep (Pattern 4) is the backstop. `[CITED: .planning/research/PITFALLS.md Pitfall 15]`
- **Trusting `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` alone on Chinese OEMs** — pair with the OEM walkthrough (Pattern 6), and accept that on some ROMs uploads pause when the app is closed (surface it in Pending Uploads copy — `idea-brief.md §7.4`).
- **Declaring a strict `response.200` schema on a route the `onSend` hook touches** without adding the `_events` optional key — Pattern 22 (STATE.md). The hook adds a key after serialization.
- **Polling `ConnectivityManager` on a timer to detect "back online"** — use `ConnectivityManager.registerDefaultNetworkCallback` (event-driven). `[CITED: .planning/research/PITFALLS.md anti-patterns table]`
- **Updating the FGS notification on every chunk-progress callback** — debounce to ≤ once per 5 s.
- **Adding ANY per-account upload-rate cap, fraud heuristic, dashboard, or admin route** — D-04. The path is fully uncapped at MVP. Don't add a "generous safety cap" either (D-04a).
- **Building `HumynUploadIOS` or any `URLSession` code** — iOS deferred (UP-08 documented as a gap, not built).
- **Re-bumping `RECOVERY_TOAST_MS` back to 15 s** — D-07 reverts it to 5 s; annotate the file.

---

## Don't Hand-Roll

| Problem                                                         | Don't Build                                                            | Use Instead                                                                                                      | Why                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis-backed job queue with retries/backoff/concurrency/metrics | A custom Postgres-polled job loop with hand-rolled exponential backoff | `bullmq` (5.76.8)                                                                                                | The ROADMAP locks BullMQ; it gives you `attempts`/`backoff`/`concurrency`/queue-depth metrics for free, and is horizontally safe (multiple workers, one Redis). `[VERIFIED: npm + ARCHITECTURE.md]` |
| S3 multipart presigning + complete                              | Anything                                                               | The Phase-1 `recordings/{init,complete-part,finalize}.ts` (already shipped)                                      | It's done. `HumynUpload` is just the client.                                                                                                                                                        |
| Streaming SHA-256 of a large S3 object                          | Reading the object into a buffer, or shelling out to `sha256sum`       | Node `crypto.createHash('sha256')` piped from `GetObject().Body`                                                 | Memory-bounded, stdlib, no temp files. Code Examples.                                                                                                                                               |
| Server→client push without FCM/APNs                             | A WebSocket server, SSE endpoint, or long-polling endpoint             | An outbox table + `onSend` hook (Pattern 3)                                                                      | No new infra, survives app-cold periods (events queue up), the codebase already has the `onSend` precedent (`plugins/idempotency.ts`). FCM/APNs are explicitly off-MVP.                             |
| On-device queue persistence                                     | AsyncStorage, a custom file format                                     | A dedicated `react-native-mmkv` instance                                                                         | MMKV is pinned; AsyncStorage is on the CLAUDE.md "Do NOT Use" list for queues.                                                                                                                      |
| Detect Wi-Fi vs cellular for the 8 MB/2 MB switch               | Parsing `WifiManager` state, ping latency heuristics                   | `ConnectivityManager.getNetworkCapabilities(activeNetwork).hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)` | One call; the canonical API.                                                                                                                                                                        |
| "Back online" detection during a paused upload                  | A `Handler.postDelayed` connectivity poll                              | `ConnectivityManager.registerDefaultNetworkCallback`                                                             | Event-driven, no wakelock leak.                                                                                                                                                                     |
| UIDT background job past the 6-hour `dataSync` cap              | A WorkManager `OneTimeWorkRequest` with `setExpedited`                 | A `JobScheduler` `JobInfo.Builder().setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS` permission               | `setUserInitiated` is the _documented_ escape hatch and is only on `JobScheduler`, not WorkManager. `[VERIFIED: developer.android.com data-transfer-options + behavior-changes-15]`                 |
| OEM autostart deep-links                                        | Hard-coding `startActivity` with no guard                              | `resolveActivity()`-gated + always an AOSP fallback (Pattern 6)                                                  | The OEM activities change/disappear; an unguarded `startActivity` `ActivityNotFoundException`-crashes the app.                                                                                      |

**Key insight:** Almost nothing in Phase 5 is greenfield infrastructure — the multipart backend, the FGS, the `recordings_to_verify` queue stub, the `events` table, the History row + chips, the `ACTION_SET_UPLOAD_ACTIVE` seam, the `CaptureLaunchSweep` recovery path, the `HashStreamer`/`MetadataComposer` outputs — all exist. Phase 5 is mostly **wiring + one new native module + one new Node worker + one new table + one new screen**, plus the OS-survival hardening (FGS downgrade, UIDT job, OEM walkthrough) which is the part that needs care.

---

## Runtime / Code Reconciliation (rename/refactor-style audit, scoped to D-03/D-07)

Phase 5 isn't a rename, but D-03/D-03b ask the researcher to verify code state before the planner commits. Findings:

| Category                            | What's there now                                                                                                                                                                                                                                                                                                                                                                                                                   | Action required in Wave 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash-recovery path                 | `CaptureLaunchSweep.kt` Pass 1 `tryReFinalize()` **DOES still produce a recovered triple** when the orphan MP4 has `ftyp`+`moov`+≥1 `moof` (the post-30 s case). It writes `video_metadata.json` with degenerate `duration_seconds: 0`, null `drift`, null `imuFloorHz` and returns the base as "recovered" → `pendingRecovery` → `onCrashRecovery` event → `bootRecoveryListener` toast. The pre-30 s stub case already discards. | **D-03: change `tryReFinalize`'s success branch to DISCARD instead of compose** — i.e. `CaptureLaunchSweep` Pass 1 deletes the `{base}.{mp4,csv,session.json}` triple for _any_ orphan-with-sidecar, not just the unplayable-MP4 case. Update `CaptureLaunchSweepTest.kt`. After this, `run()` always returns `emptyList()` for the recordings dir → `pendingRecovery` is always empty → the `onCrashRecovery` event never carries a non-empty list.                                                                                                                                                                                                                                                                                                                                                                                                |
| Recovery toast                      | `bootRecoveryListener.ts` fires the toast iff `getPendingRecovery()`/`onCrashRecovery` reports `recovered.length > 0`. After D-03, that is **never true** for the crash path. `RECOVERY_TOAST_MS = 15_000` (the workaround).                                                                                                                                                                                                       | **D-07 reconciled with D-03:** the toast is now effectively dead code. Two valid plans (planner's call): (a) **Minimal** — revert `RECOVERY_TOAST_MS` to `5_000`, leave the wiring, add a comment "as of Phase 5 D-03, `CaptureLaunchSweep` never re-finalizes a crash orphan, so this listener should never fire — kept as a safety net; do not re-bump the duration". (b) **Tidy** — remove the toast wiring + `getPendingRecovery`/`onCrashRecovery` plumbing entirely, since nothing can trigger it. D-07's literal text says "keep the toast wiring … set the toast duration back to 5 s … annotate" → option (a) is the letter-of-the-law choice; option (b) is defensible since D-07 also says "if D-03 makes the recovery path produce nothing upload-able, this toast may be dead". **Recommend (a)** — least churn, matches D-07's words. |
| Upload-bundle validation            | No special-casing of `duration_seconds: 0` / null drift exists yet (nothing's been built).                                                                                                                                                                                                                                                                                                                                         | **D-03a: do nothing** — don't add a `duration_seconds: 0` tolerance, because such a bundle is never produced. A belt-and-suspenders "reject a malformed bundle at `/init`" guard is optional, not required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `is_practice` in finalized metadata | `MetadataComposer.compose()` does NOT write `is_practice` to `{base}.json`; the `.session.json` sidecar (`SidecarPayload.isPractice`) does. Practice triples live under `files/practice/`, `task_id == __practice__`.                                                                                                                                                                                                              | **D-08: keep it out.** The Phase-5 upload _filter_ (which triples to skip/route) keys off the `files/practice/` directory + `task_id == __practice__`. Add a one-line doc note in the plan; no code change to `MetadataComposer`. **Also note for the planner:** decide whether practice recordings are uploaded at all at MVP — `idea-brief.md` says practice "does not count towards your contribution"; whether they're shipped to S3 for QA or just deleted locally after the practice flow is a small open question (Open Question 1).                                                                                                                                                                                                                                                                                                         |
| FGS upload seam                     | `HumynForegroundService.ACTION_SET_UPLOAD_ACTIVE` intent + `EXTRA_UPLOAD_ACTIVE` + `setUploadActive(boolean)` (a no-op stub) all exist. `FGS_TYPE_RECORDING` is the superset bitmask. `Service.onTimeout` is **not** overridden.                                                                                                                                                                                                   | **Wire it:** dispatch `ACTION_SET_UPLOAD_ACTIVE` from `HumynUpload`/`HumynCapture`; make `setUploadActive(true)` (post-record) call `startForeground(NOTIF_ID, uploadNotif, FOREGROUND_SERVICE_TYPE_DATA_SYNC)`; override `onTimeout(int,int)` → `stopSelf()` + schedule the UIDT job.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Device-distress nav                 | `RecordingScreen.tsx` `RESET_FOR_FRESH`'s back to `'ready'` on a battery-≤5%/thermal-abort stop, same as a normal sub-60 s discard.                                                                                                                                                                                                                                                                                                | **D-05: route device-distress stops to Home** (not `'ready'`). Edge: practice-mid-onboarding hitting device-distress — pick a sane destination (resume onboarding or Home), keep it simple.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Alert tones                         | `HumynBeep.playTone` (520 Hz battery beep; 440→560→680 Hz thermal sequence) — fired but inaudible at ~3.6 % media volume on the smoke device.                                                                                                                                                                                                                                                                                      | **D-06: re-check at full media volume in the Wave-1 smoke runbook;** only chase a SoundPool fix if still silent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Rotate-prompt glyph                 | `RotatePrompt.tsx` portrait-phone SVG tilting CCW.                                                                                                                                                                                                                                                                                                                                                                                 | **D-09: eyeball on-device** that it reads as "rotate your phone".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## Common Pitfalls

### Pitfall 1: OEM autostart deep-links are dead/renamed on newer ROMs (UP-09)

**What goes wrong:** You hard-code `Intent().setClassName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")` (or the ColorOS/FunTouch equivalents), it works on the test device, ships, and on a newer HyperOS/ColorOS build it throws `ActivityNotFoundException` (component removed) or `SecurityException`/`Permission Denial` (component now requires an OEM-only permission like `oppo.permission.OPPO_COMPONENT_SAFE`) — crashing the walkthrough or silently doing nothing.
**Why it happens:** These activities are not public API; OEMs rename/remove/relock them between ROM versions (HyperOS folded autostart into notification handling; some ColorOS/FunTouch builds locked the components). `dontkillmyapp.com` documents the churn and the 3–4-action defeat paths.
**How to avoid:** (1) Always offer the AOSP `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` / `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` first — that one is stable. (2) For the OEM deep-link, gate on `intent.resolveActivity(pm) != null` AND wrap `startActivity` in try/catch — never let it crash. (3) The walkthrough _copy_ must work without the deep-link: "Settings → Apps → Homelander → Battery → Unrestricted, and turn on Autostart if your phone has it." (4) Re-grant defense: `idea-brief.md §7.4` says MIUI may revert the exemption on app update — re-show the prompt (gated on a "last shown for app version X" flag) after a force-upgrade.
**Warning signs:** Crash reports with `ActivityNotFoundException` from the upload-walkthrough screen; users on Xiaomi/Oppo/Vivo with permanently-stuck "Uploading…" rows.

### Pitfall 2: `partsCount` is fixed at `/init` and shared between video + IMU (UP-02)

**What goes wrong:** You pick `partsCount` based on the _IMU_ file (tiny → `partsCount = 1`), then the 4 GB video needs 500 parts and you've only got 1 part-URL. Or you switch from Wi-Fi (8 MB chunks) to cellular (2 MB) _mid-upload_ — but the part-URLs were minted for the 8 MB layout.
**Why it happens:** `recordings/init.ts` mints `partsCount` part-URLs for _both_ `keys.video` and `keys.imu` using one uniform count; the client chose `partsCount` at `/init` time.
**How to avoid:** Compute `partsCount = ceil(fileSizeBytes / chunkBytes)` from the **video** size (the bigger file) with the chunk size decided **once at `/init` time** from the then-current network type. If the network type flips mid-upload, keep the original chunk layout (the parts already in flight are fine; a 2 MB-vs-8 MB difference isn't worth re-`/init`-ing) — the cellular-specific behavior that _does_ matter mid-upload is the no-progress watchdog (Pitfall 7), not the chunk size. AWS allows parts of any size 5 MB–5 GB except the last; 2 MB parts are _below_ the 5 MB minimum for non-final parts — so for cellular, either use 5 MB (the AWS minimum) not 2 MB, or accept that "2 MB cellular chunks" means "the _app's_ retry granularity is 2 MB but the _S3 part_ is still ≥ 5 MB". **Flag for the planner:** the spec's "2 MB on cellular" (UP-02 / `idea-brief.md §7.1` says 8 MB only; UP-02 adds the 2 MB cellular figure) conflicts with S3's 5 MB minimum part size for non-final parts — the planner must decide: (a) cellular part size = 5 MB (S3-legal, closest to spec intent), or (b) keep 2 MB as an _internal_ sub-chunk retry unit with 5 MB+ S3 parts, or (c) raise it. This is a real ambiguity, not a research gap. `[VERIFIED: AWS S3 multipart docs — 5 MiB minimum part size except the last part]`

### Pitfall 3: `verified` event lost → permanent "Uploading… awaiting verification" (VERIFY-05/06)

**What goes wrong:** The worker flips `qa_status='verified'` and writes the outbox row, but the user's app is offline/killed and never makes another API call before they uninstall — or the `onSend`-hook drain marked the row `delivered_at` on a response that the client never received (network dropped after the server sent). The local files never get deleted; the row sits in "Uploading…" forever.
**Why it happens:** No push channel at MVP; the event is a passenger on the next API call.
**How to avoid:** (1) The reconciliation sweep (Pattern 4) runs on every cold start AND foreground rehydrate — it re-asks "what's `verified`?" so a missed `_events` payload self-heals next launch. (2) The Pending-Uploads row state machine should show "Uploaded — verifying…" (a distinct chip from "Uploading…") once `/finalize` succeeds, so the user isn't told it's still transferring. (3) Don't mark `delivered_at` until you must — or accept the small loss window because (1) backstops it. `[CITED: .planning/research/PITFALLS.md Pitfall 15]`

### Pitfall 4: Android 14 FGS strict-mode + the type-downgrade is a `startForeground` re-call, not an in-place edit (UP-06)

**What goes wrong:** You try to "downgrade" the FGS by clearing the `CAMERA`/`MICROPHONE` bits some other way, or you call `startForeground` with the `dataSync`-only type but the manifest `<service android:foregroundServiceType>` doesn't include `dataSync` — `MissingForegroundServiceTypeException` / `ForegroundServiceTypeNotAllowedException`. Or you start the upload FGS from the _background_ (app was already evicted) on Android 14 — `ForegroundServiceStartNotAllowedException` because `dataSync` (and `camera`/`microphone`) can't be started from the background.
**Why it happens:** Android 14 (API 34) made `foregroundServiceType` mandatory and strictly matched against the manifest; Android 14 also restricts which FGS types can be _started_ from the background. The runtime bitmask must be a subset of the manifest's `|`-set.
**How to avoid:** (1) Manifest keeps the superset `camera|microphone|dataSync` (it already does) — `dataSync` is in it, so a `startForeground(..., FOREGROUND_SERVICE_TYPE_DATA_SYNC)` call is legal. (2) Downgrade = call `startForeground` _again_ with the narrower bitmask + a new notification. (3) Start the upload FGS **while the app is still foreground** — right when `HumynCapture.stop()` returns (the user just pressed Stop, the app is foreground), the FGS-from-background restriction doesn't apply. For true-background resumes after a kill, you don't start an FGS — you use the UIDT `JobService` (UP-07), which is allowed from the background by design. (4) The two-sided lock already in `HumynForegroundServiceTest` + `manifests.test.ts` catches manifest↔bitmask drift — extend it for the `dataSync`-only state. `[VERIFIED: developer.android.com fgs/changes + fgs/restrictions-bg-start; .planning/research/PITFALLS.md Pitfall 6]`

### Pitfall 5: Android 15 `dataSync` 6-hour/24h cap silently kills long upload sessions (UP-07)

**What goes wrong:** A heavy day (back-to-back recordings, tens of GB queued) — the `dataSync` FGS hits 6 cumulative hours, `Service.onTimeout(int,int)` fires (Android 15), and if you don't handle it the system force-stops the service with `ForegroundServiceStartNotAllowedException` on the next attempt and uploads just stop until the user reopens the app.
**Why it happens:** Android 15 (API 35) caps `dataSync` FGS at 6 h per 24 h; the timer only resets when the user foregrounds the app.
**How to avoid:** (1) Implement `Service.onTimeout(startId, fgsType)` → within a few seconds, `stopForeground` + `stopSelf()`, and **schedule a UIDT `JobService`** (`JobInfo.Builder(jobId, ComponentName(ctx, UploadJobService::class.java)).setUserInitiated(true).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).build()`) — requires `<uses-permission android:name="android.permission.RUN_USER_INITIATED_JOBS"/>` in the manifest. (2) The UIDT job runs the same `UploadCoordinator` drain logic. (3) Only ever start the `dataSync` FGS "as a result of direct user interaction" (i.e. right after the user pressed Stop) so you get the full 6 h after the app backgrounds. `[VERIFIED: developer.android.com behavior-changes-15 + fgs/timeout + data-transfer-options]`

### Pitfall 6: LocalStack S3-notification → SQS/EventBridge path is flaky (dev) — see Environment Availability

**What goes wrong:** You wire `S3 bucket notification → EventBridge → SQS` in `infra/localstack/` exactly like prod, and in dev the multipart-complete event sometimes doesn't fire, or fires with a malformed `InputTransformer` result (there's a known LocalStack bug class around EventBridge `InputTransformer`/`Input` and S3→SQS via presigned uploads). You burn time debugging dev plumbing that isn't the actual feature.
**Why it happens:** LocalStack Community's S3-event → EventBridge → SQS chain is supported but has a history of edge-case bugs (issues #1216, #3097, #4763, #12195 in `localstack/localstack`), especially for presigned/multipart-complete uploads.
**How to avoid:** **Don't replicate the EventBridge→SQS leg in dev.** Have `/recordings/:id/finalize` do `getQueue().add('verify', { recordingId })` directly when `AWS_ENDPOINT_URL` is set (LocalStack mode) — the `recordings_to_verify` row is the durable record either way, and the cron sweep (Pattern 2) catches misses. In prod (`AWS_ENDPOINT_URL` unset), the S3→EventBridge→SQS→poller path is the trigger and `/finalize` does NOT `queue.add()` directly (avoid double-enqueue — or make `queue.add` idempotent on `recordingId` as the jobId). The `docker-compose.yml` needs a `redis:7-alpine` service; LocalStack's `SERVICES` env can stay `s3,secretsmanager` (no need to add `sqs,events` for dev). `[CITED: localstack/localstack issues; .planning/research/ARCHITECTURE.md "RDS and Redis run as their own real containers, not via LocalStack"]`

### Pitfall 7: Literal `TCP_MAXSEG=1280` is barely reachable from a JVM/Kotlin socket (UP-19)

**What goes wrong:** You plan a task "set `TCP_MAXSEG=1280` on the upload socket" and discover that `java.net.Socket` has no MSS setter, `OkHttp`'s `Socket` is created and `connect()`-ed internally (and MSS must be set _before_ `connect()`), and `android.system.Os.setsockoptInt(fd, IPPROTO_TCP, OsConstants.TCP_MAXSEG, 1280)` needs the raw `FileDescriptor` of the socket _before_ it's connected — which OkHttp doesn't expose. You either ship a no-op or burn days on a JNI hack.
**Why it happens:** MSS is a TCP-handshake option (it's in the SYN). The kernel decides it; `setsockopt(TCP_MAXSEG)` on a _client_ socket only works pre-`connect()` and even then is advisory on some kernels. Android's `Os.setsockoptInt` exists but you need the fd at the right moment.
**How to avoid:** **Split UP-19 into its two halves and prioritize the portable one.** (a) **The 30-second no-progress watchdog is the reliable, must-ship half** — a per-part timer that, if no bytes have moved for 30 s, closes the socket (cancel the OkHttp `Call`), and retries the part on a **fresh connection** (a new OkHttp `Call`, which gets a new socket / new handshake — possibly a new MSS negotiation). This is what actually defeats the Jio CGNAT / Vivo Brasil MTU-blackhole symptom (the connection looks alive at the TCP layer but progress stalls — only a fresh handshake recovers). (b) **The literal MSS clamp is best-effort** — provide an `OkHttpClient.Builder().socketFactory(...)` whose `createSocket()` returns a `Socket` subclass that overrides `connect()` to `Os.setsockoptInt(getFileDescriptor$(), IPPROTO_TCP, TCP_MAXSEG_or_equivalent, 1280)` _before_ `super.connect()` — but **verify on-device whether it takes** (it may throw `ErrnoException` or silently no-op; if so, drop it and rely on (a)). Smaller chunks on cellular (Pitfall 2) also reduce the cost of a stalled chunk. **Recommendation for the plan:** UP-19 task = "30 s no-progress abandon-and-retry-with-fresh-socket" (definitely ship) + "best-effort MSS clamp via custom SocketFactory, verified on-device, dropped if it no-ops" (try, don't block on it). `[VERIFIED: developer.android.com OsConstants/SocketOptions; man setsockopt TCP_MAXSEG; .planning/research/PITFALLS.md Pitfall 12]`

### Pitfall 8: Cross-account upload-queue leakage on logout/re-login (UP-13)

**What goes wrong:** User A records, queues uploads, logs out (queue preserved). User B logs in on the same phone. The MMKV `uploads` instance is per-app, not per-account — User B's app starts draining User A's queue, uploading A's recordings under B's JWT → A's data attributed to B, or B sees A's rows in Pending Uploads.
**Why it happens:** `idea-brief.md §3.3` allows secondary recorders to share a phone (re-sign-in pattern); the queue store doesn't know about accounts unless you tell it.
**How to avoid:** Store `ownerUserId` on every queue row at `enqueue()` time (= the `sub` of the signed-in user when the recording was made). On login/resume, `UploadCoordinator.bootstrap()` only resumes rows whose `ownerUserId == currentSub`. Pending Uploads UI only shows rows for `currentSub`. On logout: abort in-flight, keep the rows (don't wipe — A might log back in). This also means a row's `/init` was done under A's JWT and `/finalize` must be too — if B is logged in, those rows just wait.

### Pitfall 9: Re-upload (hash mismatch) needs a real entry point — re-`/init` may 409 (UP-16)

**What goes wrong:** Worker emits `re-upload`, the app tries to re-`POST /recordings/init` with the same `recordingId` — but `init.ts` does `.onConflictDoNothing()` so the row insert is a no-op, and it mints _new_ multipart `UploadId`s and _new_ presigned URLs but the `recordings.s3UploadId` column still holds the _old_ (now-completed) upload id, and `qa_status` is `'hash-mismatch'` not `'pending'` so `/finalize`'s `canTransition('hash-mismatch','uploaded')` returns **false** (the state machine has no `hash-mismatch → uploaded` edge). The re-upload dead-ends.
**Why it happens:** The Phase-1 multipart flow assumes a `pending` row; `hash-mismatch` is a terminal-ish state.
**How to avoid:** Add a `hash-mismatch → uploaded` (or `hash-mismatch → pending`) transition to `recording-state.ts` AND a `POST /recordings/:id/reupload` endpoint that: validates `qa_status == 'hash-mismatch'`, resets it to `'pending'`, mints fresh multipart uploads + presigned URLs (overwriting the _same_ S3 keys — `recordingKeys()` is deterministic, S3 versioning is on so the bad version is retained), stores the new `s3UploadId`, and returns the same shape as `/init`. The client then re-PUTs from the still-present local files and re-`/finalize`s. (Belt-and-suspenders: on a _second_ hash mismatch, mark `dead-letter` and surface `chip-failed` rather than looping forever.) **Flag for the planner — this is a real gap in the Phase-1 backend that Phase 5 must close.**

### Pitfall 10: `requestChecksumCalculation: 'WHEN_REQUIRED'` interaction with the worker's `GetObject`

**What goes wrong:** You assume S3's stored `x-amz-checksum-sha256` is available for the worker to compare against — but `s3-client.ts` deliberately runs `WHEN_REQUIRED` for LocalStack compat, so uploads didn't request a stored SHA-256, and `GetObject` won't return one.
**Why it happens:** The codebase chose `WHEN_REQUIRED` to avoid a LocalStack 4.0 `CompleteMultipartUpload` checksum-deserialization bug (`s3-client.ts` comment).
**How to avoid:** The worker re-hashes the full object bytes itself (Pattern 8) — it never relies on an S3-stored checksum. This is also what `idea-brief.md §7.3` mandates ("backend re-hashes"). Just don't write a task that assumes `GetObjectCommandOutput.ChecksumSHA256` is populated.

---

## Code Examples

### Worker: streaming SHA-256 of an S3 object (VERIFY-02)

```ts
// apps/api/src/lib/sha256-stream.ts
// Source: Node crypto docs (https://nodejs.org/api/crypto.html) + @aws-sdk/client-s3 GetObject (https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, RECORDINGS_BUCKET } from './s3-client.js';

export async function sha256OfS3Object(key: string): Promise<string> {
  const out = await getS3Client().send(
    new GetObjectCommand({ Bucket: RECORDINGS_BUCKET(), Key: key }),
  );
  const hash = createHash('sha256');
  // out.Body is a Node Readable stream in the Node runtime — never .transformToByteArray() a 4 GB object
  await pipeline(out.Body as NodeJS.ReadableStream, hash);
  return hash.digest('hex');
}
```

### Worker: verify one recording (VERIFY-02/03/04 + outbox write)

```ts
// apps/api/src/lib/verify-recording.ts  (sketch — Source: project schema + recording-state.ts + Pattern 3)
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { recordingKeys } from './s3-client.js';
import { sha256OfS3Object } from './sha256-stream.js';
import { canTransition } from './recording-state.js';
import { appendOutboxEvent } from './recording-events.js';

export async function verifyRecording(recordingId: string): Promise<void> {
  const [rec] = await db
    .select()
    .from(schema.recordings)
    .where(eq(schema.recordings.id, recordingId))
    .limit(1);
  if (!rec) return; // row gone — nothing to do
  if (rec.qaStatus !== 'uploaded') return; // already verified / rejected / takedown — idempotent
  const keys = recordingKeys({ userId: rec.userId, recordingId });
  const [videoSha, imuSha] = await Promise.all([
    sha256OfS3Object(keys.video),
    sha256OfS3Object(keys.imu),
  ]);
  // (optional) also fetch + parse keys.metadata and assert metadata.file_sha256 === rec.fileSha256, etc.
  const match = videoSha === rec.fileSha256 && imuSha === rec.imuSha256;
  await db.transaction(async (tx) => {
    if (match && canTransition(rec.qaStatus, 'verified')) {
      await tx
        .update(schema.recordings)
        .set({ qaStatus: 'verified', verifiedAt: new Date() })
        .where(eq(schema.recordings.id, recordingId));
      await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 'verified' });
    } else {
      await tx
        .update(schema.recordings)
        .set({ qaStatus: 'hash-mismatch' })
        .where(eq(schema.recordings.id, recordingId));
      await appendOutboxEvent(tx, { userId: rec.userId, recordingId, eventType: 're-upload' });
    }
    await tx
      .delete(schema.recordingsToVerify)
      .where(eq(schema.recordingsToVerify.recordingId, recordingId));
  });
}
```

### API: `onSend` hook draining the outbox (VERIFY-05)

```ts
// apps/api/src/plugins/events-outbox.ts  (Source: mirror of plugins/idempotency.ts onSend pattern)
import fp from 'fastify-plugin';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export default fp(
  async (app) => {
    app.addHook('onSend', async (req, reply, payload) => {
      const sub = (req.user as { sub?: string } | undefined)?.sub;
      if (!sub) return payload; // unauthenticated route — skip
      if (typeof payload !== 'string') return payload; // non-JSON body — skip (next GET picks it up)
      let body: any;
      try {
        body = JSON.parse(payload);
      } catch {
        return payload;
      }
      if (body == null || typeof body !== 'object' || Array.isArray(body)) return payload; // only object envelopes
      const rows = await db
        .select({
          id: schema.recordingEventsOutbox.id,
          recordingId: schema.recordingEventsOutbox.recordingId,
          eventType: schema.recordingEventsOutbox.eventType,
        })
        .from(schema.recordingEventsOutbox)
        .where(
          and(
            eq(schema.recordingEventsOutbox.userId, sub),
            isNull(schema.recordingEventsOutbox.deliveredAt),
          ),
        )
        .orderBy(schema.recordingEventsOutbox.createdAt)
        .limit(50);
      if (rows.length === 0) return payload;
      body._events = rows.map((r) => ({ recording_id: r.recordingId, event_type: r.eventType }));
      await db
        .update(schema.recordingEventsOutbox)
        .set({ deliveredAt: new Date() })
        .where(
          inArray(
            schema.recordingEventsOutbox.id,
            rows.map((r) => r.id),
          ),
        );
      return JSON.stringify(body);
    });
  },
  { name: 'events-outbox', dependencies: ['auth'] },
);
// NOTE Pattern 22: any route with a strict response.200 zod schema that this hook touches must add `_events: z.array(...).optional()` to that schema, OR be excluded from the hook. Simplest: add it to RecordingsListResponseSchema + the /me schema if those are carriers.
```

### Android: streaming chunk PUT + ETag capture (UP-01/03)

```kotlin
// apps/mobile/.../upload/ChunkUploader.kt  (sketch — Source: OkHttp docs https://square.github.io/okhttp/)
import okhttp3.*
import okio.*
import java.io.RandomAccessFile

fun putPart(client: OkHttpClient, presignedUrl: String, file: File, offset: Long, length: Long): String {
  val body = object : RequestBody() {
    override fun contentType(): MediaType? = "application/octet-stream".toMediaTypeOrNull()
    override fun contentLength(): Long = length
    override fun writeTo(sink: BufferedSink) {
      RandomAccessFile(file, "r").use { raf ->
        raf.seek(offset)
        val buf = ByteArray(64 * 1024); var remaining = length
        while (remaining > 0) {
          val n = raf.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
          if (n <= 0) break
          sink.write(buf, 0, n); remaining -= n
        }
      }
    }
  }
  val req = Request.Builder().url(presignedUrl).put(body).build()
  client.newCall(req).execute().use { resp ->
    if (!resp.isSuccessful) throw IOException("part PUT ${resp.code}")
    return resp.header("ETag") ?: throw IOException("no ETag on part response")
  }
}
// Wrap each putPart in: retry 2/4/8/16/32/64s; a 30s no-progress watchdog that cancels the Call and retries on a fresh Call (UP-19); a semaphore of 6 (3 video + 3 IMU). Persist {etag, status} into the MMKV queue row after each success — never restart a done part (UP-04).
```

### Android: battery-optimization request + best-effort OEM deep-link (UP-09)

```kotlin
// apps/mobile/.../upload/BatteryOptimizationHelper.kt  (Source: developer.android.com PowerManager.isIgnoringBatteryOptimizations
//   + gist.github.com/moopat/e9735fa8b5cff69d003353a4feadcdbc — OEM list is community-maintained & stale on newer ROMs)
fun isExempt(ctx: Context): Boolean {
  val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
  return pm.isIgnoringBatteryOptimizations(ctx.packageName)
}
fun requestExempt(ctx: Context) {                                    // the STABLE AOSP path — always try this
  val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))
  try { ctx.startActivity(i) } catch (_: Exception) {
    try { ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (_: Exception) {}
  }
}
// Best-effort OEM autostart deep-links — gate EVERY one on resolveActivity + try/catch; if none resolves, the
// walkthrough copy must still tell the user "Settings → Apps → Homelander → Battery → Unrestricted, + turn on Autostart if present".
private val OEM_AUTOSTART = listOf(
  ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),       // Xiaomi MIUI/HyperOS — may be removed on newer HyperOS
  ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"), // Oppo ColorOS
  ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),         // Oppo ColorOS (alt)
  ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),                   // older Oppo
  ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"), // Vivo FunTouch
  ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),              // Samsung OneUI (battery screen)
  ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),      // Huawei (not a target geo, but cheap to include)
  ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"),              // Letv
)
fun openOemAutostartIfAvailable(ctx: Context): Boolean {
  for (cn in OEM_AUTOSTART) {
    val i = Intent().setComponent(cn)
    if (i.resolveActivity(ctx.packageManager) != null) { try { ctx.startActivity(i); return true } catch (_: Exception) {} }
  }
  return false
}
```

**Manifest:** add `<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>` (needed for the `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` prompt) and `<uses-permission android:name="android.permission.RUN_USER_INITIATED_JOBS"/>` (UIDT job, UP-07). Confirm Play-policy: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is allowed for apps with a legitimate background need (background upload qualifies) — but it's also one Play reviews; the apkRollout flavor isn't on Play so it's moot at MVP, just keep the justification on file for the deferred Play-Store milestone. `[CITED: support.google.com/googleplay foreground-service & full-screen-intent requirements]`

### Android: UIDT JobService skeleton (UP-07)

```kotlin
// apps/mobile/.../upload/UploadJobService.kt  (Source: developer.android.com data-transfer-options + JobScheduler)
class UploadJobService : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    // run UploadCoordinator.drain() on a background thread; call jobFinished(params, /*wantsReschedule=*/!queueEmpty) when done
    return true   // work continues on another thread
  }
  override fun onStopJob(params: JobParameters): Boolean = true   // reschedule if killed
}
// Schedule (from HumynForegroundService.onTimeout, or when no FGS is allowed):
fun scheduleUidt(ctx: Context) {
  val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
  js.schedule(JobInfo.Builder(UPLOAD_JOB_ID, ComponentName(ctx, UploadJobService::class.java))
    .setUserInitiated(true)
    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
    .build())
}
```

---

## State of the Art

| Old Approach                                      | Current Approach (2025/2026)                                                                                                                                                           | When Changed                      | Impact                                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataSync` FGS runs indefinitely in background    | `dataSync` FGS capped at **6 h / 24 h**; `Service.onTimeout()` callback; UIDT `JobService` (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS`) is the documented escape hatch       | Android 15 (API 35)               | UP-07 exists _because_ of this. Must implement `onTimeout` + the UIDT job. `[VERIFIED: developer.android.com behavior-changes-15]`                                                        |
| FGS type implicit / mismatched manifest tolerated | `foregroundServiceType` mandatory + strictly matched to manifest; some types can't be started from background                                                                          | Android 14 (API 34)               | The manifest superset + `startForeground`-re-call downgrade pattern (Pitfall 4). The Phase-3 two-sided test lock already enforces it. `[VERIFIED: developer.android.com fgs/changes]`     |
| `bee-queue` / `bull` v3                           | `bullmq` (current major 5.x) — TS-native, better retries/concurrency, queue events, `QueueEvents` for metrics                                                                          | bullmq 1.0 (2020); 5.x current    | The locked queue lib; `5.76.8` as of 2026-05-12. `[VERIFIED: npm registry]`                                                                                                               |
| ECS scaling on CPU only                           | ECS service auto-scaling on a CloudWatch **custom metric** (BullMQ `waiting` count, or SQS `ApproximateNumberOfMessages` ÷ running tasks = "backlog per task"), target-tracking policy | Standard pattern, well-documented | VERIFY-07 — the worker just needs to be horizontally safe (BullMQ is); the autoscale policy is Terraform/infra. `[CITED: aws.amazon.com/blogs/containers ECS autoscaling custom metrics]` |
| `aws-sdk` v2                                      | `@aws-sdk/client-*` v3 modular                                                                                                                                                         | v3 GA 2020; v2 in maintenance     | Already the codebase convention; `client-sqs` at the same minor as `client-s3` (3.1044.x).                                                                                                |
| AsyncStorage for queues                           | `react-native-mmkv`                                                                                                                                                                    | MMKV mainstream since ~2021       | Already pinned; AsyncStorage is on the "Do NOT Use" list for queues.                                                                                                                      |

**Deprecated/outdated for this phase:**

- `WorkManager.setExpedited()` as the background-upload mechanism — superseded by UIDT `JobService` for _data transfer_ specifically (`setExpedited` jobs are quota-limited and short; `setUserInitiated` is the data-transfer-blessed path).
- The `bull` (v3) package — use `bullmq`.
- Relying on S3-stored object checksums for verification — the codebase runs `WHEN_REQUIRED` checksums for LocalStack compat, and the locked design re-hashes the full bytes anyway.

---

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                         | Section                               | Risk if Wrong                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | The Phase-1 multipart backend (`/recordings/init`, `/parts/:n/complete`, `/finalize`) is functionally complete and only needs _additive_ changes for Phase 5 (worker pipeline, outbox, reconciliation endpoint, re-upload endpoint, `ip_address` population). | Standard Stack / Pattern 1            | If `/finalize` has bugs (e.g. the `recordings_to_verify` insert isn't actually wired, or the IMU `CompleteMultipartUpload` path is untested), Phase 5 has hidden backend work. Mitigation: a Wave-2 task should smoke the existing multipart flow end-to-end against LocalStack before building on it.     |
| A2  | "2 MB on cellular" (UP-02) is reconcilable with S3's 5 MiB non-final-part minimum by either bumping to 5 MB or treating 2 MB as an internal retry sub-unit.                                                                                                   | Pitfall 2                             | If the owner insists on literal 2 MB _S3 parts_, S3 will reject all but the last part. Needs an owner/planner decision before the upload task is written.                                                                                                                                                  |
| A3  | The literal `TCP_MAXSEG=1280` socket option (UP-19) is not reliably settable from a JVM/Kotlin OkHttp socket, so the 30 s no-progress watchdog is the real deliverable and the MSS clamp is best-effort.                                                      | Pitfall 7 / UP-19 row                 | If there's a clean OkHttp/Android API I missed (e.g. a newer `SocketFactory` hook or an NDK requirement the owner accepts), the plan could include a firmer MSS clamp. The watchdog is correct regardless; this only affects how the literal-clamp task is scoped.                                         |
| A4  | The `recording_events_outbox` + `onSend`-hook + `_events`-envelope mechanism is acceptable to the owner (CONTEXT.md left the wire shape to discretion).                                                                                                       | Pattern 3                             | If the owner wants a header or a different table shape, the envelope detail changes — but the behavioral contract (at-least-once + client idempotency on `(recording_id, event_type)` + reconciliation backstop) is what matters and is unaffected.                                                        |
| A5  | A `GET /recordings/verified-ids?since=<cursor>` thin endpoint is the right reconciliation surface (vs. a `?qa_status=verified` filter on `GET /recordings`).                                                                                                  | Pattern 4 / VERIFY-06                 | Either works; the thin endpoint is cleaner and Pattern-22-friendlier. Low risk.                                                                                                                                                                                                                            |
| A6  | Practice recordings are _not_ uploaded to S3 at MVP (or, if they are, they're routed to a separate prefix and not QA'd) — the Phase-5 upload filter skips `files/practice/` + `task_id == __practice__`.                                                      | Runtime/Code Reconciliation / D-08    | If practice recordings _should_ upload (e.g. for model debugging), the filter logic flips from "skip" to "route to a practice prefix". `idea-brief.md` says practice "does not count towards your contribution" but doesn't explicitly say "don't upload". Open Question 1.                                |
| A7  | Adding a `hash-mismatch → pending` (or `→ uploaded`) transition to `recording-state.ts` + a `POST /recordings/:id/reupload` endpoint is acceptable and necessary for UP-16.                                                                                   | Pitfall 9                             | If the owner prefers "a hash mismatch means the client mints a brand-new `recordingId` and re-uploads as a fresh recording", the design differs (and the old row stays `hash-mismatch` forever). The endpoint approach reuses the S3 keys (versioning on) and the existing row — cleaner. Open Question 2. |
| A8  | The OEM autostart component/package strings in the Code Examples table are _currently_ the best-known values but several are dead/renamed on newer ROMs — the AOSP fallback is the real guarantee.                                                            | Pattern 6 / Pitfall 1 / Code Examples | If a string is wrong, the `resolveActivity` gate makes it a silent no-op (no crash) — so the risk is "the OEM shortcut doesn't appear", not "the app breaks". The walkthrough copy must stand alone. Verify-on-device with whatever Xiaomi/Oppo/Vivo hardware is available.                                |

---

## Open Questions (RESOLVED)

1. **Are practice recordings uploaded to S3 at all at MVP?**

   - What we know: practice triples live under `files/practice/`, `task_id == __practice__`; the `.session.json` sidecar carries `is_practice: true`; `idea-brief.md` says practice "does not count towards your contribution"; D-08 says the upload _filter_ keys off the practice path/task_id.
   - What's unclear: "filter" could mean "don't upload" or "upload to a separate prefix, don't QA". The `__practice__` task*id isn't a real `tasks` row, so a practice recording would fail the `recordings.taskId` FK (`references(() => tasks.id)`) — strong signal practice recordings are \_not* meant to hit `/recordings/init` at all.
   - Recommendation: **practice recordings are deleted locally after the practice flow completes; they never enter the upload queue.** The upload filter = "skip any triple under `files/practice/` or with `task_id == __practice__`". Confirm with the owner in discuss/planning; it's a one-line filter either way.
   - **RESOLVED:** CONTEXT.md D-08 + Plan 05-04's `UploadQueueStore.enqueue()` practice filter (refuses any row whose `paths.mp4` is under `files/practice/` OR whose `taskId == "__practice__"`). Practice triples never enter the upload queue and never hit `/recordings/init`; the JS auto-enqueue path (Plan 05-08) also skips `__practice__` as a belt-and-suspenders.

2. **UP-16 re-upload mechanism: reuse the row + new `/reupload` endpoint, or mint a fresh `recordingId`?**

   - What we know: `recording-state.ts` has no `hash-mismatch → uploaded` edge; `init.ts` `onConflictDoNothing`s an existing row; `recordingKeys()` is deterministic; S3 versioning is on.
   - Recommendation: **add a `hash-mismatch → pending` transition + a `POST /recordings/:id/reupload` endpoint** (resets to `pending`, mints fresh multipart uploads to the same keys, returns the `/init` shape). Second mismatch → `dead-letter`. See Pitfall 9. Confirm in planning.
   - **RESOLVED:** Plan 05-03 adds the `recording-state.ts` `hash-mismatch → pending` edge (migration 0008 ships the schema half); Plan 05-05 adds `POST /recordings/:id/reupload` which reuses the existing row + the deterministic `recordingKeys()` (no fresh `recordingId`) and returns the `/init` shape. There is NO server-side "dead-letter after N re-uploads" cap (D-04a — the upload path is uncapped per account; the client surfaces `chip-failed` after its own retry budget, Plan 05-06/05-08).

3. **`ip_address` server-population — where exactly?** `idea-brief.md §7.4` says "server populates `ip_address` post-upload from the upload request". The only authenticated request the _upload_ makes is `/init` (and `/finalize`). `init.ts` currently doesn't capture `req.ip` into the row, and `toRecordingResponse()` hard-codes `ipAddress: null`. Recommendation: capture `req.ip` (honoring the trust-proxy config) into `recordings.ipAddress` at `/init` time (or `/finalize` time). Trivial; just needs to be a task.

   - **RESOLVED:** Plan 05-05 Task 2 sets `recordings.ipAddress = req.ip` on the `/recordings/init` INSERT (honoring Fastify `trustProxy` if configured) and changes `finalize.ts`'s `toRecordingResponse()` from `ipAddress: null` to `ipAddress: r.ipAddress` (UP-18). _(Unrelated note: the UP-02 "2 MB cellular" figure is reconciled to S3's 5-MiB minimum non-final part size — see Pitfall 2 + Plan 05-04's `UploadModels.kt` header + the 2026-05-12 dated note added to REQUIREMENTS.md UP-02 / the ROADMAP Phase-5 Success Criterion #1 by Plan 05-02.)_

4. **Does the upload-queue screen show "completed-this-session" rows briefly?** (CONTEXT.md leaves this to planner's call within the design system.) The History pattern shows `chip-success`. Recommendation: drop a row the moment its bundle is `verified` (the History screen — Phase 6 — is where completed recordings live); the Pending Uploads screen is strictly "in flight / failed / paused". Low-risk either way.

   - **RESOLVED:** Plan 05-08 (D-10 discretion) — a Pending-Uploads row is DROPPED the moment its bundle is `verified` (no completed-this-session retention); `chip-success` "✓ Uploaded" only flashes transiently before the row disappears. Completed recordings live on the History screen (Phase 6).

5. **Bull-Board for the worker queue — Phase 5 or Phase 7?** CONTEXT.md D-04b says Bull-Board is "a separate Phase-7 observability item". So: **not Phase 5.** Just confirming the planner doesn't accidentally pull it in.

   - **RESOLVED:** CONTEXT.md D-04b — Bull-Board (the worker-queue dashboard) is a Phase-7 observability item (tracked toward OBS-04), NOT Phase 5. No Bull-Board work ships this phase.

---

## Environment Availability

| Dependency                                                        | Required By                                                                               | Available                                                                                          | Version               | Fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Postgres (RDS in prod, `pgvector/pgvector:pg17` container in dev) | All backend state incl. the new `recording_events_outbox` table                           | ✓                                                                                                  | 17.x (docker-compose) | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LocalStack Community (S3 + Secrets Manager)                       | Dev S3 for `/init`/`/finalize` + worker `GetObject`                                       | ✓                                                                                                  | 4.0 (docker-compose)  | — (S3 multipart-via-presigned works on v4 Community per STACK.md)                                                                                                                                                                                                                                                                                                                                                                                                              |
| Redis 7                                                           | BullMQ broker (worker + `/finalize` enqueue in dev)                                       | ✗ — **not in `docker-compose.yml` today**                                                          | —                     | **Add `redis:7-alpine` to `docker-compose.yml`** (a new service `redis:`, `ports: ["6379:6379"]`, plus `REDIS_URL=redis://localhost:6379` in `.env.example`). No fallback — BullMQ requires Redis.                                                                                                                                                                                                                                                                             |
| LocalStack EventBridge + SQS                                      | The prod S3→EventBridge→SQS trigger leg                                                   | ✗ — `SERVICES: s3,secretsmanager` only; LocalStack's S3-notification→SQS path is flaky (Pitfall 6) | —                     | **Don't add it for dev.** Dev: `/finalize` enqueues BullMQ directly. Prod: real AWS EventBridge + SQS (wired via `infra/terraform/`).                                                                                                                                                                                                                                                                                                                                          |
| AWS SQS + EventBridge (prod)                                      | VERIFY-01 trigger in prod                                                                 | n/a in dev                                                                                         | —                     | Terraform module additions under `infra/terraform/modules/` (a `verify-queue` SQS + an EventBridge rule on the recordings bucket's `Object Created` events filtered to `*.mp4`/`*.csv`/`*.json` suffixes).                                                                                                                                                                                                                                                                     |
| ECS (Fargate) — second task definition for the worker             | Deploying `node dist/workers/hash-verify.js` + queue-depth autoscaling                    | n/a in dev (`infra/terraform/envs/dev/` generates env vars only)                                   | —                     | The `infra/terraform/modules/ecs/` module gains a `humyn-worker` task def + a service-autoscaling policy. Not exercised in dev; the worker runs as a local `node`/`tsx` process pointed at the local Redis + LocalStack.                                                                                                                                                                                                                                                       |
| Xiaomi / Oppo / Vivo / Samsung hardware                           | On-device verification of the OEM autostart deep-links (UP-09) + the OEM walkthrough copy | ✗ (only a Pixel 10a is referenced in the smoke trail)                                              | —                     | **No fallback — flag for the planner.** The AOSP fallback (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) works on the Pixel; the OEM deep-links can only be _fully_ verified on the actual ROMs. Plan should: (a) implement with `resolveActivity` gating so a wrong string is a silent no-op not a crash, (b) write a smoke-runbook step "verify OEM deep-link on <device> if available; otherwise verify the AOSP fallback + the standalone walkthrough copy on the Pixel". |

**Missing dependencies with no fallback:**

- Redis 7 in dev → must be added to `docker-compose.yml` (one-line service). Blocking for any local worker testing.
- Chinese-OEM hardware for full UP-09 verification → no fallback; mitigated by `resolveActivity` gating + standalone walkthrough copy + a "verify if available" runbook step.

**Missing dependencies with viable fallback:**

- LocalStack EventBridge/SQS → use the dev-shim (`/finalize` enqueues directly); the prod path is real AWS via Terraform.

---

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property                   | Value                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework (backend)        | `vitest@4.1.5` (pinned, CLAUDE.md) — `apps/api/vitest.config.ts` exists; tests under `apps/api/test/**`                                                                 |
| Framework (mobile JS)      | Jest (RN preset) — `apps/mobile/__tests__/**` (e.g. `__tests__/screens/recording/RecordingScreen.test.tsx`, `__tests__/visual/*.visual.test.tsx`)                       |
| Framework (Android Kotlin) | JUnit — `apps/mobile/android/app/src/test/java/**` (e.g. `CaptureLaunchSweepTest.kt`, `HumynForegroundServiceTest`, `manifests.test.ts` for the manifest↔bitmask lock) |
| E2E                        | Detox 20.51.1 (pinned, RN-0.83-compatible) — `apps/mobile/e2e/` per ARCHITECTURE; smoke walks are the primary on-hardware gate                                          |
| Quick run (backend)        | `cd apps/api && pnpm vitest run <path>`                                                                                                                                 |
| Full suite (backend)       | `cd apps/api && pnpm vitest run`                                                                                                                                        |
| Quick run (mobile JS)      | `cd apps/mobile && pnpm jest <path>`                                                                                                                                    |
| Quick run (Android)        | `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests <ClassName>`                                                                              |

### Phase Requirements → Test Map

| Req ID                                | Behavior                                                                                                                                                                                               | Test Type                          | Automated Command                                                                          | File Exists?                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| VERIFY-02                             | `sha256OfS3Object` streams a known object → expected hex                                                                                                                                               | unit                               | `pnpm vitest run test/lib/sha256-stream.test.ts` (LocalStack-backed)                       | ❌ Wave 0                    |
| VERIFY-03/04                          | `verifyRecording`: match → `qa_status='verified'` + outbox `verified`; mismatch → `'hash-mismatch'` + outbox `re-upload`; idempotent (re-run on already-`verified` is a no-op)                         | integration                        | `pnpm vitest run test/workers/verify-recording.test.ts`                                    | ❌ Wave 0                    |
| VERIFY-05                             | `onSend` hook attaches `_events` for the authed user and marks rows `delivered_at`; unauthed/non-object responses untouched; Pattern-22 (no strict-schema breakage)                                    | integration                        | `pnpm vitest run test/plugins/events-outbox.test.ts`                                       | ❌ Wave 0                    |
| VERIFY-06                             | `GET /recordings/verified-ids?since=` returns the right ids + cursor; only the caller's recordings                                                                                                     | integration                        | `pnpm vitest run test/routes/recordings/verified-ids.test.ts`                              | ❌ Wave 0                    |
| UP-16                                 | `POST /recordings/:id/reupload`: only from `hash-mismatch`; resets to `pending`; mints fresh multipart uploads; 409 from other states; second mismatch → `dead-letter` (or whatever the planner picks) | integration                        | `pnpm vitest run test/routes/recordings/reupload.test.ts`                                  | ❌ Wave 0                    |
| UP-18                                 | `/init` (or `/finalize`) populates `recordings.ip_address` from `req.ip`                                                                                                                               | integration                        | extend `test/routes/recordings/init.test.ts` (or the existing recordings route test)       | ❌ Wave 0 (extend)           |
| recording-state                       | `canTransition('hash-mismatch','pending')` (or `'uploaded'`) added                                                                                                                                     | unit                               | `pnpm vitest run test/lib/recording-state.test.ts`                                         | ❌ Wave 0 (extend if exists) |
| Schema migration                      | `recording_events_outbox` table + index created; `drizzle-kit` schema matches migration                                                                                                                | migration test                     | the project's existing migration-roundtrip test pattern                                    | ❌ Wave 0                    |
| UP-02 (chunk-size pick)               | `chunkBytesForNetwork(caps)` → 8 MiB Wi-Fi, ≥5 MiB cellular                                                                                                                                            | unit (Kotlin)                      | `./gradlew :app:testApkRolloutDebugUnitTest --tests *.upload.ChunkSizeTest`                | ❌ Wave 0                    |
| UP-04 (retry/backoff)                 | `ChunkUploader` retries 2/4/8/16/32/64 s then dead-letters; a done part is never re-PUT                                                                                                                | unit (Kotlin, fake OkHttp)         | `./gradlew ... --tests *.upload.ChunkUploaderRetryTest`                                    | ❌ Wave 0                    |
| UP-05/10/13 (queue + lifecycle)       | `UploadQueueStore` round-trips through MMKV; `bootstrap()` only resumes rows whose `ownerUserId == currentSub`; logout keeps rows                                                                      | unit (Kotlin)                      | `./gradlew ... --tests *.upload.UploadQueueStoreTest`                                      | ❌ Wave 0                    |
| UP-06 (FGS downgrade)                 | `HumynForegroundService` `startForeground` re-called with `DATA_SYNC` on upload-active; manifest↔bitmask lock still passes; `onTimeout` → `stopSelf()` + UIDT schedule                                | unit (Kotlin)                      | extend `HumynForegroundServiceTest` + `manifests.test.ts`                                  | ❌ Wave 0 (extend)           |
| D-03 (`CaptureLaunchSweep` discard)   | An orphan-with-playable-MP4 is now **deleted** (not re-finalized); `run()` returns `emptyList()`                                                                                                       | unit (Kotlin)                      | update `CaptureLaunchSweepTest.kt`                                                         | ✅ exists — **update**       |
| D-05 (device-distress → Home)         | Battery-≤5%/thermal stop navigates to Home (or onboarding for practice), not `'ready'`                                                                                                                 | unit (RN)                          | extend `__tests__/screens/recording/RecordingScreen.test.tsx`                              | ✅ exists — **extend**       |
| D-07 (toast duration)                 | `RECOVERY_TOAST_MS === 5_000`; listener still no-ops cleanly when `recovered` is empty                                                                                                                 | unit (RN)                          | extend `__tests__/...bootRecoveryListener` (create if absent)                              | ❌/✅ (verify)               |
| UP-12 / D-10 (Pending Uploads screen) | Renders queue rows with the History row layout + the correct chip per state incl. the new "Paused — no Wi-Fi" variant                                                                                  | unit + visual (RN)                 | `pnpm jest __tests__/screens/uploads/PendingUploadsScreen.test.tsx` (+ `.visual.test.tsx`) | ❌ Wave 0                    |
| UP-09 (battery-opt walkthrough)       | `BatteryOptimizationHelper.openOemAutostartIfAvailable` no-ops (no crash) when no OEM activity resolves; AOSP fallback fires                                                                           | unit (Kotlin, fake PackageManager) | `./gradlew ... --tests *.upload.BatteryOptimizationHelperTest`                             | ❌ Wave 0                    |

### Sampling Rate

- **Per task commit:** the relevant quick-run command above (e.g. `pnpm vitest run test/workers/verify-recording.test.ts` or `./gradlew :app:testApkRolloutDebugUnitTest --tests <Class>`).
- **Per wave merge:** `cd apps/api && pnpm vitest run` (backend) + `cd apps/mobile && pnpm jest` + `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest` (mobile).
- **Phase gate:** full suites green + the Wave-1 on-hardware smoke runbook (D-06 tones, D-09 rotate glyph, D-05 nav, crash-recovery now-discards) + the upload smoke (record → auto-upload → background the app → see it land in S3 → worker flips `verified` → `_events` on next API call → local triple deleted → reconciliation sweep finds nothing left) + (if hardware available) one OEM-ROM check of the UP-09 walkthrough, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `apps/api/test/lib/sha256-stream.test.ts` — VERIFY-02
- [ ] `apps/api/test/workers/verify-recording.test.ts` — VERIFY-03/04
- [ ] `apps/api/test/plugins/events-outbox.test.ts` — VERIFY-05
- [ ] `apps/api/test/routes/recordings/verified-ids.test.ts` — VERIFY-06
- [ ] `apps/api/test/routes/recordings/reupload.test.ts` — UP-16
- [ ] migration-roundtrip coverage for `recording_events_outbox`
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/upload/*Test.kt` — ChunkSize, ChunkUploaderRetry, UploadQueueStore, BatteryOptimizationHelper
- [ ] `apps/mobile/__tests__/screens/uploads/PendingUploadsScreen.test.tsx` (+ `.visual.test.tsx`)
- [ ] **Redis container in `docker-compose.yml`** + `REDIS_URL` in `.env.example` — required before any worker test runs
- [ ] Extend existing: `CaptureLaunchSweepTest.kt` (D-03 discard), `RecordingScreen.test.tsx` (D-05 nav), `HumynForegroundServiceTest` + `manifests.test.ts` (UP-06 `dataSync` downgrade + `onTimeout`)

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | All Phase-5 endpoints (`/recordings/verified-ids`, `/recordings/:id/reupload`, and the existing `/recordings/*`) use `app.requireAuth` (JWT `sub`/`flavor`) — already the codebase pattern. The hash-verify worker has no HTTP surface; it talks to RDS + S3 + Redis only, all in-VPC.                                                                                                                                                                                                                                                                                  |
| V3 Session Management | yes     | The upload module attaches the current `@fastify/jwt` bearer to `/init`/`/finalize`/`/reupload`/`verified-ids`. On logout the queue is preserved but rows are pinned to `ownerUserId` (UP-13 / Pitfall 8) so a different account can't drain them.                                                                                                                                                                                                                                                                                                                      |
| V4 Access Control     | yes     | Every recording read/write checks `rec.userId === req.user.sub` (the `/recordings/:id/*` routes already do — mirror it in `/reupload`). `GET /recordings/verified-ids` filters on `userId = req.user.sub`. The `onSend` outbox hook only drains rows for `req.user.sub`. The worker writes outbox rows with the recording's owning `userId` (not a request-derived one).                                                                                                                                                                                                |
| V5 Input Validation   | yes     | Zod schemas for the new request/response shapes in `shared/types/` (the `RecordingsInit*Schema` family + a new `RecordingsReuploadResponseSchema` + a `VerifiedIdsResponseSchema`). The `_events` envelope payload the _client_ receives is validated client-side (`Array.isArray` + per-item `recording_id` is a 26-char string + `event_type ∈ {'verified','re-upload'}`) before acting — mirror `bootRecoveryListener.ts`'s "don't trust the payload shape blindly" (Pattern 6 there). The crash-recovery payload guard (`isStringArray`) is the existing precedent. |
| V6 Cryptography       | yes     | SHA-256 via Node `crypto.createHash` (stdlib) on the worker; SHA-256 on device via the existing `HashStreamer.kt` (already shipped). Never hand-roll a hash. The presigned URLs are SigV4 (AWS SDK) — don't reimplement signing. JWT is HS256 over a Secrets-Manager secret (existing).                                                                                                                                                                                                                                                                                 |

### Known Threat Patterns for {Node/Fastify backend + Android native module + S3 + Redis}

| Pattern                                                                                                        | STRIDE                             | Standard Mitigation                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forged `recording_id` in `/reupload` or `verified-ids` to read/mutate another user's recording                 | Tampering / Information disclosure | `rec.userId === req.user.sub` check on every recording-scoped route (existing pattern in `get.ts`/`finalize.ts`/`reject.ts`); `verified-ids` filters on `userId`; the `onSend` hook never trusts a request-supplied user id.                                                                              |
| Replayed `verified`/`re-upload` `_events` causing a double-delete or re-upload loop                            | Tampering                          | Client de-dups on `(recording_id, event_type)` in MMKV (`processedEvents` set); a redelivered event is a no-op. The reconciliation sweep is convergent (it only ever deletes already-`verified` local files).                                                                                             |
| Cross-account upload-queue drain on a shared phone                                                             | Elevation of privilege / Spoofing  | `ownerUserId` pin on every queue row; `bootstrap()`/`resume()` only acts on rows owned by the current `sub` (Pitfall 8).                                                                                                                                                                                  |
| Worker fed a `recordingId` for a row that doesn't exist / isn't `uploaded` (stale SQS message, double-enqueue) | DoS / data integrity               | `verifyRecording` early-returns if the row is missing or not `uploaded` — idempotent. `queue.add` uses `recordingId` as the BullMQ jobId so a double-enqueue collapses to one job.                                                                                                                        |
| OEM deep-link `Intent` crashing or being hijacked by a malicious component claiming the same `ComponentName`   | DoS / (theoretical) intent hijack  | `resolveActivity`-gated + explicit `ComponentName` (not an implicit action) + try/catch — and the AOSP fallback is the real path. An explicit `ComponentName` can't be intercepted by a different app.                                                                                                    |
| `react-native-fs` unlink path-traversal (deleting the wrong file on `verified`)                                | Tampering                          | The delete target is derived from the recording's known `recordingKeys()` base under `filesDir/recordings/` (or `filesDir/practice/`) — never from a server-supplied path. The `_events` payload carries only a `recording_id`; the local path is recomputed, not received.                               |
| Redis exposed / unauthenticated                                                                                | Information disclosure             | ElastiCache in-VPC, security-group-scoped to the ECS tasks; in dev the container is localhost-only. (Redis holds BullMQ job payloads = just `recordingId`s — low sensitivity — but still don't expose it.)                                                                                                |
| Presigned URL leakage (logs, crash reports) extending S3 write access                                          | Information disclosure             | Never log the presigned URLs (mirror `s3-client.ts`'s posture); strip them from any diagnostic snapshot; 15-min TTL (`PRESIGNED_TTL_SECONDS`) bounds the window; the recording filename (timestamped) is also a mild PII leak — log `recording_id` (ULID), not the filename (existing PITFALLS guidance). |

---

## Sources

### Primary (HIGH confidence)

- **Project code (read this session):** `apps/api/src/routes/recordings/{init,complete-part,finalize,list,schemas}.ts`, `apps/api/src/lib/{recording-state,s3-client,idempotency-store}.ts`, `apps/api/src/plugins/idempotency.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/routes/events/post.ts`, `apps/api/src/app.ts`, `shared/types/src/{recording,events,index}.ts`, `apps/mobile/.../capture/CaptureLaunchSweep.kt`, `apps/mobile/.../fgs/HumynForegroundService.kt`, `apps/mobile/src/boot/bootRecoveryListener.ts`, `docker-compose.yml`, `.env.example`, `apps/api/package.json`, `idea-brief.md §7/§8.3/§11`, `video_metadata.json`, `IMU-FORMAT.md`, `design-spec.md §13/§14/§16/§21.7`, `engineering-handoff.md §11`.
- **Project research (extended, not duplicated):** `.planning/research/STACK.md` (LocalStack Community S3 multipart support; AWS SDK v3 pins; FGS type notes), `.planning/research/PITFALLS.md` (Pitfalls 6/11/12/15 — FGS Android 14/15, OEM battery managers, Jio/Vivo MTU blackhole, hash-verify race), `.planning/research/ARCHITECTURE.md` (Pattern 5 worker-as-separate-ECS-task; the dev-vs-LocalStack split; Redis 7+ single replica; the reconcile-on-launch sketch), `.planning/research/FEATURES.md` (network-state surfacing, no-manual-cancel rationale).
- **AOSP / Android Developers:** [Behavior changes: Android 15+](https://developer.android.com/about/versions/15/behavior-changes-15), [Foreground service timeouts](https://developer.android.com/develop/background-work/services/fgs/timeout), [Changes to foreground services](https://developer.android.com/develop/background-work/services/fgs/changes), [Restrictions on starting an FGS from the background](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start), [Data transfer background task options](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options), [`OsConstants`](https://developer.android.com/reference/android/system/OsConstants), [`SocketOptions`](https://developer.android.com/reference/java/net/SocketOptions).
- **npm registry (versions verified 2026-05-12):** `bullmq` 5.76.8, `ioredis` 5.10.1, `@aws-sdk/client-sqs` 3.1045.0, `@aws-sdk/client-eventbridge` 3.1045.0.
- **BullMQ docs:** [docs.bullmq.io](https://docs.bullmq.io/), [bullmq.io](https://bullmq.io/).

### Secondary (MEDIUM confidence — verified against a primary source where possible)

- [AWS — ECS auto-scaling using custom metrics (SQS backlog-per-task)](https://aws.amazon.com/blogs/containers/amazon-elastic-container-service-ecs-auto-scaling-using-custom-metrics/) — cross-checked with the BullMQ-on-ECS write-ups below.
- [How to set up scalable queue workers on AWS using ElastiCache, ECS, and BullMQ](https://dev.to/bhaskar_sawant/how-to-set-up-scalable-queue-workers-on-aws-using-elasticache-ecs-and-bullmq-3g2j) / [Building a high-performance architecture with BullMQ and AWS](https://www.gperrucci.com/blog/aws/scaling-async-workloads-bullmq-aws).
- [Testing S3 notifications locally with LocalStack & Terraform](https://hashnode.localstack.cloud/testing-s3-notifications-locally-with-localstack-terraform) + open issues [localstack/localstack #1216](https://github.com/localstack/localstack/issues/1216), [#3097](https://github.com/localstack/localstack/issues/3097), [#4763](https://github.com/localstack/localstack/issues/4763), [#12195](https://github.com/localstack/localstack/issues/12195) — basis for the "shim the dev EventBridge→SQS leg" recommendation.
- [Play Console — foreground service & full-screen-intent requirements](https://support.google.com/googleplay/android-developer/answer/13392821) — `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` justification note (deferred Play milestone only).

### Tertiary (LOW confidence — flagged for on-device validation)

- [OEM battery-optimization Intent components gist](https://gist.github.com/moopat/e9735fa8b5cff69d003353a4feadcdbc) — community-maintained, **stale on newer ROMs**; the component/package strings in the Code Examples table are best-effort and must be `resolveActivity`-gated with an AOSP fallback. The HyperOS/ColorOS/FunTouch churn is corroborated by `.planning/research/PITFALLS.md` (Pitfall 11, citing dontkillmyapp.com) and [a DEV.to "11 layers" survey](https://dev.to/stoyan_minchev/what-android-oems-do-to-background-apps-and-the-11-layers-i-built-to-survive-it-28bb).
- The literal-`TCP_MAXSEG=1280`-from-Kotlin reachability claim (Pitfall 7) — based on `java.net.Socket`/OkHttp API surface + the `setsockopt(TCP_MAXSEG)` "must be pre-`connect()`, advisory on some kernels" behavior ([man setsockopt; FreeBSD/RHEL threads](https://access.redhat.com/solutions/3481051)); needs an on-device spike to confirm whether a custom `SocketFactory` clamp takes.

---

## Metadata

**Confidence breakdown:**

- Standard stack (`bullmq`/`ioredis`/SQS SDK versions, the worker-as-separate-ECS-task shape): **HIGH** — npm-verified versions, ARCHITECTURE research already locked the shape, the Phase-1 backend code confirms the seams.
- Architecture patterns (outbox + `onSend` hook, reconciliation endpoint, FGS downgrade, UIDT job): **HIGH** on the FGS/UIDT specifics (AOSP docs) and the `onSend` precedent (`idempotency.ts`); **MEDIUM** on the exact outbox wire shape (CONTEXT.md left it to discretion — the recommendation is sound but the planner may adjust).
- Pitfalls: **HIGH** for the Android 14/15 FGS rules + the hash-verify race + the `partsCount`/5-MiB-minimum gotcha (AOSP/AWS docs); **MEDIUM** for OEM deep-link staleness (community sources + corroborating research, but ROM-version-dependent and untestable here); **MEDIUM** for the `TCP_MAXSEG`-unreachable claim (API-surface reasoning, needs an on-device spike).
- The UP-16 re-upload gap + the `ip_address`-population gap + the practice-recordings-don't-upload inference: **MEDIUM** — derived from reading the Phase-1 code + the FK constraint; flagged as Open Questions for owner/planner confirmation.

**Research date:** 2026-05-12
**Valid until:** ~2026-06-12 for the npm pins + AWS/AOSP behavior (stable); ~2026-05-26 for the OEM deep-link strings (ROM-churn-sensitive — re-verify on-device when the upload module is built).
