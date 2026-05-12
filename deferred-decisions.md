# Deferred Decisions (post-MVP)

Technical and feature decisions that surfaced during the MVP review and were explicitly deferred. Distinct from `strategic-suggestions.md`, which holds PM-level strategy items. Revisit each at the v2 planning gate.

---

## Fraud & integrity

**FRAUD-05 / FRAUD-06 descoped to §v2 (2026-05-12)** — per-account daily upload-rate cap + pre-payout fraud dashboard; the MVP upload path is fully uncapped per account; Bull-Board (worker-queue dashboard) is Phase 7 (OBS-04), separate. See CONTEXT.md D-04 + REQUIREMENTS.md §v2.

### Play Integrity per-upload attestation

Currently MVP uses Play Integrity at sign-in only. Per-upload attestation rejects forged uploads from non-genuine app builds or rooted devices.

- **When to revisit:** when fraud volume justifies the extra latency on every upload, or when payouts go live.

### Server-side perceptual-hash duplicate detection

Detects same task being recorded multiple times, screen-recordings of TV/YouTube, and looped clips — even when the file bytes differ.

- **When to revisit:** before payouts go live; this is the cheapest single fraud defense.

### Device-fingerprint binding (one account ↔ one device)

Prevents account farming where one operator runs N accounts on a phone bank.

- **When to revisit:** when we see >5% of accounts sharing device fingerprints.

### Liveness gestures (randomized in-frame action per recording)

Server requests "show your left palm" or similar at a random moment; the recording must contain it. Defends against pre-recorded video farms.

- **When to revisit:** v2 anti-fraud sprint.

### Server-side IMU-liveness check

Backend analyses the IMU CSV that's already uploaded with every recording (stillness gate, gravity-axis check, saccade density, optional walking-segment FFT, vision–motion correlation) and produces a `liveness_score ∈ [0,1]`. Zero on-device cost; catches passive-mount and TV-replay attacks the on-device hand gate cannot. Full design: `imu-liveness-check.md`. Mapped to **REQUIREMENTS.md FRAUD-03 / FRAUD-04**. _Briefly promoted into the Phase 5 MVP backend (2026-05-11), then descoped back the same day — the MVP collects the IMU CSV but does not analyse it server-side; anti-fraud at MVP is Play Integrity at sign-in + the on-device one-shot hand gate (FRAUD-05's per-account upload-rate cap was itself descoped to §v2 on 2026-05-12 — see above)._

- **When to revisit:** v2 anti-fraud sprint — sequence it **before** per-upload attestation and perceptual-hash dedup; it's the cheapest fraud signal given the data already collected. Largely supersedes "liveness gestures" above.

---

## Recording UX

### On-device hands-in-frame detection

Two variants on the table; the lighter one (warn-only overlay) was the original stub, the heavier one (hard gate + auto-stop) was proposed in May 2026 and parked for post-MVP.

**Variant A — Soft warning overlay (original stub):** ML Kit / MediaPipe overlay that warns the user when hands leave frame. Reduces QA-rejection rate.

**Variant B — Hard gate + cue loop + auto-stop (May 2026 proposal):**
Replaces the §5.8 5-sec countdown and adds in-recording enforcement.

1. **Pre-record gate** — both hands in frame for ≥ 2 sec continuous before capture begins (replaces the countdown entirely).
2. **Absence cue loop** — if both hands are absent for ≥ 5 sec continuous, fire audio "Keep hands in frame" + strong haptic. Repeat every 5 sec until ≥ 1 hand reappears.
3. **Auto-stop** — if both hands remain absent for ≥ 30 sec continuous, finalize the segment with voice "Recording stopped" + toast explaining hand absence.

**Recommended tech approach (validated post-MVP, do not pre-build):**

