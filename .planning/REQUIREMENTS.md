# Requirements: Homelander (Humyn Labs Capture)

**Defined:** 2026-05-07
**Core Value:** On-device capture quality is non-negotiable — every uploaded segment must hit the locked spec (1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment) or the bytes are worthless for training.

> Requirements are derived verbatim where possible from the locked spec assets:
>
> - `idea-brief.md` (canonical product spec)
> - `design-spec.md` + `prototype.html` (locked designs)
> - `engineering-handoff.md` (locked engineering contract)
> - `task-taxonomy.md` (the 65 tasks)
> - `help-center-content.md` (verbatim Help Center copy)
> - `video_metadata.json` (canonical metadata schema)
>
> Items tagged **[research]** are additions surfaced by `.planning/research/SUMMARY.md` (mostly P1 table-stakes oversights and IMU-liveness promotion).

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with Google account via "Continue with Google" CTA
- [ ] **AUTH-02**: User must check the Terms of Use consent box before sign-up proceeds (default checked; unchecked + tap shows the alert; no nav)
- [ ] **AUTH-03**: User can view full Terms of Use copy (verbatim from `idea-brief.md` §5.2 / `design-spec.md` §18.1) in a popup before consenting
- [ ] **AUTH-04**: System fetches `name`, `email`, `birthday`/`age`, `gender` from Google on success; age and gender are nullable when Google withholds them
- [ ] **AUTH-05**: System runs Play Integrity Standard verification at sign-in; rooted, emulator, and non-Play-Store devices are rejected
- [x] **AUTH-06**: APK build flavor bypasses the Play-Store install-source check via Remote Config (Play Store flavor cannot opt into bypass)
- [ ] **AUTH-07**: User session persists across app launches (token in Keychain / Keystore)
- [x] **AUTH-08**: User can log out from Profile (cancels in-flight upload, preserves local upload queue, returns to Sign-up)
- [x] **AUTH-09**: User can soft-delete account (30-day restore window via re-login; after 30 days, deletion is permanent; uploaded recordings stay on server)
- [x] **AUTH-10**: Account-delete flow requires typing **DELETE** in a confirmation modal before the API fires
- [ ] **AUTH-11**: Same-Google-account on a new device re-runs the full compatibility check before sign-in completes

### Permissions

- [ ] **PERM-01**: System prompts for Camera permission before the compatibility check; denied state shows the recovery copy and links to OS Settings
- [ ] **PERM-02**: System prompts for Microphone permission before the compatibility check
- [ ] **PERM-03**: System prompts for coarse Location permission before the first recording
- [x] **PERM-04**: System declares manifest-only permissions for Sensors (gyro/accel), Foreground Service (camera + microphone + dataSync), Wake Lock, and Network State

### Device Compatibility Check

- [ ] **COMPAT-01**: System runs a one-time compatibility check after permissions are granted; checks include resolution 1080p, ≥30 FPS, ultrawide dFOV ≥110°, gyro + accel presence, microphone 48 kHz, REALTIME timestamp source, and root verdict
- [ ] **COMPAT-02**: Compatibility check verifies IMU **sustained ≥100 Hz over a 30-second window** while a 1080p preview runs (not a brief idle sample)
- [ ] **COMPAT-03**: Compatibility check shows a non-blocking storage warning when free space < 5 GB
- [ ] **COMPAT-04**: Compatibility check re-runs after every app update or OS update, and on a new device with the same Google account
- [ ] **COMPAT-05**: When the compat bar is later raised, devices that previously passed but now fail are blocked from new recordings (existing recordings remain accessible for upload)
- [ ] **COMPAT-06**: On compat fail, the screen lists exactly which checks failed; user cannot proceed beyond the screen
- [ ] **COMPAT-07**: Compat-check verifies _behavior_ not advertised metadata: NAL-unit parse on a test clip to detect B-frame leakage; OIS-OFF readback via `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION`; HDR-mode SDR force via `DynamicRangeProfile.STANDARD`; IMU inter-sample p99 ≤ 12 ms with `maxReportLatency=0` **[research]**
- [ ] **COMPAT-08**: Compat-fail "what now" recovery page presents next steps (try a different qualifying device; contact support); not a brick **[research]**

### Onboarding Tutorial

- [ ] **ONB-01**: First-time user sees the Rig screen ("You'll need a head rig" + body copy verbatim from spec) before practice
- [ ] **ONB-02**: Rig screen offers a "Don't have a rig yet" off-ramp (recovery info + contact link) so users without rigs aren't soft-locked **[research]**
- [x] **ONB-03**: First-time user goes through a 60-second practice recording with `practice = true` propagated through capture, metadata, and upload-queue exclusion
- [x] **ONB-04**: Practice recording is captured locally but NEVER uploaded, NEVER appears in History, NEVER counts toward contribution
- [x] **ONB-05**: Practice recording auto-stops at exactly 60 seconds (hard cap) regardless of any other lifecycle event
- [x] **ONB-06**: All multimodal alerts (battery / storage / thermal) remain active during practice so users experience them
- [x] **ONB-07**: After practice, user sees the Practice-complete screen with success badge, confetti animation, light haptic `[40, 80, 40]` ms, and `Continue` CTA
- [x] **ONB-08**: Tutorial runs **only once per install per Google account**; reinstalls trigger it again; there is no re-entry path from within the app

### Home Screen

- [ ] **HOME-01**: First-time user sees the empty hero ("Record your first task" / "Start Recording") + zero-state tiles + an empty-tip line
- [ ] **HOME-02**: Returning user sees the dynamic hero (lifetime contribution numeric + task count + Start Recording CTA) and real-data tiles
- [ ] **HOME-03**: Recording-duration tile supports time-range toggles: today / yesterday / this week / this month / all time / custom range
- [ ] **HOME-04**: Tasks-recorded tile supports the same time-range toggles
- [ ] **HOME-05**: Pending-uploads tile is visible only when count > 0; tapping opens a full upload-queue screen with per-file progress
- [ ] **HOME-06**: Duration formatter outputs `< 1 min → Xs`, `< 1 hr → Xm`, `≥ 1 hr → Xh Ym` floored to the previous minute (`2h 4m 59s` → `2h 4m`)
- [x] **HOME-07**: Bottom navigation has exactly three tabs (Home / Tasks / History); Profile is reached only via the avatar in the top-right
- [x] **HOME-08**: Bottom navigation is suppressed on splash, sign-up, permissions, compat-check, tutorial, recording, and force-upgrade screens
- [ ] **HOME-09**: User can pull-to-refresh on Home tiles to fetch the latest contribution numbers from `/contributions` **[research]**
- [ ] **HOME-10**: Home shows a non-blocking offline banner in the Pending Uploads tile when network is unreachable **[research]**

### Tasks

- [ ] **TASK-01**: User can browse all 65 tasks across 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby) sourced from `task-taxonomy.md`
- [ ] **TASK-02**: Per-category pills filter the list (horizontally scrollable; first pill flush-left at rest; subtle right-edge gradient hint)
- [ ] **TASK-03**: User can search tasks via an always-visible debounced (200 ms) input that runs **server-side lexical search** (`ts_vector` + GIN) on task name + description with fuzzy fallback _(semantic/pgvector + RRF descoped from MVP 2026-05-11 — see §v2 SEARCH-V2-01)_
- [ ] **TASK-04**: Each task card shows lucide-react icon (28 px stroke 1.75) via `<TaskIcon task={slug} />`, name (verbatim from taxonomy), category eyebrow, and 1-2 line description
- [ ] **TASK-05**: Tapping a card opens the Task details sheet with category chip, optional outdoor chip, name + description (verbatim), Universal rules block, "For this task" instructions (max 3 bullets), and Start Recording CTA
- [ ] **TASK-06**: Universal rules block renders 4 equal-weight rules (`front_hand` "Keep your hands in frame", `videocam` "Mount the device firmly on the rig", `lightbulb` "Make sure your space is well-lit", `apps` "Close all other apps before you start") sourced from `task-taxonomy.md` header
- [ ] **TASK-07**: Per-task instructions are task-specific only — server-side validation rejects entries where `instructions.length > 3` or where any bullet duplicates a universal-rule string (case-insensitive substring on "hands in frame", "mount the device", "well-lit", "close all other apps")
- [ ] **TASK-08**: User can tap "Send request" in the Tasks footer to open a form (name 3-80 chars / description 10-240 chars / category from taxonomy + Other / segmented Indoor/Outdoor / optional ≤30s ≤50MB sample video)
- [ ] **TASK-09**: User does **not** see the status of submitted task requests (no list, no status chip)
- [ ] **TASK-10**: Tasks screen shows a non-prototype "no results" empty state when search/filter yields zero (lucide `SearchX` + 14 px secondary line + send-request link) **[research]**

