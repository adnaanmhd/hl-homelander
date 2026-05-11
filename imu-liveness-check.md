# IMU-Based Liveness Check (Anti-Fraud)

> **DEFERRED TO v2 / post-MVP — 2026-05-11.** This server-side liveness gate was briefly promoted into the Phase 5 MVP backend scope; the project owner has reversed that — it stays a v2 anti-fraud item. The MVP anti-fraud surface is **Play Integrity at sign-in + a per-account daily upload-rate cap + the on-device one-shot hand gate** only. No `liveness_score` is produced at MVP, and the upload bundle's IMU CSV is not analysed server-side at MVP. This doc is preserved as the canonical design for the v2 anti-fraud sprint. Trail: `.planning/REQUIREMENTS.md` §v2 (FRAUD-03, FRAUD-04), `.planning/STATE.md` Deferred Items + Decisions, `.planning/ROADMAP.md` Phase 5, `deferred-decisions.md` (Fraud & integrity), `CLAUDE.md` descope banner.

> Server-side fraud gate computed from the IMU CSV that's already uploaded with every recording. Zero on-device cost. Catches passive-mount and replay attacks that hand detection cannot.

---

## 1. Purpose

Confirm that a recording was produced by a real person wearing the head rig and physically performing the task, not by:

- A phone propped against a TV / laptop showing real footage.
- A phone on a tripod recording someone else.
- A phone strapped to a stationary object (chair, wall, shelf).
- A phone in a pocket / drawer / bag.
- A phone held up to record playback of another user's video.

This sits **alongside** on-device hands-in-frame detection (which exists to coach legitimate users into better framing), not in competition with it. The two address different problems:

| Concern                                       | Tool                                      |
| --------------------------------------------- | ----------------------------------------- |
| User has correct egocentric framing           | On-device palm detection (coaching nudge) |
| User is actually a real human wearing the rig | IMU liveness (this doc)                   |
| User is doing the task they claim             | Async human QA                            |

Conflating these is what made the original "hands-in-frame auto-stop" plan dangerous.

---

## 2. What head-mounted IMU actually looks like

Real first-person head motion has signatures that are difficult to fake without actually wearing the rig:

- **Constant micro-motion in the gyro.** Even a person sitting still doing fine motor work has gyro RMS in the ~0.01–0.05 rad/s range over any 1-second window. Perfectly still IMU is humanly impossible — it's only achievable by mechanical mounting.
- **Saccade bursts.** Visual attention shifts produce sharp gyro spikes (peaks ~0.5–3 rad/s) lasting <200 ms, followed by short stillness. Real recordings have 5–30 such events per minute. Patterned, irregular, ubiquitous in egocentric data.
- **Gait pattern when walking.** 1–2 Hz vertical oscillation in the accelerometer transmitted from the spine to the head. Distinctive in the FFT and easy to detect.
- **Gravity vector consistent with upright head pose.** On a head-mounted rig the gravity vector sits roughly along the rig's vertical axis. A phone flat on a table puts gravity on a different axis entirely.
- **Vision–motion correlation.** When gyro spikes, the camera frames pan proportionally. Decoupled motion-from-imagery is the classic TV-replay-attack signature.

---

## 3. Fraud cases caught

| Fraud method                                                          | IMU/vision signature                                                                                             | Caught?           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| Phone propped on desk pointing at TV / laptop with real footage       | Dead-still gyro; gravity on wrong axis; no vision–motion correlation                                             | ✅                |
| Phone on tripod recording someone do the task                         | Dead-still gyro; gravity off-axis                                                                                | ✅                |
| Phone strapped to a chair / wall                                      | Dead-still gyro; no saccades                                                                                     | ✅                |
| Phone in drawer / pocket / bag                                        | Erratic accel; no vision motion match; gait absent or wrong                                                      | ✅                |
| Recording playback of another user's video held to camera             | Dead-still gyro (or hand tremor only); no saccades; no gait                                                      | ✅                |
| Person waving phone by hand instead of head-mounting                  | Wrong frequency content (~3–5 Hz hand tremor vs. head saccades); missing gait when walking; gravity axis erratic | Mostly ✅         |
| Person actually wearing the rig but performing a fake / scripted task | Plausible IMU. Not caught here — caught by human QA                                                              | ❌ (out of scope) |

---

## 4. Concrete server-side checks

