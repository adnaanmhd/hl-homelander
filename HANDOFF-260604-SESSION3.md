# Handoff — Session 3 (2026-06-04) — Enh 3 ✅ + Phase 2 ✅ done; Phase 3 (Bug 8) next

Resume doc for the **fourth** execution session of `IMPLEMENTATION-PLAN-260604.md`.
Read the originals first for full context — this doc records **what Session 3 finished,
what's left, and the exact next edits**:

1. `HANDOFF-260604-SESSION2.md` — session-2 resume doc (Enh 3 §3 edits — now DONE).
2. `HANDOFF-260604.md` — session-1 resume doc (env, /tmp scripts, decisions, phase map).
3. `IMPLEMENTATION-PLAN-260604.md` — source-of-truth plan (11 bugs + 3 enh, D1–D8, §6, §7).
4. `.planning/260604-locked-override-signoff.md` — owner sign-off (D1/D2/D3/D6 APPROVED).
5. `CLAUDE.md` — project constraints.

> **GSD is bypassed.** Owner authorized editing the repo directly. Do NOT invoke GSD.
> **Working branch:** `fix/bugs-enhancements-260604`. **Nothing committed.** Commit/push
> ONLY when the owner asks.

---

## 0. Verify loop (unchanged)

| What                    | Command                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile typecheck        | `cd apps/mobile && npx tsc --noEmit`                                                                                                                                                        |
| Mobile tests            | `cd apps/mobile && node_modules/.bin/vitest run [path]`                                                                                                                                     |
| API typecheck           | `cd apps/api && npx tsc --noEmit`                                                                                                                                                           |
| API tests               | `zsh /tmp/runapi.sh [path]`                                                                                                                                                                 |
| Kotlin tests            | `zsh /tmp/runkt.sh` (whole `:app:testApkRolloutDebugUnitTest`)                                                                                                                              |
| Kotlin **main** compile | `cd apps/mobile/android && ANDROID_HOME="$HOME/Library/Android/sdk" JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ./gradlew :app:compileApkRolloutDebugKotlin` |
| Apply migrations        | `cd apps/api && DATABASE_URL='postgres://humyn:humyn@localhost:5432/humyn_dev' AWS_REGION='ap-south-1' npx tsx scripts/migrate.ts`                                                          |

`/tmp/runapi.sh` + `/tmp/runkt.sh` exist (contents in `HANDOFF-260604.md` §6). Docker is up
(postgres/redis/localstack healthy — **redis is now unused by code** but the container is
harmless). Migrations applied **through 0012**. Rebuild `shared/types`
(`cd shared/types && npm run build`) after any edit there.

### Gotchas discovered this session (IMPORTANT)

- **`; echo "EXIT=$?"` masks the real exit code** of a backgrounded gradle/vitest — the
  echo's exit (0) becomes the bg-task notification's "exit code". Run the command WITHOUT a
  trailing echo so the notification is accurate, OR grep the log for `BUILD FAILED` /
  `Tests  N failed`. (Cost me a false "green" on the Kotlin suite.)
- **Stale `idempotency_keys`** — fixed-key `/init` tests 409 ("expected 409 to be 201") when
  prior broken runs left rows whose body-hash predates an edit. Purge:
  `docker exec humyn-postgres psql -U humyn -d humyn_dev -c "TRUNCATE idempotency_keys;"`
- **Edit `replace_all` with a leading-`\n` old_string can join adjacent lines** (consumed a
  newline unexpectedly; I had to re-split 3 lines). Prefer **full-line-context** anchors.
- **Edit-after-sed/perl** — re-`Read` a file before `Edit` if you sed/perl'd it.
- **cwd persists between Bash calls** but shell vars don't — run `migrate.ts` from `apps/api`
  (a stray `cd shared/types` earlier made it resolve the wrong path).
- **ffmpeg IS installed locally** (`/opt/homebrew/bin/ffmpeg` 8.1.1) — the Bug 6 thumbnail
  e2e test relies on it; it's gated on ffmpeg presence so it skips cleanly if absent.

---

## 1. Status — what Session 3 finished

