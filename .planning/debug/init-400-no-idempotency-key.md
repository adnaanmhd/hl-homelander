---
status: fix_applied_awaiting_on_device_verify
trigger: 'Third 400 root cause on the same Phase-5 on-device UAT symptom (`POST /recordings/init -> 400` dead-loop in HumynUploadCoord). Sessions 1+2 fixed two genuine latent bugs (`debug-task-id-init-400` — DEBUG_TEST_TASK.taskId was a 23-char slug; `init-400-capturedat-offset` — server `z.string().datetime()` rejected the device''s `+05:30` offset) but neither moved the needle on-device because the 400 was always firing earlier than zod, at the global idempotency pre-handler hook (`apps/api/src/plugins/idempotency.ts:27`). Native `UploadCoordinator.kt:430-437` `authedJsonRequest()` only sets `Authorization` + `Content-Type` — no `Idempotency-Key`. The API''s `apps/api/src/plugins/idempotency.ts` rejects every POST/PATCH without an `Idempotency-Key: <UUIDv4>` header → `{type: .../idempotency-key-invalid, title: "Idempotency-Key required", status: 400}`. Confirmed via host-side curl with the device''s exact body: same body 400s without the header, returns 201 with a fresh UUIDv4 header. The 2026-05-13 backend automated probe passed `/recordings/init` because any curl/Postman/test fixture routinely mints a UUIDv4 header; the device''s native module never has. The fix: `UploadCoordinator.kt` must mint a stable UUIDv4 per row at enqueue, persist it (the queue row already JSON-serializes everything that survives a process kill; add an `idempotencyKey` field), and send it as `Idempotency-Key` on every POST (`/init`, `/reupload`, `/parts`, `/finalize`). Reuse the same key on retries — that''s exactly what makes the idempotency hook idempotent: same key + same body → same 201 cached response; same key + different body → 409 conflict. Touched route POSTs to check while we''re in there: `/recordings/init`, `/recordings/:id/parts`, `/recordings/:id/finalize`, `/recordings/:id/reupload`. The PUTs to S3 (presigned) don''t hit the API → no header needed there. Stuck row currently in DB: `01KRFXGAWCMVQ89PJ2PBXSVAKK` (planted server-side by my curl repro; state pending; s3UploadId real). When the native fix lands, the next drain hits the CR-02 SELECT-first idempotent `/init` path and returns the SAME uploadId — a free bonus CR-02 check beyond just the header fix. Dev stack up (humyn-postgres / humyn-redis / humyn-localstack); API on :8080 PID 75858 cwd apps/api; hash-verify worker running; Pixel 10a connected (Metro + adb reverse 8080/8081 set). On-device queue.json has `recordingId=01KRFXGAWCMVQ89PJ2PBXSVAKK, taskId=01HVDEVSEEDTASK00000000000, isPractice:false, state:PENDING`, local triple present (mp4 77 MB, csv 3.6 MB, json 2.3 KB). User has chosen the gsd-debug path (third session in a row); pattern is consistent.'
created: 2026-05-13T05:45:00Z
updated: 2026-05-13T07:15:00Z
---

## Symptoms

- **Expected behavior:** After the prior two session fixes (`debug-task-id-init-400` + `init-400-capturedat-offset`), a non-practice recording auto-enqueued via the `__DEV__` Tasks-tab long-press should produce `POST /recordings/init → 201` and the full §2 upload-smoke happy path should run (parts PUT → finalize → enqueueVerify → hash-verify worker → `qa_status='verified'` → `_events: verified` → native unlinks local triple → row disappears from queue).
- **Actual behavior:** Recording → toast → Home all fine. Auto-enqueue fine (queue.json + owner-pin + local triple all good; `taskId=01HVDEVSEEDTASK00000000000` valid). But `POST /recordings/init` still returns 400 on every drain — third blocker on the same symptom.
- **Error messages:** Device logcat: `W/HumynUploadCoord: row 01KRFXGAWCMVQ89PJ2PBXSVAKK upload failed transiently: /recordings/init -> 400` (repeated). Server-side problem-detail (captured via host curl):
  ```json
  {
    "type": "https://humyn-app.io/problems/idempotency-key-invalid",
    "title": "Idempotency-Key required",
    "status": 400,
    "detail": "POST/PATCH requests must include an Idempotency-Key header (UUIDv4)",
    "instance": "<reqId>"
  }
  ```