Run these on the uploaded IMU CSV (`<filename>.csv`) after upload completes. The capture spec already guarantees gyro + accel at ≥100 Hz with `SystemClock.elapsedRealtimeNanos` timestamps — use those directly.

> **Implementer note (2026-05-11):** the CSV's first line is the `timestamp_ns,sensor_type,x,y,z` column-name header (`ImuWriter` emits it verbatim — see `idea-brief.md` §8.2). Skip line 1 before parsing rows. This doc is v2-deferred, so this is just a breadcrumb for whoever builds the gate — no code here yet.

### 4.1 Stillness gate

For every non-overlapping 5-second window across the segment:

```
gyro_rms = sqrt(mean(gx² + gy² + gz²) over window)
```

- If `gyro_rms < 0.005 rad/s` → mark window as "still."
- If **>20% of windows are still** → fail.

Justification: humans cannot hold a head-mounted phone still at this RMS for sustained periods. Mechanical mounts can.

### 4.2 Gravity-axis check

For every 1-second rolling window:

```
gravity_dir = mean(accel_xyz over window) / |mean(accel_xyz)|
```

- Compute angle between `gravity_dir` and the rig's expected upright axis (landscape orientation → axis is along the phone's short edge).
- If **>30% of windows have angle > 30°** → fail.

Justification: head-mounted upright phone has gravity in a tight cone; flat-on-table or off-angle mounting breaks this.

### 4.3 Saccade density

Count gyro peaks where:

```
|gyro_xyz| > 0.5 rad/s for <200 ms duration
```

- Expected real-world rate: 5–30 saccades per minute.
- If **rate < 1/min over the segment** → fail.

Justification: visual attention shifts are universal; their absence indicates a stationary mount.

### 4.4 Walking-segment gait check (conditional)

For tasks tagged `outdoor` or otherwise expected to involve walking (e.g., _Walking a pet_, _Taking out trash_, _Mowing the lawn_):

- FFT the vertical-axis accelerometer over 10-second windows.
- Look for spectral peak in the **1–2 Hz band** with magnitude > 0.5 m/s².
- If **no walking segments detected over a 60+ s recording of an outdoor task** → flag.

Justification: outdoor tasks almost always involve walking. Its absence in an outdoor recording is suspicious.

### 4.5 Vision–motion correlation (heaviest, most powerful)

This is the check that catches TV-replay attacks specifically.

- Sample 1 video frame every 2 seconds (already a small set: ~5/min for a 10-min segment).
- Compute optical flow magnitude per sampled frame against the previous sample (downscaled to ~256² for speed).
- Compute gyro magnitude integrated over the same 2-second window.
- Compute Pearson correlation across the segment.
- If **correlation < 0.4** → fail.

Justification: if the phone is moving, what the camera sees should move with it. Any decoupling means the imagery and the IMU don't share a physical body — i.e., the phone is recording a screen / projection / static scene while the IMU does its own thing.

This is the most expensive check (requires decoding sampled frames). Run it last; skip if cheaper checks already failed.

---

## 5. Scoring and verdict

Each check produces a pass/fail + a soft confidence. Combine:

```
liveness_score ∈ [0, 1]
  = weighted average of per-check confidences
  weights:
    stillness_gate          0.25
    gravity_axis            0.15
    saccade_density         0.20
    gait_check              0.10  (only if applicable)
    vision_motion_corr      0.30
```

### Verdict thresholds (initial — tune against labeled fraud)

| Score range | Action                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| `< 0.30`    | Auto-reject. Flag account for human review if recurrent.                            |
| `0.30–0.60` | Route to human QA queue with liveness flag highlighted.                             |
| `> 0.60`    | Auto-accept on liveness; defer to other QA gates (task correctness, video quality). |

These thresholds should be calibrated once you have a labeled set of confirmed fraud cases. Do not ship hard thresholds without that calibration — false positives would penalize legitimate users.

---

## 6. Why this is a better anti-fraud lever than on-device hand detection

| Property                                  | On-device hand detection                          | IMU liveness (this doc)                  |
| ----------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| Catches TV-replay / passive-mount attacks | ❌ (TV shows real hands)                          | ✅                                       |
| Catches "phone strapped to object"        | ❌                                                | ✅                                       |
| Skin-tone fairness                        | ⚠️ biased on Fitzpatrick V–VI under warm lighting | ✅ no demographic bias                   |
| Lighting / occlusion sensitive            | ⚠️ very                                           | ✅ none                                  |
| On-device compute cost                    | ~30–80 mW + thermal headroom                      | 0                                        |
| Data already collected                    | n/a (new pipeline)                                | ✅ IMU CSV uploaded with every recording |
| Catches "real person, fake task"          | ❌                                                | ❌ (human QA only)                       |

