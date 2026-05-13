---
status: resolved
trigger: "After resolving the previous /init 400 (taskId 23-char-slug-vs-26-ULID; session `debug-task-id-init-400`) and recording a fresh ≥60 s non-practice clip via the __DEV__ Tasks-tab long-press affordance, `POST /recordings/init` STILL returns 400 on every drain. Different root cause this time: the device-side metadata.json emits `start_timestamp` as an ISO 8601 string with a non-Z timezone offset (e.g. `2026-05-13T10:41:53.48219+05:30`); the native upload coordinator sends that verbatim as `capturedAt`; but `shared/types/src/recording.ts:80` declares `capturedAt: z.string().datetime()` with no `{ offset: true }` — Zod's default `.datetime()` accepts ONLY `…Z` (UTC), rejecting any offset. Confirmed live via the project's own zod: `+05:30 → false`, `Z → true` under the default; both accepted under `.datetime({ offset: true })`. The Phase-5 backend automated probe on 2026-05-13 missed this gap because it built `capturedAt` synthetically (almost certainly `new Date().toISOString()` → `Z`); the on-device path uses local-time + offset. Fix candidate: relax the server schema to `z.string().datetime({ offset: true })` — UTC offsets are valid ISO 8601, and the on-disk metadata.json travels byte-for-byte to S3 as training data so changing the device emitter would alter training-data shape. Currently-stuck row on device: recordingId 01KRFVZ8W3K4V6HYC2HEBKXGFX (taskId 01HVDEVSEEDTASK00000000000, mp4 138 MB, csv 6.4 MB, json 2.3 KB). Dev stack up (humyn-postgres / humyn-redis / humyn-localstack); API on :8080 (cwd apps/api, PID 42194, logs intend /tmp/humyn-api.log but it's currently growing very little — separate observability nit); hash-verify worker running; Pixel 10a connected, app pkg ai.humynlabs.capture.apk, JS loaded from Metro (adb reverse tcp:8080 + tcp:8081 set). Resumes Phase-5 on-device UAT walk (.planning/runbooks/05-upload-smoke.md §2)."
created: 2026-05-13T05:20:00Z
updated: 2026-05-13T05:30:00Z
---

## Symptoms

