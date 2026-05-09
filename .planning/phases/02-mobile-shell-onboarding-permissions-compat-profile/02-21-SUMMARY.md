---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 21
subsystem: testing
tags: [manual-smoke, runbook, crashlytics, force-upgrade, open-questions, threat-mitigation]

# Dependency graph
requires:
  - phase: 02-mobile-shell-onboarding-permissions-compat-profile
    provides: All Phase 2 user-facing surface (02-01..02-20) + CI gates (02-22). The runbook walks the full authenticated surface from cold-start through Logout/Delete on a real Pixel-class device.
  - phase: 01-foundation-backend-distribution-recon
    provides: 13-MANUAL-SMOKE.md (Phase 1 analog with the same numbered-checkbox + commands + assertions shape)
provides:
  - apps/mobile/02-MANUAL-SMOKE.md — 13-section, 85-checkbox operator-driven runbook covering cold-start gate decision tree (4 paths) + Sign-up + Permissions + Compat happy/fail + RigTutorial + Tab structure + Profile (PROF-01..05 + AUTH-08..10) + Help Center + ForceUpgrade APK install (with hash-mismatch path) + ForceUpgrade Play Store hand-off + Soft-banner + Crashlytics ≥ 1 h soak gate
  - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md — three OQs tracked with file-level placeholder enumeration, resolution paths, owners, and Phase 7 targets (OQ-1 [EMAIL_ADDRESS], OQ-2 compat-fail wording, OQ-3 APK SHA-256 disclosure carry-forward)
  - T-2.21-01 mitigation: explicit Crashlytics-gate operator-signoff line in the runbook (Section 13)