| What                                                  | State                                         |
| ----------------------------------------------------- | --------------------------------------------- |
| **Phase 0** (Bugs 1,2,9 + Enh 2)                      | ✅ done (session 1)                           |
| **Enh 3 / Phase 1** (remove verify + all hashing, D1) | ✅ **DONE + ALL GATES GREEN**                 |
| **Bug 6 / Phase 2** (cross-device thumbnails, D5)     | ✅ **DONE + ALL GATES GREEN**                 |
| **Bug 8 + Enh 1 / Phase 3** (3-min gate, D6)          | 🟡 **NEXT — design ready in §3, NO code yet** |
| Bug 3 / Phase 3 (precise location, D3/D4) 🔴          | ⬜ not started (consent/DPIA before SHIP)     |
| Phase 4 (Bug 4 D2 🔴, Bug 5 D7)                       | ⬜ not started                                |
| Phase 5 (Bug 7, Bug 11, Bug 10)                       | ⬜ not started                                |
| Spec/doc updates (plan §8 — D1 docs)                  | ⬜ deferred, non-code                         |

**Green baselines at end of Session 3** (all verified):

- Kotlin: `:app:testApkRolloutDebugUnitTest` BUILD SUCCESSFUL (+ main compiles).
- API: `zsh /tmp/runapi.sh` → **36 files / 173 tests pass**; `tsc --noEmit` clean.
- Mobile: `vitest run` → **146 files / 1025 tests pass**; `tsc --noEmit` clean.

---

## 2. What Session 3 changed (Enh 3 finish + Bug 6)

### Enh 3 / Phase 1 — FINISHED (was 90% in Session 2)

- **(B) Kotlin tests** — `UploadCoordinatorTest.kt`: applied SESSION2 §3.1–§3.11, then fixed
  3 straggler tests that read the row AFTER a happy-path drain (the row is now _dropped_ on
  finalize 200): `cellular network…` (assert via `/init` body partsCount + queue empty),
  `each route's Idempotency-Key is stable…` (read the row BEFORE the drain), `LOCAL reset…`
  (capture `partsIdempotencyKey` BEFORE the drain). Kotlin suite green.
- **(C) API tests** — deleted 7 dead test files (`test/lib/{queue,sha256-stream}.test.ts`,
  `test/workers/*`, `test/plugins/events-outbox.test.ts`,
  `test/routes/recordings/{verified-ids,reupload}.test.ts`); deleted `test/fixtures/stub-bundle.ts`;
  rewrote `test/lib/recording-state.test.ts` to the new model (`uploaded` terminal; `verified`/
  `hash-mismatch` legacy-terminal; pending only non-terminal); stripped `getQueue`/`recordingsToVerify`/
  `recordingEventsOutbox`/`fileSha256`/`imuSha256`/`verifiedAt` from ~14 route/e2e test files +
  `test/e2e/helpers/seed-fixtures.ts` + `test/e2e/setup.ts`. **uploaded=success; legacy `verified`
  seeds KEPT (they test read-as-success).**
- **(D) Infra reap** — removed `redis` service (`docker-compose.yml`), `REDIS_URL`
  (`.env.example`), `infra/terraform/modules/{redis,verify-queue}/` (deleted), the `module "redis"`
  - `module "verify_queue"` blocks (`infra/terraform/envs/prod/main.tf`). No dangling refs;
    `ecr_repo_url`/`image_tag` still used by ecs. `buildspec.yml` untouched.
- **(E) i18n** — removed the unused `uploadChip.verifying` key from all 8 locale `.json` files.

### Bug 6 / Phase 2 — DONE (cross-device thumbnails, D5)

- **Migration `0012_add_recording_thumbnail.sql`** — `ALTER TABLE recordings ADD COLUMN
s3_key_thumbnail text;` — created + **applied**.
- **`db/schema.ts`** — `s3KeyThumbnail: text('s3_key_thumbnail')` (nullable).
- **`lib/s3-client.ts`** — `recordingKeys()` gained `thumbnail: ${base}/thumb.jpg`.
- **`lib/thumbnail.ts`** (NEW) — `generatePosterThumbnail()`: presign a GET of the video,
  `ffmpeg -ss 1 -i <url> -frames:v 1 -vf scale … -f image2pipe -vcodec mjpeg pipe:1` → PUT
  `thumb.jpg`. 10s timeout. **Best-effort: throws on failure; caller swallows.**
- **`routes/recordings/finalize.ts`** — after both objects confirmed present, best-effort
  `generatePosterThumbnail`; sets `s3KeyThumbnail` in the terminal-flip UPDATE. A failure
  (ffmpeg missing / unreadable bytes) is caught → `s3_key_thumbnail` stays null, finalize
  still 200.
- **`routes/recordings/list.ts`** + **`get.ts`** — select `s3KeyThumbnail`; S3-presigned GET
  (`PRESIGNED_TTL_SECONDS`=15m) → `thumbnail_url` (null when no thumb). S3-presigned (NOT
  CloudFront) so it works identically in dev/LocalStack + prod.
