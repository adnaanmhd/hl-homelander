# Humyn Labs — Egocentric Data Collection App (MVP)

> **Brand line:** _Real Humyns. Real Intelligence._

> **2026-05-11 spec amendment — Audio dropped.** Sections §2.1, §6.3, §6.7, and §10.x originally specified a 48 kHz mono AAC-LC 128 kbps audio track muxed into every segment MP4. Phase 3 smoke walks on Pixel 10a measured audio-pump CPU contention inflating `imu_video_drift_{mean,p99}_ms` from ~1.8/2.1 ms to ~5.5/5.8 ms — outside the locked ±1 ms target. Project owner decision: drop audio entirely; preserve the ±1 ms timestamp-alignment invariant (video ↔ IMU). Training pipeline (VLA/VLN/robotics) uses video + IMU only. Post-unwire smoke 7 figures: drift mean **0.594 ms** / p99 **0.728 ms** ✓ inside spec. References to "audio", "AAC", "AudioRecord", `RECORD_AUDIO`, and the 48 kHz / 128 kbps numbers below are HISTORICAL — preserved for the future-re-enable path (Section §6.3 calls out what would have to be rebuilt). Re-introducing audio requires proving on real hardware that drift stays inside ±1 ms. Full trail: `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3 + commits `a1ab0ea` and `1a3e039`.

---

## 1. Objective

Humyn Labs is building an Android app to collect **egocentric** (first-person, head-mounted) video and IMU data of humans performing everyday tasks, at a target scale of **1 million hours**. The data trains Physical / Embodied AI — VLA / VLN models, autonomous humanoid robots, etc. _(Audio was in the original MVP spec but was dropped 2026-05-11 — see banner above.)_

Scale only happens via crowdsourcing. The app lets users record and upload data with minimal friction, enforces strict capture quality on the device, and pays them (offline at MVP) for QA-passing footage.

---

## 2. Capture Requirements

### 2.1 Strict (must hit)

| Requirement                    | Value                                                                       |
| ------------------------------ | --------------------------------------------------------------------------- |
| Resolution                     | 1920 × 1080 (1080p)                                                         |
| Frame rate                     | 30 FPS                                                                      |
| Orientation                    | Landscape                                                                   |
| Camera dFOV                    | ≥ 110° (ultrawide lens only)                                                |
| IMU                            | Gyro + Accel, both present                                                  |
| IMU sustained sample rate      | ≥ 100 Hz, captured at the device's **maximum** supported rate               |
| IMU clock                      | `SystemClock.elapsedRealtimeNanos()` (Android) / `mach_absolute_time` (iOS) |
| Camera frame timestamp source  | `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`                                   |
| Video↔IMU timestamp alignment | ±1 ms (clock-aligned; downstream interpolation gets sample-time alignment)  |
| ~~Audio~~                      | ~~Present, 48 kHz, mono~~ — **DROPPED 2026-05-11** (see banner)             |
| ~~Audio codec~~                | ~~AAC-LC, 128 kbps~~ — **DROPPED 2026-05-11** (see banner)                  |
| Video codec                    | HEVC (Main profile)                                                         |
| Bitrate                        | 8 Mbps, CBR                                                                 |
| GOP                            | 30                                                                          |
| B-frames                       | None                                                                        |
| Color depth                    | 8-bit                                                                       |
| HDR                            | Off                                                                         |
| Image stabilization            | Off                                                                         |

### 2.2 Preferences (good to have)

- Low encoder latency (`KEY_LATENCY = 1` on Android)
- Faststart muxing (movie-header-at-front, fragmented MP4)
- IMU sample rate as high as the device offers (typically 200–500 Hz on qualifying phones)

---

## 3. Users

### 3.1 Network

We acquire users through the **clan-chief network** of our sister company KGeN — clan chiefs invite their clans, and clans contribute. At MVP, clan chiefs are regular users with no special role; the hierarchy is invisible in-app.

### 3.2 Primary

College students and working professionals, **18–35**, semi-tech-savvy, predominantly **India & Brazil** at MVP (later: global). Motivated by earnings and K-Quests participation. They own ₹30K+ phones — the device class needed to hit our capture spec.

### 3.3 Secondary

Househelp, friends, and family of the primary users. They may not own ₹30K+ phones, so primary users hand them a qualifying phone to record.

### 3.4 Phone mounting

Phone is mounted on a **head rig** (provided externally). All footage is therefore _egocentric_head_.

---

## 4. Out of Scope for MVP

- **SSO with KGeN** — Google sign-in only at MVP.
- **Async QA pipeline + user feedback UI** — QA tool exists but its result does not surface to the user yet.
- **In-app payments** — payouts run offline; in-app data feeds the ledger.
- **All items in `strategic-suggestions.md`** — metrics, anti-fraud beyond Play Integrity sign-in, retention loops, clan visibility, referrals, localization, etc.
- **All items in `deferred-decisions.md`** — per-upload attestation, perceptual-hash dedup, liveness gestures, Wi-Fi-only toggle, etc. (Hands-in-frame detection has moved **into MVP** as a one-shot pre-record gate; see §5.8. The `deferred-decisions.md` entry is superseded by this brief and should be retired in the next pass.)
- **All notifications** — no scheduled local reminders, no event-driven notifications (upload success/failure, QA result, payment), no `POST_NOTIFICATIONS` runtime prompt. All notification surfaces are deferred.

---

## 5. User Journey (MVP)

### 5.1 Splash

- 2-second, non-skippable animation: Humyn Labs logo + tagline _Real Humyns. Real Intelligence._
- Plays on **cold open only** (fresh launch / launch after force-kill). Warm resume from background lands directly on the user's last screen.
- After the animation, first-time users go to sign-up; returning users go to home.

### 5.2 Sign Up

1. **Sign-up screen** — Humyn Labs logo + tagline. Primary CTA: _"Continue with Google"_. Below the button: consent checkbox **pre-checked**, label _"I have read and agree to the Terms of Use"_. Terms link opens a popup containing:
   > _"I consent and agree to upload videos of myself and/or others who consent to be recorded; performing certain daily activities/tasks. This content will be used to develop / train AI models and for research purposes. I confirm that I am 18 years or older and have the necessary permissions to share this content. I confirm that no one being recorded is a minor. I consent to my approximate location and IP address being captured alongside each recording. I understand that my data will be stored securely and used in accordance with Humyn's Privacy Policy."_
2. User taps **Continue with Google** → standard Google sign-in flow.
3. On success: fetch `name`, `email`, `birthday`/`age`, `gender` from Google. The last two scopes are restricted and frequently empty — those fields are **nullable**; the user can complete them later from the Profile screen.
4. **Play Integrity** verification runs at sign-in (lightweight; rejects rooted devices and non-Play-Store builds).
5. On Google auth failure, Play Integrity failure, or unchecked consent → user cannot proceed.
6. On success → permissions → device compatibility check → home. **No intermediate "confirm your details" screen.**

### 5.3 Permissions

Requested at first launch as the user enters each feature (Android 11+ does not support batched one-shot permissions). Order of prompts:

| Permission                                    | When prompted                           | Manifest                                    |
| --------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| Camera                                        | Before compatibility check              | `android.permission.CAMERA`                 |
| Microphone (kept — see note¹)                 | Before compatibility check              | `android.permission.RECORD_AUDIO`           |
| Sensors (gyro/accel)                          | Declared only; no runtime prompt needed | manifest-only                               |
| Location (coarse)                             | Before first recording                  | `android.permission.ACCESS_COARSE_LOCATION` |
| Foreground service (camera + mic + data sync) | Manifest-only on Android 14+            | `FOREGROUND_SERVICE_*`                      |
| Wake lock                                     | Manifest-only                           | `WAKE_LOCK`                                 |
| Network state                                 | Manifest-only                           | `ACCESS_NETWORK_STATE`                      |

> **Note ¹** — `RECORD_AUDIO` permission is still requested even though audio capture is disabled (per 2026-05-11 banner). Two reasons: (a) the foreground service type bitmask retains the `microphone` bit (Android FGS validation requires `RECORD_AUDIO` whenever that bit is declared in the manifest, regardless of whether AudioRecord is ever started), and (b) a future re-enable doesn't need a permission-prompt schema migration. Mic permission is granted but never used.

### 5.4 Device Compatibility Check (one-time per device, also on app update / OS update)

Runs silently after permissions are granted — nothing downloaded, no user action required. Checks:

- Resolution 1080p available
- ≥ 30 FPS at 1080p
- Ultrawide rear camera with dFOV ≥ 110°
- Gyro + Accel sensors present
- IMU **sustained ≥ 100 Hz over a 30-second window** while a 1080p camera preview runs in the background (catches devices that throttle under load — a brief idle sample is not enough)
- ~~Working microphone with 48 kHz sample-rate capability~~ — historical; audio dropped 2026-05-11 (see banner). Mic probe is retained in the compat check as **informational only** so a future re-enable has device-class signal already collected.
- `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`
- Device is not rooted (Play Integrity verdict)
- Storage warning: if free space < 5 GB, show non-blocking warning _"Free up space to avoid recording loss."_

**On fail:** show which checks failed; user cannot proceed beyond this screen.

**On bar tightening:** when we raise the compat bar in a future release, devices that previously passed but now fail are blocked from recording (existing recordings remain accessible for upload).

**On new device, same Google account:** re-runs the full check.

### 5.5 Onboarding Tutorial (one-time, after compatibility check)

After a successful compatibility check on a fresh install, the user is taken through a short onboarding flow. Each screen is a **standalone full-page takeover** — no carousel pagination, no skip button.

**5.5.1 Rig screen**

- Title: _"You'll need a head rig"_
- Body: _"Mount your phone on the head rig and make sure it is steady while recording."_
- Visual: simple line-art illustration of a phone on a head rig (placeholder; final illustration TBD).
- CTA: **Next** → practice intro screen.

**5.5.2 Practice intro**

- Title: _"One quick try"_
- Body: _"We'll walk you through one short recording — 60 seconds, just to get the feel."_
- Footer caption: _"This is a practice task — it does not count towards your contribution."_
- CTA: **Start practice** → enters the recording flow with `practice = true`.

**5.5.3 Practice recording**

Uses the standard recording flow (see §5.8) with these overrides:

- Task name shown as _"Practice — 60 sec"_.
- **Hard cap at 60 seconds** — auto-stops at :60.
- All multimodal alerts (battery, storage, thermal) remain active so the user experiences them.
- Captured locally for the user's flow but **never uploaded**, **never appears in History**, **never counts toward contribution**. The `practice = true` flag propagates to capture pipeline, metadata JSON, and upload-queue exclusion.

**5.5.4 Practice complete**

- Full-screen takeover after the practice recording stops.
- Title: _"From here on, every recording counts"_
- Visual: success badge with a brief celebration animation (light haptic + confetti-light particle burst on entry).
- CTA: **Next** → home (first-time state).

The tutorial runs **only once per install per Google account**. Re-installs trigger it again. There is no re-entry path from within the app.

### 5.6 Home Screen

**Header:** logo (left), avatar (right). No hamburger menu, no center logo.

- Tap avatar → Profile screen.

**Main body:**

- **Primary CTA:** _Start Recording_ → opens task list. (For first-time users: hero copy reads _"Record your first task"_, CTA reads **Start Recording**.)
- **Tiles** (initial state shows `0`s, no welcome copy):
  - _Recording duration today_ — toggle to all time / yesterday / this week / this month / custom range (date-range picker).
    - Duration formatting:
      - `< 1 min` → seconds (`43s`)
      - `< 1 hr` → minutes (`30m`)
      - `≥ 1 hr` → hours + minutes, **floor** to the previous minute (`2h 4m 59s` → `2h 4m`)
  - _Tasks (unique) recorded today_ — same toggle.
  - _Pending uploads_ — count of files queued. **Hidden when 0.** Tapping the tile opens a full upload-queue screen with per-file progress.

**Bottom navigation** (persistent on Home, Tasks, History):

- 3 tabs — **Home**, **Tasks**, **History**.
- Profile is reached only via the avatar in the top-right of the header.
- Help Center and Logout live inside the Profile screen (see §5.11).
- Bottom-nav is suppressed on splash, sign-up, permissions, compat check, tutorial, recording, and force-upgrade screens.

### 5.7 Tasks

**List screen:**

- **Pills (top):** _All_ + per-category pills (cooking, cleaning, laundry, …). Horizontally scrollable. Tapping a pill filters the visible cards by category. Refer categories from the task taxonomy file.
- **Search bar (below pills):** always-visible full-width input with placeholder _"Search tasks…"_. Debounced (200 ms) **server-side semantic search** indexed on task name + description, with fuzzy lexical fallback if semantic returns no/low-confidence matches. English only at MVP. Pure semantic similarity for ranking — no popularity/recency boosting.
- **Per-task card** (text + icon, no GIF / no looping video at MVP):
  - Task name
  - Category label
  - Description (1–2 lines)
  - Category icon

**Task details:**

- Task name
- Category
- Description
- **Universal rules block** (rendered above per-task instructions on every task-details screen, sourced from the header of `task-taxonomy.md`). Four rules, each rendered as an icon-well (32 px white circle with subtle shadow, 18 px `--accent` Material icon) + label (14 / 500), in a soft warm-tinted card (`#FFF7F0`, 16 px radius). All four carry equal visual weight:
  - 🖐 (`front_hand`) **"Keep your hands in frame"**
  - 🎥 (`videocam`) **"Mount the device firmly on the rig"**
  - 💡 (`lightbulb`) **"Make sure your space is well-lit"**
  - ▦ (`apps`) **"Close all other apps before you start"**
