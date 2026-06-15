# IMPLEMENTATION PLAN — 2026-06-10 round: deployment truth + the residual code defects

> **For the implementing agent.** Read this whole file before editing. Honor `CLAUDE.md` LOCKED
> constraints (no notifications/FCM, files never re-encoded, capture spec untouched, design files
> verbatim). Line numbers cited below were verified 2026-06-10 — **re-grep before editing; lines
> drift.** Verify as you go: API `pnpm --filter @humyn/api test` (needs docker postgres/localstack
> up), mobile `cd apps/mobile && node_modules/.bin/vitest run`, Kotlin unit tests via
> `apps/mobile/android` gradle, plus both typechecks (`pnpm -r typecheck`; build `shared/types`
> first if you touch it). Commit per phase; do not push unless the owner asks.

---

## §0 Root cause — read this first

Six bugs were reported on 2026-06-10. **Five of the six were already fixed on `stage` (commits
`f85cbad..4f2cc4c`, 2026-06-09, plus the 06-04 round `a2c9d64`/`64c9461`) — but none of it ever
deployed.** Proven live on 2026-06-10 against `https://stage-hl-app-uploader.humynlabs.ai`:

```
POST /me/practice-complete            → 404 "Route not found"            (route shipped 06-04/05)
POST /recordings/init  (new body)     → 400 "Validation failed":
                                        fileSha256 required, imuSha256 required
                                        (fields REMOVED from client+server on 06-04, Enh 3/D1)
```

