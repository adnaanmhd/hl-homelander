# IMU↔Video Drift — Calculation Methodology (Homelander / Humyn Labs Capture)

> Reference doc. Sources of truth: `idea-brief.md` §6.5 / §6.7 / §8.3 and `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt`. If this doc disagrees with those, those win.
>
> **The ±1 ms gate is relaxed (owner, 2026-05-12).** The _calculation_ below is unchanged — the three figures are still computed and written to every segment's metadata. What changed: they are now **fleet-health telemetry**, not a pass/fail gate. The Phase-4 capture path records on the ultrawide via `CONTROL_ZOOM_RATIO` and runs ~1.7–6.2 ms (vs the old 0.594/0.728 ms baseline); that's accepted. Nothing (phase completion, smoke sign-off, segment finalization, upload) gates on a drift figure. See `ULTRAWIDE-DRIFT-FINDINGS.md` (repo root) + the `CLAUDE.md` drift banner. References below to ±1 ms / "the QA gate" describe the original spec intent, kept for context.

## What "drift" means here

Every recorded segment timestamps its video frames (Camera2, `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`) and its IMU samples (`SensorEvent.timestamp`) against the **same** monotonic clock — `SystemClock.elapsedRealtimeNanos` on Android (`mach_absolute_time` on iOS). Because both streams live in that one clock domain, IMU timestamps are directly comparable to frame PTS, and a downstream training pipeline can interpolate IMU values to the exact instant of any video frame.