### Recording — Capture Pipeline (Bytes-on-disk)

- [x] **CAP-01**: Capture pipeline records 1920×1080 video at 30 FPS in landscape with HEVC Main profile, CBR 8 Mbps, GOP 30, no B-frames (`KEY_LATENCY=1` + verified at NAL-unit level), 8-bit YUV 4:2:0, no HDR, no image stabilisation
- [x] **CAP-02**: System writes a fragmented MP4 with a periodic moov-flush every 30 seconds for crash resilience
- [x] **CAP-03**: Capture pipeline records audio at 48 kHz mono AAC-LC 128 kbps using `MediaRecorder.AudioSource.MIC` / equivalent
- [x] **CAP-04**: Capture pipeline records IMU (gyro + accel) at the device's maximum supported rate via `SensorManager.SENSOR_DELAY_FASTEST`, with sensor batching (`maxReportLatency`) to reduce wake-ups while preserving sample rate
- [x] **CAP-05**: System writes a sidecar IMU CSV per recording with columns `timestamp_ns,sensor_type,x,y,z` (sensor units: rad/s for gyro, m/s² for accel; both sensors interleaved by timestamp)
- [x] **CAP-06**: All three streams (video, audio, IMU) are timestamped against the same `SystemClock.elapsedRealtimeNanos` (Android) / `mach_absolute_time` (iOS) clock
- [x] **CAP-07**: Camera2 timestamp source is configured as `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`; devices that only support `UNKNOWN` fail compatibility
- [x] **CAP-08**: Per-segment metadata records `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` computed via least-squares residual-subtraction methodology defined in `idea-brief.md` §6.5
- [x] **CAP-09**: System auto-segments every 10 minutes (remote-config-driven default) with a 0.5-second silent gap; each segment is an independent recording (own MP4 / CSV / JSON / upload / QA decision; **no `parent_recording_id` linkage**)
- [x] **CAP-10**: Hand-detection gate does **NOT** re-run at 10-minute auto-segment cuts (only on a fresh tap of the record button after stop / re-entry)
- [x] **CAP-11**: Pre-record thermal check refuses to start when `PowerManager.getCurrentThermalStatus() ≥ THROTTLING` with toast `Phone is too warm. Let it cool before recording.`
- [x] **CAP-12**: Mid-record thermal escalation `≥ THROTTLING_SEVERE` plays the voice line "Phone too hot, stopping recording" then ends the segment cleanly within ~2.5 s; new recordings refused until cool
- [x] **CAP-13**: System pauses all in-flight uploads on record start and resumes on stop
- [x] **CAP-14**: System keeps the screen on (`KEEP_SCREEN_ON`) and runs as a foreground service of type `camera | microphone | dataSync` (Android) during active recording
- [x] **CAP-15**: System computes SHA-256 of the MP4 and SHA-256 of the IMU CSV at finalize time; both hashes go into the metadata JSON as `file_sha256` and `imu_sha256`
- [x] **CAP-16**: System generates a metadata JSON per segment matching the schema in `video_metadata.json` (schema_version, recording_id ULID, contributor_info, task_info, capture_device_info, metadata block with full capture spec + drift figures + hashes + sizes in bytes)
- [x] **CAP-17**: Filename convention is `YYYYMMDD_HHMMSS_NNN.<ext>` with `NNN` as the per-day sequence; same base name across MP4 / CSV / JSON
- [x] **CAP-18**: Files (MP4 / CSV / JSON) are NEVER decoded, re-encoded, transcoded, or stripped — they travel byte-for-byte from device to S3
- [x] **CAP-19**: System records a runtime IMU sample-rate observation (`imu_min_rate_hz_observed_p1`) and rejects segments client-side if sustained rate drops below 80 Hz **[research]**

### Recording — Capture Quality Gate (Finalize-time enforcement)

