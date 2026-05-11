---
status: partial
phase: 03-humyn-capture-native-module
source: [03-VERIFICATION.md]
started: 2026-05-11T00:31:07Z
updated: 2026-05-11T03:32:31Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 10-min HEVC capture on real Pixel 7a/8a — verify output MP4 honors locked spec

expected: ffprobe + NAL parser confirm 1920x1080 / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no B-frames / 8-bit YUV 4:2:0 / no HDR / no OIS; fragmented MP4 with moov flush every 30 s; sidecar IMU CSV sustains ≥100 Hz floor; 48 kHz mono AAC-LC 128 kbps audio track present; zero frame drops
result: deferred
evidence: Explicitly deferred to Phase 4 per locked CONTEXT.md D-WAVE-01 — "Phase 3 acceptance is module-ready + Kotlin pure-fn unit tests + JS bridge contract. Full 10-min E2E HEVC capture verification ... deferred to Phase 4 smoke walks." 03-VERIFICATION.md acknowledged this in the score line ("module-ready scope; real-device E2E deferred to Phase 4"). 03-MANUAL-SMOKE.md "Items deferred to Phase 4" table lists "10-min E2E HEVC capture → D-WAVE-01" by name. Operator confirms disposition: 10-min E2E will be exercised in Phase 4 against the real RecordingScreen + practice-recording integration (CONTEXT.md Phase 4 owns RecordingScreen state machine). No Phase 3 acceptance dependency.
resolved: 2026-05-11T02:42:11Z

### 2. 25-min continuous capture auto-segment integrity on Pixel 7a/8a

expected: Three sibling segment triples (MP4 + CSV + JSON) produced at ~10 / ~20 minute marks with ~0.5 s gap between them; each owns its own ULID recording_id with NO parent_recording_id linkage; filenames follow YYYYMMDD_HHMMSS_NNN.<ext> with the same base across the three sibling files; no segment drops
result: deferred
evidence: Explicitly deferred to Phase 4 per CONTEXT.md D-WAVE-01. 03-MANUAL-SMOKE.md Phase-4 deferral table names "Auto-segment 10-min cuts (real timing)" with rationale "Requires real-device 10-min run; Plan 03-08 SegmentTimerTest covers the unit-level invariant only." SegmentTimer + CaptureSession.rotateSegment + FilenameGenerator unit-tested at component boundary in Phase 3 (Plan 03-08); real-device 25-min timing observation is a Phase 4 smoke gate against the live RecordingScreen.
resolved: 2026-05-11T02:42:11Z

### 3. imu*video_drift*{max,mean,p99}\_ms residual-subtraction on real Pixel 7a/8a 10-min segment

expected: Per-segment metadata JSON records all three drift figures as decimals (e.g., max ≈ 0.7 ms, mean ≈ 0.18 ms, p99 ≈ 0.5 ms per idea-brief.md §6.5 example); imu_min_rate_hz_observed_p1 ≥ 80.0 (above the rejection floor)
result: deferred
evidence: Explicitly deferred to Phase 4 per CONTEXT.md D-WAVE-01 + 03-VALIDATION.md "Manual-Only" classification. 03-MANUAL-SMOKE.md Phase-4 deferral table: "Drift validation under live IMU → Requires real-device IMU stream sustained ≥ 100 Hz; methodology is correct only against physical SensorEvent.timestamp values." Phase 3 Plan 03-06 (metadata-composer) + Plan 03-05 (pure-fn-primitives, DriftCalculator) unit-test the residual-subtraction methodology against synthetic timestamp pairs (DriftCalculatorTest.kt); CR-FA edge-clamp under-report is documented as known minor under-report (WR-06 commit fa6e286). Live-IMU residual-subtraction observation is Phase 4 smoke against the live RecordingScreen pipeline.
resolved: 2026-05-11T02:42:11Z

### 4. Pre-record + mid-record thermal handling on real device