- **Timeline / ever worked:** Never worked on-device. Phase 5's backend automated probe on 2026-05-13 passed `/recordings/init` (201) because the probe was a synthetic HTTP call that routinely set an `Idempotency-Key` header (any non-native HTTP client does). The native `UploadCoordinator.kt` was never wired to mint or send the header. The 400 has been the ACTUAL gate for every prior session — the taskId-length and capturedAt-offset 400s were both _downstream_ failures that would have fired had the request ever reached zod, but they never did.
- **Reproduction:** Trivial. Host-side curl with the device's exact body:
  ```sh
  TOKEN=$(npx --yes tsx -e "import jwt from 'jsonwebtoken'; console.log(jwt.sign({sub:'01KRFP7GNG8A650PXAD8HPCGTH', flavor:'apkRollout'}, process.env.JWT_SIGNING_SECRET, {algorithm:'HS256', expiresIn:'5m'}));")
  # without header → 400 Idempotency-Key required
  curl -X POST localhost:8080/recordings/init -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @/tmp/init-body.json
  # with header → 201 with full presigned-URL response
  curl -X POST localhost:8080/recordings/init -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: $(uuidgen | tr A-F a-f)" --data @/tmp/init-body.json
  ```

## Root cause (confirmed)

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:430-437`:

```kotlin
private fun authedJsonRequest(url: String, bodyJson: JSONObject): Request {
    val token = getBearerToken()
    return Request.Builder()
        .url(url)
        .post(bodyJson.toString().toRequestBody("application/json".toMediaTypeOrNull()))
        .apply { if (!token.isNullOrBlank()) header("Authorization", "Bearer $token") }
        .build()
}
```

No `Idempotency-Key` header. Server-side `apps/api/src/plugins/idempotency.ts` (registered globally — every POST/PATCH route picks it up) rejects with 400 before `requireAuth` even runs (the hook ordering verifies — surface a real reqId to be doubly sure). UUIDv4 validator at `apps/api/src/lib/idempotency-store.ts:11` (`isValidIdempotencyKey`).

### Fix (recommended)

1. **`UploadRow` (Kotlin data class) + `UploadQueueStore` JSON schema:** add `idempotencyKey: String` field. Mint a UUIDv4 (e.g. `java.util.UUID.randomUUID().toString()`) at row construction time in `HumynUploadModule.enqueue()` (one key per upload row; reused across all `/init`/`/reupload`/`/parts`/`/finalize` POSTs for that row over its lifetime — that's the right semantics: a re-`/init` on the same row should hit the server-side idempotency cache and return the SAME response, which is precisely what `apps/api/src/routes/recordings/init.ts`'s SELECT-first guard (CR-02) is designed for).
2. **`UploadQueueStore.toJson()` / `.fromJson()`:** serialize/deserialize the new field so it survives process kill. For existing rows missing the field on disk (the currently-stuck `01KRFXGAWCMVQ89PJ2PBXSVAKK`), assign a fresh UUID on load (logs a warn, one-shot).
3. **`UploadCoordinator.kt::authedJsonRequest`:** accept an `idempotencyKey: String?` arg (nullable so non-POST callers don't have to pass it, or split into a separate `authedPostRequest` builder). Append `.header("Idempotency-Key", key)` when non-null. Wire from each caller (`postInit`, `postReupload`, `postRePresign`, `postFinalize`) to pass `row.idempotencyKey`.
4. **Server-side: nothing.** The contract is correct.

### What happens to the stuck row when the fix lands?

The currently-stuck row `01KRFXGAWCMVQ89PJ2PBXSVAKK` was planted server-side by the host-curl repro (state `pending`, `s3UploadId` real). The device's queue row for the same recordingId is locally still PENDING with no `videoParts`/`imuParts`. With the fix:

- On-device `/init` retry with a freshly-minted (one-shot warn) UUIDv4 → server SELECT-first guard hits (`existing.userId === userId && existing.qaStatus === 'pending' && existing.s3UploadId != null`) → returns 200 with the SAME `uploadId` (CR-02 idempotent `/init` re-presign). That's the bonus CR-02 verification.
- Parts proceed; `/finalize` lands; worker re-hashes; `qa_status='verified'`; `_events: verified`; local triple deleted; row disappears.
- §2 acceptance can then be ticked.

## Adjacent gaps to log (separate cosmetic-gaps file, NOT in scope for this session)

Per the prior session's `05-COSMETIC-GAPS.md` (already in repo at `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-COSMETIC-GAPS.md`):

- **Cold-start drain on a stale queue.** On force-stop+relaunch with a row already in queue.json, the coordinator never auto-drains it. JS `installUploadReconcile()` boot path calls `pushUploadContext()` (without `resume:true`); only `enqueue`, `appStore.jwt` change, RecordingScreen `resume()`, or a Pending-Uploads-screen Retry tap kicks the coordinator. Means a force-quit recovery on a NON-pristine boot waits for one of those four events. Real-ish gap; surfaced live in this walk. (Cosmetic-bucket because the canonical Phase-5 happy path — enqueue immediately after stop — does trigger drain; this is the "pre-existing-stale-row on cold boot" edge.)
- **Silent API log.** `/tmp/humyn-api.log` for the listener PID 75858 doesn't capture live request log lines despite `lsof` showing FD 1/2 → that file. Per the prior session: `apps/api/src/plugins/logger.ts` uses a pino worker-thread transport in dev (worker stdout ≠ parent fd 1). Two fix candidates recorded.
- **User's two UX nits** (already in 05-COSMETIC-GAPS.md from session 2):
  1. Contribution toast killed by RecordingScreen→Home transition; survives < 1 s.
  2. Tapping a Home pending-upload row opens orphan Pending Uploads screen with no back nav / no tab bar — should route to History tab.

## Current Focus

hypothesis: "UploadCoordinator.kt::authedJsonRequest doesn't set Idempotency-Key; the API's global idempotency pre-handler rejects every POST/PATCH without a valid UUIDv4 in that header. Fix = mint UUIDv4 per UploadRow at enqueue, persist to queue.json, send via header on every POST, reuse on retries."
test: "After applying the fix and rebuilding the apkRolloutDebug APK: trigger a drain on the existing on-device stuck row `01KRFXGAWCMVQ89PJ2PBXSVAKK` (or any drain trigger — RecordingScreen visit / new enqueue / app re-foreground). Observe `/recordings/init -> 200` (NOT 201 — CR-02 idempotent path on the already-pending row I planted server-side) with SAME `s3UploadId` as the planted row → parts PUT → finalize → enqueueVerify → worker `verified` → `_events: verified` → native unlinks local triple → row disappears."
expecting: "Header `Idempotency-Key: <uuidv4>` present on every POST in logcat (verify with `adb shell` tcpdump-equivalent OR by checking the API log once it's tail-able OR by reading the new outgoing-Request log in UploadCoordinator). /init returns 200 (CR-02 path). Round-trip lands."
next_action: "Sweep `UploadCoordinator.kt` for ALL POST sites (postInit, postReupload, postRePresign, postFinalize, plus any uploadParts-call POSTs if any exist), add the idempotencyKey field to UploadRow + queue.json (de)serialization + migration-on-load for existing rows, wire the header, ship + rebuild."

## Evidence

- timestamp: 2026-05-13T05:43:00Z — Host curl repro 1 (NO header), device's exact body:
  ```
  Idempotency-Key: <absent>
  Authorization: Bearer <minted JWT, sub=01KRFP7GNG8A650PXAD8HPCGTH, flavor=apkRollout>
  Content-Type: application/json
  Body: {recordingId:01KRFXGAWCMVQ89PJ2PBXSVAKK, taskId:01HVDEVSEEDTASK00000000000, practice:false, partsCount:16, durationMs:80785, fileSha256:d788...a520, imuSha256:4b81...b36a, fileSizeBytes:77106662, imuSizeBytes:3668954, capturedAt:"2026-05-13T11:08:41.169451+05:30"}
  Response: HTTP 400, type=.../idempotency-key-invalid, title="Idempotency-Key required"
  ```
- timestamp: 2026-05-13T05:43:30Z — Host curl repro 2 (WITH header `Idempotency-Key: 9f9856b6-6f8c-4ad1-8b70-a2c1c30ed902`), same body:
  ```
  Response: HTTP 201, with full presigned URL response (16 video parts, 16 imu parts, metadata, expiresAt: 2026-05-13T05:56:58.607Z)
  recordingId=01KRFXGAWCMVQ89PJ2PBXSVAKK
  uploadId=SKjiv-oDTHaJGfejEVPTNqDJp6pkWgP-6BobpL-pBddXv8qynX25SKtJODt8jmUDdXMvSiNojKSr3AD_NzT7SFAkGCQt713bCqVPE-_IolFVXT5lu6UWN3JLU6A-QmY4
  imuUploadId=M7lb-NFBYpmKJq_jq_U1FJacc-nhxfTl5wBU5k1oOViFwWqa1_ccb5ypgArCwm1d1SBDgB4UjaHN0iZxhAA0fMTY5joSYXZEZ7DFtPFHP6M-PNh1XpmLENg9Y0S2Ys8G
  ```
  Server-side row `recordings.id = 01KRFXGAWCMVQ89PJ2PBXSVAKK` now exists (qa_status pending) with that real s3UploadId — planted by this repro, ready for the device's CR-02 idempotent-`/init` retry once the fix lands.
- timestamp: 2026-05-13T05:43:00Z — `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt:430-437` shows `authedJsonRequest` builder sets `Authorization` + `Content-Type` only; no `header("Idempotency-Key", ...)`.
- timestamp: 2026-05-13T05:43:00Z — `apps/api/src/plugins/idempotency.ts:6` defines `HEADER = 'idempotency-key'`; `apps/api/src/lib/idempotency-store.ts:11` defines the UUIDv4 validator. The plugin is registered globally (verify in `apps/api/src/app.ts`).
- timestamp: 2026-05-13T05:43:00Z — Schema fix from session 2 (`shared/types/src/recording.ts:38` capturedAt offset:true) and taskId fix from session 1 (mobile DEBUG_TEST_TASK.taskId = `01HVDEVSEEDTASK00000000000`) BOTH confirmed live: host-side `safeParse` of the device's exact body passes (`success: true`), and the curl-with-header gets 201, proving every other field is fine. The remaining 400 IS exclusively the idempotency header.

## Eliminated

- hypothesis: "taskId 23-char slug fails zod" — eliminated, session 1 fixed.
- hypothesis: "capturedAt offset rejected by zod" — eliminated, session 2 fixed (and proven by host-side safeParse of the device's exact body returning success:true).
- hypothesis: "metadata.json malformed / SHA / size mismatch / etc." — eliminated, full host-side safeParse over device's exact body passes; curl-with-header returns 201.

## Resolution

**Root cause:** Native `UploadCoordinator.authedJsonRequest()` never set the `Idempotency-Key` header. The API's global idempotency pre-handler (`apps/api/src/plugins/idempotency.ts`) rejected every POST/PATCH without a UUIDv4 in that header with HTTP 400 `{type: .../idempotency-key-invalid, title: "Idempotency-Key required"}` before validation / requireAuth could run. Confirmed by two host-side curl repros: same body, same JWT, only difference is the header — 400 without it, 201 with a fresh UUIDv4.

**Fix:** Stable per-row UUIDv4 minted at `UploadRow` construction (default `java.util.UUID.randomUUID().toString()`), persisted to `queue.json`, sent as `Idempotency-Key` on every API POST for that row's lifetime. Same key reused across retries — that's the contract that makes the server's idempotency cache replay the original 2xx response.

### Files changed

- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadModels.kt`
  - `UploadRow`: new field `idempotencyKey: String = UUID.randomUUID().toString()` (last constructor param, defaulted so `HumynUploadModule.enqueue()` doesn't need to change).
  - `UploadRow.toJson` / `fromJson`: serialise / deserialise the field. On a legacy row missing the field (the currently-stuck `01KRFXGAWCMVQ89PJ2PBXSVAKK` on the Pixel 10a), `fromJson` mints a fresh UUIDv4 and emits a one-shot `Log.w("HumynUploadCoord", "row ... missing idempotencyKey on load — minted ... (one-shot migration)")`.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/upload/UploadCoordinator.kt`
  - `authedJsonRequest(url, bodyJson, idempotencyKey)`: signature now takes the key + `.header("Idempotency-Key", idempotencyKey)`.
  - All 4 POST callers (`postInit`, `postReupload`, `postRePresign` for `/parts`, `postFinalize`) thread `row.idempotencyKey`. Sweep-confirmed: only one `Request.Builder().post` exists in the upload package; the presigned S3 PUT in `ChunkUploader` doesn't hit our API so no header there.

### Server-side: no change

The API's idempotency contract was correct all along. Validation runs BEFORE the preHandler in Fastify's lifecycle, which is why a malformed body returns the schema-validation 400 instead of the idempotency 400 — masked the host-side curl probe diagnosis until session 3.

### Tests added (all passing under `./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.upload.*"`)

- `UploadQueueStoreTest.\`mint a fresh UUIDv4 idempotencyKey at construction\`` — fresh row has a server-regex-valid UUIDv4; two rows mint different keys.
- `UploadQueueStoreTest.\`idempotencyKey survives a round trip through queue json\``—`enqueue → read` preserves the key.
- `UploadQueueStoreTest.\`fromJson mints a fresh UUIDv4 when a legacy row on disk has no idempotencyKey\``— migration path for the stuck`01KRFXGAWCMVQ89PJ2PBXSVAKK` row.
- `UploadCoordinatorTest.\`every API POST carries the row's stable Idempotency-Key UUIDv4 (init+finalize on the first drain)\``—`MockWebServer`captures the outbound header;`/init`+`/finalize` both carry the row's stable key, server-regex-valid.
- `UploadCoordinatorTest.\`a re-drain via slash parts reuses the same Idempotency-Key as the original slash init\``— the re-drain`/parts` POST reuses the row's key (lost-201 self-heal contract).

(Pre-existing SoLoader-NPE failures in `compat/*` + `handdetector/*` tests are unrelated — they don't use the `@Config(application = Application::class)` Robolectric workaround documented in CLAUDE.md; my changes only touched `upload/`.)

### Bench verification (host curl, dev API live on :8080)

- `POST /recordings/init` with the device's exact body, no `Idempotency-Key` → `400 {type: .../idempotency-key-invalid, title: "Idempotency-Key required"}` — confirms the pre-fix symptom is exactly the diagnosed one.
- Same body with `Idempotency-Key: <UUIDv4>` + dummy JWT → `401` (auth fails as expected with a fake bearer; the request reached the route-level `requireAuth` past the global hook).

### Build

- `:app:compileApkRolloutDebugKotlin` — green.
- `:app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.upload.*"` — green.
- `:app:assembleApkRolloutDebug` — green; APK ready for `adb install`.

### Next: on-device verification

1. Install: `cd apps/mobile/android && ./gradlew installApkRolloutDebug` (~3-4 min incremental). The offline-bundle flavor; ensure Metro is up + `adb reverse tcp:8081 tcp:8081` set.
2. Force-stop + relaunch on Pixel 10a: `adb shell am force-stop ai.humynlabs.capture.apk && adb shell monkey -p ai.humynlabs.capture.apk -c android.intent.category.LAUNCHER 1`.
3. Trigger a drain (cold-start drain gap means the coordinator won't auto-drain at boot — easiest: enter+exit RecordingScreen, OR record another ≥60 s, OR Profile→Logout then sign back in).
4. Expect logcat `HumynUploadCoord`:
   - "row 01KRFXGAWCMVQ89PJ2PBXSVAKK missing idempotencyKey on load — minted ... (one-shot migration)" (the legacy row gets a freshly-minted key).
   - `/recordings/init -> 200` (NOT 201 — CR-02 idempotent SELECT-first path, since the curl repro planted the row server-side with a real `s3UploadId`; the device's new UUIDv4 won't cache-hit but the route's CR-02 guard returns the SAME `s3UploadId` for the row; bonus CR-02 idempotent-`/init` verification beyond the header fix).
   - Parts PUT to LocalStack → `/finalize -> 200` → `enqueueVerify` → hash-verify worker → `qa_status='verified'` → next authed call carries `_events: [{recording_id:'01KRFXGAWCMVQ89PJ2PBXSVAKK', event_type:'verified'}]` → `HumynUpload.clearVerified([...])` → local triple unlinked → row gone from `queue.json`.
5. Resume Phase-5 on-device UAT walk at `.planning/runbooks/05-upload-smoke.md` §2.