- **Expected behavior:** Now that `DEBUG_TEST_TASK.taskId` points at a valid seeded 26-char ULID (`01HVDEVSEEDTASK00000000000`, per the previous debug session `debug-task-id-init-400`), the `__DEV__` Tasks-tab long-press affordance should produce a recording whose `POST /recordings/init` returns 201 and the upload progresses through to verify.
- **Actual behavior:** A fresh ≥60 s non-practice recording (recordingId `01KRFVZ8W3K4V6HYC2HEBKXGFX`, mp4 138 MB, csv 6.4 MB, taskId correctly = `01HVDEVSEEDTASK00000000000`) auto-enqueues fine but `POST /recordings/init` still 400s on every drain; the upload coordinator dead-loops.
- **Error messages:** Device logcat: `W/HumynUploadCoord: row 01KRFVZ8W3K4V6HYC2HEBKXGFX upload failed transiently: /recordings/init -> 400` (repeated each drain). Server side: Fastify zod body-validation rejection (the response body itself was not captured this session — `/tmp/humyn-api.log` for PID 42194 isn't growing despite the requests landing; one of the verification steps should pin this down).
- **Timeline / ever worked:** Never worked end-to-end on-device. Surfaced minutes after closing `debug-task-id-init-400`. The Phase-5 backend automated probe on 2026-05-13 ("PASS, no findings") did pass `/recordings/init`, but synthetically — a hand-built `capturedAt` (almost certainly `new Date().toISOString()` → `…Z`) fits the default `z.string().datetime()`. The on-device emitter uses local time with offset → mismatch latent until now.
- **Reproduction:** Trigger a drain on device (record via **DEV** long-press, or simulate a `/recordings/init` POST with the body the native coordinator builds — `recordingId/taskId` 26-char ULIDs, `practice:false`, `partsCount: int 1..1000`, `durationMs: int ≥ 0`, `fileSha256`/`imuSha256`: 64-char hex, `fileSizeBytes`/`imuSizeBytes`: int ≥ 0, `capturedAt`: ISO with non-Z offset like `2026-05-13T10:41:53.48219+05:30`). The 400 reproduces on the `capturedAt` offset.

## Root Cause (pre-isolated during the UAT walk — confirmed via host-side zod parse)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt` / the capture pipeline emits `metadata.json` with `start_timestamp` formatted as `OffsetDateTime` (or equivalent) → ISO 8601 with a non-Z numeric offset like `+05:30`. The native upload coordinator `UploadCoordinator.kt:469` reads `metadata.start_timestamp` and sends it as `capturedAt` in the `/recordings/init` body. The server schema `shared/types/src/recording.ts:80` declares:

```ts
capturedAt: z.string().datetime();
```

Zod's default `.datetime()` configuration is `{ local: false, offset: false, precision: null }` — it accepts ONLY a trailing `Z`. A numeric offset like `+05:30` is a valid ISO 8601 representation but Zod's default rejects it → Fastify zod-validation 400 → response is a problem-detail (the slug should match the API's generic `validation` family).

Host-side proof (`node -e "..."` with the project's own zod):

```
default .datetime():
  '2026-05-13T10:41:53.48219+05:30' → false
  '2026-05-13T10:41:53.482Z'        → true
.datetime({ offset: true }):
  '2026-05-13T10:41:53.48219+05:30' → true
  '2026-05-13T10:41:53.482Z'        → true
```

### Candidate fixes

1. **Relax the server schema** (RECOMMENDED) — `shared/types/src/recording.ts`: `capturedAt: z.string().datetime({ offset: true })`. One-line. The API restarts via tsx-watch. No device rebuild. Correct: UTC offsets are valid ISO 8601.
2. **Change the device emitter** to write UTC + `Z` in `metadata.start_timestamp`. Avoid: `metadata.json` travels byte-for-byte to S3 and is the canonical training-data sidecar; changing its time format alters downstream training-data shape and may break consumers. Not worth it for a server-side correctness gap.
3. **Both** — accept offset on the server now, and on a follow-on pass make the device's emission UTC for downstream simplicity. Out of scope here.

While the fix is in flight, scan the rest of `RecordingsInitRequestSchema` (and adjacent schemas — finalize, parts, reupload) for any other `z.string().datetime()` without `{ offset: true }` that the device's emitter might trip on. Same goes for any other field where a synthetic backend probe could differ from the device's actual emission (e.g. `imu_start_timestamp` / `imu_end_timestamp` if they're in any /-route body schema).

Operational note (out of scope but worth recording for a follow-on): `/tmp/humyn-api.log` for the listener PID 42194 isn't growing despite live request traffic — `lsof` confirms FD 1/2 → that file, but `tail -f` shows no request log lines for the device's drain attempts (only stale EADDRINUSE noise from sibling tsx-watch instances). The dev-stack pino-pretty stream may be silenced or rerouted. Surface as a Phase-5 observability nit — without dev request logs, future on-device debugging will keep needing host-side reproduction of bodies.

## Currently-stuck on-device state (must be cleaned up after the fix lands)

- `files/upload-queue/queue.json` → 1 row `recordingId=01KRFVZ8W3K4V6HYC2HEBKXGFX`, `taskId=01HVDEVSEEDTASK00000000000`, state PENDING.
- `files/recordings/20260513_104153_001.{mp4 138018591 B, csv 6463344 B, json 2318 B}` present.
- DB: no `recordings` row (the 400 fires before any INSERT — confirmed: `SELECT … FROM recordings ORDER BY created_at DESC` shows the older smoke-task rows, not `01KRFVZ8W3K4V6HYC2HEBKXGFX`).
- S3: nothing landed under this recordingId.

Once the schema-relax fix is in, the existing on-device queue row should self-heal on the next drain (`/recordings/init` flips to 201; the coordinator presigns parts and proceeds). Confirm that vs. clear-and-re-record: per CR-02 idempotent `/init` (already verified during the backend-half walk), the existing row's `/init` retry MUST succeed end-to-end without manual intervention; if it doesn't, that's an additional finding.

## Current Focus

hypothesis: "shared/types/src/recording.ts:80 `capturedAt: z.string().datetime()` (no offset) rejects the device's local-time-with-offset start_timestamp (`+05:30`), so Fastify returns 400 before the handler runs. Fix: `z.string().datetime({ offset: true })`. Also sweep adjacent schemas for the same pattern."
test: "Confirm 400 body is a zod-validation problem-detail citing `capturedAt` / `Invalid datetime` (server-side reproduction: feed the device's exact body into a curl + a hand-minted JWT, or — simpler — add a one-shot log line to the API or run the schema in isolation host-side against the actual body, both viable). Apply the offset-relax. Then, on the existing stuck row, observe a fresh drain → `/recordings/init` -> 201 → parts PUT → finalize → enqueueVerify → worker `qa_status='verified'` → `_events: verified` → local triple deleted → row disappears."
expecting: "400 body is a zod-validation problem-detail (e.g. `{type: '…validation', detail: 'capturedAt: Invalid datetime'}` or zod-default phrasing). After fix: 201 from /init, full §2 happy path runs clean on the existing stuck row (no clear-and-re-record needed) — that itself is a CR-02 idempotency check."
next_action: "RESOLVED — see Resolution section below. The on-device verification round-trip is owed; the user resumes Phase-5 UAT walk at .planning/runbooks/05-upload-smoke.md §2 (existing stuck row 01KRFVZ8W3K4V6HYC2HEBKXGFX should self-heal on next drain per CR-02 idempotency)."

## Evidence

- timestamp: 2026-05-13T05:15:00Z — Device `queue.json` after the fresh recording: `recordingId=01KRFVZ8W3K4V6HYC2HEBKXGFX, ownerUserId=01KRFP7GNG8A650PXAD8HPCGTH, taskId=01HVDEVSEEDTASK00000000000, isPractice:false, state:PENDING`. Local triple present (mp4 138 MB / csv 6.4 MB / json 2.3 KB). taskId is now correct (compared to the previous session's 23-char slug failure).
- timestamp: 2026-05-13T05:15:00Z — Device `metadata.json` for `20260513_104153_001.json` shows `metadata.start_timestamp = "2026-05-13T10:41:53.48219+05:30"` (numeric offset, not `Z`); plus `imu_start_timestamp` / `imu_end_timestamp` / `end_timestamp` all formatted the same way. Other relevant fields look well-formed: `file_sha256` 64-char hex, `imu_sha256` 64-char hex, `file_size_bytes` 138018591, `imu_size_bytes` 6463344, `duration_seconds` 142.236366117 (→ `durationMs ≈ 142236`).
- timestamp: 2026-05-13T05:15:00Z — `UploadCoordinator.kt:459-470` builds the /init body and reads `m.optString("start_timestamp", "")` → sends as `capturedAt`. No transformation. Field names match the server schema; the value passes through verbatim.
- timestamp: 2026-05-13T05:15:00Z — Host-side zod proof:
  ```
  default .datetime() : '2026-05-13T10:41:53.48219+05:30' → false ; '…Z' → true
  .datetime({offset:true}): '…+05:30' → true ; '…Z' → true
  ```
- timestamp: 2026-05-13T05:15:00Z — Device logcat: `W/HumynUploadCoord(21901): row 01KRFVZ8W3K4V6HYC2HEBKXGFX upload failed transiently: /recordings/init -> 400` (repeated each drain).
- timestamp: 2026-05-13T05:25:00Z — **Definitive binding confirmation via the project's actual `RecordingsInitRequestSchema`** (one-shot host-side repro at `apps/api/scripts/repro-init-400.ts`, fed the device body shape with `capturedAt='2026-05-13T10:41:53.48219+05:30'`). Result: `success: false` with a single zod issue on `capturedAt`: `code: 'invalid_format', format: 'datetime', message: 'Invalid ISO datetime', pattern` ending in `…(?:Z))$/` (the trailing `Z` requirement — UTC-only is mandated by the default `.datetime()` regex). Same body with `capturedAt='…Z'` → `success: true`. Confirms the failure is precisely the `capturedAt` zod-default-datetime gate; no other field on the device body trips the validator.
- timestamp: 2026-05-13T05:25:00Z — **Schema-wide sweep for the same gap.** `grep -rn "\.datetime("` across `shared/types/src/**` + `apps/api/src/**` identified 19 sites. Categorisation: REQUEST-body schemas (client-supplied → vulnerable): `recording.ts:80` `RecordingsInitRequestSchema.capturedAt`, `recording.ts:34` `RecordingCreateSchema.capturedAt`, `events.ts:35` `EventCreateSchema.occurredAt`. RESPONSE-only schemas (server emits via `Date.toISOString()` → always `Z`, safe): `recording.ts:{49,50,51,52,97}`, `user.ts:{14,17,18,19}`, `me.ts:35`, `task.ts:66`, `apps/api/src/routes/recordings/schemas.ts:{22,40,42}`. In-app-only persistence (mobile uses `new Date().toISOString()` for `runAt`, safe): `CompatResult.ts:37`. The `RecordingCreate` schema is the canonical "client wire shape" doc-comment partner of `RecordingsInitRequest` (and `RecordingSchema.extend`s it for the row response) — relaxed for consistency even though no route currently binds it. The `EventCreate.occurredAt` is a latent client-supplied datetime — `apps/mobile/**` currently has no `/events` POST call sites, but the schema is server-bound for `POST /events` and would 400 the same way once the device telemetry surface is wired up — relaxed pre-emptively in this single sweep.
- timestamp: 2026-05-13T05:27:00Z — **Schema relax applied + tsx-watch picked up the change.** `shared/types/src/recording.ts:38` (`RecordingCreateSchema.capturedAt`) and `:83` (`RecordingsInitRequestSchema.capturedAt`) and `shared/types/src/events.ts:35` (`EventCreateSchema.occurredAt`) now use `z.string().datetime({ offset: true })`. Logged in `/tmp/humyn-api.log`: `10:55:23 AM [tsx] change in ./../../shared/types/src/recording.ts Rerunning...` and `10:55:31 AM [tsx] change in ./../../shared/types/src/events.ts Rerunning...`. `curl /healthz` → 200, live API listener PID 75858 serving. Re-running the host-side repro now: `success: true` on the device body (`+05:30`) AND on the synthetic `Z` body — fix verified at the schema level. No tests added: existing route tests already cover both `/recordings/init` and `/events` happy paths; the relaxed datetime is a strict superset of the prior gate (every existing `Z` payload still parses), so no regression surface.
- timestamp: 2026-05-13T05:29:00Z — **Observability nit understood + partial mitigation.** `/tmp/humyn-api.log` was held by 22 fds across THREE concurrent `tsx watch src/index.ts` chains (one live + two zombies); the zombies kept failing `listen EADDRINUSE: 0.0.0.0:8080`, drowning the log. Killed the two zombie chains (`kill -TERM` on the bash → pnpm → tsx triplets); live listener PID 75858 (parent tsx-watch 13016, parent pnpm 13004, parent bash 13002) untouched, `/healthz` → 200. The DEEPER cause of "no request log lines in the file" is `apps/api/src/plugins/logger.ts` configuring `{ transport: { target: 'pino-pretty', ... } }` in dev — pino transports run in a `worker_thread` whose stdout is NOT the parent process's fd 1, so request lines emitted via the pretty worker never reach the redirected file. Not a one-line fix; logged to `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` "Observability" section as a Phase-5 follow-on item (per orchestrator note: deeper-than-one-line → log and don't block the walk).

## Eliminated

- hypothesis: "taskId still 23-char slug" — eliminated. Device queue.json shows `taskId=01HVDEVSEEDTASK00000000000` (26 chars, valid ULID, present in `tasks` table). Previous session `debug-task-id-init-400` fix landed correctly.
- hypothesis: "some OTHER field in `RecordingsInitRequestSchema` is what fails" — eliminated by the host-side repro (`apps/api/scripts/repro-init-400.ts`). The schema returns exactly ONE zod issue, on `capturedAt`. Every other field on the device's body shape parses clean.

## Related (out-of-scope / pre-existing)

- Phase-5 backend automated probe on 2026-05-13 PASSED `/recordings/init` synthetically (likely with `new Date().toISOString()` → `…Z`), which is why this device-vs-probe gap was latent until the on-device half of the walk.
- Two cosmetic UX issues raised by the user during the §2 walk (both Phase-5-owned, now logged to `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` "UX" section — out of scope for this debug session):
  1. **Contribution toast lifetime:** the `"{Hh Mm} added to your contribution."` toast is killed when the screen transitions from RecordingScreen → Home; should survive ≥ 5 s including the transition (target: a global / native toast surface, not a per-screen one).
  2. **Pending Uploads tap from Home:** tapping a row on the Home "Pending uploads" section opens a standalone `Pending uploads` screen with no back nav / no bottom-tab affordance — user wants this to route to the `History` tab instead (and / or add a back affordance on the standalone screen).
- Phase-5 observability nit: `/tmp/humyn-api.log` doesn't capture live request log lines. Logged to `05-COSMETIC-GAPS.md` "Observability" section with the worker-thread root cause + two fix candidates. Zombie tsx-watcher chains were killed in-session as a partial mitigation (removes the EADDRINUSE noise; doesn't fix the pino-worker-stdout root cause).

## Resolution

**Root cause (confirmed end-to-end via the project's own zod):** `shared/types/src/recording.ts:80` (and its sibling `:34` on `RecordingCreateSchema`) declared `capturedAt: z.string().datetime()` — Zod's default `.datetime()` is `{ offset: false }`, accepting only the trailing-`Z` UTC form. The Android capture pipeline's `MetadataComposer` emits `metadata.start_timestamp` as `OffsetDateTime`-style ISO 8601 with a numeric offset (`+05:30` for IST); the native `UploadCoordinator.kt:469` passes that verbatim as `capturedAt`. Fastify (via `fastify-type-provider-zod`) therefore short-circuits with a 400 problem-detail (`invalid_format`, format: `datetime`, message: `Invalid ISO datetime`) before any handler logic. The upload coordinator treats any non-2xx /init as transient → retry storm.

Live confirmation: `apps/api/scripts/repro-init-400.ts` feeds the device's body shape (taken from on-device `metadata.json`) into `RecordingsInitRequestSchema.safeParse`. Result with `+05:30` → `success: false` + one zod issue on `capturedAt` (regex pattern ends in `(?:Z)$`). Same body with `Z` → `success: true`. Identical behaviour with the relaxed schema → both pass.

**Fix (applied — candidate 1, one-line schema relax across three sites):**

1. **`shared/types/src/recording.ts:38`** — `RecordingCreateSchema.capturedAt` → `z.string().datetime({ offset: true })`. (Comment added inline pointing at this debug session.)
2. **`shared/types/src/recording.ts:83`** — `RecordingsInitRequestSchema.capturedAt` → `z.string().datetime({ offset: true })`. (Comment added inline.) This is the one that fires today.
3. **`shared/types/src/events.ts:35`** — `EventCreateSchema.occurredAt` → `z.string().datetime({ offset: true })`. Latent (mobile doesn't currently POST /events), relaxed pre-emptively in the same sweep so the same offset-vs-Z gap doesn't surface when the telemetry pipe is wired up.

Response schemas (`uploadStartedAt`, `uploadCompletedAt`, `verifiedAt`, `createdAt`, `expiresAt`, `consentAcceptedAt`, `deletedAt`, `deleteGraceUntil`, `playback_url_expires_at`, the `apps/api/src/routes/recordings/schemas.ts` server-shaped fields, etc.) were LEFT UNCHANGED — server-emitted via `Date.prototype.toISOString()` → always trailing-`Z`, default `.datetime()` is fine. `CompatResult.runAt` LEFT UNCHANGED — mobile-only MMKV persistence, emitted via `new Date().toISOString()`. `TaskRequestSchema.createdAt` LEFT UNCHANGED — response-only.

**Device emitter LEFT UNCHANGED** (per candidate-2 dismissal). The `metadata.json` travels byte-for-byte to S3 and is the canonical training-data sidecar; the offset form is valid ISO 8601 and changing the device's emission would alter downstream training-data shape and may break consumers downstream. Server-side relax is the correct surface.

**Files changed:**

- `shared/types/src/recording.ts` (2 sites — `RecordingCreateSchema.capturedAt`, `RecordingsInitRequestSchema.capturedAt`)
- `shared/types/src/events.ts` (1 site — `EventCreateSchema.occurredAt`)
- `apps/api/scripts/repro-init-400.ts` (new — one-shot host-side `safeParse` repro; kept in `scripts/` for next on-device debug round; ~30 lines)
- `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md` (new — logs the two cosmetic UX issues + the observability nit for Phase-5 Wave 1 cleanup)

**Verification still owed:** the on-device round-trip on the existing stuck row `01KRFVZ8W3K4V6HYC2HEBKXGFX` (do NOT clear-and-re-record — CR-02 idempotent `/init` should self-heal it on the next drain, and observing that round-trip end-to-end is a free bonus CR-02 idempotency check). Force-stop + relaunch the app (or wait for the coordinator's next periodic drain). Expected sequence: `/recordings/init -> 201` → parts PUT to LocalStack → finalize → `enqueueVerify` → hash-verify worker → `qa_status='verified'` → next authed API response carries `_events: [{event_type: 'verified', recording_id: '01KRFVZ8W3K4V6HYC2HEBKXGFX'}]` → native unlinks the local triple → row disappears from `queue.json`. The end-to-end §2 happy path on `.planning/runbooks/05-upload-smoke.md` resumes from that point.

**Observability nit DEFERRED to Phase-5 Wave 1.** `/tmp/humyn-api.log` doesn't capture live request log lines because `apps/api/src/plugins/logger.ts` configures a pino worker-thread transport in dev (`{ transport: { target: 'pino-pretty', ... } }`) — the worker's stdout is not the parent process's fd 1, so request lines emitted via the pretty worker never reach the redirected file. Fix candidates and trade-offs captured in `05-COSMETIC-GAPS.md`. Partial in-session mitigation: killed two zombie `tsx watch` chains that were spamming the file with `EADDRINUSE: 0.0.0.0:8080` (only one live watcher remained; live listener PID 75858 untouched, `/healthz` → 200).

**Specialist hint:** typescript (the fix is a 3-site zod-schema relax in a TS shared-types workspace; the host-side repro is a `tsx` script; no runtime framework specialism needed; markdown for the cosmetic-gaps log).