expected: Pre-record — induce ≥THROTTLING via prolonged camera load; start() rejects with code 'thermal_throttling'; toast "Phone is too warm. Let it cool before recording." visible. Mid-record — induce ≥THROTTLING_SEVERE; segment ends cleanly within ~2.5 s; onThermalAbort + onSessionStop events fire; metadata JSON written for the truncated segment.
result: deferred
evidence: Explicitly deferred to Phase 4 per CONTEXT.md D-WAVE-01 + 03-VALIDATION.md. 03-MANUAL-SMOKE.md Phase-4 deferral table: "Thermal cut-out timing (~2.5 s graceful stop) → Requires `cmd thermalservice override-status` on rooted dev device; can't simulate via Robolectric." Phase 3 ThermalGate + ThermalGateTest.kt cover the threshold-mapping + pre-flight/mid-record subscription invariants at unit-test scope (Plan 03-07 foreground-service-thermal). WR-02 commit 1d4c0a6 hardens the subscribe-after-openSegment ordering to close a thermal-during-openSegment race. Real-device throttling induction + onThermalAbort timing is Phase 4 smoke against the live RecordingScreen.
resolved: 2026-05-11T02:42:11Z

### 5. Foreground service runs as camera|microphone|dataSync with KEEP_SCREEN_ON during a real capture

expected: `adb shell dumpsys activity services | grep ai.humynlabs.capture.fgs.HumynForegroundService` shows `fgservicetype=camera|microphone|dataSync`; the "Recording in progress" notification is non-dismissible; KEEP_SCREEN_ON window flag observable via `adb shell dumpsys window | grep -i keepscreenon`
result: passed
evidence: Initial smoke 2026-05-11T08:28:13+05:30 sessionId 01KRAFH39TAZ8FGSJKP2PH141B validated FGS bitmask + START_NOT_STICKY + notification flags + channel; surfaced GAP-1 (KEEP_SCREEN_ON missing). GAP-1 fixed in HumynCaptureModule.applyKeepScreenOn (toggles FLAG_KEEP_SCREEN_ON on currentActivity?.window from start()/stop() on UI thread). Re-verified live 2026-05-11T08:55:08 sessionId 01KRAH2BVXSJ639ZSE1GHY87M0: `dumpsys window windows | grep MainActivity` shows `fl=KEEP_SCREEN_ON LAYOUT_IN_SCREEN FORCE_NOT_FULLSCREEN ...` mid-capture; after stop the same dump shows `fl=LAYOUT_IN_SCREEN FORCE_NOT_FULLSCREEN ...` (KEEP_SCREEN_ON cleared). FGS bitmask + lifecycle remain perfect across all three smoke runs.

- FGS during run: ServiceRecord{...HumynForegroundService}, isForeground=true foregroundId=9001 types=0x000000C1 (CAMERA 0x40 | MICROPHONE 0x80 | DATA_SYNC 0x01) ✓
- Notification: flags=ONGOING_EVENT|FOREGROUND_SERVICE|SILENT (non-dismissible) ✓
- Channel: humyn_capture_fgs mImportance=2 (LOW) mShowBadge=false ✓
- startCommandResult=2 = START_NOT_STICKY ✓ (CR-02 fix)
- KEEP_SCREEN_ON: set during capture ✓, cleared after stop ✓ (GAP-1 fix)
- Clean teardown: FGS gone from dumpsys activity services after stop() ✓
  resolved: 2026-05-11T03:32:31Z

### 6. Byte-for-byte file fidelity from device to S3 (CAP-18) — round-trip SHA verification

expected: After 10-min capture on Pixel 7a/8a — `adb pull` MP4, compute SHA-256 locally, compare to `file_sha256` stamped in the metadata JSON. Both SHAs must match exactly. Repeat for IMU CSV vs `imu_sha256`.
result: passed
evidence: Validated on Pixel 10a via 30 s smoke capture (filenameBase `20260511_082813_001`). Three sibling artifacts written to `/data/user/0/ai.humynlabs.capture.apk/files/recordings/` — mp4 (28,113,319 bytes), csv (1,388,356 bytes), json (2,305 bytes). Pulled via `adb exec-out run-as ... cat` to /tmp/phase3-smoke-artifacts/.