- Instructions (bulleted, **max 3 per task**, all task-specific — gaze direction, pacing/motion pattern, optional task-shape detail). The hands-in-frame rule is **not** repeated here — it lives only in the universal block above.
- _Start Recording_ button → recording screen.
- Tap card → task details. Task name, category, description and instructions come from task taxonomy file. The previous "It's recommended to close all other apps before you start" warning callout has been **removed** — that rule is now a first-class line in the universal block.

**Can't find a task?**

- _Send request_ button opens a form: name, description, category, setting (indoor/outdoor), optional 30-second sample video upload.
- User does **not** see request status afterwards.

Task catalog is **config-driven** at MVP; no per-task limits or per-user allocation yet (deferred).

### 5.8 Recording

**On entry:**

- Screen auto-rotates to **landscape**, locked. The user cannot rotate back without exiting.
- Components on screen:
  - Live camera preview (ultrawide)
  - Task name (top)
  - Exit button
  - Rotate-to-landscape animation (visible until phone is in landscape)
  - Record button (replaces the rotate animation once landscape is detected). The button is labeled **Start Recording** as a caption directly below the circular control.
- Top-of-screen disappearing overlay (3 sec): _"Don't exit while recording."_

**On record-button press:**

1. **Pre-record thermal check** (`PowerManager.getCurrentThermalStatus()`). If status ≥ THROTTLING → refuse to start with toast _"Phone is too warm. Let it cool before recording."_
2. **Pause all in-flight uploads** for the duration of the recording (resumed on stop).
3. **Hand-detection gate** (replaces the previous 5-second countdown — single source of truth for entering active recording):

   - **Prompt** centered on the dimmed preview: _"Mount the phone on your head and bring your hands in frame for 2 secs"_
   - **Custom progress ring** above the prompt (130×130 SVG, 6 px stroke, accent fill on a translucent track, fills clockwise as detections accumulate, snaps back to 0 on a reset). Built from scratch — no reuse of the compat-check ring.
   - **Skip** link directly below the prompt — visible from second 0; tapping it bypasses the gate (no TTS cue) and falls through to step 4.
   - **Loading state** if the camera isn't streaming yet — spinner inside the ring well + caption _"Preparing camera…"_ The gate's accumulation does not start until the first frame is available.
   - **Detection loop:** every ~400 ms (Android) / ~600 ms (iOS) the JS layer calls `Camera.takePhoto()` against the rear ultrawide, hands the file path to a custom native module `HandDetector.detectHands(path)`, which decodes the bitmap and runs MediaPipe HandLandmarker (`hand_landmarker.task`, `RunningMode.IMAGE`, `numHands=2`, `minHandDetectionConfidence=0.5`, `minHandPresenceConfidence=0.5`, `minTrackingConfidence=0.5`, CPU delegate) and returns the hand count. Native module is hand-rolled (Kotlin on Android, Swift on iOS) — no third-party RN wrapper.
   - **Pass rule:** the count must equal **exactly 2** for **N consecutive successful checks**, where N is tuned per platform to ≈ 2 sec wall clock — **5 on Android** (5 × 400 ms), **3 on iOS** (3 × 600 ms). Any check that returns `≠ 2` resets the counter to 0.
   - **No timeout. No cancel.** The gate runs indefinitely until pass or skip; the user is never auto-cancelled or bounced out.
   - **Fallback:** if the native module is missing or its initialisation fails (`HandDetector not available`), the gate is silently bypassed (`bypassed = true`) and the flow proceeds straight to step 4.
   - **Exit:** tapping the X during the gate is treated as a **pre-record exit** — silent, no confirmation modal, no captured data to discard.
   - **Scope:** the gate runs **once per recording session** — re-pressing the record button after stop, or re-entering the recording screen, re-runs it. **Does NOT re-run** at internal 10-minute auto-segment boundaries.

