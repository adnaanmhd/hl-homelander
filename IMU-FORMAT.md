# IMU Sidecar CSV — Format & Capture (Homelander / Humyn Labs Capture)

> Untracked reference doc. Source of truth: `idea-brief.md` §6.4–6.7 / §8.1–8.3 and `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ImuWriter.kt`. If this doc and those disagree, those win.

Every recorded segment produces a triple sharing one base name (`idea-brief.md` §8.1): `YYYYMMDD_HHMMSS_NNN.mp4` (video), `.csv` (IMU), `.json` (metadata). The user only ever sees the MP4. The CSV travels byte-for-byte device → S3 — never re-encoded.

## Sample (`20260505_003020_001.csv`)

```csv
timestamp_ns,sensor_type,x,y,z
5283001234567,accel,0.4123,9.6087,1.8233
5283002434567,gyro,-0.0148,0.0231,-0.0067
5283003638413,accel,0.4319,9.5994,1.8101
5283004838413,gyro,-0.0102,0.0254,-0.0041
5283006042259,accel,0.3987,9.6142,1.8377
5283007242259,gyro,-0.2913,0.4471,-0.0884
5283008446105,accel,0.5512,9.4023,2.1894
5283009646105,gyro,-0.4517,0.6238,-0.1142
5283010849951,accel,0.8841,9.1377,2.4419
5283012049951,gyro,-0.3122,0.5019,-0.0931
5283013253797,accel,0.6033,9.4881,2.0114
5283014453797,gyro,-0.0876,0.1124,-0.0203
5283015657643,accel,0.4471,9.5933,1.8442
5283016857643,gyro,-0.0119,0.0288,-0.0055
5283018061489,accel,0.4098,9.6101,1.8219
5283019261489,gyro,0.0034,0.0177,-0.0029
5283020465335,accel,0.4205,9.6044,1.8307
5283021665335,gyro,-0.0091,0.0203,-0.0048
5283022869181,accel,0.4011,9.6133,1.8255
5283024069181,gyro,-0.0123,0.0219,-0.0061
```

Notes on the bytes above:

- Line 1 is a literal column-name header — `timestamp_ns,sensor_type,x,y,z\n` — written verbatim by `ImuWriter` at construction. **Every consumer must skip line 1 before parsing.** There are no inline per-column units (units live in this doc, not the file).
- Rows are interleaved: `gyro` and `accel` are independent listeners writing to the same file, so rows land in physical-timestamp order — not strictly alternating, no fixed stride. Above shows ~416 Hz each (Pixel-10a-class) ⇒ ~2.4 ms per sensor.
- Rows 6–10 above show a head turn: gyro magnitude jumps from ~0.02 rad/s to ~0.6–0.8 rad/s and the accel gravity vector swings across axes; then it settles.
- Numbers are Kotlin `Float.toString()` output (`"$timestampNs,$type,$x,$y,$z\n"`) — variable decimal places, ~7 significant digits, trailing `.0` on whole values (e.g. a zero reading writes `0.0`, not `0.000`).

## Columns