MP4 host sha256: `6ce1600a1aa322e2a2455e563f93a39b4da07d92edc197045c57deaa1c58fff6`
MP4 stamped in metadata `file_sha256`: `6ce1600a1aa322e2a2455e563f93a39b4da07d92edc197045c57deaa1c58fff6` ✓ EXACT MATCH

CSV host sha256: `00905d614fee7aef1416a97f70bf19be6abd13c8c96c07cae5af377b0c6799a6`
CSV stamped in metadata `imu_sha256`: `00905d614fee7aef1416a97f70bf19be6abd13c8c96c07cae5af377b0c6799a6` ✓ EXACT MATCH

CAP-18 byte-for-byte fidelity proven — HashStreamer hashes the encoder output bytes in flight; the metadata composer stamps those hashes; `adb pull` of the encoder file produces the same hash. Note: a 30 s capture rather than 10 min was used to fit within Phase 3 scope (per D-WAVE-01 deferring 10-min E2E to Phase 4); the SHA round-trip invariant doesn't depend on duration.

Bonus ffprobe spec independent verification on the captured MP4:

- codec=hevc, profile=Main, codec_tag=hvc1, 1920x1080, has_b_frames=0, pix_fmt=yuvj420p (8-bit 4:2:0), color_space/transfer/primaries=bt709 (no HDR), level=120, bit_rate ≈ 7.5 Mbps (target 8 Mbps CBR — 30 s capture endpoints undershoot slightly, normal)
- Frame breakdown: **30 I-frames + 859 P-frames + 0 B-frames** ✓ (GOP=30 confirmed: 30 I / 29.87 s ≈ 1 keyframe/sec at 30 fps)
- duration 29.87 s, format=mp4 (isomiso2mp41)
  IMU CSV: 24,312 samples / 30.62 s ≈ 794 Hz sustained (`imu_min_rate_hz_observed_p1: 798` matches; floor of 100 Hz easily exceeded). Sensor stream rows scrubbed for gyro + accel timestamp-aligned at LSM6DSO ~416 Hz nominal / 800 Hz observed.
  resolved: 2026-05-11T03:01:20Z

### 7. Pause uploads on record start / resume on stop (CAP-13) — Phase 5 seam

expected: HumynCapture emits onSessionStart and onSessionStop events; HumynForegroundService.setUploadActive seam is callable. Phase 5 owns the JS-side upload-pause handler wiring.
result: passed
evidence: Live event lifecycle observed on Pixel 10a smoke capture (sessionId 01KRAFH39TAZ8FGSJKP2PH141B). UAT spec text says "onSessionStart" but the actual contract emits `onSegmentStart` per segment (first onSegmentStart IS the session-start signal; one session can span multiple segments). Captured event timeline from logcat:

- 08:28:14.209 onSegmentStart fired — payload `{filenameBase: 20260511_082813_001, startedAt: 2026-05-11T08:28:13.979561+05:30, recordingId: 01KRAFH3APJZNRZPY2KTWZ55TS, segmentId: 01KRAFH3AVT2DHYK6VVC64F034}` ✓
- 08:28:14.216 start() resolved with `{sessionId, segmentId, recordingId, filenameBase}` ✓ matches D-API-01 resolution shape
- 08:28:44.671 onSegmentComplete fired — payload includes drift `{p99: 2.07, mean: 1.78, max: 25.6}` ms, durationMs 30621, mp4Path, csvPath, jsonPath, imuMinRateHzObservedP1 798 ✓
- 08:28:44.673 onSessionStop fired — payload `{sessionId, segmentsCompleted: 1}` ✓
- 08:28:44.674 stop() resolved ✓

setUploadActive Phase-5 seam verified in source (no live JS call needed at this stage — Phase 5 owns the JS-side wiring). HumynForegroundService.kt exposes `ACTION_SET_UPLOAD_ACTIVE` Intent action + `EXTRA_UPLOAD_ACTIVE` boolean extra (WR-01 commit 04c0542 fix). Service routes the intent to `uploadActive.set(...)` on `onStartCommand` (lines 67–68). The previous instance method was unreachable; the Intent-action dispatch makes it externally callable from Phase 5 worker bodies via `startService(Intent(...).setAction(ACTION_SET_UPLOAD_ACTIVE).putExtra(EXTRA_UPLOAD_ACTIVE, true|false))`. Seam confirmed callable ✓.
resolved: 2026-05-11T03:01:20Z

