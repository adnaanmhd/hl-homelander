---
phase: 6
slug: tasks-history-home-tiles-lexical-search
type: cosmetic-gaps
canonical: false
created: 2026-05-14
status: open
---

# Phase 6 — cosmetic + deferred gaps from the manual smoke walk

Non-blocking findings surfaced during the `06-MANUAL-SMOKE.md` walk
(closed 2026-05-14). All §1–§6 acceptance items passed; the items here
are deferred polish, owner-vs-spec divergences, or recording-side bugs
that the player layer cannot fix on its own.

Pickup options (per the §7 amendments protocol in `06-MANUAL-SMOKE.md`):

- **Roll into Phase 7's plan-phase** as a single cleanup early plan, or
- **Dedicated cleanup plan before Phase 7 starts** — `/gsd-plan-phase`
  with this file as the source-of-truth ingest, or
- **Promote items individually** — most read as their own small plans.

Never write these back into the FROZEN Phase 4 / Phase 5 cosmetic-gaps
files — those are closed.

---

## 1. Tasks tab — pull-to-refresh inert

**Where:** `apps/mobile/src/screens/tasks/TasksScreen.tsx` —
`FlatList`.

**Observed:** Pull-to-refresh gesture is consumed visually (the rubber-
band) but doesn't refire `fetchTasks`. No `RefreshControl` is wired on
the `FlatList`.

**Spec position:** Not a Phase 6 requirement (TASK-01..10 don't mention
PTR). Cosmetic polish.

**Disposition:** Defer. Add a `RefreshControl` (mirror Plan 06-09's
HistoryScreen / HomeScreen pattern) in a follow-on cleanup plan.

---

## 2. TaskDetailsSheet — swipe-down dismiss inert

**Where:** `apps/mobile/src/components/TaskDetailsSheet.tsx`.

**Observed:** The sheet dismisses via backdrop tap + the `X` close
button, but the pan-down gesture isn't wired.

**Spec position:** TASK-05 acceptance is the `open + start-recording`
path only. Sheet dismiss-by-pan is not specified.

**Disposition:** Defer. If picked up: add `react-native-reanimated`-
based pan handler (already in deps) — mirror the
`RecordingControlsSheet` pattern.

---

## 3. AlertPill placement during battery-15 % alert

**Where:** `apps/mobile/src/components/AlertPill.tsx` consumers on the
RecordingScreen.

**Observed:** During the battery 15 % alert, the AlertPill renders in
the wrong spot. Owner wants it pinned at the **bottom of the recording
screen, below the Stop Recording button**.

**Spec position:** Owner directive — supersedes whatever the current
absolute-position is.

**Disposition:** Move the AlertPill render-slot to a footer-row below
`StopRecordingButton`. Single-file change in `RecordingScreen.tsx`.

---

## 4. §1 D-09 — HumynBeep audibility

**Where:** Plan 06-01 — `HumynBeep` (SoundPool) on Android 16 / Pixel
10a.

**Observed:** Beep is inaudible at trigger points. Plan 06-01 added the
`load → loadComplete → playTone request → play returned` instrumentation
and it shows the play-call returning a non-zero `streamID`, but the
device emits no sound.

**Spec position:** Originally HUMYN-BEEP-01 (audible cue on rec-start /
stop / segment boundary). Owner directive 2026-05-14 **"fuck the beep —
not required"** ([[feedback_d09_audibility_deferred]]).

**Disposition:** Deferred. Plan 06-01's instrumentation stays in
codebase (cheap, useful when revisited). Do not spawn `/gsd-debug`
cycles on this until the owner reopens it.

---

## 5. Home tab — custom date range is free-text input

**Where:** `apps/mobile/src/screens/home/HomeScreen.tsx` — custom range
date inputs.

**Observed:** Custom range is two `YYYY-MM-DD` TextInputs. Owner wants a
**calendar picker**.

**Spec position:** Plan 06-08 D-date-input deferred picker
(`@react-native-community/datetimepicker` not in deps). Free-text was
the locked acceptable for Phase 6.

**Disposition:** New plan in Phase 7 (or earlier cleanup): add
`@react-native-community/datetimepicker` to the pin table + replace the
two inputs with the platform picker. Confirm the picker honours device
locale + dark theme.

---

## 6. HOME-10 — OfflineBanner not wired to NetworkMonitor

**Where:** `apps/mobile/src/screens/home/HomeScreen.tsx` — Plan 06-08
Known Stub.

**Observed:** The JS `useState<boolean>` driving `<OfflineBanner/>`
isn't fed by the native NetworkMonitor event. Airplane-mode toggling
on-device doesn't show the banner.

**Spec position:** Plan 06-08 documented this as a Known Stub —
HOME-10's visual chrome shipped; the data binding was deferred to the
Phase 7 wiring pass.

**Disposition:** Promote to a Phase 7 plan (already on the implied
backlog). One-file change: subscribe to NetworkMonitor's connectivity
event and `setOffline(...)` from the listener; remove the local
`useState` initializer.

---

## 7. Pending Uploads row tap navigates to History, not `drainNowSafe`

**Where:** `apps/mobile/src/screens/home/HomeScreen.tsx` — Pending
Uploads row tap handler.

**Observed:** Tapping a Pending Uploads row navigates to History
(which shows the HIST-04 empty state because the recording isn't
server-side yet) instead of triggering `drainNowSafe` per the Phase 5
D-10 design.