4. **On gate pass or skip:**

   - Auto-dim screen to **5 % of the maximum brightness** (battery + thermal saving). Restore on stop or exit.
   - On **pass only** (not skip, not silent bypass): TTS voice cue _"Recording started."_ in an **Indian English female voice** (see §13). 80 ms haptic plays in parallel.
   - On **skip / silent bypass**: no voice cue, no haptic.
   - Capture pipeline begins (see §6). Recording duration timer ticks at top of screen. Floating stop button bottom-aligned. All other UI minimal.

**On stop:**

- Voice cue: _"Recording stopped."_
- 2-second toast: _"X hours/mins added to your contribution."_ (duration formatting matches the Home tile rule: `< 1 min` → `Xs`, `< 1 hr` → `Xm`, `≥ 1 hr` → `Xh Ym`)
- Recording is finalized, IMU CSV is closed, metadata JSON is generated, all three are queued for upload (see §7).
- User remains on the recording screen and can immediately start a new recording (same task) by pressing the record button again.

**Auto-segmentation (every 10 minutes):**

- At 10 minutes elapsed, the current recording stops, **0.5-second fixed gap**, a new recording starts automatically under the **same task**.
- Silent transition (no beep, no voice cue, **no hand-detection gate**).
- Each segment is an **independent** recording — its own MP4, its own IMU CSV, its own metadata JSON, its own upload, its own QA decision. **No `parent_recording_id` linkage.**
- No upper bound on number of segments.
- Segment length is **remote-config-driven** (default 10 minutes) so it can be tuned without an app release.

