---
status: investigating_fix_shapes
trigger: 'Surfaced during Phase 5 UAT Item 2 §4 (logout/re-login owner-pin) walk on Pixel 10a, 2026-05-13. To catch UP-13''s ''in-flight PUT aborts'' assertion, the LocalStack@localhost upload (which naturally completes in ~2-3 s — too fast to logout mid-flight) was throttled by `docker pause humyn-localstack` BEFORE owner tapped Stop on the §4a recording. /init''s server-side `CreateMultipartUpload` blocked on the paused LocalStack; owner cleanly logged out (cancelInflight + drainNow paused markers fired in logcat ✓; queue + locals preserved ✓ — the §4a step-1 acceptance was MET on the first walk leg). Then owner re-logged in (same Adnaan / same google_sub) → drainer fired a second /init for the SAME `recordingId=01KRGGEDK65J5HE6BNDKXPZ1DQ` → I `docker unpause humyn-localstack` → BOTH the original (held-since-pre-logout) and the new /init resumed against LocalStack, BOTH passed the SELECT-first idempotency guard at `apps/api/src/routes/recordings/init.ts:168` BEFORE either committed an INSERT, BOTH attempted INSERT, the LATER one returned 500 with `duplicate key value violates unique constraint "recordings_pkey"` at `apps/api/src/routes/recordings/init.ts:284`. Drainer logged `row 01KRGGEDK65J5HE6BNDKXPZ1DQ upload failed transiently: /recordings/init -> 500` (UploadCoordinator.kt:216) and per the explicit comment at UploadCoordinator.kt:213-217 "leaves a transient failure as-is — the next drain retries", with NO in-loop retry. The §4a step-2 same-user-resume acceptance was BLOCKED. The race is acknowledged by the existing comment at init.ts:282-284 ("NO .onConflictDoNothing() — the SELECT-first guard above makes the conflict path unreachable for a new row; a genuine concurrent-INSERT race surfaces as a 500.") — author chose to surface as 500 on the assumption the race is rare. The §4 walk EXERCISES it because docker-pausing LocalStack is the only reliable way to keep an in-flight HTTP call alive long enough for the owner to navigate Profile→Logout. In production the same race fires when S3 latency exceeds the ~30 s OkHttp UP-19 no-progress watchdog window AND the drainer immediately retries — rare but not impossible (e.g., S3 partial outage). Recovery is supposed to be a subsequent drain attempt finding the (now-committed) row via the SELECT-first guard and returning 200 idempotent re-presign; observed behavior in our walk is no auto-retry by the drainer (Bug-2, secondary). Phase 5 prior context: Plan 05-09 added the SELECT-first idempotency guard for the lost-201 self-heal case (where the original handler''s 201 response is delivered to a closed socket but the row IS committed → next /init finds it). Plan 05-09 did NOT consider the concurrent-/init race because the ONLY way to trigger concurrent /init in Phase 5 is the docker-pause technique used by §4 walks — production has no client retry mechanism that fires while the original request is still in-flight server-side except via the UP-19 watchdog. CLAUDE.md anti-spec banner #1 (drift) doesn''t apply; banner #2 (audio dropped) doesn''t apply; this is purely an upload-pipeline race on /init.'
created: 2026-05-13T11:20:00Z
updated: 2026-05-13T11:20:00Z
symptoms_prefilled: true
linked_sessions:
  - reupload-finalize-409 # the rotate-keys fix; same /gsd-debug-on-§-walk pattern
  - enqueue-verify-jobid-dedupe # the second §3 defect from this morning; same pattern
  - init-400-no-idempotency-key # Wave-1.5 ancestor; introduced per-route idempotency keys
---

## Symptoms