The locked invariant (`idea-brief.md` §2.1, §6.5) is **±1 ms alignment of the clock domains** — _not_ sample-time proximity (at 100 Hz, IMU samples are ~10 ms apart natively; that's fine, the consumer interpolates). "Drift" is the residual _differential wobble_ between the two timestamp streams after the trivially-correctable parts (constant offset, constant rate difference) have been removed. That residual is the only thing that actually breaks video↔IMU alignment, so it's the only thing the metric measures.

Three figures + one reproducibility offset are written to every segment's metadata JSON (`idea-brief.md` §8.3, `metadata` block; schema **1.3.0**):

| Field                                                      | Role                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imu_video_drift_max_ms`                                   | Per-frame worst case. Anchors the upper bound.                                                                                                                                                                                                                                                             |
| `imu_video_drift_p99_ms`                                   | The QA gate. Robust to one freak sample, still surfaces sustained drift.                                                                                                                                                                                                                                   |
| `imu_video_drift_mean_ms`                                  | Fleet-health analytics across recordings.                                                                                                                                                                                                                                                                  |
| `imu_video_drift_warmup_frames_skipped` (**new in 1.3.0**) | The Step 0 trim count actually applied. Drop this many leading video frames + every IMU sample preceding the new first frame's timestamp BEFORE the fit to reproduce the three figures above from the raw `video.mp4` + `imu.csv`. `0` = no trim (segment shorter than the default 150 — safety fallback). |

## Inputs

- `videoFrameTimestampsNs` — the capture timestamp of each video frame, in `elapsedRealtimeNanos` ns, ascending. (~18 000 entries for a 10-min 30 FPS segment.)
- `imuTimestampsNs` — the physical `SensorEvent.timestamp` of each IMU sample (gyro + accel merged), in the same ns domain, ascending. (~hundreds of thousands of entries at 200–500 Hz.)

Both must have ≥ 2 samples; otherwise the calculation throws `insufficient_samples_for_drift` and the segment is treated as a finalization failure.

## The algorithm

Run once at end-of-segment (see "When it runs" below), in memory, over the captured timestamp arrays.

### Step 0 — Trim the warm-up window (2026-05-23)

Before the fit, drop the first `DEFAULT_WARMUP_FRAMES_SKIP` video frames (currently **150** = 5 s @ 30 FPS) **and** the IMU samples that precede the new first video frame. This removes the ultrawide-recording HAL's two settling phases at segment start:

1. **Sub-second** — `CONTROL_ZOOM_RATIO`-driven active-physical switch + `LENS_FOCUS_DISTANCE` motor pin (~50-200 ms; frames 1-10).
2. **3-5 s** — auto-exposure / white-balance / image-stabilization / ultrawide fusion-pipeline convergence (frames 30-150).

During convergence the encoder stamps `bufferInfo.presentationTimeUs` with non-affine values that the Step 1 least-squares fit cannot model. Without the trim, the warm-up smears residuals across every frame in the segment and dominates `max` (occasionally `p99` on short segments) — the same shape the detrend is _designed_ to surface, but for a measurement artifact rather than a real cross-stream drift event.

Fallback: if trimming would leave either stream with `< 2` samples (very short crash-truncated segments), the implementation silently falls back to no trim. Production segments at the 10-min cancel-gate are nowhere near this floor.

**Validated on the 2026-05-23 cold-start walk** (Pixel 10a + 8a, post-PrimitiveLongBuffer build):

| Segment                 | metric | skip=0 | skip=150 | reduction          |
| ----------------------- | ------ | ------ | -------- | ------------------ |
| Pixel 8a seg-1 (cold)   | max ms | 37.36  | **7.06** | 81%                |
| Pixel 10a seg-1 (cold)  | max ms | 10.40  | **5.86** | 44%                |
| Pixel 10a seg-3 (clean) | max ms | 2.33   | 2.33     | 0% (no regression) |

Both cold-start MAX values land inside the relaxed-banner profile (`ULTRAWIDE-DRIFT-FINDINGS.md` §1: max 6.16 / mean 5.58 / p99 5.63 ms on a clean 10-min gate-pass) after the trim; clean steady-state segments are untouched. Tests that exercise the pure methodology pass `skipFirstVideoFrames = 0`. Full trail: `.planning/debug/resolved/early-session-imu-video-drift.md`.

### Step 1 — Detrend each stream with a least-squares line fit

For a timestamp array `t[0..n-1]`, fit the line `t̂(i) = a·i + b` against the **sample index** `i` (not against time), by ordinary least squares:

```
a = (n·Σ(i·t[i]) − Σi·Σt[i]) / (n·Σ(i²) − (Σi)²)
b = (Σt[i] − a·Σi) / n
```

then take the residual of every sample off that line:

```
r[i] = t[i] − (a·i + b)
```

Do this for the video stream → `r_v[i]`, and independently for the IMU stream → `r_s[j]`.

Why fit against **index** rather than against a timestamp regression: the dependent series is monotonically uniform in index by construction, so we want the residual _off the trend line_ of "frame N should be at time N·period + start", which is exactly what index-based regression gives.

What the fit absorbs (so it never shows up as "drift"):

- **Constant clock offset** between the streams → folded into the intercept `b`.
- **Constant rate difference** (one clock ticking slightly fast/slow, or a frame period that isn't exactly 1/30 s) → folded into the slope `a`.

What survives in `r[i]` (i.e. _is_ reported as drift):

- Non-linear / accelerating clock drift.
- Per-frame jitter.
- A monotonically growing offset that doesn't fit a single line.
- Any step/stall that affects one stream but not the other.

### Step 2 — Bring the IMU residuals onto the video timeline

The two streams sample at different rates and different phases, so `r_v` and `r_s` aren't index-aligned. For each video frame timestamp `v[i] = videoFrameTimestampsNs[i]`, **linearly interpolate** `r_s` at that instant using the IMU timestamps as the x-axis:

```
r_s_at_v[i] = lerp(imuTimestampsNs → r_s, at x = v[i])
```

Concretely: binary-search `imuTimestampsNs` for the bracket `[xs[lo], xs[hi]]` containing `v[i]`, then `r_s_at_v[i] = r_s[lo] + t·(r_s[hi] − r_s[lo])` where `t = (v[i] − xs[lo]) / (xs[hi] − xs[lo])`. If two adjacent IMU timestamps are identical (`span == 0`), use `r_s[lo]`.

**Endpoint clamp:** if `v[i]` falls before the first IMU timestamp it gets `r_s.first()`; if after the last, `r_s.last()`. (Consequence: edge frames outside the IMU coverage window are conservatively _under_-reported — see "Edge-clamp caveat" below.)

### Step 3 — Per-frame drift

```
d[i]      = r_v[i] − r_s_at_v[i]          (nanoseconds)
absD[i]   = |d[i]| / 1e6                   (→ milliseconds)
```

The subtraction `r_v[i] − r_s_at_v[i]` is the key move: it **cancels common-mode wobble** (e.g. a brief whole-SoC stall that delays _both_ streams equally) and leaves only the _differential_ wobble between the streams — which is the only kind that actually breaks alignment.

### Step 4 — Roll up to {max, mean, p99}

Sort `absD` ascending, then:

```
imu_video_drift_max_ms  = absD[last]
imu_video_drift_mean_ms = Σ absD / |absD|
imu_video_drift_p99_ms  = absD[ min( floor(|absD| · 99 / 100), |absD| − 1 ) ]
```

(The `min(..., n−1)` guard keeps the p99 index in range for small arrays. For ~18 000 samples a full sort is trivial — no streaming/quantile sketch needed.)

## Why this design (not a naive nearest-sample diff)

A naive "for each frame, find the nearest IMU sample, report the time gap" would (a) be dominated by the 10 ms native IMU spacing — meaningless noise — and (b) flag a constant offset or a slow constant rate skew as failure even though both are perfectly correctable downstream. Detrend-then-subtract-residuals reports _only_ the non-affine, common-mode-cancelled misalignment, which is precisely "how tight is the `t_d ≈ 0` prior that VIO/SLAM consumers rely on." `imu_video_drift_{max,mean,p99}_ms` is a **QA measurement of that tightness**, not a `t_d` offset you subtract from anything.

## When it runs

Post-recording finalization, after stop or an auto-segment cut (`idea-brief.md` §6.7):

1. Close the encoder, flush frames, finalize the MP4 container.
2. Close the IMU CSV.
3. SHA-256 the MP4.
4. SHA-256 the IMU CSV.
5. **Compute `imu_video_drift_{max,mean,p99}_ms`** from the captured timestamp arrays (this methodology). In-memory sort over per-frame `|d[i]|` (~18k samples) — trivial.
6. Generate the metadata JSON (drift figures land in the `metadata` block, §8.3).
7. Hand the MP4 + CSV + JSON triple to the upload queue.

Memory bound: 30 FPS × 10 min = 18 000 frames ⇒ per-frame `double` array ≈ 144 KB. No streaming required.

## Edge-clamp caveat (WR-06) — drift is conservatively under-reported at segment edges

IMU registration takes ~tens of ms at segment start, and the IMU writer is stopped _after_ the muxer at finalize, so a handful of video frames at each end of a segment fall outside the IMU coverage window. Step 2's endpoint clamp gives those frames `r_s.first()` / `r_s.last()` instead of a true extrapolated residual — so their computed drift trends toward ~0 rather than the real value. For a 10-min segment that's ~6 frames per edge ≈ 12 / 18 000 = **0.067%** of frames.

Implications:

- **p99 is unaffected** — the clamped frames are far below the 1% tail.
- **max may under-report** if the single worst real drift happens to occur in that underrun window.
- Server-side QA (Phase 5) should treat drift figures **< 0.5 ms** as "could be true near-zero, could be an edge-clamp under-report" rather than a hard guarantee — not as a reason to reject.
- A future v2 change can drop edge frames outside the IMU coverage window from the drift array; doing so now would shrink the per-segment drift sample count and force Phase 5 to relax its statistical floor, so it's deferred.

## Reference numbers

Post-audio-removal smoke 7, Pixel 10a (`idea-brief.md` top banner, `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3): **mean 0.594 ms / p99 0.728 ms** ✓ inside the ±1 ms target. (For context, with the now-dropped audio pump contending for CPU the same metrics were ~5.5 / 5.8 ms — outside spec — which is why audio was removed.)