**Re-press of record button after stop (same task):**

- Every press of the record button starts a **fresh recording**. The task tagged on that recording is whichever task the user picked when entering the current recording screen.
- Switching tasks requires exiting the recording screen and selecting a different task.

**Recording screen exit:**

- Only via the exit button or force-quit. The recording screen does not exit on its own.
- **Mid-record exit confirmation:** if the user taps the exit button while a recording is active, show a modal _"Stop recording?"_ with **Stop** and **Keep recording** buttons. Stop → behaves as a normal stop (the < 60-seconds rule still applies). Pre-record exit (before the record button has been pressed) is silent — no confirmation.

**< 60 seconds rule:**

- If a recording stops at < 60 seconds duration (for any reason): discard it. Do not upload, do not save in history. Show toast _"Recording too short — discarded."_

**Display behavior during recording:**

- `KEEP_SCREEN_ON` flag — device cannot sleep.
- Brightness auto-dimmed.

**Notifications during recording:**

- The app does **not** programmatically toggle Do Not Disturb at MVP (this would require `ACCESS_NOTIFICATION_POLICY` and a Settings deep-link, which is out of scope).
- Notifications from other apps and the OS therefore behave per the device's existing settings during a recording — they may produce sound, vibration, and lock-screen banners.
- No in-app DND nudge is shown.

### 5.9 Upload

See §7 for the technical spec. From the user's POV:

- Uploads start automatically once a recording stops.
- Uploads run in a foreground service and survive backgrounding and force-quit (subject to OEM battery-optimization caveats — request battery-optimization exemption at first upload).
- Uploads pause while a new recording is active and resume after stop.
- The user **cannot manually cancel an upload**.
- Per-file progress visible from the _Pending uploads_ tile on home → upload queue screen.
- The user only sees: MP4 filename, duration, thumbnail, upload state. The IMU CSV and metadata JSON are invisible to the user.

### 5.10 History

Every successfully recorded segment (MP4 ≥ 60 s) appears in history regardless of upload state.