| Column         | Type    | Units                     | Notes                                                                                                                                                                          |
| -------------- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timestamp_ns` | int64   | nanoseconds               | Physical `SensorEvent.timestamp` in the `SystemClock.elapsedRealtimeNanos` domain (Android) / `mach_absolute_time` (iOS). Monotonic, ns precision. NOT callback-dispatch time. |
| `sensor_type`  | string  | —                         | Exactly `gyro` or `accel`. No other values.                                                                                                                                    |
| `x`, `y`, `z`  | float32 | gyro: rad/s · accel: m/s² | Raw native sensor units — device axes, no conversion, gravity NOT subtracted from accel.                                                                                       |

Two sensors only: gyroscope + accelerometer. No magnetometer, no audio (audio dropped 2026-05-11).

## How it's captured

- **Mechanism (Android):** inside the `HumynCapture` native module, `ImuWriter` registers one `SensorEventListener` for `TYPE_GYROSCOPE` and one for `TYPE_ACCELEROMETER` via `SensorManager.registerListener(..., SENSOR_DELAY_FASTEST, maxReportLatencyUs)`. Both run on a dedicated `HandlerThread` ("HumynCapture-Imu"). iOS analogue: `CMMotionManager` (deferred milestone).
- **Sample rate:** the device's _maximum_ supported rate — uncapped. Compat check (Phase 2 `ImuProbe`) enforces a **≥100 Hz sustained floor**; non-qualifying devices are rejected before capture. Typical qualifying phones run 200–500 Hz; Pixel 10a observed at 416 Hz on both sensors. Per-segment metadata records `imu_gyro_rate_hz`, `imu_accel_rate_hz`, and `imu_min_rate_hz_observed_p1` (1st-percentile of per-1-s-sliding-window rates).
- **Batching:** `maxReportLatency = 200 ms` — sensor HAL delivers samples in ~200 ms bursts to cut wake-ups. This does **not** change the sample rate or timestamps: the physical `event.timestamp` on each sample stays correct (~2.4 ms apart at 416 Hz), only the callback cadence is bursty.
- **Lifecycle:** construct → write header line · `start()` → register listeners · `stop()` → unregister, flush, return collected timestamps · `close()` → final flush + close + thread shutdown (idempotent). Writes are guarded by a lock so a late sensor event can't race `close()`.
- **Durability:** `BufferedWriter` (8 KiB); `stop()` and `close()` flush explicitly so a SIGKILL doesn't strand in-flight rows. The CSV's `imu_sha256` (in the metadata JSON) must match the bytes on disk — server QA flags mismatches.

## Boot-time offset (turning `timestamp_ns` into wall-clock)

`timestamp_ns` is **not** a Unix epoch. It's `elapsedRealtimeNanos` — nanoseconds since the device last booted, _including_ time spent in deep sleep. It's monotonic and never jumps (immune to NTP corrections, manual clock changes, DST), which is exactly why capture uses it for the video↔IMU alignment. The trade-off: a raw row says nothing about _when_ in real-world time it happened.

The boot-time offset bridges the two domains:

```
wall_clock_utc(row) = boot_epoch_ms + (row.timestamp_ns / 1e6)
where  boot_epoch_ms ≈ System.currentTimeMillis() − SystemClock.elapsedRealtime()   (sampled once, at segment start)
```

The app does not write `boot_epoch` into the CSV. Instead, at **segment start** `CaptureSession` records a wall-clock anchor (`OffsetDateTime.now()`) alongside the monotonic start stamp; `FinalizeWorker` writes it into the metadata JSON as `start_timestamp` / `imu_start_timestamp` (ISO-8601 with offset, e.g. `2026-05-05T00:30:20.012+05:30`), with `end_timestamp` / `imu_end_timestamp` stamped at finalize. So a downstream consumer reconstructs the offset per segment as:

```
boot_epoch_ms  =  epoch_ms(metadata.imu_start_timestamp)  −  (first_csv_timestamp_ns / 1e6)
```

then applies the formula above to every row. Consequences to keep in mind:

- The offset is **per segment, per boot session** — don't reuse it across recordings or across a reboot; `elapsedRealtime` resets to 0 on boot.
- Because deep sleep _is_ counted, a capture is never interrupted by sleep; but the wall-clock anchor's accuracy is only as good as the device clock at segment start (could be off by seconds if NTP is stale). Treat reconstructed UTC as ~second-accurate; treat _relative_ timing within a segment as ns-accurate.
- This is also why the CSV is safe to splice/trim by `timestamp_ns` without touching the JSON — until you need absolute time, you never need the offset.

## Sync with video (the ±1 ms invariant)

Video frames (Camera2, `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`) and IMU samples are timestamped against the **same** `elapsedRealtimeNanos` clock — that's why the IMU timestamps are directly comparable to frame PTS. The ±1 ms target is alignment of the **clock domains**, not sample-time proximity (at 100 Hz, IMU samples are ~10 ms apart natively; training pipelines interpolate IMU to each frame's exact instant).

At end-of-segment, drift is computed and stored in metadata as three figures:

- `imu_video_drift_max_ms` — per-frame worst case (anchors the upper bound)
- `imu_video_drift_p99_ms` — the QA gate (robust to one freak sample, still catches sustained drift)
- `imu_video_drift_mean_ms` — fleet-health analytics across recordings

**Methodology** (`DriftCalculator`, `idea-brief.md` §6.5/§6.7): least-squares-fit a line to video timestamps vs frame index → residuals `r_v[i]`; same for IMU timestamps → `r_s[j]`. For each video frame, linearly interpolate `r_s` to that frame's instant → `r_s_at_v[i]`. Per-frame drift `d[i] = r_v[i] − r_s_at_v[i]` (the subtraction cancels common-mode wobble like a brief whole-SoC stall, leaving only the differential wobble that actually breaks alignment). Roll `|d[i]|` up into max / mean / p99. Post-audio-removal smoke 7 on Pixel 10a: mean 0.594 ms / p99 0.728 ms ✓.

## Comparison vs. a wide/joined CSV spec

Some ingest specs ask for a **wide** layout — one row per sample instant carrying all six axes:

```csv
timestamp_ns,gyro_x,gyro_y,gyro_z,accel_x,accel_y,accel_z
1746700800000000000,0.012453,-0.008231,0.003102,-0.187654,0.293841,9.834521
1746700800005000000,0.013102,-0.007854,0.002987,-0.189234,0.291023,9.836102
```

Ours is **long / interleaved** — one row per sample _per sensor_, tagged by `sensor_type`. Field-by-field:

| Aspect            | Wide spec                                                                      | Homelander (long/interleaved)                                                               |                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Layout            | 1 row = 1 instant × 6 axes                                                     | 1 row = 1 sample of 1 sensor                                                                | rationale below                                                                                        |
| Header (line 1)   | `timestamp_ns,gyro_x,…,accel_z`                                                | `timestamp_ns,sensor_type,x,y,z`                                                            | consumer must branch on which it's handed                                                              |
| `timestamp_ns`    | Unix epoch ns                                                                  | `elapsedRealtimeNanos` ns — since-boot, monotonic                                           | wall-clock anchor is in the metadata JSON (see "Boot-time offset")                                     |
| Coordinate frame  | device-fixed, right-handed, X right / Y up / Z out of screen, **no transform** | identical — raw native sensor frame, no transform                                           | ✅ same                                                                                                |
| Units             | gyro rad/s, accel m/s², gravity not removed                                    | identical                                                                                   | ✅ same                                                                                                |
| Float precision   | ≥ 6 decimal places                                                             | `Float.toString()` shortest round-trip — often < 6 dp (`0.0`, `9.81`)                       | divergence — see #6 below                                                                              |
| Sample rate       | ≥ 100 Hz, 200 Hz preferred                                                     | ≥ 100 Hz compat floor, **uncapped** (typ. 200–500 Hz)                                       | ✅ meets/exceeds; recorded as `imu_gyro_rate_hz` / `imu_accel_rate_hz` / `imu_min_rate_hz_observed_p1` |
| Ordering          | strictly ascending by `timestamp_ns`                                           | ascending **per sensor**; merged file not guaranteed globally sorted (HAL batch interleave) | divergence — sort each stream after parse                                                              |
| No-gap rule       | no gap > 20 ms                                                                 | not enforced in the writer; a < 80 Hz p1 reading rejects the segment client-side            | comparable, not identical                                                                              |
| Encoding / EOL    | UTF-8, `\n`                                                                    | UTF-8, `\n`                                                                                 | ✅ same                                                                                                |
| Duration coverage | IMU brackets the video (starts before frame 1, ends after the last)            | IMU listeners run for the whole segment lifetime alongside Camera2                          | ✅ comparable — confirm in your pipeline                                                               |

### Why long/interleaved is the right layout here

1. **Gyro and accel are independent hardware sensors with independent clocks.** On real Android/iOS devices `TYPE_GYROSCOPE` and `TYPE_ACCELEROMETER` fire on their own phases and often at _different_ max rates (e.g. gyro 500 Hz, accel 416 Hz). A _wide_ row only exists if the two streams share sample instants — they don't. To emit wide rows on-device you must either **resample/interpolate** one stream onto the other's grid (fabricates samples, throws away each sensor's true `event.timestamp`) or **nearest-neighbour join** within a tolerance (silently misaligns). The long layout writes each sensor's exact physical timestamp with **zero on-device preprocessing** — which is the whole project mandate: raw native units, files never re-encoded, no transforms (`CLAUDE.md` Constraints; `idea-brief.md` §6.4). A downstream consumer with both true timestamp streams can join or interpolate well; the device cannot un-fabricate what it threw away.
2. **Heterogeneous rates need no padding.** Different gyro/accel rates ⇒ just different row counts. A wide grid would need hold-last-value or NaN padding to stay rectangular.
3. **Append-only, no join buffer.** Each `onSensorChanged` appends one complete row immediately. A wide writer needs an in-memory buffer holding a half-built row until the matching other-sensor sample arrives — extra hot-path state, and a window where a SIGKILL leaves a corrupt partial record. Every flushed row in the long file is already a whole, valid sample.
4. **Crash resilience.** Flush-on-stop + faststart MP4 means a killed capture leaves a truncated-but-valid CSV — last row whole, `imu_sha256` covers exactly what's on disk, no dangling half-record.
5. **Monotonic timestamps beat epoch for alignment.** `elapsedRealtimeNanos` never jumps — immune to NTP steps, manual clock changes, DST — so the video↔IMU ±1 ms invariant holds no matter what the wall clock does mid-capture. Epoch-in-the-CSV would inherit every clock glitch. Absolute time isn't lost, just relocated: `metadata.imu_start_timestamp` is the anchor, and the "Boot-time offset" section is the recipe.
6. **Shortest-round-trip floats are more honest than zero-padding.** `Float.toString()` emits the exact `float` value in the fewest digits that round-trip it. A 32-bit float carries only ~7 significant digits; padding to 6 _decimal_ places appends cosmetic precision that isn't physically there. Our values are exact — just not padded. (If a consumer's parser truly requires ≥6 dp, reformat on ingest; the information content is unchanged.)

### Mapping IMU → video timestamps for VIO / visual-inertial SLAM

Not a problem — but it relocates one step onto the consumer, and for cross-correlation-based temporal calibration our format is the _better_ input.

- **The conversion you own.** Tightly-coupled VIO (VINS-Mono, OKVIS, ORB-SLAM3, Kimera) and camera–IMU calibrators (Kalibr) ingest the **EuRoC-style wide, _synchronized_ IMU CSV** — one `(t, ωx ωy ωz, ax ay az)` per row — because IMU pre-integration assumes a single 6-DOF sample per timestep. Ours isn't that. Convert in ~10 lines: split by `sensor_type`, linearly interpolate gyro and accel onto one common timeline (their union, or the higher-rate sensor's grid). At 200–500 Hz the interpolation error is negligible (the signal barely moves across a 2–5 ms sub-sample step) — lossless in practice.
- **Don't index-zip the two streams** and assume they're co-timed. Phone gyro/accel may or may not share a sample clock; the file records whatever the HAL reported. The long layout exists so you interpolate on real timestamps instead of inheriting a fabricated co-timing that a naive wide writer would have baked in on-device.
- **Temporal calibration by cross-correlation** (gyro angular velocity vs. rotation rate from optical flow / frame-to-frame pose, to estimate the camera↔IMU offset `t_d`) is _easier_ here: correlate the raw gyro stream directly — it has its own true `event.timestamp`s, no interpolation — and start from `t_d ≈ 0` because Camera2 frames (`REALTIME` source) and IMU share the `elapsedRealtimeNanos` domain. That clock is monotonic and never steps for NTP/DST, so the correlation isn't corrupted by a clock glitch the way an epoch-stamped file could be. `imu_video_drift_{max,mean,p99}_ms` is a QA measurement of _differential wobble_ between the streams (how tight the `t_d ≈ 0` prior is), **not** a `t_d` you subtract; VINS-Mono-style online `t_d` estimation refines it during the run.
- **Risks, all avoidable via the checklist above:** (1) feeding the raw, un-split file to a frontend that assumes globally monotonic input — it's sorted _per sensor_, not globally; split → sort → (re-merge into synchronized tuples); (2) index-zipping gyro & accel instead of interpolating on timestamps; (3) the calibration window — `t_d` correlation wants IMU samples bracketing the first and last frame; our listeners run the segment lifetime, but verify the first IMU `timestamp_ns` precedes the first frame PTS and the last follows the last frame in your data.

## Consumer ingestion schema — adopt this, ingest as-is

You haven't built ingestion yet, and a wide row was only a preference — so adopt the **long/interleaved** schema below as your raw landing table. The CSV then loads with **zero transforms**: `COPY` / `read_csv` straight in, no pivot, no merge, no axis change, no timestamp conversion. Re-widening (if any downstream job needs it) is an explicit _derived_ artifact built later — never the landing table. Rationale: see "Comparison vs. a wide/joined CSV spec" above.

### Raw landing table

One table row per CSV data row. Six logical columns; only five come from the CSV — `recording_id` is set per file at load time.

| Column         | Type                                   | Source                                                                                                                                  | Notes                                                                       |
| -------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `recording_id` | string                                 | shared filename base `YYYYMMDD_HHMMSS_NNN` (or the metadata `recording_id` ULID — pick one as the key, carry the other as an attribute) | not in the CSV; ties the MP4 / CSV / JSON triple together                   |
| `timestamp_ns` | int64                                  | CSV col 1                                                                                                                               | `elapsedRealtimeNanos` domain — **not** Unix epoch (see "Boot-time offset") |
| `sensor_type`  | enum / low-cardinality string          | CSV col 2                                                                                                                               | exactly `gyro` or `accel`; reject anything else                             |
| `x`            | float32 (store as float64 if you like) | CSV col 3                                                                                                                               | gyro rad/s · accel m/s² · raw device axes · gravity not removed             |
| `y`            | float32                                | CSV col 4                                                                                                                               | ″                                                                           |
| `z`            | float32                                | CSV col 5                                                                                                                               | ″                                                                           |

Recommended physical layout: columnar (Parquet/Arrow), partitioned by `recording_id` (plus a date partition if useful), sorted within a partition by `(sensor_type, timestamp_ns)`. That per-sensor sort is the only "processing" and it's optional — it just makes per-sensor scans contiguous. Don't keep a wide variant as your source of truth.

Generic DDL:

```sql
CREATE TABLE imu_raw (
  recording_id  text             NOT NULL,
  timestamp_ns  bigint           NOT NULL,                                  -- elapsedRealtimeNanos, NOT epoch
  sensor_type   text             NOT NULL CHECK (sensor_type IN ('gyro','accel')),
  x             double precision NOT NULL,
  y             double precision NOT NULL,
  z             double precision NOT NULL
);
-- load: UTF-8, '\n' EOL, ',' delim, HEADER true (skips line 1); no quoting/escaping needed.
--   COPY imu_raw(timestamp_ns,sensor_type,x,y,z) FROM '<...>.csv' WITH (FORMAT csv, HEADER true);
--   then set recording_id from the filename base (staging step or post-COPY UPDATE).
```

Arrow/Parquet schema: `timestamp_ns: int64`, `sensor_type: dictionary<string>`, `x|y|z: float` (32-bit — the source is `float`; widening to `double` on store is lossless, narrowing back loses nothing).

### Parse contract (what your loader must tolerate)

- **Encoding** UTF-8 · **line ending** `\n` · **delimiter** `,` · **no quoting/escaping** — every field is a plain number or one of the literals `gyro` / `accel`.
- **Line 1** is the literal header `timestamp_ns,sensor_type,x,y,z`. Assert it equals that string exactly, then skip it.
- **Every data row** = exactly 5 fields: int64 `timestamp_ns`, `sensor_type ∈ {gyro,accel}`, float `x`, `y`, `z`.
- **Float syntax** = shortest-round-trip text. Expect `9.81`, `-0.5`, `0.0` (not `0.000000` — there is **no** fixed decimal-place count), `-0.0`, and **scientific notation for small magnitudes** — near-stationary gyro rows routinely look like `8.0E-4`, `1.5E-5`. Your float parser **must** accept the `E`/`e` exponent form. Treat `NaN` / `Infinity` as corruption (see gates).
- **Ordering**: `timestamp_ns` is ascending **within each `sensor_type`**, but the file as a whole may emit a run of one sensor then a run of the other — it is _not_ guaranteed globally monotonic. Don't reject on a backward step across sensor types. If a stage needs a globally ordered stream, `ORDER BY timestamp_ns` after load.
- **One-sensor files** (degenerate / very short captures) are still structurally valid — flag, don't drop.

### Absolute time (only if/when you need UTC)

`timestamp_ns` is monotonic since boot. To get wall-clock, join the sibling metadata JSON and derive a per-recording boot epoch once:

```
boot_epoch_ms(recording_id) = epoch_ms(metadata.imu_start_timestamp) − min(timestamp_ns for that recording) / 1e6
utc(row)                    = boot_epoch_ms(row.recording_id) + row.timestamp_ns / 1e6
```

Materialize `boot_epoch_ms` as a per-recording column if convenient; never reuse it across recordings or across a reboot. Reconstructed UTC is ~second-accurate (device clock); _relative_ timing within a recording is ns-accurate. Full caveats: "Boot-time offset" above.

### Validation gates at ingest (read-only — still no transforms)

Quarantine the file on any of:

1. Line 1 ≠ the exact header string.
2. Any data row not exactly 5 fields, or `sensor_type ∉ {gyro,accel}`, or a non-finite / non-numeric `timestamp_ns` / `x` / `y` / `z`.
3. SHA-256 of the CSV bytes ≠ `metadata.imu_sha256`.
4. Row count or per-sensor span/rate grossly inconsistent with `metadata.imu_gyro_rate_hz` / `imu_accel_rate_hz` / `imu_min_rate_hz_observed_p1` (the device already rejects < 80 Hz p1 client-side — a surprise here is corruption, not a quality miss).
5. _Advisory only_ (record, don't necessarily quarantine): a per-sensor inter-sample gap > 20 ms.

### When a downstream job genuinely needs wide, synchronized rows

That's a **derived view/materialization**, not the landing table: split by `sensor_type`, linearly interpolate gyro and accel onto a common grid (their union, or — for VIO / IMU pre-integration — the video frame grid), and label it clearly as interpolated. At 200–500 Hz the interpolation is lossless in practice, and doing it here — downstream, with both sensors' true timestamps in hand — beats having had the device fake co-timing upstream. See "Mapping IMU → video timestamps for VIO / visual-inertial SLAM" above.
