# Handoff — Session 2 (2026-06-04) — Enh 3 / Phase 1 in progress

Resume doc for the **second** execution session of `IMPLEMENTATION-PLAN-260604.md`.
Read the originals first for full context — this doc only records **what Session 2
changed, what's left, and the exact remaining edits**:

1. `HANDOFF-260604.md` — the session-1 resume doc (env, verify commands, decisions, phase map).
2. `IMPLEMENTATION-PLAN-260604.md` — source-of-truth plan (11 bugs + 3 enh, D1–D8, §6, §7).
3. `.planning/260604-locked-override-signoff.md` — owner sign-off (D1/D2/D3/D6 APPROVED).
4. `CLAUDE.md` — project constraints.

> **GSD is bypassed.** Owner authorized editing the repo directly. Do NOT invoke GSD.
> **Working branch:** `fix/bugs-enhancements-260604`. **Nothing committed.** Commit/push
> ONLY when the owner asks.

---

## 0. Verify loop (unchanged from session 1)

| What                         | Command                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile typecheck             | `cd apps/mobile && npx tsc --noEmit`                                                                                                                                                        |
| Mobile tests                 | `cd apps/mobile && node_modules/.bin/vitest run [path]`                                                                                                                                     |
| API typecheck                | `cd apps/api && npx tsc --noEmit`                                                                                                                                                           |
| API tests                    | `zsh /tmp/runapi.sh [path]`                                                                                                                                                                 |
| Kotlin tests                 | `zsh /tmp/runkt.sh` (whole `:app:testApkRolloutDebugUnitTest`)                                                                                                                              |
| Kotlin **main** compile only | `cd apps/mobile/android && ANDROID_HOME="$HOME/Library/Android/sdk" JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ./gradlew :app:compileApkRolloutDebugKotlin` |

`/tmp/runapi.sh` + `/tmp/runkt.sh` exist (contents in `HANDOFF-260604.md` §6). Docker is up
(postgres/redis/localstack healthy). Rebuild `shared/types` (`cd shared/types && npm run build`)
after any edit there.

**zsh gotcha:** `grep --include=*.kt` fails in zsh — use `grep -rn PATTERN dir` (no `--include`).
**Edit-after-sed gotcha:** after you `sed -i` a file, the Edit tool needs a fresh `Read` of that
file before it will Edit it again ("File has been modified since read").

---

## 1. Status as of end of Session 2

| What                                      | State                                                                |
| ----------------------------------------- | -------------------------------------------------------------------- |
| **Phase 0** (Bugs 1,2,9 + Enh 2)          | ✅ done+verified (session 1)                                         |
| **Enh 3 (A) Mobile Kotlin source**        | ✅ **DONE — `:app:compileApkRolloutDebugKotlin` = BUILD SUCCESSFUL** |
| **Enh 3 (B) Kotlin tests**                | 🟡 **~90% done — only `UploadCoordinatorTest.kt` left** (see §3)     |
| **Enh 3 (C) API tests**                   | ❌ NOT started — `apps/api` vitest still RED                         |
| **Enh 3 (D) Infra reap**                  | ❌ NOT started (fast-follow)                                         |
| **Enh 3 (E) i18n `uploadChip.verifying`** | ❌ NOT started (optional)                                            |
| Mobile vitest (TS)                        | ✅ green — untouched this session (146 files / 1023 tests)           |
| API vitest                                | ❌ RED (test cleanup pending — part C)                               |
| Phases 2–5                                | ⬜ not started                                                       |

**Immediate next task:** finish `UploadCoordinatorTest.kt` (§3) → `zsh /tmp/runkt.sh` green →
then (C) API tests → (D) infra → Phases 2-5 in `IMPLEMENTATION-PLAN-260604.md` §7 order.

---

## 2. What Session 2 changed (Enh 3 — uploaded=terminal, all hashing removed)

### (A) Mobile Kotlin SOURCE — ✅ done, compiles

Core semantic: **`/finalize` 200 is terminal success** → the coordinator **deletes the local
bundle (mp4/csv/json, NOT the thumbnail) + drops the queue row** inline. No `AWAITING_VERIFY` /
`VERIFIED` wait state. `reupload` flow fully removed. All SHA-256 removed.

