# Phase 3: HumynCapture Native Module (Bytes-on-disk) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 3-HumynCapture Native Module (Bytes-on-disk)
**Areas discussed:** HumynCapture JS API + segmentation ownership; Storage layout + practice segregation + cleanup; CAP-19 floor-reject + foreground-service ownership

---

## Pre-discussion meta

User selected three of four offered gray areas (HumynCapture JS API,
Storage layout, CAP-19 + FGS). The fourth offered area — "Wave 1
cosmetic fix-up scope" — was explicitly **deferred to a post-soak
scoping pass**. User's framing (verbatim): "we will discuss wave 1 when
the soak test is complete from phase 2. Then we will have a concrete
comprehensive cosmetic gap list. How do we do this".

Resolution captured in CONTEXT.md `<decisions>` D-WAVE-01..03:

- Wave 1 (cosmetic fix-up) is structurally locked as the first wave.
- Wave 2+ (HumynCapture) is blocked on Wave 1 commit.
- Wave 1 detailed plan content (one bundled plan vs split, snapshot-
  test infra placement, navigator-impacting items) is deferred until
  Phase 2 §10–§13 smoke completes and `02-COSMETIC-GAPS.md` gets
  stamped `status: frozen-YYYY-MM-DD`.
- Default route: skip a re-discuss-phase pass; `/gsd:plan-phase 3`
  reads the frozen gap list directly. Re-running `/gsd:discuss-phase
3 --update` is available if needed.

---

## Area 1 — HumynCapture JS API + segmentation ownership

### Q1.1 Segmentation owner

| Option                                         | Description                                                                        | Selected                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| Kotlin module owns timer                       | JS calls `start()` once, module schedules cuts, emits `onSegmentComplete` per cut  | ✓ (Claude-recommended after user said "you decide") |
| JS owns timer                                  | JS schedules `setTimeout(10min)`, calls stop+start; one `start/stop` = one segment |                                                     |
| Hybrid — module fires cut, JS confirms restart | Module emits `onSegmentBoundary`, JS calls `continueSession()`                     |                                                     |

**User's choice:** "you decide"
**Notes:** Locked by Claude with reasoning: IMU samples arrive every ~2.4 ms at 416 Hz — JS bridge round-trip in the IMU writer hot path is unacceptable. §4.3 says auto-segment cuts are silent (no TTS / haptic / gate re-run), so JS has nothing UX-side to do during the cut. Veto window preserved via JS being able to call `stop()` between segment events.

### Q1.2 JS-side API shape

| Option                              | Description                                                           | Selected |
| ----------------------------------- | --------------------------------------------------------------------- | -------- |
| Promise + event emitter             | `start(opts) → Promise<{sessionId}>`; events via `NativeEventEmitter` | ✓        |
| Pure event emitter, fire-and-forget | `start(opts)` returns void; everything via events                     |          |
| Callback API (Node-style)           | `start(opts, cb)`                                                     |          |

**User's choice:** Promise + event emitter
**Notes:** Matches Phase 1/2 codebase Promise convention; ergonomic for Phase 4's RecordingScreen state machine; failures surface via Promise rejection on the triggering operation. Native event payload contracts captured in CONTEXT.md D-API-03.

### Q1.3 Phase 3 verification harness

| Option                                                                   | Description                                                                                         | Selected |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------- |
| Debug "Capture Test" RN screen, apkRollout-only, BuildConfig.DEBUG-gated | Tiny RN screen calling `HumynCapture.start({…synthetic opts…})` for real-device 10-min verification |          |
| Native-side test activity (debug variant only)                           | Standalone `CaptureTestActivity.kt` launchable via `adb shell am start`                             |          |
| Defer all HumynCapture verification to Phase 4                           | Phase 3 ships module + unit tests; Phase 4 smoke walk doubles as Phase 3 acceptance                 | ✓        |

**User's choice:** Defer all HumynCapture verification to Phase 4
**Notes:** Saves throwaway scaffolding. Trade-off: Phase 3's success-criteria #1–#5 from `ROADMAP.md` (10-min recording, byte-for-byte fidelity, segmentation, drift, hashing) become "module ready, full E2E verification deferred to Phase 4 smoke walk". CONTEXT.md flags this so the Phase 3 verifier doesn't fail Phase 3 for missing real-device proof.

### Q1 wrap-up — Claude's discretion items locked

