# Phase 5: Upload Pipeline & Hash-Verify Worker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 5-upload-pipeline-hash-verify-worker-anti-fraud
**Areas discussed:** Anti-fraud descope, Daily upload-rate cap, Recovered-segment policy, Wave 1 cleanup decisions, Upload-queue screen

---

## Gray-area selection

| Option                   | Description                                                                                                              | Selected |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| Daily upload-rate cap    | FRAUD-05 has no number; decide unit / value / on-hit behavior; does a crash-recovered duration:0 segment count / upload? | ✓        |
| Fraud dashboard form     | FRAUD-06 — real web UI? SQL views? admin API route? export job?                                                          |          |
| Wave 1 cleanup decisions | 04-COSMETIC-GAPS.md open code items — device-distress→Home?; crash-toast proper-fix?; is_practice in metadata?           | ✓        |
| Upload-queue screen      | UP-12 screen — /gsd-ui-phase? reuse History pattern? defer to Phase 6?                                                   | ✓        |

**User's choice:** "Daily upload-rate cap, Wave 1 cleanup decisions, Upload-queue screen, push all things anti-fraud related to v2, descope it from MVP"
**Notes:** The "push all anti-fraud to v2" rider is a directive — FRAUD-05 + FRAUD-06 → §v2; phase to be re-titled "Upload Pipeline & Hash-Verify Worker". Drops the "Fraud dashboard form" topic entirely.

---

## Daily upload-rate cap

| Option                     | Description                                                                                                                    | Selected |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Fully uncapped at MVP      | FRAUD-05 → v2; no cap, no rejection logic, no client retry-tomorrow path; S3 lifecycle + worker autoscaling bound cost/compute | ✓        |
| Keep a generous safety cap | ~200 segments/day/account circuit-breaker, branded "safety limit"; on hit 429 → client holds locally + retries next day        |          |

**User's choice:** Fully uncapped at MVP.
**Notes:** Consistent with "push all anti-fraud to v2". → CONTEXT D-04 / D-04a.

---

## Recovered-segment policy (crash-recovered post-30s fragment with `duration_seconds: 0` + null drift)

| Option                                  | Description                                                                                                              | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| Upload it; flag it; don't count it      | Bundle uploads byte-for-byte; server/worker tolerate duration:0 + null drift; doesn't count toward History/contributions |          |
| Upload it, treat it as a normal segment | Uploads and counts like any recording; simplest; but a 0-duration History row looks broken                               |          |
| Don't upload it; discard locally        | CaptureLaunchSweep deletes the recovered fragment instead of finalizing it                                               | ✓        |

**User's choice:** Option 3 — discard locally, never upload. (Chosen after a plain-English walkthrough of the moof-flush mechanic.)
**Notes:** Implication captured in CONTEXT D-03/D-03a/D-03b: CaptureLaunchSweep discards ALL crash-truncated fragments (not just sub-30s stubs); the ROADMAP's "upload path should tolerate duration_seconds: 0" note is RESCINDED; planner must reconcile with the crash-recovery toast (D-07) — if no recovery path produces an upload-able segment, that toast may be dead code. Small Wave-1 behavior change to CaptureLaunchSweep.

---

## Wave 1 cleanup — device-distress mid-record stop destination

| Option                          | Description                                                                                                  | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Stay on RecordingScreen-'ready' | Current behavior; same as normal sub-60s discard (REC-05); <5% start-guard refuses the next recording anyway |          |
| Bounce to Home                  | Device-distress stop (battery ≤5% / thermal abort) navigates to Home after finalizing                        | ✓        |

**User's choice:** Bounce to Home.
**Notes:** CONTEXT D-05. Only device-distress stops bounce; normal sub-60s discard keeps current behavior. Planner to handle the practice-recording-mid-onboarding edge.

---

## Wave 1 cleanup — crash-recovery "recovered after force-quit — uploading" toast

| Option                                     | Description                                                                                 | Selected |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | -------- |
| Proper fix — stash & trigger on Home mount | Refactor: stash recovered list, fire a normal-duration toast from post-bootstrap/Home mount |          |
| Leave the 15s workaround                   | Don't touch it; works; keeps the hacky 15s-duration splash-screen toast                     | partial  |