The deployed staging API is built from code **≤ 2026-06-03** (`main` tip `bd7879d`). The current
APK (Firebase App Distribution, built from `stage`) sends the post-06-04 init body → the old
server 400s **every** upload → instant dead-letter (BUG-4's fail-fast) → "Upload failed — Retry"
→ Retry re-fails in <1 s with no visible change.

**Corroboration (owner, 2026-06-10): the installed APK IS current.** The owner confirmed the
06-09 client-only fixes work on device (BUG-1 precise-location gate verified working; BUG-5
battery exit no longer reproduces — the standalone screen it crashed from is deleted in the new
build). So the mobile pipeline (CodeBuild → Firebase) is healthy; the stale half is exclusively
the **API image + DB migrations + never-run backfills**. The split is exact: the two client-only
06-09 fixes work; the four server-dependent bugs persist. Phase 0-ops therefore needs no APK
forensics — only the API/DB/backfill steps (plus the routine APK rebuild after Phases 1–6 land). The same staleness explains thumbnails (no
thumbnail code server-side), practice re-gating (`/me/practice-complete` 404s and is silently
swallowed; sign-in response lacks `practiceCompletedAt`), multi-device login (old `requireAuth`
has no installation binding), and the `/feedback` 500 (pre-NUL-strip, pre-S3-best-effort code).

**Why it happened:** there is **no API deploy pipeline and no migration pipeline.**

- `.github/workflows/api-ci.yml` is tests-only and triggers on PRs + pushes to **`main`** —
  `main` hasn't received `stage` since 06-03, and every recent run failed anyway.
- Nothing builds/pushes the API Docker image or rolls ECS. `infra/terraform/envs/staging/terraform.tfvars`
  still has `REPLACE_ME` placeholders; the live infra is console-managed.
- Migrations: `apps/api/scripts/migrate.ts` is run manually via `pnpm db:migrate`. It is **not**
  run at boot, not in any pipeline, and **cannot run from the deployed image** (`tsx` is a
  devDependency pruned by the Dockerfile; `tsconfig.scripts.json` is wired to nothing, so
  `dist/scripts/` doesn't exist). Staging RDS is in a private subnet with no bastion. Migrations
  0010–0017 are almost certainly unapplied.
- The thumbnail backfill (`pnpm --filter @humyn/api backfill:thumbnails`) has the same problem —
  manual CLI, not in the image, needs DB access nobody has.
- The only mobile release path is the CodeBuild `buildspec.yml` (→ S3 + Firebase App
  Distribution); whether the 06-09 push triggered a build is console-config, out-of-repo.

**Consequently this plan has two halves:** (A) code changes that make the system deployable,
observable, and robust (Phases 1–7), and (B) an ops runbook (Phase 0) the owner executes with AWS
access. Do the code first (Phases 1–6 are ~1–2 days), then ONE deploy + ONE APK build, then the
§10 smoke. Deploying before the code fixes walks into the §3.4 idempotency-poisoning trap.

### Bug → cause → phase map

| #   | Reported symptom                 | Root cause                                                                                                                                                         | Residual code defects (fix in this round)                                                                                                                                            | Phase |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | Uploads fail; Retry does nothing | Stale API: old init schema demands removed `fileSha256`/`imuSha256` → 400 on every init                                                                            | 401 dead-letters uploads permanently; server memoizes 4xx for 24 h; revive skips backoff reset; `deadLetterReason` never shown; Retry gives zero feedback                            | 0 + 1 |
| 2   | Existing users re-do practice    | Stale API (`/me/practice-complete` 404s, swallowed; sign-in lacks `practiceCompletedAt`) + migrations 0015/0017 unapplied                                          | Completion POST is fire-and-forget (lost offline/on-error); boot gate never double-checks server; 0017 predicate misses zero-recording users (owner chose: backfill ALL)             | 0 + 3 |
| 3   | One account on многих devices    | Stale API: no installation binding in deployed `requireAuth`                                                                                                       | Native uploader has no 401/evicted handling; no foreground/pre-record session check (eviction only surfaces on JS API calls)                                                         | 0 + 2 |
| 4   | No thumbnails anywhere           | Stale API (no thumbnail code/ffmpeg in deployed image) + backfill never ran + uploads broken (no objects to thumbnail)                                             | Backfill structurally unrunnable (not compiled, DB private); finalize-retry regen shadowed by idempotency replay; device-only History rows ignore the local thumbs they already have | 0 + 4 |
| 5   | App exits during battery ask     | Old APK's standalone battery screen (deleted 06-09). **Owner can no longer reproduce.**                                                                            | New onboarding ask races the compat camera probes (latent crash); probes' `onConfigured` unguarded; dialog launched NEW_TASK from app context (back-to-launcher quirk)               | 5     |
| 6   | Report issue → 500               | Stale API: pre-`cfc69c3` (S3 500s) and pre-`d32e50c` (NUL bytes → Postgres 22P05). Device telemetry ring is never cleared, so one poisoned event re-500s every tap | Client never sanitizes nor clears the ring; server turns content errors into 500s; idempotency `persist` unguarded                                                                   | 0 + 6 |

### Already correct on `stage` — do NOT re-implement

- Practice server flow: `users.practice_completed_at`, `POST /me/practice-complete` (idempotent),
  returned in `/auth/google` + `GET /me`, client write-through seed (`services/auth.ts`,
  `profileService.ts`). Architecture is right; only durability + backfill breadth change.
- Single-device server + JS client: binding update on every sign-in (`routes/auth/google.ts`),
  LRU + invalidation (`auth/installation-binding.ts`), `device-evicted`/`reauth-required` 401s
  (`plugins/auth.ts`), JS force-logout (`services/api.ts` `maybeHandleEviction` → Signup notice).
- Thumbnails: `lib/thumbnail.ts` generation, Dockerfile ffmpeg (`apps/api/Dockerfile` runner
  stage), boot probe (`app.ts`), `backfillThumbnails()` core, client `HistoryRow` render priority.
- Feedback: server NUL strip (`stripNulDeep`), S3 best-effort, guarded insert + retry.
- Upload: fail-fast classification for genuine 4xx, `capturedAt` fallback, `LocationSchema.catch(null)`.

---

## §1 Phase 0 — Make the environment truthful (code enablers + ops runbook)

### 0-code (implementing agent)

1. **Make the image able to run its own scripts.** Wire the orphaned
   `apps/api/tsconfig.scripts.json` into the build so `dist/scripts/migrate.js` and
   `dist/scripts/backfill-thumbnails.js` exist (add a `build:scripts` step to
   `apps/api/package.json` `build`, verify the runner's `isCompiled` branch resolves the
   migrations dir from `dist`), and make the Dockerfile copy `dist/scripts/`. Acceptance: from a
   locally built image, `docker run <img> node dist/scripts/migrate.js` runs (and fails only on
   missing `DATABASE_URL`).
2. **Version stamping (unconditional).**
   - API: Dockerfile `ARG GIT_SHA` → `ENV GIT_SHA`, `/healthz` returns `{ status: 'ok', sha: process.env.GIT_SHA ?? 'unknown' }`
     (`apps/api/src/routes/healthz.ts`). Update its test.
   - Mobile: `buildspec.yml` gradle line passes `-PhumynVersionName=0.1.0-${IMAGE_TAG}` so the
     Profile footer (PROF-05) shows the real build instead of the constant `0.1.0-apk (1)`.
3. **Write `RUNBOOK-DEPLOY.md`** (repo root) containing the 0-ops steps below with real commands,
   so deploys are repeatable even before/without Phase 7 automation.

### 0-ops (owner, AWS access; agent prepares exact commands)

Order matters — API + DB first, APK last (an old APK against the new API cannot sign in: the new
`/auth/google` requires `installationId`; that's acceptable for staging testers, who reinstall).

1. Identify live names from the console (tfvars are placeholders): ECR repo, ECS cluster/service
   (terraform suggests `humyn-staging` / `humyn-staging-api`, log group `/humyn/staging/api`).
2. Build + push the API image from `stage` HEAD (after Phases 1–6 land):
   `docker build -f apps/api/Dockerfile --build-arg GIT_SHA=<sha8> -t <ecr>/humyn-api:<sha8> .`
   → push → point ECS at it (`--force-new-deployment` if tag `latest`).
3. Apply migrations 0010 → 0018: run a **one-off ECS task** using the new image with command
   `["node","dist/scripts/migrate.js"]` (same task role/network as the service), or SSM-tunnel +
   `DATABASE_URL=... pnpm --filter @humyn/api db:migrate`. Verify:
   `SELECT filename FROM schema_migrations ORDER BY filename;` ends at `0018_*`.
4. Run the thumbnail backfill the same way: one-off task `["node","dist/scripts/backfill-thumbnails.js"]`
   with `RECORDINGS_BUCKET` set (ffmpeg is in the image). (Phase 4's boot sweep makes this
   self-healing afterward.)
5. Trigger the mobile CodeBuild from `stage` HEAD; **verify the Firebase App Distribution release
   notes read `Build <new sha8> from stage` before installing.** Also check what the CodeBuild
   project's trigger is (console) — if it doesn't auto-build on `stage` pushes, note it in the
   runbook (or fix in Phase 7).
6. Post-deploy gates (all must pass before any bug retest):
   - `curl /healthz` → `{"status":"ok","sha":"<sha8>"}`.
   - `curl -X POST .../me/practice-complete -H 'Content-Type: application/json' -H 'Idempotency-Key: <uuid4>' -d '{}'` → **401** (was 404).
   - The §0 init probe (new-shape body, no auth) → **401** (was 400 naming fileSha256).
   - CloudWatch boot line: `ffmpeg present — server-side poster thumbnails (Bug 6 / D5) enabled`.
7. On-device: install the new APK, sign out/in once (legacy JWTs get `reauth-required` by design),
   confirm Profile footer shows `0.1.0-<sha8>`.
8. Optional: seed `app_versions` for `apkRollout` (the in-app updater currently 404s) pointing at
   the S3/`-latest.apk` URL.

---

## §2 Phase 1 — Upload pipeline: auth-aware, observable, retry that visibly works

All file refs verified on `stage` @ `4f2cc4c`.

1. **401 must not dead-letter** — `apps/mobile/android/.../upload/UploadCoordinator.kt`
   `classifyHttpFailure(...)`: special-case `code == 401`: do NOT return `DeadLetterException`.
   Parse the problem-detail slug from the body (`device-evicted` / `reauth-required` / other).
   Mark the row `PENDING` with `lastFailureReason = "auth: <slug>"`, pause the drain loop, and
   emit a new device event `onUploadAuthFailure { slug }` (same emitter channel as
   `onUploadQueueChanged`). Rationale: today an eviction or expired JWT permanently kills the
   queue and the user never learns why (contradicts `UPLOAD-PIPELINE.md` §19's documented
   refresh contract).
2. **JS listener for `onUploadAuthFailure`** — install at boot next to the existing queue bridge
   (`apps/mobile/src/services/uploadQueueStore.ts` installer): `device-evicted`/`reauth-required`
   → reuse the exact `maybeHandleEviction` behavior (`services/api.ts`): `notifyDeviceEvicted` +
   `resetToOnboarding()`. Plain expiry → attempt silent Google re-auth; on success push the fresh
   JWT via the existing `setUploadContextSafe` path and call `HumynUpload.resume()`.
3. **Revive parity** — `HumynUploadModule.reviveDeadLetter` must also reset `attemptCount`,
   `lastFailureAt`, `lastFailureState`, `lastFailureReason` (mirror
   `UploadCoordinator.retryNeedsAttention`), otherwise a revived row can sit backoff-skipped for
   up to 1 h looking frozen.
4. **Server: stop memoizing client errors** — `apps/api/src/plugins/idempotency.ts:91`
   `if (reply.statusCode >= 500)` → `if (reply.statusCode >= 400)`. The handlers are SELECT-first
   idempotent; only 2xx replay needs protection. **This is a deploy-blocking fix**: without it,
   the first post-deploy request from a legacy-JWT device caches its `reauth-required` 401 under
   the row's never-rotated `initIdempotencyKey`, and after re-sign-in every Retry replays the
   cached 401 for 24 h — the bug would "survive" the deploy. Add a test (4xx not persisted; 2xx
   replayed). Also wrap the `persist(...)` call in try/catch + `req.log.warn` (a memoization
   write failure must not 500 a succeeded request — also closes a `/feedback` 500 path).
5. **Belt-and-braces: rotate per-route idempotency keys on user-initiated Retry** (revive +
   retryNeedsAttention) — safe because `/recordings/init` re-presigns idempotently by
   `recordingId` (SELECT-first), and it immunizes retries against any historically cached entry.
6. **Surface the reason + give Retry feedback** — `HistoryRow.tsx`: dead-letter rows currently
   render the generic label; show the captured `deadLetterReason` (it's already sanitized and in
   `rowToMap`) the same way needs-attention reasons render. On Retry tap, the chip should flip to
   in-progress immediately (it does once revive emits) and an instant re-fail should still leave
   a changed `lastFailureAt` so the row visibly updates (test this); add a toast on revive
   failure/no-op (`reviveDeadLetterSafe` resolving null).
7. **Don't auto-revive auth-blocked rows** — `apps/mobile/src/services/uploadReconcile.ts`
   (foreground reconcile) currently revives every dead-letter; skip rows whose failure reason is
   the auth marker until a fresh token has been pushed (prevents 401 ping-pong).
8. **Tests**: Kotlin — classify(401) keeps row non-dead-letter + emits event; revive resets
   counters. RN — listener wiring (evicted → reset nav; expiry → context re-push), HistoryRow
   reason rendering. API — idempotency 4xx-no-persist + persist-guard.

**Acceptance (bug 1):** against the redeployed API, a fresh recording uploads end-to-end
(`/init` → PUTs → `/finalize` 200 → row leaves the queue, local files deleted). A dead-lettered
row Retries successfully once the cause is gone. On an evicted device, the queue pauses and the
app lands on Signup with the eviction notice instead of silently dead-lettering. The failed-row
UI names the actual reason.

---

## §3 Phase 2 — Single-device enforcement that the user can SEE

Server + JS-client eviction already works on `stage`. Make it prompt, not lazy:

1. **Foreground session ping** — `apps/mobile/src/hooks/useForegroundUserRehydrate.ts` currently
   pings `/me` only while `user == null`. Extend: on every `AppState → 'active'`, throttled to
   ≥60 s since the last ping, fire an authed `GET /me` regardless (cheap; rate-limit headroom is
   fine). `maybeHandleEviction` inside the API client does the rest. Result: an evicted device is
   signed out within seconds of being looked at.
2. **Pre-recording session check** — before the hand-gate/`HumynCapture.start()` flow begins
   (the pre-record screen), fire one authed lightweight GET. Only a definitive 401 blocks (and
   routes through the eviction UX); network errors proceed (offline capture stays legal — the
   queue holds). Prevents wasting a 10-minute capture that can never upload.
3. **Native uploader handling** — covered by Phase 1 items 1–2 (uploads stop + surface eviction
   instead of dead-lettering).
4. **Scale-out invariant** — keep the 60 s LRU (`desired_count = 1`); add a boot log line noting
   the single-instance invariant (`auth/installation-binding.ts` documents it; make it visible).
5. **Tests**: hook throttle/ping behavior; pre-record 401 → eviction path; (server tests exist).

**Acceptance (bug 3):** sign in on device B → device A's next foreground/refresh/record-attempt
lands on Signup with "your account was used on another device"; B keeps working; A re-signing-in
evicts B symmetrically. Two devices can never both sustain authed activity.

---

## §4 Phase 3 — Practice: once per lifetime, server-authoritative

1. **Migration `0018_backfill_practice_all_users.sql`** (owner decision 2026-06-10: ALL existing
   users): `UPDATE users SET practice_completed_at = COALESCE(practice_completed_at, created_at);`
   Idempotent; stamps every account existing at migration time (accepted trade-off: an existing
   account that never practiced skips it). Keep 0017 as-is (already-applied environments are a
   superset-safe sequence). Test in the style of `test/db/0017-backfill-practice.test.ts`.
2. **Durable completion POST** — `PracticeCompleteScreen.tsx` currently fires
   `void postPracticeComplete().catch(() => undefined)`. Replace with: attempt the POST; on any
   failure persist a pending flag (MMKV, e.g. `practice.pendingServerPost.{sub}.v1`) and flush it
   on boot + app-foreground (hook it into the same installer that runs `uploadReconcile`). Clear
   on 2xx **or 409/already-set**. The local `practiceDoneKey` seed stays as-is (instant UX).
3. **Gate double-check** — when route computation (`state/initialRoute.ts` /
   `CompatPassScreen.tsx`) would send a JWT-holding user into `RigTutorial`, fire one
   `GET /me` first (with a short timeout); if `practiceCompletedAt` is non-null → seed MMKV and
   skip to MainTabs. Offline/timeout → fall through to practice (safe default). This closes the
   "stale local cache forces a redo" corner permanently.
4. **Tests**: pending-post flush; gate double-check (mock `/me`); migration test.

**Acceptance (bug 2):** existing user + fresh install + sign-in → lands on MainTabs, no practice.
Completion while offline survives app restarts and reaches the server. A user who completes
practice once is never re-gated on any device/reinstall thereafter.

---

## §5 Phase 4 — Thumbnails: generated, recovered, and shown

1. **In-process backfill sweep** — in `apps/api/src/app.ts` (mirror the existing `startDsrCron`
   pattern): when `isFfmpegAvailable()`, run `backfillThumbnails({ concurrency: 2 })` once at
   boot and on an interval (e.g. hourly). This replaces the structurally-unrunnable manual CLI as
   the recovery path and makes generation self-healing (rows whose finalize-time gen failed get
   retried every sweep). Log per-sweep counts (scanned/generated/failed). Keep the CLI for
   one-off ops use (it now compiles into the image per Phase 0-code).
2. **Observability** — `finalize.ts`/`thumbnail.ts`: log thumbnail success at info with the S3
   key (success is currently silent); keep the non-fatal warn on failure.
3. **Client: use local thumbs for device-only rows** — `HistoryScreen.tsx`: the ledger map is
   built only over server `rawRows`, and synthesized device-queue rows omit any thumbnail — so a
   failed-upload row letter-tiles even though `filesDir/thumbs/<id>.jpg` + a ledger entry exist.
   Build the map over the union of server-row ids and device-queue `recordingId`s (or fall back
   to `readEntry(item.id)` at render). No new UI — `HistoryRow` already prefers
   `ledgerEntry.thumbnailPath`.
4. **Tests**: sweep scheduling guard (ffmpeg-absent → skipped + warn), HistoryScreen synthesized
   rows get ledger entries.

**Acceptance (bug 4):** after deploy + backfill, every `uploaded` recording shows a real poster
in History (server-presigned URL); rows still uploading / failed show their local capture thumb;
letter tiles only remain for rows with genuinely no artifact (e.g. reinstall wiped local thumbs
AND never uploaded). New finalizes generate thumbs inline; missed ones appear within one sweep.

---

## §6 Phase 5 — Battery ask: harden the latent race (owner can no longer reproduce the exit)

The reported exits almost certainly came from the old standalone battery screen (deleted 06-09)
on the old APK. The relocated ask (`PermissionsScreen.handlePress` fire-and-forget IIFE →
`navigation.replace('Compat')`) introduced a NEW latent hazard: the system dialog opens over
`CompatRunningScreen` **while EncoderProbe/ImuProbe hold the camera**; their `onConfigured`
callbacks run unguarded on HandlerThreads — a camera disconnect there is an uncaught native
exception = process death (would present exactly as "app exits during the battery ask").

1. **Guard the probes** — `EncoderProbe.kt` + `ImuProbe.kt`: wrap the `onConfigured` bodies
   (`createCaptureRequest`/`setRepeatingRequest`) in try/catch → on failure count down the latch
   and fail the probe gracefully (existing fail-closed semantics); add `openLatch.countDown()`
   to `EncoderProbe.onDisconnected`.
2. **Move the ask out of the camera window** — relocate the IIFE from `PermissionsScreen.handlePress`
   to `CompatPassScreen` mount (probes finished, no camera open; still onboarding per D-BATTERY).
3. **Prefer the Activity context** — `HumynUploadModule.requestBatteryOptimizationExemption` /
   `BatteryOptimizationHelper`: use `currentActivity?.startActivity(intent)` (no NEW_TASK) when
   available, falling back to the current appContext+`FLAG_ACTIVITY_NEW_TASK`. Keeps the dialog
   in the app's task so dismissal returns to the app (kills the "back to launcher looks like an
   exit" failure mode on some OEMs).
4. **Diagnostics runbook** (add to `RUNBOOK-DEPLOY.md`): if it ever recurs —
   `adb logcat -v time AndroidRuntime:E ReactNativeJS:E CameraService:I ActivityManager:I HumynBattOpt:W *:S`
   plus `adb logcat -b crash -d`, and Crashlytics console filtered to the apkRollout app.
5. **Tests**: existing manifest test already pins the `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
   permission; add/adjust unit coverage for the relocated ask trigger.

**Acceptance (bug 5):** onboarding completes with the exemption dialog shown exactly once after
compat passes; accept/deny/dismiss all return to the app; no crash signatures in
Crashlytics/logcat during the flow; compat probes pass with the dialog appearing mid-run (if
forced via the Help Center button during a probe — should now degrade to a clean probe result,
never a process death).

---

## §7 Phase 6 — /feedback can no longer 500

Server fixes (`d32e50c`, `cfc69c3`) are correct but the client still ships poisoned payloads
forever and several 500 paths remain:

1. **Client sanitize at the source** — strip NUL/C0 control chars from telemetry event props at
   ring-append time (`services/telemetryRing.ts` / `analytics.ts` `logEvent` — the known vector
   is raw `err.message` props like `signup_google_failed`) and over the whole snapshot + message
   in `feedbackService.ts` before `JSON.stringify`.
2. **Wire send-and-clear** — `telemetryRing.clear()` after a 201 (documented design, never
   wired) so a historically poisoned ring stops replaying on every report.
3. **Server: content errors → 4xx, not 500** — `routes/feedback/post.ts`: if the retry insert
   also throws with a PG content/constraint class (`22xxx`/`23xxx`) return a 422/400
   problem-detail ("diagnostic not storable") reserving 500 for infra; catch busboy errors
   without `statusCode` ("Unexpected end of form") in the parts loop → 400 "malformed multipart".
4. **Insert-first, upload-later** — insert the feedback row (inline diagnostic, `_s3_key: null`)
   before the S3 PutObject; on success `UPDATE ... SET diagnostic = jsonb_set(..., '_s3_key', ...)`.
   S3 leaves the 201 path entirely.
5. **Idempotency persist guard** — done in Phase 1 item 4 (shared).
6. **Tests**: NUL-in-ring client test; server 422 classification; insert-first ordering;
   malformed-multipart 400.

**Acceptance (bug 6):** Report a problem succeeds (201) from the affected device — including with
its existing poisoned ring; a second report after success sends a fresh ring; deliberately
malformed input yields 4xx problem-details; S3 outage still yields 201.

---

## §8 Phase 7 — Deploy pipeline (decision pending; recommended) + what ships unconditionally

Unconditional (already in Phase 0-code): `RUNBOOK-DEPLOY.md`, `/healthz` SHA, APK versionName
stamping, image-runnable migrations/backfill.

**Recommended (owner to confirm): GitHub Actions deploy workflow** `api-deploy.yml` on push to
`stage` (and later `main` → prod): docker build (`--build-arg GIT_SHA`) → push ECR `:sha8` →
run the migration one-off ECS task → `aws ecs update-service` with the new task-def → wait for
stable → probe `/healthz` sha. Auth via the GitHub-OIDC deploy role (`infra/terraform/modules/iam`
already provisions one — verify its trust policy/repo claim before relying on it). Alternative
(owner preference): an AWS CodeBuild project mirroring the mobile one. Also: consider re-enabling
`mobile-ci`'s commented-out `push: branches: [stage]` trigger or confirming the CodeBuild webhook,
so APKs always track `stage`.

If the owner declines automation, the runbook is the deliverable; nothing else changes.

---

## §9 Execution order

1. Phase 0-code + Phase 1 item 4 (deploy-blocking idempotency fix) — then Phases 1–6 in any
   order (1 → 2 → 3 → 4 → 6 → 5 suggested; 1 and 2 share the auth-event work).
2. All gates green: API vitest suite, mobile vitest, Kotlin tests, `pnpm -r typecheck`.
3. Phase 0-ops (owner): API image → migrations (through 0018) → backfill → CodeBuild APK →
   install + one re-sign-in.
4. §10 smoke. 5. Phase 7 per owner decision.

## §10 Verification protocol (end-to-end smoke, after 0-ops)

| Bug | Test                                            | Pass criteria                                                                                                                                                                       |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | `curl /healthz`                                 | `sha` = deployed sha8                                                                                                                                                               |
| —   | §0 probes                                       | practice-complete → 401; init-no-auth → 401 (NOT 400/fileSha256)                                                                                                                    |
| 1   | Record 3+ min real task → watch History         | chip: In progress → Uploaded; row leaves queue; CloudWatch shows init/finalize 2xx; local files deleted                                                                             |
| 1   | The stuck Jun-10 "Dicing" row → Retry           | uploads (or, if files were since purged, shows a NAMED reason — never a silent no-op)                                                                                               |
| 2   | Uninstall → reinstall → sign in (existing user) | straight to MainTabs, no practice; `SELECT practice_completed_at FROM users WHERE email=...` non-null                                                                               |
| 3   | Sign in on device B, then foreground device A   | A lands on Signup + "used on another device" within seconds; A's pre-record check also blocks                                                                                       |
| 4   | History after backfill + a fresh upload         | real posters on uploaded rows; local thumb on a deliberately-failed row; `SELECT count(*) FROM recordings WHERE qa_status='uploaded' AND s3_key_thumbnail IS NULL` → 0 (post-sweep) |
| 5   | Fresh install → onboarding through compat       | battery dialog appears post-compat; accept/deny/dismiss all return to app; no Crashlytics event                                                                                     |
| 6   | Help → Report a problem (twice)                 | both 201; rows in `feedback` table; second report's ring is fresh                                                                                                                   |

## §11 Risks & LOCKED compliance

- **Old APK + new API**: sign-in 400s (`installationId` required) and legacy JWTs 401
  (`reauth-required`) — staging testers must install the new APK and re-sign-in once. Seeding
  `app_versions` enables the in-app force-upgrade path for stragglers.
- **No FCM (LOCKED)**: eviction stays pull-based — next-request + foreground ping + pre-record
  check is the ceiling; "the other device logs out within seconds of being USED" is the spec,
  instant remote logout is not possible.
- **Thumbnails are derived objects** (CLAUDE.md: explicitly allowed; the three captured payload
  files remain byte-for-byte).
- **Migration 0018** stamps never-practiced legacy accounts (owner accepted 2026-06-10).
- **`desired_count=1`** is a correctness invariant for the eviction LRU and the backfill sweep —
  do not scale out without revisiting both (documented in code per Phase 2 item 4).
- Capture spec, consent, drift gates, ultrawide path: untouched by every phase above.