- **`upload/UploadModels.kt`** — `UploadState` enum trimmed to `PENDING, UPLOADING, FINALIZING,
DEAD_LETTER, NEEDS_ATTENTION`. Removed `reupload: Boolean` field + `reuploadIdempotencyKey`
  field + their toJson/fromJson. Now **3** per-route idempotency keys (init/parts/finalize).
- **`upload/UploadQueueStore.kt`** — `markVerifiedAndDeleteLocal` → **`deleteLocalAndRemove`**
  (deletes mp4/csv/json + drops row, keeps thumbnail). `bootstrap` simplified (VERIFIED
  housekeeping removed).
- **`upload/HumynUploadModule.kt`** — `clearVerified` @ReactMethod → **`clearUploaded`** (calls
  `deleteLocalAndRemove`); **deleted the `reupload` @ReactMethod**; removed
  `putBoolean("reupload"…)` from `rowToMap`; cleaned `reviveDeadLetter` doc (dropped `[reupload]`
  refs). `reviveDeadLetter` + `retryNeedsAttention` KEPT.
- **`upload/UploadCoordinator.kt`** — added private `completeAndCleanup(row, why)` helper
  (deletes bundle via `queueStore.deleteLocalAndRemove` + emits). `uploadOne` finalize-tail and
  the FINALIZING-reconcile path both call it (on server `qa_status` ∈ {uploaded, verified}).
  Removed the `row.reupload` init-dispatch branch + `wasReupload`; `when` is now
  `row.uploadId != null -> postRePresign else -> postInit`. Deleted `postReupload()`. Removed
  `fileSha256`/`imuSha256` from the `/init` body in `postInit`. `isEligibleForAutomaticDrain` /
  `queueHasWork` no longer reference AWAITING_VERIFY/VERIFIED. Doc cleanups throughout.
- **`capture/MetadataComposer.kt`** — `CURRENT_SCHEMA_VERSION` **`1.3.0` → `1.4.0`**; removed
  `file_sha256`/`imu_sha256` from `compose()` + removed `mp4Sha`/`csvSha` from `FinalizeMetrics`.
- **`capture/FinalizeWorker.kt`** — removed the `HashStreamer.sha256(...)` calls + the
  `mp4Sha`/`csvSha` args to `FinalizeMetrics`; header/inline comments updated (steps still
  numbered 2.. for parity).
- **`capture/ThumbnailExtractor.kt`** — comment fix (dropped the `HashStreamer` sibling ref).
- **DELETED `capture/HashStreamer.kt`.**
- ⚠ **KEPT `AppFlavorModule.sha256First16Hex`** (compat-signature fingerprint) and the
  `lru-cache` dep (D2). Do NOT remove.

### (B) Kotlin TESTS — done so far

- **DELETED:** `capture/HashStreamerTest.kt`, `upload/HumynUploadModuleReuploadTest.kt`,
  `capture/FileFidelityTest.kt` (was 100% `HashStreamer.sha256` tests — its only purpose was the
  deleted hashing util; it never exercised the capture pipeline's re-encode path, so deleting it
  loses no CAP-18 pipeline coverage).
- **Created** `app/src/test/resources/video_metadata_v1_4_0_template.json` (copy of `1_3_0`
  minus `file_sha256`/`imu_sha256`, `schema_version` = "1.4.0").
- **Edited:** `MetadataSchemaConformanceTest.kt` (fixture sha removed; `loadTemplate` → `1_4_0`;
  version asserts 1.3.0→1.4.0; test name `…is 1_4_0`; header doc), `MetadataComposerLiteralsTest.kt`
  - `StartGateCarryoverTest.kt` (dropped `mp4Sha`/`csvSha` fixture args),
    `ThumbnailExtractorTest.kt` (comment), `UploadQueueStoreTest.kt`
    (`markVerifiedAndDeleteLocal`→`deleteLocalAndRemove`; deleted the now-dead
    `bootstrap drops verified rows…` test; "four keys"→"three keys" everywhere; dropped all
    `reuploadIdempotencyKey` refs).