- Default view: grouped by day, newest first, all videos.
- Toggle filter: all time / yesterday / this week / this month / custom range.
- Empty state: _"Your recordings will live here."_ + tap-to-tasks.
- Empty with filter applied: _"No recordings in this range."_ + reset filter.

**Per-row labels** (not columns; tag-style chips):

- Filename
- Duration (in minutes)
- Task name
- Recorded at (e.g. `May 4, 2026 | 15:49`)
- Upload state — one of:
  - Uploaded at (e.g. `May 4, 2026 | 15:49`)
  - _Upload in progress_
  - _Upload paused due to network issues_
  - _Failed_ — with retry icon (resumes from last byte)
- Static thumbnail (auto-generated from MP4 first frame). **Tap thumbnail → in-app fullscreen player** (view-only — no download, no share, no export; standard play/pause/seek controls only). Playback is supported only while the local MP4 still exists on the device. Once the backend posts the `verified` event and local copies are deleted (see §7.3), the thumbnail remains but tapping it shows _"This recording has been securely uploaded. Local copy cleared."_ Streaming uploaded recordings back from the server is **out of MVP**.
- _Feedback_ button (coming soon, disabled).

The user **cannot delete recordings** — neither locally nor server-side.

### 5.11 Profile

- **Avatar** — pulled from the user's Google profile picture (read-only at MVP; not editable in-app)
- User's name (editable)
- Age (editable; may be empty if Google did not return it at sign-up)
- Gender (editable; may be empty if Google did not return it at sign-up)
- Signed up on date (day, month, year)
- **Payments:**
  > _"Payments are processed offline and securely. Your earnings will start reflecting in the app soon. Keep recording — your data is safe and your payouts are guaranteed."_
- **Help Center** entry → opens §5.12 Help Center (this is the only entry point at MVP, since the hamburger menu has been removed).
- **Logout** _(cancels the in-flight upload but preserves the local queue; on re-login by the same user, uploads resume)_
- **Delete account:**
  - Tap → confirmation modal: _"Your account will be deactivated for 30 days. Log in within that window to restore it. After 30 days, deletion is permanent. Recordings already uploaded remain on our servers."_
  - Confirm → text-input modal _"Type DELETE to confirm."_
  - On exact match → **30-day soft delete** with restore window. Re-login within 30 days restores the account. After 30 days, account is permanently deleted; uploaded recordings remain.

### 5.12 Help Center

- Three accordions, collapsed by default: _Instructions Guide_, _FAQs_, _Troubleshooting_. Copy is sourced from `/Users/adnaan/Documents/hl-homelander/help-center-content.md` — that file is the canonical source for all in-app Help Center content and supersedes any placeholder copy.
- _Contact Support_ — sits below the third accordion. Opens the email app with a pre-filled email to `[EMAIL_ADDRESS]` (TBD).

---

## 6. Capture Pipeline (Technical)

### 6.1 Stack

- **Android:** Camera2 API + MediaCodec (HEVC encoder) + ~~AudioRecord~~ + SensorManager. _(AudioRecord dropped 2026-05-11; see banner.)_
- **iOS (ships shortly after Play Store rollout — see §15):** AVCaptureSession + AVAssetWriter + CMMotionManager.
- CameraX is rejected because b-frame and bitrate-mode controls aren't reliably exposed.

### 6.2 Encoder configuration (Android)

- Codec: `video/hevc`
- Profile: `HEVCProfileMain`
- Bitrate: 8,000,000 bps, `BITRATE_MODE_CBR`
- I-frame interval: 1 sec (GOP = 30)
- B-frames: disabled (`KEY_LATENCY = 1`, encoder configured to not reorder frames)
- Color format: YUV 4:2:0 8-bit
- HDR: explicitly disabled
- Stabilization: `CONTROL_VIDEO_STABILIZATION_MODE = OFF`; OIS disabled where toggleable.

### 6.3 Audio — DROPPED 2026-05-11

This section is **historical** — the project owner decision documented in the banner at the top of this file removed audio from the locked capture spec to preserve the ±1 ms drift target. The values below describe what was originally specified and what Phase 3 partially built before reverting. They are preserved verbatim so a future re-enable plan starts from the canonical spec.

> ~~Source: `MediaRecorder.AudioSource.MIC`~~ > ~~Channels: 1 (mono)~~ > ~~Sample rate: 48,000 Hz~~ > ~~Codec: AAC-LC at 128 kbps~~ > ~~Timestamps: `AudioRecord.getTimestamp()` mapped to the same `REALTIME` clock as video and IMU.~~

**Re-enable contract** (documented for future planning): any audio re-introduction must prove on a Pixel-class device that `imu_video_drift_{mean,p99}_ms` stays inside ±1 ms with audio capture active. The bytes-consumed PTS approach (PCM-sample-count / sample_rate) is the right starting point — see commit `a99cdfb` for the canonical implementation. Likely the audio path needs to live on a dedicated CPU core (`Process.setThreadPriority(THREAD_PRIORITY_URGENT_AUDIO)`) or in a separate process to avoid contending with the video pump.

### 6.4 IMU capture

