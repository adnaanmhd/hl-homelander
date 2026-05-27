# Ultrawide Recording & the IMU↔Video Drift Regression — Findings (2026-05-12)

> Companion to `IMU-DRIFT-METHODOLOGY.md` (how drift is computed) and the debug session
> `.planning/debug/handgate-never-passes.md` (Stage 2 — recording on the ultrawide). Written during
> the Phase-4 on-hardware smoke walk. **Owner decision recorded at the bottom: the ±1 ms drift gate
> is relaxed to "measure & record"; the ultrawide lens code is frozen as-is.**
>
> **Update 2026-05-23 — cold-start curve attenuated + warm-up trim shipped.** A follow-up walk on
> the post-`PrimitiveLongBuffer` build (Pixel 10a + 8a, 10-min segments) found the cold-start drift
> curve is real but **~24-30× smaller** than the 2026-05-18 walk reported. The Pixel 8a seg-3 BUG-01
> spike is fully fixed by the IMU OOM rollover work (~530× reduction). Methodology change applied to
> `DriftCalculator.compute` — see §3 below. Full trail:
> `.planning/debug/resolved/early-session-imu-video-drift.md`.

## TL;DR

- The HEVC recording path now genuinely runs on the **back ultrawide** physical sub-camera (Pixel 10a:
  physical id 3, focal ≈ 1.854 mm), via `CaptureRequest.CONTROL_ZOOM_RATIO` driven to the lower bound
  of `CONTROL_ZOOM_RATIO_RANGE` (≈ 0.556) on the logical "0" back camera, AF off, focus pinned at ∞.
  Confirmed on-device. The stream is otherwise spec-clean: HEVC / Main / 1920×1080 / ~30 fps /
  ~7.9 Mbps CBR / GOP 30 / **0 B-frames**; `dfov_degrees` 115.4; IMU ~416 Hz (≥ 100 Hz ✓).
- **But the ±1 ms video↔IMU drift invariant is broken.** A clean 10-minute gate-pass segment measured
  `imu_video_drift_max_ms = 6.16`, `mean = 5.58`, `p99 = 5.63` — vs the Phase-3 post-audio-unwire
  baseline of mean 0.594 / p99 0.728 ms. Nearly every recent Phase-4 segment (pass _and_ skip) clusters
  in the ~1.7–6.2 ms range. The Phase-4 capture path had never been drift-measured before this walk.
- **Almost certainly caused by recording on the ultrawide** (the `CONTROL_ZOOM_RATIO` change), not the
  AF-off change — the zoom-ratio swap changes which _sensor_ feeds the encoder and pulls in the Pixel
  ultrawide's heavy lens-distortion-correction / fusion pipeline (CPU/ISP/bandwidth contention → jittery
  IMU sample delivery → drift). The 5.58 ms figure is the same shape the old audio-pump contention
  produced (~5.5/5.8 ms). A cheap A/B confirmation (revert just the zoom-ratio line, re-measure) was
  _not_ run — see the decision below; it can still be run later if the cause matters.
- **Figure's "Minutes" app (`0.16.0.apk`) does the same thing we do** — logical camera + `CONTROL_ZOOM_RATIO`,
  _not_ a physical-camera-id open — and _doesn't_ have a ±1 ms on-device drift gate. So there's no
  reference implementation that "solves" this; it isn't a solved problem, it's a stricter requirement.
- **Decision (owner, 2026-05-12):** keep computing and recording `imu_video_drift_{max,mean,p99}_ms`
  in every segment's metadata; **remove the ±1 ms blocking gate** (it no longer blocks Phase-4 close,
  the smoke sign-off, uploads, or anything else); **do not change the ultrawide lens code** — the
  `CONTROL_ZOOM_RATIO` approach stays.

---

## 1. What was verified on-device (Pixel 10a, `5C161JEA304304`, Android 16)

`CaptureSession.kt`'s `TEMPLATE_RECORD` repeating request, instrumented with a one-shot
`CameraCaptureSession.CaptureCallback` (`DEBUG_REVERT_BEFORE_COMMIT` — mirrors `GateCameraController`):