- **`UploadCoordinatorTest.kt`** — partially done: removed the `reuploadCalls` counter + the
  `/reupload` MockWebServer dispatcher block + the `file_sha256`/`imu_sha256` keys in
  `writeBundle`; reworked T1 (happy path → asserts row dropped + bundle files deleted), T2
  (CR-03 serial → row dropped), T3 (re-drain /parts → row dropped); removed three of four
  `it.reupload = false` setup lines (12-space ones); **deleted T4** (`reupload drain clears the
reupload flag…` — its /parts coverage duplicates T3). **The rest of this file is §3.**

---

## 3. EXACT remaining edits in `UploadCoordinatorTest.kt` ← DO THIS FIRST

The file currently still references removed symbols, so it WON'T compile until these are done.
Apply each (anchor by the quoted text — line numbers drift). After all of them:
`zsh /tmp/runkt.sh` and fix any straggler, then re-grep (step 11).

**3.1** — comment in the init+finalize idempotency test:
`// /init + /finalize fired on this happy path; /parts and /reupload didn't.`
→ `// /init + /finalize fired on this happy path; /parts didn't.`

**3.2** — test `LOCAL reset of a client-side DEAD_LETTER row routes to slash parts not slash reupload Wave-1-5 Item 2`:

- delete the remaining setup line (16-space indent, inside `store.upsert(store.read()[0].also {`):
  `                it.reupload = false`
- delete the assertion line:
  `        assertEquals("LOCAL-reset drain does NOT call /reupload", 0, reuploadCalls.get())`
- replace the end block:
  ```
  // Row ends AWAITING_VERIFY; uploadId preserved across the drain.
  val back = store.read().first()
  assertEquals(UploadState.AWAITING_VERIFY, back.state)
  assertEquals("VID-UPLOAD-ID", back.uploadId)
  assertEquals("IMU-UPLOAD-ID", back.imuUploadId)
  ```
  →
  ```
  // Enh 3 / D1 — finalize 200 dropped the row (the /finalize body above proves
  // the original upload ids were preserved through the /parts re-presign).
  assertTrue("row dropped after finalize 200", store.read().isEmpty())
  ```
  (optional cleanliness: the test name + its top comment still mention the removed
  `HumynUpload.reupload`; only in comments so it compiles — rename to e.g.
  `…routes to slash parts (reviveDeadLetter outcome)` if you want.)

**3.3** — test `Wave-2 #5 - a transient on slash init triggers the bounded in-loop retry then succeeds`:

- delete: `        assertEquals("zero /reupload", 0, reuploadCalls.get())`
- replace end:
  ```
  // Row reached AWAITING_VERIFY — proof the retry took the happy path.
  assertEquals(UploadState.AWAITING_VERIFY, store.read().first().state)
  ```
  →
  ```
  // Row was dropped after finalize 200 — proof the retry took the happy path.
  assertTrue("queue empty after the retried happy path", store.read().isEmpty())
  ```

**3.4** — test `Wave-2 #7 - happy-path drain emits onQueueChanged on UPLOADING and FINALIZING transitions`:
replace the final assertion block:

```
// The captured snapshot states must include the two transitions Wave-2
// #7 hinges on, in order, before the terminal AWAITING_VERIFY emit.
val uploadingIdx = seen.indexOf(UploadState.UPLOADING)
val finalizingIdx = seen.indexOf(UploadState.FINALIZING)
val awaitingIdx = seen.indexOf(UploadState.AWAITING_VERIFY)
assertTrue("emitQueueChanged fired with state=UPLOADING (so JS flips isActive=true and renders the progress bar). Seen: $seen", uploadingIdx >= 0)
assertTrue("emitQueueChanged fired with state=FINALIZING (so the bar drops cleanly before AWAITING_VERIFY). Seen: $seen", finalizingIdx >= 0)
assertTrue("emitQueueChanged fired with state=AWAITING_VERIFY (the row's terminal in-queue state). Seen: $seen", awaitingIdx >= 0)
assertTrue("UPLOADING emit comes before FINALIZING. Seen: $seen", uploadingIdx < finalizingIdx)
assertTrue("FINALIZING emit comes before AWAITING_VERIFY. Seen: $seen", finalizingIdx < awaitingIdx)
```