- Captured **in parallel** with video via `SensorManager.registerListener` with `SENSOR_DELAY_FASTEST` for both `TYPE_GYROSCOPE` and `TYPE_ACCELEROMETER`.
- **Sample rate:** the device's maximum supported rate (compat check enforces ≥ 100 Hz sustained floor; no upper cap).
- **Sensor batching** (`maxReportLatency`) used to reduce wake-ups while preserving sample rate.
- Written to a sidecar CSV file alongside the MP4. Columns:

  ```
  timestamp_ns,sensor_type,x,y,z
  ```

  - `timestamp_ns`: nanoseconds in the `SystemClock.elapsedRealtimeNanos` domain
  - `sensor_type`: `gyro` or `accel`
  - `x,y,z`: float, native sensor units (rad/s for gyro, m/s² for accel)
  - One row per sample, both sensors interleaved by timestamp. Line 1 is the `timestamp_ns,sensor_type,x,y,z` column-name header (see §8.2) — emitted verbatim by `ImuWriter`; no inline header _units_ (per-column units are documented in §8.2 / the schema doc, not in the CSV).

### 6.5 Synchronization

- ~~All three streams (video frames, audio buffers, IMU samples)~~ Both streams (video frames, IMU samples — audio dropped 2026-05-11; see banner) are timestamped against the same `SystemClock.elapsedRealtimeNanos` (Android) / `mach_absolute_time` (iOS) clock.
- Camera2 timestamp source explicitly configured as `REALTIME` (devices that only support `UNKNOWN` fail compatibility).
- **Timestamp-clock alignment target: ±1 ms.** This is alignment of the _clock domains_, not sample-time proximity (at 100 Hz, IMU samples are 10 ms apart natively). Downstream training pipelines interpolate IMU values to the exact video frame timestamp.
- Three drift figures are recorded per segment in metadata: `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms`. Max anchors per-frame worst-case; p99 is the QA gate (robust to a single freak sample, still surfaces sustained drift); mean is for fleet-health analytics across recordings.
- **Drift methodology** (run at end-of-segment, §6.7): least-squares fit a line to video timestamps vs frame index → residuals `r_v[i]`; same for IMU → residuals `r_s[j]`. For each video frame, linearly interpolate `r_s` to that frame's instant → `r_s_at_v[i]`. Per-frame drift `d[i] = r_v[i] − r_s_at_v[i]` (the subtraction cancels common-mode wobble like a brief whole-SoC stall, leaving only differential wobble between the streams — which is the only kind that breaks alignment). Roll up `|d[i]|` into max, mean, p99.

### 6.6 Mid-recording resilience

- **Faststart / fragmented MP4:** periodic flush every 30 sec writes the moov atom up-front. If the app crashes mid-recording, the file is still playable up to the last flush.
- Encoder buffer pool pre-allocated at recording start (avoid mid-record alloc pressure).
- No bitmaps or preview snapshots retained beyond the current frame.
- Foreground service of type `camera | microphone | dataSync` to deprioritize OS killing. _(The `microphone` bit is retained for Android FGS-validation compatibility with the kept `RECORD_AUDIO` permission, even though no AudioRecord is started — see note ¹ under §5.3.)_

### 6.7 Post-recording finalization

After stop (or auto-segment cut):

1. Close the encoder, flush remaining frames, finalize the MP4 container.
2. Close the IMU CSV.
3. Compute SHA-256 of the MP4 (~1.5 sec/GB on Snapdragon 7+).
4. Compute SHA-256 of the IMU CSV.
5. Compute `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` from captured timestamps (methodology in §6.5). Sort in-memory over per-frame `|d[i]|` (~18k samples for a 10-min 30 fps segment, trivial).
6. Generate metadata JSON (see §8.3).
7. Hand the triple (MP4 + CSV + JSON) to the upload queue.

---

## 7. Upload Pipeline (Technical)

### 7.1 Protocol

- **S3 multipart upload via presigned URLs.** Backend mints presigned URLs per chunk; phone uploads chunks directly to S3.
- Chunk size: **8 MB** (last chunk may be smaller).
- Concurrency: **3 chunks in parallel per file, 2 files in parallel.**
- Resumable: failed chunks are retried independently; no whole-file restarts.
- Exponential backoff on chunk failure: 2s → 4s → 8s → 16s → 32s → 64s → dead-letter.
- Cellular uploads allowed by default at MVP. No Wi-Fi-only toggle (deferred).

### 7.2 Files per recording

For every successfully recorded segment, the upload bundle is:

1. `<filename>.mp4` — the video.
2. `<filename>.csv` — the IMU sidecar.
3. `<filename>.json` — the metadata file (see §8.3 schema).

Files are NOT decoded, re-encoded, transcoded, or stripped. The MP4 retains every tag, stream, and metadata box exactly as written by the encoder.

### 7.3 Integrity verification

1. Phone computes SHA-256 of MP4 and CSV before upload starts; both hashes are written into the metadata JSON (`file_sha256`, `imu_sha256`).
2. Phone uploads all three files via S3 multipart.
3. Backend, after upload completes, re-hashes the MP4 and CSV and compares to the manifest hashes.
4. **Match** → backend posts `verified` event back to the app → app deletes local copies.
5. **Mismatch** → backend posts `re-upload` event → app re-uploads using the still-present local copy.
6. Local files are **never deleted before** the backend `verified` event. (This changes the existing "delete local on upload-success" behavior.)

### 7.4 Background and lifecycle

