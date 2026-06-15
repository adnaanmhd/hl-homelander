# Handoff — Bug-fixes + Enhancements execution (2026-06-04)

Resume doc for the in-flight execution of `IMPLEMENTATION-PLAN-260604.md` (11 bugs +
3 enhancements). Read **that plan** + `CLAUDE.md` first — they are the source of truth.
This doc only records **what's done, what's left, and how to verify**.

> **GSD is bypassed** (framework abandoned/rug-pulled). Owner explicitly authorized
> editing the repo directly without any `gsd-*` command. Do NOT invoke or wait on GSD.

---

## 0. Where we are

- **Working branch:** `fix/bugs-enhancements-260604` (off `stage`). **Nothing committed** —
  all work is uncommitted in the tree. Commit/push ONLY when the owner asks.
- **Phase 0 (4 items): ✅ DONE + fully verified.**
- **LOCKED-override checkpoint: ✅ owner signed off** — recorded in
  `.planning/260604-locked-override-signoff.md` (D1 remove hashing, D2 multi-device
  newest-wins, D3 precise GPS, D6 drop trailing <3-min segment — all APPROVED).
- **Phase 1 (Enh 3 / D1 — remove verification + all hashing): 🟡 IN PROGRESS.**
  - Backend source ✅ done (typecheck green) · DB migration `0011` ✅ applied
  - shared/types ✅ done · Mobile TS source + tests ✅ done (**mobile suite green**)
  - **Mobile Kotlin ❌ NOT STARTED** ← the immediate next work
  - **API test cleanup (§6.8) ❌ NOT done → `apps/api` vitest suite is currently RED**
  - **Infra reap (§6.7) ❌ NOT done** (plan says fast-follow)
- **Phases 2–5: ⬜ not started.**

---

## 1. Environment & tooling (do this first in the new session)

Everything is already installed/running on this machine:

- **Node 24** active (project pins 22 — works fine). pnpm + npm available.
- Deps installed: root `pnpm install` + `apps/mobile` `npm ci` already done.
- **`shared/types` MUST be built** for api/mobile to resolve `@humyn/shared-types`.
  After ANY edit to `shared/types/src/**`, rebuild:
  `cd shared/types && npm run build`
- **Docker is up** (postgres + redis + localstack, all healthy). DB has migrations
  0001–0011 applied.

### Verify commands (use these as your gates)

| What                     | Command                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mobile typecheck         | `cd apps/mobile && npx tsc --noEmit`                                                                                               |
| Mobile tests             | `cd apps/mobile && node_modules/.bin/vitest run [optional path]`                                                                   |
| API typecheck            | `cd apps/api && npx tsc --noEmit`                                                                                                  |
| API tests                | `zsh /tmp/runapi.sh [optional path]` (injects DB env + silences pino)                                                              |
| Kotlin/Robolectric tests | `zsh /tmp/runkt.sh --tests "ai.humynlabs.capture....ClassName"`                                                                    |
| Apply migrations         | `cd apps/api && DATABASE_URL='postgres://humyn:humyn@localhost:5432/humyn_dev' AWS_REGION='ap-south-1' npx tsx scripts/migrate.ts` |

- `/tmp/runapi.sh` and `/tmp/runkt.sh` are helper scripts I wrote (they persist in /tmp).
  If they're gone, recreate them — contents below in §6.
- **API tests have no `.env`/dotenv** — env is injected by `/tmp/runapi.sh`. The
  vitest binary is hoisted to the repo-root `node_modules/.bin/vitest`.