The signal IMU liveness produces is strictly more discriminative for fraud, costs nothing on the device, and avoids the demographic-bias trap entirely.

---

## 7. Implementation notes

### Data dependencies (already satisfied by capture spec)

- Gyro + accel at ≥100 Hz with `SystemClock.elapsedRealtimeNanos` timestamps. ✅ in §6.4 of the brief.
- Camera frame timestamps in the same clock domain (`REALTIME`). ✅ in §6.5.
- Drift figures already recorded per segment. ✅ via `imu_video_drift_*_ms` in metadata.

No on-device changes are required. This entire pipeline runs on the backend / QA service.

### Compute placement

- Cheap checks (4.1–4.4): can run inline on upload completion as part of the metadata-enrichment step.
- Expensive check (4.5, vision–motion): run async on a dedicated worker with GPU access. Optical flow on ~5 frame pairs/min is small but adds up across 1M hours of ingest; batch it.

### Dependencies and libraries

- IMU windowing / FFT: NumPy / SciPy. No special dependencies.
- Optical flow: OpenCV `calcOpticalFlowFarneback` is fine for this resolution. RAFT / DIS are overkill.
- Frame sampling: `ffmpeg` with `-vf "fps=0.5"` extracts 1 frame every 2 s without full decode of the segment.

### Minimum viable version (Day 1)

If you want to ship this fast, the cheapest cut is **just §4.1 (stillness) + §4.5 (vision–motion correlation).** Those two alone catch the largest fraud classes (passive mount + replay) and skip the FFT / saccade-detection complexity. Add the others as the labeled-fraud dataset grows.

---

## 8. Things to tune / open questions

- **Calibration ground truth.** Need a labeled set: ~200 known-good recordings + ~50 staged-fraud recordings (we generate these ourselves on a few devices) to set thresholds. Without this, scores are guesses.
- **Per-device gyro noise floor.** Different IMUs have different noise. The `0.005 rad/s` threshold in §4.1 may need device-class adjustment. Worst case: maintain a per-device-model floor, derived from the compatibility-check 30-second IMU sample.
- **Outdoor/walking task tagging.** §4.4 only fires when the task implies walking. Either add a `walking_expected: bool` field to the taxonomy, or learn it from the data (FFT heuristic on accepted recordings per-task).
- **Saccade detection on bumpy walking.** Walking generates a lot of high-frequency motion that can confuse the saccade detector. Filter it: detect walking first, exclude those segments from saccade counting, or band-pass the gyro before peak-finding.
- **Vision–motion correlation threshold of 0.4.** Should be re-derived from real data. Some legitimate recordings (e.g., user looking at a single fixed point for a long time, very low motion overall) might have low correlation simply because there's not enough variance to correlate against. Add a minimum-variance gate before computing the correlation.
- **Coordinated abuse.** A determined attacker could sit and wear the rig while playing back fake task audio in their ear and going through the motions. IMU liveness passes; QA catches it. Out of scope here.

---

## 9. Relationship to other anti-fraud items

`deferred-decisions.md` lists several anti-fraud items (per-upload attestation, perceptual-hash dedup, liveness gestures). Within that deferred set, IMU liveness:

- **Replaces** "liveness gestures" almost entirely — gestures are obtrusive UX; IMU liveness is silent.
- **Complements** perceptual-hash dedup — dedup catches re-uploads of the same content; IMU catches first-time fakes.
- **Independent of** per-upload attestation — those address different threat models (compromised app builds vs. honest-app fraudulent content).

Status (2026-05-11): IMU liveness is **deferred to the v2 anti-fraud sprint**, alongside the other items above. It was briefly promoted to MVP backend scope (Phase 5) on the rationale that the capture spec already collects the data at zero on-device cost, then descoped back to v2. When the v2 anti-fraud sprint opens, sequence it before per-upload attestation and perceptual-hash dedup: it is the cheapest fraud signal available given the data already being collected, and it covers the TV-replay / passive-mount vectors the MVP on-device hand gate cannot.