- Uploads run in a foreground service. Survives app backgrounding and OS-evicted-from-memory.
- On user swipe-kill on iOS: limited; uploads paused, resumed on next launch. Communicate this in onboarding.
- On Android OEMs with aggressive battery optimization (Xiaomi, Oppo, Vivo, Samsung): we request battery-optimization exemption at first upload; if denied, upload may pause until app is reopened. Surface this clearly in _Pending uploads_ state.
- Uploads **pause** during active recording (resumed on stop).
- Uploads **cancel** on logout but the queue is preserved; same user re-login resumes them.
- Server populates `ip_address` post-upload from the upload request; the app sends `null`.

### 7.5 Loss conditions

- App uninstall while local file exists → data lost.
- No network + no local storage → recording cannot be saved → user notified, recording is lost.
- All other interruptions → recoverable.

---

## 8. Data & File Outputs

### 8.1 Filename convention

`YYYYMMDD_HHMMSS_NNN.<ext>` where `NNN` is a per-day sequence (e.g. `20260505_003020_001.mp4`). Same base name across the MP4, CSV, and JSON.

### 8.2 IMU CSV format

```
timestamp_ns,sensor_type,x,y,z
12345678901234,accel,0.123,-9.812,0.045
12345678911234,gyro,0.001,0.000,-0.002
...
```