→

```
// Two in-queue transitions Wave-2 #7 hinges on, in order. (Enh 3 / D1: the
// terminal emit fires AFTER the row is dropped, so it never appears in `seen`.)
val uploadingIdx = seen.indexOf(UploadState.UPLOADING)
val finalizingIdx = seen.indexOf(UploadState.FINALIZING)
assertTrue("emitQueueChanged fired with state=UPLOADING (so JS flips isActive=true and renders the progress bar). Seen: $seen", uploadingIdx >= 0)
assertTrue("emitQueueChanged fired with state=FINALIZING (so the bar drops cleanly). Seen: $seen", finalizingIdx >= 0)
assertTrue("UPLOADING emit comes before FINALIZING. Seen: $seen", uploadingIdx < finalizingIdx)
assertTrue("row dropped after finalize 200 (terminal-success cleanup)", store.read().isEmpty())
```

**3.5** — test `four distinct keys across init parts finalize reupload (no cross-route reuse)`:
rework to THREE routes — rename the fn to
`three distinct keys across init parts finalize (no cross-route reuse)` and replace the whole body
with (drops the r3/`/reupload` row, the `reuploadKey`, and `reuploadIdempotencyKey`; 4→3):

```kotlin
    @Test
    fun `three distinct keys across init parts finalize (no cross-route reuse)`() {
        // Drive a row through /init → /finalize (happy path) and a separate row
        // through a re-drain → /parts. Capture the three route-keyed Idempotency-
        // Keys and assert all 3 are distinct UUIDv4s, one per route. (Enh 3 / D1:
        // the /reupload route is gone.)
        val uuidV4 = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

        val r1 = row("01JCOORDIDEM4XXXXXXXXXXXXXX")
        store.enqueue(r1)
        coordinator().drainNow()
        val initKey = idempotencyKeysByPath["/recordings/init"]
        val finalizeKey = idempotencyKeysByPath["/finalize"]

        idempotencyKeysByPath.clear()
        val r2 = row("01JCOORDIDEM5XXXXXXXXXXXXXX").also {
            it.uploadId = "VID-UPLOAD-ID"
            it.imuUploadId = "IMU-UPLOAD-ID"
            it.partsCount = 2
            it.chunkBytes = WIFI_CHUNK_BYTES
            it.videoParts.add(PartState(1, PartStatus.DONE, etag = "\"e1\""))
            it.videoParts.add(PartState(2))
            it.imuParts.add(PartState(1))
        }
        store.enqueue(r2)
        coordinator().drainNow()
        val partsKey = idempotencyKeysByPath["/parts"]

        assertNotNull("/init key captured", initKey)
        assertNotNull("/parts key captured", partsKey)
        assertNotNull("/finalize key captured", finalizeKey)
        listOf(initKey, partsKey, finalizeKey).forEach {
            if (it != null) assertTrue("UUIDv4 shape: $it", uuidV4.matches(it))
        }
        val captured = listOfNotNull(initKey, partsKey, finalizeKey)
        assertEquals("three distinct keys across the three routes", captured.size, captured.toSet().size)
        listOf(r1, r2).forEach { r ->
            val perRow = setOf(r.initIdempotencyKey, r.partsIdempotencyKey, r.finalizeIdempotencyKey)
            assertEquals("row ${r.recordingId} has 3 distinct per-route keys", 3, perRow.size)
        }
    }
```

**3.6** — test `Fix C item 3 — FINALIZING row reconciles when server qa_status is verified, no re-finalize POST`:

- comment `// coordinator should mark the row AWAITING_VERIFY locally and skip the`
  → `// coordinator should delete the bundle + drop the row (terminal success) and skip the`
- end:
  ```
  val back = store.read().first { it.recordingId == rec }
  assertEquals(UploadState.AWAITING_VERIFY, back.state)
  ```
  →
  ```
  assertTrue("row dropped after the FINALIZING reconcile", store.read().none { it.recordingId == rec })
  ```

