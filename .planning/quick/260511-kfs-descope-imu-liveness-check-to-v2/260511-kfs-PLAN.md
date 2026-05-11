---
quick_id: 260511-kfs
slug: descope-imu-liveness-check-to-v2
date: 2026-05-11
type: quick
status: in-progress
mode: quick (inline — gsd-sdk shim only; worktree path bypassed: target docs untracked)
---

# Quick Task 260511-kfs: Descope the server-side IMU liveness fraud check from the MVP → v2

## Goal

Reverse the earlier "promote IMU liveness check from v2 to MVP" decision. The server-side
IMU-liveness fraud gate described in `imu-liveness-check.md` (stillness gate, gravity-axis
check, saccade density, optional walking-segment FFT, vision–motion correlation, and the
`liveness_score ∈ [0,1]` rollup) is **deferred to v2 / post-MVP**. MVP anti-fraud surface
stays: Play Integrity at sign-in + per-account daily upload-rate cap + the on-device
one-shot hand gate. Docs/planning only — no code changes.

## Background

- `idea-brief.md` left this as a deferred item; it was later **promoted to MVP backend scope**
  (Phase 5) — recorded in `STATE.md` Decisions ("Init: Server-side IMU liveness fraud check
  promoted from v2 to MVP") and woven into `REQUIREMENTS.md` (FRAUD-03, FRAUD-04, partly
  FRAUD-06), `ROADMAP.md` (Overview + Phase 5 entry/goal/SC#5), and `imu-liveness-check.md` §9
  ("Recommendation: promote IMU liveness from `deferred-decisions.md` to MVP-or-near-MVP").
- Project owner decision 2026-05-11: keep it deferred. This task records that reversal across
  the planning docs, consistent with the existing 2026-05-11 descope pattern (DIST-05/06,
  IOS-01..07, SEARCH-V2-01).

## Tasks

1. **`imu-liveness-check.md`** — add a top-of-file descope banner (mirrors the banner style in
   `idea-brief.md` / `CLAUDE.md`); reverse §9's "promote to MVP-or-near-MVP" recommendation so
   it reads as a v2 anti-fraud item.
2. **`.planning/REQUIREMENTS.md`** — relocate FRAUD-03 and FRAUD-04 out of the active Anti-fraud
   section into the §v2 Anti-fraud subsection (keep IDs, mirroring DIST-05/06 handling); add a
   `>` descope note in the active section; reword FRAUD-06 so the `liveness_score` dashboard
   component is conditional on the deferred check; add FRAUD-03 / FRAUD-04 rows to the
   traceability table (v2 / Deferred 2026-05-11); update the "Last updated" footer line.
3. **`.planning/ROADMAP.md`** — remove the "promoted-from-v2 IMU liveness fraud check" clauses
   from the Overview paragraph, the Phase 5 checklist line, the Phase 5 goal, and Phase 5 SC#5;
   remove FRAUD-03 / FRAUD-04 from Phase 5's Requirements list; add IMU liveness to the "parked
   in §v2" pointer.
4. **`.planning/STATE.md`** — add a Roadmap Evolution entry (2026-05-11) for the reversal; add a
   Decisions bullet reversing the earlier promotion; add a Deferred Items table row; append the
   Quick Tasks Completed row; bump the Last-activity lines.
5. **`deferred-decisions.md`** — add a "Server-side IMU liveness check" entry under Fraud &
   integrity noting it was considered for MVP-promotion but kept deferred (revisit: v2
   anti-fraud sprint).
6. **`CLAUDE.md`** — add a `> **IMU liveness check deferred 2026-05-11.**` banner alongside the
   existing audio-drop / MVP-descoped banners, with the trail.

## Out of scope

- Completed-phase planning artifacts (Phase 1–4 RESEARCH / CONTEXT / DISCUSSION-LOG references
  to IMU liveness) — historical, left untouched.
- Any code. There is no implementation of FRAUD-03/04 yet (Phase 5 is unstarted).
- `idea-brief.md` — already lists fraud defenses as deferred; the server-side check isn't named
  there, so no edit needed.

## Verify

- `grep -n "promoted from v2\|promoted-from-v2" .planning/ROADMAP.md .planning/REQUIREMENTS.md` → no live promotions remain (only historical/struck context).
- `imu-liveness-check.md` opens with the descope banner; §9 no longer recommends MVP promotion.
- `REQUIREMENTS.md` §v2 Anti-fraud lists FRAUD-03 + FRAUD-04; traceability table has both as v2 / Deferred 2026-05-11.
- `CLAUDE.md` has the IMU-liveness-deferred banner.
- `STATE.md` Quick Tasks Completed table has the 260511-kfs row.