- **Model:** MediaPipe Palm Detector only (skip the landmarker stage), INT8-quantized, GPU delegate with NNAPI fallback. Binary "palm present" signal is all that's needed.
- **Detection FPS:** 2 FPS during recording (every 500 ms) — coarse thresholds (5s cue, 30s stop) tolerate this. Bump to ~10 FPS during the pre-record gate window where the encoder isn't running and thermal headroom is free.
- **Camera plumbing:** second `ImageReader` Surface on the Camera2 session at **320×180 YUV_420_888** alongside the encoder Surface. Camera HAL downsamples natively — zero extra GPU/CPU cost on the capture path.
- **Hysteresis filter:** "absent" only declared when N-of-last-M detections (e.g., 8 of 10 at 2 FPS) return no palm. Cue threshold counted _after_ hysteresis confirms. Without this, motion blur, brief occlusions (hand behind a pan), and lighting flicker will trigger phantom stops.
- **Estimated added power draw on Pixel 7a-class:** ~70–110 mW sustained. Eats into the §14 20-min thermal budget; **must be empirically validated against the cool-start back-to-back test before shipping**.
- All thresholds (2s gate, 5s cue interval, 30s auto-stop) should be **Firebase Remote Config keys** like the §5.8 segment length, so they can be retuned without an app release.

**Pros:**

- Hard quality gate at the source — flips framing failures from async-rejection to never-uploaded; saves bandwidth, server compute, QA effort, payout disputes.
- Closes a real fraud vector (phone pointed at TV, mounted but idle). Complements the deferred per-upload attestation and perceptual-hash defenses.
- Active-engagement signal stronger than IMU motion alone (you can shake a phone without doing a task).
- Replaces the dead 5-sec countdown with an active commitment.
- Self-validating capture pipeline — QA tool can trust baseline framing on every uploaded segment.

**Cons / risks:**

