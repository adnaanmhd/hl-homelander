# Early-Session IMU↔Video Drift — Cold-Start Walk Procedure

Purpose: collect real per-frame video PTS + per-sample IMU timestamps from a
fresh cold-start walk on Pixel 10a + Pixel 8a, so we can rerun
`DriftCalculator.compute` offline with `skip_first_video_frames ∈ {0, 15, 30,
60, 90}` and decide whether option 2 (drop first-N) actually collapses the
seg-1 → seg-4 cold-start curve on real hardware.

Verifies two hypotheses from the session file:

- **Mode A** — first-segment ultrawide HAL warm-up corrupts the
  least-squares fit. Expected: skip=30 drops seg-1 max/mean from ~258/114 ms
  toward the relaxed-band ~5.6 ms.
- **Mode B** — pre-fix BUG-01 boxing churn stalled the IMU dispatcher on
  Pixel 8a seg-3. Expected: clean (≤ ~6 ms band) on every seg now that
  HEAD ships `PrimitiveLongBuffer`.

---

## 0. Prereqs (one-time)

- `adb` sees both devices: `adb devices` → two `device` lines.
- `ffprobe` + `python3` + `numpy` on the dev mac (verified).
- Worktree at HEAD with `PrimitiveLongBuffer` (commit `38f321f` or later).
- `.env.apkRollout` populated (per `README.md`).
- `google-services.json` in `apps/mobile/android/app/`.

## 1. Build + install apkRolloutDebug to both devices

```bash
cd apps/mobile && npm run prebuild
cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug
# APK lands at:
#   apps/mobile/android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk
adb -s <pixel-10a-serial> install -r .../app-apkRollout-debug.apk
adb -s <pixel-8a-serial>  install -r .../app-apkRollout-debug.apk
```

(Or use `./install.sh` in this folder — it does the build once and pushes to
both devices in parallel.)

## 2. Cold-start each device, walk 6 segments

For EACH device (Pixel 10a first, then Pixel 8a — order doesn't matter):

```bash
# 2a. Cold the device. Force-stop the app; wait 2 min for thermal cool.
adb -s <serial> shell am force-stop ai.humynlabs.capture.apk
sleep 120
```

```
2b. Cold-launch the app from the icon (NOT `adb shell monkey` — we want a
    real cold-start including activity launch + ReactRoot init + sign-in
    splash). Drive normally through onboarding → recording.

2c. Record 6 segments back-to-back, ~90 seconds each (mimics the
    2026-05-18 walk cadence). Note the order — segments numbered 1..6.
    A 10-second between-segment pause is fine; longer pauses let the
    device cool back down (bad — we want the natural per-segment
    warm-up curve).

2d. Confirm 6 finalized recordings appear in History.
```

## 3. Pull artifacts via `run-as` (debug-signed → works directly)

```bash
./pull.sh <pixel-10a-serial> 10a
./pull.sh <pixel-8a-serial>  8a
```

Lands artifacts at:

```
.planning/debug/early-session-imu-video-drift/walk-260523/
  10a/
    <recordingId>_<date>/
      *.mp4
      *.csv
      *.metadata.json
  8a/
    ...
```

## 4. Analyze (offline, mac)

```bash
./analyze.py walk-260523/10a > results-10a.txt
./analyze.py walk-260523/8a  > results-8a.txt
```

Each segment prints a table:

```
seg 1 (01KS...):
  metadata.json reported:  max=258.65  mean=114.44  p99=254.34
  analyzer  skip=  0  :    max=257.10  mean=113.92  p99=253.81   ← sanity match (±5%)
  analyzer  skip= 15  :    max= 87.42  mean= 21.55  p99= 79.08
  analyzer  skip= 30  :    max=  4.18  mean=  3.21  p99=  3.96   ← option 2 win
  analyzer  skip= 60  :    max=  3.92  mean=  3.18  p99=  3.85
  analyzer  skip= 90  :    max=  3.88  mean=  3.17  p99=  3.83
```

**Decision rule:**

- If on Pixel 10a the cold-start segments collapse to the relaxed-band
  (~5-6 ms) at any `skip ≤ 90` → **apply option 2** (drop first-N in
  `DriftCalculator.compute`, default N from the smallest N that wins).
- If skip=90 still leaves cold-start segments ≫ 10 ms → option 2 is
  insufficient; escalate to option 3 (warmup segment).
- If Pixel 8a seg-3 (or any seg) shows a spike >> 10 ms → BUG-01 fix did
  NOT hold; reopen `humyncapture-imu-oom-rollover`.
- If everything is clean baseline-only → cold-start is already non-repro on
  current build (unlikely given the dramatic 10a curve — but possible if
  the ultrawide HAL warm-up was a one-time Pixel 10a state); option 1
  (document-and-accept) becomes the conclusion with no code change.

## 5. Record results

Append findings to the session file:

- `.planning/debug/early-session-imu-video-drift.md` → Evidence + Resolution
- If fix applied: `IMU-DRIFT-METHODOLOGY.md` + `ULTRAWIDE-DRIFT-FINDINGS.md`
  get a "Step 0 — Warm-up window trim" section + the cold-start curve table.

---

## Notes

- **Why 2 min wait, not reboot?** Reboot is heavier (kernel cold + IMU clock
  cold + ISP cold). 2 min force-stop is the minimum reliable repro for the
  2026-05-18 cold-start curve, since on that walk seg-1 came after a normal
  app launch — not a reboot. If 2-min-cold doesn't reproduce on the current
  build, escalate to a 10-min wait, then to a reboot.
- **Why both devices?** Pixel 10a is Mode A (cold-start curve). Pixel 8a
  is Stage B (BUG-01 fix held). Both validated in one walk.
- **The walk MP4s are byte-for-byte preserved** — `analyze.py` runs ffprobe
  read-only. The CSV/metadata.json files are also untouched.
- The relaxed drift gate (CLAUDE.md banner) remains telemetry-only
  regardless of what this walk shows. Nothing here changes the spec or the
  ultrawide lens code.