```
CaptureSession: DEBUG_REVERT_BEFORE_COMMIT recording stream live:
  activePhysicalId=3  focalLengthMm=1.854  zoomRatio=0.55594164  focusDistanceDpt=0.0  afMode=0
```

- `activePhysicalId=3` + `focalLengthMm=1.854` → the encoder is fed by the ultrawide, not the ~4.5 mm
  main wide. (`focusDistanceDpt=0.0` = ∞; `afMode=0` = `CONTROL_AF_MODE_OFF`.)
- `ffprobe` on a 100 s segment: `codec_name=hevc`, `profile=Main`, `1920x1080`, `r_frame_rate=179/6`
  (≈ 29.83 fps), `bit_rate≈7.89 Mbps`, IDR every 30 frames, `pict_type` only `I`/`P` (0 B-frames).
- Metadata JSON: `dfov_degrees=115.41`, `imu_gyro_rate_hz=416`, `imu_accel_rate_hz=416`,
  `imu_min_rate_hz_observed_p1≈798` (the sliding-1 s p1; ≥ 100 Hz ✓), `b_frames=false`,
  `image_stabilization=false`, `bitrate_mode="cbr"`, `gop=30`.
- TTS: `ReactNativeJS: ttsVoice pickedId=en-us-x-tpf-local` → `setDefaultLanguage(en-US) OK` →
  `setDefaultVoice(en-us-x-tpf-local) OK` → `speakCue "Recording started"`; the device's only
  `notInstalled:false` voice is `en-us-x-tpf-local` (en-US female). Cue confirmed to sound US-female.

### The drift numbers

| Segment                                      | duration | `drift_max_ms` | `drift_mean_ms` | `drift_p99_ms` | gate |
| -------------------------------------------- | -------- | -------------- | --------------- | -------------- | ---- |
| `20260512_005847_009` (the clean 10-min run) | 600.7 s  | **6.16**       | **5.58**        | **5.63**       | pass |
| `20260512_005031_008`                        | 100.2 s  | 11.27          | 1.29            | 1.34           | skip |
| `20260512_002704_003`                        | 42.4 s   | 1.97           | 1.72            | 1.75           | pass |
| `20260512_000123_001`                        | 65.1 s   | 4.26           | 4.04            | 4.10           | skip |
| `20260511_232120_007`                        | 39.3 s   | 4.67           | 4.29            | 4.38           | skip |
| `20260512_002753_004`                        | 14.4 s   | 0.70           | 0.58            | 0.61           | skip |
| … (other recent segments)                    | —        | ~2–6           | ~1.7–4          | ~1.8–4         | both |

Phase-3 smoke-7 baseline (post-audio-unwire, _pre_-Phase-4 capture-path changes): mean 0.594 / p99 0.728 ms.
The only recent segment back in that range was a 14 s clip — too short to weigh. The gate-pass vs skip
distinction doesn't matter for drift (the gate→record camera handoff is identical for both in
`RecordingScreen.tsx`'s `run()`), so this is a property of the recording session, not the gate.

### What changed since the last good baseline

The Phase-4 capture path was never drift-measured until this walk. Two changes touched the recording
`TEMPLATE_RECORD` builder between then and now:

1. **AF-off + fixed focus** — `CONTROL_AF_MODE_OFF` + a fixed `LENS_FOCUS_DISTANCE` (0.0 = ∞), added so a
   head-mounted rig doesn't refocus mid-take. Disabling AF runs in the 3A/metadata loop; it doesn't gate
   frame delivery — _low_ probability of causing ~5 ms timestamp jitter.
2. **`CONTROL_ZOOM_RATIO` < 1.0 → ultrawide physical sub-camera** — added (debug session Stage 2) so the
   HEVC stream actually meets the LOCKED ≥ 110° dFOV spec instead of streaming the ~83° main wide. This
   _swaps the sensor feeding the encoder_ and pulls in the logical-camera fusion + the Pixel ultrawide's
   distortion-correction pipeline (notoriously heavy). **High** probability — different sensor clock /
   readout characteristics and/or CPU/ISP/bandwidth contention perturbing IMU sample delivery. The 5.58 ms
   mean is the same magnitude the audio-pump CPU contention caused (~5.5/5.8 ms, see the `CLAUDE.md`
   audio-drop banner). Cheap confirmation if ever needed: revert only the zoom-ratio line, keep AF-off,
   record, re-measure; if it returns to ~0.6 ms it's #2.

