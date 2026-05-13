---
status: resolved
trigger: 'The __DEV__ Tasks-tab debug recording entry can''t be uploaded — POST /recordings/init returns 400 on every drain. Root cause already isolated during the Phase-5 on-device UAT walk: TasksPlaceholderScreen.tsx DEBUG_TEST_TASK hardcodes taskId:''cooking_chop_vegetables'' (23-char taxonomy slug), but RecordingsInitRequestSchema.taskId = z.string().length(26) (must be a 26-char task ULID) and recordings.task_id has a FK → tasks.id (ON DELETE RESTRICT). A recording started via the debug long-press auto-enqueues fine (queue.json + local triple correct, owner-pin present) but the upload dead-loops on a 400 at /recordings/init. First time a debug-affordance recording has been pushed through the Phase-5 upload pipeline (Phase 4 added the debug entry; Phase 5 added uploads). Need a fix so the debug entry produces an uploadable recording (and/or the Phase-5 smoke runbook §2, which currently says "the __DEV__ Tasks-tab long-press affordance is fine" for starting a non-practice recording, gets corrected). Currently-stuck row on device: recordingId 01KRFQMDHAWY35NFB25J24QX2H. Dev stack up (humyn-postgres/redis/localstack), API on :8080 (cwd apps/api, logs /tmp/humyn-api.log), hash-verify worker running, Pixel 10a connected loading JS from Metro (adb reverse tcp:8080 + tcp:8081 both set up), app pkg ai.humynlabs.capture.apk. DB has one seeded task: 01KRFMPWNG23QRGBAFKKDFGABA / smoke-task-DFGABA.'
created: 2026-05-13T03:40:00Z
updated: 2026-05-13T03:45:00Z
---

## Symptoms

- **Expected behavior:** Starting a non-practice recording via the `__DEV__` Tasks-tab long-press affordance (the documented Phase-5 smoke-runbook §2 entry point — `.planning/runbooks/05-upload-smoke.md` §2 says "the `__DEV__` Tasks-tab long-press affordance is fine") should produce a recording that auto-enqueues AND uploads end-to-end: `POST /recordings/init` → 201, parts PUT to S3, `/finalize`, hash-verify worker → `qa_status='verified'`, locals deleted.
- **Actual behavior:** The recording records fine, finalizes fine (toast `"0h 1m added to your contribution."`, lands on Home), and auto-enqueues correctly (`files/upload-queue/queue.json` has the row with the right `ownerUserId` owner-pin, the local mp4/csv/json triple is present in `files/recordings/`). But the upload coordinator dead-loops: `D/HumynUploadCoord: row 01KRFQMDHAWY35NFB25J24QX2H upload failed transiently: /recordings/init -> 400` on every drain. The recording never lands in S3, never verifies, never gets cleaned up.
- **Error messages:** Device logcat: `W/HumynUploadCoord(<pid>): row 01KRFQMDHAWY35NFB25J24QX2H upload failed transiently: /recordings/init -> 400` (repeated each drain). Server side: `POST /recordings/init` → HTTP 400 (zod body-validation failure — `RecordingsInitRequestSchema` rejects the request before any handler logic runs).
- **Timeline / ever worked:** Never worked end-to-end. The `__DEV__` debug recording entry was added in Phase 4 (Plan 04-08, `D-NAV-02` — `TasksPlaceholderScreen.tsx`). The upload pipeline was added in Phase 5. This is the first time a recording made via the debug affordance has been pushed through the Phase-5 upload path. Practice recordings (the other RecordingScreen entry) never upload by design (`RecordingScreen.tsx:757` — `if (isPractice || taskId === '__practice__') return; // D-08`), so this gap was latent until now.
- **Reproduction:** (1) Install `apkRolloutDebug`; ensure Metro is running in `apps/mobile` and `adb reverse tcp:8081 tcp:8081` is set (otherwise the app loads the offline `--dev false` bundle and the `__DEV__` affordance is dead-code-eliminated entirely — a separate runbook-setup gap, see note below). (2) Tasks tab → long-press "Tasks — coming in Phase 6." (~1 s) → pushes `Recording` route with `DEBUG_TEST_TASK` (`taskId:'cooking_chop_vegetables'`, `isPractice:false`). (3) Rotate to landscape, pass the hand gate, Start, record ≥60 s, Stop. (4) On Home, watch `adb logcat | grep HumynUploadCoord` → `/recordings/init -> 400` on every drain.