## Reference implementation

`apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/DriftCalculator.kt` — `DriftCalculator.compute(videoFrameTimestampsNs, imuTimestampsNs): Drift(maxMs, meanMs, p99Ms)`. Tests: `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt`. Caller wiring: `CaptureSession.kt` → `FinalizeWorker.kt` → `MetadataComposer.kt` (writes the three `imu_video_drift_*_ms` fields).

### Pseudocode

```text
function compute(v[], s[], skip = 150):           # v = video frame ts (ns), s = IMU ts (ns); both ascending, len ≥ 2
    if skip > 0 and len(v) - skip >= 2:           # Step 0 — warm-up trim
        v_trim = v[skip:]
        first_kept_imu = first j such that s[j] >= v_trim[0]
        if first_kept_imu found and len(s) - first_kept_imu >= 2:
            v = v_trim
            s = s[first_kept_imu:]
        # else: fall back to no trim — segment too short
    r_v = detrend(v)                              # residuals off least-squares line vs index
    r_s = detrend(s)
    absD = []
    for i in 0 .. len(v)-1:
        rs_i = interp(xs=s, ys=r_s, x=v[i])       # linear interp; clamp to r_s[0] / r_s[-1] outside [s[0], s[-1]]
        absD.append( abs(r_v[i] - rs_i) / 1e6 )   # ns → ms
    sort(absD)
    return {
        max_ms  : absD[-1],
        mean_ms : sum(absD) / len(absD),
        p99_ms  : absD[ min(floor(len(absD) * 99 / 100), len(absD) - 1) ],
    }

function detrend(t[]):
    n = len(t)
    a = (n*Σ(i*t[i]) - Σi*Σt[i]) / (n*Σ(i²) - (Σi)²)     # i = 0..n-1
    b = (Σt[i] - a*Σi) / n
    return [ t[i] - (a*i + b)  for i in 0..n-1 ]
```
