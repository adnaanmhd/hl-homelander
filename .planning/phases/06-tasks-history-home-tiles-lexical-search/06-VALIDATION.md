---
phase: 6
slug: tasks-history-home-tiles-lexical-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest 4.1.5 (backend) / jest (mobile) — see 06-RESEARCH.md "Validation Architecture" for the per-component picks |
| **Config file**        | TBD by planner                                                                                                    |
| **Quick run command**  | `{quick command}`                                                                                                 |
| **Full suite command** | `{full command}`                                                                                                  |
| **Estimated runtime**  | ~{N} seconds                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

> Filled in by the planner from 06-RESEARCH.md "Validation Architecture".

| Task ID   | Plan | Wave | Requirement | Threat Ref   | Secure Behavior                     | Test Type | Automated Command | File Exists | Status     |
| --------- | ---- | ---- | ----------- | ------------ | ----------------------------------- | --------- | ----------------- | ----------- | ---------- |
| {N}-01-01 | 01   | 1    | REQ-{XX}    | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit      | `{command}`       | ✅ / ❌ W0  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `{tests/test_file.py}` — stubs for REQ-{XX}
- [ ] `{tests/conftest.py}` — shared fixtures
- [ ] `{framework install}` — if no framework detected

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

> 06-MANUAL-SMOKE.md (authored by the planner per STATE Pattern 56) is the canonical hand-walk script — list it here, plus anything explicitly device-bound.

| Behavior   | Requirement | Why Manual | Test Instructions |
| ---------- | ----------- | ---------- | ----------------- |
| {behavior} | REQ-{XX}    | {reason}   | {steps}           |

_If none: "All phase behaviors have automated verification."_

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