- [x] **CAPTURE-QA-01**: Finalize gates uploads on `mean_fps ≥ 29.0` computed as `(N - 1) / ((lastTs_ns - firstTs_ns) / 1e9)` over the segment's frame timestamps; failing segments are canceled with `reason="fps_dropped"` and never enter the upload queue. (`videoFrameTimestamps.size < 2` → `reason="insufficient_frames"`.) — Threshold tightened from 28.0 → 29.0 on 2026-05-17 after the Pixel-10a + Pixel-8a cancel-walk (healthy recordings stamped ~30 fps clean on both devices; 29.0 catches genuine drops without flagging measurement noise around the LOCKED 30 fps target).
- [x] **CAPTURE-QA-02**: Finalize gates uploads on resolution by reading the muxed MP4's video-track header (`MediaExtractor KEY_WIDTH / KEY_HEIGHT`); `width < 1920 OR height < 1080` → canceled with `reason="resolution_dropped"`. EncoderProbe's compat-check is tightened to verify the 1920×1080 surface is actually deliverable (encoder `OUTPUT_FORMAT_CHANGED` reports the requested resolution), not just that the HEVC codec exists.
- [x] **CAPTURE-QA-03**: Every spec-relevant field in `MetadataComposer.compose()` is derived from measured / probed / reported sources: `fps` from `measuredMeanFps`; `resolution` / `video_codec` / `video_profile` / `bitrate_bps` / `bitrate_mode` / `gop` / `color_space` / `color_depth_bits` / `b_frames` from the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat snapshot + the MediaExtractor track-header read; `orientation` from the surface rotation captured at session start (`landscape_left` / `landscape_right`). The composer carries ZERO hardcoded spec literals (regression-guarded by `MetadataComposerLiteralsTest`'s comment-stripped grep gate). `hdr` and `image_stabilization` are camera flags verified at compat-check (`EncoderProbe.hdrSdrForced` / `oisOff`) rather than encoder flags, so they remain configured-literal in the JSON with a cite to the compat-check truth-source.
- [x] **CAPTURE-QA-04**: A canceled segment never enters the upload queue. `UploadQueueStore.enqueue` short-circuits when `UploadRow.cancelReason != null` (belt-and-braces backstop); the JS-side `RecordingScreen.onSegmentCanceled` handler is the primary gate and never calls `HumynUpload.enqueue` on cancel.
- [x] **CAPTURE-QA-05**: A canceled segment is recorded as a History row only — Pending Uploads never renders it. The History row's MMKV ledger entry carries `{ cancel: { reason, meanFps?, width?, height? } }`; `HistoryRow` renders the chip-failed visual variant with three reason-specific copy strings: `"Canceled — frame rate dropped"` / `"Canceled — resolution dropped"` / `"Canceled — recording too short"`. The row is non-retryable (no Retry affordance). The server is not notified (local-only — no `/cancel-report` endpoint at MVP).
- [x] **CAPTURE-QA-06**: After the History ledger entry is persisted, the MP4 + IMU CSV + metadata JSON are deleted from cacheDir (write-then-delete order — `RNFS.unlink` runs only after `writeThumbnailLedgerEntry` resolves). On a write failure, the files are still deleted to reclaim disk; the History row is silently lost (best-effort).
- [x] **CAPTURE-QA-07**: Recording-id filename prefix (quick 260522-elm). On-disk artifacts (video / imu / metadata / sidecar) are named `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}` — the 26-char ULID `recordingId` prepended to the per-day base. `FilenameGenerator.nextBase`'s per-day NNN ls-scan strips a leading 26-char ULID prefix before parsing (backward-compatible with legacy un-prefixed files; mixed-dir max honored). `metadata.filename` / `imu_filename` carry the prefixed names. **S3 object keys are UNCHANGED** — still literally `video.mp4` / `imu.csv` / `metadata.json` under `recordings/{userId}/{recordingId}/` (the key is derived from `recordingKeys()`, never the local filename). Android only.
- [x] **CAPTURE-QA-08**: Live-Camera2 camera intrinsics in `metadata.json` (schema bumped 1.1.0 → 1.2.0; quick 260522-elm). A new top-level `calibration.camera` block (model / resolution / params{fx,fy,cx,cy,skew} / distortion_coeffs / intrinsics_source) read from the **ultrawide physical sub-camera's** `CameraCharacteristics` (`LENS_INTRINSIC_CALIBRATION`, `LENS_DISTORTION`, `SENSOR_INFO_ACTIVE_ARRAY_SIZE`) — the lens HumynCapture actually records on. Null fallback with `intrinsics_source = "camera2_uncalibrated"` when the device reports UNCALIBRATED (common on Pixels); the block is ALWAYS present with the full key structure; the reader never throws and never blocks capture. Mirrors the SPC2 reference rig's `meta.json`. Genuine non-null values are on-device-only (manual smoke). Android only.
- [x] **CAPTURE-QA-09**: Cam-IMU offset (temporal + spatial) in `metadata.json` `calibration.cam_imu_extrinsics` (quick 260522-elm). T*cam_imu / T_imu_cam (4×4) + T_cam_imu_translation_mm from `LENS_POSE_TRANSLATION` / `LENS_POSE_ROTATION`; `timeshift_cam_imu_sec` default `0.0` + `timeshift_meaning = "t_imu = t_cam + timeshift"` + `clock_sync_note` from `SENSOR_INFO_TIMESTAMP_SOURCE`. Null matrices + `extrinsics_source = "camera2_no_imu_reference"` when `LENS_POSE_REFERENCE != GYROSCOPE` or values are null. The existing `imu_video_drift*{max,mean,p99}\_ms`fields are untouched — this ADDS offset/extrinsics telemetry. Backend:`recordings.calibration jsonb`column +`/recordings/init` validates (zod, null params tolerated) + persists. Android only.

### Recording — Hand-detection Gate

- [x] **HAND-01**: On record-button press, gate runs once per recording session via a custom Kotlin (Android) / Swift (iOS) RN module wrapping MediaPipe HandLandmarker (`hand_landmarker.task` ~7.8 MB, `RunningMode.IMAGE`, `numHands=2`, all confidences 0.5, CPU delegate)
- [x] **HAND-02**: Gate displays the centered prompt "Mount the phone on your head and bring your hands in frame for 2 secs" + custom 130×130 progress ring (6 px stroke, accent fill on translucent track, clockwise increment via `stroke-dashoffset`) + Skip link visible from t=0
- [x] **HAND-03**: Detection loop polls every ~400 ms (Android) / ~600 ms (iOS) via `Camera.takePhoto()` → native `HandDetector.detectHands(path)` → returns hand count
- [x] **HAND-04**: Gate pass = exactly 2 hands detected for **N consecutive successful checks** (5 on Android, 3 on iOS); any check returning `≠ 2` resets the counter to 0 with instant ring snap-back (no animation)
- [x] **HAND-05**: Gate runs indefinitely until pass or skip — no timeout, no auto-cancel
- [x] **HAND-06**: Gate shows a loading state (spinner inside ring well + caption `Preparing camera…`) when the camera isn't streaming yet; accumulator does not start until the first frame arrives
- [x] **HAND-07**: Skip link bypasses the gate silently — no voice cue, no haptic, brightness still drops to 5%
- [x] **HAND-08**: Native module unavailable → silent bypass (`bypassed = true`) — same UX as Skip
- [x] **HAND-09**: On gate pass (not skip, not silent bypass), system fires 80 ms vibrate + TTS "Recording started." in Indian English female voice + brightness drops to 5%
- [x] **HAND-10**: Tapping X during the gate is treated as a pre-record exit — silent dismiss to Home, no confirmation modal, no captured data to discard
- [x] **HAND-11**: Hand-gate target hits, cadence, and `minHandDetectionConfidence` are Firebase Remote Config keys so they can be retuned without an app release
- [x] **HAND-12**: System pre-warms the photo pipeline at recording-screen mount to avoid the gate ring sitting at 0 during `takePhoto()` cold-start latency **[research]**
- [x] **HAND-13**: Gate decodes captured photos at 320×240 RGB_565 with explicit `bitmap.recycle()` to avoid memory pressure under sustained gate cadence **[research]**
- [x] **HAND-14**: System emits per-locale `recording_gate_skipped` rate telemetry as a leading skin-tone-bias indicator **[research]**

### Recording — UX & Lifecycle

- [x] **REC-01**: Recording surface auto-rotates to landscape, locks orientation, and shows the rotate-prompt animation until landscape is detected
- [x] **REC-02**: Recording surface displays a 3-second top-anchored disappearing overlay "Don't exit while recording." on entry
- [x] **REC-03**: After gate exit, recording surface shows minute-bar timer, mono HH:MM:SS counter, and floating stop button
- [x] **REC-04**: Stop tap fires voice cue "Recording stopped." + 2-second toast `{Hh Mm} added to your contribution.` (formatter matches HOME-06)
- [x] **REC-05**: Re-pressing record after stop starts a **fresh recording** under the same task; switching tasks requires exiting the recording screen
- [x] **REC-06**: Tapping X during active recording shows the Stop confirmation modal (`Keep recording` / `Stop`); pre-record exit is silent
- [x] **REC-07**: Recordings shorter than 60 seconds are discarded with toast `Recording too short — discarded.`; not uploaded, not in History, not counted
- [x] **REC-08**: Display behavior during recording: `KEEP_SCREEN_ON`, brightness auto-dimmed to 5% (restored on stop or exit)
- [x] **REC-09**: System does **NOT** programmatically toggle DND during recording (no `ACCESS_NOTIFICATION_POLICY` use, no Settings deep-link, no in-app DND nudge)
- [x] **REC-10**: Battery drop to ≤15% fires alert pill + 520 Hz beep (200 ms) + `[100, 50, 100]` ms haptic + voice "Battery low. Consider charging soon." Recording continues; new recordings refused below 5% until charged ≥15%
- [x] **REC-11**: Battery drop to ≤5% ends the current segment immediately
- [x] **REC-12**: Phone-call answered, alarm rings, rotation out of landscape, force-quit, OS-evict, or storage-full mid-record stops the recording per `idea-brief.md` §10 lifecycle table (upload if ≥60 s; discard if not)
- [x] **REC-13**: Phone-call declined → recording continues
- [x] **REC-14**: TTS uses Indian English female voice (en-IN) with the documented fallback chain (en-IN female → en-IN neutral → en-US female → first available en-\*); rate 1.0, pitch 0.95, volume 0.85
- [x] **REC-15**: Voice cues are duplicated as the centered VoiceCue overlay text for accessibility
- [x] **REC-16**: System runs a recurring storage check before each recording start (compat-time check is one-time only) **[research]**

### Upload Pipeline

- [x] **UP-01**: System uploads each segment's three files (MP4 + IMU CSV + metadata JSON) via S3 multipart with presigned URLs
- [x] **UP-02**: Chunk size = 8 MB on Wi-Fi (last chunk may be smaller); 2 MB on cellular (per research **[research]**) (cellular S3 part size = 5 MiB — reconciled to S3's 5-MiB minimum non-final part size, 2026-05-12; idea-brief.md §7.1 still states 2 MB, not edited)
- [x] **UP-03**: Concurrency = 3 chunks in parallel per file × 2 files in parallel
- [x] **UP-04**: Failed chunks retry independently with exponential backoff (2 / 4 / 8 / 16 / 32 / 64 s → dead-letter); no whole-file restart
- [x] **UP-05**: Uploads start automatically once a recording stops
- [x] **UP-06**: Uploads run in a foreground service that survives backgrounding and force-quit; on Android 14+ the service type downgrades from `camera|microphone|dataSync` (during recording) → `dataSync` (post-recording) → stops after 5 min idle **[research]**
- [x] **UP-07**: On Android 15+, true-background uploads run via a UIDT JobService (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS` permission) to survive the 6-hour `dataSync` cap **[research]**
- [x] **UP-08**: On iOS, uploads run via `URLSessionConfiguration.background(withIdentifier:)` with `sessionSendsLaunchEvents = true` and `isDiscretionary = false`; multipart-complete POST runs as a foreground `dataTask` from inside `urlSessionDidFinishEvents`
- [x] **UP-09**: System requests battery-optimization exemption at first upload and walks the user through OEM-specific steps for Xiaomi (MIUI), Oppo (ColorOS), Vivo (FunTouch), Samsung (OneUI), and stock Android **[research]**
- [x] **UP-10**: Uploads pause during active recording and resume on stop
- [x] **UP-11**: User cannot manually cancel an upload
- [x] **UP-12**: Per-file upload progress is visible from the Pending Uploads tile → upload-queue screen (MP4 filename / duration / thumbnail / state)
- [x] **UP-13**: Logout cancels in-flight upload but **preserves** the local queue; same-user re-login resumes uploads
- [x] **UP-14**: Local files are NEVER deleted before the backend posts the `verified` event for that segment
- [x] **UP-15**: On `verified` event, app deletes the local MP4 + CSV + JSON for that segment
- [x] **UP-16**: On `re-upload` event (hash mismatch), app re-uploads using the still-present local copy
- [x] **UP-17**: Cellular uploads are allowed by default at MVP (no Wi-Fi-only toggle)
- [x] **UP-18**: System sends `null` for `ip_address`; server populates from request headers
- [x] **UP-19**: System uses TCP_MAXSEG=1280 + 30-second no-progress abandon-and-retry-with-fresh-socket on cellular to defeat MTU-blackhole retry storms on Jio (CGNAT) and Vivo Brasil **[research]**

### History

- [ ] **HIST-01**: Every successfully recorded segment (≥60 s) appears in History regardless of upload state
- [ ] **HIST-02**: Default view groups by day, newest first, all videos
- [ ] **HIST-03**: User can filter History by today / yesterday / this week / this month / all time / custom range
- [ ] **HIST-04**: Empty state (no recordings) shows the "Your recordings will live here." copy + tap-to-tasks link
- [ ] **HIST-05**: Empty state with filter applied shows the "No recordings in this range." copy + reset-filter link
- [ ] **HIST-06**: Each row shows filename, duration in minutes, task name, recorded-at timestamp (`May 4, 2026 | 15:49`), upload-state chip (Uploaded at / In progress / Paused due to network / Failed-with-retry), and a static thumbnail auto-generated from the MP4 first frame
- [ ] **HIST-07**: Tap thumbnail opens the in-app fullscreen player (view-only — no download, no share, no export; play / pause / seek only). Plays from the local MP4 when present; otherwise streams via the server (see HIST-09). _(Reworded by Phase 6 Plan 06-03 per CONTEXT D-06 — streaming in MVP supersedes the original "while local exists" wording.)_
- [ ] **HIST-08**: Once the `verified` event clears the local MP4, the thumbnail remains and tap streams via the server. If the recording is in Deep Archive (>90 d), tap shows **"This recording has been archived. Contact support for retrieval."** _(Reworded by Phase 6 Plan 06-03 per CONTEXT D-06 — replaces the original "Local copy cleared" disabled message.)_
- [ ] **HIST-09**: Streaming uploaded recordings back from the server is **in MVP** for Phase 6, via a short-TTL CloudFront-signed GET (`GET /recordings/:id/stream-url`, 5-min TTL). Deep-Archive (>90 d) async-thaw flow is §v2 / Phase 8. _(Reworded by Phase 6 Plan 06-03 per CONTEXT D-06 — flips from "out of MVP" to "in MVP".)_
- [ ] **HIST-10**: User cannot delete recordings (locally or server-side)
- [ ] **HIST-11**: Each row reserves a Feedback button slot (disabled, "coming soon")

### Profile

- [x] **PROF-01**: Profile shows Google avatar (read-only), name (editable), age (editable, nullable), gender (editable, nullable), Joined date (non-editable)
- [x] **PROF-02**: Profile shows the Payments & Earnings card with the verbatim copy from `idea-brief.md` §5.11 + a "Coming soon" badge
- [x] **PROF-03**: Profile shows lifetime contribution numeric (44 px mono) + "Across N tasks" caption with the duration formatter from HOME-06
- [x] **PROF-04**: Profile has Help Center, Logout, and Delete account entries
- [x] **PROF-05**: Profile shows app version + build identifier in the footer for support diagnostics **[research]**

### Help Center

- [x] **HELP-01**: Help Center has 3 accordions, collapsed by default, in this order: **Instructions Guide**, **FAQs**, **Troubleshooting** (per `idea-brief.md` §5.12)
- [x] **HELP-02**: Help Center copy is sourced **verbatim** from `help-center-content.md` — that file is the canonical content source
- [x] **HELP-03**: Help Center has a Contact Support entry below the third accordion that opens the mail app with a pre-filled email to `[EMAIL_ADDRESS]` (final TBD)
- [x] **HELP-04**: Help Center entry is reached only from Profile (no hamburger menu, no other entry point)
- [x] **HELP-05**: Help Center has an in-app "Report a problem" form that submits to `POST /feedback` with category, message, and attached diagnostic snapshot (app version / build / OS / device model / last 100 telemetry events) **[research]**

### Forced Upgrade

- [ ] **UPG-01**: System performs a lightweight `GET /app/version` on app open
- [ ] **UPG-02**: Response shape is `{ "min_supported": "1.4.0", "latest": "1.6.2", "force_upgrade": false }`
- [x] **UPG-03**: Installed version `< min_supported` shows a non-dismissible block screen `Update to continue.` + Play Store deep-link
- [x] **UPG-04**: Installed version `< latest` and `force_upgrade = false` shows a dismissible soft banner on Home
- [ ] **UPG-05**: Version response is cached for 6 hours

### Backend API (Fastify + Postgres + S3)

- [x] **API-01**: `POST /auth/google` exchanges Google ID token + Play Integrity attestation token + build-flavor field for a Humyn session token
- [x] **API-02**: `GET /me` returns the current user record; `PATCH /me` updates editable fields (name, age, gender)
- [x] **API-03**: `DELETE /me` triggers 30-day soft delete; `POST /me/restore` restores within the window
- [x] **API-04**: `GET /tasks?category=&setting=` returns the 65 tasks (paginated); `GET /tasks/{id}` returns a single task by slug; backend is seeded from `design-system/task-icons/mapping.json`
- [x] **API-05**: `POST /task-requests` accepts a TaskRequest payload + optional sample video upload; `GET /task-requests` lists the user's requests (no client UI surfaces this list at MVP)
- [x] **API-06**: `POST /recordings` accepts metadata, mints multipart presigned PUT URLs, returns `{recording_id, uploadUrls[], expiresAt}`
- [x] **API-07**: `PATCH /recordings/{id}` updates upload status / progress with idempotency-key support
- [x] **API-08**: `GET /recordings?range=` returns the user's recordings (with filters)
- [x] **API-09**: `GET /recordings/{id}` returns a single recording with a CloudFront-signed playback URL (5-minute TTL) when the recording is `uploaded` and the local copy is deleted
- [x] **API-10**: `GET /contributions` returns `Contribution` aggregates; `GET /contributions/timeseries?bucket=day&range=` returns the time series for tile filters
- [x] **API-11**: `POST /events` accepts telemetry batches (Firebase Analytics passthrough or backend ingest)
- [x] **API-12**: `POST /feedback` accepts in-app feedback submissions with diagnostic snapshot **[research]**
- [x] **API-13**: `GET /app/version` returns `{min_supported, latest, force_upgrade}` with a 6-hour cache header
- [x] **API-14**: All errors follow RFC 7807 `application/problem+json` shape
- [x] **API-15**: All POST/PATCH endpoints support `Idempotency-Key` headers
- [x] **API-16**: `/tasks` semantic search is implemented as **Reciprocal Rank Fusion (k=60)** of pgvector cosine similarity (HNSW index on `embedding vector_cosine_ops`) and tsvector lexical match (GIN index on a generated `to_tsvector` column)
- [x] **API-17**: Backend enforces server-side rate limits per user and per IP on `POST /recordings`, `POST /events`, and `POST /feedback` to catch early farming **[research]**

### Backend Hash-Verify Worker

- [x] **VERIFY-01**: Worker subscribes to S3 multipart-complete events via EventBridge → SQS → BullMQ on Redis
- [x] **VERIFY-02**: Worker re-hashes both the MP4 and the IMU CSV from S3 and compares against the manifest hashes (`file_sha256`, `imu_sha256` from the metadata JSON)
- [x] **VERIFY-03**: On match, worker flips `recordings.qa_status = 'verified'` and emits a `verified` event for the client
- [x] **VERIFY-04**: On mismatch, worker flips `qa_status = 'hash-mismatch'` and emits a `re-upload` event for the client
- [x] **VERIFY-05**: Verified events are delivered piggy-backed on every API response (no FCM/APNs at MVP)
- [x] **VERIFY-06**: App-launch reconciliation sweep queries backend for the verified-but-undeleted set and deletes any local files the user no longer needs **[research]**
- [x] **VERIFY-07**: Worker scales on queue depth (BullMQ + ECS at MVP; switch to S3 EventBridge → Lambda is a v2 concern)

### Anti-fraud

- [x] **FRAUD-01**: Play Integrity Standard verification at sign-in only (per-upload attestation deferred to v2)
- [x] **FRAUD-02**: Backend rejects sign-in with rooted, emulator, and non-Play-Store-install verdicts (APK build flavor bypasses install-source check via Remote Config; Play Store flavor cannot opt into bypass)

> FRAUD-03 (server-side IMU-liveness check on the uploaded CSV) and FRAUD-04 (`liveness_score ∈ [0,1]` rollup) were briefly **promoted from v2-deferred to MVP backend scope (Phase 5), then descoped back 2026-05-11** → relocated to §v2 (Anti-fraud). FRAUD-05 (per-account daily upload-rate cap) and FRAUD-06 (pre-payout fraud dashboard) were **descoped to §v2 2026-05-12 — see CONTEXT.md D-04 (Phase 5)**. MVP anti-fraud is Play Integrity at sign-in (FRAUD-01/02) + the on-device one-shot hand gate. The uploaded IMU CSV is collected but not analysed server-side at MVP.

### Observability

- [ ] **OBS-01**: System reports native + JVM crash and ANR via Firebase Crashlytics
- [ ] **OBS-02**: System emits the full event funnel from `engineering-handoff.md` §11 (signup*\*, permission*\_, compat\__, recording*\*, gate*_, upload\__, history*\*, profile*_, help\_\_) via Firebase Analytics
- [ ] **OBS-03**: Backend emits structured CloudWatch logs; per-device-model + per-OS-version + per-locale cohorts surface in dashboards
- [ ] **OBS-04**: BullMQ dashboard (Bull-Board) exposes queue depth, retry counts, and DLQ for the hash-verify worker
- [ ] **OBS-05**: System **does NOT** ship Sentry, Datadog, or third-party RUM at MVP (per `idea-brief.md` §12)

### Distribution & Build Flavors

- [x] **DIST-01**: Three build flavors exist: `apkRollout` (signed APK distributed to clan chiefs), `playStore`, and `iosAppStore`
- [x] **DIST-02**: Different `applicationId` per Android flavor enables co-installation
- [x] **DIST-03**: Remote Config keys the install-source-check bypass by `applicationId`; `playStore` flavor cannot opt into bypass
- [x] **DIST-04**: Backend `/auth/google` validates that the supplied build-flavor field matches a known flavor and applies the matching install-source policy
- [x] **DIST-07**: Standalone compat-only APK (`compatRecon` flavor) ships to ~50 clan chiefs **before** APK rollout to harvest device-model coverage data; addressable-fleet go/no-go gate **[research]**

> DIST-05 (staged Play Store rollout) and DIST-06 (iOS App Store ship) **descoped from MVP 2026-05-11** → relocated to §v2 (Distribution / Rollout).

### iOS Parity

> **The iOS-parity workstream (IOS-01..07) was descoped from this MVP 2026-05-11** and relocated to §v2 (iOS Parity). The MVP ships Android-only via the signed APK. Phase 8 retains observability + APK-distribution hardening only.

### Multi-linguality (Phase 7)

> Inserted 2026-05-24 alongside the **Phase 7 — Multi-linguality & Live-Cam Feed** insertion (the original Phase 7 was renumbered to Phase 8 — content unchanged; see ROADMAP "Phase swap 2026-05-24" banner). All translations are LLM-generated only with an explicit native-speaker / casual-everyday-vernacular brief (see I18N-05).

- [ ] **I18N-01**: App supports 8 languages: English (default), Portuguese (pt-BR), Spanish (es), Hindi (hi-IN), Bengali (bn-IN), Tamil (ta-IN), Telugu (te-IN), Marathi (mr-IN)
- [ ] **I18N-02**: A new "Choose Language" screen renders between Splash and Sign-up on first launch only (detected via MMKV `locale.chosen_at` key). Default selection = English. After the user taps Continue, the choice persists in MMKV and the screen is never shown again unless the key is cleared (delete-account / fresh install resets it)
- [ ] **I18N-03**: The Choose Language screen is designed in-plan against the existing design tokens (Inter font, orange accent, RigTutorial-style rounded cards). Header + 8 language rows (native name + English name, e.g. "हिन्दी / Hindi") + Continue button. No external design hand-off required; the locked design files (`prototype.html`, `design-spec.md`, `engineering-handoff.md`) stay untouched — this is documented as the second design carve-out (the first being the owner deviations recorded in `CLAUDE.md`)
- [ ] **I18N-04**: Profile screen gets a new "Language" row above Help Center. Tapping opens a bottom-sheet picker with the same 8 options; selection takes effect immediately (next screen renders translated) and persists in MMKV
- [ ] **I18N-05**: All translations are **LLM-generated only** with an explicit system-prompt brief: _"Translate as a native speaker would say it in casual everyday conversation, NOT academically. Use vernacular vocabulary. Avoid loanwords from English where a common everyday native word exists."_ The translation catalog (one JSON per locale) lives at `apps/mobile/src/i18n/locales/{en,pt-BR,es,hi-IN,bn-IN,ta-IN,te-IN,mr-IN}.json` and is committed to the repo; the LLM prompt + generation script live at `tools/i18n/generate.ts`
- [ ] **I18N-06**: Recording audio cues use **device TTS, per locale**. `apps/mobile/src/lib/ttsVoice.ts` is extended: `Tts.setDefaultLanguage()` is called with the active locale's BCP-47 tag at session start; voice-selection prefers a female voice for that locale, then any voice for that locale, then falls back to the existing en-US female-leaning resolution. If no voice for the locale is available on the device, cues play in English (graceful degradation, logged via Crashlytics). The owner's existing en-US deviation (`CLAUDE.md` "Audio dropped 2026-05-11" + ttsVoice deviation) stays valid for the English locale
- [ ] **I18N-07**: Consent text (`idea-brief.md §5.2`) and Terms-of-Use modal copy render **bilingual** when a non-English locale is active: the LLM-translated text on top, the canonical English text below (smaller font, ~70% opacity). The server-side consent record continues to stamp the canonical English `consent_text_version` — English remains the legal record. `idea-brief.md §5.2` is NOT edited
- [ ] **I18N-08**: API error messages and `/feedback` server responses stay English server-side. The mobile client maps known error codes (`AUTH_INVALID_TOKEN`, `UPLOAD_QUOTA_EXCEEDED`, etc.) to translated toast strings via the same i18n catalog. The raw English `detail` field is logged to Crashlytics for triage. Unknown errors show a generic translated "Something went wrong" toast
- [ ] **I18N-09**: Dates throughout the app render via `Intl.DateTimeFormat` with the active locale (e.g. History day headers "13 May 2026" → "13 mai. 2026" / "13 मई 2026"). Numeric values (contribution duration, segment counts, drift telemetry surfaced in any debug screen) force the `latn` numbering system across all locales so digits stay 0–9. Hermes ships ICU; verify Intl support at runtime, fall back to English formatting if Intl returns undefined
- [ ] **I18N-10**: The 65 task names in the catalog: **UI displays translated names; backend `ts_vector` GIN search stays English-only**. A `taskCatalog.i18n.ts` mapping table on the client provides `{ canonical_en → { [locale]: localizedName } }`; any search query the user types in their language is reverse-mapped to canonical English terms via this table before hitting `/tasks/search`. The `tasks` table + `ts_vector` index are unchanged. No backend migration. (REQ rationale: minimal backend churn; the lexical search column stays the single source of truth.)
- [ ] **I18N-11**: Cosmetic gaps that were already closed in earlier phases are NOT re-opened by the translation rollout — translation is purely additive against the final approved Phase 6 copy
- [ ] **I18N-12**: First-launch language pick is collected anonymously (`installation_id` + chosen locale) and reported via the existing telemetry ring buffer, NOT via a new server endpoint. Locale change events in Profile also flow through the same ring. (Mirrors how compat outcomes are reported.)

### Recording — Live-Cam Preview (Phase 7)

> Inserted 2026-05-24 alongside the Phase 7 multi-linguality work. The live-cam feed is a UX feature; the recorded `imu_video_drift_{max,mean,p99}_ms` telemetry and the fps/resolution/insufficient_frames capture-quality cancel gates are non-negotiable and unchanged (see `CLAUDE.md` drift banner 2026-05-12 + capture-quality cancel-gate banner 2026-05-17).

- [ ] **REC-LIVE-01**: When recording starts (hand gate passed OR user taps Skip), the live ultrawide camera feed renders full-screen for **15 s** with a faint corner indicator showing "Live preview · auto-hides in {N}s" in the active locale. After 15 s the screen fades to the existing recording state (5% brightness, black, task name centered, Stop button visible)
- [ ] **REC-LIVE-02**: While in the dimmed state, a small dim eye-icon glyph in the bottom-right corner signals the tap affordance. A **single tap anywhere on the recording surface** brings the live cam feed back for **10 s**. Subsequent taps during the 10 s window **reset the timer back to 10 s** (rolling timer, not accumulating). At the 10 s mark with no further taps, fade back to dimmed state
- [ ] **REC-LIVE-03**: During both preview windows (initial 15 s + tap 10 s), screen brightness jumps to the user's system brightness so the preview is actually viewable; on fade-back to the dimmed state, brightness returns to 5%. Brightness transitions use the existing brightness-control wrapper that already drives the 5% dim mode
- [ ] **REC-LIVE-04**: Live-cam feed applies to BOTH the practice recording flow (Phase 4 onboarding tutorial) AND every real recording — same component, same timing, for behavioral consistency
- [ ] **REC-LIVE-05**: The recorded `imu_video_drift_{max,mean,p99}_ms` telemetry continues to be measured + stamped into each segment's metadata JSON unchanged. The relaxed-but-recorded drift gate from `CLAUDE.md` (2026-05-12) is unchanged — live preview is NOT allowed to break the drift measurement. If on-hardware smoke shows the preview surface regresses drift beyond the current ~1.7–6.2 ms ultrawide baseline by more than 50%, the implementation must be revised (preview is a UX feature; capture quality is non-negotiable)
- [ ] **REC-LIVE-06**: The implementation approach for the preview Surface (share encoder Surface vs. dedicated preview target vs. add/remove mid-record) is **chosen during `/gsd-plan-phase` research**, with drift impact as the gating constraint. The planner should produce a comparison in PLAN.md with on-hardware drift measurements as the decision gate. The Stop button remains hit-testable in all three states (initial 15 s preview, dimmed, tap-revealed 10 s preview)
- [ ] **REC-LIVE-07**: Capture-quality cancel gates (`CLAUDE.md` "Capture-quality cancel gate added 2026-05-17") are unchanged. `fps_dropped` / `resolution_dropped` / `insufficient_frames` cancels still fire post-encode regardless of whether the preview was visible

### Foundation / Legal

- [x] **LEGAL-01**: Indian DPDP + Brazilian LGPD counsel review completes **before Play Store launch**
- [x] **LEGAL-02**: Consent text in `idea-brief.md` §5.2 is the canonical version; consent timestamps logged server-side with version
- [x] **LEGAL-03**: ANPD (Brazil) and DPB (India) takedown response procedure is documented operationally
- [x] **LEGAL-04**: Data-subject-rights API surface is defined (export, delete) — implementation may be operational at MVP
- [x] **LEGAL-05**: S3 bucket has a lifecycle policy from day 0 (Glacier IR at +7 days, Deep Archive at +90 days) **[research]** — _Plan 01-03: lifecycle defined as code in `infra/localstack/init/01-create-buckets.sh` and applied to `humyn-recordings-dev` (verified runtime: GLACIER_IR @ +7d, DEEP_ARCHIVE @ +90d, AbortIncompleteMultipartUpload @ +1d). Plan 01-10 Terraform will mirror this byte-identical JSON for prod._

## v2 Requirements

Deferred to a future release. Tracked but not in current roadmap.

### Async QA / Feedback

- **QA-01**: Per-recording QA-status chip on History rows
- **QA-02**: Async QA pipeline result surfaces to user (the History "Feedback (coming soon)" slot becomes live)
- **QA-03**: Quality-feedback dispute / re-upload flow

### Payments / Payouts

- **PAY-01**: Earnings ledger (read-only) shown on Profile
- **PAY-02**: In-app payouts UI
- **PAY-03**: Cash-out flow

### Anti-fraud

- **FRAUD-03**: Backend implements a server-side IMU-liveness fraud check on the uploaded IMU CSV (stillness gate, gravity-axis check, saccade density, optional walking-segment FFT, vision–motion correlation) per `imu-liveness-check.md` §4. _Briefly promoted to MVP backend scope (Phase 5), descoped back to v2 2026-05-11 — MVP collects the IMU CSV but does not analyse it server-side._
- **FRAUD-04**: Backend produces a `liveness_score ∈ [0, 1]` per segment with the weighted formula in `imu-liveness-check.md` §5; thresholds are tunable. _Descoped with FRAUD-03 2026-05-11._
- **FRAUD-05**: Per-account daily upload-rate cap enforced server-side as a coarse fraud heuristic. _Descoped to §v2 2026-05-12 — see CONTEXT.md D-04 (Phase 5). MVP upload path is fully uncapped per account (D-04a)._
- **FRAUD-06**: Pre-payout fraud monitoring dashboard tracks hash-mismatch rate, account-fingerprint clustering, and OEM/region anomalies (the liveness*score panel lands with FRAUD-03/04). \_Descoped to §v2 2026-05-12 — see CONTEXT.md D-04 (Phase 5). Bull-Board for the worker queue is a separate Phase-8 observability item (OBS-04), unaffected.*
- **FRAUD-V2-01**: Per-upload Play Integrity attestation
- **FRAUD-V2-02**: Server-side perceptual-hash duplicate detection
- **FRAUD-V2-03**: Device-fingerprint binding (one account ↔ one device)
- **FRAUD-V2-04**: Liveness gestures (randomized in-frame action per recording)

### Notifications

- **NOTF-01**: Scheduled local reminders
- **NOTF-02**: Event-driven notifications (upload success / QA result / payment landed)
- **NOTF-03**: `POST_NOTIFICATIONS` runtime prompt
- **NOTF-04**: Configurable notification preferences

### Retention

- **RETN-01**: Daily / weekly streaks
- **RETN-02**: Clan-chief structure visibility
- **RETN-03**: Clan leaderboards
- **RETN-04**: Milestone celebrations
- **RETN-05**: Daily quests / weekly themes
- **RETN-06**: In-app referrals

### Localization

- **LOC-01**: Hindi
- **LOC-02**: Portuguese (Brazil)
- **LOC-03**: Spanish (LATAM, future)
- **LOC-04**: Tamil / Telugu / Bengali / Marathi (future)

### Network / Data

- **DATA-01**: Wi-Fi-only upload toggle
- **DATA-02**: Per-month data ceiling and breakdown
- **DATA-03**: Cellular data-saver auto-detect

### Capture / Recording

- **REC-V2-01**: Continuous on-device hands-in-frame enforcement (cue loop + auto-stop on absence)
- **REC-V2-02**: Real-time framing guides (rule-of-thirds / horizon level / motion-too-fast)
- **REC-V2-03**: Mobile dark mode for non-recording surfaces

### Architecture / Scale

- **ARCH-V2-01**: Hash-verify worker migrates from BullMQ + ECS to S3 EventBridge → Lambda at 1M-hour scale
- **ARCH-V2-02**: Web / desktop / tablet review-only client (Player only)

### Search

- **SEARCH-V2-01**: Semantic + lexical RRF (k=60) hybrid task search — pgvector HNSW over task name + description embeddings fused with `ts_vector` lexical results. _Backend pipeline shipped in Phase 1 (seeded from `mapping.json`); descoped from the MVP client search surface 2026-05-11 — MVP uses the `ts_vector` lexical path only (TASK-03)._

### Distribution / Rollout (descoped from MVP 2026-05-11)

- **DIST-05**: Play Store rollout is staged: 1% → 5% → 25% → 100% with k6 load-test gate at each stage
- **DIST-06**: iOS App Store ships ≤2 weeks after Play Store rollout (within the same milestone)

### iOS Parity (descoped from MVP 2026-05-11)

- **IOS-01**: iOS analogue for `HumynCapture` (AVCaptureSession + AVAssetWriter + CMMotionManager — AVAudioRecorder dropped per the 2026-05-11 audio-drop decision) honors the same locked spec values
- **IOS-02**: iOS analogue for `HumynHandDetector` (MediaPipe iOS Tasks Vision pod 0.10.21) wraps the same `hand_landmarker.task` bundle
- **IOS-03**: iOS analogue for `HumynUpload` uses URLSession background config with the documented post-completion handoff pattern
- **IOS-04**: iOS analogue for `HumynIntegrity` uses DeviceCheck / App Attest at sign-in
- **IOS-05**: iOS deployment target is 15.1 (forced by ultrawide-camera availability and CMMotionManager max-rate guarantees)
- **IOS-06**: iOS uses `AVVideoAllowFrameReorderingKey: false` to disable B-frames; sets the same HEVC profile / bitrate / GOP
- **IOS-07**: iOS TTS uses `AVSpeechSynthesisVoice(language: "en-IN")` filtered to female with the documented fallback chain

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                                        | Reason                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SSO with KGeN                                                  | SSO integration is its own coordination cost; Google works for both target geos                   |
| Multi-account on a single device                               | Complicates session management with no clear MVP value                                            |
| Manual upload cancel                                           | Prevents users from losing data they thought they'd kept                                          |
| User-side recording deletion (local or server)                 | Integrity of the dataset; deletion creates payout-dispute and dataset-management complexity       |
| Streaming uploaded recordings back after local copy is cleared | Signed-URL playback adds backend surface for no clear MVP user value                              |
| Programmatic Do Not Disturb during recording                   | Requires `ACCESS_NOTIFICATION_POLICY` and Settings deep-link; not justified                       |
| Additional client-side file encryption beyond Android FBE      | Marginal security gain doesn't justify the I/O cost; rejected, not deferred                       |
| MVP success metrics                                            | Explicit user choice — ship and learn                                                             |
| Mobile dark mode (non-recording surfaces)                      | Not enough usage data to design well; tokens are future-proofed                                   |
| Web / PWA / desktop / tablet builds                            | Capture flow needs platform sensors web can't reliably hit                                        |
| Editable Google profile fields beyond name / age / gender      | Avatar editing wasn't in spec and would add an upload surface                                     |
| Bystander-consent in-app secondary-subject screen              | Deferred per `strategic-suggestions.md` §4; uploader-attest model retained pending counsel review |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement   | Phase            | Status                |
| ------------- | ---------------- | --------------------- |
| AUTH-01       | Phase 2          | Pending               |
| AUTH-02       | Phase 2          | Pending               |
| AUTH-03       | Phase 2          | Pending               |
| AUTH-04       | Phase 2          | Pending               |
| AUTH-05       | Phase 2          | Pending               |
| AUTH-06       | Phase 1          | Complete              |
| AUTH-07       | Phase 2          | Pending               |
| AUTH-08       | Phase 2          | Complete (Plan 02-19) |
| AUTH-09       | Phase 2          | Complete (Plan 02-19) |
| AUTH-10       | Phase 2          | Complete (Plan 02-19) |
| AUTH-11       | Phase 2          | Pending               |
| PERM-01       | Phase 2          | Pending               |
| PERM-02       | Phase 2          | Pending               |
| PERM-03       | Phase 2          | Pending               |
| PERM-04       | Phase 2          | Complete (Plan 02-22) |
| COMPAT-01     | Phase 2          | Pending               |
| COMPAT-02     | Phase 2          | Pending               |
| COMPAT-03     | Phase 2          | Pending               |
| COMPAT-04     | Phase 2          | Pending               |
| COMPAT-05     | Phase 2          | Pending               |
| COMPAT-06     | Phase 2          | Pending               |
| COMPAT-07     | Phase 2          | Pending               |
| COMPAT-08     | Phase 2          | Pending               |
| ONB-01        | Phase 2          | Pending               |
| ONB-02        | Phase 2          | Pending               |
| ONB-03        | Phase 4          | Complete              |
| ONB-04        | Phase 4          | Complete              |
| ONB-05        | Phase 4          | Done (04-08)          |
| ONB-06        | Phase 4          | Done (04-08)          |
| ONB-07        | Phase 4          | Complete              |
| ONB-08        | Phase 4          | Done (plan 04-03)     |
| HOME-01       | Phase 6          | Pending               |
| HOME-02       | Phase 6          | Pending               |
| HOME-03       | Phase 6          | Pending               |
| HOME-04       | Phase 6          | Pending               |
| HOME-05       | Phase 6          | Pending               |
| HOME-06       | Phase 6          | Pending               |
| HOME-07       | Phase 2          | Complete              |
| HOME-08       | Phase 2          | Complete              |
| HOME-09       | Phase 6          | Pending               |
| HOME-10       | Phase 6          | Pending               |
| TASK-01       | Phase 6          | Pending               |
| TASK-02       | Phase 6          | Pending               |
| TASK-03       | Phase 6          | Pending               |
| TASK-04       | Phase 6          | Pending               |
| TASK-05       | Phase 6          | Pending               |
| TASK-06       | Phase 6          | Pending               |
| TASK-07       | Phase 6          | Pending               |
| TASK-08       | Phase 6          | Pending               |
| TASK-09       | Phase 6          | Pending               |
| TASK-10       | Phase 6          | Pending               |
| CAP-01        | Phase 3          | Complete              |
| CAP-02        | Phase 3          | Complete              |
| CAP-03        | Phase 3          | Complete              |
| CAP-04        | Phase 3          | Complete              |
| CAP-05        | Phase 3          | Complete              |
| CAP-06        | Phase 3          | Complete              |
| CAP-07        | Phase 3          | Complete              |
| CAP-08        | Phase 3          | Complete              |
| CAP-09        | Phase 3          | Complete              |
| CAP-10        | Phase 3          | Complete              |
| CAP-11        | Phase 3          | Complete              |
| CAP-12        | Phase 3          | Complete              |
| CAP-13        | Phase 3          | Complete              |
| CAP-14        | Phase 3          | Complete              |
| CAP-15        | Phase 3          | Complete              |
| CAP-16        | Phase 3          | Complete              |
| CAP-17        | Phase 3          | Complete              |
| CAP-18        | Phase 3          | Complete              |
| CAP-19        | Phase 3          | Complete              |
| CAPTURE-QA-01 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-02 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-03 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-04 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-05 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-06 | Quick 260517-p5g | Complete              |
| CAPTURE-QA-07 | Quick 260522-elm | Complete              |
| CAPTURE-QA-08 | Quick 260522-elm | Complete              |
| CAPTURE-QA-09 | Quick 260522-elm | Complete              |
| HAND-01       | Phase 4          | Complete              |
| HAND-02       | Phase 4          | Done (04-07)          |
| HAND-03       | Phase 4          | Complete              |
| HAND-04       | Phase 4          | Done (04-07)          |
| HAND-05       | Phase 4          | Done (04-07)          |
| HAND-06       | Phase 4          | Done (04-07)          |
| HAND-07       | Phase 4          | Complete              |
| HAND-08       | Phase 4          | Complete              |
| HAND-09       | Phase 4          | Complete              |
| HAND-10       | Phase 4          | Done (04-07)          |
| HAND-11       | Phase 4          | Complete              |
| HAND-12       | Phase 4          | Complete              |
| HAND-13       | Phase 4          | Complete              |
| HAND-14       | Phase 4          | Complete              |
| REC-01        | Phase 4          | Done (04-07)          |
| REC-02        | Phase 4          | Done (04-07)          |
| REC-03        | Phase 4          | Done (04-07)          |
| REC-04        | Phase 4          | Done (04-08)          |
| REC-05        | Phase 4          | Done (04-07)          |
| REC-06        | Phase 4          | Done (04-07)          |
| REC-07        | Phase 4          | Done (04-08)          |
| REC-08        | Phase 4          | Complete              |
| REC-09        | Phase 4          | Done (04-08)          |
| REC-10        | Phase 4          | Complete              |
| REC-11        | Phase 4          | Complete              |
| REC-12        | Phase 4          | Complete              |
| REC-13        | Phase 4          | Complete              |
| REC-14        | Phase 4          | Done (04-08)          |
| REC-15        | Phase 4          | Done (04-07)          |
| REC-16        | Phase 4          | Done (04-08)          |
| UP-01         | Phase 5          | Complete              |
| UP-02         | Phase 5          | Complete              |
| UP-03         | Phase 5          | Complete              |
| UP-04         | Phase 5          | Complete              |
| UP-05         | Phase 5          | Complete              |
| UP-06         | Phase 5          | Complete              |
| UP-07         | Phase 5          | Complete              |
| UP-08         | Phase 5          | Complete              |
| UP-09         | Phase 5          | Complete              |
| UP-10         | Phase 5          | Complete              |
| UP-11         | Phase 5          | Complete              |
| UP-12         | Phase 5          | Complete              |
| UP-13         | Phase 5          | Complete              |
| UP-14         | Phase 5          | Complete              |
| UP-15         | Phase 5          | Complete              |
| UP-16         | Phase 5          | Complete              |
| UP-17         | Phase 5          | Complete              |
| UP-18         | Phase 5          | Complete              |
| UP-19         | Phase 5          | Complete              |
| HIST-01       | Phase 6          | Pending               |
| HIST-02       | Phase 6          | Pending               |
| HIST-03       | Phase 6          | Pending               |
| HIST-04       | Phase 6          | Pending               |
| HIST-05       | Phase 6          | Pending               |
| HIST-06       | Phase 6          | Pending               |
| HIST-07       | Phase 6          | Pending               |
| HIST-08       | Phase 6          | Pending               |
| HIST-09       | Phase 6          | Pending               |
| HIST-10       | Phase 6          | Pending               |
| HIST-11       | Phase 6          | Pending               |
| PROF-01       | Phase 2          | Plan 02-17 (complete) |
| PROF-02       | Phase 2          | Plan 02-17 (complete) |
| PROF-03       | Phase 2          | Plan 02-17 (complete) |
| PROF-04       | Phase 2          | Plan 02-17 (complete) |
| PROF-05       | Phase 2          | Plan 02-17 (complete) |
| HELP-01       | Phase 2          | Complete (Plan 02-18) |
| HELP-02       | Phase 2          | Complete (Plan 02-18) |
| HELP-03       | Phase 2          | Complete (Plan 02-18) |
| HELP-04       | Phase 2          | Complete (Plan 02-18) |
| HELP-05       | Phase 2          | Complete (Plan 02-18) |
| UPG-01        | Phase 2          | Pending               |
| UPG-02        | Phase 2          | Pending               |
| UPG-03        | Phase 2          | Complete (Plan 02-20) |
| UPG-04        | Phase 2          | Complete (Plan 02-20) |
| UPG-05        | Phase 2          | Pending               |
| API-01        | Phase 1          | Complete              |
| API-02        | Phase 1          | Complete              |
| API-03        | Phase 1          | Complete              |
| API-04        | Phase 1          | Complete              |
| API-05        | Phase 1          | Complete              |
| API-06        | Phase 1          | Complete              |
| API-07        | Phase 1          | Complete              |
| API-08        | Phase 1          | Complete              |
| API-09        | Phase 1          | Complete              |
| API-10        | Phase 1          | Complete              |
| API-11        | Phase 1          | Complete              |
| API-12        | Phase 1          | Complete              |
| API-13        | Phase 1          | Complete              |
| API-14        | Phase 1          | Complete              |
| API-15        | Phase 1          | Complete              |
| API-16        | Phase 1          | Complete              |
| API-17        | Phase 1          | Complete              |
| VERIFY-01     | Phase 5          | Complete              |
| VERIFY-02     | Phase 5          | Complete              |
| VERIFY-03     | Phase 5          | Complete              |
| VERIFY-04     | Phase 5          | Complete              |
| VERIFY-05     | Phase 5          | Complete              |
| VERIFY-06     | Phase 5          | Complete              |
| VERIFY-07     | Phase 5          | Complete              |
| FRAUD-01      | Phase 1          | Complete              |
| FRAUD-02      | Phase 1          | Complete              |
| FRAUD-03      | v2               | Deferred 2026-05-11   |
| FRAUD-04      | v2               | Deferred 2026-05-11   |
| FRAUD-05      | §v2              | Deferred (2026-05-12) |
| FRAUD-06      | §v2              | Deferred (2026-05-12) |
| I18N-01       | Phase 7          | Pending               |
| I18N-02       | Phase 7          | Pending               |
| I18N-03       | Phase 7          | Pending               |
| I18N-04       | Phase 7          | Pending               |
| I18N-05       | Phase 7          | Pending               |
| I18N-06       | Phase 7          | Pending               |
| I18N-07       | Phase 7          | Pending               |
| I18N-08       | Phase 7          | Pending               |
| I18N-09       | Phase 7          | Pending               |
| I18N-10       | Phase 7          | Pending               |
| I18N-11       | Phase 7          | Pending               |
| I18N-12       | Phase 7          | Pending               |
| REC-LIVE-01   | Phase 7          | Pending               |
| REC-LIVE-02   | Phase 7          | Pending               |
| REC-LIVE-03   | Phase 7          | Pending               |
| REC-LIVE-04   | Phase 7          | Pending               |
| REC-LIVE-05   | Phase 7          | Pending               |
| REC-LIVE-06   | Phase 7          | Pending               |
| REC-LIVE-07   | Phase 7          | Pending               |
| OBS-01        | Phase 8          | Pending               |
| OBS-02        | Phase 8          | Pending               |
| OBS-03        | Phase 8          | Pending               |
| OBS-04        | Phase 8          | Pending               |
| OBS-05        | Phase 8          | Pending               |
| DIST-01       | Phase 1          | Complete              |
| DIST-02       | Phase 1          | Complete              |
| DIST-03       | Phase 1          | Complete              |
| DIST-04       | Phase 1          | Complete              |
| DIST-05       | v2               | Deferred 2026-05-11   |
| DIST-06       | v2               | Deferred 2026-05-11   |
| DIST-07       | Phase 1          | Complete              |
| IOS-01        | v2               | Deferred 2026-05-11   |
| IOS-02        | v2               | Deferred 2026-05-11   |
| IOS-03        | v2               | Deferred 2026-05-11   |
| IOS-04        | v2               | Deferred 2026-05-11   |
| IOS-05        | v2               | Deferred 2026-05-11   |
| IOS-06        | v2               | Deferred 2026-05-11   |
| IOS-07        | v2               | Deferred 2026-05-11   |
| LEGAL-01      | Phase 1          | Complete              |
| LEGAL-02      | Phase 1          | Complete              |
| LEGAL-03      | Phase 1          | Complete              |
| LEGAL-04      | Phase 1          | Complete              |
| LEGAL-05      | Phase 1          | Complete (Plan 01-03) |

**Coverage:**

- v1 requirements: 218
- Mapped to phases: 218
- Unmapped: 0

**Per-phase counts:**

- Phase 1 (Foundation, Backend & Distribution Recon): 30 requirements
- Phase 2 (Mobile Shell, Onboarding, Permissions, Compat & Profile): 41 requirements
- Phase 3 (HumynCapture Native Module): 19 requirements
- Phase 4 (HandDetector, Recording UX & Practice Tutorial): 36 requirements
- Phase 5 (Upload Pipeline, Hash-Verify Worker & Anti-fraud): 30 requirements
- Phase 6 (Tasks, History, Home Tiles & Hybrid Search): 29 requirements
- Phase 7 (Multi-linguality & Live-Cam Feed): 19 requirements
- Phase 8 (Observability & APK Distribution Hardening): 5 requirements
- **Total mapped:** 218 / 218 (100% coverage)

---

_Requirements defined: 2026-05-07_
_Last updated: 2026-05-24 — inserted new Phase 7 (Multi-linguality & Live-Cam Feed) with I18N-01..12 + REC-LIVE-01..07 (19 reqs); renumbered the original Phase 7 (Observability & APK Distribution Hardening) → Phase 8 with OBS-01..05 unchanged. Earlier 2026-05-11 — descoped the server-side IMU-liveness fraud check (FRAUD-03, FRAUD-04) from the Phase 5 MVP backend back to §v2 (Anti-fraud); reworded FRAUD-06 so its `liveness_score` panel rides with the deferred FRAUD-03/04 (quick task 260511-kfs). Earlier 2026-05-11 — descoped DIST-05, DIST-06, IOS-01..07 (9 reqs) to §v2; reworded TASK-03 to lexical-only and added SEARCH-V2-01 for the descoped semantic/RRF layer; Phase 7 narrowed to observability + APK-distribution hardening (later renumbered to Phase 8 — 2026-05-24). Original: 2026-05-07 — Traceability written by roadmapper (7 phases, 199 requirements, 100% coverage)._