- **Expected behavior:** Per `.planning/runbooks/05-upload-smoke.md` §4 acceptance: a logout aborts the in-flight PUT, queue + locals preserved, Pending Uploads empty while logged out, **same-user re-login resumes the upload**, eventually verifies + locals deleted + row dropped. The CR-02 lost-201 self-heal at `apps/api/src/routes/recordings/init.ts:165-237` is supposed to handle the resume path: device retries /init with the same recordingId, server SELECTs the existing row (committed by the first /init that the device cancelled), returns 200 with the existing s3UploadId + fresh re-presigned URLs, drainer resumes upload + finalize + verify.
- **Actual behavior:** Two /init requests for the SAME `recordingId=01KRGGEDK65J5HE6BNDKXPZ1DQ` race past the `apps/api/src/routes/recordings/init.ts:168` SELECT-first idempotency guard while LocalStack is paused (both SELECTs return null because neither has INSERTed yet). When LocalStack unpauses, the FIRST request's `CreateMultipartUpload` returns + INSERT succeeds (response delivered to closed socket — device cancelled long ago); the SECOND request's `CreateMultipartUpload` returns + INSERT FAILS with `duplicate key value violates unique constraint "recordings_pkey"` → 500. Server-side stack trace: `at async Object.<anonymous> (apps/api/src/routes/recordings/init.ts:284:7)`. Per the existing comment at init.ts:282-284, this is a known limitation: "NO .onConflictDoNothing() — the SELECT-first guard above makes the conflict path unreachable for a new row; a genuine concurrent-INSERT race surfaces as a 500."
- **Error messages (server, /tmp/humyn-api.log req-10):** `DrizzleQueryError: Failed query: insert into "recordings" (...): duplicate key value violates unique constraint "recordings_pkey"` → `statusCode 500` → `responseTime 16590ms` (the long responseTime is the docker-pause window).
- **Error messages (device, logcat):** `W HumynUploadCoord: row 01KRGGEDK65J5HE6BNDKXPZ1DQ upload failed transiently: /recordings/init -> 500` at `UploadCoordinator.kt:216`. After this, no further /init attempts in either logcat or `/tmp/humyn-api.log` despite owner foregrounding the app + tapping the Pending Uploads tile (Bug-2, secondary — drainer doesn't auto-retry transient failures, and the tile-tap kick the Wave-1.5 wave-fix-up mentioned didn't fire a fresh drainNow either).
- **Timeline / ever worked:** Never worked on-device for the §4 walk. The pre-§4 §2 happy-path walks (recording `01KRGA1B5H8BSRNFPSRHQFTHQ8`) and §3 hash-mismatch walks (recordings `01KRGB97X3MPJ784QF78SD77NJ`, `01KRGD2D6GVET6K7QKNJ1BZSM7`, `01KRGENTPAM6BGNRA3SWPS4Q7E`) never exercised this race because they didn't pause LocalStack to span /init. The race is structurally invisible to backend automated probes — they make /init calls strictly sequentially per recording.
- **Reproduction:** (1) Sign in. (2) Record + Stop. (3) Drainer enqueues row. Coordinator calls /init at T0. (4) `docker pause humyn-localstack` at T0+1ms (so /init's CreateMultipartUpload blocks). (5) Logout at T0+10s. Device cancels in-flight /init Call (Socket closed). Server-side handler keeps running, blocked on LocalStack. (6) Re-login at T0+30s. Drainer fires SECOND /init (same recordingId, same idempotency-key). Both /init handlers now blocked on LocalStack. (7) `docker unpause humyn-localstack`. Both `CreateMultipartUpload`s return. First INSERT commits. Second INSERT 500s with duplicate key.

## Current Focus

```yaml
hypothesis: |
  apps/api/src/routes/recordings/init.ts has a TOCTOU race between the
  SELECT-first idempotency guard at line 168 and the INSERT at line 284.
  Two concurrent /init handlers for the same recordingId can both pass the
  SELECT (both see no existing row), then both attempt INSERT — the second
  loses with PG unique-constraint violation → 500.

  Author was aware (comment at init.ts:282-284) and explicitly chose to
  surface 500 instead of handling the race ('the SELECT-first guard above
  makes the conflict path unreachable for a new row; a genuine
  concurrent-INSERT race surfaces as a 500'). The author's assumption was
  that concurrent /init for the same recordingId is impossible in
  production. UP-13's §4 walk + the LocalStack-pause technique (only
  reliable way to catch in-flight on dev-stack) PROVES the assumption is
  wrong on the dev path; the production path is rare-but-possible (S3
  latency > 30 s + UP-19 watchdog cancel + immediate drainer retry).

  Secondary issue (Bug-2): UploadCoordinator.kt:213-217 transient-failure
  branch has no in-loop retry — relies on external drain triggers (cold
  start, JWT change, FGS, UIDT JobService, tile-tap kick). On §4 the
  tile-tap kick the Wave-1.5 Item 4 was supposed to install did NOT
  re-fire drainNow after the 500. Out of scope for this debug session
  (Bug-1 fix alone resolves §4); flag for Wave-2.

test: |
  Backend vitest (apps/api/src/__tests__/routes/recordings/init.test.ts)
  pinning the race contract: launch two concurrent /init calls for the
  same recordingId via Promise.all, await both, assert NEITHER returns
  500 — both return 2xx (one 201 / one 200 idempotent, OR both 200 if the
  fix is INSERT-then-handle-conflict). The losing handler MUST self-heal
  to the idempotent re-presign path. Pair test: a SEQUENTIAL second /init
  AFTER the first has fully committed still returns 200 idempotent (the
  original CR-02 lost-201 self-heal contract is preserved).
fix_shapes:
  - id: A
    name: try/catch INSERT → re-run idempotent path
    sketch: |
      Wrap the INSERT at init.ts:284 in try/catch; on `error.code === '23505'`
      (PG unique-violation on `recordings_pkey`), fall through to a small helper
      that re-runs the SELECT-first idempotent re-presign block (lines 168-237).
      Surgical change, ~10-15 lines. Existing self-heal logic is reused — the
      losing handler just races to the same idempotent path the SELECT-first
      guard would have taken if the INSERT had committed earlier.
    pros:
      - Minimal change; localized to init.ts
      - Reuses existing CR-02 idempotent re-presign code
      - Preserves the existing comment author's intent (still surface other
        INSERT errors as 500; only handle the specific race)
    cons:
      - Slightly ugly try/catch + fall-through control flow
      - Need a tiny helper to share the idempotent re-presign block (DRY) OR
        accept code duplication (~70 lines)
  - id: B
    name: INSERT … ON CONFLICT (id) DO NOTHING + idempotent fallback
    sketch: |
      Change INSERT to `.onConflictDoNothing()` at init.ts:284. After the
      INSERT, check `result.rowCount`. If 0 (conflict happened), fall through
      to a helper that runs the idempotent re-presign block. If 1 (insert
      succeeded), continue to the 201 reply.
    pros:
      - Atomic at PG level (no race window)
      - Cleaner control flow than try/catch
    cons:
      - Reverses the explicit comment-author choice ('NO .onConflictDoNothing()')
        — needs to update the comment to explain WHY we now want it
      - Drizzle .onConflictDoNothing() returns 0-row result without throwing —
        need to handle the 0-row branch explicitly OR use RETURNING * and check null
  - id: C
    name: Postgres advisory lock keyed on recordingId
    sketch: |
      `pg_advisory_xact_lock(hashtext('recordings:init:' || recordingId))` at the
      top of the handler, inside a transaction wrapping SELECT + INSERT. Only
      one /init handler for this recordingId can hold the lock at a time.
    pros:
      - Strongest correctness; explicit serialization
    cons:
      - Requires transaction wrapping (everything stays inside one txn boundary)
      - Adds advisory-lock latency to every /init (rare but real cost)
      - Heavier than necessary for a rare race
  - id: D
    name: SELECT … FOR UPDATE on a sentinel row (or row-level lock)
    sketch: |
      Wrap SELECT + INSERT in a transaction, `SELECT FOR UPDATE` on the
      candidate row id (or use Drizzle's `.for('update')`). Second /init
      blocks on the row lock until the first commits.
    pros:
      - Standard PG pattern; no advisory lock infra
    cons:
      - SELECT FOR UPDATE on a non-existent row (the `recordingId` doesn't
        exist YET on first /init) doesn't lock anything — there's no row to
        lock; the race is back. Need to lock something else (e.g., the user
        row, or a sentinel table). Adds complexity vs Shape A.
recommended_shape: A
recommended_shape_rationale: |
  Shape A is the most surgical and respects the existing comment-author
  intent (only handle the specific concurrent-INSERT race, leave other
  INSERT errors as 500). Reuses the existing CR-02 idempotent re-presign
  code path. The vitest contract (pinning concurrent /init must NEVER 500)
  catches future regressions of either shape. Shape B is also acceptable
  if owner prefers the cleaner control flow; the cost is reversing the
  comment-author choice.

bug_2_secondary_finding: |
  Tertiary observation, NOT scoped to this debug session: the drainer's
  transient-failure branch (`UploadCoordinator.kt:213-217`) has no in-loop
  retry. After the /init 500 was logged as transient, the drainer returned
  cleanly without re-attempting the row. Owner's tile-tap on Pending
  Uploads (which Wave-1.5 Item 4 was supposed to install as a kick
  source) also did NOT fire a fresh `drainNow()`. The Bug-1 fix alone
  resolves §4 (because the post-fix /init never returns 500 for the race
  scenario). But Bug-2 remains a latent reliability issue: any transient
  /init or /finalize failure (network blip, server 5xx) requires an
  external drain trigger (FGS heartbeat, app cold start, JWT change) to
  re-attempt. Flag for Wave-2; do not block §4 sign-off on Bug-2. The
  TileTap kick path needs a separate audit (apps/mobile/src/screens/...
  Home or PendingUploads → does the navigate.push() actually emit the bus
  event the drainer subscribes to?).
```

## Diagnostic Evidence

- **Stuck DB row preserved:** `01KRGGEDK65J5HE6BNDKXPZ1DQ` in `humyn_dev.recordings`, `qa_status='pending'`, `s3_upload_id='iaXbPR6M101yGJecsGmlb9NdQyDn1wIG3WJuEj3_Kw3HTgMBcoEaYnooRLBLCQ7k3JB4ZyAQH2qqM77re1Hvf1UOsZpnRuc5774CBA5Vra4NB5EVKpzt0We-xFxf_ENw'`, `user_id='01KRGFZ75NY35CR9PRVMHMYAJT'` (Adnaan's post-fresh-login user_id with the real Google sub `106818988740600251943`).
- **Server-side error stack:** `/tmp/humyn-api.log` req-10, `responseTime 16590.1532497406`, error message: `Failed query: insert into "recordings" ... : duplicate key value violates unique constraint "recordings_pkey"`, stack trace: `at async Object.<anonymous> (apps/api/src/routes/recordings/init.ts:284:7)`.
- **Device-side cancelInflight log markers (proves §4a step 1 acceptance was MET):** `D HumynUploadCoord: drainNow paused at before-iteration` at 16:40:45.524 + 16:40:45.535 (×2 — two drain threads); `W HumynUploadCoord: row 01KRGGEDK65J5HE6BNDKXPZ1DQ upload failed transiently: Socket closed` at 16:40:54.365.
- **Device queue.json post-logout (preserved as evidence in conversation log):** state=PENDING, ownerUserId=01KRGFZ75NY35CR9PRVMHMYAJT, all per-route idempotency keys minted distinctly (`initIdempotencyKey: ac68e55c-..`, `partsIdempotencyKey: c804b537-..`, `finalizeIdempotencyKey: a04b31bd-..`, `reuploadIdempotencyKey: a7c17a23-..`). Local triple preserved on disk: 20260513_163941_001.{mp4,csv,json} (62MB mp4).
- **API-log /init request count:** 3 total `/recordings/init` lines for this recordingId (req-t = original pre-logout, req-z = drainer wake-up retry while LocalStack still paused, req-10 = post-unpause retry). req-10 is the one that 500'd; req-t and req-z effectively succeeded server-side (committed the row) but the responses went to closed sockets.
- **Worker log:** unaffected — worker's BullMQ queue never received a job for this recordingId (no /finalize ever ran; no enqueueVerify ever fired).
- **Cleanup state at session-open:** Device queue + locals cleared (queue.json `[]`, files/recordings/ empty); DB row preserved as evidence; orphan LocalStack S3 multipart upload `iaXbPR6M101...` orphaned (will be cleaned up on next dev-stack reset OR by an explicit AbortMultipartUpload).