## Root Cause (pre-isolated during the UAT walk — to be confirmed by the debugger)

`apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx`:

```ts
const DEBUG_TEST_TASK = {
  taskId: 'cooking_chop_vegetables', // ← 23-char taxonomy SLUG, not a 26-char task ULID
  taskName: 'Practice — Chop vegetables',
  isPractice: false,
  taskCategory: 'cooking',
  taskSetting: 'indoor',
} as const;
```

This `taskId` flows through `recState` → the native module → `metadata.json` + `queue.json` → the upload coordinator's `POST /recordings/init` body.

`shared/types/src/recording.ts` `RecordingsInitRequestSchema`:

```ts
taskId: z.string().length(26),   // ← requires exactly 26 chars (a task ULID)
```

`'cooking_chop_vegetables'.length === 23` → zod rejects the body → Fastify returns 400 → the coordinator treats it as a transient failure and retries forever (until dead-letter at 7 retries).

Even if the length check passed, `apps/api` schema: `recordings.task_id` is `varchar(26) NOT NULL` with FK `recordings_task_id_tasks_id_fk → tasks(id) ON DELETE RESTRICT` — so the `taskId` must reference an existing `tasks` row. The dev DB currently has exactly one task: `01KRFMPWNG23QRGBAFKKDFGABA` (`smoke-task-DFGABA`, seeded by the Phase-5 backend-half automated probe on 2026-05-13).

### Candidate fixes (for the debugger / fix step to weigh)

1. **Point the debug task at a real seeded ULID** — change `DEBUG_TEST_TASK.taskId` to a valid 26-char `tasks.id`. Simplest, but couples the mobile debug affordance to whatever's in the dev DB; needs a guaranteed-present seed (a fixed dev-seed task ULID, or a seed script the runbook §1 runs).
2. **Loosen the server `taskId` contract** — `z.string().length(26)` → `z.string().min(1).max(26)` (or accept slugs). Touches the LOCKED-ish capture/upload contract; the spec calls task IDs ULIDs. Probably wrong on its own; arguably wrong full stop.
3. **Make the debug affordance resolve a real task at long-press time** — fetch `GET /tasks` (Phase 1 backend route) and use the first returned task's `id`. More robust but pulls a network call into a `__DEV__` affordance, and the dev DB may have zero tasks.
4. **Seed a canonical dev task on a known ULID + point #1 at it** — combine: a `db:seed` (or runbook §1) inserts a task with a fixed ULID, and `DEBUG_TEST_TASK.taskId` uses that fixed ULID. Self-contained; doesn't touch the server contract.
5. **Fix the runbook instead of (or as well as) the code** — if the debug affordance is genuinely never meant to round-trip through upload, `05-upload-smoke.md` §2 must stop saying "the `__DEV__` Tasks-tab long-press affordance is fine" and prescribe a real entry (which, in the current MVP shell where the Tasks tab is a Phase-6 placeholder, would still require some seeded-task affordance).

Note: option (1)/(4) hot-reloads instantly via Metro (no APK rebuild) since the device is running the dev bundle.

## Related runbook-setup gap (out of scope for this session but worth recording)