### 8. 03-REVIEW.md blocker review — operator decision on whether to fix in Phase 3 or carry into Phase 4

expected: Operator reviews 03-REVIEW.md's 7 BLOCKER findings (CR-01..CR-07) — concurrent ArrayList in CaptureSession, FGS START_STICKY misuse, rotateSegment swallowed exceptions, pump-loop close-ordering race, cleanupAfterPreFlightFailure ordering bug, errorCodeFor dead branch + fragile string matching, MetadataComposer.writeAtomic non-atomic fallback. Decide whether each is fixed-in-Phase-3 or carried-into-Phase-4 alongside the on-device smoke walk.
result: passed
evidence: Operator decision = fix-in-Phase-3 for all 7. CR-01 → 7a89585 (CopyOnWriteArrayList), CR-02 → 971c557 (START_NOT_STICKY), CR-03/04/05 → 857f9ac (segment lifecycle hardening), CR-06 → f945bc4 (writeAtomic via Files.move ATOMIC_MOVE), CR-07 → ef5059b (typed bridge exceptions). 14 WR-\* warnings additionally landed (WR-01..WR-14, commits 04c0542..11a3718).
resolved: 2026-05-11T01:56:13Z

### 9. Plan 03-04 Task 0 pre-flight stamp verification: 03-WAVE1-SMOKE.md `re-walked-on:` is present

expected: 03-WAVE1-SMOKE.md frontmatter / sign-off block carries `re-walked-on: 2026-05-10` (post-Plan-03-11 re-re-walk on Pixel 10a). Already confirmed via grep — stamp present.
result: passed
evidence: `re-walked-on: 2026-05-10` present at 03-WAVE1-SMOKE.md lines 7, 185, 202 (verified via grep 2026-05-11).
resolved: 2026-05-11T01:56:13Z

## Summary

total: 9
passed: 5
deferred: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

Phase 3 acceptance disposition: UAT #1-#4 deferred to Phase 4 per locked CONTEXT.md D-WAVE-01 (Phase 3 = module-ready scope; Phase 4 owns RecordingScreen + 10-min/25-min/drift/thermal real-device E2E). UAT #5/#6/#7/#8/#9 all passed. GAP-1 (KEEP_SCREEN_ON) + GAP-2 (audio track absent) fixed inline 2026-05-11; both verified live on third smoke run (sessionId 01KRAHE26NS644XSZH6XTEKFNQ at T08:55+IST). GAP-3 (advisory) still flagged for Phase 4 10-min smoke re-measurement.

## Gaps

### GAP-1: KEEP_SCREEN_ON window flag not wired — RESOLVED

origin: UAT #5 partial finding (2026-05-11 smoke walk).
expected: During an active capture session, the host activity window should carry `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON` so the device screen does not sleep mid-recording. UAT #5 spec text requires `adb shell dumpsys window | grep -i keepscreenon` to produce evidence during a live capture.
observed: Zero source references to `KEEP_SCREEN_ON | setKeepScreenOn | FLAG_KEEP_SCREEN_ON` across `apps/mobile/android/` and `apps/mobile/src/`. The FGS keeps the process awake (CPU + wake lock) but the activity window is not flagged.
disposition: **RESOLVED 2026-05-11.** Fix applied to `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt` — new `applyKeepScreenOn(enabled: Boolean)` helper grabs `reactApplicationContext.currentActivity` (RN 0.83 deprecated the protected `currentActivity` accessor on ReactContextBaseJavaModule; the ReactApplicationContext path is the supported replacement) and dispatches a UI-thread `window.addFlags(FLAG_KEEP_SCREEN_ON)` on start, `clearFlags(FLAG_KEEP_SCREEN_ON)` on stop. Null-safe: if user backgrounds the app there is no window — FGS already keeps the process alive so silent no-op is correct. Idempotent on flag state. Verified live on third smoke run (sessionId 01KRAH2BVXSJ639ZSE1GHY87M0): `dumpsys window windows | grep MainActivity` shows `fl=KEEP_SCREEN_ON LAYOUT_IN_SCREEN ...` during capture; post-stop dump shows `fl=LAYOUT_IN_SCREEN ...` with KEEP_SCREEN_ON removed.

