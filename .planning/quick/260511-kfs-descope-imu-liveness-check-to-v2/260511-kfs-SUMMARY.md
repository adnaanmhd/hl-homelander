---
quick_id: 260511-kfs
slug: descope-imu-liveness-check-to-v2
date: 2026-05-11
type: quick
status: complete
mode: quick (inline — gsd-sdk not installed, legacy gsd-tools.cjs shim used; worktree path bypassed because the target docs are untracked in git)
---

# Quick Task 260511-kfs — Summary

## What changed

Reversed the earlier "promote server-side IMU-liveness fraud check from v2 to MVP" decision.
The IMU-liveness gate (`imu-liveness-check.md` — stillness gate, gravity-axis check, saccade
density, optional walking-segment FFT, vision–motion correlation, `liveness_score ∈ [0,1]`
rollup) is now **deferred to v2 / the post-MVP anti-fraud sprint**. MVP anti-fraud surface =
Play Integrity at sign-in (FRAUD-01/02) + per-account daily upload-rate cap (FRAUD-05) + the
on-device one-shot hand gate. The upload bundle still carries the IMU CSV (training consumes
video + IMU); it is just not analysed server-side at MVP.

Docs/planning only — no code touched. FRAUD-03/04 were unstarted (Phase 5 not yet planned), so
there was nothing to revert in code.

## Files edited

- **`imu-liveness-check.md`** — added a top-of-file `> DEFERRED TO v2` banner with the trail;
  §9 ("Relationship to other anti-fraud items") rewritten — the "Recommendation: promote to
  MVP-or-near-MVP" line is replaced with a "Status (2026-05-11): deferred to the v2 anti-fraud
  sprint" paragraph that keeps the "sequence it first within the v2 set" guidance.
- **`.planning/REQUIREMENTS.md`** — FRAUD-03 + FRAUD-04 removed from the active _Anti-fraud_
  section and re-added under §v2 _Anti-fraud_ (IDs kept, mirroring the DIST-05/06 handling),
  with a `>` descope note in the active section; FRAUD-06 reworded so its `liveness_score`
  dashboard panel rides with the deferred FRAUD-03/04; traceability-table rows for FRAUD-03 /
  FRAUD-04 flipped to `v2 / Deferred 2026-05-11`; "Last updated" footer line extended.
- **`.planning/ROADMAP.md`** — Overview paragraph (two sentences) + Phase 5 checklist line +
  Phase 5 goal + Phase 5 SC#5 de-scoped of the IMU-liveness clause; FRAUD-03/04 removed from
  Phase 5's Requirements list; the closing "parked in §v2" pointer now names the IMU-liveness
  check.
- **`.planning/STATE.md`** — Roadmap Evolution entry added (2026-05-11, reversal); the
  "Init: ... promoted from v2 to MVP" Decisions bullet annotated `REVERSED 2026-05-11`; Deferred
  Items table row added; Quick Tasks Completed row added; Last-activity line updated.
- **`deferred-decisions.md`** — new "Server-side IMU-liveness check" entry under _Fraud &
  integrity_ (design pointer to `imu-liveness-check.md`, FRAUD-03/04 mapping, "revisit: v2
  anti-fraud sprint, sequence before per-upload attestation + perceptual-hash dedup").
- **`CLAUDE.md`** — new `> IMU-liveness fraud check deferred 2026-05-11` banner alongside the
  audio-drop and MVP-descoped banners, with the full trail.

`imu-liveness-check.md` and `deferred-decisions.md` were previously untracked; both are now
`git add`ed and committed as part of this change (per the user's call).

## Out of scope (left untouched)

- Completed-phase planning artifacts (Phase 1–4 `*-RESEARCH.md` / `*-CONTEXT.md` /
  `*-DISCUSSION-LOG.md` mentions of IMU liveness) — historical record.
- `idea-brief.md` — already lists fraud defenses as deferred; the server-side check isn't
  named there.
- REQUIREMENTS.md coverage counts (`199 / 199`, per-phase totals) — left as-is; they were
  already not reconciled against the prior 2026-05-11 DIST/IOS descope, so this change follows
  the same (imperfect) precedent rather than introducing a partial fix.
- The earlier-discussed IMU-CSV header change — separate, not part of this task.

## Verification

- `grep -n "promoted from v2\|promoted-from-v2\|promote.*to MVP" .planning/ROADMAP.md .planning/REQUIREMENTS.md` → only historical/struck/reversal context remains; no live promotion.
- `imu-liveness-check.md` opens with the `> DEFERRED TO v2` banner; §9 no longer recommends MVP promotion.
- `REQUIREMENTS.md` §v2 _Anti-fraud_ lists FRAUD-03 + FRAUD-04; traceability table shows both as `v2 / Deferred 2026-05-11`; active _Anti-fraud_ section no longer lists them.
- `ROADMAP.md` Phase 5 Requirements line: `... VERIFY-07, FRAUD-05, FRAUD-06` (FRAUD-03/04 gone).
- `CLAUDE.md` has the IMU-liveness-deferred banner.
- `STATE.md` Quick Tasks Completed table has the `260511-kfs` row.

## Commits

- `de09bcf` — `docs(quick-260511-kfs): descope server-side IMU-liveness check (FRAUD-03/04) to v2` — the descope itself (imu-liveness-check.md, REQUIREMENTS.md, ROADMAP.md, deferred-decisions.md, CLAUDE.md, STATE.md).
- (this docs commit) — `docs(quick-260511-kfs): plan + summary + STATE quick-task row` — PLAN.md, SUMMARY.md, and the STATE.md Quick Tasks Completed row + Last-activity line.