affects:
  [
    phase-7-observability-ios-staged-rollout,
    phase-3-humyncapture,
    phase-4-handdetector-recording-ux,
    phase-5-upload-pipeline,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern 56: phase-end manual smoke runbook shape — copy of Phase 1 13-MANUAL-SMOKE.md (numbered sections + per-step Inputs / Assertions blocks + adb / curl / psql commands inline). Single committed markdown file under apps/mobile/02-MANUAL-SMOKE.md the operator walks step-by-step on a real device. Pre-flight + Sign-off bookends. The Crashlytics ≥ 1 h soak gate is the threat-register-mandated ship gate (T-2.21-01).'
    - 'Pattern 57: Open Questions file shape — per-OQ enumeration of placeholder occurrences with file + line numbers (so the resolver can search-and-replace atomically), explicit resolution path, why-deferred justification, owner, Phase-N target. Lives under .planning/phases/XX-name/XX-OPEN-QUESTIONS.md and carries forward into the next phase entry checklist.'

key-files:
  created:
    - apps/mobile/02-MANUAL-SMOKE.md
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md
  modified: []

key-decisions:
  - 'Phase 2: Plan 02-21: Runbook shape mirrors Phase 1 13-MANUAL-SMOKE.md (numbered checkbox sections + Inputs / Assertions + Sign-off) with three Phase 2-specific extensions: a 4-path cold-start gate decision tree at Section 1 (covers UPG-01/02/05 + AUTH-07 + COMPAT-04/05/06 in one section instead of duplicating across screens); an explicit hash-mismatch path inside Section 10 (force_upgrade_apk_hash_mismatch Analytics event + Pattern 50 reference proving launchInstaller is structurally never called after rejection — T-2.20-01 mitigation re-verified on-device); and a dedicated Crashlytics ≥ 1 h soak gate at Section 13 with operator sign-off line (T-2.21-01 mitigation per the threat register).'
  - 'Phase 2: Plan 02-21: 02-OPEN-QUESTIONS.md enumerates FIVE [EMAIL_ADDRESS] occurrences (not three as the plan body listed): help-center-content.md (source), content.json (derived), HelpCenterScreen.tsx, CompatRecoveryScreen.tsx, AND RigTutorialScreen.tsx (T-2.11-01 — ONB-02 off-ramp mailto). Listing all five as one atomic-replacement set protects against partial-rollout drift (one surface real, others placeholder) at Phase 7 entry. Rule 1 — augmented the plan-body list when grep across apps/mobile/src/ surfaced the additional RigTutorialScreen occurrence.'
  - 'Phase 2: Plan 02-21: Task 3 is the operator-driven smoke walk on a physical Pixel 7a/8a/10a; this plan ships the runbook + Open Questions tracker BEFORE the operator walks it. The smoke walk itself produces a deferred sign-off commit (`docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work`) when the operator finishes. Plan-counter advancement to 21/22 happens NOW; phase-completion gate fires only after the operator commits the walked runbook (gsd-verify-work flow).'

patterns-established:
  - 'Pattern 56: phase-end manual smoke runbook shape (numbered checkbox sections + Inputs / Assertions + Sign-off + Crashlytics ≥ 1 h gate)'
  - 'Pattern 57: Open Questions file shape (per-OQ placeholder enumeration with file + line + resolution path + owner + Phase-N target)'

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-05-09
---

# Phase 02 Plan 21: Manual Smoke Runbook + Open Questions Tracker Summary

**Authored apps/mobile/02-MANUAL-SMOKE.md (13 sections, 85 checkboxes, T-2.21-01 Crashlytics ≥ 1 h soak gate) and 02-OPEN-QUESTIONS.md (3 OQs with per-file [EMAIL_ADDRESS] enumeration + resolution paths) — Phase 2 ship gate prepared; awaiting operator-driven on-device walk-through.**

## Performance

- **Duration:** ~5 min (authoring only — operator walk is a separate ≥ 1 h soak)
- **Started:** 2026-05-09T16:00:08Z
- **Completed:** 2026-05-09T16:04:38Z
- **Tasks:** 2 of 3 complete (Task 3 = operator-driven checkpoint, awaiting human-verify)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- 13-section operator runbook covering the entire Phase 2 user-facing surface end-to-end (cold-start gate decision tree → Sign-up + ToU → Permissions → Compat happy + fail → RigTutorial → Tab structure → Profile → Help Center → ForceUpgrade APK install (with hash-mismatch path) → ForceUpgrade Play Store hand-off → Soft-banner → Crashlytics ≥ 1 h soak gate → Sign-off)
- 85 operator checkboxes with explicit `adb` / `curl` / `psql` / `sha256sum` commands and assertions inline at every step (no command lookup needed during the walk)
- Threat-register mandated T-2.21-01 mitigation landed: explicit Crashlytics gate with operator sign-off line (`I confirm... 0 new fatal/non-fatal issues over a ≥ 1 h soak as of __ (timestamp UTC)`)
- 02-OPEN-QUESTIONS.md tracks three OQs:
  - **OQ-1:** [EMAIL_ADDRESS] — five placeholder occurrences enumerated by file + line, resolution path covers MD edit → `npm run build:help` re-bake → 3 TSX search-and-replace → re-test → atomic single-commit
  - **OQ-2:** Compat-fail "what now" recovery copy — current first-pass copy quoted verbatim, writer-pass deferred to Phase 7
  - **OQ-3:** APK SHA-256 fingerprint disclosure UX — Phase 1 carry-forward (planner-pick for Phase 7 if transparency narrative needs it)
- Cross-references wired bidirectionally: smoke runbook ↔ Open Questions ↔ 02-VALIDATION.md § Manual-Only Verifications ↔ 13-MANUAL-SMOKE.md (Phase 1 analog)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author 02-MANUAL-SMOKE.md runbook** — `44c686d` (docs)
2. **Task 2: 02-OPEN-QUESTIONS.md tracking placeholder + final-wording items** — `855fee9` (docs)
3. **Task 3: Operator walks 02-MANUAL-SMOKE.md on a real Pixel-class device** — DEFERRED (`checkpoint:human-verify`, awaits operator commit `docs(02-21): manual smoke complete on Pixel 7a — Phase 2 ready for verify-work`)

**Plan metadata commit (this SUMMARY + STATE/ROADMAP updates):** TBD — committed in the metadata commit at end of plan.

## Files Created/Modified

- `apps/mobile/02-MANUAL-SMOKE.md` — Phase 2 operator-driven manual smoke runbook (CREATED, 13 sections, 85 checkboxes, T-2.21-01 Crashlytics gate)
- `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` — Phase 2 Open Questions tracker (CREATED, 3 OQs with per-file placeholder enumeration + resolution paths)

## Decisions Made

See `key-decisions` in frontmatter — three decisions:

1. Runbook shape mirrors Phase 1 13-MANUAL-SMOKE.md with three Phase-2-specific extensions (cold-start decision tree, hash-mismatch path inside ForceUpgrade, Crashlytics ≥ 1 h gate with explicit operator sign-off).
2. 02-OPEN-QUESTIONS.md enumerates FIVE [EMAIL_ADDRESS] occurrences (the plan body listed three; grep across apps/mobile/src/ surfaced an additional RigTutorialScreen.tsx occurrence under T-2.11-01 — ONB-02 off-ramp). Documenting all five as an atomic-replacement set guards against partial-rollout drift.
3. Plan-counter advances to 21/22 NOW (this plan's authored deliverables are complete); phase-completion gate fires only after the operator commits the walked runbook with all sections passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Added RigTutorialScreen.tsx to OQ-1 placeholder enumeration**

- **Found during:** Task 2 (02-OPEN-QUESTIONS.md authoring)
- **Issue:** Plan body's `<read_first>` enumeration listed three [EMAIL_ADDRESS] occurrences (`help-center-content.md`, `content.json`, `HelpCenterScreen.tsx`, `CompatRecoveryScreen.tsx`). A grep across `apps/mobile/src/` surfaced a fourth runtime occurrence in `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx:39` (`const SUPPORT_EMAIL = '[EMAIL_ADDRESS]'`) powering the "Don't have a rig yet" off-ramp's mailto link. If the resolver missed this one at Phase 7, we'd ship a build with the real support email everywhere except the rig off-ramp — a classic partial-rollout drift bug.
- **Fix:** Listed all five files (source + derived + three runtime locations) in the OQ-1 table with explicit line numbers, and called out the partial-rollout drift risk in the OQ-1 description ("All five occurrences must flip to the real address atomically").
- **Files modified:** `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` (Task 2 commit `855fee9`).
- **Verification:** `grep -rn "EMAIL_ADDRESS" apps/mobile/src/ help-center-content.md` returns exactly the five files listed in OQ-1.
- **Committed in:** `855fee9` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 missing critical — completeness of placeholder enumeration).
**Impact on plan:** No scope creep — strengthened the same Open Question the plan body identified; the additional file is a runtime-mailto identical in shape to the two runtime occurrences the plan body did list.

## Issues Encountered

- Task 3 is `type="checkpoint:human-verify"` and requires a physical Pixel 7a/8a/10a class device + Firebase Crashlytics access + a ≥ 1 h soak window. This cannot be automated — it is the threat-register-mandated operator-driven gate (T-2.21-01). The plan ships the runbook + Open Questions tracker that the operator walks; the operator commits the walked runbook (with all sections ticked + Crashlytics sign-off) in a separate commit when complete.

## User Setup Required

None — no environment variables to configure for plan 02-21 itself. The smoke walk (Task 3) requires the operator to:

- Plug in a Pixel 7a/8a/10a class device with USB debugging enabled.
- Run the dev API: `pnpm --filter @humyn/api dev`.
- Build both APKs: `cd apps/mobile/android && ./gradlew assembleApkRolloutDebug && ./gradlew assemblePlayStoreDebug`.
- Walk `apps/mobile/02-MANUAL-SMOKE.md` end-to-end (Pre-flight checklist documents this).

## Next Phase Readiness

- **Phase 2 (this phase):** 21/22 plans complete after this plan's author-and-commit step; the 22nd plan (02-22 — CI gates) is already complete. Phase 2 ship gate is the operator's walked-and-signed runbook + Crashlytics zero-new-issues confirmation. Once Task 3 closes, Phase 2 → verify-work → complete.
- **Phase 7 (carry-forward):** OQ-1 ([EMAIL_ADDRESS]) and OQ-2 (compat-fail wording) MUST resolve before Play Store launch; OQ-3 (APK SHA-256 disclosure) is planner-pick. Phase 7 entry checklist should pull this Open Questions file.
- **Pattern catalog:** Pattern 56 (phase-end manual smoke runbook shape) and Pattern 57 (Open Questions file shape) added to the cross-phase pattern library; future phases (3 / 4 / 5 / 7) repeat the shape under `apps/mobile/0X-MANUAL-SMOKE.md` and `.planning/phases/0X-name/0X-OPEN-QUESTIONS.md` respectively.

## Self-Check: PASSED

- File `apps/mobile/02-MANUAL-SMOKE.md` exists (290 lines, 85 `- [ ]` checkboxes, 16 `## ` headers, contains "Crashlytics" + "EMAIL_ADDRESS" + hash-mismatch language).
- File `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-OPEN-QUESTIONS.md` exists (3 `## OQ-` entries, contains "EMAIL_ADDRESS" + "compat-fail").
- Commit `44c686d` exists in `git log` (Task 1).
- Commit `855fee9` exists in `git log` (Task 2).

---

_Phase: 02-mobile-shell-onboarding-permissions-compat-profile_
_Completed (authoring portion): 2026-05-09_
_Operator smoke walk + Crashlytics gate: PENDING (Task 3 checkpoint)_