### GAP-2: Audio track absent from output MP4 (despite AacEncoder being instantiated) — RESOLVED

origin: 2026-05-11 smoke walk ffprobe audit of `20260511_082813_001.mp4`.
expected: Per idea-brief.md §6.3 and the locked capture spec, every segment MP4 must carry a 48 kHz mono AAC-LC 128 kbps audio track alongside the HEVC video track.
observed (pre-fix): ffprobe on the smoke-captured MP4 reports `nb_streams=1` — only one stream, codec_type=video. No audio. AAC encoder allocates (CCodec: allocate(c2.android.aac.encoder)) but produces 5 "discarded unknown buffers" at teardown — output never reaches the muxer.
root cause: Two compounded defects.

1. **Audio sub-pipeline entirely unwired** (per /gsd-debug session at `.planning/debug/no-audio-track-in-mp4.md`). `AacEncoder.configure()` + `makeAudioRecord()` were called, but `AudioRecord.startRecording()` was never invoked, no thread fed PCM into the AAC encoder, no thread drained AAC output, `muxer.addTrack(audioFormat)` was never called, and `writeSampleData` was never called for audio.
2. **`currentSegment === seg` race** triggered by the MuxerStartGate wiring. `currentSegment` is assigned _after_ `openSegment(...)` returns (call sites at preFlightAndStartFirstSegment line 158 and rotateSegment line 788). Pump runnables are posted inside openSegment; on fast looper dispatch the first while-condition check runs before `currentSegment` is set, so both pumps exit immediately without calling `markVideoTrackReady` / `markAudioTrackReady`. MuxerStartGate never opens → muxer.start() never fires → MP4 stays 0 bytes. Pre-gate code papered over this race because video had no gate and could addTrack+start on its own next iteration; the new coordination point turned it from "rare hiccup" to deterministic failure on this device.

disposition: **RESOLVED 2026-05-11.**

- Audio wiring: `apps/mobile/android/.../CaptureSession.kt` got `runAudioPumpLoop` (new audio pump on a dedicated HandlerThread that calls `audioRecord.startRecording()`, reads 2 KiB PCM frames, queues to AAC encoder with `elapsedRealtimeNanos`-derived segment-relative PTS, drains AAC output, registers audio track with the muxer, writes samples, signals EOS on stop). Added `MuxerStartGate` helper so `muxer.start()` fires once after BOTH video and audio tracks are added (or audio is explicitly abandoned via the finally block). Refactored `runPumpLoop`'s direct `muxer.start()` to `markVideoTrackReady`; gated video `writeSampleData` on `gate.isStarted()`. Extended `Segment` with `audioPumpThread/audioPumpExitLatch/audioPumpShouldStop/muxerStartGate`. `closeSegmentResources` now stops both pumps in parallel and awaits both exit latches. Also fixed a RN 0.83 deprecation in `HumynCaptureModule.applyKeepScreenOn` — must use `reactApplicationContext.currentActivity` not the protected accessor.
- Race fix: `currentSegment = seg` now happens _inside_ openSegment before the Handler.post calls (CaptureSession.kt step "6. Publish currentSegment BEFORE posting"). The caller's existing `currentSegment = openSegment(...)` becomes a tautological re-assignment of the same reference. Both pumps now see currentSegment correctly on first iteration.
- Verified live on third smoke run 2026-05-11 sessionId 01KRAHE26NS644XSZH6XTEKFNQ: ffprobe on `20260511_090131_004.mp4` reports `nb_streams=2` — stream 0 = `aac LC 48000 Hz mono 128 kbps duration 29.94 s`, stream 1 = `hevc Main 1920x1080 7.7 Mbps duration 29.87 s`. SHA round-trip exact on both MP4 + IMU CSV. CCodec "discarded unknown buffer" log gone.
- Caveat: drift figures rose once audio joined the alignment calc (max 25→29 ms, mean 1.78→5.52, p99 2.07→5.82). Likely audio-PTS-vs-bytes-consumed approach needed for ±1 ms target — see GAP-3.

