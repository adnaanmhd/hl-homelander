# Phase 5: Upload Pipeline & Hash-Verify Worker — Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

> **Phase rename pending.** ROADMAP.md still titles this phase "Upload Pipeline, Hash-Verify Worker & Anti-fraud". The owner descoped all anti-fraud work to §v2 (see D-04). The phase should be re-titled **"Upload Pipeline & Hash-Verify Worker"** and FRAUD-05 / FRAUD-06 moved to REQUIREMENTS.md §v2. Folding that edit into the Phase-5 plan (or a `/gsd-phase edit 5`) is fine — it does not block planning. The directory slug stays `05-upload-pipeline-hash-verify-worker-anti-fraud` so `/gsd-plan-phase 5` resolves it.

<domain>
## Phase Boundary

Phase 5 makes a finished recording's three-file bundle (MP4 + IMU CSV + metadata JSON) upload itself automatically and prove it landed intact:

1. **Wave 1 — cosmetic / cleanup pass** (runs FIRST, before any upload work — mirrors how `02-COSMETIC-GAPS.md` was Phase 3's Wave 1): work through `04-COSMETIC-GAPS.md` — the doc-only polish bucket + the open code items resolved in this discussion (see D-05..D-09).
2. **`HumynUpload` (Android native module)** — S3 multipart via presigned URLs (8 MB chunks Wi-Fi / 2 MB cellular, 3 chunks × 2 files parallel, independent chunk retry with 2/4/8/16/32/64 s backoff → DLQ, no whole-file restart, no manual user-cancel, TCP_MAXSEG=1280 + 30 s no-progress abandon-and-retry-with-fresh-socket on cellular); auto-starts on recording stop; runs in a foreground service that downgrades type `camera|microphone|dataSync` → `dataSync` → stops after 5 min idle; UIDT JobService (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS`) for true-background work past the Android 15 6-hour `dataSync` cap; OEM battery-optimization walkthrough at first upload (Xiaomi MIUI / Oppo ColorOS / Vivo FunTouch / Samsung OneUI / stock); uploads pause during recording and resume on stop; logout cancels in-flight but preserves the queue, same-user re-login resumes; cellular allowed by default, no Wi-Fi-only toggle; sends `null` `ip_address` (server populates).
3. **Pending Uploads UI** — the upload-queue screen (per-file rows: filename / duration / thumbnail / state) reached from the Home "Pending uploads" tile.
4. **Hash-verify worker** — BullMQ on Redis + ECS, autoscaled on queue depth; consumes S3 multipart-complete events via EventBridge → SQS; re-hashes the MP4 and the IMU CSV from S3, compares to the manifest hashes (`file_sha256`, `imu_sha256`); on match flips `recordings.qa_status = 'verified'` and emits a `verified` event; on mismatch flips `qa_status = 'hash-mismatch'` and emits a `re-upload` event.
5. **Server→client event delivery** — `verified` / `re-upload` events piggy-backed on every authenticated API response (no FCM/APNs at MVP); on `verified` the app deletes the local MP4 + CSV + JSON; on `re-upload` it re-uploads from the still-present local copy; an app-launch reconciliation sweep queries the backend for the verified-but-undeleted set and cleans any local files the user no longer needs.

**iOS is out of scope** (deferred to a follow-on milestone — REQUIREMENTS.md §v2 IOS-01..07): no `HumynUploadIOS`, no `URLSessionConfiguration.background` work. UP-08's iOS clause is not built this phase; document the gap.

**Anti-fraud is out of scope** — descoped to §v2 in this discussion (D-04). No per-account upload-rate cap (FRAUD-05), no pre-payout fraud dashboard (FRAUD-06), no `liveness_score` work (FRAUD-03/04 were already in §v2).

</domain>

<decisions>
## Implementation Decisions

### Anti-fraud — descoped from MVP

- **D-04:** Owner directive — **push all anti-fraud to §v2**. FRAUD-05 (per-account daily upload-rate cap) and FRAUD-06 (pre-payout fraud monitoring dashboard) move to REQUIREMENTS.md §v2 alongside the already-deferred FRAUD-03/04. MVP anti-fraud stays exactly what `idea-brief.md §11` already names: Play Integrity at sign-in + the on-device one-shot hand gate. Nothing new.
- **D-04a:** **No per-account upload-rate cap of any kind at MVP** — not a fraud cap, not a "generous safety cap". The upload path is fully uncapped per account. (S3 day-zero lifecycle + the hash-verify worker's queue-depth autoscaling already bound cost/compute; a runaway client is a §v2 problem.) No server-side rejection-on-cap logic, no client-side "retry tomorrow" path.
- **D-04b:** **No fraud dashboard** — no web UI, no admin API route, no scheduled export job, no SQL-views deliverable. (Bull-Board for the worker queue is a separate Phase-8 observability item, unaffected.)
- **D-04c:** The `recordings.flavor` column stays (it's also build-cohort analysis for Phase 8 observability). The `recordings.liveness_score` column stays (harmless; stays NULL at MVP — it was always going to). No schema changes needed for the descope.
- **D-04d:** Roadmap/requirements housekeeping the planner should fold in: re-title the phase (see banner above); move FRAUD-05/06 to §v2 in REQUIREMENTS.md with a dated note; update the §v2 "Anti-fraud" group; trim the Phase 5 ROADMAP success criterion #5 (the fraud-surface bullet) and the requirements list (drop FRAUD-05, FRAUD-06).

### Crash-recovered segments — discard, never upload

- **D-03:** A force-quit / OS-evict that happens **after** the first 30 s `moof` flush currently leaves a real ~30 s+ video fragment that `CaptureLaunchSweep` re-finalizes into a usable `{base}.{mp4,csv,json}` triple — but with degenerate metadata (`duration_seconds: 0`, null `imu_video_drift_*`, null `imu_min_rate_hz_observed_p1` — none of those can be recomputed from a crash-truncated partial). **Owner decision: `CaptureLaunchSweep` discards ALL crash-truncated fragments, not just the sub-30 s `ftyp`+`moov` stubs** — the post-30 s fragment is deleted (mp4 + csv + `.session.json` sidecar) on next launch instead of being re-finalized. No degenerate bundle ever reaches the upload queue. The cost: a force-quit-mid-record loses whatever was captured (acceptable — it's an edge of an edge, and keeps every uploaded bundle's metadata honest).
- **D-03a:** Consequence — **the ROADMAP's "Phase 5's upload path should tolerate a recovered segment's `duration_seconds: 0` + null drift fields" note is RESCINDED.** The upload-bundle validation / hash-verify worker do NOT need to special-case `duration_seconds: 0` or null drift, because such a bundle is never produced. (If the planner wants a belt-and-suspenders guard against a malformed bundle anyway, fine — but it's not a requirement and not the design intent.)
- **D-03b:** This is a small behavior change to `CaptureLaunchSweep` (capture/recovery code, shipped in Phase 3 plan 03-09). Put it in **Wave 1** (it's a cleanup, not the upload pipeline). The "recovered after force-quit — uploading" toast (D-07) still applies — `CaptureLaunchSweep` still recovers the post-30 s case in the sense of "there was a real partial here"... no — wait: with D-03, the post-30 s partial is **discarded**, so there is **nothing recovered to upload**. Re-read: after D-03, `CaptureLaunchSweep` never produces a recovered upload-able segment. The crash-recovery toast (D-07) therefore only ever fires if some _other_ recovery path produces an upload-able segment — keep the toast wiring but expect it to fire rarely-to-never. **Planner: reconcile D-03 with the toast — if no recovery path can produce an upload-able segment any more, the "recovered — uploading" toast may be dead code and the D-07 decision is moot. Verify against the actual `CaptureLaunchSweep` / `bootRecoveryListener.ts` code before implementing.**

### Wave 1 — cosmetic / cleanup pass (`04-COSMETIC-GAPS.md`)

- **D-05:** Device-distress mid-record stop (battery ≤5 % REC-11, or thermal abort) — **navigate to Home** after finalizing, instead of resetting to the RecordingScreen-`'ready'` substate. (Normal sub-60 s discard keeps its current behavior per REC-05 — "re-pressing record starts a fresh recording"; only the _device-distress_ stops bounce to Home.) Edge to resolve in planning: a _practice_ recording mid-onboarding that hits device-distress — "Home" may not exist yet; planner picks the sane destination (resume onboarding vs Home) — keep it simple.
- **D-06:** Alert-cue tones (`HumynBeep.playTone` — the battery-15 % 520 Hz beep, the thermal-abort 440→560→680 Hz sequence) — **re-check on hardware with the device's media volume turned up**. The re-walk showed them inaudible while media volume was at ~3.6 %; the recording-cue TTS (louder path) was audible, and the first walk heard the 520 Hz beep. Almost certainly device state, not a bug. Action = a verification step in the Wave-1 smoke runbook; only chase a `HumynBeep` / SoundPool fix if the tones are still silent at full media volume.
- **D-07:** Crash-recovery "Recording recovered after force-quit — uploading." toast — **keep the current architecture** (fires from `App.tsx`'s mount effect during the splash bootstrap; `<ToastHost />` is a navigator sibling so the pill persists across splash → Home) **but set the toast duration back to 5 s** (down from the 15 s workaround). Conscious trade-off: at 5 s the pill displays during the splash bootstrap and will likely have faded before Home renders (this is the pre-15 s-bump behavior — "no Home toast" was an _observation_, not a bug to re-fix). Do **not** do the "stash + trigger from Home mount" refactor. Annotate `bootRecoveryListener.ts` so a future contributor doesn't re-bump it. **See D-03b** — if D-03 makes the recovery path produce nothing upload-able, this toast may be dead; reconcile.
- **D-08:** `is_practice` in the finalized metadata JSON — **leave it out**. Practice recordings stay segregated by the `files/practice/` directory + `task_id == __practice__`; the `.session.json` sidecar keeps its `is_practice` field, the finalized `{base}.json` does not gain one. The Phase-5 upload filter (which segments to _not_ upload, or to route differently) keys off the `files/practice/` path + `task_id == __practice__`.
- **D-09:** The doc-only polish bucket from `04-COSMETIC-GAPS.md` ships in Wave 1: refresh the stale `04-MANUAL-SMOKE.md` §2/§3 step text (120 ms not 80 ms vibrate; en-US female not en-IN; 2 × 250 ms gate dwell not 5 × 400 ms; live camera preview from `'ready'` onward; `onSegmentStart`/`onSegmentComplete` are the RN-bridge events, not `onSessionStart`/`onSessionStop` logcat lines; no `is_practice` in finalized metadata per D-08); reflect the shipped owner deviations into `design-spec.md §6` / `04-UI-SPEC.md § Copywriting` (PracticeIntro shortened copy commit `eaaa1fe`; en-US female cue voice; RigTutorial camera-framing tip); eyeball the `RotatePrompt.tsx` portrait-phone glyph on-device (sanity-check it reads as "rotate your phone"). The two items already FIXED in the `/gsd-debug phase4-smoke-fixes` round (`start_gate.duration_ms` monotonic fix; `HumynGateCameraViewManager` no-op `@ReactProp`) need nothing.

### Pending Uploads UI — reuse the History pattern

- **D-10:** The upload-queue screen (UP-12) is **built by reusing the existing History row layout** — the 64×64 thumbnail + name (15/600) + meta line (12 px secondary) + status chip pattern from `design-spec.md §16` — with per-file rows. **No `/gsd-ui-phase 5`.** `design-spec.md §21.7` flags the screen's states (queued / paused-no-wifi / failed-with-retry / completed) as an unresolved TBD → resolve them inside the locked design system: reuse the existing chip variants (`chip-progress` "Uploading…", `chip-failed` "Upload failed", `chip-success` "✓ Uploaded") and add **one** new chip variant in the identical style for "Paused — no Wi-Fi" (offline). The Home "Pending uploads" tile already exists in `prototype.html` / `design-spec.md §14` (returning-state) — wire it to real data; its `count > 0` visibility logic + pull-to-refresh + offline banner are explicitly **Phase 6's** job (Phase 6 success criterion #3), not Phase 5 — Phase 5 just makes the tile render real pending rows and makes the tap-through screen exist.
- **D-10a:** No new visual language, no new tokens, no animation curves beyond what `design-spec.md` already defines. Copy strings for the new states should match the History/upload-status vocabulary already in `design-spec.md` (and `help-center-content.md`'s "Pending uploads" mentions).

### Claude's Discretion

- The exact wire shape of the server→client event-piggyback channel (a per-user events-outbox table drained on each authenticated response via an `onSend` hook? response-envelope key vs. header? at-least-once with client-side idempotency on `recording_id` + event-type?) — researcher/planner's call, grounded in `engineering-handoff.md` and the existing API response patterns. The behavioral contract is fixed (VERIFY-03/04/05, UP-14/15/16, VERIFY-06); the mechanism is not.
- The dev-environment wiring for the hash-verify worker (a local Redis container in `docker-compose.yml` + a worker process you run locally + LocalStack EventBridge→SQS? or a simpler synchronous "poll S3 / call the worker inline" dev shim?) — researcher's call. **Note the CLAUDE.md tension to resolve:** "Do NOT Use → Redis at MVP — Postgres-only; queue lives on device" refers to the _upload_ queue (on-device, MMKV-backed); the _hash-verify worker_ queue is BullMQ-on-Redis-on-ECS per VERIFY-01/07 and the ROADMAP. The planner should add a one-line carve-out to CLAUDE.md's "Do NOT Use" entry (or the Conventions section) so this isn't read as a contradiction, and add the Redis pin to `research/STACK.md` if it's missing.
- The reconciliation-sweep backend surface (a new query param on `GET /recordings` filtering `qa_status = 'verified' AND id IN (...)`? a dedicated `GET /recordings/verified` since-cursor endpoint? piggy-back the verified set on an existing response?) — planner's call.
- Whether the upload-queue screen also surfaces _completed-this-session_ rows briefly (the History pattern shows `chip-success`) or drops a row the moment its bundle is `verified` — planner's call within the design system.

### Folded Todos

None — no pending-todo matches for Phase 5 scope.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked capture / upload / verification spec

- `idea-brief.md §7` — Upload Pipeline (Technical): §7.1 protocol (8 MB chunks, 3×2 concurrency, 2/4/8/16/32/64 s backoff → dead-letter, cellular-by-default), §7.2 the three-file bundle + "files NOT decoded/re-encoded/transcoded/stripped", §7.3 integrity verification (phone SHA-256s both files into metadata → upload → backend re-hashes → `verified`/`re-upload` events → local delete only after `verified`), §7.4 background & lifecycle (foreground service survives backgrounding/OS-evict; iOS swipe-kill limited; OEM battery-optimization exemption at first upload; uploads pause during recording; cancel-on-logout / preserve queue / same-user re-login resumes; server populates `ip_address`).
- `idea-brief.md §6.x` — capture spec (`§6.6` 30 s `moof` flush is the reason crash-recovery has a 30 s granularity — relevant to D-03), `§8.3` metadata JSON schema (the `file_sha256` / `imu_sha256` / `imu_video_drift_*` / `imu_min_rate_hz_observed_p1` fields the worker reads back).
- `idea-brief.md §11` — Anti-Fraud (MVP): the canonical "MVP anti-fraud = Play Integrity at sign-in + on-device hand gate; everything else deferred" statement. D-04 keeps this as-is.
- `idea-brief.md §5.9` — Upload (user-facing summary), `§5.2` privacy/consent (coarse location only, server logs consent timestamp+version) — context for the upload bundle's location/IP fields.
- `IMU-FORMAT.md` — the `timestamp_ns,sensor_type,x,y,z` CSV the worker re-hashes byte-for-byte.
- `video_metadata.json` (repo root) — the example finalized metadata JSON shape the worker reads.
- `CLAUDE.md` — project rules: "Files never re-encoded. MP4, IMU CSV, metadata JSON travel byte-for-byte device → S3"; the ±1 ms drift gate relaxation; audio-dropped; the "Do NOT Use → Redis at MVP" line the planner must carve out (see Discretion).

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — UP-01..UP-19, VERIFY-01..VERIFY-07 are this phase's binding requirements. FRAUD-05, FRAUD-06 are descoped per D-04 → move to §v2. (§v2 already holds FRAUD-03/04, DIST-05/06, IOS-01..07, SEARCH-V2-01.)
- `.planning/ROADMAP.md` — Phase 5 section (goal + 5 success criteria); the prose note in the overview about Wave 1 + the (now-rescinded, D-03a) `duration_seconds: 0` tolerance line; the Phase 5↔Phase 6 split for the upload-queue screen vs. the Home-tile visibility logic.
- `.planning/STATE.md` — Deferred Items, Decisions, Roadmap Evolution; carries the 2026-05-11 anti-fraud descope trail (FRAUD-03/04) that D-04 extends.
- `deferred-decisions.md` (repo root) — where the deferred fraud-defense designs live; FRAUD-05/06 should land here / in §v2.
- `imu-liveness-check.md` (repo root) — the §v2 server-side IMU-liveness design; NOT built this phase (D-04). The upload bundle carries the IMU CSV regardless.

### Engineering handoff & design source-of-truth

- `engineering-handoff.md §7.3` — Upload pipeline (handoff-level detail); `§11` — the Firebase Analytics event funnel including `upload_*` events (telemetry the upload module emits via the existing `POST /events`); the `recordings.queue` "survive app kill" note.
- `design-spec.md §14` — Home screen returning-state incl. the "Pending uploads" block (section header, card spec: white / 1 px line / 18 px radius / 14 px padding / 36 px gradient thumbnail / name / status); `§16` — History row layout + the `chip-success` / `chip-progress` / `chip-failed` variants reused for the upload-queue screen (D-10); `§21.7` — the explicit "Pending uploads need: queued / paused (no wifi) / failed-with-retry / completed" TBD that D-10 resolves; `§20` — duration formatter / mono-font rules for the row meta lines.
- `prototype.html` — the `#pending-block` / `.pending-card` markup (the one fake row) the real screen is grown from; the bottom-nav / Home structure.
- `engineering-handoff.md §6.3` / `idea-brief.md §13` — the en-IN-female TTS mandate that the owner deviated from (en-US female); D-09 reflects this into `design-spec.md §6` + `04-UI-SPEC.md`.
- `help-center-content.md` — the "Pending uploads" tile mentions + the OEM battery-optimization line (line 165) — copy vocabulary for the upload screen + the OEM walkthrough.

### Phase 1 backend (already shipped — Phase 5 builds on it)

- `apps/api/src/routes/recordings/init.ts` — `POST /recordings/init`: creates the `recordings` row in `'pending'`, mints AWS SDK v3 presigned multipart-upload part URLs (video + IMU) + a single presigned PUT for `metadata.json`, stores the video multipart `UploadId` in `recordings.s3_upload_id` + `parts_count`. The server never reads bytes.
- `apps/api/src/routes/recordings/complete-part.ts`, `apps/api/src/routes/recordings/finalize.ts` — the rest of the multipart lifecycle the client drives.
- `apps/api/src/routes/recordings/{get,list,reject,schemas}.ts` — recording reads + the `recordings/schemas.ts` zod contracts; `apps/api/src/lib/recording-state.ts` — the `qa_status` state-machine helper.
- `apps/api/src/db/schema.ts` — `recordings` table (note `qaStatusEnum` = `pending | uploaded | verified | hash-mismatch | rejected | takedown`; `s3UploadId`, `partsCount`, `uploadStartedAt`, `uploadCompletedAt`, `verifiedAt`, `s3KeyVideo/Imu/Metadata`, `fileSha256`, `imuSha256`, `flavor`, `livenessScore` nullable, `ipAddress` nullable); the `events` table (telemetry ingest only — the server→client event-piggyback channel is NEW, not this table).
- `apps/api/src/lib/s3-client.ts` — `recordingKeys()`, `RECORDINGS_BUCKET`, `PRESIGNED_TTL_SECONDS`, `MAX_PARTS_PER_UPLOAD`; the S3 client config (LocalStack in dev).
- `apps/api/src/routes/events/post.ts` — `POST /events` telemetry ingest (the `EVENT_NAMES` allowlist); `apps/api/src/plugins/auth.ts` (`requireAuth`, JWT `sub`/`flavor`), `apps/api/src/plugins/idempotency.ts`, `apps/api/src/plugins/rate-limit.ts`, `apps/api/src/lib/problem-detail.ts` — patterns to mirror.
- `shared/types/` — `RecordingsInitRequestSchema` / `RecordingsInitResponseSchema` / `EventCreateSchema` etc. — the request/response contracts to extend (any new event-piggyback envelope or reconciliation-sweep endpoint lands here).
- `docker-compose.yml`, `.env.example`, `infra/terraform/`, `infra/localstack/` — the dev/infra surface a Redis container + the worker process + EventBridge→SQS wiring would slot into.
- `apps/api/src/lib/feedback-uploader.ts` — an existing example of a server-side S3 upload helper; pattern reference for any worker-side S3 reads.

### Mobile capture/recording (Phases 3 & 4 — Phase 5 hooks into these)

- `04-COSMETIC-GAPS.md` (`.planning/phases/04-handdetector-recording-ux-practice-tutorial/04-COSMETIC-GAPS.md`) — the Wave-1 worklist; D-05..D-09 resolve its open items.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/fgs/` — `HumynForegroundService.kt` + `HumynForegroundNotification.kt` (the Phase-3 foreground service the upload module's type-downgrade + UIDT JobService work extends — UP-06/07).
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/` — `CaptureLaunchSweep` (D-03's `CaptureLaunchSweep` discard change), the `HumynCaptureModule` / finalize path that produces the upload bundle, `bootRecoveryListener.ts` (D-07's toast).
- `apps/mobile/src/.../RecordingScreen.tsx` — the recording state machine (D-05's device-distress → Home navigation).
- `04-UI-SPEC.md`, `04-CONTEXT.md`, `03-CONTEXT.md`, the `04-MANUAL-SMOKE.md` runbook — prior decisions on the recording surface, the FROZEN Phase-2/3 amendment files, and the runbook §7 amendments protocol (cosmetic nits → `*-COSMETIC-GAPS.md`, not the frozen files).
- `.planning/runbooks/` — the operator runbook conventions for any Wave-1 / upload smoke runbook this phase authors.

### Research (read for the [research]-tagged requirements)

- `.planning/research/SUMMARY.md` — parallelization note (Phase 4 HandDetector portion ∥ Phase 5 Upload portion); `.planning/research/STACK.md` — BullMQ / Redis / SQS / EventBridge pins (add Redis if missing per Discretion), the AWS SDK v3 pins, the FGS / UIDT JobService notes; `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md` — OEM battery-manager sharp edges, the Android 14 service-type-downgrade + Android 15 6-hour `dataSync` cap, TCP_MAXSEG/MTU-blackhole on Jio CGNAT + Vivo Brasil. (UP-02/06/07/09/19, VERIFY-06 carry `[research]` tags — the gsd-phase-researcher should still freshly verify the OEM deep-link intents and the current BullMQ/SQS wiring.)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`apps/api/src/routes/recordings/{init,complete-part,finalize}.ts`** — the entire S3 multipart presigned-URL backend already exists from Phase 1. Phase 5's `HumynUpload` is the _client_ of these endpoints; the backend changes are mostly additive (the EventBridge/SQS/worker pipeline + the event-piggyback channel + the reconciliation-sweep query).
- **`apps/mobile/.../fgs/HumynForegroundService.kt` + `HumynForegroundNotification.kt`** — a working Android foreground service with the `camera|microphone|dataSync` type (Phase 3, ThermalGate/capture). The upload module extends it for the `dataSync`-only post-recording state + the 5-min-idle stop + coordinates the "one foreground service, type downgrades over time" lifecycle.
- **History row layout + status-chip variants (`design-spec.md §16`)** — reused verbatim for the upload-queue screen (D-10). The duration formatter (`design-spec.md §20`) and the Home "Pending uploads" card spec (`§14`) are already defined.
- **`POST /events` + the `EVENT_NAMES` allowlist + the `useForegroundUserRehydrate` / per-user rate-limit `keyGenerator` patterns** — mirror these for the upload telemetry (`upload_*` events) and any new authenticated endpoints.
- **`apps/api/src/lib/s3-client.ts`** (`recordingKeys`, `PRESIGNED_TTL_SECONDS`, `MAX_PARTS_PER_UPLOAD`) and **`apps/api/src/lib/feedback-uploader.ts`** (server-side S3 helper) — the worker's S3 read-back + any new presigning reuses these.
- **`shared/types/`** — extend the existing `RecordingsInit*Schema` family + add the event-piggyback envelope + the reconciliation endpoint contract here (single source of truth, consumed by both API and mobile).

### Established Patterns

- **Server never reads recording bytes** (CLAUDE.md file-fidelity rule) — the API orchestrates multipart state only. The _hash-verify worker_ is the one component allowed to read S3 object bytes (read-only, to re-hash). Keep that boundary explicit.
- **Pattern 22 (STATE.md)** — don't declare `response.201` schemas on routes that also return problem-detail 400s (it narrows `reply.code()`); validate happy-path shape inline. Applies to any new Phase-5 endpoints.
- **Per-user rate-limit keying** via a best-effort `jwtVerify()` in the `keyGenerator` (fires before route preHandlers) — pattern in `recordings/init.ts`, `events/post.ts`. Reuse for any new write endpoints.
- **Wave-1-first** for cosmetic cleanup (mirrors Phase 3's Wave 1 = `02-COSMETIC-GAPS.md`) — file ownership across the cleanup items mostly doesn't overlap, so they can be parallel-OK plans.
- **Runbook §7 amendments protocol** — mid-smoke cosmetic findings go to a `*-COSMETIC-GAPS.md`, never into the FROZEN Phase-2/3 amendment files.
- **`SystemClock.elapsedRealtimeNanos` exclusively** for all monotonic timing in the capture/recovery code (checker issue #10) — relevant if D-03's `CaptureLaunchSweep` change touches timing.

### Integration Points

- `HumynUpload` (new Android native module) ← consumes the finalized bundle from `HumynCapture`'s finalize path (the `{base}.{mp4,csv,json}` triple + `recording_id`); registers in `MainApplication`; exposes a JS bridge (`apps/mobile/.../HumynUpload.ts`) with start/pause/resume/queue-state events.
- `HumynUpload` ↔ `apps/api` — `POST /recordings/init` (presigned URLs) → S3 multipart PUTs direct → `POST /recordings/:id/complete-part` (per part) → `POST /recordings/:id/finalize` (multipart-complete) → S3 emits a multipart-complete event → EventBridge → SQS → BullMQ-on-Redis → the hash-verify worker → `qa_status` flip + outbound event → piggy-backed on the next authenticated API response → app deletes locals on `verified` / re-uploads on `re-upload`.
- `HumynForegroundService` ↔ `HumynCapture` ↔ `HumynUpload` — one foreground service whose type transitions `camera|microphone|dataSync` (recording) → `dataSync` (uploading, recording stopped) → stopped (5 min idle, queue empty); uploads must _pause_ when `HumynCapture` starts and _resume_ on stop.
- Upload-queue screen ← `HumynUpload` queue-state events; reached from the Home "Pending uploads" tile (Phase 2 `HomeSkeleton` shell; the `count>0` visibility + pull-to-refresh + offline banner is Phase 6).
- App-launch reconciliation sweep ← a new/extended backend read (`GET /recordings?qa_status=verified&...`) → deletes local files for the verified-but-undeleted set. Runs on cold start / foreground rehydrate.
- D-03's `CaptureLaunchSweep` change ↔ D-07's recovery toast ↔ `bootRecoveryListener.ts` — must be reconciled in planning (if nothing upload-able is ever recovered, the toast is dead code).

</code_context>

<specifics>
## Specific Ideas

- "Push **all** things anti-fraud related to v2, descope it from MVP" — owner's words. Taken at face value: FRAUD-05 and FRAUD-06 out, _nothing_ anti-fraud-flavoured added (not even a "generous safety cap"). The upload path is fully uncapped per account at MVP.
- The recovered-segment call ("3" = don't upload it; discard locally) was made after a plain-English walk-through of the moof-flush mechanic — the owner wants clean metadata over salvaging a crash-truncated partial.
- The recovery toast: "leave the workaround, just reduce the duration to 5 seconds" — explicitly _not_ the proper-fix refactor; the owner is fine with the pill living on the splash screen.
- The upload-queue screen: "reuse the History-row pattern, no UI phase" — explicitly no `/gsd-ui-phase 5`; stay inside `design-spec.md`'s existing row + chip vocabulary, add the one "Paused — no Wi-Fi" chip in the same style.

</specifics>

<deferred>
## Deferred Ideas

- **All MVP anti-fraud beyond Play Integrity + the on-device hand gate → §v2 (Anti-fraud).** Specifically: FRAUD-05 (per-account daily upload-rate cap), FRAUD-06 (pre-payout fraud monitoring dashboard — hash-mismatch rate / account-fingerprint clustering / OEM-region anomalies / `liveness_score` panel), plus the already-deferred FRAUD-03 (server-side IMU-liveness check on the uploaded CSV) / FRAUD-04 (`liveness_score ∈ [0,1]` rollup), per-upload Play Integrity attestation, perceptual-hash duplicate detection, device-fingerprint binding, liveness gestures. See `deferred-decisions.md` + `imu-liveness-check.md` + REQUIREMENTS.md §v2.
- **The "stash recovered list + trigger the toast from post-bootstrap / Home mount" proper fix** — rejected for MVP (D-07 keeps the App.tsx-mount workaround at 5 s). If the toast survives D-03's reconciliation at all, the refactor is a §v2 nicety.
- **A polished, bespoke upload-queue screen** beyond the History-row reuse — D-10 keeps it inside the existing design system; a from-scratch design (if it's ever wanted) is its own UI-phase later.
- **iOS upload path** (`URLSessionConfiguration.background`, the iOS native-module analogues) — already §v2 (IOS-01..07); UP-08's iOS clause is not built this phase.
- **Switching the hash-verify worker from BullMQ-on-ECS to S3-EventBridge→Lambda** — explicitly a §v2 concern per VERIFY-07; MVP is BullMQ + ECS, autoscaled on queue depth.

### Reviewed Todos (not folded)

None — no pending todos matched Phase 5 scope.

</deferred>

---

_Phase: 5-upload-pipeline-hash-verify-worker-anti-fraud_
_Context gathered: 2026-05-12_
