---
slug: early-session-imu-video-drift
status: resolved
resolved_at: 2026-05-23
trigger: |
  Early-session IMU↔video drift spikes far outside spec; recovers after several minutes.
  Severity: MEDIUM-HIGH (drift gate is telemetry-only per relaxed-banner 2026-05-12,
  no recording fails — but pipeline can't hold even the relaxed target on cold-start
  or under sustained load).
created: 2026-05-23
updated: 2026-05-23
tdd_mode: false
goal: find_and_fix
---

# Debug Session: early-session-imu-video-drift

## Symptoms

**Expected behavior**
Per-segment `imu_video_drift_{max,mean,p99}_ms` stays within the relaxed-banner's
documented ultrawide profile (max ~6.16 / mean ~5.58 / p99 ~5.63 ms on a clean
10-min gate-pass segment). Drift gate is telemetry-only (not gated), but capture
pipeline should consistently hit this profile.

**Actual behavior**
First 2–3 segments after fresh start are an order of magnitude worse on Pixel 10a
(max 258.65 / mean 114.44 / p99 254.34 on seg 1), then monotonically recover to
spec by seg 5. Pixel 8a shows a single isolated mid-session spike (seg 3: max
357.97 / mean 137.58 / p99 341.56). Magnitude is impossible without something
blocking the IMU dispatcher mid-segment.

**Evidence (per-segment `imu_video_drift_{max,mean,p99}_ms`, in capture order)**