- **`routes/recordings/schemas.ts`** (local) + **`shared/types/src/recording.ts`** —
  `thumbnail_url: z.string().url().nullable()` on the List item + Get response.
- **`apps/api/Dockerfile`** — `apk add --no-cache curl ffmpeg`.
- **Mobile `components/HistoryRow.tsx`** — `HistoryRowItem.thumbnailUrl?: string|null`; render
  order local-ledger → **remote `row.thumbnailUrl`** (new `history-row-thumb-remote`) → gradient.
- **Mobile `screens/history/HistoryScreen.tsx`** — `toRowItem` sets `thumbnailUrl: r.thumbnail_url ?? null`.
- **Tests** — NEW `test/routes/recordings-thumbnail.test.ts` (3: list present/null;
  real-MP4 finalize → thumb.jpg e2e [LocalStack+ffmpeg gated]; fake-bytes → null best-effort).
  Mobile `__tests__/components/HistoryRow.test.tsx` +2 (remote fallback; local wins over remote).

---

## 3. NEXT: Phase 3 — Bug 8 + Enh 1 (3-minute minimum, D6) ← DO THIS FIRST

**Design is fully worked out below; NO code written yet.** Per plan §Bug8 + sign-off D6:
per-segment 3-min floor; **drop** any non-practice segment < 3 min (never uploads); mirror
the existing fps/resolution cancel-gate model. Re-grep line numbers (they drift).

### 3a. Native (Kotlin) — `apps/mobile/android/.../capture/FinalizeWorker.kt`

1. **`CancelReason` sealed class** (currently ~L503–534) — add:
   ```kotlin
   /** Non-practice segment shorter than the 3-min floor (Bug 8 + Enh 1 / D6). */
   object TooShort : CancelReason() { override val code: String = "too_short" }
   ```
2. **`decideCancelReason`** (currently L273–295) — add `durationMs: Double` + `isPractice: Boolean`
   params; insert the TooShort branch **after InsufficientFrames, before FpsDropped**:
   ```kotlin
   if (videoTimestampsNs.size < 2) return CancelReason.InsufficientFrames
   if (!isPractice && durationMs < MIN_SEGMENT_MS) return CancelReason.TooShort
   // … fps, resolution
   ```
   Add `internal const val MIN_SEGMENT_MS = 180_000.0` (or `180_000L`) — top-level/companion so
   the test can reference it. (Rationale for ordering: a too-short clip's fps/res is moot;
   "record ≥3 min" is the user-actionable message. fps/res still win for ≥3-min clips.)
3. **Call site** (currently L96): compute `durationMs` and thread `isPractice`:
   ```kotlin
   val durationMs = (seg.endedAtNs - seg.startedAtNs).toDouble() / 1_000_000.0
   val cancelReason = decideCancelReason(videoTimestampsForGate, videoWidth, videoHeight, durationMs, seg.sidecar.isPractice)
   ```
4. **`emitCanceled` `when (reason)`** (currently L411–427) — add:
   ```kotlin
   CancelReason.TooShort -> { putNull("meanFps"); putNull("width"); putNull("height") }
   ```
5. **Test** — `FinalizeWorkerGatesTest.kt` (find it under `app/src/test/.../capture/`): a 120 000 ms
   non-practice segment → `TooShort`; the same duration with `isPractice=true` → null (exempt);
   a ≥180 000 ms segment → null. Adjust existing `decideCancelReason(...)` call sites for the 2
   new params.

### 3b. Mobile (TS)

6. **`src/native/HumynCapture.types.ts`** — add `'too_short'` to the `SegmentCancelReason` union
   (grep `fps_dropped|resolution_dropped|insufficient_frames`).
7. **`src/components/HistoryRow.tsx`** — `HistoryRowItem.cancel.reason` union (~L132) += `'too_short'`;
   `cancelReasonLabel()` (~L240–249) add `case 'too_short': return 'Canceled — recording too short';`
   (insufficient_frames already returns the same string — acceptable; both are "too short" to the user).
8. **`src/screens/recording/lib/handleSegmentCanceled.ts`** — add `too_short` to its reason
   mapping/copy (mirror the other reasons).