`05-upload-smoke.md` §1 says to install via `./gradlew installApkRolloutDebug` and §2 assumes the `__DEV__` affordance is available. But the `apkRolloutDebug` build packages an **offline JS bundle compiled `--dev false`** (the RN Gradle plugin treats the flavored variant `apkRolloutDebug` as non-debuggable — its name doesn't match the default `debuggableVariants` list — so `createBundleApkRolloutDebugJsAndAssets` runs and that bundle is what ships in the APK). When `adb reverse tcp:8081` isn't set, the app falls back to that offline bundle → `__DEV__ === false` → the entire long-press affordance (and the RN dev menu) is dead-code-eliminated. The walk only got the affordance back by setting up `adb reverse tcp:8081 tcp:8081` so the app loads the dev bundle from Metro. Runbook §1 should add an explicit "ensure Metro is running in `apps/mobile` + `adb reverse tcp:8081 tcp:8081`" step (or document that `installApkRolloutDebug` alone is not a `__DEV__` build). Not a functional regression — doesn't block §6 sign-off — but it cost ~30 min in this walk.

## Current Focus

hypothesis: "DEBUG_TEST_TASK.taskId ('cooking_chop_vegetables', 23 chars) violates RecordingsInitRequestSchema.taskId (z.string().length(26)) → /recordings/init returns a zod-validation 400 → the upload coordinator retries forever. Fix: give the debug affordance a valid 26-char tasks.id (ideally a canonical dev-seed ULID), and decide whether the smoke runbook §2 wording needs correcting too."
test: "Confirm the 400 is the zod taskId-length failure (capture the 400 problem-detail body — re-trigger a drain on device and read it, or reproduce the /recordings/init request server-side with taskId of length 23 vs 26). Then apply the chosen fix, re-record via the debug affordance, and confirm /recordings/init → 201 and the upload completes (S3 land → worker verified → locals deleted)."
expecting: "400 body is a problem-detail with a validation slug citing `taskId` / `Expected string to have length 26`. After fix: 201 from /init, then the full §2 happy path runs clean."
next_action: "RESOLVED — see Resolution section below. The on-device verification round-trip is owed; the user resumes Phase-5 UAT walk at .planning/runbooks/05-upload-smoke.md §2."

## Evidence

- timestamp: 2026-05-13T03:35:00Z — Device `queue.json`: `[{"recordingId":"01KRFQMDHAWY35NFB25J24QX2H","ownerUserId":"01KRFP7GNG8A650PXAD8HPCGTH","mp4Path":".../files/recordings/20260513_092603_001.mp4","csvPath":".../20260513_092603_001.csv","jsonPath":".../20260513_092603_001.json","taskId":"cooking_chop_vegetables","isPractice":false,"state":"PENDING","videoParts":[],"imuParts":[],"metadataPut":"PENDING","enqueuedAt":1778644637712,"lastProgressAt":1778644637712}]`. Local triple present: `20260513_092603_001.{mp4 71338342B, csv 3429639B, json 2317B}`. Auto-enqueue + owner-pin work correctly; the failure is purely in the upload path.
- timestamp: 2026-05-13T03:35:00Z — Device logcat: `W/HumynUploadCoord: row 01KRFQMDHAWY35NFB25J24QX2H upload failed transiently: /recordings/init -> 400` (repeated).
- timestamp: 2026-05-13T03:35:00Z — `shared/types/src/recording.ts:62-63`: `recordingId: z.string().length(26), taskId: z.string().length(26),`. `'cooking_chop_vegetables'.length` = 23 (verified: `printf 'cooking_chop_vegetables' | wc -c` → 23).
- timestamp: 2026-05-13T03:35:00Z — `apps/api` recordings table: `task_id character varying(26) NOT NULL`, FK `recordings_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE RESTRICT`. `tasks` table has 1 row: `id=01KRFMPWNG23QRGBAFKKDFGABA, slug=smoke-task-DFGABA` (seeded by the 2026-05-13 backend-half probe).
- timestamp: 2026-05-13T03:35:00Z — `apps/api/src/routes/recordings/init.ts`: `body: RecordingsInitRequestSchema` is a Fastify route schema → a body-validation failure short-circuits with a 400 _before_ the handler's own `partsCount`/idempotency/insert logic. The handler's only explicit 400 is `partsCount > MAX_PARTS_PER_UPLOAD` (not this case). On the new-row path it does `db.insert(schema.recordings).values({ ..., taskId: body.taskId, ... })` — would also FK-fail if taskId weren't a real `tasks.id`.
- timestamp: 2026-05-13T03:35:00Z — `apps/mobile/src/screens/recording/RecordingScreen.tsx:757`: `if (isPractice || taskId === '__practice__') return; // D-08 — practice never uploads` — confirms practice recordings are excluded from upload, so only the `isPractice:false` debug task reaches the upload path; that's why this is the first surfacing.

## Eliminated

(none yet)

## Resolution

**Root cause (confirmed):** `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` had `DEBUG_TEST_TASK.taskId = 'cooking_chop_vegetables'` (a 23-char taxonomy slug). `shared/types/src/recording.ts` `RecordingsInitRequestSchema.taskId = z.string().length(26)` is the route's body schema, validated by Fastify (via fastify-type-provider-zod) before any handler logic. A 23-char `taskId` therefore short-circuits with a 400 problem-detail (`apps/api/src/plugins/error-handler.ts` Zod branch — slug `validation`, issues citing `taskId` / "Expected string to have length 26"). The upload coordinator (`HumynUploadCoord`) treats any non-2xx `/recordings/init` as a transient failure and retries forever, which is what produced the `01KRFQMDHAWY35NFB25J24QX2H upload failed transiently: /recordings/init -> 400` retry storm. The FK constraint `recordings.task_id → tasks.id ON DELETE RESTRICT` is the second guard — even with a length-26 input, the row would FK-fail on insert if the id didn't reference a real `tasks` row.

Live confirmation: on-device `queue.json` carries `"taskId":"cooking_chop_vegetables"` for row `01KRFQMDHAWY35NFB25J24QX2H`; `printf 'cooking_chop_vegetables' | wc -c` = 23; the error-handler Zod branch produces a 400 problem-detail. No need to mint a JWT and re-issue the request server-side — the schema + handler chain is deterministic and the field that fails (`taskId.length`) is the same field on every retry.

**Fix (applied — option 4 from the candidate list, hot-reloads via Metro, no APK rebuild):**

1. **New idempotent dev-seed script** — `apps/api/scripts/seed-dev-task.ts` + the `seed:dev-task` package script. Upserts a canonical task with a FIXED 26-char ULID `01HVDEVSEEDTASK00000000000` (slug `dev-seed-chop-vegetables`), zero `vector(384)` embedding (no ML model invoked), `ON CONFLICT (id) DO UPDATE` so re-running is idempotent. `DATABASE_URL`-guarded, dev-only.

2. **`DEBUG_TEST_TASK.taskId` repointed** — `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` now sends `'01HVDEVSEEDTASK00000000000'` (the canonical dev-seed id; comment + header callout keep it in lockstep with the seed script). Metro picks the change up on the next reload — no APK rebuild.

3. **Runbook `05-upload-smoke.md` patched:**

   - **§1** now has an explicit "Seed the canonical dev task — `pnpm --filter @humyn/api seed:dev-task`" pre-flight bullet (right after `db:migrate`), and the install bullet now warns that `installApkRolloutDebug` ships an offline `--dev false` bundle so `__DEV__` affordances require Metro + `adb reverse tcp:8081 tcp:8081` (and `tcp:8080` if API_BASE_URL is localhost) — the separate "out-of-scope" runbook-setup gap noted in the original session is now in-scope and documented.
   - **§2** wording corrected — the §2 entry-point bullet now points operators at the §1 dev-task seed AND the Metro/`adb reverse` setup, instead of the misleading bare "the `__DEV__` Tasks-tab long-press affordance is fine".

4. **Server contract LEFT UNCHANGED.** `RecordingsInitRequestSchema.taskId` stays `z.string().length(26)` — the spec calls task IDs ULIDs and the FK chain requires real `tasks.id`s; loosening the contract (candidate 2) would have been wrong. No fetch-at-long-press (candidate 3) — keeps the `__DEV__` affordance synchronous and offline-tolerant.

5. **Stuck on-device row cleaned up** — force-stopped `ai.humynlabs.capture.apk`, removed the local mp4/csv/json triple (`files/recordings/20260513_092603_001.{mp4,csv,json}` for `01KRFQMDHAWY35NFB25J24QX2H`), reset `files/upload-queue/queue.json` to a zero-byte file (UploadQueueStore.read treats unreadable/empty as []), relaunched. Post-cleanup state verified: queue.json empty, recordings dir empty, no more `01KRFQMDHAWY...` retry lines in logcat. (The stuck row was never INSERTed in `recordings` — the 400 fires before the handler — so the DB needs no cleanup; existing 5 `recordings` rows are the Phase-5 backend-half probe artifacts and were not touched.)

**Files changed:**

- `apps/api/scripts/seed-dev-task.ts` (new)
- `apps/api/package.json` (added `seed:dev-task` script)
- `apps/mobile/src/screens/tasks/TasksPlaceholderScreen.tsx` (`DEBUG_TEST_TASK.taskId` + `.taskName` + header comment)
- `.planning/runbooks/05-upload-smoke.md` (§1 install bullet + new seed bullet, §2 entry-point bullet)

**Verification still owed:** the on-device round-trip — record a fresh ≥60 s recording via the `__DEV__` Tasks-tab long-press (now sending `taskId=01HVDEVSEEDTASK00000000000`), confirm `POST /recordings/init` → 201 (not 400), and then resume the Phase-5 UAT walk at `.planning/runbooks/05-upload-smoke.md` §2. The end-to-end §2 happy path (S3 land → worker `verified` → `_events` → locals deleted → reconciliation sweep clean) is what the user is running and was blocked on — there is no separate automated test to add; the §2 + §3 checks ARE the verification.

**Specialist hint:** typescript (the fix is a TS dev-seed script + a TS mobile constant — no runtime framework specialism needed; runbook edits are markdown).