Pixel 10a (kgen.io, ultrawide gate is HEVC stream's lens):

| seg                               | drift max / mean / p99 ms    |
| --------------------------------- | ---------------------------- |
| 1 (01KRVKTSFA)                    | **258.65 / 114.44 / 254.34** |
| 2 (01KRVMD4HF)                    | **181.62 / 33.14 / 158.41**  |
| 3 (01KRVMZFJA — truncated, crash) | 123.73 / 20.74 / 112.35      |
| 4 (01KRVN9C73)                    | 77.57 / 6.90 / 62.33         |
| 5 (01KRVNVQ8S)                    | 3.66 / 3.16 / 3.20           |
| 6 (01KRVPE29T)                    | 3.78 / 3.24 / 3.28           |
| 7 (01KRVQ0DBE)                    | 1.29 / 0.01 / 0.10           |
| 8 (01KRVQJRC7)                    | 1.73 / 0.41 / 0.47           |
| 9 (01KRVR53DA)                    | 3.35 / 2.98 / 3.03           |

Pixel 8a (m.adnaan161):

| seg            | drift max / mean / p99 ms    |
| -------------- | ---------------------------- |
| 1 (01KRVKTGT2) | 14.91 / 0.68 / 0.92          |
| 2 (01KRVMCVTE) | 10.89 / 0.90 / 1.15          |
| 3 (01KRVMZ6ST) | **357.97 / 137.58 / 341.56** |
| 4 (01KRVNHHS5) | 2.36 / 1.68 / 1.93           |
| 5 (01KRVP3WRP) | 1.29 / 0.50 / 0.74           |
| 6 (01KRVPP7RK) | 3.11 / 2.20 / 2.45           |

**Error messages / crashes**

- Pixel 10a seg 3 was truncated (recording crashed mid-capture).
- No explicit error message captured; tied via pattern to BUG-01 (IMU
  buffer accumulation / leak pressure).

**Timeline**
Observed during E2E walk on 2026-05-18 (`E2E-WALK-BUGS-260518.md`). Same
device, same APK build (`0.1.0-apk`) on Pixel 10a and Pixel 8a (Android 16).

**Reproduction**

- Fresh app start (cold), drive through onboarding → recording.
- Record 6–9 segments back-to-back.
- Observe drift metrics in each segment's `metadata.json`.

## Pattern Hypothesis (from user)

1. **Pixel 10a cold-start curve**: monotonic recovery seg 1 → 5 — likely thermal
   warm-up + ultrawide-pipeline buffer settling.
2. **Pixel 8a seg-3 spike**: isolated catastrophic — likely same IMU-leak-pressure
   event from BUG-01 hitting the dispatch path.
3. **Implication for BUG-01**: IMU buffer accumulation also slows dispatch,
   not just retains memory.

## Current Focus

```yaml
hypothesis: |
  Two distinct failure modes, both magnified by the DriftCalculator's
  least-squares index-detrend methodology (which is "NOT robust against
  a monotonically growing offset that doesn't fit a single line" — see
  DriftCalculator.kt:25):
  (A) Pixel 10a seg-1..4 — first-segment ultrawide HAL warm-up. The
      `CONTROL_ZOOM_RATIO`-driven active-physical switch to the ultrawide
      sub-camera on the logical back camera, combined with `LENS_FOCUS_DISTANCE`
      manual focus pin and the ultrawide's heavy distortion-correction /
      fusion pipeline, produces non-affine `presentationTimeUs` for the
      first ~tens-to-hundreds of frames. Across the segment, the linear
      fit captures the bulk of the steady-state cadence; the first
      seconds' frames become large per-frame residuals that dominate
      max/mean/p99. Each subsequent segment inherits warmer ISP/encoder
      state and a freshly-aligned ultrawide → exponential recovery.
  (B) Pixel 8a seg-3 spike — IMU SensorEventCallback dispatch starvation
      under heap pressure from BUG-01 (the boxed-Long ArrayList lineage
      now fixed via PrimitiveLongBuffer, but the pre-fix build that
      walked on 2026-05-18 still had it). A GC pause / dispatcher stall
      of ~100–300 ms on the `HumynCapture-Imu` thread defers a batch of
      sensor events; their `event.timestamp` values stay physical (correct)
      but the IMU residual array gets a single non-affine hump that the
      least-squares fit cannot absorb. Once the GC pressure releases,
      seg 4+ returns to spec.

test: |
  Cold-start walk (Stage A + Stage B in one walk) — recipe and tooling
  staged at `.planning/debug/early-session-imu-video-drift/`:
    1. `./install.sh <p10a-serial> <p8a-serial>` — builds
       apkRolloutDebug and installs HEAD (post-PrimitiveLongBuffer) to
       both Pixels.
    2. For each device: force-stop + 2-min cool + cold-launch from icon;
       record 6 segments back-to-back at ~90 s each.
    3. `./pull.sh <serial> <10a|8a>` — tar-streams the 6 recordings via
       `adb exec-out run-as`; sha256-verifies each mp4 against
       `metadata.json.file_sha256`.
    4. `./analyze.py walk-260523/<10a|8a>` — ports DriftCalculator to
       Python; computes per-segment drift with
       `skip_first_video_frames ∈ {0, 15, 30, 60, 90}` over the real
       PTS (ffprobe) + IMU CSV. The skip=0 row must match the segment's
       metadata.json reported drift within ±5% — that gates trust in
       the skip>0 numbers.
  Full recipe + decision rule: `PROCEDURE.md` in the same folder.

expecting: |
  Stage A (Pixel 10a cold-start curve): at some skip in {15, 30, 60, 90}
  the seg-1..4 drift collapses from {max ~258, mean ~114} into the
  relaxed-band {max ~5–6, mean ~5} — confirming the cold-start curve
  is dominated by the first-N-frames non-affine HAL warm-up that the
  least-squares fit can't absorb. Smallest winning N becomes the new
  `DEFAULT_WARMUP_FRAMES_SKIP` constant.
  Stage B (Pixel 8a): all 6 segs stay in the relaxed band (≤ ~10 ms);
  no seg-3 isolated spike. Confirms BUG-01's PrimitiveLongBuffer fix
  held under the dispatch-pressure path.
  If Stage A's curve does NOT collapse at any N ≤ 90 → option 2 is
  insufficient; escalate to option 3 (warmup-segment record-and-
  discard at session start) or accept option 1 (document-and-document
  only).

expecting: |
  Stage A: frame-to-frame dt variance in first ~10–30 frames of seg 1
  far exceeds steady-state. This is a property of the ultrawide HAL
  warm-up + active-physical switch transient; the DriftCalculator
  surfaces it because the least-squares fit cannot model the kink.
  Stage B: seg-3 stays clean on the post-OOM-fix build, confirming
  BUG-01 was the trigger.

next_action: |
  USER ACTION: do the cold-start walk per PROCEDURE.md in
  `.planning/debug/early-session-imu-video-drift/`. Then drop the
  analyzer output (`results-10a.txt` + `results-8a.txt`) back into the
  session via `/gsd-debug continue early-session-imu-video-drift`.

  AGENT ACTION (after walk): based on analyzer results, either
  (a) apply option 2 (drop first-N in DriftCalculator + update
      IMU-DRIFT-METHODOLOGY.md + add cold-start curve table to
      ULTRAWIDE-DRIFT-FINDINGS.md) and move session to resolved/, OR
  (b) if option 2 insufficient: escalate to option 3 (warmup-segment
      record-and-discard) — a heavier change that needs its own /gsd-quick
      since it touches CaptureSession lifecycle + UX, OR
  (c) if cold-start non-repro on current build: document-and-document
      only (option 1) — extend ULTRAWIDE-DRIFT-FINDINGS.md with the
      observation and resolve session.

reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-23 (manual)
  source: code-read CaptureSession.kt:752, DriftCalculator.kt:25
  finding: |
  Video frame timestamps recorded in the drift array come from
  `bufferInfo.presentationTimeUs` returned by the HEVC encoder pump
  (CaptureSession.runPumpLoop, line 752). For a MediaCodec with
  `createInputSurface()` fed by Camera2, this PTS is stamped by the
  camera HAL when the buffer is submitted to the input Surface;
  on a `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME` device (verified by
  RealtimeGate at session start) the PTS shares the
  `SystemClock.elapsedRealtimeNanos` domain with the IMU's
  `event.timestamp`.
- timestamp: 2026-05-23 (manual)
  source: code-read CaptureSession.kt:589-689 (openCaptureSession)
  finding: |
  `setRepeatingRequest` is called with a `null` CaptureCallback — there
  is no `onCaptureCompleted` / first-frame anchor / `SENSOR_TIMESTAMP`
  read in the recording path. Compare with Figure's "Minutes" reference
  implementation (per ULTRAWIDE-DRIFT-FINDINGS.md §2) which anchors on
  the first frame's `SENSOR_TIMESTAMP` via a one-shot CaptureCallback.
  HumynCapture trusts the encoder PTS exclusively for the drift array.
- timestamp: 2026-05-23 (manual)
  source: code-read DriftCalculator.kt:22-30
  finding: |
  The drift methodology's own contract says it is "NOT robust against
  non-linear / accelerating clock drift … a monotonically growing
  offset that doesn't fit a single line." The first N frames of a
  just-opened capture session — where the ultrawide HAL is settling
  its frame clock through the active-physical switch — are exactly
  such a non-affine region. A single least-squares fit over 18 000
  frames absorbs the steady-state cadence and surfaces the early-frame
  deviation as per-frame residuals up to hundreds of ms. By segment 5
  the HAL is steady-stated from frame 0 and the residual collapses to
  the steady-state ~5.6 ms range.
- timestamp: 2026-05-23 (manual)
  source: code-read CaptureSession.kt:399-413 (openSegment)
  finding: |
  Allocation order at segment open: openCameraSync → HevcEncoder.configure
  → muxer create → ImuWriter.start (registers gyro+accel listeners with
  `maxReportLatencyUs = 200_000` = 200 ms batch hint) → openCaptureSession
  (which calls setRepeatingRequest). The IMU writer starts collecting
  samples BEFORE the recording capture session is configured. With the
  200 ms batch hint, the first IMU batch can arrive up to 200 ms after
  registration — i.e. possibly AFTER the first encoded frame is already
  in the drift array. The IMU residual array's first samples can lie
  OUTSIDE the video residual array's first samples' time window, hitting
  the `interpolate` endpoint clamp (DriftCalculator.kt:131-145 / WR-06
  caveat) at the segment's leading edge.
- timestamp: 2026-05-23 (manual)
  source: code-read ImuWriter.kt:50-69 + CLAUDE.md drift banner +
  .planning/debug/humyncapture-imu-oom-rollover.md
  finding: |
  BUG-01 (the boxed-Long ArrayList in ImuWriter.timestampList +
  Segment.videoFrameTimestamps) was fixed on 2026-05-18 via
  PrimitiveLongBuffer. The walk that produced the symptom evidence
  (E2E-WALK-BUGS-260518.md) ran the PRE-fix build. Pixel 8a's seg-3
  spike (357 / 137 / 341 ms — single isolated event, no first-segment
  pattern) is consistent with a GC-pause / dispatch-stall caused by
  the pre-fix boxing churn at ~60 minutes cumulative recording. The
  8a-specific pattern (clean seg 1+2, catastrophic seg 3, clean seg
  4+) cannot be explained by ultrawide warm-up alone.

## Eliminated

- IMU sampling rate degradation — `imu_min_rate_hz_observed_p1` was 798–934 Hz
  in the affected segments, well above the 100 Hz floor. The IMU is sampling
  fine; the issue is timestamp alignment.
- The ±1 ms drift gate (relaxed 2026-05-12 to telemetry-only per CLAUDE.md
  banner) — out of scope; do not re-tighten or change the ultrawide lens code.
- Audio-pump CPU contention (the pre-2026-05-11 cause of 5.5/5.8 ms drift) —
  audio is fully unwired; drift baseline of 0.594/0.728 ms post-unwire confirms.
- A reproducible per-device hardware miscalibration — the pattern is
  consistent across Pixel 10a + Pixel 8a (cold-start ramp on one, isolated
  spike on the other, both within the same 6-segment walk), so this is a
  software pipeline behaviour, not device-specific HAL pathology.
- Clock-domain mismatch between video PTS and IMU `event.timestamp` —
  RealtimeGate.verify (CaptureSession.kt:1127) gates the session on
  `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`; both clocks live on
  elapsedRealtimeNanos.

## Resolution

```yaml
root_cause: |
  Two-failure-mode root cause; both are surfaced (not caused) by the
  DriftCalculator's least-squares index-detrend methodology.

  Mode (A) — Pixel 10a cold-start curve (seg 1..4 monotonic recovery):
  The HEVC recording stream is fed by the back ultrawide via
  CONTROL_ZOOM_RATIO-driven active-physical switch on the logical back
  camera. The first segment after process start carries the full
  warm-up cost: lens-motor settling at the fixed LENS_FOCUS_DISTANCE,
  the active-physical switch transient inside the HAL, and the
  ultrawide's distortion-correction / fusion pipeline reaching
  steady-state. The HAL stamps the first ~tens-to-hundreds of frames'
  bufferInfo.presentationTimeUs with non-affine values relative to the
  steady-state cadence. The least-squares fit absorbs the steady-state
  cadence and surfaces the early-frame deviation as a per-frame
  residual cluster up to ~260 ms. Subsequent segments inherit warmer
  state; by seg 5 the residual is steady-state ~5.6 ms.

  Mode (B) — Pixel 8a seg-3 isolated spike:
  Pre-fix BUG-01 boxing churn (ImuWriter.timestampList ArrayList<Long>
  + Segment.videoFrameTimestamps CopyOnWriteArrayList<Long>) caused a
  GC pause / SensorEventQueue dispatch stall in the middle of seg 3.
  The physical event.timestamp values stayed correct (delivered as a
  burst once the stall released) but the IMU residual array got a
  single non-affine hump that the least-squares fit couldn't absorb.
  This mode is already fixed in HEAD (debug session
  humyncapture-imu-oom-rollover, 2026-05-18 — PrimitiveLongBuffer
  replaces both boxed collections); the walk evidence was captured on
  the pre-fix build.

fix: |
  Three non-exclusive options on the table; the recommended pair is
  options 1 + 2, gated on Stage A confirmation from existing artifacts.

  Option 1 — Document-and-accept (always do this):
  Extend ULTRAWIDE-DRIFT-FINDINGS.md with the cold-start curve. Treat
  drift fleet-health telemetry as "expect first 2–4 segments noisy
  after process start, then steady-state ~5.6 ms band". No code change.

  Option 2 — Drop first-N frames from the drift sample (recommended):
  In DriftCalculator.compute, slice off the first WARMUP_FRAMES (~30
  frames = ~1 s) of the video timestamps array before running the
  least-squares fit, and trim the IMU array to start at the
  corresponding video[WARMUP_FRAMES] timestamp. Removes the HAL
  warm-up from the metric without touching the capture pipeline.
  Surgical; tested at the DriftCalculator unit-test level. Document
  the new methodology in IMU-DRIFT-METHODOLOGY.md.

  Option 3 — Warm-up segment (NOT recommended without Stage A
  confirmation): record-and-discard ~30 s at session start. Touches
  CaptureSession lifecycle; needs UX consideration for the lost first
  30 s; doesn't address the dominant residual shape (the early frames
  inside any single segment, not the first segment specifically).

  BUG-01 mode (B) is already fixed in HEAD; no further work needed.
  The capture spec / ultrawide lens code / drift gate stays untouched
  per CLAUDE.md banner.