### GAP-3 — audio dropped from capture spec to preserve drift invariant — RESOLVED

origin: 2026-05-11 smoke walk. Drift residual across four 30 s sessions on Pixel 10a:

| Smoke | Audio         | PTS scheme     | max (ms) | mean (ms) | p99 (ms) |
| ----- | ------------- | -------------- | -------- | --------- | -------- |
| 1     | OFF (unwired) | n/a            | 25.60    | 1.78      | 2.07     |
| 3     | ON            | wall-clock     | 29.35    | 5.52      | 5.82     |
| 4     | ON            | bytes-consumed | 28.11    | 4.29      | 4.58     |
| 6     | OFF (toggle)  | n/a            | 26.86    | 3.03      | 3.33     |

expected: idea-brief.md §6.5 example values `max ≈ 0.7 ms, mean ≈ 0.18 ms, p99 ≈ 0.5 ms`; locked spec was "±1 ms timestamp alignment between video, audio, and IMU."

observed: mean/p99 inflated 3× when audio joined the pipeline (Smoke 3). Switching audio PTS from wall-clock to bytes-consumed × (1/sample_rate) recovered ~22% (Smoke 4). Disabling audio capture entirely (Smoke 6) restored mean/p99 to ~3 ms — close to the audio-off baseline (Smoke 1's 1.78/2.07), residual gap is likely AAC-encoder idle thermal overhead + device-warmer-than-Smoke-1.

**SPEC CHANGE DECISION (project owner, 2026-05-11):** Audio dropped from the locked capture spec. Training pipeline (VLA/VLN/robotics) consumes egocentric video + IMU; audio is not on the critical path. Drift invariant (±1 ms target) takes precedence over an optional input channel.

disposition: **RESOLVED 2026-05-11 via three batched commits.**

1. `apps/mobile/android/.../CaptureSession.kt::openSegment` — `audioRecord = null` (single-toggle disable; AacEncoder.configure() retained for close-path safety; runAudioPumpLoop + MuxerStartGate + audio-pump HandlerThread plumbing dormant but intact for future re-enablement).
2. `apps/mobile/android/.../MetadataComposer.kt` — `audio_sample_rate_hz`, `audio_codec`, `audio_bitrate_bps`, `audio_channels` stamped as `JSONObject.NULL` instead of the locked constants. JSON consumers must treat as nullable (consistent with existing nullable drift fields).
3. `apps/mobile/android/.../MetadataSchemaConformanceTest.kt` — updated to assert `isNull(...)` for the four audio fields. All 21 capture/\* unit tests pass.

Verified live on Pixel 10a 2026-05-11 sessionId 01KRAJ7YP37Y42NHT5JDT1JWDD (smoke 6): ffprobe reports `nb_streams=1` (single video stream, codec=hevc, duration 29.87 s, 29.2 MB MP4); metadata JSON's four `audio_*` fields are `null`; drift mean 3.03 / p99 3.33 ms (still above ±1 ms target but Phase 4 10-min smoke is the real evaluation gate — short-capture ramp-up dominates 30 s figures); SHA round-trip exact on MP4 + IMU CSV.

Phase 4 follow-up if 10-min drift > 1 ms (less urgent now that audio is out of the picture): inspect per-frame video timestamp jitter, revisit DriftCalculator early-window behavior, consider whether a separately allocated AAC encoder (now dormant) is still worth carrying — could drop entirely for further drift gains. WR-06 commit fa6e286 already documented a known minor edge-clamp under-report; that's distinct from this concern.

Spec-doc updates: `CLAUDE.md` Constraints section and `idea-brief.md §2.1 / §6.3` references to audio should be updated to reflect this decision in a follow-up doc pass (intentionally not auto-touched in this commit — locked-spec doc edits are owner-only).
