# IMU↔Video Drift — Sample Analysis & Hardware Improvement Notes

**Date:** 2026-05-20
**Sample:** `video.mp4` + `imu.csv` (session `spc2_2026-05-15_12-44-21`, intrinsics/sync from `meta.json`)
**Device:** Headspace SPC2 CDC (egocentric fisheye capture rig, IMU = InvenSense ICM-20948)
**Methodology:** `IMU-DRIFT-METHODOLOGY.md` (least-squares index-detrend each stream → interpolate IMU residuals onto video timeline → per-frame `|r_v − r_s|` → {max, mean, p99}).

---

## IMU stream facts

| Field                 | Value                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| Samples               | 2,018,600                                                                        |
| Sampling rate         | ≈571 Hz (meta.json declares 571.6 Hz nominal)                                    |
| Inter-sample interval | median 1.751 ms, max 2.110 ms, **no gaps >5 ms**                                 |
| Timestamp column      | `boottime_ns` (shares the video frame clock: `frame PTS + first_au_boottime_ns`) |
| Span                  | 3532.45 s (matches video 3532.42 s)                                              |

The IMU stream itself is clean and regular at the per-sample level.

## Drift numbers — original sample (whole ~59 min, single global fit, no windowing)

Computed with the exact boottime sync (`v = PTS_ns + 616531418000`; IMU `boottime_ns` used directly):

| Figure                    | Value      |
| ------------------------- | ---------- |
| `imu_video_drift_max_ms`  | **48.024** |
| `imu_video_drift_mean_ms` | **14.186** |
| `imu_video_drift_p99_ms`  | **41.486** |

### Context / caveats

- These are far above the Pixel reference (0.594 / 0.728 ms) and the relaxed ultrawide band (1.7–6.2 ms).
- The figure is dominated by **slow nonlinear wander of the IMU clock** over the hour, not per-sample jitter: video PTS residual is tiny (max ~1.1 ms, σ 0.24 ms); the IMU residual carries essentially all of it (max ~48 ms, σ ~17 ms).
- This file is a **merge of 114 chunks** (`meta.json merged_chunk_range [0,113]`); the device finalizes/drift-computes _per segment_, so a single global detrend over the merged 59-min stream inflates the number relative to what on-device per-segment finalization would record.
- The video side is **nominal container PTS** (encoder-regular), not true Camera2 `REALTIME` frame-exposure timestamps — so the IMU clock wander shows up undamped (no common-mode cancellation with a wandering camera clock). The figure likely over-states a properly-timestamped segment.

(For reference: re-baselining with a windowed detrend gives per-10-min p99 ≈ 14 ms and per-1-min p99 ≈ 4.4 ms — confirming the magnitude is window-length-driven clock wander. Those windowed figures are diagnostic only and not stored here as the sample's drift.)

---

## Hardware improvements to reduce drift (no software involvement)

Root cause = two independent oscillators (camera vs IMU sample clock) beating against each other + thermal frequency drift on the ICM-20948's internal RC/PLL sample clock over a sustained heat-soak. Levers, ranked by impact:

### 1. Hardware frame-sync between camera and IMU (highest leverage)

Route the camera frame-strobe / frame-valid GPIO into the IMU's **`FSYNC`** pin. The ICM-20948 latches the FSYNC event against its own sample clock into the register/FIFO, giving a hardware cross-stamp ("this frame = this IMU sample") with **no host OS / I²C / SPI / scheduling jitter** in the timing path. Collapses the differential wobble from "two free-running clocks" to "the residual of one clock." Also validates the calibration's `timeshift_cam_imu = 0.0` assumption.

### 2. Drive both off one stable reference oscillator

Replace the plain crystal with a **TCXO** (temperature-compensated) and clock both the camera sensor and IMU sample timing from it — cuts ppm/°C drift ~10–100× and kills the thermal wander. If the IMU sample period itself should be locked to it, use/wire a part with an **external `CLKIN`** so the sample-rate generator is disciplined by the TCXO rather than the internal RC clock. (OCXO is the next tier but overkill/too power-hungry for a head-worn rig.)

### 3. Timestamp at the source, not on the host

- Use the IMU's on-chip **FIFO with hardware timestamping** so each sample is stamped at conversion against the device clock; reads then tolerate bus/scheduling latency.
- Consider a newer TDK part — **ICM-42688-P** or the **IIM-4623x precision line** — which add a dedicated hardware timestamp field and a clean external sync/PPS input. The ICM-20948 predates good hardware-timestamping support.

### 4. Take the SoC out of the timing path

- A small **MCU/co-processor with a hardware input-capture timer** stamps both the camera frame-valid edge and the IMU data-ready edge against the _same_ free-running counter in hardware.
- Prefer **SPI over I²C** for the IMU — faster, more deterministic transfers shrink read-latency jitter.

### 5. Thermal hardware

Since the wander correlates with the hour-long heat-soak: **heatsink/spread the SoC**, and **co-locate the IMU, camera sensor, and reference oscillator** on the same board region so their drifts track (common-mode, which the metric cancels) instead of diverging. Thermally isolate the reference oscillator from the SoC hotspot.

**If only one change:** wire camera frame-strobe → IMU `FSYNC` (#1) and reference both clocks to a TCXO (#2). Together they remove the dominant cause — independent, thermally-drifting clocks — and bring the residual close to the noise floor of a single disciplined oscillator. Everything else is incremental on top.