> **2026-05-11 — header now emitted.** `ImuWriter` (Kotlin) writes the `timestamp_ns,sensor_type,x,y,z` line as line 1 of every IMU CSV verbatim (it previously started straight on data rows). The block above is the exact on-disk layout: header line, then one row per sample with `sensor_type` ∈ {`gyro`, `accel`} and `x,y,z` in native sensor units (rad/s for gyro, m/s² for accel). The long / interleaved schema is otherwise unchanged. **Any CSV consumer (server-side QA, training-pipeline ingest, the deferred IMU-liveness gate in `imu-liveness-check.md`) must skip line 1 before parsing.** Trail: quick task `.planning/quick/260511-kph-imuwriter-emits-canonical-csv-header-row/`. _(Note: column-name header ≠ inline per-column units — §6.4's "no inline header units" wording still holds; units are documented here, not in the CSV.)_

### 8.3 Metadata JSON

Canonical schema lives at `/Users/adnaan/Documents/hl-homelander/video_metadata.json`. Highlights:

- `schema_version` (string, semver) — so we can evolve.
- `recording_id` (ULID/UUID).
- `contributor_info` — name, email, age (int), gender, consent (bool).
- `task_info` — `task_id` (slug), `task_name`, `task_category`, `environment`, `setting`, `time_of_day`.
- `capture_device_info` — type, model, os, os_version, app_version, **dfov_degrees (single field)**, ip_address (server-populated, `null` from app), location.
- `metadata` — full capture spec, file sizes in **bytes (int)**, hashes (`file_sha256`, `imu_sha256`), drift figures (`imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms`), separate IMU vs video timestamps, codec details, etc.

The user has **zero visibility** into the CSV and JSON files. They only see the MP4 (filename, duration, thumbnail, upload state).

---

## 9. Forced Upgrade

- App-open performs lightweight `GET /app/version`.
- Response shape: `{ "min_supported": "1.4.0", "latest": "1.6.2", "force_upgrade": false }`.
- Installed version `< min_supported` → block screen _"Update to continue."_ + Play Store deep-link. No dismiss.
- Installed version `< latest` and `force_upgrade = false` → soft banner on home, dismissible.
- Version response cached 6 hours.

---

## 10. App Lifecycle & Edge Cases

| Event                                                          | Behavior                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| User exits recording screen mid-record                         | Stop; upload if ≥ 60 s, else discard                                                                                                    |
| User backgrounds the app mid-record                            | Stop; upload if ≥ 60 s, else discard                                                                                                    |
| User force-quits the app mid-record                            | Stop; upload if ≥ 60 s, else discard. Pending uploads continue                                                                          |
| User uninstalls mid-record                                     | Recording lost                                                                                                                          |
| User uninstalls mid-upload (or while paused)                   | Recording lost                                                                                                                          |
| No internet during/after recording                             | Stored locally, auto-resumes when online                                                                                                |
| No internet + storage full                                     | Recording lost; user notified                                                                                                           |
| Phone rotates back to portrait or inverse landscape mid-record | Stop; upload if ≥ 60 s, else discard. Toast _"Recording stopped — keep the phone in landscape."_                                        |
| Incoming call answered                                         | Stop; upload if ≥ 60 s                                                                                                                  |
| Incoming call declined                                         | Recording continues                                                                                                                     |
| Notifications during recording                                 | Behave per device settings; not suppressed by the app at MVP. No in-app DND nudge (see §5.8)                                            |
| Alarm rings during recording                                   | Stop; upload if ≥ 60 s (alarm cannot be suppressed)                                                                                     |
| Battery ≤ 15%                                                  | Toast _"Low-battery, consider charging to prevent data loss."_ Recording continues; new recordings refused below 5% until charged ≥ 15% |
| Battery ≤ 5%                                                   | End current segment immediately                                                                                                         |
| Storage full mid-record                                        | End segment cleanly, save what we have, error message                                                                                   |
| Pre-record thermal status ≥ THROTTLING                         | Refuse to start; toast _"Phone is too warm. Let it cool before recording."_                                                             |
| Mid-record thermal ≥ THROTTLING_SEVERE                         | Voice _"Phone too hot, stopping recording."_ — voice line plays through (~2.5s); end segment cleanly. Refuse new recordings until cool  |
| App OS-evicted from memory mid-record                          | Foreground service auto-restarts; fragmented MP4 is salvageable to last 30-sec flush                                                    |
| Logout while uploads pending                                   | Cancel in-flight upload; preserve queue. Same-user re-login resumes                                                                     |
| Same Google account on a new device                            | Re-runs full compatibility check                                                                                                        |

---

## 11. Anti-Fraud (MVP)

- **Play Integrity** at sign-in. Rooted-device and emulator verdicts are rejected in all builds. The Play Store install-source verdict (`PLAY_RECOGNIZED`) is enforced for **Play Store** and **TestFlight** builds only; the **APK-rollout build flavor** bypasses the install-source check (signed APK distributed outside Play cannot earn that verdict by definition). Bypass is scoped to that flavor's app ID via Remote Config — Play Store builds cannot opt into it.
- All other fraud defenses (per-upload attestation, perceptual-hash duplicate detection, device-fingerprint binding, liveness gestures) are **deferred** — see `deferred-decisions.md`.

---

## 12. Crash Reporting & Analytics

- **Firebase Crashlytics** for native + JVM crash and ANR reporting.
- **Firebase Analytics** for product event funnels.
- **All other observability tooling is explicitly deferred for MVP** — Sentry for RN JS-layer errors and perf traces, Datadog / Grafana Cloud / CloudWatch APM for the backend, structured logging beyond CloudWatch defaults, and any third-party RUM. Decision to be revisited once ingest scale or debug pain demands it.

---

## 13. UI / Brand

- Brand line: **Real Humyns. Real Intelligence.**
- Design system: `/Users/adnaan/Documents/hl-homelander/design-system.pdf` (logos, fonts, brand book).
- Home screen reference: `/Users/adnaan/Documents/hl-thragg/home_screen_reference.png`.
- UI must be responsive and lag-free — no jank, no jaggedness, no perceivable overhead during capture.
- Localization: **English only** at MVP.
- Privacy Policy: stub link `https://humynlabs.ai/privacy` (final copy TBD).
- **TTS voice:** Indian English female voice (e.g. iOS `en-IN` female; Android system TTS with `Locale("en", "IN")` and a female-voice preference). Used for "Recording started", "Recording stopped", and the alert lines in §10. Rate 1.0, pitch 0.95, volume 0.85.

---

## 14. Performance & Scale Targets

- **Day-0 ingest:** ≥ 500–1000 hours of uploaded recordings per day.
- **Concurrency:** ≥ 200–300 simultaneous uploads with no perceivable mobile-side overhead.
- **Per-device upload concurrency:** 3 chunks in parallel per file, 2 files in parallel.
- **Encoder performance:** sustained 1080p30 HEVC encode on a Pixel 7a-class device for ≥ 20 minutes of back-to-back chained 10-minute segments without frame drop or thermal cut-out under cool-start conditions.

---

## 15. Tech Stack Decisions Locked

| Layer                | Decision                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture (Android)    | Camera2 + MediaCodec                                                                                                                                                                                |
| Capture (iOS, later) | AVCaptureSession + AVAssetWriter                                                                                                                                                                    |
| IMU                  | SensorManager (Android) / CMMotionManager (iOS)                                                                                                                                                     |
| Container            | Fragmented MP4 (faststart, periodic flush)                                                                                                                                                          |
| Upload               | S3 multipart with presigned URLs, 8 MB chunks                                                                                                                                                       |
| Integrity            | Client SHA-256 + server re-hash verify                                                                                                                                                              |
| Auth                 | Google Sign-In + Play Integrity                                                                                                                                                                     |
| Crash                | Firebase Crashlytics                                                                                                                                                                                |
| Analytics            | Firebase Analytics                                                                                                                                                                                  |
| Hand-detection gate  | MediaPipe HandLandmarker (Tasks Vision); custom Kotlin (Android) and Swift (iOS) RN modules wrapping the public `hand_landmarker.task` bundle (~7.8 MB) — single shared model file across platforms |

**Rollout sequence:** APK (signed, distributed to early users via the chief network) → **Play Store** (fast follow) → **iOS App Store** (fast follow, ≤ 2 weeks after Play Store). All three ship within MVP. Android tech choices are constrained to those that have a clean iOS analogue so the iOS halves ship production-quality from day 0.

---

## 16. Reference Files

- Cleaned-up metadata schema: `/Users/adnaan/Documents/hl-homelander/video_metadata.json`
- Task taxonomy: `/Users/adnaan/Documents/hl-homelander/task-taxonomy.md`
- Design system: `/Users/adnaan/Documents/hl-homelander/design-system.pdf`
- Home screen reference image: `/Users/adnaan/Documents/hl-thragg/home_screen_reference.png`
- Strategic suggestions parked for v2: `/Users/adnaan/Documents/hl-homelander/strategic-suggestions.md`
- Deferred technical decisions: `/Users/adnaan/Documents/hl-homelander/deferred-decisions.md`
- Help Center copy (Instructions Guide, FAQs, Troubleshooting): `/Users/adnaan/Documents/hl-homelander/help-center-content.md`