- **Kotlin tests need:** `ANDROID_HOME=~/Library/Android/sdk`,
  `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home` (JDK 17 —
  NOT the default JDK 26), task `:app:testApkRolloutDebugUnitTest`. A **gitignored
  placeholder** `apps/mobile/android/app/google-services.json` was created so
  Robolectric builds (the real Firebase config isn't in the repo). Do NOT commit it.

---

## 2. Status of all 14 items

| #           | Item                                       | Phase | Status                                                                              |
| ----------- | ------------------------------------------ | ----- | ----------------------------------------------------------------------------------- |
| Bug 1       | Delete account → 415                       | 0     | ✅ done+verified (client `text/plain` CT + server catch-all parser)                 |
| Bug 2       | "Keep recording" kills preview             | 0     | ✅ done+verified (mount gate spans `active`+`stop-confirm`)                         |
| Bug 9       | 2nd recording uploads under prior task     | 0     | ✅ done+verified (native emits `taskId`; JS enqueues `e.taskId`; `navigate`→`push`) |
| Enh 2       | Remove dev task + `__DEV__` shortcut       | 0     | ✅ done+verified (migration 0010; placeholder screen + 3 tests deleted)             |
| **Enh 3**   | **Remove verification + all hashing (D1)** | **1** | 🟡 **backend+mobileTS done; KOTLIN + api/kotlin tests + infra LEFT**                |
| Bug 6       | Cross-device thumbnails (D5)               | 2     | ⬜ not started (needs Phase 1 finalize done)                                        |
| Bug 8+Enh 1 | 3-min minimum (D6 — drop trailing <3min)   | 3     | ⬜ not started                                                                      |
| Bug 3       | Precise location + perm gate (D3,D4) 🔴    | 3     | ⬜ not started — **consent-text + DPIA must land before SHIP**                      |
| Bug 4       | Single-device newest-wins (D2) 🔴          | 4     | ⬜ not started (uses the kept `lru-cache` dep)                                      |
| Bug 5       | Persist practice-done server-side (D7)     | 4     | ⬜ not started                                                                      |
| Bug 7       | History live updates                       | 5     | ⬜ not started (after Phase 1)                                                      |
| Bug 11      | Contribution stats auto-update             | 5     | ⬜ not started (after Phase 1)                                                      |
| Bug 10      | Profile slow/stuck load                    | 5     | ⬜ not started (after Phase 1)                                                      |

Recreate this as a TaskList in the new session if you want tracking.

---

## 3. Enh 3 (Phase 1) — exactly what's DONE vs LEFT

### ✅ DONE (compiles / mobile suite green)

- **Deleted backend files:** `workers/hash-verify*.ts`, `workers/sqs-poller.ts`,
  `lib/{queue,verify-recording,sha256-stream,recording-events}.ts`,
  `cron/verify-sweep.ts`, `plugins/events-outbox.ts`,
  `routes/recordings/{verified-ids,reupload}.ts`.
- **Edited backend:** `lib/recording-state.ts` (uploaded=terminal; only `pending`
  non-terminal; enum keeps legacy values), `routes/recordings/finalize.ts` (no
  enqueueVerify / no recordings_to_verify; toRecordingResponse drops sha/verifiedAt),
  `app.ts` (unregistered events-outbox + verify-sweep), `routes/recordings/index.ts`,
  `get.ts`/`stream-url.ts` (comments), `schemas.ts` (`_events` gone), `init.ts` (no sha
  persist), `contributions/list.ts` (`qa_status IN ('uploaded','verified')`),
  `db/schema.ts` (dropped sha + verified_at cols, recordingEventTypeEnum, both verify
  tables), `package.json` (removed worker scripts + `bullmq`/`ioredis`/`@aws-sdk/client-sqs`;
  **kept `lru-cache`** for D2).
- **DB migration `0011_remove_hash_verify_flow.sql`** — created + **applied** (drops the
  2 tables, the enum, and `file_sha256`/`imu_sha256`/`verified_at` columns).
- **shared/types:** `recording.ts` (removed `fileSha256`/`imuSha256`/`verifiedAt`,
  `RecordingServerEvent`, `EventsEnvelope`, `Reupload*`, `VerifiedIds*`, `_events` on
  list/stream responses; **kept** `QaStatusSchema` legacy values + `RecordingRePresign*`),
  `me.ts` (no `_events`), `contributions.ts` (`verifiedNonPracticeCount` kept, comment updated).
- **Mobile TS:** `services/api.ts` (interceptEvents removed), deleted
  `services/recordingEvents.ts`, `services/uploadReconcile.ts` (re-pointed to a
  **GET /recordings backstop** clearing local rows the server reports uploaded/verified),
  `native/HumynUpload.ts` (state union drops `awaiting-verify`/`verified`;
  `clearVerified`→`clearUploaded`; **removed `reupload`**), `components/HistoryRow.tsx`
  - `UploadStatusChip.tsx` (dropped `chip-verifying`/`verifying`; `uploaded`→success),
    `screens/{history,home,uploads}/*` (switch cases + dead-letter Retry → `reviveDeadLetterSafe`).
    Mobile tests updated (uploadReconcile, PendingUploads, UploadStatusChip, HomeSkeleton);
    image snapshot regenerated. **`apps/mobile` full vitest suite: 146 files / 1023 tests GREEN.**

### ❌ LEFT — do these to finish Enh 3

**(A) Mobile Kotlin (§6.6)** — source not yet touched:

- `upload/UploadModels.kt` — drop `AWAITING_VERIFY` / `VERIFIED` states from the row-state enum.
- `upload/UploadCoordinator.kt` — on `/finalize` 200: **delete the local bundle
  (mp4/csv/json) + drop the queue row** (this is what `clearVerified` did) instead of
  transitioning to AWAITING_VERIFY/VERIFIED; remove the SHA fields from the `/recordings/init`
  postInit body; remove any reupload dispatch.
  ⚠ **Do NOT delete the thumbnail** on finalize — History needs the local thumb until
  Bug 6 (Phase 2) ships server thumbnails.
- `upload/HumynUploadModule.kt` — rename the `clearVerified` `@ReactMethod` → `clearUploaded`
  (JS already calls `clearUploaded`); **remove the `reupload` `@ReactMethod`** (keep
  `reviveDeadLetter` + `retryNeedsAttention`).
- `upload/UploadQueueStore.kt` — it also references removed states/fields; update to match.
- `capture/MetadataComposer.kt` — remove `file_sha256` / `imu_sha256`; **bump
  `CURRENT_SCHEMA_VERSION` `1.3.0` → `1.4.0`** (current value confirmed `1.3.0`, line 57).
  (Bug 3 in Phase 3 will then bump `1.4.0` → `1.5.0` for location.)
- `capture/FinalizeWorker.kt` — drop the HashStreamer step (the SHA compute call).
- **Delete `capture/HashStreamer.kt`.**
- ⚠ **KEEP `AppFlavorModule.sha256First16Hex`** — that's the compat-signature device
  fingerprint (`compatSignature.ts`), NOT upload hashing.
- `capture/ThumbnailExtractor.kt` matched the grep — verify it's only an incidental
  "sha"/comment, likely no change.

**(B) Kotlin tests (§6.8):**

- **Delete** `capture/HashStreamerTest.kt`, `upload/HumynUploadModuleReuploadTest.kt`.
- **Edit** `upload/UploadCoordinatorTest.kt`, `capture/FileFidelityTest.kt`,
  `capture/MetadataSchemaConformanceTest.kt` (schema bump + no sha),
  `upload/UploadQueueStoreTest.kt` (states), and the test-resource templates
  `src/test/resources/video_metadata_v1_{1,2,3}_0_template.json` (add a `1_4_0` template
  / drop sha fields as the conformance test requires).
- Verify with `zsh /tmp/runkt.sh` (whole `:app:testApkRolloutDebugUnitTest`).

**(C) API tests (§6.8)** — `apps/api` vitest is **currently RED**. Clean up:

- **Delete:** `test/lib/queue.test.ts`, `test/lib/sha256-stream.test.ts`,
  `test/workers/verify-recording.test.ts`, `test/workers/sqs-poller.test.ts`,
  `test/plugins/events-outbox.test.ts`, `test/routes/recordings/verified-ids.test.ts`,
  `test/routes/recordings/reupload.test.ts`.
- **Edit (drop `verified`/`hash-mismatch`/`_events`/sha; `uploaded`=success):**
  `test/lib/recording-state.test.ts`, `test/routes/recordings-finalize.test.ts`,
  `test/routes/contributions.test.ts`, `test/routes/contributions-timeseries.test.ts`,
  `test/routes/recordings-{get,list,init,stream-url,reject}.test.ts`,
  `test/routes/recordings/{init,parts}.test.ts`,
  `test/e2e/{golden-path,recordings-list-negatives,setup}.test.ts` +
  `test/e2e/helpers/seed-fixtures.ts` (drop sha fixtures / verified assertions).
- Verify with `zsh /tmp/runapi.sh`.

**(D) Infra reap (§6.7, fast-follow):** `docker-compose.yml` `redis` service,
`.env.example` `REDIS_URL`, `infra/terraform/modules/{verify-queue,redis}/`,
`infra/terraform/envs/prod/main.tf` (`module "redis"` + `module "verify_queue"`).
(`buildspec.yml` unchanged.) Land code first; infra can be a separate pass.

**(E) i18n (optional):** `uploadChip.verifying` key is now unused in all 8 locales —
harmless (suite passes); remove for cleanliness if desired.

---

## 4. LOCKED decisions to keep consistent (already applied — match these in remaining work)

- `uploaded` = **terminal success**. The `qa_status` enum **keeps** legacy
  `verified`/`hash-mismatch` values (Postgres can't cheaply drop enum values); nothing
  writes them; **read paths treat `uploaded` OR `verified` as success**.
- `clearVerified` → **`clearUploaded`** (unlink local mp4/csv/json + drop row). Kept for
  the reconcile backstop.
- **`reupload` (method + `/reupload` endpoint) REMOVED.** Dead-letter Retry → `reviveDeadLetter`
  (re-drains via `/parts` or idempotent `/init` self-heal). `reviveDeadLetter` +
  `retryNeedsAttention` are KEPT.
- On `/finalize` 200 the device deletes the **bundle (mp4/csv/json), NOT the thumbnail**.
- Metadata schema: Enh 3 → **1.4.0** (drops sha); Bug 3 later → 1.5.0 (location).
- KEEP `lru-cache` (D2) and `AppFlavorModule.sha256First16Hex` (compat fingerprint).

---

## 5. Remaining phases (after Enh 3) — quick map (full detail in the plan §2–§6)

- **Phase 2 — Bug 6 thumbnails (D5):** backend generates a poster JPEG at `/finalize`
  (inline, ffmpeg) → `recordings/{userId}/{recordingId}/thumb.jpg`; add
  `recordings.s3_key_thumbnail` col + migration; signed `thumbnail_url` in list/get +
  shared type; `HistoryRow` falls back to `row.thumbnail_url`. Add ffmpeg to API image.
- **Phase 3 — Bug 8+Enh 1 (3-min gate):** `FinalizeWorker` `CancelReason.TooShort`
  (`MIN_SEGMENT_MS=180_000`, non-practice), `'too_short'` cancel reason + copy,
  `RecordingScreen.tsx:422` `60_000`→`180_000`, StopConfirmModal "(LOCKED)" copy →
  "3 minutes". **D6: drop trailing <3-min segment.** · **Bug 3 location 🔴** (precise
  GPS — manifest FINE perm, remove the `verify-merged-manifests.sh` CI gate, new
  `HumynLocation` native module, schema 1.4.0→1.5.0, `recordings.location jsonb`,
  PermissionsScreen gate; **consent-text + DPIA before ship**).
- **Phase 4 — Bug 4 (multi-device newest-wins, D2 🔴):** `installationId` on sign-in +
  JWT claim + `users.current_installation_id` + requireAuth 401 (LRU-cached). · **Bug 5
  (practice-done, D7):** `users.practice_completed_at` + `POST /me/practice-complete` +
  `/me` field + local seed so `computeInitialRoute` skips the tutorial.
- **Phase 5 (after Phase 1) — Bug 7 / Bug 11 / Bug 10:** single app-lifetime upload-queue
  store + `contributionsVersion` signal in `appStore`; Profile `Promise.allSettled` +
  deadline + focus refetch; backend covering index `recordings_user_qa_idx` + pg pool
  `connectionTimeoutMillis`/`statement_timeout` + concurrent queries.

---

## 6. Helper scripts (recreate in /tmp if missing)

`/tmp/runapi.sh`:

```sh
#!/bin/zsh
cd /Users/adnaan/Documents/hl-homelander-app/apps/api || exit 1
DATABASE_URL='postgres://humyn:humyn@localhost:5432/humyn_dev' \
JWT_SIGNING_SECRET='dev-only-do-not-use-in-prod-ee2c5b8c1a4f3d6e9c0b7a1d8e3f5b2a' \
NODE_ENV=test WORKER_BOOTSTRAP=false REDIS_URL='redis://localhost:6379' \
AWS_ENDPOINT_URL='http://localhost:4566' AWS_REGION='ap-south-1' \
AWS_ACCESS_KEY_ID='test' AWS_SECRET_ACCESS_KEY='test' \
RECORDINGS_BUCKET='humyn-recordings-dev' APK_BUCKET='humyn-apk-dev' \
FEEDBACK_BUCKET='humyn-feedback-dev' LOG_LEVEL='silent' \
/Users/adnaan/Documents/hl-homelander-app/node_modules/.bin/vitest run "$@"
```

`/tmp/runkt.sh`:

```sh
#!/bin/zsh
cd /Users/adnaan/Documents/hl-homelander-app/apps/mobile/android || exit 1
ANDROID_HOME="$HOME/Library/Android/sdk" \
JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" \
./gradlew :app:testApkRolloutDebugUnitTest "$@"
```

---

## 7. Gotchas

- zsh mangles `grep --include=*.ts` — use `grep -rn -e PATTERN dir` and filter, or `git grep`.
- `Bash` working dir persists between calls but **shell vars do not** — use absolute paths /
  the /tmp runner scripts.
- Rebuild `shared/types` after editing it, or api/mobile typecheck fails to resolve it.
- The `apps/mobile/android/app/build/**` tree has STALE generated bundles that still
  contain old strings (e.g. the dev-task ULID) — ignore them (gitignored build output).
- Don't commit `apps/mobile/android/app/google-services.json` (gitignored placeholder).
