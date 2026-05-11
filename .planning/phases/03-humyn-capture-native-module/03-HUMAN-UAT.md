---
status: partial
phase: 03-humyn-capture-native-module
source: [03-VERIFICATION.md]
started: 2026-05-11T00:31:07Z
updated: 2026-05-11T03:01:20Z
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
result: partial
evidence: Validated on Pixel 10a (5C161JEA304304, Android 16) via 30 s smoke capture at 2026-05-11T08:28:13+05:30 (sessionId 01KRAFH39TAZ8FGSJKP2PH141B). FGS dumpsys during run — `ServiceRecord{...HumynForegroundService}`, `isForeground=true foregroundId=9001 types=0x000000C1`. **0xC1 decodes to FOREGROUND_SERVICE_TYPE_CAMERA(0x40) | MICROPHONE(0x80) | DATA_SYNC(0x01)** ✓ matches spec exactly. `startCommandResult=2` = START_NOT_STICKY ✓ (CR-02 fix verified live). Notification flags `ONGOING_EVENT|FOREGROUND_SERVICE|SILENT` (non-dismissible) ✓. Channel `humyn_capture_fgs` mImportance=2 (LOW) mShowBadge=false ✓. FGS torn down cleanly after stop() ✓. **GAP — KEEP_SCREEN_ON window flag is NOT wired** — zero grep hits for `KEEP_SCREEN_ON|setKeepScreenOn|FLAG_KEEP_SCREEN_ON` across apps/mobile/android/ + apps/mobile/src/. The capture pipeline doesn't add this flag to the current activity window during start(). Should be added in a Phase 3 follow-up plan or absorbed into Phase 4 RecordingScreen wiring; recorded in Gaps below.
resolved: 2026-05-11T03:01:20Z

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
passed: 4
partial: 1
deferred: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

Phase 3 acceptance disposition: UAT #1-#4 deferred to Phase 4 per locked CONTEXT.md D-WAVE-01 (Phase 3 = module-ready scope; Phase 4 owns RecordingScreen + 10-min/25-min/drift/thermal real-device E2E). UAT #5 partial (FGS bitmask + lifecycle perfect; KEEP_SCREEN_ON flag missing — see Gaps). UAT #6 + #8 + #9 passed outright. UAT #7 passed via live event-lifecycle observation + WR-01 setUploadActive Intent-action seam.

## Gaps

### GAP-1: KEEP_SCREEN_ON window flag not wired

origin: UAT #5 partial finding (2026-05-11 smoke walk).
expected: During an active capture session, the host activity window should carry `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON` so the device screen does not sleep mid-recording. UAT #5 spec text requires `adb shell dumpsys window | grep -i keepscreenon` to produce evidence during a live capture.
observed: Zero source references to `KEEP_SCREEN_ON | setKeepScreenOn | FLAG_KEEP_SCREEN_ON` across `apps/mobile/android/` and `apps/mobile/src/`. The FGS keeps the process awake (CPU + wake lock) but the activity window is not flagged. During the 30 s smoke run, `dumpsys window | grep -i keepscreenon` returned empty.
impact: A user who taps record then locks their screen / steps away may have the display sleep mid-capture. On most modern Pixels the capture continues (CPU + camera + encoder owned by FGS); but on some OEMs and with aggressive power profiles the display sleep may pull the activity into onPause / surface invalidation paths that affect Camera2 preview surfaces and the HevcEncoder input surface. Should be wired before Phase 4 RecordingScreen ships so the locked spec ("KEEP_SCREEN_ON observable") is honored on real hardware.
disposition: deferred / open. Candidate fix locations: `HumynCaptureModule.start()` (line ~317, where the AudioRecord + encoder pipeline boots) — call `reactContext.currentActivity?.runOnUiThread { window.addFlags(FLAG_KEEP_SCREEN_ON) }`. Clear in `stop()` via `clearFlags(FLAG_KEEP_SCREEN_ON)`. Alternatively defer to Phase 4 RecordingScreen and clear this gap there.