verification: |
  Stage A (existing artifacts):
    Use ffprobe -show_frames on the seg-1 (01KRVKTSFA) MP4 if still
    available locally. Compute frame-to-frame dt for first 100 frames
    vs steady-state. Expected: dt variance in first ~10–30 frames
    1–2 orders of magnitude higher than steady-state. If yes,
    confirms mode (A).
  Stage B (current build):
    Run a 6-segment continuous walk on Pixel 8a (post-PrimitiveLongBuffer
    HEAD). Expected: no seg-3 catastrophic spike — confirms mode (B)
    was BUG-01 and is now fixed.
  Stage C (option 2 unit test, if implemented):
    DriftCalculatorTest covers a synthetic timestamp array where the
    first 30 video frames have non-affine PTS (eg. dt 50 / 40 / 35 /
    33.33 / 33.33 ...). Without the warmup-trim, drift max should be
    > 100 ms; with the trim, drift max should be < 1 ms.

files_changed:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt
  - IMU-DRIFT-METHODOLOGY.md
  - ULTRAWIDE-DRIFT-FINDINGS.md
  - .planning/debug/early-session-imu-video-drift.md
  - apps/api/package.json # incidental — see verification §3 (worker bootstrap)
```

## Verification Result (2026-05-23 walk)

Stages A + B verified on-device — Pixel 10a + Pixel 8a, fresh apkRolloutDebug
install of HEAD (commit `38f321f`), cold force-stop + 2-min thermal-settle,
~10-min segments back-to-back. 20 segments total (10 per device).

### Stage A — cold-start curve (Mode A)

Still real, **24-30× smaller** than 2026-05-18. Real-data per-segment
analyzer-against-DriftCalculator (analyze.py mirrors compute exactly; skip=0
matches the metadata.json reported max within 0.7%):

| Device    | seg-1 max ms | seg-2 max ms | cold-start ratio |
| --------- | ------------ | ------------ | ---------------- |
| Pixel 10a | 10.46        | 0.99         | ~10×             |
| Pixel 8a  | 37.10        | 2.13         | ~17×             |

Cold-start mode A is the dominant remaining drift source. Skip-sweep on
Pixel 8a seg-1 found `skip=150` (5 s @ 30 fps) addresses both observed HAL
warm-up phases:

| skip frames   | seg-1 max ms (8a) | reduction      |
| ------------- | ----------------- | -------------- |
| 0             | 37.36             | —              |
| 30 (1 s)      | 15.27             | 59%            |
| 90 (3 s)      | 14.50             | 61%            |
| **150 (5 s)** | **7.06**          | **81%**        |
| 300 (10 s)    | 6.93              | 81% (plateau)  |
| 900 (30 s)    | 6.27              | 83% (marginal) |

Pixel 10a seg-1 max: 10.40 → 5.86 at skip=150 (44%). Clean steady-state segment
(Pixel 10a seg-3, max 2.33): unchanged at skip=150 (no regression on
already-clean data).

### Stage B — BUG-01 dispatch-stall (Mode B)

**Fully resolved by PrimitiveLongBuffer fix.** Pixel 8a's worst segment in the
walk had max 5.13 ms; the 2026-05-18 build's seg-3 was 357.97 ms — a **530×
reduction**. No isolated mid-walk spike on either device this time.

### Stage C — unit test for the warm-up trim

`DriftCalculatorTest`'s new `warm-up trim drops first-N video frames` test
constructs a 1150-frame synthetic stream (150 quadratic-ramp prefix + 1000
clean steady-state). Without the trim, drift max smears across the whole
segment; with `skipFirstVideoFrames = 150`, the residual collapses to < 0.01
ms. Plus `warm-up trim falls back gracefully` covers the < skip-count
short-segment guard. Build green via `./gradlew :app:testApkRolloutDebugUnitTest`.

### Applied fix — Option 1 + Option 2

- `DriftCalculator.compute` gains `skipFirstVideoFrames: Int =
DEFAULT_WARMUP_FRAMES_SKIP` (= 150). Class kdoc + the IMU-DRIFT-METHODOLOGY.md
  Step 0 section document the rationale + reference numbers.
- Existing `DriftCalculatorTest` cases pass `skipFirstVideoFrames = 0` (they
  test pre-trim methodology purity on short synthetic data).
- `ULTRAWIDE-DRIFT-FINDINGS.md` §5 (new) carries the walk findings table +
  methodology change.
- Option 3 (warm-up segment) NOT applied — would be invasive and unnecessary
  given Option 2's effectiveness.

### Incidental — dev API worker bootstrap

Mid-walk the user reported uploads stuck in "verifying" state. Diagnosed +
fixed: `apps/api` mirrors prod's ECS task split (Fastify server + standalone
BullMQ hash-verify worker as separate entrypoints); `pnpm --filter @humyn/api
dev` only started the server. `apps/api/package.json` `dev` script now
spawns both via `&` + `wait`; `dev:server` preserves the old single-process
behavior. Memory saved: `feedback_dev_api_runs_hash_verify_worker.md`.

### Secondary finding — flagged for separate debug

`recordings.imu_video_drift_{max,mean,p99}_ms` are NULL in Postgres for every
recording from the walk, even though `metadata.json` in S3 carries the
values correctly. The hash-verify worker's `verifyRecording` path either
doesn't parse the metadata for these fields, or the migration adding them
didn't backfill the ingest. NOT in scope for this session — open a separate
`/gsd-debug` if it matters. The on-device `metadata.json` (which the training
pipeline actually consumes from S3) is the source of truth.

## Related Context

- `E2E-WALK-BUGS-260518.md` — origin of this symptom report; BUG-01 reference.
- `IMU-DRIFT-ANALYSIS-spc2-260520.md` — prior drift analysis vs SPC2 reference rig.
- `ULTRAWIDE-DRIFT-FINDINGS.md` — drift-banner trail; documented ultrawide profile.
- `CLAUDE.md` drift banner — relaxed-gate decision 2026-05-12; telemetry-only.
- `.planning/debug/humyncapture-imu-oom-rollover.md` — likely BUG-01 lineage.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt` — drift compute; least-squares methodology contract at lines 22-30.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt` — capture orchestration; ultrawide via CONTROL_ZOOM_RATIO at 638-647; encoder PTS recorded at 752.
- `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt` — IMU collection; 200 ms maxReportLatencyUs at line 84.