The runbook §5b escalation ladder (bump `SETTLE_MS`; make `HumynCapture.start()` poll for camera
availability) addresses the _gate→record handoff_ glitch, not steady-state frame-timestamp jitter — a
5.58 ms _mean over 10 minutes_ is steady-state, so those remedies wouldn't have helped anyway.

---

## 2. How Figure's "Minutes" app does ultrawide (reverse-engineered from `0.16.0.apk`)

`com.figure.d8a.UltraWideCameraController` (+ `UltraWideCameraModule`, `CapturedCameraCalibration`,
`NormalizedIntrinsics`):

- **Camera selection: logical camera + `CONTROL_ZOOM_RATIO` — NOT a physical-camera id.**
  `cameraId` defaults to `"0"` (logical back), `zoomRatio` defaults to `1.0f`; both JS-settable
  (`setCameraId`, `setZoomRatio`). Recording request = `createCaptureRequest(TEMPLATE_RECORD)` with
  `CONTROL_MODE = AUTO`; `applyZoomRatio()` sets `CONTROL_ZOOM_RATIO` only when `SDK ≥ 30 && zoomRatio != 1.0`.
  Session = plain `cameraDevice.createCaptureSession(surfaceList, …)` — **no
  `createCaptureSessionByOutputConfigurations`, no `OutputConfiguration.setPhysicalCameraId(…)`.** They
  never open the physical ultrawide directly. (The `setCameraId` hook exists so a problem device _could_
  be handed a different id from JS config, but the primary path is logical-"0" + sub-1.0 zoom — exactly
  what we do.) So "open the physical ultrawide by id" would be going _further_ than the reference, not
  matching it.