### GAP-2: Audio track absent from output MP4 (despite AacEncoder being instantiated)

origin: 2026-05-11 smoke walk ffprobe audit of `20260511_082813_001.mp4`.
expected: Per idea-brief.md §6.3 and the locked capture spec, every segment MP4 must carry a 48 kHz mono AAC-LC 128 kbps audio track alongside the HEVC video track. The metadata composer stamps these values in the per-segment JSON (`audio_codec: AAC-LC`, `audio_sample_rate_hz: 48000`, `audio_bitrate_bps: 128000`, `audio_channels: 1`).
observed: ffprobe on the smoke-captured MP4 reports `nb_streams=1` — only one stream, codec_type=video. No audio stream is present. Logcat confirms the AAC encoder allocates in our process: `08:28:14.067 D CCodec: allocate(c2.android.aac.encoder)` followed by `08:28:14.081 I CCodec: Created component [c2.android.aac.encoder]`. Two minutes after stop() the encoder logs `MediaCodec discarded an unknown buffer` (×5) — buffers that were never picked up by the muxer. So: AAC encoder configured + AudioRecord likely started, but the encoder's output sample stream never reached `FragmentedMuxerWrapper.writeSampleData()` for the audio track index.
impact: HIGH. Audio is in the locked spec and required for training-pipeline ingestion. Metadata JSON's audio fields are constants set by the composer (not encoder-probed), so the JSON lies about presence. CAP-18 SHA round-trip still passes — but the bytes being hashed are video-only. Real users would record silent videos despite the metadata claiming audio.
disposition: open / requires investigation. Likely root causes (to confirm via debug session):

1. AudioRecord.startRecording() never called, or returned ERROR_INVALID_OPERATION (no exception, audio silently no-ops).
2. Audio buffer pump loop not started, or exited early.
3. Muxer audio track index never assigned (`muxer.addTrack(audioFormat)` never returned a valid index, or the audio MediaFormat from OUTPUT_FORMAT_CHANGED wasn't propagated).
4. AudioManager null at HumynCaptureModule line 319 (`audioMgr?.let { ... }`) — if so, the entire audio sub-pipeline silently no-ops.
5. Microphone permission state at the FGS start gate; AudioRecord boots but can't read frames.
   recommended next move: `/gsd-debug` session targeting "audio track absent from output MP4 despite AacEncoder.configure() succeeding on Pixel 10a smoke capture" — should be a quick root-cause (single null check or missing pump thread start), then either fix in Phase 3 (creates a Phase 3.1 polish wave) or carry into Phase 4 RecordingScreen wiring.

### GAP-3 (advisory): drift max ≈ 25 ms on 30 s capture — investigate before 10-min smoke

origin: 2026-05-11 smoke walk. Drift residual computed for a 30 s session: `max: 25.604882125 ms`, `mean: 1.7825190358900442 ms`, `p99: 2.0751548125 ms`.
expected: idea-brief.md §6.5 example values `max ≈ 0.7 ms, mean ≈ 0.18 ms, p99 ≈ 0.5 ms` for a healthy 10-min capture; the locked spec is "±1 ms timestamp alignment between video, audio, and IMU."
observed: max ~25 ms is high; mean + p99 are reasonable. Likely a single early-session frame at the audio/encoder ramp-up (well-known artifact for short captures). Not necessarily a bug — 30 s captures amortize ramp-up worse than 10-min captures. Phase 4's 10-min smoke (UAT #1) will tell whether mean/p99 stay healthy and max relaxes. WR-06 commit fa6e286 already documented a known minor edge-clamp under-report; that's distinct from this concern.
disposition: advisory — re-measure during Phase 4 10-min smoke (UAT #1). If 10-min max stays > 5 ms, open a debug session targeting DriftCalculator early-window behavior under live AudioRecord pump cadence.