**Spec position:** Phase 5 D-10 owns the tile-tap retry kick wiring;
this is not a Phase 6 issue.

**Disposition:** File against Phase 5 follow-on / cleanup. Until then,
the user-visible behavior is harmless (just lands on an empty History
row).

---

## 8. Player "View only — not downloadable." footer sticks

**Where:** `apps/mobile/src/screens/history/PlayerScreen.tsx` —
`styles.footer`.

**Observed:** The footer line is rendered as a persistent caption at
the bottom of the Player. Owner wants **toast-with-5s-fadeout**
behaviour.

**Spec position:** `design-spec.md §14` line 613 + `06-UI-SPEC.md`
line 291 + line 84 (`typography.caption` purpose) all describe a
persistent 12 / `text2` footer. Owner-vs-spec divergence.

**Disposition:** Needs a copy / interaction decision before code lands.
Options:

- (a) Convert to a transient toast (`<Toast/>` already exists from
  Phase 4) — auto-dismiss after 5 s on Player mount.
- (b) Keep persistent footer; revise `design-spec.md §14` to match.

Pick one, update `design-spec.md` + `06-UI-SPEC.md` accordingly so the
spec and the screen agree.

**Found:** 2026-05-14 §5 close-out.

---

## 9. Player drag-to-seek lands at byte 0 (fragmented-MP4 missing seek index)

**Where:** Two layers:

- Player wiring — correct as of fixpack `819fdf5` (PanResponder-based
  drag-to-seek, route-param duration seed, `pageX`-delta workaround
  for RN 0.83 + Fabric's `gestureState.dx === 0`).
- HumynCapture muxer — `apps/mobile/android/app/src/main/java/ai/
humynlabs/capture/capture/FragmentedMuxerWrapper.kt` (Plan 03-04 /
  CAP-02). Uses `androidx.media3.muxer.FragmentedMp4Muxer` with
  `setFragmentDurationMs(30_000)`.

**Observed:** Player's `HumynPlayer.seekTo(positionMs)` reaches
ExoPlayer's `seekTo` and `currentPosition` reports the requested
target — but the actual decoded frames stay at byte 0. Verified end-
to-end via Kotlin `Log.i` diagnostic during §5 walk:
`seekTo requested=129061 before=40999 after=129061
dur=-9223372036854775807`.

**Root cause:** The recording is fragmented MP4 (chosen for mid-
recording crash resilience per `idea-brief.md §6.6` — "playable up to
the last 30 s flush"). The output file structure shows:

- `mvhd.duration = 0` (normal for fmp4 — per-fragment durations live in
  each `moof`).
- `tkhd.duration = 0` (same reason).
- **No `sidx` (segment index) box** at the start of the file.
- **No `mfra` (movie-fragment random access) box** at the end.
- `nb_frames=N/A` from ffprobe — `stsz` is bogus / per-fragment-only.

Without sidx or mfra, ExoPlayer over HTTP cannot translate
`positionMs` → byte offset. It accepts the seek (updates
`currentPosition`) but the data source falls back to the only byte
offset it knows: 0.

`media3:media3-muxer:1.10.0`'s `FragmentedMp4Muxer.Builder` exposes
only `setFragmentDurationMs` + `setSampleCopyingEnabled`. Verified via
`javap` against the jar in the gradle cache + a grep of the jar
strings: **zero references to "sidx" or "mfra"**. The library cannot
emit either today.

**Trade-off matrix (already evaluated 2026-05-14):**

| Path                                  | Trade-off                                                                                                                                    | Effort                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A. Defer                              | Player wiring is correct; ships as-is until B lands.                                                                                         | this finding                                                                                   |
| B. Finalize-time remux                | Read fmp4 → write flat MP4 with proper moov (faststart); ~5–10 s + transient disk doubling per recording; preserves in-recording resilience. | **Recommended** — significant: ~50–150 LOC + tests. Likely a dedicated Phase 3 follow-on plan. |
| C. Hack media3 internals to emit sidx | Copy-paste muxer internals; brittle, will break on media3 upgrades.                                                                          | Days. Rejected.                                                                                |
| D. Switch to flat MP4                 | Violates `idea-brief.md §6.6` mid-recording crash resilience (locked spec).                                                                  | 5-line change. **Rejected.**                                                                   |

**Disposition:** Path B — open a new Phase 3 follow-on plan. The plan
should:

- Take the finalized fmp4 at HumynCapture's segment close, invoke
  `androidx.media3.transformer.Transformer` (or a hand-rolled muxer-
  re-mux step using `Mp4Muxer` with `setAttemptStreamableOutputEnabled
(true)`) to write a streamable flat MP4 alongside the fmp4.
- Atomic rename: only after the remux SHA matches the recording-side
  hash, replace the fmp4 with the flat MP4 (preserves the upload
  contract — bytes byte-for-byte device→S3 per CAP-18 once renamed).
- Test on-device: end-to-end seek in the Player, plus confirm no
  drift regression in the captured `imu_video_drift_*_ms` metadata
  (the remux must NOT re-encode — only re-mux atoms).

PlayerScreen wiring requires zero additional change once Path B lands.

**Found:** 2026-05-14 §5 close-out (commits `819fdf5`, `94f8cfa`).