**3.7** — test `Fix C item 3 — FINALIZING row falls through to re-finalize when server qa_status is still pending`:

- end:
  ```
  // Row moved through FINALIZING → AWAITING_VERIFY (the re-finalize succeeded).
  val back = store.read().first { it.recordingId == rec }
  assertEquals(UploadState.AWAITING_VERIFY, back.state)
  ```
  →
  ```
  // Row moved FINALIZING → finalize 200 → dropped (the re-finalize succeeded).
  assertTrue("row dropped after the re-finalize succeeded", store.read().none { it.recordingId == rec })
  ```

**3.8** — test `Fix C item 2 — finalize watchdog fires on a hung server, surfaces as transient`:
comment only — `// Row stayed FINALIZING (not VERIFIED, not DEAD_LETTER) — the watchdog`
→ `// Row stayed FINALIZING (not dropped, not DEAD_LETTER) — the watchdog`.
(The `assertEquals(UploadState.FINALIZING, back.state)` STAYS — finalize never succeeds here, so
the row is NOT dropped. No functional change.)

**3.9** — test `Fix C item 4 — retryNeedsAttention resets state and counter` ⚠ **subtle**:
`retryNeedsAttention` resets the row synchronously then kicks an **async** `drain()`, so by the
read the row may already be finalized + **dropped**. Change `.first {…}` → `.firstOrNull {…}` and
guard. Also fix the comment `…UPLOADING → FINALIZING → AWAITING_VERIFY…` → `…→ dropped…`.

```
val back = store.read().first { it.recordingId == rec }
assertEquals(0, back.attemptCount)
assertNull(back.lastFailureState)
assertNull(back.lastFailureReason)
assertNotEquals(UploadState.NEEDS_ATTENTION, back.state)
```

→

```
// retry kicks an async drain(); by now the row may be mid-flight with markers
// reset OR already finalized + dropped (Enh 3 / D1). `ok == true` above already
// proves the synchronous reset out of NEEDS_ATTENTION.
val back = store.read().firstOrNull { it.recordingId == rec }
if (back != null) {
    assertEquals(0, back.attemptCount)
    assertNull(back.lastFailureState)
    assertNull(back.lastFailureReason)
    assertNotEquals(UploadState.NEEDS_ATTENTION, back.state)
}
```

**3.10** — test `Fix C item 1 — drainNow with parallelism=2 dispatches two rows concurrently`:

- comment `…CAN assert that BOTH rows progressed to AWAITING_VERIFY` → `…that BOTH rows drained + dropped`
- end:
  ```
  val all = store.read()
  assertEquals(2, all.size)
  all.forEach { r ->
      assertEquals("row ${'$'}{r.recordingId} drained end-to-end", UploadState.AWAITING_VERIFY, r.state)
  }
  ```
  →
  ```
  // Both rows finalized 200 and were dropped (terminal success).
  assertTrue("both rows drained end-to-end and were dropped", store.read().isEmpty())
  ```

**3.11** — final sweep: `cd apps/mobile/android` then
`grep -rnE "AWAITING_VERIFY|UploadState.VERIFIED|reupload|markVerified|clearVerified|HashStreamer|file_sha256|imu_sha256|mp4Sha|csvSha" app/src` —
expect only intentional historical-comment mentions in **main** source (e.g.
"…the former step 1 — SHA-256… is removed", "AWAITING_VERIFY / VERIFIED wait state — … removed").
Then `zsh /tmp/runkt.sh` until green.

---

## 4. After Kotlin is green — remaining Enh 3 work

**(C) API tests** (`apps/api` vitest is RED) — per `IMPLEMENTATION-PLAN-260604.md` §6.8 +
`HANDOFF-260604.md` §3(C):

- **Delete:** `test/lib/queue.test.ts`, `test/lib/sha256-stream.test.ts`,
  `test/workers/verify-recording.test.ts`, `test/workers/sqs-poller.test.ts`,
  `test/plugins/events-outbox.test.ts`, `test/routes/recordings/verified-ids.test.ts`,
  `test/routes/recordings/reupload.test.ts`.