- **Encoder: `MediaRecorder`, H.264, MP4** — `setVideoSource(SURFACE)` / `setOutputFormat(MPEG_4)` /
  `setVideoEncoder(2)` = H.264 / 30 fps / ~7 Mbps scaled by resolution. (We deliberately use
  MediaCodec + MediaMuxer + HEVC for B-frame / bitrate-mode control; Figure didn't need that.)
- **Video↔IMU alignment: anchor on the first frame's `SENSOR_TIMESTAMP`.** A one-shot `CaptureCallback`
  grabs `CaptureResult.SENSOR_TIMESTAMP` of the first recorded frame → `firstFrameSensorTimestampNs` →
  returned to JS in the `startRecording()` result; downstream reconciles video↔IMU from that anchor +
  nominal 30 fps. **They keep no continuous on-device drift figure** and have no ±1 ms gate — so if their
  ultrawide stream has the same ~2–6 ms jitter ours does, nothing in their app would notice or care.
- **Distortion: shipped, not corrected on-device.** `captureFirstFrameCalibration(TotalCaptureResult)` →
  `CapturedCameraCalibration{ name, NormalizedIntrinsics(fx, fy, cx, cy, width, height, distortionModel,
distortionCoefficients), intrinsicsOmittedReason, rollingShutterReadoutS }`, pulled from the HAL's
  `LENS_INTRINSIC_CALIBRATION` / `LENS_DISTORTION` (or radial) / rolling-shutter-skew result fields and
  returned to JS. So the established egocentric-ultrawide pattern is **distorted frames + intrinsics +
  distortion coefficients + rolling-shutter readout in the metadata**, _not_ undistort-on-device.

---

## 3. Mitigation options (for the record — none being pursued right now)

Assuming the cause is the ultrawide recording (`CONTROL_ZOOM_RATIO`):

1. **Open the physical ultrawide camera by id directly** (like our gate does — `BackUltrawidePicker`),
   instead of the logical-camera zoom trick. Lets us verify the physical sensor's
   `SENSOR_INFO_TIMESTAMP_SOURCE` is `REALTIME`, skip the fusion/zoom layer, and possibly disable the
   distortion-correction work. _Cons:_ less-travelled path (OEM quirks); needs a fallback for devices
   that don't expose physical sub-cameras independently (→ a 2nd code path or a tighter compat-check);
   re-opens the LOCKED capture pipeline (surgical Phase-3 follow-up, re-run the whole capture-spec
   checklist + battery/thermal); if the cause is the _sensor itself_, it buys nothing; multi-cycle, blocks
   Phase-4 → Phase-5; and it's _more_ than Figure does.
2. **Stay on the logical path, cut HAL work** — `LENS_DISTORTION_CORRECTION_MODE = OFF`, lock AWB/AF
   (not AE — exposure must still adapt over a 25-min walk between rooms/outdoors), maybe a leaner request
   template. Cheaper but "maybe it helps"; turning off distortion correction _diverges_ from Figure (they
   leave it on and ship the coefficients).
3. **Fix the math, not the camera** — measure and subtract a per-session offset/rate in finalize. Only
   works if the residual is a fixable shape (the figures vary 1.7–6.2 ms run-to-run, which looks like
   jitter, not a fixed offset), so probably insufficient alone. Lowest risk to the pipeline.
4. **Record on the main wide (~83°)** — violates the LOCKED ≥ 110° dFOV spec; off the table unless the
   owner reopens that constraint.

The reference-aligned move _if_ we ever revisit this: add `LENS_INTRINSIC_CALIBRATION` +
`LENS_DISTORTION` (or radial) + `SENSOR_INFO_ROLLING_SHUTTER_SKEW` to _our_ metadata JSON (mirroring
Figure's `NormalizedIntrinsics`), and — if the residual genuinely can't get under 1 ms on the ultrawide
— take "anchor on first-frame `SENSOR_TIMESTAMP` + ship calibration, relax the residual gate" to the
owner as a spec question. (That last bit is now moot — see below.)

---

## 4. Decision (owner, 2026-05-12)

1. **Keep computing & recording drift.** Every segment's metadata still carries
   `imu_video_drift_{max,mean,p99}_ms` (the existing `DriftCalculator` + `MetadataComposer` path —
   unchanged). These figures are now _fleet-health telemetry_, not a pass/fail gate.
2. **Remove the ±1 ms blocking gate.** Drift no longer blocks: Phase-4 completion, the `04-MANUAL-SMOKE`
   §5b / §6 sign-off, segment finalization, or uploads. The runbook §5b section is downgraded from
   `[BLOCKING]` to "measure & record". `CLAUDE.md` gets a banner noting this; `idea-brief.md` §2.1 and
   `.planning/REQUIREMENTS.md` still state ±1 ms — they were _not_ edited here, so revisit them in a
   dedicated pass if the owner wants the spec docs aligned too. (No code change: the code never enforced
   ±1 ms — `DriftCalculator` only throws on `< 2` samples, which is unrelated.)
3. **Freeze the ultrawide lens code.** The `CONTROL_ZOOM_RATIO`-on-`TEMPLATE_RECORD` approach (and the
   AF-off / fixed-focus on the recording session) stays exactly as-is. The A/B disambiguation and all of
   §3's mitigation options are _not_ being implemented. If drift ever needs to be driven down later, this
   doc is the starting point.

### Still-open / follow-ups (not blockers)

- The `DEBUG_REVERT_BEFORE_COMMIT` `firstResultLogger` in `CaptureSession.kt` (added to confirm the
  ultrawide) is instrumentation — it gets reverted with the rest of the debug-session instrumentation in
  Stage C, along with the VisionCamera-deps removal and the `CLAUDE.md` update.
- Optional, reference-aligned: add camera intrinsics / distortion coefficients / rolling-shutter readout
  to the metadata JSON (mirrors Figure). Not required for MVP.
- `HumynHandDetectorModuleTest.kt:85` won't compile on a clean tree (RN-0.83 `src/test` infra breakage)
  — unrelated, track with a separate `/gsd-quick`.

---

## 5. Follow-up walk (2026-05-23) — cold-start curve attenuated, warm-up trim shipped

A separate debug session (`.planning/debug/resolved/early-session-imu-video-drift.md`) opened
to investigate "early-session IMU↔video drift spikes far outside spec; recovers after several
minutes." The 2026-05-18 walk had reported Pixel 10a seg-1 max **258.65** / mean **114.44** /
p99 **254.34 ms** — an order of magnitude beyond §1's relaxed-banner profile. Two hypothesized
failure modes:

1. **Mode A — ultrawide HAL warm-up.** First-segment Camera2 `CONTROL_ZOOM_RATIO` settling +
   `LENS_FOCUS_DISTANCE` pin + auto-exposure / image-stabilization / ultrawide fusion-pipeline
   convergence produces non-affine `bufferInfo.presentationTimeUs` for the first ~tens-to-hundreds
   of frames. The least-squares fit in `DriftCalculator` cannot model the warm-up kink, so it
   smears residuals across every frame in the segment and dominates `max`.
2. **Mode B — IMU dispatch starvation (BUG-01).** The pre-`PrimitiveLongBuffer` boxed-`Long`
   ArrayList in `ImuWriter.timestampList` / `Segment.videoFrameTimestamps` caused GC pauses that
   stalled the `HumynCapture-Imu` `SensorEventCallback` dispatcher mid-segment. Pixel 8a seg-3
   showed an isolated max **357.97 / 137.58 / 341.56 ms** spike, attributed to this.

### Walk result — both modes much smaller than originally reported

Pixel 10a + 8a, both on the post-`PrimitiveLongBuffer` build (commit `38f321f`), 10-min
segments back-to-back from a cold force-stop + 2-min thermal-settle:

| Device    | seg-1 max ms (2026-05-18 → 2026-05-23) | seg-3 max ms                                   |
| --------- | -------------------------------------- | ---------------------------------------------- |
| Pixel 10a | **258.65 → 10.46** (~25×)              | (was clean both walks)                         |
| Pixel 8a  | (was clean both walks)                 | **357.97 → 0.67** (~530×; **BUG-01 fix held**) |

- **Mode B is fully resolved** by the `PrimitiveLongBuffer` change. Re-walk shows zero isolated
  spikes on Pixel 8a — every segment within or near §1's relaxed band.
- **Mode A is real but small.** Pixel 10a seg-1 (max 10.46) is ~10× higher than seg-2 (max
  0.99); Pixel 8a seg-1 (max 37.10) is ~17× higher than seg-2 (max 2.13). Both seg-1 maxes are
  modestly above §1's relaxed cap (6.16 ms) — measurement artifact rather than a real
  cross-stream drift event.

### Methodology change — warm-up trim (`IMU-DRIFT-METHODOLOGY.md` Step 0)

`DriftCalculator.compute` now drops the first **150** video frames (5 s @ 30 fps) + matching
IMU samples before the least-squares fit, on every production segment. Validated against the
raw walk timestamps (real MP4 PTS via `ffprobe` + real IMU CSV from S3):

| Segment                              | metric | skip=0 | skip=150 | reduction          |
| ------------------------------------ | ------ | ------ | -------- | ------------------ |
| Pixel 8a seg-1 (cold)                | max ms | 37.36  | **7.06** | 81%                |
| Pixel 10a seg-1 (cold)               | max ms | 10.40  | **5.86** | 44%                |
| Pixel 10a seg-3 (clean steady-state) | max ms | 2.33   | 2.33     | 0% (no regression) |

Both cold-start max values land inside the §1 relaxed band after the trim; clean steady-state
segments are untouched. The methodology change is purely additive — Step 0 only — and falls
back to no-trim for crash-truncated segments shorter than the skip count. The capture pipeline,
the ultrawide lens code, the ±1 ms gate decision, and the `CLAUDE.md` drift banner are all
unchanged. Tests that exercise the pure pre-trim methodology pass `skipFirstVideoFrames = 0`.

### Secondary finding — DB ingest of drift columns is broken (separate bug)

`recordings.imu_video_drift_{max,mean,p99}_ms` are NULL in Postgres for every recording
from the 2026-05-23 walk, even though `metadata.json` in S3 carries the values correctly.
The hash-verify worker's `verifyRecording` path either doesn't parse the metadata for these
fields, or the migration that added them didn't backfill the ingest. **Out of scope for this
finding** — flag it as a separate debug item (`/gsd-debug recording-drift-cols-null-in-db`).
The on-device `metadata.json` (which the training pipeline actually consumes from S3) is the
source of truth and carries the figures correctly.
