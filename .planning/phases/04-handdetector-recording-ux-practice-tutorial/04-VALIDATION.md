---
phase: 4
slug: handdetector-recording-ux-practice-tutorial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture. The planner refines this — it is a draft until the plan-checker confirms it.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest (RN + JS units, native-module mocks, fake timers) · `jest-image-snapshot` (visual baselines) · on-hardware smoke runbook `04-MANUAL-SMOKE.md` (Pixel 10a / 7a-class) |
| **Config file**        | `apps/mobile/vitest.config.ts` (planner confirms path against repo)                                                                                                         |
| **Quick run command**  | `npm --prefix apps/mobile test -- --run`                                                                                                                                    |
| **Full suite command** | `npm --prefix apps/mobile test -- --run` then visual-snapshot pass; on-hardware smoke is manual (`04-MANUAL-SMOKE.md`)                                                      |
| **Estimated runtime**  | ~30–60 s automated; manual smoke ~25–40 min/device                                                                                                                          |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix apps/mobile test -- --run` (scoped to the touched module where possible)
- **After every plan wave:** Run full automated suite + visual-snapshot pass
- **Before `/gsd-verify-work`:** Full automated suite green + `04-MANUAL-SMOKE.md` executed on at least one Pixel 7a-class device with drift `{max,mean,p99}` recorded for a gate-started recording
- **Max feedback latency:** ~60 seconds (automated); manual smoke is end-of-phase gated

---

## Per-Task Verification Map

> Filled by the planner once PLAN.md task IDs exist. Skeleton below maps the three requirement buckets to test types from `04-RESEARCH.md § Validation Architecture`.

| Task ID | Plan | Wave | Requirement                 | Threat Ref | Secure Behavior                                                                                                                                                                                                                                                           | Test Type                                                                                                                                                       | Automated Command                        | File Exists | Status     |
| ------- | ---- | ---- | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------- | ---------- |
| 4-XX-XX | XX   | 1    | HAND-01..14                 | —          | MediaPipe HandLandmarker IMAGE mode, `numHands=2`, CPU delegate; native-module-unavailable → silent bypass                                                                                                                                                                | native instrumented + RN integration (mocked native module, fake timers for gate cadence)                                                                       | `npm --prefix apps/mobile test -- --run` | ❌ W0       | ⬜ pending |
| 4-XX-XX | XX   | 1    | REC-01..16                  | —          | `recState` machine transitions per `engineering-handoff.md §4.3`; landscape lock at gate-pass; <60 s discarded, never persisted                                                                                                                                           | RN integration (reducer/state-machine unit tests, reuse Phase 3 pattern) + visual snapshot for recording surface states                                         | `npm --prefix apps/mobile test -- --run` | ❌ W0       | ⬜ pending |
| 4-XX-XX | XX   | 2    | REC (lifecycle)             | —          | `idea-brief.md §10` policy table — call-answered/alarm/rotation/force-quit/OS-evict/storage-full stop; call-declined continues; battery ladder 15%→alert, 5%→end                                                                                                          | RN integration (mock telephony/audio-focus/battery events) + on-hardware smoke for real call/alarm/eviction                                                     | `npm --prefix apps/mobile test -- --run` | ❌ W0       | ⬜ pending |
| 4-XX-XX | XX   | 2    | REC (TTS)                   | —          | voice-fallback chain en-IN female → en-IN any → en-US female → first en-\* per `engineering-handoff.md §6.3`; "Recording started" within same frame as 80 ms vibrate; overlay text duplicated for a11y                                                                    | RN unit (fallback selection over mocked `voices()`) + on-hardware smoke for actual speech timing                                                                | `npm --prefix apps/mobile test -- --run` | ❌ W0       | ⬜ pending |
| 4-XX-XX | XX   | 3    | ONB-03..08 + REC (practice) | —          | `practice = true` propagates capture → metadata.json → upload-queue exclusion → never in History → never counted; hard-cap auto-stop at exactly 60 s; tutorial once per install per Google account, no re-entry path; Practice-complete confetti + `[40,80,40]` ms haptic | RN integration (practice flag plumbing, MMKV key `tutorial.practice_done.{sub}.v1`, fake-timer 60 s cap) + visual snapshot for PracticeIntro / PracticeComplete | `npm --prefix apps/mobile test -- --run` | ❌ W0       | ⬜ pending |
| 4-XX-XX | XX   | \*   | Capture-quality invariant   | —          | Drift `{max,mean,p99}` ≤ ±1 ms re-measured on gate→record handoff and on every lifecycle-edge recovery (orphan-segment crash recovery included)                                                                                                                           | on-hardware smoke ONLY — reuse Phase 3 drift validation harness; record numbers in `04-MANUAL-SMOKE.md`                                                         | manual                                   | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/mobile/__tests__/handGate.test.ts` — stubs for HAND-01..14 (gate cadence, 2-hand detection, skip link from t=0, silent bypass, no re-run at 10-min cuts)
- [ ] `apps/mobile/__tests__/recState.test.ts` — stubs for REC-01..16 (state-machine transitions, landscape lock, <60 s discard, fresh-recording-on-re-press)
- [ ] `apps/mobile/__tests__/recordingLifecycle.test.ts` — stubs for `idea-brief.md §10` policy table + battery ladder
- [ ] `apps/mobile/__tests__/ttsVoiceFallback.test.ts` — stubs for the voice-fallback chain
- [ ] `apps/mobile/__tests__/practiceFlow.test.ts` — stubs for ONB-03..08 + practice-flag plumbing + tutorial-once enforcement
- [ ] Visual-snapshot baselines (~9–10 new) for: hand-gate overlay, recording surface (idle/active/stopping), "Don't exit while recording" overlay, battery alert pill, PracticeIntro (Rig screen), PracticeComplete (confetti)
- [ ] `04-MANUAL-SMOKE.md` — on-hardware runbook (template from `03-MANUAL-SMOKE.md`): gate→record drift re-measurement, lifecycle edges with real call/alarm/eviction, TTS speech timing, 60 s practice hard-cap
- [ ] Confirm vitest + native-module-mock + fake-timer infra already present from Phase 3 scaffolding; install only what's missing