**User's choice:** "Leave the 15s workaround, just reduce the duration to 5 seconds."
**Notes:** CONTEXT D-07 — keep the App.tsx-mount architecture, set duration back to 5s (down from 15s). Conscious trade-off: at 5s the pill displays during splash bootstrap and likely fades before Home renders (pre-bump behavior). No refactor. Annotate bootRecoveryListener.ts so nobody re-bumps it. See D-03b reconciliation.

---

## Wave 1 cleanup — `is_practice` in finalized metadata JSON

| Option                                | Description                                                                                                                      | Selected |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Add is_practice to finalized metadata | Belt-and-suspenders for the upload filter / training pipeline; cheap at finalize time                                            |          |
| Leave it dir + task_id only           | Practice segregated by files/practice/ + task_id == **practice**; .session.json keeps is_practice, finalized {base}.json doesn't | ✓        |

**User's choice:** Leave it dir + task_id only.
**Notes:** CONTEXT D-08. Phase-5 upload filter keys off the files/practice/ path + task_id == **practice**.

---

## Upload-queue screen

| Option                                                            | Description                                                                                                                                | Selected |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Reuse the History-row pattern, no UI phase                        | History row layout (64×64 thumb + name + meta + status chip) + existing chip variants + one new "Paused — no Wi-Fi" chip; no /gsd-ui-phase | ✓        |
| Run /gsd-ui-phase 5 for a proper UI-SPEC                          | Spin up a UI design contract for the screen + its 4 states before planning                                                                 |          |
| Ship only the Home tile + a bare list now; full screen in Phase 6 | Minimal tap-through (filename + %) at Phase 5; polished screen lands in Phase 6                                                            |          |

**User's choice:** Reuse the History-row pattern, no UI phase.
**Notes:** CONTEXT D-10 / D-10a. Resolve design-spec §21.7's TBD states inside the locked design system; add exactly one new chip variant ("Paused — no Wi-Fi") in the existing style. The Home "Pending uploads" tile already exists in prototype.html / design-spec §14 — wire it to real data; its count>0 visibility + pull-to-refresh + offline banner are Phase 6's job.

---

## Claude's Discretion

- Wire shape of the server→client event-piggyback channel (per-user events-outbox table? response-envelope key vs header? at-least-once + client idempotency on recording_id + event-type?).
- Dev-environment wiring for the hash-verify worker (local Redis container + worker process + LocalStack EventBridge→SQS, vs a simpler synchronous dev shim). Plus: add the CLAUDE.md "Do NOT Use → Redis at MVP" carve-out (upload queue = on-device; hash-verify worker queue = BullMQ-on-Redis-on-ECS per VERIFY-01/07) and the Redis pin to research/STACK.md if missing.
- The reconciliation-sweep backend surface (new GET /recordings query param vs a dedicated since-cursor endpoint vs piggy-back).
- Whether the upload-queue screen briefly shows completed-this-session rows or drops a row on `verified`.
- The roadmap/requirements housekeeping (phase rename; FRAUD-05/06 → §v2; trim Phase 5 success criterion #5 + the requirements list) — fold into the Phase-5 plan or a /gsd-phase edit.

## Deferred Ideas

- All MVP anti-fraud beyond Play Integrity + the on-device hand gate → §v2 (FRAUD-05 rate cap, FRAUD-06 fraud dashboard; plus already-deferred FRAUD-03/04, per-upload attestation, perceptual-hash dedup, device-fingerprint binding, liveness gestures).
- The "stash + trigger from Home mount" proper-fix for the recovery toast — §v2 nicety (if the toast survives D-03 reconciliation at all).
- A bespoke from-scratch upload-queue screen beyond the History-row reuse — a later UI-phase if ever wanted.
- iOS upload path (URLSessionConfiguration.background + the iOS native-module analogues) — already §v2 (IOS-01..07); UP-08's iOS clause not built this phase.
- Switching the hash-verify worker from BullMQ-on-ECS to S3-EventBridge→Lambda — §v2 per VERIFY-07.