9. **`src/screens/recording/RecordingScreen.tsx`** — the `60_000` post-stop routing check (plan
   says ~L422) → `180_000`; ensure the whole-recording-<3-min case shows the
   **"Recording too short — discarded"** toast (reuse i18n `recording.toasts.tooShort` — review
   wording across `en.json` + 7 siblings so it implies the 3-min floor). **Do NOT rescale the
   minute progress bar** (plan §Bug8 #4, ~L893).
10. **`src/components/StopConfirmModal.tsx`** (~L58) — the "under 1 minute / (LOCKED)" copy →
    "3 minutes" with an owner-deviation note.
11. **Tests** — native gate (above); RN: a <3-min stop → discard toast + non-retryable History
    row; a ≥3-min recording uploads. Update any test asserting the old 60s behavior.

**Verify:** `zsh /tmp/runkt.sh` · `cd apps/mobile && npx tsc --noEmit && node_modules/.bin/vitest run`.

---

## 4. Then: remaining phases (IMPLEMENTATION-PLAN §7 order)

- **Phase 3 cont. — Bug 3 location 🔴** (precise GPS; manifest FINE; remove
  `verify-merged-manifests.sh` gate; new `HumynLocation` native module; schema **1.4.0→1.5.0**;
  `recordings.location jsonb` + migration 0013; `PermissionsScreen` gate; `buildCaptureOpts.ts:117`
  `location:null` → resolved object). **Consent-text (`idea-brief.md §5.2`) + DPIA must land before
  SHIP** — code may land behind that review.
- **Phase 4 — Bug 4 (multi-device newest-wins, D2 🔴):** `installationId` on `/auth/google` + JWT
  claim + `users.current_installation_id` (migration) + `requireAuth` 401-on-mismatch (LRU-cached,
  the KEPT `lru-cache` dep). Overrides `D-AUTH-03`. · **Bug 5 (practice-done, D7):**
  `users.practice_completed_at` + `POST /me/practice-complete` + `/me` field + local seed so
  `computeInitialRoute` skips the tutorial.
- **Phase 5 — Bug 7 / Bug 11 / Bug 10:** single app-lifetime upload-queue store slice in
  `appStore` (+ `contributionsVersion`); Profile `Promise.allSettled` + deadline + focus refetch;
  backend `recordings_user_qa_idx` + pg pool timeouts + concurrent `/contributions` queries.

---

## 5. LOCKED decisions to keep consistent (match these)

- **Enh 3:** `uploaded` = terminal success. `qa_status` enum KEEPS legacy `verified`/`hash-mismatch`
  (nothing writes them; read paths treat `uploaded` OR `verified` as success). `reupload` removed;
  dead-letter Retry → `reviveDeadLetter`; `retryNeedsAttention` KEPT. On `/finalize` 200 the device
  deletes the **bundle (mp4/csv/json), NOT the thumbnail**. KEEP `lru-cache` (D2) +
  `AppFlavorModule.sha256First16Hex` (compat fingerprint).
- **Metadata schema:** Enh 3 = **1.4.0** (current). Bug 3 (location) → **1.5.0** next.
- **Bug 6:** `thumbnail_url` = S3-presigned GET (15-min TTL), null when no thumb. ffmpeg poster gen
  is best-effort in `/finalize` (never blocks). ffmpeg added to the API Docker image.
- **D6:** 3-min **per-segment** floor; drop the trailing <3-min segment; **non-practice only**.

---

## 6. TaskList snapshot (recreate in the new session)

| #   | Item                                 | Phase | Status                      |
| --- | ------------------------------------ | ----- | --------------------------- |
| 1   | Bug 1 delete-415                     | 0     | ✅ done                     |
| 2   | Bug 2 preview                        | 0     | ✅ done                     |
| 3   | Bug 9 task mislabel                  | 0     | ✅ done                     |
| 4   | Enh 2 dev task                       | 0     | ✅ done                     |
| 5   | **Enh 3** remove verify+hashing (D1) | 1     | ✅ **done (S3)**            |
| 6   | **Bug 6** thumbnails (D5)            | 2     | ✅ **done (S3)**            |
| 7   | **Bug 8 + Enh 1** 3-min gate (D6)    | 3     | 🟡 **NEXT — §3**            |
| 8   | Bug 3 location (D3/D4) 🔴            | 3     | ⬜ consent/DPIA before SHIP |
| 9   | Bug 4 multi-device (D2) 🔴           | 4     | ⬜                          |
| 10  | Bug 5 practice-done (D7)             | 4     | ⬜                          |
| 11  | Bug 7 History live                   | 5     | ⬜                          |
| 12  | Bug 11 stats auto-update             | 5     | ⬜                          |
| 13  | Bug 10 Profile slow                  | 5     | ⬜                          |
| 14  | Spec/doc updates (plan §8, D1 docs)  | —     | ⬜ deferred, non-code       |