_Planner must reconcile this list against the actual `apps/mobile` test layout._

---

## Manual-Only Verifications

| Behavior                                                         | Requirement                           | Why Manual                                                                                               | Test Instructions                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video↔IMU drift ≤ ±1 ms on gate-started recording               | Capture-quality invariant (CLAUDE.md) | Drift only observable on real camera+IMU hardware under load; the project's non-negotiable               | Run Phase 3 drift validation harness on a gate-started recording on Pixel 10a / 7a-class; record `{max,mean,p99}`; must not regress Phase 3 smoke 7 (mean 0.594 / p99 0.728 ms) |
| Drift survives lifecycle-edge recovery                           | REC (lifecycle)                       | Recovery paths re-call `HumynCapture.start()` after another process held the camera                      | After each forced edge (call, alarm, OS-evict, force-quit), if a new segment starts, re-run the drift harness                                                                   |
| Real phone call answered/declined behavior on OEM skins          | REC (lifecycle)                       | `TelephonyCallback` / audio-focus quirks differ on MIUI / ColorOS — see `.planning/research/PITFALLS.md` | On a Xiaomi and an Oppo device: place a call mid-recording, answer (segment stops per table), and decline (segment continues)                                                   |
| TTS "Recording started" fires within same frame as 80 ms vibrate | REC (TTS)                             | Speech-engine warmup latency is device/OEM dependent                                                     | On Pixel + one mid-range device, observe vibrate↔speech alignment at gate pass; confirm en-IN voice selected where available                                                   |
| Brightness restores on abnormal exit (force-quit / OS-evict)     | REC                                   | Brightness restore on background can be missed; observable only by leaving/returning                     | Force-quit during recording, relaunch, confirm screen brightness is back to system value                                                                                        |
| Confetti + `[40,80,40]` ms haptic on Practice-complete           | ONB-08                                | Haptic pattern + animation timing visual                                                                 | Complete the 60 s practice recording on hardware; confirm confetti animation and the three-pulse haptic                                                                         |
| Tutorial does not re-enter after completion / on re-login        | ONB-08                                | Cross-session, per-Google-account behavior                                                               | Complete tutorial; sign out; sign back in same account → no tutorial; reinstall → tutorial re-runs (intended)                                                                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (manual-only items enumerated above and accepted)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s (automated)
- [ ] Drift re-measurement on gate→record handoff is a [BLOCKING] manual gate before phase verification
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