- **False positives on legitimate hands-out windows.** Cooking has long stretches where hands aren't visible: walking to fetch ingredients, watching a microwave, reading a recipe, talking to family, waiting for water to boil, carrying a load with both hands occupied off-camera. 30s is aggressive and will silently kill recordings users thought were fine.
- **Skin-tone and lighting bias.** MediaPipe's palm model degrades on darker skin tones in low light. India/Brazil base + indoor low-light + steamy kitchens = the worst-case input distribution. Both annoying and unfair.
- **Strong haptic on a head-mounted phone.** Phone is on a head rig (§3.4) — strong vibration buzzes the user's skull/face. Cue every 5 sec is borderline punitive. Audio-only or weaker haptic may be better.
- **Voice cue every 5 sec is nagging,** especially when the model false-negatives on darker skin / gloves / motion blur and the hands _are_ in frame. Risk of 1-star reviews ("the app keeps yelling at me").
- **Thermal/battery cost is non-zero** even at 2 FPS. May push borderline devices below the §14 bar.
- **Compat-check tightening required.** §5.4 needs a clause for "device runs MediaPipe palm detector at ≥ 2 FPS via GPU/NNAPI without thermal cut-out." Some Android 11–12 devices in the ₹30K segment have flaky NNAPI implementations — could shrink the addressable device pool.
- **Pre-record gate failure path is unspecified.** If a user genuinely cannot pass the gate (camera angle, lens fog, lighting), there's no escape hatch — risks permanent block of well-meaning users.
- **Accessibility:** amputees, motor-impaired, single-handed users are excluded outright by a hard "show both hands" gate.
- **Interaction with the < 60-sec discard rule (§5.8) is messy.** If hand-absence auto-stops at 45s (15s valid + 30s absent), the segment gets discarded — user did legitimate work and gets nothing.
- **Practice-mode interaction (§5.5.3).** If the model fails on a user's skin/lighting/glove condition, their first impression of the app is failure → high onboarding churn.
- **Auto-segment 10-min cut interaction (§5.8).** If the gate re-triggers on segment 2, the "0.5-sec silent transition" is broken; if it doesn't, there's a fraud loophole (start segment 1 properly, walk away during segment 2's free window).
- **Concurrent GPU contention.** Adreno-class GPUs share resources between MediaCodec encode and TFLite GPU delegate. On older Snapdragon 6-series this can cause encoder frame drops.
- **Code-surface growth.** New ML model (+1.5–3 MB APK), MediaPipe/TFLite dependency, Camera2 multi-stream config, GPU/NNAPI fallback logic, hysteresis state machine — each is an ANR/crash vector.

**Open questions to resolve before building:**

1. Both-hands or at-least-one-hand for the gate? (Spec was asymmetric: both for gate, one to clear cue.)
2. Failure path if user can't pass the gate — hard timeout, escape hatch, or persistent loop?
3. Definition of "hand in frame" — full hand, palm, fingers, wrist edge?
4. Does the auto-segment 10-min cut re-trigger the gate?
5. Does the < 60-sec discard rule apply to hand-absence auto-stops?
6. Strong haptic on head-rig — acceptable, or audio-only?
7. Audio cue: TTS or pre-recorded?
8. Cue indefinite or capped, escalate over time?
9. History entry labeling for auto-stopped segments?
10. Apply gate to the practice recording (§5.5.3)?
11. Glove-wearing tolerance (cooking, gardening, dishwashing tasks)?
12. Should metadata JSON record per-segment `hand_visible_pct`?
13. Compat policy for phones that pass §5.4 but fail palm-detector NNAPI/GPU — block, CPU fallback, or skip detection on that device?
14. Day-zero false-positive / false-negative target for hysteresis tuning?
15. Accessibility carve-out (e.g., profile setting "I record one-handed")?
16. Visual on-screen banner during cue, or audio-only since user is in head-rig and may not see screen?
17. Analytics events: `gate_pass_time_ms`, `gate_failures`, `cue_count_per_recording`, `auto_stop_count` — confirm instrumentation.

- **When to revisit:** when QA pass rate data tells us framing is the dominant rejection reason. Pick Variant A or B based on observed false-positive rate of palm detection on the actual user fleet (skin tone × lighting × glove distribution) and whether soft-warn meaningfully moves QA pass rate before committing to the heavier B.

### Real-time framing guides

Rule-of-thirds, horizon level, motion-too-fast warnings.

- **When to revisit:** alongside hands-in-frame.

---

## Network & data policy

### Wi-Fi-only upload toggle

Currently MVP allows cellular uploads with no per-user override.

- **When to revisit:** when cellular data complaints appear in support tickets, or when we see >X% of uploads dropping mid-cellular due to data caps.

### Per-month data ceiling / data-usage breakdown

"This month you've used 8.4 GB on Humyn (Wi-Fi: 5.1, Cellular: 3.3)."

- **When to revisit:** v2 polish.

---

## Notifications

### A/B-tested notification copy variants

MVP ships fixed morning + evening copy. Test variants once we have enough installs (~5K DAU).

### Event-driven notifications

Upload complete, upload failed, QA result, payment landed — all out of MVP. Only the 2/day reminder ships.

---

## Distribution

### Localization

English-only at MVP. Hindi + Portuguese + Spanish are the obvious next three.

### Right-to-left support

Not needed for current target geos.

---

## Profile / account

### Editable profile beyond signup confirmation

User can edit name/age/gender at signup ("Confirm your details" screen). Post-signup edits are deferred.

- **When to revisit:** when support tickets show users wanting to correct details.

### Multi-account on a single device

Out of scope. One account at a time.

### Clan-chief special role / clan view

At MVP, clan chiefs are regular users with no role distinction.

---

## Encryption posture

### Additional client-side file encryption

We rely on Android FBE for at-rest protection of the queued local file. A second encryption layer (Jetpack Security / EncryptedFile) was rejected — not deferred — because the marginal security gain doesn't justify the I/O cost. Re-evaluate only if a specific threat model demands it.
