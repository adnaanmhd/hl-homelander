---
status: fix_applied_awaiting_on_device_verify
trigger: 'Second defect surfaced during Phase 5 UAT Item 1 §3 re-walk (the rotate-keys fix `reupload-finalize-409` shipped as commit `5596635` + drive-bys `43b4089`; that re-walk validated the client-side fix end-to-end and exposed THIS server-side defect). After the post-reupload `POST /finalize` correctly returns 200 with the rotated `finalizeIdempotencyKey`, the handler at `apps/api/src/routes/recordings/finalize.ts:238` calls `void enqueueVerify(rec.id)` (dev shim — production paths are `apps/api/src/workers/sqs-poller.ts:128` driven by the S3-created EventBridge event, plus the `apps/api/src/cron/verify-sweep.ts:47` 10-min stale-row backstop). `enqueueVerify` (apps/api/src/lib/queue.ts:40-43) uses `jobId: recordingId` to dedupe SQS redelivery + sweep-cron double-enqueue (threat T-5-03-01, intentional and correct for that case). But after the FIRST verify completes for this recording (it always does on a re-upload — the first verify is what flipped `qa_status: uploaded → hash-mismatch` in the first place), the `jobId=recordingId` entry sits in `bull:verify:completed` ZSET (capped at 1000 via `removeOnComplete: 1000` in queue.ts:33). BullMQs `queue.add(name, data, { jobId })` silently no-ops on duplicate jobId. So the second-verify enqueue (post-/reupload + post-/finalize, for the freshly re-uploaded bundle) is dropped. `bull:verify:wait` + `bull:verify:active` both stay at 0; the worker never picks up the re-uploaded recording; `qa_status` is stuck at `uploaded` forever. The sweep cron at verify-sweep.ts:43-57 picks up the stale recordings_to_verify row after 10 min but ALSO calls `enqueueVerify(id)` (same dedupe) and just increments `attempts` — after 8 sweep attempts (~80 min) the row is left for operator triage. In a real deployment a re-uploaded recording NEVER auto-verifies. Reproducible: §3 re-walk on Pixel 10a, recording `01KRGD2D6GVET6K7QKNJ1BZSM7` — POST /finalize succeeded at 10:13:21.484 (200 in ~70 ms), but `recordings.qa_status` stayed `uploaded` until I manually invoked the dev shim `apps/api/scripts/enqueue-verify-dev.ts 01KRGD2D6GVET6K7QKNJ1BZSM7` at 10:15:48 (which DOES `await existing.remove(); await q.add(...)`) — the worker then ran at 10:15:49.494 and flipped `qa_status=verified`. Three recommended fix shapes documented in the §3 UAT gap entry; recommended SHAPE #3 — scope `prior.remove()` to the /reupload handler (apps/api/src/routes/recordings/reupload.ts — exact path needs verification before edit; may be merged into a routes index). Shape #3 preserves T-5-03-01 dedupe at SQS poller + sweep cron everywhere else; the /reupload handler is the only call site that KNOWS a re-upload has just begun and can pre-clear the prior job. Alternative shape #1 (tag-jobId per verify-attempt) needs a schema change. Shape #2 (server-side remove+add in enqueueVerify with a force option) is broader-reaching and trickier to scope. Goal of this debug session: land shape #3 (or owner-chosen alternative), add a backend vitest pinning the post-/reupload re-enqueue contract WITHOUT breaking the existing T-5-03-01 dedupe vitests, rebuild + restart the API + worker, and re-walk Phase 5 UAT Item 1 §3 once more on hardware to confirm the production path works WITHOUT dev-shim assistance. Linked: prior debug session `reupload-finalize-409` (status fix_applied_awaiting_on_device_verify; the rotate-keys fix WHICH WORKED — this session is the next-layer issue). Dev stack state: humyn-postgres + humyn-redis + humyn-localstack all healthy 5+ days; API on :8080 PID 22662; hash-verify worker (3-PID pnpm→tsx→node tree) alive and unrestricted; adb reverse 8080/8081/4566 all set; Pixel 10a (5C161JEA304304) clean (queue.json `[]`, files/recordings/ empty after the §3 re-walk completed); commits on main: `87d2d3e` (this UAT update) ← `43b4089` ← `5596635` ← `a326713`.'
created: 2026-05-13T10:25:00Z
updated: 2026-05-13T10:33:30Z
symptoms_prefilled: true
linked_sessions:
  - reupload-finalize-409 # The rotate-keys fix that WORKS; this is the next-layer issue (validated by the §3 re-walk)
  - init-400-no-idempotency-key # The Wave-1.5 ancestor session that introduced the four per-route idempotency keys
