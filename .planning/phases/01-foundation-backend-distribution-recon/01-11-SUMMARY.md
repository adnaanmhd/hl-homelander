---
phase: 01-foundation-backend-distribution-recon
plan: 11
subsystem: backend-legal
status: code-ready-counsel-deferred
tags: [legal, consent, dpdp, lgpd, takedown, dsr, audit, boot-guard]

# Dependency graph
requires:
  - phase: 01
    plan: 02
    provides: Drizzle 11-table schema + consent_log table + 0001 migration
  - phase: 01
    plan: 04
    provides: Fastify buildApp() factory; problem-detail; idempotency
  - phase: 01
    plan: 05
    provides: /auth/google route + JWT issuance + integrity-policy
  - phase: 01
    plan: 08
    provides: DELETE /me + POST /me/restore + PATCH /me (DSR endpoints)
provides:
  - canonical consent text (verbatim idea-brief.md §5.2) + boot-time hash guard
  - migration 0005 (takedown_log + dsr_log audit tables)
  - dsr-export CLI script (apps/api/scripts/dsr-export.ts) + mailto-ops runbook
  - ANPD/DPB takedown SOP runbook
  - DPDP + LGPD counsel-engagement checklist (deliverable for real attorney review)
affects:
  [
    Phase 5 (hash-verify worker reads takedown_log on QA failure path); Phase 7 (Play Store launch — counsel sign-off pre-condition),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pattern: boot-time hash guard — verifyConsentTextHash() runs FIRST in buildApp() before any plugin/route registration; refuses to start on drift via ConsentTextDriftError'
    - 'Pattern: deterministic consent-text hash via scripts/legal-hash.ts (`pnpm legal:hash`) — single source of truth, regenerated on every consent-text edit'
    - 'Pattern: append-only audit tables (takedown_log, dsr_log) with IF NOT EXISTS guards — D-LEGAL-04 (takedown audit) + D-LEGAL-02 (DSR audit)'
    - 'Pattern: DSR via mailto + ops CLI — method-agnostic per D-LEGAL-02; NO /me/export HTTP route at MVP. Operator runs `pnpm dsr:build-export <user_id>` after receipt of mailto request, dumps PII to apps/api/dsr-exports/<user_id>/<export_id>.json (gitignored), audit row written to dsr_log'
    - "Pattern: takedown SOP uses real schema (recordings.qa_status='takedown') — not the prompt's stale takedown_state field"

key-files:
  created:
    - apps/api/src/legal/consent-text.ts (CONSENT_TEXT verbatim from idea-brief.md §5.2 + CONSENT_VERSION)
    - apps/api/src/legal/consent-text-hash.ts (CONSENT_TEXT_SHA256 — generated deterministically by scripts/legal-hash.ts)
    - apps/api/src/legal/boot-guard.ts (verifyConsentTextHash() + ConsentTextDriftError)
    - apps/api/src/db/migrations/0005_takedown_log.sql (takedown_log + dsr_log; IF NOT EXISTS; idempotent)
    - apps/api/scripts/legal-hash.ts (`pnpm legal:hash` regen tool)
    - apps/api/scripts/dsr-export.ts (`pnpm dsr:build-export` CLI; dumps users + profiles + recordings + contributions + events + consent_log; writes dsr_log audit row)
    - apps/api/test/legal/consent-text-hash.test.ts
    - apps/api/test/legal/boot-guard.test.ts
    - .planning/runbooks/dsr-mailto-export.md (ops-side mailto + CLI flow runbook)
    - .planning/runbooks/legal-takedown.md (ANPD/DPB takedown SOP — Phase A→D: receipt → identify → execute → respond)
    - .planning/legal/counsel-checklist.md (DPDP + LGPD engagement checklist — autonomous: false deliverable for real attorney)
  modified:
    - apps/api/src/db/schema.ts (takedownLog + dsrLog table declarations appended)
    - apps/api/src/app.ts (verifyConsentTextHash() runs FIRST in buildApp() before any plugin/route registration)
    - apps/api/src/routes/auth/google.ts (replaced PENDING_LEGAL_TEXT_HASH with real CONSENT_TEXT_SHA256; CONSENT_VERSION imported from consent-text.ts)
    - apps/api/package.json (`dsr:build-export` + `legal:hash` scripts wired)
    - .gitignore (apps/api/dsr-exports/ — per-user PII; never commit)

key-decisions:
  - "idea-brief.md §5.2 is canonical consent text per CLAUDE.md; plan body's reconstructed text added 'irrevocable license' + 30-day-grace language NOT in §5.2 — Rule 1 deviation: §5.2 wins. Documented in commit 9f853eb."
  - 'DSR via mailto + ops CLI (D-LEGAL-02): no /me/export HTTP route at MVP. Reduces attack surface; counsel-engagement step confirms regulatory acceptability.'
  - "Takedown SOP uses real schema (qa_status='takedown'); plan body referenced a stale takedown_state field that was never created. Reconciled in commit a8cbb5b."
  - 'D-LEGAL-01 reaffirmed: counsel review is a parallel ops track, NOT a hard gate on distribution. APK + Play Store + iOS rollouts proceed in parallel with counsel-checklist sign-off.'
  - 'Apply gate parity (post-hoc): same as 01-10 Terraform, the counsel engagement is gated on a human action (real attorney review). Plan ships as code-ready-counsel-deferred — autonomous deliverables complete; engagement is queued for the legal-ops backlog.'

requirements-completed:
  - LEGAL-01 # canonical consent text + boot-time hash guard
  - LEGAL-02 # DSR via mailto + ops CLI export
  - LEGAL-03 # consent_log column set + version pinning
  - LEGAL-04 # ANPD/DPB takedown SOP + takedown_log audit table

requirements-deferred:
  - LEGAL-05 # counsel-engagement sign-off — code-ready, attorney engagement deferred to legal-ops backlog

# Metrics
duration: ~14 min (commits at 21:43:31 → 21:52:51 IST)
completed: 2026-05-08
---

# Phase 01 Plan 11: Legal-Track Artifacts (Code-Ready, Counsel-Engagement Deferred)

**Canonical consent text + boot-time hash guard, DSR mailto-ops CLI, ANPD/DPB takedown SOP, DPDP + LGPD counsel checklist. Engagement with a real attorney is queued for the legal-ops backlog (analogous to 01-10's apply gate).**

## Performance

- **Duration:** ~14 min for autonomous tasks (21:43:31 → 21:52:51 IST). Counsel-engagement step is the autonomous: false gate; user deferred to a separate legal-ops session.
- **Tasks:** 3 / 4 autonomous tasks shipped + counsel-checklist deliverable for the 4th. Engagement step deferred per pattern 01-10.
- **Tests:** 7 new (115 / 115 total green).
- **Files created:** 11. **Modified:** 5.

## Accomplishments

- **Boot-time hash guard:** `verifyConsentTextHash()` runs first in `buildApp()` before any plugin/route registration. If `CONSENT_TEXT_SHA256` doesn't match the on-disk text, the API refuses to boot via `ConsentTextDriftError`. This means no consent-text-drift can ever reach a deployed environment.
- **Canonical consent text:** Verbatim from `idea-brief.md §5.2` per CLAUDE.md mandate. The hash is regenerated deterministically by `pnpm legal:hash` (W7 follow-through from plan 05).
- **Audit-log schema:** Migration 0005 adds `takedown_log` (D-LEGAL-04) + `dsr_log` (D-LEGAL-02), both append-only with `IF NOT EXISTS` guards (idempotent re-runs are safe). Applied to dev Postgres — `pnpm db:migrate` → "1 applied, 4 skipped".
- **DSR CLI:** `pnpm dsr:build-export <user_id>` dumps users + profiles + recordings + contributions + events + consent_log into `apps/api/dsr-exports/<user_id>/<export_id>.json` (gitignored — per-user PII never committed) and writes a `dsr_log` audit row.
- **Mailto-ops runbook:** `.planning/runbooks/dsr-mailto-export.md` — D-LEGAL-02 method-agnostic flow. NO `/me/export` HTTP route at MVP; operator workflow only.
- **Takedown SOP:** `.planning/runbooks/legal-takedown.md` — ANPD / DPB Phase A→D response runbook. Uses real schema (`recordings.qa_status='takedown'`); references migration-0005 takedown_log audit table.
- **Counsel checklist:** `.planning/legal/counsel-checklist.md` — DPDP + LGPD engagement checklist with sign-off slots. The autonomous: false step in plan 11 is where a real attorney ticks the boxes. Deferred per user decision (matches 01-10 pattern).
- **Existing test suite:** 115/115 green after consent-hash boot-guard wires in. The /auth/google route now uses `CONSENT_TEXT_SHA256` instead of the placeholder `PENDING_LEGAL_TEXT_HASH` from plan 05; existing /auth tests still pass without modification.

## Task Commits

1. **Task 1: consent text + deterministic hash + boot-guard** — `9f853eb` (consent-text.ts, consent-text-hash.ts, boot-guard.ts, app.ts wiring, /auth/google.ts placeholder swap, scripts/legal-hash.ts, 7 new tests)
2. **Task 1b: prettier fix** — `9bcab62` (cosmetic — pnpm legal:hash regen output now matches prettier print-width)
3. **Task 2: takedown_log + dsr_log + DSR CLI + mailto-ops runbook** — `7975a94` (migration 0005 + schema appends + dsr-export.ts + dsr-mailto-export.md + dsr-exports/ gitignore)
4. **Task 3: takedown SOP + counsel-engagement checklist** — `a8cbb5b` (legal-takedown.md + counsel-checklist.md)

## Counsel-Engagement Checklist (Task 4 — Deferred)

`/Users/adnaan/Documents/hl-homelander/.planning/legal/counsel-checklist.md` is the deliverable runbook the user takes to a real attorney. The user has chosen to defer the engagement to the legal-ops backlog (consistent with 01-10's apply gate deferral). Plan ships as **code-ready-counsel-deferred**.

## Deviations from Plan

### Rule 1 — Bug (consent text source)

The plan body reconstructed a consent-text variant with "irrevocable license" + 30-day-grace language that does NOT appear in `idea-brief.md §5.2`. CLAUDE.md mandates §5.2 as canonical. Reconciled by using §5.2 verbatim and documenting the deviation in commit `9f853eb`. The reconstructed text would have introduced regulatory exposure (DPDP / LGPD inconsistency between consent recorded vs consent presented).

### Rule 1 — Bug (takedown_state vs qa_status)

The plan body referenced a `takedown_state` field on `recordings`. No such field exists in migration 0001 — recordings has `qa_status` (enum: pending, verified, hash-mismatch, takedown, rejected). Reconciled in `legal-takedown.md` by using the real schema (`qa_status='takedown'`); migration-0005 takedown_log audit table holds the operator narrative.

### Rule 3 — Environmental

Migration runner from plan 02 is idempotent via the `schema_migrations` bookkeeping table (added in plan 05). 0005 applied cleanly with "1 applied, 4 skipped". No manual intervention required.

## Live Smoke (verified during Tasks 1-3)

- `pnpm legal:hash` regenerates `consent-text-hash.ts`; subsequent commits round-trip without diff.
- API boot with intentionally tampered `CONSENT_TEXT` raises `ConsentTextDriftError` and process exits non-zero — confirmed by the boot-guard test.
- `pnpm dsr:build-export <missing-user>` exits 3, no `dsr_log` row written; `dsr_log` row IS written for an existing user (verified via `psql`).
- All /auth/google tests still pass with real `CONSENT_TEXT_SHA256` replacing the prior placeholder.

## Issues Encountered

- **Org token-quota interruption mid-finalization** — orchestrator-side: subagent hit the org's monthly usage limit after Task 3 commit (a8cbb5b) but before SUMMARY.md was written. SUMMARY.md was hand-composed from the four detailed task commit messages by the orchestrator; STATE.md and ROADMAP.md updated by the orchestrator on resumption. No code work lost — all 4 atomic commits are on `main` and the live smoke results are recorded in commit messages.

## Next Phase Readiness

- **Ready for plan 01-13** (Wave 3 mobile sign-in scaffold) — auth pipeline now records correct consent text hash + version; Play Integrity gating in plan 05 already in place.
- **Ready for plan 01-12** (Wave 4 E2E tests + GitHub Actions CI) — consent-drift e2e test fixture is the natural next piece; existing 115/115 green suite already covers the boot-guard at the unit/integration layer.
- **Counsel engagement queued** — checklist is at `.planning/legal/counsel-checklist.md`. User can run engagement asynchronously in a separate legal-ops session; LEGAL-05 traceability re-opens then.

## Self-Check: PASSED

- All 11 created files exist on disk (verified via `ls`).
- All 5 modified files reflect the documented changes (verified via the commit diff list).
- All 4 task commits (`9f853eb`, `9bcab62`, `7975a94`, `a8cbb5b`) exist on `main`.
- 115/115 vitest tests green workspace-wide (per Task 1 + Task 2 commit messages).

---

_Phase: 01-foundation-backend-distribution-recon_
_Status: code-ready-counsel-deferred (Task 4 = real-attorney engagement, queued for legal-ops backlog per user decision)_
_Tasks committed: 4 / 4 (9f853eb, 9bcab62, 7975a94, a8cbb5b)_
_Generated: 2026-05-08_