- 0.5 s gap mechanic = concurrent finalize (segment N+1 starts immediately; segment N's SHA + drift + metadata-JSON run on a worker thread).
- Error semantics on encoder/storage crash = fragmented MP4 up to last 30 s flush stays on disk, partial CSV stays, NO metadata JSON written for the crashed segment; emit `onError({code, segmentId, recoverable})` then `onSessionStop`.

---

## Area 2 — Storage layout + practice segregation + cleanup

### Q2.1 Storage layout for real recordings

| Option                                                    | Description                                           | Selected |
| --------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Flat: `filesDir/recordings/{filenameBase}.{mp4,csv,json}` | Three sibling files per segment, one dir              | ✓        |
| Per-segment subdir keyed on ULID `recordingId`            | One ULID-named subdir per segment, three files inside |          |
| Per-segment subdir keyed on `filenameBase`                | Same as above but dir name = filename base            |          |

**User's choice:** Flat
**Notes:** Phase 5's upload pipeline globs `recordings/*.mp4` and finds siblings by base name. App-launch orphan sweep is a single `ls`. Trade-off: a 25-min session = 9 files in one dir, manageable.

### Q2.2 Practice segregation

| Option                                                          | Description                                                  | Selected |
| --------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| Separate dir: `filesDir/practice/{filenameBase}.{mp4,csv,json}` | Practice writes to `practice/`, real writes to `recordings/` | ✓        |
| Same dir + `_practice` filename suffix                          | Filename convention extension                                |          |
| Same dir + `.practice` sentinel sibling file                    | Empty sentinel file per practice triple                      |          |

**User's choice:** Separate dir
**Notes:** Upload pipeline globs ONLY `recordings/`. Practice is invisible to upload by directory boundary, not by flag check. Metadata JSON schema is identical for both (no schema fork). The directory IS the segregation.

### Q2.3 Cleanup ownership

| Option                                                        | Description                                                                                          | Selected               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| HumynCapture owns app-launch sweep (recordings + practice)    | Phase 3 sweeps orphan `.mp4`s without `.json` (re-finalize attempt); cleans practice older than 24 h | ✓ (Claude-recommended) |
| HumynCapture sweeps orphans only; practice cleanup is Phase 4 | Practice-complete screen explicitly deletes practice files                                           |                        |
| JS-side sweep service; native stays storage-only              | RN service enumerates and decides                                                                    |                        |

**User's choice:** HumynCapture owns its dirs
**Notes:** Phase 3 self-contained; recovers automatically from crashes; doesn't need Phase 4/5 to land first. Re-finalize uses per-segment `.session.json` sidecar (D-FS-05).

### Q2 wrap-up — Claude's discretion items locked

- Per-segment `.session.json` sidecar layout captured in CONTEXT.md `<specifics>`. Sidecar lives next to the MP4, deleted at the moment of final-`.json` write so an orphan sidecar = unambiguous crash signal.

(Q2.4 satisfaction-check skipped; surface well-defined.)

---

## Area 3 — CAP-19 IMU floor-reject + foreground service ownership

### Q3.1 CAP-19 floor-reject policy

| Option                                                     | Description                                                                                         | Selected |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Mid-record reject — end segment, mark, skip queue          | Sliding-window rate; <80 Hz across two windows ends segment                                         |          |
| Finalize-only mark — record figure, let QA decide          | Module observes throughout, computes `imu_min_rate_hz_observed_p1` only at finalize, server filters | ✓        |
| Refuse session start if compat <80 Hz, no mid-record check | Trust compat-check                                                                                  |          |

**User's choice:** Finalize-only mark
**Notes:** CAP-19's wording ("rejects segments client-side") is honored by client-side _measurement_ + server-side filtering rather than mid-record stopping. Interpretation flagged in CONTEXT.md D-IMU-01 so planner does not re-litigate. `imu_min_rate_hz_observed_p1` is a NEW field added to `video_metadata.json`; schema_version → `1.1.0`.

### Q3.2 Foreground service ownership

| Option                                                         | Description                                                 | Selected   |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ---------- | ---------------------------------------------- | --- |
| Phase 3 ships `HumynForegroundService`; Phase 5 extends        | Single service, type downgrades from `camera                | microphone | dataSync`to`dataSync`via`setUploadActive` seam | ✓   |
| Two services: CaptureFgsService + UploadFgsService             | Each phase ships its own service                            |            |
| Phase 3 ships only capture lifecycle; FGS is Phase 5's problem | Phase 5 refactors HumynCapture's service to be downgradable |            |

**User's choice:** Phase 3 ships HumynForegroundService; Phase 5 extends
**Notes:** Lifecycle transitions stay in one place; type-downgrade is atomic; brief's description honored verbatim. `setUploadActive(boolean)` seam is no-op in Phase 3, wired in Phase 5.

### Q3.3 Thermal handling ownership

| Option                                | Description                                                                                        | Selected |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| HumynCapture owns both checks         | `start()` reads `getCurrentThermalStatus()`; module subscribes to `OnThermalStatusChangedListener` | ✓        |
| JS pre-flight; module mid-record only | Phase 4 reads thermal before `start()`; module owns SEVERE-listener                                |          |
| JS owns both; module is dumb pipe     | Phase 4 polls throughout, calls `stop()` on SEVERE                                                 |          |

**User's choice:** HumynCapture owns both checks
**Notes:** Thermal policy localized in one Kotlin file; JS can't bypass via stale read; matches the brief's "segment ends cleanly within ~2.5 s" as a native-controlled timeline.

### Q3.4 Final wrap-up

| Option                                    | Description                                     | Selected |
| ----------------------------------------- | ----------------------------------------------- | -------- |
| No — ready for CONTEXT.md                 | Write CONTEXT.md with locked decisions and refs | ✓        |
| Yes — I have one more thing               | User adds a final item                          |          |
| Re-discuss Wave 1 cosmetic-fixup approach | Open the deferred Wave 1 conversation now       |          |

**User's choice:** No — ready for CONTEXT.md
**Notes:** Folded remaining Area 3 items as planner-level notes (no question burn): CAP-13 pause-uploads is a no-op in Phase 3 (Phase 5 wires); IMU sensor batching `maxReportLatency` ≈200 ms (planner picks); `imu_min_rate_hz_observed_p1` schema-extension confirmed.

---

## Claude's Discretion (consolidated)

Areas where the user said "you decide" or where decisions were trivially Claude's call:

- Segmentation owner (Area 1 Q1.1 — user said "you decide", Claude locked Kotlin module owns timer)
- 0.5 s gap mechanic = concurrent finalize
- Error semantics on crash (event taxonomy + which files survive)
- IMU sensor batching `maxReportLatency` exact value
- `imu_min_rate_hz_observed_p1` exact computation window (sliding vs whole-segment)
- Per-day filename `_NNN` recovery strategy (MMKV vs ls-derived)
- Camera2 device selection sharing with Phase 2's DeviceCaps (extract util vs duplicate vs read-from-MMKV)
- Audio source mode (`MIC` vs `VOICE_RECOGNITION`)
- Encoder buffer pool size + pre-allocation
- `HumynCapture.ts` JS surface file location (planner ships at `apps/mobile/src/native/HumynCapture.ts`)
- Wave 1 plan layout (one bundled vs split — deferred to plan-phase against frozen gap list)
- Visual-snapshot test framework choice
- Re-finalize edge-case discard-vs-truncate rules

## Deferred Ideas (consolidated)

Captured in CONTEXT.md `<deferred>` section. Highlights:

- **Wave 1 detailed scope** — deferred to post-Phase-2-soak scoping pass.
- **Hand-gate (HAND-01..14)** — Phase 4.
- **Recording surface state machine (REC-01..16)** — Phase 4.
- **§10 lifecycle edges (rotation / call / alarm / battery / storage)** — Phase 4.
- **Practice-recording UX flow (ONB-03..07)** — Phase 4 (Phase 3 segregates files only).
- **Upload pipeline (UP-01..19)** — Phase 5.
- **Hash-verify worker + IMU-liveness backend check** — Phase 5.
- **iOS analogue** — Phase 8.
- **TTS voice line wiring for thermal abort** — Phase 4 (Phase 3 emits the event).
- **Battery alert + low-battery refuse + ≤5% segment-end** — Phase 4.
- **Stale clan-chief / KGeN narrative cleanup** in PROJECT.md / REQUIREMENTS.md / ROADMAP.md / `idea-brief.md §3.1` — remains deferred (not phase-scoped; needs `/gsd:cleanup` or manual edit pass).

## Anti-pattern carry-over from Phase 2 `.continue-here.md`

Three blocking anti-patterns demonstrated and acknowledged at the top of this discussion:

1. **Pattern 65 — blanket `git add` on backlog files** — surgical-stage protocol applies to protected files (`SignupScreen.tsx`, `Text.tsx`, `CLAUDE.md`). For this `/gsd:discuss-phase 3` invocation, only the new `.planning/phases/03-humyn-capture-native-module/` files are added.
2. **Cosmetic chasing during smoke walk** — visual fixes go into `02-COSMETIC-GAPS.md` (parking lot); Wave 1 of Phase 3 is the dedicated cleanup pass.
3. **Lowering capture-spec thresholds to "unblock" smoke walk** — explicitly carried into CONTEXT.md `<decisions>` "Locked from upstream" block.

---

# Update session — 2026-05-10 (post-Phase-2-soak)

**Trigger:** `/gsd:discuss-phase 3 --update`. Phase 2 closed today
(commits `94dfce6` security 61/61 verified, `5d038e2` UAT 8/0,
`c2aa6dd` smoke complete on Pixel 10a). The "Wave 1 deferred to a
post-soak scoping pass" gate from D-WAVE-02 collapsed into a real
choice we could make now.

**Areas discussed:** Wave 1 scope freeze + plan layout; Wave 1 → Wave 2 acceptance gate.
**Areas offered but not selected:** Lock planner-discretion items
(IMU `maxReportLatency`, `imu_min_rate_hz_observed_p1` window, Camera2
lens-selection reuse, audio source mode, filename counter, FGS
notification UX); Other / new info from today's smoke.

---

## Wave 1 scope freeze + plan layout

### Q1 — Stamp `02-COSMETIC-GAPS.md` `frozen-2026-05-10`?

| Option                      | Description                                                                                                                                  | Selected |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Freeze now                  | Stamp frontmatter `status: frozen-2026-05-10`. Wave 1 plan written against this list exactly; new findings during re-walk become amendments. | ✓        |
| Freeze after Wave 1 re-walk | Keep `deferred-to-phase-3-wave-1` until the Pixel re-walk surfaces any final additions.                                                      |          |
| Don't freeze; leave living  | Treat as live; planner pulls latest at each plan-cut.                                                                                        |          |

**User's choice:** Freeze now. → D-WAVE-04 in CONTEXT.md.
**Notes:** Freeze stamp also added a `frozen:` line in the frontmatter pointing to D-WAVE-04 + D-WAVE-09 (amendment protocol).

### Q2 — Wave 1 plan layout

| Option                          | Description                                                                                        | Selected |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| Split: visual-only + nav-impact | Two plans: visual-fixup + functional-regressions. Navigator changes get their own commit boundary. | ✓        |
| One bundled plan                | Single `03-01-cosmetic-fixup-PLAN.md` covers everything.                                           |          |
| Three-way split                 | Visual-only / Navigator-impact / TopBar-avatar-cluster as three plans.                             |          |

**User's choice:** Split (visual + nav). → D-WAVE-05 with concrete plan filenames + scopes.
**Notes:** Plan 1 = `03-01-cosmetic-visual-fixup-PLAN.md`, Plan 2 = `03-02-cosmetic-functional-regressions-PLAN.md`, ordered (plan 2 depends on plan 1's logo asset baseline).

### Q3 — Visual-snapshot test infra

| Option                          | Description                                                                                             | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| jest-image-snapshot via Vitest  | Pixel-diff PNG baselines via `expect.extend` adapter. Catches CSS/layout regressions.                   | ✓        |
| Hand-rolled DOM-tree snapshot   | `toMatchSnapshot` against React tree. Fast; doesn't catch font/CTA/layout drift (tree shape unchanged). |          |
| Defer snapshot infra to Phase 4 | Wave 1 ships visual fixes + on-device re-walk only; Phase 4 sets up snapshot infra.                     |          |

**User's choice:** jest-image-snapshot via Vitest. → D-WAVE-06.
**Notes:** Baselines committed under `apps/mobile/__tests__/visual/__image_snapshots__/` (in-repo, not gitignored — see Q4 below for storage decision).

### Q4 — Logo asset re-export placement

| Option                                  | Description                                                                               | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Inside Wave 1 visual plan, as Task 1    | First task of `03-01-cosmetic-visual-fixup-PLAN.md`. Subsequent tasks build on new asset. | ✓        |
| Separate quick-task before Wave 1 plans | `/gsd:quick` lands the asset re-export standalone.                                        |          |
| Inline in each screen task              | Each screen-fix task does its own asset work.                                             |          |

**User's choice:** Inside Wave 1 visual plan, as Task 1. → D-WAVE-07.
**Notes:** Pre-crop 800×800 source, export `@1x/@2x/@3x` to `apps/mobile/src/assets/logos/`, re-run `npx react-native-asset` if needed, swap usages on Splash + Sign-up + Home. After Task 1 lands, snapshot baselines (D-WAVE-06) capture against the new asset.

---

## Wave 1 → Wave 2 acceptance gate

### Q1 — What unblocks Wave 2 plan-phase?

| Option                                            | Description                                                                  | Selected |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Both Wave 1 plans land + on-device re-walk passes | Both plans `done` + operator re-walks Pixel 10a + signs `03-WAVE1-SMOKE.md`. | ✓        |
| Wave 1 plans land + verify-work passes            | Both plans + `/gsd:verify-work` only — no operator re-walk.                  |          |
| Visual plan only, then parallelize                | Wave 2 plan-phase kicks off in parallel with plan 2 execution.               |          |

**User's choice:** Both Wave 1 plans land + on-device re-walk passes. → D-WAVE-08.
**Notes:** Operator-driven re-walk is required because pixel-perfect snapshots don't catch perceptual regressions ("the logo still looks small in person").

### Q2 — Re-walk device pool

| Option                                   | Description                                                                        | Selected |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Pixel 10a only                           | Same device as Phase 2 smoke. Phase 4 broadens to 7a + non-Pixel for thermal walk. | ✓        |
| Pixel 10a + Pixel 7a                     | Adds @2x vs @3x bucket validation + earlier OEM thermal surface.                   |          |
| Pixel 10a + 7a + non-Pixel (Samsung A55) | Three-device re-walk hits OEM-skin font-rendering.                                 |          |

**User's choice:** Pixel 10a only. → D-WAVE-08 step 3.
**Notes:** Scope-discipline call — Wave 1 is cosmetic-on-the-surface-Phase-2-already-validated; broader fleet belongs in Phase 4 (25-min thermal + 10-min E2E).

### Q3 — Protocol when re-walk surfaces a new gap

| Option                                                       | Description                                                                                                                            | Selected |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Append to `03-W1-AMENDMENTS.md` and fold into in-flight plan | New gaps to amendments doc; folded into current plan or `03-03` plan if both shipped. Wave 2 gate slips by exactly one plan execution. | ✓        |
| Defer all new gaps to a post-Wave-2 cleanup                  | Wave 1 ships exactly the frozen list; new findings to `03-99` post-HumynCapture plan.                                                  |          |
| Block Wave 2 on amendments                                   | Same as option 1 but Wave 2 hard-gated on amendments plan executing first.                                                             |          |

**User's choice:** Append + fold into in-flight plan. → D-WAVE-09.
**Notes:** Avoids the Phase-2 anti-pattern of cosmetic items being punted forward indefinitely. NEVER edit `02-COSMETIC-GAPS.md` post-freeze (D-WAVE-04 + D-WAVE-09).

### Q4 — Snapshot baseline storage

| Option                                                             | Description                                                                                            | Selected |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- |
| In repo, under `apps/mobile/__tests__/visual/__image_snapshots__/` | Default jest-image-snapshot path; baselines version with source. ~10 PNGs × ~30–100 KB. No LFS needed. | ✓        |
| In repo, gitignored — generated by 'baseline' CI job               | Baselines built once, stored as CI artifact. Avoids PR PNG churn. Higher infra.                        |          |
| Defer storage decision to plan-phase                               | Lock framework only; planner picks shape.                                                              |          |

**User's choice:** In repo at default path. → D-WAVE-06.
**Notes:** Accepts PNG churn in PRs as the trade-off for transparent baseline review.

---

## New decisions added to CONTEXT.md by this update

- D-WAVE-04 — Freeze `02-COSMETIC-GAPS.md` 2026-05-10
- D-WAVE-05 — Wave 1 plan layout = SPLIT (visual + nav-impact); concrete plan filenames + scopes locked
- D-WAVE-06 — Visual-snapshot infra = jest-image-snapshot via Vitest; baselines in `apps/mobile/__tests__/visual/__image_snapshots__/`
- D-WAVE-07 — Logo asset re-export = Task 1 of `03-01-cosmetic-visual-fixup-PLAN.md`
- D-WAVE-08 — Wave 2 acceptance gate = both plans land + on-device re-walk on Pixel 10a + operator sign-off in `03-WAVE1-SMOKE.md`
- D-WAVE-09 — New-gap protocol during re-walk = `03-W1-AMENDMENTS.md` + fold into in-flight plan

## Removed from "Claude's Discretion" (now locked)

- Wave 1 plan layout (now D-WAVE-05)
- Visual-snapshot test infra (now D-WAVE-06)

## Edits to upstream artefacts

- `02-COSMETIC-GAPS.md` frontmatter: `status: deferred-to-phase-3-wave-1` → `status: frozen-2026-05-10` + new `frozen:` line pointing to D-WAVE-04 / D-WAVE-09.

## Side-effect files referenced (created later by Wave 1 plans)

- `03-W1-AMENDMENTS.md` — created during re-walk if needed (D-WAVE-09)
- `03-WAVE1-SMOKE.md` — created by `03-02-cosmetic-functional-regressions-PLAN.md`'s last task; pattern-matches Phase 2's `02-MANUAL-SMOKE.md`