- **Edit** (drop `verified`/`hash-mismatch`/`_events`/sha; `uploaded`=success):
  `test/lib/recording-state.test.ts`, `test/routes/recordings-finalize.test.ts`,
  `test/routes/contributions.test.ts`, `test/routes/contributions-timeseries.test.ts`,
  `test/routes/recordings-{get,list,init,stream-url,reject}.test.ts`,
  `test/routes/recordings/{init,parts}.test.ts`,
  `test/e2e/{golden-path,recordings-list-negatives,setup}.test.ts` +
  `test/e2e/helpers/seed-fixtures.ts`.
- Verify: `zsh /tmp/runapi.sh`. (Source + migration 0011 already done in session 1; the source
  typecheck is already green.)

**(D) Infra reap** (fast-follow) — `docker-compose.yml` `redis` service, `.env.example`
`REDIS_URL`, `infra/terraform/modules/{verify-queue,redis}/`,
`infra/terraform/envs/prod/main.tf` (`module "redis"` + `module "verify_queue"`). `buildspec.yml`
unchanged.

**(E)** optional: remove unused `uploadChip.verifying` i18n key from all 8 locales.

---

## 5. LOCKED decisions to keep consistent (already applied — match these)

- `uploaded` = terminal success. `qa_status` enum KEEPS legacy `verified`/`hash-mismatch` values
  (nothing writes them); read paths treat `uploaded` OR `verified` as success.
- `clearVerified`→`clearUploaded` (`deleteLocalAndRemove`: unlink mp4/csv/json + drop row,
  **keep thumbnail**). `reupload` (method + `/reupload` endpoint) REMOVED; dead-letter Retry →
  `reviveDeadLetter`. `reviveDeadLetter` + `retryNeedsAttention` KEPT.
- On `/finalize` 200 the device deletes the **bundle (mp4/csv/json), NOT the thumbnail**.
- Metadata schema: Enh 3 → **1.4.0**; Bug 3 (Phase 3) later → 1.5.0 (location).
- KEEP `lru-cache` (D2) + `AppFlavorModule.sha256First16Hex` (compat fingerprint).

---

## 6. Then: remaining phases (full detail in `IMPLEMENTATION-PLAN-260604.md` §2–§7)

Track all 14 items as a TaskList (Phase 0 + Enh 3 = done once C/D land). Order:

- **Phase 2 — Bug 6 thumbnails (D5):** server poster JPEG at `/finalize` →
  `recordings/{userId}/{recordingId}/thumb.jpg`; `recordings.s3_key_thumbnail` col + migration;
  signed `thumbnail_url` in list/get + shared type; `HistoryRow` remote fallback; ffmpeg in API image.
- **Phase 3 — Bug 8+Enh 1 (3-min gate, D6):** `FinalizeWorker` `CancelReason.TooShort`
  (`MIN_SEGMENT_MS=180_000`, non-practice), `'too_short'` reason+copy, `RecordingScreen.tsx`
  `60_000`→`180_000`, StopConfirmModal "(LOCKED)"→"3 minutes". **Drop trailing <3-min segment.**
  · **Bug 3 location 🔴** (precise GPS; manifest FINE; remove `verify-merged-manifests.sh` gate;
  `HumynLocation` native module; schema **1.4.0→1.5.0**; `recordings.location jsonb`;
  PermissionsScreen gate). **Consent-text + DPIA must land before SHIP.**
- **Phase 4 — Bug 4 (multi-device newest-wins, D2 🔴):** `installationId` on sign-in + JWT claim +
  `users.current_installation_id` + requireAuth 401 (LRU-cached). · **Bug 5 (practice-done, D7).**
- **Phase 5 (after Phase 1) — Bug 7 / Bug 11 / Bug 10:** single app-lifetime upload-queue store +
  `contributionsVersion` in `appStore`; Profile `Promise.allSettled` + deadline + focus refetch;
  backend `recordings_user_qa_idx` + pg pool timeouts + concurrent queries.
