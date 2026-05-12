---
phase: 5
slug: upload-pipeline-hash-verify-worker-anti-fraud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest (backend `apps/api`) / jest (mobile `apps/mobile`) — see RESEARCH.md § Validation Architecture                           |
| **Config file**        | `apps/api/vitest.config.ts` / `apps/mobile/jest.config.js` (planner to confirm; Wave 0 adds any missing harness for the worker) |
| **Quick run command**  | `pnpm --filter @humyn/api test -- <changed-file>` / `pnpm --filter mobile test -- <changed-file>`                               |
| **Full suite command** | `pnpm --filter @humyn/api test && pnpm --filter mobile test`                                                                    |
| **Estimated runtime**  | ~{TBD by planner} seconds                                                                                                       |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched workspace
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {TBD by planner} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement   | Threat Ref | Secure Behavior                     | Test Type                   | Automated Command | File Exists | Status     |
| ------- | ---- | ---- | ------------- | ---------- | ----------------------------------- | --------------------------- | ----------------- | ----------- | ---------- |
| 5-XX-XX | XX   | N    | UP-/VERIFY-XX | T-5-XX / — | {expected secure behavior or "N/A"} | unit / integration / manual | `{command}`       | ✅ / ❌ W0  | ⬜ pending |

_Planner fills this from PLAN.md tasks during planning. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Worker test harness for `apps/api` hash-verify worker (BullMQ + ioredis-mock or testcontainers Redis) — if not already present
- [ ] Shared fixtures: a stub finalized bundle (MP4 + IMU CSV + metadata JSON with known `file_sha256` / `imu_sha256`) for re-hash assertions
- [ ] Any missing vitest/jest config for the new module surfaces

_If none discovered during planning: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                                                                                                                        | Requirement                  | Why Manual                                                 | Test Instructions                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OEM battery-optimization walkthrough deep-links resolve / fall back to AOSP screen                                              | UP-09                        | Per-OEM ROM behavior; intent resolution is device-specific | On Xiaomi/Oppo/Vivo/Samsung/stock hardware: trigger first-upload walkthrough, confirm each step opens the right settings screen or the AOSP `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` fallback |
| Upload survives background / force-quit / Doze                                                                                  | UP-06, UP-07                 | OS lifecycle behavior not reproducible in unit tests       | Start upload, background app, force-quit, wait through Doze; confirm upload resumes via FGS / UIDT JobService                                                                                      |
| `dataSync` 6-hour cap → `onTimeout()` → UIDT JobService handoff                                                                 | UP-07                        | Requires Android 15 device + long-running upload           | On API 35 device: start a long upload, observe `Service.onTimeout()` fires and UIDT job continues                                                                                                  |
| TCP no-progress watchdog: 30 s stall → abandon socket → retry fresh connection                                                  | UP-19                        | Needs flaky/CGNAT network (Jio / Vivo Brasil)              | On a CGNAT cellular link: induce a stalled chunk, confirm the watchdog abandons and a new socket completes it                                                                                      |
| `verified` / `re-upload` event piggy-back delivered on next authenticated API response → local files deleted only on `verified` | VERIFY-03/04/05, UP-14/15/16 | End-to-end across worker + API + app                       | Upload a bundle, let worker flip `qa_status`, make any authenticated API call, confirm event arrives and app deletes locals (verified) or re-uploads (mismatch)                                    |
| Alert-cue tones audible at full media volume (D-06)                                                                             | REC-11 / cleanup             | Audio output device-state dependent                        | Wave-1 smoke runbook: re-check battery-15% beep + thermal-abort tone sequence with media volume at max                                                                                             |
| RotatePrompt portrait-phone glyph reads as "rotate your phone" (D-09)                                                           | cleanup                      | Visual judgement                                           | Eyeball on-device                                                                                                                                                                                  |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or appear in Manual-Only above with a reason)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