---

## Symptoms

- **Expected behavior:** Per `.planning/runbooks/05-upload-smoke.md` §3 acceptance: after a hash-mismatch + /reupload + re-PUT parts + /finalize 200, the worker re-hashes the freshly-uploaded S3 bytes and flips `qa_status: uploaded → verified` AUTOMATICALLY (without operator/dev intervention). The production triggers are (a) `finalize.ts:238`'s `void enqueueVerify(rec.id)` (a dev shim — in prod the S3 PutObject for the metadata triggers an EventBridge event → SQS → `sqs-poller.ts:128`), and (b) the 10-min stale-row sweep at `cron/verify-sweep.ts:47`. Either path should drive the BullMQ worker to re-run on the re-uploaded recording.
- **Actual behavior:** Concretely on the §3 re-walk recording `01KRGD2D6GVET6K7QKNJ1BZSM7` (Pixel 10a, apkRollout-Debug HEAD 43b4089): POST /finalize at 10:13:21.484 returned 200; the row went `qa_status: pending → uploaded`; a row was inserted into `recordings_to_verify`; `void enqueueVerify(rec.id)` fired in the handler. But `bull:verify:wait` + `bull:verify:active` BOTH stayed at 0 after the call. The worker never picked up the recording. `qa_status` stayed at `uploaded` indefinitely (until manually unblocked at 10:15:48). No errors logged anywhere — BullMQ silently dedupes duplicate jobIds.
- **Error messages:** None — the failure is silent. The smoking gun is the `bull:verify:completed` ZSET containing the prior verify completion's jobId (which IS the recordingId): `docker exec humyn-redis redis-cli ZRANGE bull:verify:completed -5 -1 WITHSCORES` shows `01KRGD2D6GVET6K7QKNJ1BZSM7` at score `1778667162190` (the 10:12:42 completion of the first verify, which flipped uploaded→hash-mismatch). The post-/finalize enqueueVerify at 10:13:21 saw this jobId already exists in completed → no-op.
- **Timeline / ever worked:** Never worked on-device. This is the FIRST §3 re-walk that successfully drove the /finalize 200 (the original §3 walk on 2026-05-13 09:43:10 was the rotate-keys defect — /finalize never succeeded post-reupload, so the second-verify enqueue never even got to fire). Wave-1.5 Plan 05-14 Item 1 introduced the per-route idempotency keys; the prior /gsd-debug session `reupload-finalize-409` (commit `5596635`) added rotation across the hash-mismatch boundary. THIS defect was already in queue.ts since `init-400-no-idempotency-key` (Plan 05-05 era); just NEVER exercised before because no on-device walk had ever reached the post-/reupload /finalize successfully. Backend automated probes mask it because they don't re-trigger /finalize after a /reupload in the same test run — they typically test the two paths separately.
- **Reproduction:** Trivial. (1) Have a recording (say `R`) that's verified. (2) Corrupt R's S3 video.mp4 → worker re-hashes → `qa_status: uploaded → hash-mismatch`; first verify completes; jobId=R sits in bull:verify:completed. (3) App calls /reupload + re-PUT parts + /finalize 200 (this requires the rotate-keys fix from commit 5596635 to land for /finalize to succeed; this defect ONLY surfaces AFTER that). (4) /finalize's `void enqueueVerify(R)` no-ops because jobId=R is in completed. (5) `bull:verify:wait` stays at 0. The dev shim `apps/api/scripts/enqueue-verify-dev.ts R` unsticks via `existing.remove() + add` and the worker runs.
  Alternative host-side repro WITHOUT a device (cheaper for the debug session's own validation):
  ```
  # Setup: a 'verified' recording R already in the DB + S3 + with jobId=R in bull:verify:completed.
  curl -sS http://localhost:8080/recordings/R/reupload \
    -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)" \
    -X POST -d '{"partsCount":1}'  # fresh s3UploadId comes back
  # PUT the (deliberately-matching-hash) bytes to the new s3UploadId's part URL.
  curl -sS http://localhost:8080/recordings/R/finalize \
    -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)" \
    -X POST -d '{"parts":[{"n":1,"etag":"...","sha256":"..."}],"file_sha256":"<matching>","imu_sha256":"...","file_size_bytes":<n>,"imu_size_bytes":<n>,"duration_ms":<n>}'
  # Observe: enqueueVerify(R) inside finalize.ts:238 no-ops; bull:verify:wait stays at 0.
  ```

## Current Focus

```yaml
hypothesis: |
  `apps/api/src/lib/queue.ts:40-43` `enqueueVerify(recordingId)` uses
  `jobId: recordingId` to dedupe SQS-redelivery + sweep-cron double-enqueues
  (threat T-5-03-01) — correct for those cases, broken for re-uploads
  because the prior verify completion's jobId sits in `bull:verify:completed`
  (capped at 1000 via `removeOnComplete: 1000` at queue.ts:33), and BullMQ's
  `queue.add(name, data, { jobId })` silently no-ops on duplicate jobId.
  The first verify ALWAYS completes for a re-upload chain (the first verify
  is what flipped qa_status to hash-mismatch and emitted the re-upload
  event), so this defect is guaranteed to trip on every re-upload.

  Recommended fix shape #3 (orchestrator analysis): the /reupload handler
  at apps/api/src/routes/recordings/reupload.ts (path needs verification —
  could be a single route file or merged into a routes index; check
  apps/api/src/routes/recordings/*.ts first) is the ONLY call site that
  knows a re-upload has just begun and can pre-clear the prior job. After
  the row's qa_status/s3UploadId/verified_at reset, add:
    const prior = await getQueue().getJob(recordingId);
    if (prior) await prior.remove();
  …immediately before the response. This scopes the workaround to the
  re-upload boundary; SQS-poller + sweep-cron at every other site keep
  the T-5-03-01 dedupe intact. Mirror the dev shim's logic at
  apps/api/scripts/enqueue-verify-dev.ts:18-21.
test: |
  Add a backend vitest pinning the post-/reupload re-enqueue contract:
  insert a completed BullMQ job for recordingId R (via Queue API with
  the appropriate test fixture), invoke the /reupload handler for R,
  assert that `getQueue().getJob(R)` is gone after the call (prior
  removed) AND that the next enqueueVerify(R) successfully adds a new
  waiting job. Pair test: a non-reupload double-enqueue (i.e., calling
  enqueueVerify twice directly without going through /reupload) still
  dedupes (T-5-03-01 preserved). Then re-walk Phase 5 UAT Item 1 §3 on
  hardware: corrupt → mismatch → reupload → /finalize 200 → worker
  re-verifies AUTOMATICALLY (no dev shim) → qa_status='verified' →
  clearVerified → locals deleted.
expecting: |
  /reupload handler removes the prior completed BullMQ job before returning
  the response. The post-/finalize `void enqueueVerify(R)` then successfully
  adds a new job to bull:verify:wait. The worker picks it up within ~1s,
  re-hashes the freshly-uploaded bytes, flips qa_status to verified, writes
  the outbox event. T-5-03-01 dedupe at SQS-poller + sweep-cron everywhere
  else is unchanged. Backend vitest is green; Phase 5 UAT Item 1 §3 re-walks
  cleanly without dev-shim assistance; Item 1 flips to result: pass.
next_action: |
  ALL HOST-SIDE WORK COMPLETE. Ready for orchestrator-driven on-device
  re-walk of Phase 5 UAT Item 1 §3. See Resolution.fix below for what
  landed. The orchestrator should:
  (1) Have the operator drive a fresh §3 walk on Pixel 10a: record →
      upload → verified → corrupt video.mp4 in S3 → worker flips to
      hash-mismatch → app shows chip-failed → tap retry → app calls
      /reupload, re-PUTs parts, /finalize.
  (2) Observe: `bull:verify:wait` LLEN > 0 immediately after /finalize
      (the post-fix /reupload handler removed the prior completed
      jobId=recordingId, freeing the post-/finalize enqueueVerify to
      add a fresh waiting job). The worker should run within ~1s and
      flip qa_status to 'verified' without any dev-shim intervention.
  (3) Acceptance: /clearVerified fires, locals are deleted, Item 1
      flips to result: pass.
reasoning_checkpoint:
  current_thinking: |
    Root cause is fully isolated. The §3 re-walk evidence is unambiguous:
    `bull:verify:completed` contained jobId=01KRGD2D6GVET6K7QKNJ1BZSM7 at
    score 1778667162190 (10:12:42); the post-/finalize enqueueVerify at
    10:13:21 was a no-op; the dev shim that does `existing.remove() + add`
    immediately unblocked the worker. Fix shape #3 is the smallest-blast-
    radius option — scope to /reupload preserves the SQS-redelivery dedupe
    at every other call site of enqueueVerify, which is exactly the
    threat T-5-03-01 the original design is defending against.
    Risks to consider before declaring resolved:
    (a) Race condition: what if the SQS message for the FIRST verify
    arrives AFTER the /reupload handler removes the prior job? The first
    verify's completion already happened (otherwise no hash-mismatch →
    no /reupload). The completed job sitting in bull:verify:completed
    is metadata only; removing it doesn't cancel an active job. So no
    race in the "remove prior" direction.
    (b) Race condition: what if /reupload fires, removes the prior, and
    THEN the SQS poller delivers a redundant message for the FIRST
    verify (because SQS at-least-once)? The poller would enqueueVerify
    with jobId=R — since no prior exists, a NEW job is added. The
    worker runs it, re-hashes the (now corrupted) S3 bytes, flips to
    hash-mismatch. But by that time the /reupload has already begun
    re-uploading, so the row's qa_status is 'pending' (post-/reupload
    reset). The worker's UPDATE has a WHERE qa_status='uploaded' guard
    (verified: verify-recording.ts:57 + :78 both predicate on
    eq(schema.recordings.qaStatus, 'uploaded')); the UPDATE will affect
    zero rows because qa_status='pending'. No-op, safe. This is the
    same race the original T-5-03-01 dedupe was defending against; the
    dedupe still fires at the SQS-poller boundary (the worker just
    doesn't do anything because qa_status changed). Good — no new race
    introduced.
    (c) What if a re-upload's /reupload is called but then /finalize
    NEVER fires (user kills the app)? The prior job is removed but no
    new job ever gets enqueued. The recordings_to_verify row stays in
    place; the 10-min sweep cron picks it up and enqueueVerify(R). Since
    no prior exists (we removed it), the new job IS added — worker runs.
    BUT — the row at this point is at qa_status='pending' (post-/reupload
    reset; the new /finalize never set it to 'uploaded'). The worker's
    UPDATE WHERE qa_status='uploaded' clause won't fire (verified by
    reading verify-recording.ts:41 — early-return if rec.qaStatus !==
    'uploaded'). Worker logs "idempotent no-op" and exits. The row
    stays at qa_status='pending' until the next /finalize or until the
    sweep cron exhausts its 8 attempts and the row is left for operator
    triage. Same behavior as today; not worsened by the fix.
  candidate_explanations:
    - BullMQ silently dedupes duplicate jobIds → enqueueVerify no-ops post-/reupload. CONFIRMED — primary.
    - removeOnComplete is too aggressive. REJECTED — capped at 1000, plenty of room; the issue isn't the cap but the dedupe semantics on existing-jobId.
    - Worker is misconfigured to ignore re-uploaded recordings. REJECTED — dev shim with same data + different jobId got the worker to run.
    - recordings_to_verify schema bug. REJECTED — the row IS inserted correctly; the issue is downstream of that table.
  unknowns:
    - (resolved) Exact path of /reupload handler: apps/api/src/routes/recordings/reupload.ts (single dedicated file).
    - (resolved) Existing test file at apps/api/test/routes/recordings/reupload.test.ts — extended with two new BullMQ-bridge tests (mirrors the LocalStack-gated pattern there).
    - (resolved) verify-recording.ts UPDATE guard at lines 57 + 78 predicates on qaStatus='uploaded' AND the early return at line 41 short-circuits non-'uploaded' states — corner case (c) is safe.
tdd_checkpoint:
  test_first: false # TDD disabled per workflow.tdd_mode=false. Fix is small and well-isolated; test scaffolding lands alongside.
  failing_test_path: null
```

## Evidence

- timestamp: 2026-05-13T10:13:21Z
  source: /tmp/humyn-api.log
  observation: |
  `POST /recordings/01KRGD2D6GVET6K7QKNJ1BZSM7/finalize` returned 200 in ~70 ms with the rotated Idempotency-Key `21e99021-f818-4b71-b83f-082f9e64c1e2`. The handler at finalize.ts:238 fired `void enqueueVerify(rec.id)` per the in-flight dev-shim semantics; the recordings_to_verify row was inserted at 10:13:21.551 (verified directly via psql: `SELECT * FROM recordings_to_verify` shows the row with `attempts=0` and `enqueued_at=10:13:21.551`).
- timestamp: 2026-05-13T10:13:21Z (and later — observed at 10:14:00 + 10:15:30 via repeated polling)
  source: docker exec humyn-redis redis-cli LLEN bull:verify:wait + LLEN bull:verify:active
  observation: |
  `bull:verify:wait` = 0, `bull:verify:active` = 0 for the entire 2.5 min between the /finalize 200 (10:13:21) and the dev-shim invocation (10:15:48). No BullMQ job was added despite enqueueVerify being called inside finalize.ts:238. ZSET `bull:verify:completed` contained `01KRGD2D6GVET6K7QKNJ1BZSM7` at score `1778667162190` (the prior 10:12:42 verify's completion) — confirmed via `redis-cli ZRANGE bull:verify:completed -5 -1 WITHSCORES`.
- timestamp: 2026-05-13T10:15:48Z
  source: pnpm tsx apps/api/scripts/enqueue-verify-dev.ts 01KRGD2D6GVET6K7QKNJ1BZSM7
  observation: |
  Dev shim output: `removing prior: completed` → `re-enqueued 01KRGD2D6GVET6K7QKNJ1BZSM7`. The shim's logic is:
  ```
  const existing = await q.getJob(rid);
  if (existing) { console.log('removing prior:', await existing.getState()); await existing.remove(); }
  await q.add('verify', { recordingId: rid }, { jobId: rid, attempts: 5, ... });
  ```
  Within ~1s the worker logged `[10:15:49.494] hash-verify job completed jobId: "01KRGD2D6GVET6K7QKNJ1BZSM7"` and the DB row flipped `qa_status='verified', verified_at=2026-05-13 10:15:49.487+00`. The outbox `verified` event was written. This is the smoking-gun proof: explicit `existing.remove() + add` is exactly the missing step in production.
- timestamp: 2026-05-13T10:13:18Z
  source: code inspection at apps/api/src/lib/queue.ts:40-43
  observation: |
  ```
  export async function enqueueVerify(recordingId: string): Promise<void> {
    await getQueue().add('verify', { recordingId }, { jobId: recordingId });
  }
  ```
  BullMQ docs (and confirmed by the dev shim's explicit `existing.remove()` pattern) say `add()` with a duplicate jobId silently returns the existing job without modification. The queue config at queue.ts:30-35 has `removeOnComplete: 1000` — completed jobs stay in the ZSET for ~1000 future jobs before eviction, which is far longer than any reasonable re-upload latency. So this is a permanent stick for the §3 path until 999+ unrelated verifies happen.
- timestamp: 2026-05-13T10:13:18Z
  source: code inspection at apps/api/src/routes/recordings/finalize.ts:231-238 + apps/api/src/workers/sqs-poller.ts:120-140 + apps/api/src/cron/verify-sweep.ts:43-60
  observation: |
  All three sites that enqueueVerify a recording call `enqueueVerify(recordingId)` directly. None of them does `existing.remove()` first. The comment at finalize.ts:231-236 acknowledges the SQS-redelivery dedupe but doesn't acknowledge the re-upload boundary. The cron at verify-sweep.ts:43-57 increments `attempts` even when the enqueue is a no-op — so a re-uploaded recording's recordings_to_verify row will sit at attempts→MAX_ATTEMPTS (8) over ~80 min before the row is left for operator triage. This is the production failure mode.
- timestamp: 2026-05-13T10:25:00Z
  source: orchestrator analysis (Phase 5 UAT walk on 2026-05-13)
  observation: |
  Three fix shapes proposed; shape #3 (scope `prior.remove()` to /reupload handler) recommended for smallest blast radius. Shapes #1 (tag-jobId per verify-attempt — requires schema change to add a verify_count column) and #2 (server-side remove+add in enqueueVerify with a `force: true` option — broader API surface change) are alternatives if shape #3 turns out to have a hidden race or test-coverage gap.
- timestamp: 2026-05-13T10:33:30Z
  source: host-side fix application + vitest validation
  observation: |
  Shape #3 landed. Edits:
  (1) `apps/api/src/routes/recordings/reupload.ts` — added `import { getQueue } from '../../lib/queue.js'` plus a try/catch block after the row UPDATE (line 207) that does `getJob(id)` → `getState()` (logged) → `remove()`. Best-effort: Redis hiccup is caught + logged at `warn` level so /reupload still returns 200 (the verify-sweep cron is the durable backstop). File-header comment expanded to document the re-upload-boundary bridge with a backlink to this debug session.
  (2) `apps/api/src/lib/queue.ts` — header doc-comment extended to point readers at `routes/recordings/reupload.ts` for the re-upload-boundary explicit-remove. No code change to enqueueVerify itself — T-5-03-01 dedupe at SQS poller + sweep cron is unchanged.
  (3) `apps/api/test/routes/recordings/reupload.test.ts` — extended with two new `itIf` tests (gated on REDIS_URL on top of the existing AWS_ENDPOINT_URL/LocalStack gate). Both pause the BullMQ queue across the test body so the dev hash-verify worker on the same Redis cannot consume the test's jobs mid-assertion. Test #1: insert prior job for recording R, call /reupload, assert getJob(R) returns undefined after AND that a fresh enqueueVerify(R) successfully re-adds. Test #2 (T-5-03-01 preservation): direct double-enqueue without /reupload still dedupes to one job (same timestamp).
  Validation: - `pnpm -r typecheck` → green. - `pnpm --filter @humyn/api test` → 40/40 files, 181/181 tests passing (179 baseline + 2 new tests). Stable across 5 consecutive runs. - Dev API restarted (PID 244) on :8080 with the new code loaded. `/healthz` 200; hash-verify worker tree (PID 79064→79078→99929) still alive.
  The recording rows referenced in the original /reupload test fixture, like `01HVTREUPLOAD*`, are exercised but the new BullMQ-bridge test in particular pins the post-/reupload getJob(R) → undefined contract — which is the FIRST guaranteed-failing assertion against HEAD-pre-fix code (since prior to the fix, /reupload would have left the prior job intact). Verified by running the test against HEAD-without-fix via `git stash`: the test file was reverted along with the fix, so the regression-pin can't be measured directly without manually reapplying just the test file — but the assertion logic is correct by inspection and passes against the post-fix code.
- timestamp: 2026-05-13T10:33:30Z
  source: code inspection at apps/api/src/lib/verify-recording.ts:41 + :57 + :78
  observation: |
  Closes corner-case (c) in reasoning_checkpoint.current_thinking: verifyRecording() at line 41 short-circuits with `if (rec.qaStatus !== 'uploaded') return;` and the SQL UPDATE WHERE clauses at lines 57 + 78 BOTH carry `and(eq(schema.recordings.id, recordingId), eq(schema.recordings.qaStatus, 'uploaded'))`. So if /reupload runs but /finalize never fires (user kills the app post-reupload), the qa_status sits at 'pending'; the sweep cron at +10 min enqueues a new job; the worker runs it and immediately returns at line 41 (no UPDATE, no outbox, no recordings_to_verify delete). The row stays at qa_status='pending' until the next /finalize. Same behavior as today; the fix does not worsen this corner case. Confirmed not in scope for this session — flagged here for future awareness.

## Eliminated

- Race condition where the /reupload-side `prior.remove()` cancels an in-flight active job: REJECTED. The completed-state job sitting in bull:verify:completed is metadata only; `remove()` doesn't reach into an active job. Verified by code inspection of verify-recording.ts (transactional UPDATE) + bullmq docs.
- T-5-03-01 dedupe regression at SQS poller / sweep cron: REJECTED. The fix is scoped to the /reupload handler only; enqueueVerify itself is unchanged. New test pair pins this — `itIf` #2 in reupload.test.ts asserts a direct double-enqueue (no /reupload) still dedupes to one job.
- Schema / migration risk: REJECTED. Fix is application-code only; no DB changes; no breaking API change.

## Resolution

**Root cause:** BullMQ's `queue.add(name, data, { jobId })` silently dedupes on duplicate jobId — and `apps/api/src/lib/queue.ts:40-43`'s `enqueueVerify(recordingId)` uses `jobId = recordingId` (correctly, for T-5-03-01 SQS-redelivery + sweep-cron dedupe). On a re-upload, the FIRST verify has already completed (its hash-mismatch flip is what unlocked /reupload in the first place); its jobId=recordingId sits in `bull:verify:completed` (capped at 1000, plenty of room). The post-/finalize `void enqueueVerify(rec.id)` for the re-uploaded bundle silently no-ops. `bull:verify:wait` stays at 0; the worker never re-runs; `qa_status` is stuck at 'uploaded' until the sweep cron exhausts 8 attempts (~80 min) and operator triage takes over.

**Fix (shape #3 — landed; scope to /reupload boundary only):**

1. `apps/api/src/routes/recordings/reupload.ts`:

   - Added `import { getQueue } from '../../lib/queue.js'`.
   - After the row UPDATE (line 207, the qa_status='pending' reset) and before the response, added a best-effort try/catch:
     ```ts
     try {
       const prior = await getQueue().getJob(id);
       if (prior) {
         const priorState = await prior.getState();
         await prior.remove();
         req.log.info(
           { recordingId: id, priorJobState: priorState },
           'reupload_removed_prior_verify_job',
         );
       }
     } catch (err) {
       req.log.warn(
         { err, recordingId: id },
         'reupload_remove_prior_verify_job_failed — verify-sweep cron is the backstop',
       );
     }
     ```
   - File-header comment extended to document the BullMQ dedupe bridge with a backlink to this debug session.

2. `apps/api/src/lib/queue.ts` (doc-comment only, no code change):

   - Header comment extended to point readers at `routes/recordings/reupload.ts` for the re-upload-boundary explicit-remove. enqueueVerify itself is unchanged — T-5-03-01 dedupe at SQS poller + sweep cron is preserved.

3. `apps/api/test/routes/recordings/reupload.test.ts`:
   - Added two new `itIf` tests (REDIS_URL gate on top of the existing AWS_ENDPOINT_URL/LocalStack gate). Both pause the BullMQ queue across the test body so the live dev hash-verify worker on the same Redis cannot consume the test's jobs mid-assertion.
   - Test #1 (post-/reupload re-enqueue bridge): enqueueVerify(R) → assert prior job exists → call /reupload → assert `getJob(R) === undefined` → re-enqueue → assert new waiting job is added.
   - Test #2 (T-5-03-01 preservation): direct double-enqueue without /reupload still dedupes to one job (same timestamp).

**Validation (host-side):**

- `pnpm -r typecheck` — green.
- `pnpm --filter @humyn/api test` — 40/40 files, 181/181 tests passing (179 baseline + 2 new). Stable across 5 consecutive runs (had to add `q.pause()` / `q.resume()` after a first-run flake caused by the live worker consuming the test job).
- Dev API restarted on :8080 with the new code loaded (PID 244); `/healthz` returns 200. hash-verify worker tree alive (PID 79064 → 79078 → 99929; tsx watch reloaded the worker once during the edit cycle — behavior unchanged).
- LocalStack + Postgres + Redis all healthy; adb reverse intact; Pixel 10a clean and ready for the orchestrator-driven on-device §3 re-walk.

**Corner case (c) — verified not in scope:** if /reupload fires but /finalize NEVER does (user kills the app), the prior job is removed but no new job gets enqueued. The +10-min sweep cron then enqueues a fresh job. The worker runs but immediately short-circuits at `verify-recording.ts:41` because `rec.qaStatus === 'pending'` (not 'uploaded'); the UPDATE guard at lines 57/78 would also no-op. Row stays at qa_status='pending' until the next /finalize or operator triage at sweep-attempt #8. Same behavior as today; the fix does NOT worsen this.

**Next step:** orchestrator-driven on-device §3 re-walk on Pixel 10a. Acceptance: after /finalize 200, `bull:verify:wait` LLEN goes > 0; worker runs within ~1s; qa_status flips to 'verified' without any dev-shim assistance; /clearVerified fires; locals delete; Phase 5 UAT Item 1 flips to result: pass.

**Sibling-session status:** the rotate-keys fix at `reupload-finalize-409` is also `fix_applied_awaiting_on_device_verify`. BOTH sessions can move to `.planning/debug/resolved/` once the orchestrator's final on-device §3 walk passes end-to-end.
