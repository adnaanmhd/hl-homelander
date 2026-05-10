# Phase 3: HumynCapture Native Module (Bytes-on-disk) - Research

**Researched:** 2026-05-10
**Domain:** Android Camera2 + MediaCodec HEVC capture pipeline + IMU CSV + audio + drift + foreground-service + thermal lifecycle, embedded as a TurboModule under React Native 0.83 / Hermes / New-Arch
**Confidence:** HIGH on stack, encoder, IMU clocking, and FGS lifecycle (all locked in CONTEXT.md + STACK.md + idea-brief.md and verified against current Android docs); MEDIUM on muxer selection (one library swap from the Phase-2 default — see Pitfall 1) and on the `imu_min_rate_hz_observed_p1` exact computation window.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wave structure (D-WAVE-01..09):**

- Phase 3 is two waves. Wave 1 = Phase 2 cosmetic fix-up (resolves frozen `02-COSMETIC-GAPS.md`). Wave 2+ = HumynCapture native module + tests + JS surface; blocked on Wave 1 commit.
- `02-COSMETIC-GAPS.md` is **frozen 2026-05-10** (D-WAVE-04). New gaps go to `03-W1-AMENDMENTS.md` (D-WAVE-09) — never edit the frozen doc.
- Wave 1 plan layout = SPLIT into two plans (D-WAVE-05): `03-01-cosmetic-visual-fixup-PLAN.md` (visual-only, lands first; Task 1 is logo asset re-export per D-WAVE-07) and `03-02-cosmetic-functional-regressions-PLAN.md` (navigator-touching: Compat-fail+Recovery merge, Compat-pass auto-advance, `useTabTopBarProps()` extraction, Tasks/History TopBar avatar wiring, foreground-rehydrate hook).
- Visual-snapshot infra = `jest-image-snapshot` driven through Vitest (D-WAVE-06). Baselines committed under `apps/mobile/__tests__/visual/__image_snapshots__/`.
- Wave 2 acceptance gate (D-WAVE-08) = both Wave 1 plans done + on-device re-walk on Pixel 10a + operator sign-off in `03-WAVE1-SMOKE.md`.

**HumynCapture JS API surface (D-API-01..03):**

- Promise + `NativeEventEmitter`. `start(opts) → Promise<{sessionId, segmentId, recordingId, filenameBase}>` resolves when encoder is up + first frame written. `stop() → Promise<void>` resolves after final segment finalize. Events: `onSegmentStart`, `onSegmentComplete`, `onSessionStop`, `onThermalAbort`, `onError`.
- `start(opts)` shape (full CaptureSessionOpts): JS owns user/task data (taskId, taskName, taskCategory, taskSetting, contributor block, isPractice, startGate block, location, appVersion, dfovDegrees). Native synthesizes per-segment ULID `recording_id`, Build-derived device fields, `task_info.environment`/`time_of_day`, filename, the entire `metadata.metadata` block (sizes, hashes, drift, codec params, timestamps, `start_gate` carried from opts).
- Event payload contracts locked verbatim in CONTEXT.md D-API-03.

**Segmentation ownership (D-SEG-01..03):**

- Kotlin module owns the 10-min auto-segment timer. JS calls `start(opts)` once; module schedules cuts; emits `onSegmentComplete` per cut + `onSegmentStart` for next segment. JS calls `stop()` to end whole session. Driven by Firebase Remote Config key `capture.segment_minutes` (default `10L`) read natively via `@react-native-firebase/remote-config`.
- JS veto window — JS can call `stop()` between segments (after `onSegmentComplete` and before `onSegmentStart`) to halt session.
- 0.5 s gap mechanic = concurrent finalize. Segment N+1's encoder + IMU writer start immediately after N closes file handles. Segment N's SHA + drift + metadata-JSON write run on a worker thread.

**Storage layout, practice segregation, cleanup (D-FS-01..05):**

- Real recordings: flat `filesDir/recordings/{filenameBase}.{mp4,csv,json}`. Practice: `filesDir/practice/{filenameBase}.{mp4,csv,json}`. Phase 5's upload pipeline globs ONLY `recordings/`.
- Filename: `YYYYMMDD_HHMMSS_NNN.<ext>` per `idea-brief.md §8.1` and CAP-17. Counter persists across restarts (recovered from `ls recordings/` + `ls practice/` if MMKV is wiped).
- App-launch sweep owned by HumynCapture (runs in `MainApplication.onCreate`):
  - For each `recordings/*.mp4` without `.json`, attempt re-finalize using per-segment `.session.json` sidecar; discard if MP4 corrupt OR sidecar missing.
  - Delete `recordings/*.json` orphans.
  - Delete `practice/*` files older than 24 h.
- Per-segment `.session.json` sidecar stashed at segment-start with the full data JS provided in `start(opts)`. Used at finalize to compose metadata JSON; deleted at the moment of final-`.json` write so an orphan sidecar = unambiguous crash signal.

**CAP-19 IMU floor + foreground service + thermal (D-IMU-01..02 / D-FGS-01..02 / D-THERM-01 / D-UPL-01):**

- CAP-19 is **finalize-only mark**. Module observes IMU rate throughout segment, computes `imu_min_rate_hz_observed_p1` at finalize, stamps into metadata JSON. Server-side QA / `qa_status` derivation owns rejection. Schema bumps `1.0.0` → `1.1.0` for the new field.
- `HumynForegroundService` lives at `ai.humynlabs.capture.fgs.HumynForegroundService.kt`. Started by HumynCaptureModule on `start()` with type `camera|microphone|dataSync` + `KEEP_SCREEN_ON` window flag. On `stop()`: if `setUploadActive(true)` was called by Phase 5's HumynUpload (no-op in Phase 3), service downgrades to `dataSync`; otherwise stops.
- `setUploadActive(boolean)` seam ships in Phase 3 (no-op; nothing calls it). Phase 5 wires it.
- HumynCapture owns BOTH thermal checks. Pre-record: `start()` reads `PowerManager.getCurrentThermalStatus()` first thing; rejects with `{code: 'thermal_throttling', recoverable: true, currentStatus}` if `≥ THROTTLING`. Mid-record: subscribes to `PowerManager.OnThermalStatusChangedListener` at session start; on `≥ THROTTLING_SEVERE`, schedules native 2.5 s graceful stop, finalizes segment, emits `onThermalAbort` then `onSessionStop`.
- CAP-13 pause-uploads is structurally a no-op in Phase 3 (HumynUpload doesn't exist yet). Phase 3 emits `onSessionStart` and `onSessionStop`; Phase 5 wires JS-side listeners.

**Locked from upstream (cannot be re-litigated by this phase):**

- Capture spec per `idea-brief.md §2.1`: 1080p / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no-B-frames / 8-bit YUV 4:2:0 / no-HDR / no-OIS / 48 kHz mono AAC-LC 128 kbps / IMU sustained ≥100 Hz at device max via `SENSOR_DELAY_FASTEST` / `SystemClock.elapsedRealtimeNanos` / `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME` / ±1 ms clock alignment.
- Capture pipeline must NOT route through VisionCamera or CameraX.
- Files NEVER decoded / re-encoded / transcoded / stripped — byte-for-byte from device to S3 (CAP-18).
- Drift methodology = least-squares residual subtraction per `idea-brief.md §6.5`; metrics = `{max, mean, p99}`.
- IMU CSV format locked: `timestamp_ns,sensor_type,x,y,z`; both sensors interleaved by timestamp; native sensor units (rad/s for gyro, m/s² for accel); no inline header units.
- Metadata JSON schema = `video_metadata.json` at repo root + new `imu_min_rate_hz_observed_p1` field; schema_version → `1.1.0`.
- 10-min auto-segment (Remote Config knob), 0.5 s silent gap, per-segment ULID, no `parent_recording_id` linkage (CAP-09).
- Hand-gate does NOT re-run at auto-segment cuts (CAP-10). Module preserves `start_gate` block from `start(opts)` across all segments in the session.
- iOS deferred to Phase 7. Phase 4 owns recording-surface UX, hand-gate, §10 lifecycle edges, practice flow. Phase 5 owns upload + hash-verify + delete-on-`verified`.
- No clan-chief / KGeN narrative anywhere in Phase 3 surfaces.
- No precise location capture — JS resolves coarse → string and passes via `start(opts)`; module never calls Location APIs.
- English only at MVP. No notifications channel. No success metrics gating phase completion.
- Surgical-stage protocol for protected files (`SignupScreen.tsx`, `Text.tsx`, `CLAUDE.md`); no cosmetic chasing during smoke; never lower capture-spec thresholds.

### Claude's Discretion

The planner has freedom to choose:

- 0.5 s gap mechanic exact threading (single finalize-thread vs per-segment thread vs `Executors.newCachedThreadPool`).
- Error semantics taxonomy on encoder/storage crash (exact `code` strings; CONTEXT.md locks the `recoverable` flag and event ordering).
- IMU sensor batching `maxReportLatency` value (~200 ms is industry-standard).
- `imu_min_rate_hz_observed_p1` exact computation window (sliding-window-p1 vs whole-segment-p1).
- Per-day filename `_NNN` recovery (MMKV-backed counter vs `ls`-derived).
- Camera2 device selection sharing with Phase 2 DeviceCaps (extract shared util vs duplicate vs read from `compat.lastResult.v1`).
- Audio source mode (`MIC` vs `VOICE_RECOGNITION` vs `UNPROCESSED` — see § Standard Stack).
- Encoder buffer pool size + pre-allocation.
- `HumynCapture.ts` JS surface file location (default to `apps/mobile/src/native/HumynCapture.ts` matching Phase 2 pattern).
- Re-finalize policy for trailing-edge edge cases (partial CSV with no matching gyro/accel pair; missing audio buffer at the cut). Discard-vs-truncate-vs-pad rule.

### Deferred Ideas (OUT OF SCOPE)

- PROJECT.md / REQUIREMENTS.md / ROADMAP.md / `idea-brief.md §3.1` cleanup of stale clan-chief narrative.
- Hand-detection gate (HAND-01..14) → Phase 4.
- Recording surface UX state machine (REC-01..16) → Phase 4.
- §10 lifecycle edges (rotation / call / alarm / battery / storage-full / DND / phone-call-declined-continues) → Phase 4.
- Practice-recording UX flow (ONB-03..07) → Phase 4 (Phase 3 segregates files only).
- Upload pipeline (UP-01..19), hash-verify worker, IMU-liveness backend → Phase 5.
- iOS analogue (`HumynCapture` Swift) → Phase 7.
- TTS voice line wiring for thermal abort → Phase 4 (Phase 3 emits the event).
- Battery alert + low-battery refuse + ≤5% segment-end → Phase 4.
- Storage-full prevention path → Phase 4 (Phase 3 surfaces writer-side `IOException` only).
- Tasks browsing / Home tiles / History list / Player → Phase 6.
- Observability / iOS parity / staged rollout → Phase 7.
- Compat-tightening propagation (COMPAT-05) → Phase 4.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                                                                | Research Support                                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAP-01 | 1920×1080 / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no B-frames (`KEY_LATENCY=1` + NAL-unit verifiable) / 8-bit YUV 4:2:0 / no HDR / no OIS / landscape | § Code Examples 1 (encoder MediaFormat) + § Code Examples 5 (Camera2 capture request) — same `KEY_LATENCY=1 + KEY_MAX_B_FRAMES=0 + LENS_OPTICAL_STABILIZATION_MODE=OFF` pattern Phase 2's `EncoderProbe.kt` already proves on-device. NAL verification reuses Phase 2's `NalParser.kt`. |
| CAP-02 | Fragmented MP4 with periodic moov flush every 30 s                                                                                                         | § Pitfall 1 (stock `MediaMuxer` does NOT emit fragmented MP4) + § Standard Stack `androidx.media3:media3-muxer:1.10.0` (`FragmentedMp4Muxer.Builder().setFragmentDurationMs(30_000)`).                                                                                                  |
| CAP-03 | 48 kHz mono AAC-LC 128 kbps audio                                                                                                                          | § Code Examples 2 (`AudioRecord` + AAC-LC `MediaCodec`) + § Standard Stack audio-source decision tree.                                                                                                                                                                                  |
| CAP-04 | IMU gyro + accel at `SENSOR_DELAY_FASTEST` with `maxReportLatency` batching                                                                                | § Code Examples 3 reuses Phase 2 `ImuProbe.kt` listener pattern + § Pitfall 3 batching trap.                                                                                                                                                                                            |
| CAP-05 | IMU CSV `timestamp_ns,sensor_type,x,y,z`, both sensors interleaved by timestamp                                                                            | § Code Examples 3 — interleave-by-timestamp writer thread.                                                                                                                                                                                                                              |
| CAP-06 | All three streams timestamped against single `SystemClock.elapsedRealtimeNanos`                                                                            | § Architecture Patterns "Single-clock alignment" + § Pitfall 2 (REALTIME source mandatory).                                                                                                                                                                                             |
| CAP-07 | Camera2 timestamp source `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`                                                                                         | Phase 2 compat already gates this; Phase 3 reads `pick.openableChars.get(SENSOR_INFO_TIMESTAMP_SOURCE)` and refuses if not REALTIME (defensive — should never fire post-compat).                                                                                                        |
| CAP-08 | `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` via least-squares residual subtraction at end-of-segment                     | § Code Examples 4 (drift residual computation) + idea-brief.md §6.5.                                                                                                                                                                                                                    |
| CAP-09 | 10-min auto-segment (Remote Config) with 0.5 s silent gap; each segment own MP4/CSV/JSON/ULID; no `parent_recording_id`                                    | § Architecture Patterns "Segment lifecycle" + D-SEG-01..03 in CONTEXT.md.                                                                                                                                                                                                               |
| CAP-10 | Hand-gate does NOT re-run at auto-segment cuts                                                                                                             | Native module preserves `start_gate` block from `start(opts)` across the session — handled by D-FS-05 sidecar pattern.                                                                                                                                                                  |
| CAP-11 | Pre-record refuse `≥ THROTTLING` with documented toast                                                                                                     | § Code Examples 6 (thermal pre-flight). Toast text fires from JS (Phase 4); native rejects with `{code: 'thermal_throttling', currentStatus}`.                                                                                                                                          |
| CAP-12 | Mid-record `≥ THROTTLING_SEVERE` ends segment cleanly within ~2.5 s                                                                                        | § Code Examples 6 (`OnThermalStatusChangedListener` + scheduled graceful stop). Voice line fires from JS (Phase 4) via `onThermalAbort` event.                                                                                                                                          |
| CAP-13 | Pause uploads on record start, resume on stop                                                                                                              | Phase 3 emits `onSessionStart`/`onSessionStop`; Phase 5 wires `HumynUpload.pauseAll()`/`.resumeAll()` listeners. CONTEXT D-UPL-01.                                                                                                                                                      |
| CAP-14 | `KEEP_SCREEN_ON` + foreground service `camera \| microphone \| dataSync`                                                                                   | § Code Examples 7 (`HumynForegroundService` + `ServiceCompat.startForeground` with type bitmask). FGS permissions already declared in Phase 2 manifest.                                                                                                                                 |
| CAP-15 | SHA-256 of MP4 + SHA-256 of CSV at finalize, stamped into metadata JSON                                                                                    | § Code Examples 8 (streaming SHA-256 over `FileChannel`).                                                                                                                                                                                                                               |
| CAP-16 | Per-segment metadata JSON matching `video_metadata.json` schema                                                                                            | § Architecture Patterns "Metadata JSON conformance" + `shared/types/src/recording.ts` for the wire contract Phase 5 will POST.                                                                                                                                                          |
| CAP-17 | Filename `YYYYMMDD_HHMMSS_NNN.<ext>`; same base name across MP4/CSV/JSON                                                                                   | § Code Examples 9 (filename + per-day NNN counter recovery).                                                                                                                                                                                                                            |
| CAP-18 | Files NEVER decoded/re-encoded/transcoded/stripped — byte-for-byte from device to S3                                                                       | Hard-rule. No post-finalize touch path; SHA-256 computed read-only via `FileChannel`. CLAUDE.md "Files never re-encoded" + Phase 1 init route comment "API process never reads bytes (CLAUDE.md file-fidelity rule)".                                                                   |
| CAP-19 | `imu_min_rate_hz_observed_p1` runtime observation; segments below 80 Hz rejected                                                                           | D-IMU-01 reinterprets: client-side **measurement** + server-side filtering. Native computes the figure at finalize, stamps into metadata; QA pipeline does the rejection.                                                                                                               |

</phase_requirements>

## Summary

Phase 3 builds the **bytes-on-disk core** of the entire project: a hand-rolled Kotlin native module that drives Camera2 + MediaCodec + AudioRecord + SensorManager into a fragmented HEVC MP4 + IMU CSV + metadata JSON triple, with single-clock alignment between video, audio, and IMU streams that is the project's reason to exist. The architecture is heavily pre-decided by `idea-brief.md §6`, `STACK.md`, Phase 2's already-shipped `HumynCompat` skeleton (which proves the encoder + sensor pattern works on the target device class), and the locked CONTEXT.md decisions (D-API-01..03, D-SEG-01..03, D-FS-01..05, D-IMU-01, D-FGS-01..02, D-THERM-01).

The non-obvious research finding is the **muxer choice**. Phase 2's `EncoderProbe.kt` uses stock `android.media.MediaMuxer` because the probe writes a 5-second clip and never needs fragmentation. Phase 3 needs **fragmented MP4 with `moov` flush every 30 s** (CAP-02) for crash resilience — and `android.media.MediaMuxer` does NOT support fragmented output. The canonical solution is **`androidx.media3:media3-muxer:1.10.0`'s `FragmentedMp4Muxer.Builder().setFragmentDurationMs(30_000L)`**, which is a new dependency for this phase. This is the single most important architectural call the planner has to ratify and is documented in detail in § Pitfall 1.

The other major load-bearing pieces are: **(a)** a single-clock-domain Kotlin runtime that timestamps every video frame, audio buffer, and IMU sample against `SystemClock.elapsedRealtimeNanos` (the Camera2 REALTIME timestamp source compat-gates this for us; the IMU is already on this clock by default; audio needs `AudioRecord.getTimestamp()` mapped explicitly); **(b)** a `HumynForegroundService` declared in the manifest with `foregroundServiceType="camera|microphone|dataSync"` and started via `ServiceCompat.startForeground(..., FOREGROUND_SERVICE_TYPE_CAMERA or FOREGROUND_SERVICE_TYPE_MICROPHONE or FOREGROUND_SERVICE_TYPE_DATA_SYNC)` — the Android 14 strict-mode policy throws a `MissingForegroundServiceTypeException` if either the manifest or the runtime bitmask is wrong; **(c)** `PowerManager.OnThermalStatusChangedListener` for mid-record `≥ THROTTLING_SEVERE` with a native-scheduled 2.5 s graceful stop; **(d)** a streaming SHA-256 over the finalized MP4 and CSV via `FileChannel` — never reading the bytes into memory and never re-encoding (CAP-18 hard rule); **(e)** a per-segment `.session.json` sidecar that flips the app-launch sweep from janitor into a real data-rescue mechanism for crash-mid-segment cases.

**Primary recommendation:** Reuse the entire Phase 2 `HumynCompat` skeleton (TurboModule + `ReactPackage` + `MainApplication` registration + Robolectric test harness + `EncoderProbe` Camera2/MediaCodec config + `ImuProbe` listener + `NalParser` for optional first-GOP sanity check + `DeviceCaps` for shared lens enumeration) and **add `androidx.media3:media3-muxer:1.10.0`** as the only new third-party dependency. Build the threading model around three Kotlin coroutines / HandlerThreads — Camera2 callback thread (background), MediaCodec callback thread (background), IMU `SensorEventListener` registered on a dedicated `HandlerThread` — with a single concurrent-finalize worker thread that owns SHA + drift + metadata-JSON write so the 0.5 s segment-rotation gap never blocks the encoder hot path.

## Architectural Responsibility Map

Every Phase 3 capability lives on the **device → native-Kotlin tier**. There is no client-server tier split for this phase (Phase 1 owns the recordings API, Phase 5 owns the upload mediator). Within the device, capabilities split cleanly between the **JS shell** (recording-surface UX is Phase 4; Phase 3 only ships the native bridge) and the **native Kotlin module** (everything load-bearing).

| Capability                                     | Primary Tier                                                       | Secondary Tier                                     | Rationale                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Camera2 capture session lifecycle              | Native Kotlin (`HumynCaptureModule`)                               | —                                                  | Encoder controls (CBR, KEY_LATENCY, MAX_B_FRAMES) not exposed to JS via VisionCamera; spec rejects CameraX.                 |
| MediaCodec HEVC encoder + Surface input        | Native Kotlin                                                      | —                                                  | Same as above.                                                                                                              |
| MP4 muxing (fragmented, 30 s flush)            | Native Kotlin (`FragmentedMp4Muxer`)                               | —                                                  | androidx.media3 muxer is a Kotlin/Java-only API; no JS bridge exists.                                                       |
| Audio capture (AudioRecord → AAC-LC)           | Native Kotlin                                                      | —                                                  | Audio buffers must timestamp into the same `elapsedRealtimeNanos` domain as video; cross-thread JS bridge would add jitter. |
| IMU sample collection + CSV write              | Native Kotlin (`SensorEventListener` on dedicated `HandlerThread`) | —                                                  | At 416 Hz a JS bridge round-trip per sample is impossible; D-SEG-01 explicitly rejects JS in the IMU hot path.              |
| Single-clock timestamp domain                  | Native Kotlin                                                      | —                                                  | All three stream sources are Java/Kotlin APIs; nothing crosses the bridge.                                                  |
| 10-min auto-segment timer + 0.5 s gap          | Native Kotlin                                                      | JS (veto via `stop()` between segments)            | D-SEG-01 explicit. JS only sees `onSegmentComplete` / `onSegmentStart`.                                                     |
| Drift computation (`{max, mean, p99}`)         | Native Kotlin (worker thread at finalize)                          | —                                                  | Per-frame timestamp arrays live in native memory; serializing to JS is wasteful.                                            |
| Per-segment SHA-256                            | Native Kotlin (worker thread)                                      | —                                                  | Streaming over `FileChannel`; ~0.9 s per 600 MB MP4.                                                                        |
| Metadata JSON write (per-segment)              | Native Kotlin                                                      | JS (provides `start(opts)` data)                   | Atomicity matters; native writes to `.partial` then renames.                                                                |
| `.session.json` sidecar                        | Native Kotlin                                                      | —                                                  | Crash-recovery primitive; native owns lifecycle.                                                                            |
| App-launch sweep (`recordings/` + `practice/`) | Native Kotlin (`MainApplication.onCreate`)                         | —                                                  | Phase 2 already runs the `compat-probe-*.mp4` sweep here; Phase 3 extends it.                                               |
| Foreground service lifecycle                   | Native Kotlin (`HumynForegroundService`)                           | —                                                  | OS-level service registration; not bridgeable.                                                                              |
| Thermal pre-record gate                        | Native Kotlin (`PowerManager.getCurrentThermalStatus`)             | —                                                  | D-THERM-01 explicit.                                                                                                        |
| Thermal mid-record listener                    | Native Kotlin (`OnThermalStatusChangedListener`)                   | JS (TTS line on `onThermalAbort` — Phase 4)        | D-THERM-01.                                                                                                                 |
| Pause-uploads signal                           | JS (Phase 5)                                                       | Native emits `onSessionStart`/`onSessionStop` only | D-UPL-01 — handler is Phase 5; signal is Phase 3.                                                                           |
| Recording-surface UX                           | JS (Phase 4)                                                       | —                                                  | Out of Phase 3 scope.                                                                                                       |
| Hand-gate detection                            | JS+native `HandDetector` (Phase 4)                                 | —                                                  | Out of Phase 3 scope.                                                                                                       |
| Upload pipeline                                | JS+native `HumynUpload` (Phase 5)                                  | —                                                  | Out of Phase 3 scope.                                                                                                       |

## Standard Stack

### Core (already pinned in `apps/mobile/package.json` and `android/build.gradle`)

| Library                                | Version (pinned) | Purpose                                                                                            | Why Standard                                                                                                                                                                     |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native`                         | `0.83.0`         | RN shell + TurboModule host                                                                        | Phase 2 ships on this; New-Arch + Hermes default; Detox 20.51 supports it; ecosystem stable. [VERIFIED: STACK.md + apps/mobile/package.json]                                     |
| `@react-native-firebase/remote-config` | `24.0.0`         | Read `capture.segment_minutes` natively                                                            | Phase 2 already wired the Firebase SDK at this version; unified version constraint across `@react-native-firebase/*`. [VERIFIED: STACK.md + package.json]                        |
| `react-native-mmkv`                    | `4.3.1`          | Per-day filename `_NNN` counter persistence (planner's choice; ls-derived alternative also viable) | Phase 2 baseline. [VERIFIED: package.json]                                                                                                                                       |
| Kotlin                                 | `2.0.21`         | Native module language                                                                             | Phase 2 build.gradle pin. [VERIFIED: android/build.gradle]                                                                                                                       |
| AGP / Gradle                           | `8.7+` / `8.11+` | Build                                                                                              | Phase 2 baseline. [VERIFIED: STACK.md]                                                                                                                                           |
| compileSdk / targetSdk / minSdk        | `36 / 36 / 26`   | Android API surfaces                                                                               | `compileSdk 36` was bumped from 35 in Phase 2 for `react-native-screens 4.24+`; `minSdk 26` is the locked floor across the project. [VERIFIED: android/build.gradle lines 10–12] |
| JDK                                    | `17`             | Build toolchain                                                                                    | Phase 2 baseline. [VERIFIED: STACK.md]                                                                                                                                           |

### New Dependency (the ONE new library Phase 3 adds)

| Library                        | Version                                       | Purpose                                                               | Why Standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `androidx.media3:media3-muxer` | `1.10.0` (latest stable, released 2026-03-26) | Fragmented MP4 output with `setFragmentDurationMs(30_000)` for CAP-02 | Stock `android.media.MediaMuxer` does NOT support fragmented MP4 — see Pitfall 1. Media3 1.5.0+ ships `FragmentedMp4Muxer` as the canonical replacement; B-frame support, edit-list support, fragmented MP4 output all in one library. Same Google AOSP team as `MediaMuxer`. Pinned at `1.10.0` to match the latest stable release; a 1.9.x downpin is acceptable if 1.10.0 surfaces fresh-rev regressions. [VERIFIED: developer.android.com/jetpack/androidx/releases/media3 + androidx/media GitHub source for `FragmentedMp4Muxer.Builder.setFragmentDurationMs`] |

**Installation:**

```kotlin
// apps/mobile/android/app/build.gradle
dependencies {
    // ... existing Phase 1 / Phase 2 deps ...
    implementation("androidx.media3:media3-muxer:1.10.0")
}
```

**Version verification command (the planner MUST run this before Plan 1):**

```bash
# Confirm 1.10.0 is still the latest before planning kicks off
curl -s "https://maven.google.com/androidx/media3/media3-muxer/maven-metadata.xml" | grep -E "<latest>|<release>"
```

### Audio source mode — planner's call (D-API "Claude's Discretion")

| Source                                        | Properties                                                                      | Recommendation                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MediaRecorder.AudioSource.MIC`               | Default; some platform-level AGC and noise suppression applied                  | Acceptable but not ideal — gain instability on high-motion clips.                                                                                                                                                                                                                                                        |
| `MediaRecorder.AudioSource.UNPROCESSED`       | Raw mic with NO platform processing                                             | **Preferred IF available.** Check `AudioManager.getProperty(PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED)` first; many Pixel + Samsung mid-tier devices support it. Fall back to next row.                                                                                                                                  |
| `MediaRecorder.AudioSource.VOICE_RECOGNITION` | Documented to NOT use AGC or noise suppression; flat freq response 100 Hz–4 kHz | **Recommended fallback** when UNPROCESSED unsupported. `engineering-handoff.md §5` calls out "measurement / video-chat mode to keep gain stable; suppress AGC where possible" — VOICE_RECOGNITION matches this guidance. [VERIFIED: developer.android.com AudioRecord docs + AOSP source/audio/implement-pre-processing] |
| `MediaRecorder.AudioSource.CAMCORDER`         | DOES apply AGC                                                                  | **REJECT.** AGC instability defeats the spec.                                                                                                                                                                                                                                                                            |

**Recommendation:** UNPROCESSED → VOICE_RECOGNITION fallback chain. Implement `AudioManager.getProperty(...)` probe at session start and log which mode was used into a metadata diagnostic field (NOT a JSON-schema field — diagnostic only). Whatever the planner picks, the choice MUST be documented in the per-task PLAN file because changing it post-finalization breaks file fidelity (CAP-18).

### Alternatives Considered (and rejected)

| Instead of                                          | Could Use                                                                                                           | Tradeoff / Why Rejected                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `androidx.media3:media3-muxer FragmentedMp4Muxer`   | Hand-rolled MP4 box writer (e.g., port of `mp4parser`)                                                              | Reinvents IETF ISO BMFF; weeks of work to match what one Maven dep gives us; "Don't Hand-Roll" rule.                                                                                                                                                                                                                                                              |
| `androidx.media3:media3-muxer FragmentedMp4Muxer`   | Stock `android.media.MediaMuxer` + manual fragmentation (write moov to sidecar every 30 s, finalize with mp4parser) | The "fallback" path STACK.md mentions in line 191 — but it requires an extra third-party library AND post-write byte manipulation, which violates CAP-18 ("files never re-encoded / stripped") because rewriting the moov atom IS byte manipulation. Rejected.                                                                                                    |
| Custom Camera2 + MediaCodec                         | VisionCamera v4 / v5                                                                                                | Spec rejects (no encoder control exposure). [VERIFIED: STACK.md hard rules + CONTEXT.md "Locked from upstream"]                                                                                                                                                                                                                                                   |
| Custom Camera2 + MediaCodec                         | CameraX `VideoCapture`                                                                                              | Spec rejects (encoder controls not exposed).                                                                                                                                                                                                                                                                                                                      |
| Kotlin ULID generator (`io.azam.ulidj:ulidj:2.0.0`) | UUID + sortable encoding                                                                                            | ULID has lexicographic sort; backend already uses `ulid` 2.3.0 npm; pin same primitive across the device + backend boundary. [VERIFIED: apps/api/package.json + maven repo] **Recommendation:** add `io.azam.ulidj:ulidj:2.0.0` as a tiny dep OR hand-roll a 50-LOC Kotlin ULID generator (Crockford base32 + 48-bit ms time + 80-bit randomness). Planner picks. |
| `FragmentedMp4Muxer` from Media3                    | Hand-roll a `WritableByteChannel` adapter for streaming output                                                      | Required adapter is ~10 LOC (`FileOutputStream(file).channel`). Use the Media3 API as designed.                                                                                                                                                                                                                                                                   |

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       JS / React Native (Phase 4 owns wiring)              │
│                                                                            │
│   RecordingScreen.tsx ──── HumynCapture.start(opts)  ────────────┐         │
│       │                                                          │         │
│       │  await Promise<{sessionId, segmentId, ...}>              │         │
│       │                                                          ▼         │
│       │   ┌── NativeEventEmitter ──── onSegmentStart   ──────┐             │
│       │   │                           onSegmentComplete  ────┤             │
│       │   │                           onSessionStop      ────┤             │
│       │   │                           onThermalAbort     ────┤             │
│       │   └────────────────────────── onError           ────┘             │
│       │                                                                    │
└──────|│|──────────────────────────────────────────────────────────────────┘
       │ TurboModule bridge
┌──────▼─────────────────────────────────────────────────────────────────────┐
│  Native: ai.humynlabs.capture.capture.HumynCaptureModule (Kotlin)         │
│                                                                           │
│  ┌──────────────────────────────┐                                         │
│  │ start(opts: CaptureSessionOpts) → Promise<...>                          │
│  │   1. Pre-flight thermal: PowerManager.getCurrentThermalStatus()         │
│  │   2. Read Remote Config: capture.segment_minutes (default 10L)          │
│  │   3. Mint sessionId (ULID) + first segment ULID + filenameBase          │
│  │   4. Start HumynForegroundService (camera|microphone|dataSync)          │
│  │   5. Subscribe OnThermalStatusChangedListener                           │
│  │   6. open Camera2 (ultrawide) → Surface input                           │
│  │   7. Open MediaCodec HEVC encoder → input Surface                       │
│  │   8. Open AudioRecord (UNPROCESSED→VOICE_RECOGNITION)                   │
│  │      + AAC-LC MediaCodec encoder                                        │
│  │   9. Register SensorManager listeners (gyro+accel SENSOR_DELAY_FASTEST) │
│  │  10. Open FragmentedMp4Muxer (setFragmentDurationMs=30_000)             │
│  │  11. Open IMU CSV BufferedWriter on dedicated thread                    │
│  │  12. Stash .session.json sidecar                                        │
│  │  13. Schedule auto-segment cut at +segment_minutes                      │
│  │  14. Start segmentTimer, emit onSegmentStart                            │
│  │  15. resolve(Promise) on first encoded video frame                      │
│  └──────────────────────────────┘                                         │
│                                                                           │
│  Camera2 ──── Surface ────▶ MediaCodec(HEVC) ────┐                        │
│  AudioRecord ──── PCM ────▶ MediaCodec(AAC-LC) ──┤                        │
│                                                  ▼                         │
│                                           BufferInfo + ByteBuffer          │
│                                                  ▼                         │
│                                         FragmentedMp4Muxer                 │
│                                                  ▼                         │
│                                        WritableByteChannel                 │
│                                                  ▼                         │
│                              filesDir/recordings/{base}.mp4               │
│                                                                           │
│  SensorManager ─── SensorEvent.timestamp (REALTIME) ──▶ IMU CSV writer    │
│                                                  ▼                         │
│                              filesDir/recordings/{base}.csv               │
│                                                                           │
│  ┌── Auto-segment cut at +segment_minutes (Kotlin Handler.postDelayed) ──┐ │
│  │   1. Stop camera/encoder/audio/imu writers cleanly                     │ │
│  │   2. Flush + finalize muxer for segment N                              │ │
│  │   3. Sleep 500 ms (the 0.5 s gap)                                      │ │
│  │   4. Allocate segment N+1 (encoder, muxer, csv writer, sidecar)        │ │
│  │   5. emit onSegmentStart for N+1                                       │ │
│  │   6. Hand segment N to FinalizeWorker (separate thread)                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌── FinalizeWorker (concurrent, separate Executor) ─────────────────────┐ │
│  │   1. SHA-256 over .mp4 via FileChannel (read-only)                     │ │
│  │   2. SHA-256 over .csv via FileChannel                                 │ │
│  │   3. Compute drift {max, mean, p99} via residual subtraction           │ │
│  │   4. Compute imu_min_rate_hz_observed_p1                               │ │
│  │   5. Compose metadata JSON merging (sidecar + native-synthesized)      │ │
│  │   6. Atomic write: {base}.json.partial → rename {base}.json            │ │
│  │   7. Delete .session.json sidecar                                      │ │
│  │   8. emit onSegmentComplete                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌── stop() → Promise<void> ──────────────────────────────────────────────┐│
│  │   Same as auto-cut for segment N, then no segment N+1; await finalize  ││
│  │   worker for segment N; stop FGS; emit onSessionStop                   ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌── Mid-record OnThermalStatusChangedListener ≥ THROTTLING_SEVERE ──────┐ │
│  │   1. Schedule graceful stop in 2.5 s on Handler                        │ │
│  │   2. emit onThermalAbort                                               │ │
│  │   3. After 2.5 s: same as stop() but emit onSessionStop after          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘

App-launch:
  MainApplication.onCreate → existing Phase 2 sweep + recordings/ + practice/ sweep
  For each .mp4 without .json:
    if .session.json exists AND .mp4 header parses → re-finalize (drift may be partial)
    else → discard triple
  For each orphan .json (no .mp4): delete
  For each practice/* > 24h old: delete
```

### Recommended Project Structure (additions only — Phase 2 layout already in place)

```
apps/mobile/
├── android/app/src/main/java/ai/humynlabs/capture/
│   ├── capture/                           # NEW — Phase 3 Wave 2
│   │   ├── HumynCaptureModule.kt          # TurboModule entry point
│   │   ├── HumynCapturePackage.kt         # ReactPackage registration
│   │   ├── CaptureSession.kt              # Orchestrator: Camera2 + encoder + muxer + audio + IMU lifecycle for ONE segment
│   │   ├── HevcEncoder.kt                 # MediaCodec HEVC config (mirrors EncoderProbe.kt config)
│   │   ├── AacEncoder.kt                  # MediaCodec AAC-LC config + AudioRecord wrapper
│   │   ├── ImuWriter.kt                   # SensorEventListener + interleaved CSV writer (HandlerThread)
│   │   ├── FragmentedMuxerWrapper.kt      # Thin wrapper around FragmentedMp4Muxer with WritableByteChannel + BufferInfo translation
│   │   ├── DriftCalculator.kt             # idea-brief.md §6.5 residual subtraction
│   │   ├── ImuRateObserver.kt             # imu_min_rate_hz_observed_p1 sliding-window-p1 (planner's call)
│   │   ├── HashStreamer.kt                # Streaming SHA-256 over FileChannel
│   │   ├── MetadataComposer.kt            # video_metadata.json schema_version=1.1.0 writer
│   │   ├── SidecarManager.kt              # .session.json read/write/delete
│   │   ├── FilenameGenerator.kt           # YYYYMMDD_HHMMSS_NNN + per-day sequence recovery
│   │   ├── UlidGenerator.kt               # ULID minter (or use io.azam.ulidj dep)
│   │   ├── SegmentTimer.kt                # Schedule + cancel auto-cut
│   │   ├── ThermalGate.kt                 # PowerManager.getCurrentThermalStatus + listener
│   │   └── FinalizeWorker.kt              # Concurrent worker thread runner (Executor)
│   ├── fgs/                               # NEW — Phase 3 Wave 2
│   │   ├── HumynForegroundService.kt      # camera|microphone|dataSync FGS
│   │   └── HumynForegroundNotification.kt # Low-priority NotificationChannel + ongoing notification
│   └── common/                            # NEW — optional shared util (planner picks per Claude's Discretion)
│       └── BackUltrawidePicker.kt         # Extracted from compat.DeviceCaps for cross-module reuse
│
├── android/app/src/test/java/ai/humynlabs/capture/
│   ├── capture/
│   │   ├── DriftCalculatorTest.kt         # Pure-fn unit tests vs synthetic timestamp arrays
│   │   ├── ImuRateObserverTest.kt         # Sliding-window p1 logic
│   │   ├── FilenameGeneratorTest.kt       # YYYYMMDD_HHMMSS_NNN + collision recovery
│   │   ├── MetadataComposerTest.kt        # Schema 1.1.0 conformance
│   │   ├── SidecarManagerTest.kt          # Round-trip + corrupt-detection
│   │   ├── HashStreamerTest.kt            # Known SHA-256 fixtures
│   │   ├── UlidGeneratorTest.kt           # Format + monotonicity
│   │   └── SegmentTimerTest.kt            # Robolectric Handler-based scheduling
│   └── fgs/
│       └── HumynForegroundServiceTest.kt  # Robolectric: type-bitmask matches manifest
│
├── android/app/src/main/AndroidManifest.xml  # MODIFY — add <service> declaration for HumynForegroundService
├── android/app/build.gradle                  # MODIFY — add androidx.media3:media3-muxer:1.10.0 dependency
├── src/native/HumynCapture.ts                # NEW — typed JS bridge (mirrors HumynCompat.ts pattern)
├── src/native/HumynCapture.types.ts          # NEW — CaptureSessionOpts, event payloads
├── shared/types/src/CaptureSessionOpts.ts    # NEW — Zod schema for start(opts) (cross-validated by tests)
└── __tests__/native/HumynCapture.test.ts     # NEW — JS-side bridge contract test (mock NativeModules)
```

### Pattern 1: Single-clock alignment (the project-killer pattern)

**What:** Every video frame, audio buffer, and IMU sample carries a timestamp in the `SystemClock.elapsedRealtimeNanos` domain. Camera2 puts itself there via `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME` (Phase 2 compat already gates this). IMU samples natively carry `event.timestamp` in this domain. Audio needs explicit translation via `AudioRecord.getTimestamp(AudioTimestamp, AudioRecord.TIMEBASE_MONOTONIC)` — and the AudioTimestamp `nanoTime` field is then in `elapsedRealtimeNanos`.

**When to use:** Every code path that writes a timestamp anywhere in Phase 3.

**Example:**

```kotlin
// Source: idea-brief.md §6.5 + AOSP AudioRecord docs
val audioTimestamp = AudioTimestamp()
audioRecord.getTimestamp(audioTimestamp, AudioTimestamp.TIMEBASE_MONOTONIC)
val audioFrameElapsedRealtimeNs: Long = audioTimestamp.nanoTime
// ^^ this is in the same domain as SensorEvent.timestamp and Camera2 frame timestamps.

// IMU listener (already on this clock by default):
override fun onSensorChanged(event: SensorEvent) {
    val ns: Long = event.timestamp  // SystemClock.elapsedRealtimeNanos domain
    csvWriter.write("$ns,${typeOf(event.sensor)},${event.values[0]},${event.values[1]},${event.values[2]}\n")
}

// Camera2 frame: TotalCaptureResult.get(CaptureResult.SENSOR_TIMESTAMP) returns ns in
// SystemClock.elapsedRealtimeNanos when SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME.
```

**Why it's load-bearing:** ±1 ms clock-domain alignment is the whole project. If audio uses `System.nanoTime()` instead of `AudioTimestamp.TIMEBASE_MONOTONIC`, the per-segment drift methodology silently produces nonsense. [CITED: idea-brief.md §6.5; verified against AOSP AudioRecord docs.]

### Pattern 2: Concurrent finalize (the 0.5 s gap mechanic)

**What:** Segment N+1's encoder + IMU writer + audio recorder are allocated immediately after segment N closes file handles. Segment N's SHA-256 + drift computation + metadata-JSON write run on a separate worker thread that the main capture pipeline never waits on.

**When to use:** D-SEG-03 explicit. The 0.5 s budget cannot accommodate a sequential SHA-256 over a 600 MB MP4 (~0.9 s on Snapdragon 7+).

**Example:**

```kotlin
// Pseudocode for the segment-cut handler
private fun rotateSegment() {
    val segmentN = currentSegment
    closeSegmentResources(segmentN)  // muxer.close(), encoder.stop(), csv.close()

    Thread.sleep(500)  // the 0.5 s silent gap

    val segmentNPlus1 = allocateNewSegment()
    currentSegment = segmentNPlus1
    eventEmitter.emit("onSegmentStart", segmentNPlus1.toEvent())

    finalizeExecutor.submit { finalizeWorker(segmentN) }
}

private fun finalizeWorker(seg: Segment) {
    val mp4Sha = HashStreamer.sha256(seg.mp4File)
    val csvSha = HashStreamer.sha256(seg.csvFile)
    val drift = DriftCalculator.compute(seg.videoTimestamps, seg.imuTimestamps)
    val imuFloor = ImuRateObserver.compute(seg.imuTimestamps)
    val json = MetadataComposer.compose(sidecar = seg.sidecar, mp4Sha, csvSha, drift, imuFloor, ...)
    JsonAtomicWriter.write(seg.jsonFile, json)
    seg.sidecarFile.delete()
    eventEmitter.emit("onSegmentComplete", seg.toCompleteEvent(drift, imuFloor))
}
```

**Why it's load-bearing:** A blocking finalize on the main capture thread would either drop audio/video frames during the rotation or extend the gap to 1.5+ s, making the captured sessions unsuitable for training (multi-segment alignment requires deterministic sub-second gaps).

### Pattern 3: TurboModule + `ReactPackage` + Promise + `NativeEventEmitter`

**What:** Phase 2 already established the shape (`HumynCompatModule.kt` + `HumynCompatPackage.kt` + `apps/mobile/src/native/HumynCompat.ts`). Phase 3 reproduces this exactly for `HumynCapture` and `HumynForegroundService` (the latter has no JS surface; only Kotlin side).

**Example skeleton:**

```kotlin
@ReactModule(name = HumynCaptureModule.NAME)
class HumynCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object { const val NAME = "HumynCapture" }
    override fun getName() = NAME

    private val captureExecutor = Executors.newSingleThreadExecutor()  // serializes start/stop
    private val finalizeExecutor = Executors.newSingleThreadExecutor() // concurrent finalize

    @ReactMethod
    fun start(optsMap: ReadableMap, promise: Promise) {
        captureExecutor.execute {
            try {
                val opts = CaptureSessionOpts.fromBridge(optsMap)
                val session = CaptureSession.start(reactApplicationContext, opts, ::emitEvent)
                promise.resolve(session.toStartResponse())
            } catch (t: Throwable) {
                promise.reject(errorCodeFor(t), t.message ?: "capture_start_failed", t)
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) { /* mirrors start() */ }

    private fun emitEvent(name: String, payload: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, payload)
    }
}
```

[CITED: Phase 2 `HumynCompatModule.kt` lines 31–95 — direct pattern source.]

### Pattern 4: Per-segment `.session.json` sidecar (D-FS-05 crash recovery)

**What:** Stash all JS-provided data + segment timing data into a `.session.json` next to the MP4 at segment-start. Delete it at the moment of final-`.json` write. An orphan sidecar is an unambiguous crash signal that drives app-launch re-finalize.

**Schema:** Documented verbatim in CONTEXT.md `<specifics>` block (taskId, contributor, startGate, location, dfovDegrees, appVersion, isPractice, segment-start timestamp).

**Why it's load-bearing:** Without the sidecar, a mid-segment crash leaves an MP4 + CSV that cannot be finalized (no contributor block, no taskId) and must be discarded. With it, ~95% of mid-segment crashes recoverable.

### Pattern 5: Foreground service type bitmask (CAP-14)

**What:** Manifest declares `<service android:foregroundServiceType="camera|microphone|dataSync">`. Runtime calls `ServiceCompat.startForeground(this, NOTIF_ID, notif, FOREGROUND_SERVICE_TYPE_CAMERA or FOREGROUND_SERVICE_TYPE_MICROPHONE or FOREGROUND_SERVICE_TYPE_DATA_SYNC)`. The two bitmasks (manifest declaration + runtime call) MUST match exactly or Android 14+ throws `MissingForegroundServiceTypeException` and the service crashes.

**Example:** § Code Examples 7.

### Anti-Patterns to Avoid

- **Stock `MediaMuxer` for fragmented MP4** — does NOT support fragmentation despite STACK.md line 191 hinting at "manual fragmentation". The hand-rolled-moov-rewrite path violates CAP-18 (no byte manipulation post-write). Use `FragmentedMp4Muxer` from `androidx.media3:media3-muxer`.
- **JS-side segmentation timer** — D-SEG-01 explicit reject. JS bridge round-trip in the IMU 416 Hz hot path is unacceptable.
- **Mid-record IMU floor reject** — D-IMU-01 explicit reject. Client-side measurement only; server-side filter does the actual rejection.
- **Hand-gate re-run at segment cut** — CAP-10 explicit reject. The `start_gate` block carries forward across all segments in the session.
- **Re-encoding / box-stripping post-finalize** — CAP-18 hard rule. SHA-256 is computed read-only via `FileChannel`; never load the MP4 into memory; never re-mux.
- **Touching battery API** — Phase 4 territory. Phase 3 module never reads `BatteryManager`.
- **Touching Location API** — Phase 4. JS pre-resolves coarse → string, passes via `start(opts)`.
- **Lowering 100 Hz IMU floor to "unblock smoke walk"** — three-times anti-pattern from Phase 2 `.continue-here.md`.
- **Unsynchronized writes to `recordings/`** — multiple files per segment, all rotated together; never partial-write a JSON without the sidecar lifecycle.
- **Reading bytes through the API process** — Phase 1's `init.ts` already comments "API process never reads bytes (CLAUDE.md file-fidelity rule)". Phase 3's metadata JSON ships byte-for-byte to S3 alongside the MP4 + CSV (`PutObjectCommand` for metadata, multipart for the others).

## Don't Hand-Roll

| Problem                                 | Don't Build                                                             | Use Instead                                                                                                                                                              | Why                                                                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fragmented MP4 with periodic moov flush | Hand-rolled ISO BMFF box writer (`mp4parser` port; manual moov-rewrite) | `androidx.media3:media3-muxer` `FragmentedMp4Muxer.Builder().setFragmentDurationMs(30_000)`                                                                              | Weeks of work to reach feature parity; CAP-18 forbids byte manipulation post-write so any sidecar-then-finalize approach is structurally wrong.                                                    |
| HEVC NAL B-frame detection              | New parser                                                              | Phase 2 `NalParser.kt` (already in tree at `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt`)                                             | Already shipping with passing Robolectric tests + ITU-T H.265 §7.4.7.1 conformance. Reuse for optional first-GOP sanity check at session start.                                                    |
| Camera2 ultrawide enumeration           | New picker                                                              | Phase 2 `DeviceCaps.kt` `pickBackUltrawide()` (handles `LOGICAL_MULTI_CAMERA` flattening — Pitfall 5)                                                                    | Already shipped + tested. Planner picks: extract to `ai.humynlabs.capture.common.BackUltrawidePicker` shared util OR have HumynCapture read from `compat.lastResult.v1.checks.ultrawideDfov` MMKV. |
| ULID generation                         | Hand-rolled Crockford base32 + 80-bit randomness                        | `io.azam.ulidj:ulidj:2.0.0` (1 KB jar, 50 LOC)                                                                                                                           | Backend already uses `ulid` 2.3.0 npm; same primitive across boundary; tested against the spec. Hand-rolled is also acceptable (~50 LOC) — planner picks.                                          |
| Streaming SHA-256 over a large file     | Custom MessageDigest loop                                               | `java.security.MessageDigest("SHA-256")` + `FileChannel` `read(ByteBuffer)` loop                                                                                         | Already in JDK; 8 LOC.                                                                                                                                                                             |
| ISO 8601 timestamp formatting           | New formatter                                                           | `java.time.OffsetDateTime.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)`                                                                                                | metadata JSON `start_timestamp` etc. need ISO 8601 with offset; JDK 17 ships this.                                                                                                                 |
| JSON schema enforcement on the device   | Hand-rolled validator                                                   | Compose JSON via Kotlin data class + `kotlinx.serialization.json.Json.encodeToString` (or use `org.json` if no kotlinx-serialization yet — current repo doesn't have it) | Schema 1.1.0 is a small, fixed shape. Planner picks JSON lib. The cross-validation test against `video_metadata.json` lives in `__tests__`.                                                        |
| Foreground service type-bitmask masking | Hand-rolled `startForeground`                                           | `androidx.core.app.ServiceCompat.startForeground(this, id, notif, type)` (in `androidx.core:core-ktx`, already implicit through Phase 2 deps)                            | API-level branching across 26..36 already done by ServiceCompat.                                                                                                                                   |

**Key insight:** Phase 3 looks like a giant "build everything from primitives" phase — 1080p HEVC + IMU + audio + drift + hashing + thermal + FGS — but Phase 2 already proved out 60% of the moving parts. The actual _new_ work for Phase 3 is the muxer choice (1 dep), the threading model around concurrent finalize (planner's call), and the segment-rotation lifecycle. Everything else is "wire the proven Phase 2 patterns into a recording-shaped object."

## Runtime State Inventory

> Phase 3 is greenfield (new module + new files only). No rename / refactor / migration involved.

**Stored data:** None affected. (Phase 5 will start writing to `recordings.qa_status` per-row; Phase 3 just produces the artifact triple on disk.)

**Live service config:** None affected. (Firebase Remote Config gets a new key `capture.segment_minutes` — but it's a new server-side config write, not a rename of an existing key.)

**OS-registered state:** None affected. (`HumynForegroundService` is a NEW service registration in the manifest — not a rename of an existing one. No pm2 / launchd / Task Scheduler equivalents on Android.)

**Secrets and env vars:** None affected. (No new env vars; no secret keys.)

**Build artifacts / installed packages:** None affected. (New `androidx.media3:media3-muxer:1.10.0` dependency — Gradle pulls it on next build; no stale artifact concern.)

**Conclusion:** No runtime-state migration tasks needed. The phase is purely additive code.

## Common Pitfalls

### Pitfall 1: `android.media.MediaMuxer` does NOT support fragmented MP4 — hidden dependency on `androidx.media3:media3-muxer` [CRITICAL]

**Severity:** PROJECT-KILLER (compromises CAP-02 — crash resilience).

**What goes wrong:** Phase 2's `EncoderProbe.kt` uses stock `android.media.MediaMuxer(path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)`. This works for the 5-second probe because the entire MP4 fits in one moov atom written at `muxer.stop()`. Phase 3 needs **fragmented MP4 with periodic `moov` flush every 30 s** so a mid-recording crash leaves a playable file up to the last flush. Stock `android.media.MediaMuxer` has NO API to do this — there is no `setFragmentDurationMs` method, no `flushMoov()` method, no fragmented-output mode.

**Why it happens:** `STACK.md` line 191 says "On Android 33+: muxer.addTrack(...) supports fragmented output natively" — this is **inaccurate**. There is no such API on stock `MediaMuxer`. The fragmented-MP4 capability lives in `androidx.media3.muxer.FragmentedMp4Muxer`, a separate library released as part of Media3 1.5.0 (Jan 2025). The class JavaDoc says verbatim: _"A muxer for creating a fragmented MP4 file."_ with `setFragmentDurationMs(long)` setter (default `2_000` ms; we'll set `30_000` ms). [VERIFIED: github.com/androidx/media source for FragmentedMp4Muxer.java]

**Prevention:**

1. Add `implementation("androidx.media3:media3-muxer:1.10.0")` to `apps/mobile/android/app/build.gradle`.
2. Wrap `FragmentedMp4Muxer.Builder(WritableByteChannel).setFragmentDurationMs(30_000L).build()` in a thin `FragmentedMuxerWrapper.kt` that translates `MediaCodec.BufferInfo` into `androidx.media3.muxer.BufferInfo` (the latter is muxer-specific per Media3 1.5.0 — note 1.6.0 also moved the `Muxer` interface from `media3-transformer` to `media3-muxer`).
3. Verify on Pixel 7a/8a/10a that fragments do indeed land every ~30 s by reading `mfra` boxes via `mp4parser` (test only — never on the production file).

**Warning signs:**

- `MediaMuxer.OutputFormat` is the only constant under `android.media.MediaMuxer`; no fragmented variant exists.
- A 10-min recording crashed at minute 7 produces an unplayable file (no moov atom written).
- `ffprobe -show_format` on a finalized fragmented file reports `Major brand: isom; Compatible brands: isom iso6 mp41` and shows multiple `moof` boxes.

**Phase to address:** Phase 3 Wave 2 plan 1 (the muxer-wrapper task lands first; encoder + audio + IMU bind on top of it).

### Pitfall 2: `SENSOR_INFO_TIMESTAMP_SOURCE != REALTIME` produces nonsense drift metrics

**Severity:** PROJECT-KILLER (any segment from a non-REALTIME device is training-grade-worthless).

**What goes wrong:** `SENSOR_INFO_TIMESTAMP_SOURCE = UNKNOWN` means camera frame timestamps are in a "monotonic" domain (`elapsedRealtimeNanos` minus suspend time). IMU samples are unconditionally in `elapsedRealtimeNanos`. The drift methodology (residual subtraction) silently produces nonsense if the two streams are in different clock domains.

**Why it happens:** Phase 2 compat-check already gates this — DeviceCaps reads `pick.openableChars.get(SENSOR_INFO_TIMESTAMP_SOURCE)` and routes to Compat-fail if it's not REALTIME. But a defense-in-depth check at session start is appropriate because Phase 2 PITFALLS.md Pitfall 2 documents this as field-validated.

**Prevention:** Phase 3 reads the same characteristic at session start; refuse to start with `{code: 'realtime_clock_unavailable', recoverable: false}` if not REALTIME. Should never fire post-compat — but defense-in-depth.

**Warning signs:** Drift `p99_ms` scales with session duration linearly (instead of bounded sub-millisecond residuals).

**Phase to address:** Phase 3 Wave 2 plan 2 (start session pre-flight).

### Pitfall 3: IMU `SENSOR_DELAY_FASTEST` + `maxReportLatency` mask actual sample-rate drops

**Severity:** PROJECT-KILLER for affected segments.

**What goes wrong:** With `maxReportLatency > 0` (batching enabled), the HAL buffers events. The _delivered_ event-cadence in the listener can look fine while the _physical sampling rate_ in the IMU has actually dropped. Counting callbacks per second misses this.

**Why it happens:** Documented in Phase 2 `PITFALLS.md` Pitfall 3 (already addressed in compat — `ImuProbe.kt` runs `maxReportLatency=0`). Phase 3 needs batching for battery, so it runs `maxReportLatency≈200ms`. The `imu_min_rate_hz_observed_p1` calculation at finalize MUST therefore look at _inter-sample interval_ (using `SensorEvent.timestamp` — the physical sample time, not the delivery time), NOT inter-event-callback interval.

**Prevention:**

1. `ImuRateObserver` computes inter-sample intervals from `event.timestamp` (which is the physical sample time, NOT the time of `onSensorChanged`).
2. The "1st percentile of observed rate" uses sliding-window-p1 (1 s windows over the segment) — planner's call per "Claude's Discretion". Recommend 1 s windows: catches sustained drops without triggering on single freak samples.
3. Document the calculation explicitly in `ImuRateObserver.kt` JavaDoc; QA pipeline will consume the figure.

**Warning signs:** All samples arrive in tight bursts (every ~200 ms) with hundreds of samples in each burst — looks like a 0.005 Hz delivery rate but the physical sample rate is fine because `event.timestamp` deltas are still ~2.4 ms.

**Phase to address:** Phase 3 Wave 2 plan 2 (`ImuRateObserver.kt` task).

### Pitfall 4: HDR auto-engages on Pixel 8+ and Galaxy S/A 2024+ despite encoder set to 8-bit

**Severity:** PROJECT-KILLER for affected segments (color-space mismatch).

**What goes wrong:** `CONTROL_SCENE_MODE = DISABLED` does NOT disable Pixel 8+ "HDR Auto". The HAL preselects HDR if the app doesn't _positively_ select SDR via `DynamicRangeProfiles.STANDARD` on `OutputConfiguration`.

**Why it happens:** Documented in Phase 2 `PITFALLS.md` Pitfall 4. Phase 2 compat verifies the surface. Phase 3 reproduces the surface configuration.

**Prevention:** On API 33+, set `outputConfig.setDynamicRangeProfile(DynamicRangeProfiles.STANDARD)` before passing to `cam.createCaptureSession(...)`. Set `CONTROL_VIDEO_STABILIZATION_MODE = OFF` and `LENS_OPTICAL_STABILIZATION_MODE = OFF` on every `CaptureRequest`. Read back `CaptureResult.LENS_OPTICAL_STABILIZATION_MODE` on first frame and bail if not OFF (defense-in-depth — Phase 2 compat already gates).

[VERIFIED: developer.android.com/media/camera/camera2/hdr-video-capture + Phase 2 EncoderProbe.kt readback path lines 188–214]

**Warning signs:** `ffprobe -show_streams` on the finalized MP4 reports `pix_fmt=yuv420p10le` (10-bit) instead of `yuv420p` (8-bit), or `color_transfer=smpte2084` instead of `bt709`.

**Phase to address:** Phase 3 Wave 2 plan 1 (Camera2 `OutputConfiguration` task).

### Pitfall 5: Encoder buffer pool not pre-allocated → frame drops at session start

**Severity:** QUALITY-DEGRADER (segments may have a missing first second).

**What goes wrong:** Allocating MediaCodec input/output buffers lazily during the first 30 frames causes GC pressure that drops frames. `idea-brief.md §6.6` calls this out: "Encoder buffer pool pre-allocated at recording start (avoid mid-record alloc pressure)."

**Why it happens:** MediaCodec's default lazy allocation means the first burst of input buffers triggers `Bitmap`/`ByteBuffer` allocations that compete with the encoder's own internal allocations.

**Prevention:** At session start, after `encoder.start()`, force-warm the buffer pool by dequeuing all input buffers and re-queueing them (no real input). Also pre-allocate the IMU CSV buffered writer's 8 KB write buffer.

**Warning signs:** First-second frame count < 28 in a 30-FPS recording.

**Phase to address:** Phase 3 Wave 2 plan 1.

### Pitfall 6: Foreground-service type bitmask mismatch crashes with `MissingForegroundServiceTypeException`

**Severity:** ANNOYANCE (single-flavor smoke walk catches it; production-blocking but easy to spot).

**What goes wrong:** Manifest declares `foregroundServiceType="camera|microphone|dataSync"` but runtime calls `ServiceCompat.startForeground(this, id, notif, FOREGROUND_SERVICE_TYPE_DATA_SYNC)` — Android 14+ throws because the runtime bitmask is a strict subset, not the full set.

**Why it happens:** Android 14 introduced strict matching of manifest declaration vs runtime bitmask. The two MUST be exactly equal at session start.

**Prevention:** Use a single source of truth — define `private val FGS_TYPE_BITMASK = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or FOREGROUND_SERVICE_TYPE_MICROPHONE or FOREGROUND_SERVICE_TYPE_DATA_SYNC` once in `HumynForegroundService.kt`; manifest is hand-synced (CI catches drift via Phase 2's `verify-merged-manifests.sh` extension).

**Phase to address:** Phase 3 Wave 2 plan 3.

### Pitfall 7: Schema version bump to `1.1.0` breaks Phase 1 backend's strict validation

**Severity:** ANNOYANCE (only affects integration in Phase 5).

**What goes wrong:** Phase 1's `RecordingsInitRequestSchema` and the `metadata.json` PUT object live behind strict Zod validators. Adding `imu_min_rate_hz_observed_p1` to the JSON without adding it to `shared/types/src/recording.ts` causes Phase 5's tests to fail.

**Why it happens:** Phase 5 has not yet shipped a hash-verify worker, but the wire shape is already locked in `RecordingsInitRequestSchema`. The metadata JSON itself is uploaded to S3 directly via a presigned PUT (Phase 1 `init.ts` line 92 — `metadataUrl: z.string().url()`); Phase 1 backend never parses it. The strictness is downstream.

**Prevention:** Phase 3's planner adds `imuMinRateHzObservedP1` to `shared/types/src/recording.ts:RecordingCreateSchema` AND `RecordingsInitRequestSchema` if needed (planner verifies). Schema_version field is just a string in the JSON; Phase 5 will read it.

**Note:** The current schema in `shared/types/src/recording.ts` ALREADY HAS `imuMinRateHzObservedP1: z.number().int().nullable().optional()` (line 33, RecordingCreateSchema). Verified. So this pitfall is already pre-empted at the Phase 1 wire layer; only the metadata-JSON-on-disk shape needs to add it.

**Phase to address:** Phase 3 Wave 2 plan 4.

### Pitfall 8: HEVC encoder silently emits B-frames despite `KEY_LATENCY=1` on certain MediaTek/Exynos parts

**Severity:** PROJECT-KILLER for affected devices.

**What goes wrong:** Phase 2 `PITFALLS.md` Pitfall 1 documents this in detail. `KEY_LATENCY=1` is a hint, not a contract. MediaTek Dimensity 700/900/1080 + Helio class can emit single B-frames under thermal pressure even when `KEY_LATENCY=1` AND `KEY_MAX_B_FRAMES=0` are both set.

**Why it happens:** OEM driver patches re-enable a single B-frame to keep CBR rate-control stable when bitrate-shaper underflows. Pixel 7a/8a/10a (the launch target) run Tensor G3/G5 and honor the flags cleanly — which is why this hides at dev time.

**Prevention:**

1. Phase 2 compat already runs the 5-second NAL parse and rejects devices that emit B-frames under that load.
2. **Optional Phase 3 hardening:** at session start, parse the first GOP via `NalParser` (already in tree) as a sanity check. Stamp `bframe_anomaly: true` into metadata JSON (NEW field — bumps schema OR planner picks to skip the per-recording check trusting compat).

**Recommendation:** SKIP the per-recording NAL parse. Compat already proves the device. Adding it adds CPU load on the segment-cut critical path. Trust compat.

**Phase to address:** Phase 3 Wave 2 plan 1 — confirm compat is the gate; do not add per-segment NAL parse.

## Code Examples

Verified patterns from official sources and Phase 2's already-shipping code.

### Code Example 1: HEVC encoder configuration (mirrors Phase 2 EncoderProbe.kt lines 79–88)

```kotlin
// Source: idea-brief.md §6.2 + STACK.md Configuration Recipe 1 + Phase 2 EncoderProbe.kt
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import android.view.Surface

private fun configureHevcEncoder(): Pair<MediaCodec, Surface> {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, 1920, 1080).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        setInteger(MediaFormat.KEY_BIT_RATE, 8_000_000)
        setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
        setInteger(MediaFormat.KEY_FRAME_RATE, 30)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)  // GOP=30 at 30 FPS
        setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain)
        if (Build.VERSION.SDK_INT >= 24) setInteger(MediaFormat.KEY_LATENCY, 1)
        if (Build.VERSION.SDK_INT >= 25) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
        setInteger(MediaFormat.KEY_PRIORITY, 0)  // realtime
        setInteger(MediaFormat.KEY_OPERATING_RATE, 30)
        setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
        setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
        setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_HEVC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val inputSurface = codec.createInputSurface()
    codec.start()
    return codec to inputSurface
}
```

### Code Example 2: AAC-LC encoder configuration

```kotlin
// Source: idea-brief.md §6.3 + AOSP MediaFormat docs
private fun configureAacEncoder(): MediaCodec {
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 48_000, 1).apply {
        setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
        setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    return codec
}

// AudioRecord setup (UNPROCESSED → VOICE_RECOGNITION fallback)
private fun makeAudioRecord(am: AudioManager): AudioRecord {
    val source = if (am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") {
        MediaRecorder.AudioSource.UNPROCESSED
    } else {
        MediaRecorder.AudioSource.VOICE_RECOGNITION
    }
    val bufSize = AudioRecord.getMinBufferSize(48_000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT) * 4
    return AudioRecord.Builder()
        .setAudioSource(source)
        .setAudioFormat(AudioFormat.Builder()
            .setSampleRate(48_000)
            .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .build())
        .setBufferSizeInBytes(bufSize)
        .build()
}
```

### Code Example 3: IMU writer with interleaved CSV (mirrors Phase 2 ImuProbe.kt pattern)

```kotlin
// Source: idea-brief.md §6.4 + Phase 2 ImuProbe.kt
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import java.io.BufferedWriter
import java.io.FileWriter

class ImuWriter(
    private val ctx: Context,
    csvFile: File,
    private val maxReportLatencyUs: Int = 200_000  // 200 ms — planner's call per Claude's Discretion
) {
    private val csv: BufferedWriter = BufferedWriter(FileWriter(csvFile), 8192)
    private val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val gyro = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) ?: error("no_gyro")
    private val accel = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: error("no_accel")
    private val timestamps = mutableListOf<Long>()  // for drift + p1 calc at finalize
    private val handlerThread = HandlerThread("ImuWriter").apply { start() }
    private val handler = Handler(handlerThread.looper)

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(e: SensorEvent) {
            // Single thread; no synchronization needed because both sensors deliver here.
            val type = if (e.sensor.type == Sensor.TYPE_GYROSCOPE) "gyro" else "accel"
            csv.write("${e.timestamp},$type,${e.values[0]},${e.values[1]},${e.values[2]}\n")
            timestamps.add(e.timestamp)
        }
        override fun onAccuracyChanged(s: Sensor, a: Int) {}
    }

    fun start() {
        sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
        sm.registerListener(listener, accel, SensorManager.SENSOR_DELAY_FASTEST, maxReportLatencyUs, handler)
    }

    fun stop(): List<Long> {
        sm.unregisterListener(listener)
        csv.close()
        handlerThread.quitSafely()
        return timestamps.toList()
    }
}
```

### Code Example 4: Drift residual subtraction (idea-brief.md §6.5)

```kotlin
// Source: idea-brief.md §6.5 verbatim
data class Drift(val maxMs: Double, val meanMs: Double, val p99Ms: Double)

object DriftCalculator {
    fun compute(videoFrameTimestampsNs: LongArray, imuTimestampsNs: LongArray): Drift {
        // 1. Least-squares line through (frameIndex, t_v[i]); residuals r_v[i].
        val rv = residualsFromLeastSquaresFit(videoFrameTimestampsNs)
        // 2. Same for IMU samples; residuals r_s[j] indexed by sample.
        val rs = residualsFromLeastSquaresFit(imuTimestampsNs)
        // 3. For each video frame, linearly interpolate r_s to t_v[i] → r_s_at_v[i].
        val rsAtV = DoubleArray(rv.size) { i ->
            interpolate(imuTimestampsNs, rs, videoFrameTimestampsNs[i])
        }
        // 4. d[i] = r_v[i] - r_s_at_v[i]; convert to ms; absolute value.
        val absD = DoubleArray(rv.size) { i -> kotlin.math.abs(rv[i] - rsAtV[i]) / 1_000_000.0 }
        absD.sort()
        val max = absD.last()
        val mean = absD.sum() / absD.size
        val p99 = absD[(absD.size * 99 / 100).coerceAtMost(absD.size - 1)]
        return Drift(maxMs = max, meanMs = mean, p99Ms = p99)
    }

    private fun residualsFromLeastSquaresFit(values: LongArray): DoubleArray { /* ... */ }
    private fun interpolate(xs: LongArray, ys: DoubleArray, x: Long): Double { /* binary search + lerp */ }
}
```

### Code Example 5: Camera2 capture session with REALTIME timestamp + no-OIS + no-HDR

```kotlin
// Source: Phase 2 EncoderProbe.kt lines 95–155 + STACK.md Configuration Recipe 1
private fun openCaptureSession(
    cam: CameraDevice,
    encoderInputSurface: Surface,
    handler: Handler,
    onResult: (TotalCaptureResult) -> Unit
) {
    val builder = cam.createCaptureRequest(CameraDevice.TEMPLATE_RECORD).apply {
        addTarget(encoderInputSurface)
        set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE, CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF)
        if (Build.VERSION.SDK_INT >= 33) {
            set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF)
        }
        // NB: REALTIME timestamp source is a CameraCharacteristics property (not a request key);
        // gated at compat per Phase 2 DeviceCaps.
    }
    val outputConfig = OutputConfiguration(encoderInputSurface).apply {
        if (Build.VERSION.SDK_INT >= 33) {
            setDynamicRangeProfile(DynamicRangeProfiles.STANDARD)  // forces SDR — Pitfall 4
        }
    }
    val sessionConfig = SessionConfiguration(
        SessionConfiguration.SESSION_REGULAR,
        listOf(outputConfig),
        Executors.newSingleThreadExecutor(),
        object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(session: CameraCaptureSession) {
                session.setRepeatingRequest(builder.build(), object : CameraCaptureSession.CaptureCallback() {
                    override fun onCaptureCompleted(s: CameraCaptureSession, r: CaptureRequest, result: TotalCaptureResult) {
                        onResult(result)
                    }
                }, handler)
            }
            override fun onConfigureFailed(s: CameraCaptureSession) { error("session_config_failed") }
        }
    )
    cam.createCaptureSession(sessionConfig)
}
```

### Code Example 6: Thermal pre-flight + listener

```kotlin
// Source: developer.android.com/games/optimize/adpf/thermal + AOSP PowerManager docs
import android.os.PowerManager
import android.content.Context
import java.util.concurrent.Executors

class ThermalGate(ctx: Context) {
    private val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager

    fun preFlight(): Result<Unit> {
        val status = pm.currentThermalStatus
        return if (status >= PowerManager.THERMAL_STATUS_THROTTLING) {
            Result.failure(ThermalRefuseException(status))
        } else {
            Result.success(Unit)
        }
    }

    fun subscribeMidRecord(onSevere: () -> Unit): AutoCloseable {
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            if (status >= PowerManager.THERMAL_STATUS_SEVERE) onSevere()
        }
        pm.addThermalStatusListener(Executors.newSingleThreadExecutor(), listener)
        return AutoCloseable { pm.removeThermalStatusListener(listener) }
    }
}

class ThermalRefuseException(val currentStatus: Int) : RuntimeException("thermal_throttling")

// Caller — inside HumynCaptureModule.start():
//   thermalGate.preFlight().onFailure { return promise.reject("thermal_throttling", ...) }
//   thermalSubscription = thermalGate.subscribeMidRecord {
//       handler.postDelayed({ stopGracefully() }, 2_500)
//       eventEmitter.emit("onThermalAbort", payload)
//   }
```

### Code Example 7: HumynForegroundService with type bitmask

```kotlin
// Source: STACK.md Configuration Recipe 4 + AOSP foreground-service docs
package ai.humynlabs.capture.fgs

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat

class HumynForegroundService : Service() {
    private var uploadActive = false  // Phase 5 will toggle via setUploadActive()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notif = HumynForegroundNotification.build(this, "Recording in progress")
        ServiceCompat.startForeground(this, NOTIF_ID, notif, FGS_TYPE_RECORDING)
        return START_STICKY
    }

    fun setUploadActive(active: Boolean) {
        uploadActive = active
        // Phase 5: when capture stops + uploadActive=true, this method downgrades to dataSync only.
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIF_ID = 9001
        const val FGS_TYPE_RECORDING =
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    }
}

// Manifest <service> declaration MUST exactly match the runtime bitmask:
// <service android:name=".fgs.HumynForegroundService"
//          android:foregroundServiceType="camera|microphone|dataSync"
//          android:exported="false" />
```

### Code Example 8: Streaming SHA-256 via FileChannel (CAP-15, CAP-18)

```kotlin
// Source: Java standard library; CLAUDE.md "Files never re-encoded" hard rule.
import java.io.File
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.security.MessageDigest

object HashStreamer {
    fun sha256(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        val buf = ByteBuffer.allocate(64 * 1024)
        FileChannel.open(file.toPath()).use { ch ->
            while (true) {
                buf.clear()
                if (ch.read(buf) < 0) break
                buf.flip()
                md.update(buf)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
// Throughput: ~1.5 sec / GB on Snapdragon 7+ per idea-brief.md §6.7
// Critical: read-only via FileChannel — never mmap-write, never re-encode.
```

### Code Example 9: Filename + per-day NNN counter

```kotlin
// Source: idea-brief.md §8.1 + CONTEXT.md D-FS-03
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

object FilenameGenerator {
    private val basePattern = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")

    /**
     * Returns "YYYYMMDD_HHMMSS_NNN" with NNN as the per-day sequence.
     * Recovery strategy = ls-derived (planner picks; alternate = MMKV-backed).
     * `dirs` is ListOf(recordings/, practice/) so today's NNN counts across both.
     */
    fun nextBase(now: LocalDateTime, dirs: List<File>): String {
        val today = now.toLocalDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
        val maxNNN = dirs.flatMap { it.listFiles()?.toList() ?: emptyList() }
            .map { it.nameWithoutExtension }
            .filter { it.startsWith("${today}_") }
            .mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }
            .maxOrNull() ?: 0
        val nnn = "%03d".format(maxNNN + 1)
        return "${now.format(basePattern)}_${nnn}"
    }
}
// Tests must cover: no existing files (NNN=001), 999 limit, midnight rollover,
// MMKV+ls disagreement (ls wins by D-FS-03 wording "self-healing").
```

### Code Example 10: Firebase Remote Config read (Kotlin) for `capture.segment_minutes`

```kotlin
// Source: developer.android.com/docs/remote-config/android/get-started + Phase 2 firebase setup
import com.google.firebase.remoteconfig.FirebaseRemoteConfig

object SegmentDurationConfig {
    private const val KEY = "capture.segment_minutes"
    private const val DEFAULT_MINUTES = 10L

    suspend fun load(): Long {
        val rc = FirebaseRemoteConfig.getInstance()
        // Defaults are set once in MainApplication.onCreate via setDefaultsAsync(mapOf(KEY to DEFAULT_MINUTES))
        // fetchAndActivate is best-effort; Phase 2 already wired the SDK.
        return try {
            rc.fetchAndActivate().await()  // requires kotlinx-coroutines-play-services
            rc.getLong(KEY).takeIf { it > 0 } ?: DEFAULT_MINUTES
        } catch (_: Throwable) {
            DEFAULT_MINUTES
        }
    }
}
```

## State of the Art

| Old Approach                                           | Current Approach                                                  | When Changed             | Impact                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Stock `android.media.MediaMuxer` for fragmented MP4    | `androidx.media3:media3-muxer:FragmentedMp4Muxer`                 | Media3 1.5.0 (Jan 2025)  | Phase 3 must adopt; STACK.md line 191 was inaccurate.            |
| `MediaCodec.BufferInfo` passed to `writeSampleData`    | `androidx.media3.muxer.BufferInfo` (muxer-specific class)         | Media3 1.6.0             | Wrapper must translate.                                          |
| `Muxer` interface in `media3-transformer`              | `androidx.media3.muxer.Muxer`                                     | Media3 1.6.0 → 1.7.0     | Use the new package path.                                        |
| Camera2 HDR-OFF via `CONTROL_SCENE_MODE = DISABLED`    | `OutputConfiguration.setDynamicRangeProfile(STANDARD)` on API 33+ | Android 13 (2022)        | Already the Phase 2 pattern; Phase 3 reproduces.                 |
| `startForeground(id, notif)`                           | `ServiceCompat.startForeground(this, id, notif, typeBitmask)`     | Android 14 strict-mode   | Already in Phase 2 manifest constants; Phase 3 reuses.           |
| `SensorManager.SENSOR_DELAY_FASTEST` callback-counting | Inter-sample interval analysis from `event.timestamp`             | Android 9+ batching docs | Phase 2 PITFALLS.md Pitfall 3; Phase 3 `ImuRateObserver` honors. |

**Deprecated/outdated:**

- STACK.md line 191 ("On Android 33+: muxer.addTrack(...) supports fragmented output natively") — **not accurate**; that capability lives in Media3, not stock MediaMuxer. Planner notes this as a research correction.

## Assumptions Log

| #   | Claim                                                                                                                                                                                 | Section                           | Risk if Wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `setFragmentDurationMs(30_000)` will produce moof boxes at ~30 s intervals on Pixel 7a/8a/10a Tensor encoder pipelines.                                                               | Pitfall 1, Code Example 1         | If the encoder buffers internally past 30 s before emitting samples, fragmentation could land at 35–45 s. **Mitigation:** Wave 2 plan 1 includes a Robolectric-impossible-to-fully-test on-device verification step (run a 60 s recording, parse `moof` box positions via `mp4parser`). [ASSUMED]                                                                                                                                                                                                                                                                                |
| A2  | The 200 ms `maxReportLatency` on IMU produces ≥100 Hz physical sample rate on all locked target devices (Pixel 7a/8a/9, Galaxy S22/23/24, OnePlus Nord 3 5G).                         | Code Example 3                    | Phase 2 compat already verifies the 100 Hz floor at 0 ms latency, but the 200 ms-batched delivery is untested on non-Pixel devices. **Mitigation:** Wave 2 verification on Pixel 10a; Phase 4 thermal walk catches the broader OEM matrix. [ASSUMED]                                                                                                                                                                                                                                                                                                                             |
| A3  | The concurrent-finalize executor's SHA-256 + drift workload completes well under the next segment's 10-min duration.                                                                  | Pattern 2                         | Bound by `idea-brief.md §6.7` ("~1.5 sec/GB on Snapdragon 7+"); a 10-min HEVC at 8 Mbps = ~600 MB → ~0.9 s. Drift compute over 18k frames = trivial. Assumed comfortable margin; if a future spec change increases segment size, recheck. [ASSUMED]                                                                                                                                                                                                                                                                                                                              |
| A4  | `AudioRecord.getTimestamp(ts, TIMEBASE_MONOTONIC)` returns `AudioTimestamp.nanoTime` in the `SystemClock.elapsedRealtimeNanos` domain on all locked target devices.                   | Pattern 1                         | AOSP docs say `TIMEBASE_MONOTONIC` is the clock; some OEMs may stamp differently. **Mitigation:** sanity-check at session start by comparing `audioTimestamp.nanoTime` against `SystemClock.elapsedRealtimeNanos()` — they should be within 1 ms of each other. If not, refuse to start. [ASSUMED — verification step recommended in Wave 2 plan 2]                                                                                                                                                                                                                              |
| A5  | The `imu_min_rate_hz_observed_p1` figure should use 1 s sliding windows (not whole-segment p1).                                                                                       | Claude's Discretion in CONTEXT.md | The QA pipeline (Phase 5) is the actual consumer; until Phase 5's detailed spec lands, the planner picks. Sliding-window is more sensitive to transient drops; whole-segment is more stable. **Recommendation:** sliding-window-1s. Document explicitly so Phase 5 can change the recipe if needed. [ASSUMED]                                                                                                                                                                                                                                                                    |
| A6  | `io.azam.ulidj:ulidj:2.0.0` is a viable Java/Kotlin ULID library for the device side.                                                                                                 | Don't Hand-Roll table             | Verified release date Feb 25, 2026; lightweight (single-class jar). Alternative is hand-rolling 50 LOC. [VERIFIED via Maven Central + GitHub README]                                                                                                                                                                                                                                                                                                                                                                                                                             |
| A7  | `imu_video_drift_*_ms` are integers in `RecordingsInitRequestSchema` — but `idea-brief.md §6.5` and the example `video_metadata.json` carry decimal values like `0.7`, `0.18`, `0.5`. | Pitfall 7                         | The shared-types `recording.ts` line 30–32 says `z.number().int().nullable().optional()`. The metadata JSON on disk carries decimals. **Conflict:** the device-side metadata JSON shape DIFFERS from the wire schema. Planner must reconcile. **Recommendation:** keep the device-side metadata JSON as decimals (verbatim per `video_metadata.json` schema), and update the API wire schema to `z.number()` (drop `.int()`) when Phase 5 wires the upload — OR multiply by 1000 to nanoseconds-as-int on the wire. Flag for Phase 5's planner. [ASSUMED — needs reconciliation] |

## Open Questions

1. **Should `bframe_anomaly` be added to metadata schema as a per-segment field?**

   - What we know: Phase 2 PITFALLS.md Pitfall 1 documents intermittent B-frame leakage on certain MediaTek/Exynos devices.
   - What's unclear: whether Phase 3 should add a per-segment first-GOP NAL parse or trust Phase 2's compat-time gate.
   - Recommendation: SKIP. Compat already gates the device. Adding it bloats the segment-cut critical path. If the QA pipeline starts seeing B-frame anomalies in production, revisit in v2.

2. **MMKV-backed counter vs `ls`-derived for per-day NNN sequence?**

   - What we know: D-FS-03 says counter persists across restarts, recovered from `ls` if MMKV is wiped.
   - What's unclear: which is the primary, which the fallback.
   - Recommendation: `ls`-derived is the authoritative source (self-healing); MMKV is a non-load-bearing optimization for "skip the dir scan if cache is valid." Code Example 9 implements ls-derived only. Planner can add the cache later.

3. **Should the per-segment SHA computation include the `.session.json` sidecar?**

   - What we know: CAP-15 says SHA of MP4 + SHA of CSV. The sidecar is internal.
   - What's unclear: whether sidecar bytes belong in the metadata JSON.
   - Recommendation: NO. Sidecar is a private device-side recovery primitive. It's deleted at finalize before the metadata JSON publishes the SHAs. Schema does not include it.

4. **Does `RecordingsInitRequestSchema.imuVideoDriftMaxMs` `.int()` constraint conflict with decimal-valued drift in the metadata JSON?**
   - What we know: shared-types/recording.ts uses `z.number().int().nullable().optional()`; idea-brief.md §6.5 example values are `0.7`, `0.18`, `0.5`.
   - What's unclear: whether this is a schema bug (should be `z.number()`) or whether drift figures are intended to be int-millis.
   - Recommendation: Flag for Phase 5's planner to fix when the upload pipeline wires the multipart init request. Phase 3's metadata JSON on disk is decimal per the canonical schema in `video_metadata.json` — do not break that for the wire-shape mismatch.

## Environment Availability

| Dependency                                                            | Required By                          | Available                                                                   | Version                                     | Fallback                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pixel 7a or Pixel 10a (development device)                            | Wave 2 on-device verification        | ✓ (Phase 2 smoke ran on Pixel 10a 2026-05-10)                               | —                                           | Pixel 8a per CONTEXT.md                                                                                                            |
| Android 14+ (API 34+)                                                 | FGS strict-mode policy               | ✓                                                                           | minSdk 26; targetSdk 36                     | API 26+ codepath uses `startForeground(id, notif)` without bitmask; Android 14+ uses `ServiceCompat.startForeground(..., bitmask)` |
| Camera2 + HEVC encoder                                                | CAP-01                               | ✓ (Phase 2 compat verifies)                                                 | —                                           | Compat gate fails the device                                                                                                       |
| Gyroscope + accelerometer                                             | CAP-04                               | ✓ (Manifest `<uses-feature required>`)                                      | —                                           | Install-time filter; Phase 2 compat double-checks                                                                                  |
| Firebase Remote Config                                                | D-SEG-01 (`capture.segment_minutes`) | ✓ (`@react-native-firebase/remote-config 24.0.0` already in `package.json`) | 24.0.0                                      | Default `10L` if SDK fails to fetch                                                                                                |
| `androidx.media3:media3-muxer:1.10.0`                                 | CAP-02 fragmented MP4                | ✗ — must be added in Wave 2                                                 | 1.10.0 (latest stable; released 2026-03-26) | None — this is the only viable library                                                                                             |
| `io.azam.ulidj:ulidj:2.0.0` (optional)                                | per-segment ULID                     | ✗ — planner picks add-vs-handroll                                           | 2.0.0                                       | Hand-roll Crockford base32 + ms-time + 80-bit randomness, ~50 LOC                                                                  |
| Robolectric                                                           | Wave 2 unit tests                    | ✓ (Phase 2 already wired in `apps/mobile/android/app/src/test/`)            | matches Phase 2 pin                         | —                                                                                                                                  |
| Vitest + jsdom                                                        | JS bridge contract tests             | ✓ (Phase 2 already wired)                                                   | 4.1.5                                       | —                                                                                                                                  |
| `mp4parser` (test-only, for verifying `moof` boxes appear every 30 s) | Wave 2 on-device verification        | ✗ — optional test-only dep if planner wants it                              | latest                                      | `ffprobe -show_format` + manual inspection on the smoke walk                                                                       |

**Missing dependencies with no fallback:**

- `androidx.media3:media3-muxer:1.10.0` — must be added; only viable fragmented MP4 library.

**Missing dependencies with fallback:**

- `io.azam.ulidj:ulidj:2.0.0` — hand-roll a tiny ULID generator if planner prefers no new dep.
- `mp4parser` — only test-only; planner can use ffprobe at smoke-walk time.

## Validation Architecture

### Test Framework

| Property                   | Value                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Framework (JS)             | Vitest 4.1.5 + jsdom (already wired at `apps/mobile/vitest.config.ts` + `vitest.setup.ts`)                      |
| Framework (Kotlin)         | Robolectric (already wired at `apps/mobile/android/app/src/test/`)                                              |
| Config files               | `apps/mobile/vitest.config.ts`; `apps/mobile/android/app/build.gradle` (Robolectric block)                      |
| Quick run command (JS)     | `cd apps/mobile && npm test -- --run __tests__/native/HumynCapture.test.ts`                                     |
| Quick run command (Kotlin) | `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.*"` |
| Full mobile suite          | `cd apps/mobile && npm test && cd android && ./gradlew :app:testApkRolloutDebugUnitTest`                        |

### Phase Requirements → Test Map

| Req ID        | Behavior                                                                                                                     | Test Type                                                                                                                | Automated Command                                                                                      | File Exists?                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| CAP-01        | HEVC encoder MediaFormat keys produce zero-B-frame Annex B                                                                   | unit (Kotlin) — config audit + reuse Phase 2 NalParserTest fixtures                                                      | `./gradlew testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.HevcEncoderConfigTest"`   | ❌ Wave 0 (Wave 2 plan 1 task 2 creates) |
| CAP-02        | Fragmented MP4 with moof boxes every ~30 s                                                                                   | integration (manual) — record 60 s, parse with mp4parser                                                                 | manual smoke walk on Pixel 10a (Phase 4 will own broader fleet)                                        | ❌ Wave 0 (manual smoke runbook)         |
| CAP-03        | AAC-LC encoder MediaFormat keys, 48 kHz mono 128 kbps                                                                        | unit (Kotlin) — config audit                                                                                             | `./gradlew testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.AacEncoderConfigTest"`    | ❌ Wave 0                                |
| CAP-04        | IMU listener at FASTEST + maxReportLatency batches without rate drop                                                         | unit (Kotlin pure-fn over synthetic timestamps) — `ImuWriterRateTest`                                                    | `./gradlew testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ImuWriterRateTest"`       | ❌ Wave 0                                |
| CAP-05        | CSV writer emits correct columns + interleaving                                                                              | unit (Kotlin) — `ImuWriterCsvFormatTest`                                                                                 | `./gradlew testApkRolloutDebugUnitTest --tests "ai.humynlabs.capture.capture.ImuWriterCsvFormatTest"`  | ❌ Wave 0                                |
| CAP-06        | Single-clock domain across video / audio / IMU                                                                               | unit (Kotlin) — `ClockAlignmentTest` (sanity: AudioTimestamp.nanoTime ≈ SystemClock.elapsedRealtimeNanos)                | `./gradlew testApkRolloutDebugUnitTest --tests "*.ClockAlignmentTest"`                                 | ❌ Wave 0                                |
| CAP-07        | REALTIME timestamp source check refuses non-REALTIME devices                                                                 | unit (Kotlin Robolectric) — `RealtimeGateTest` mocking CameraCharacteristics                                             | `./gradlew testApkRolloutDebugUnitTest --tests "*.RealtimeGateTest"`                                   | ❌ Wave 0                                |
| CAP-08        | Drift `{max, mean, p99}` from synthetic timestamp arrays                                                                     | unit (Kotlin pure-fn) — `DriftCalculatorTest`                                                                            | `./gradlew testApkRolloutDebugUnitTest --tests "*.DriftCalculatorTest"`                                | ❌ Wave 0                                |
| CAP-09        | 10-min auto-segment timer + 0.5 s gap; ULID + filename per segment                                                           | unit (Kotlin Robolectric Handler-fake-timer) — `SegmentTimerTest` + `FilenameGeneratorTest`                              | `./gradlew testApkRolloutDebugUnitTest --tests "*.SegmentTimerTest" --tests "*.FilenameGeneratorTest"` | ❌ Wave 0                                |
| CAP-10        | start_gate carries forward across segments                                                                                   | unit (Kotlin) — `StartGateCarryoverTest` checks sidecar+metadata                                                         | `./gradlew testApkRolloutDebugUnitTest --tests "*.StartGateCarryoverTest"`                             | ❌ Wave 0                                |
| CAP-11        | Pre-record refuses on `≥ THROTTLING`                                                                                         | unit (Kotlin Robolectric) — `ThermalGatePreFlightTest` mocking PowerManager                                              | `./gradlew testApkRolloutDebugUnitTest --tests "*.ThermalGatePreFlightTest"`                           | ❌ Wave 0                                |
| CAP-12        | Mid-record `≥ THROTTLING_SEVERE` schedules 2.5 s graceful stop                                                               | unit (Kotlin) — `ThermalGateMidRecordTest`                                                                               | `./gradlew testApkRolloutDebugUnitTest --tests "*.ThermalGateMidRecordTest"`                           | ❌ Wave 0                                |
| CAP-13        | onSessionStart / onSessionStop events emit                                                                                   | unit (Kotlin Robolectric) — `EventEmissionTest`                                                                          | `./gradlew testApkRolloutDebugUnitTest --tests "*.EventEmissionTest"`                                  | ❌ Wave 0                                |
| CAP-14        | FGS type bitmask matches manifest declaration                                                                                | unit (Kotlin Robolectric) — `HumynForegroundServiceTest`                                                                 | `./gradlew testApkRolloutDebugUnitTest --tests "*.HumynForegroundServiceTest"`                         | ❌ Wave 0                                |
| CAP-15        | SHA-256 of fixed test fixtures matches expected hex                                                                          | unit (Kotlin) — `HashStreamerTest` over hevc-fixtures + a CSV fixture                                                    | `./gradlew testApkRolloutDebugUnitTest --tests "*.HashStreamerTest"`                                   | ❌ Wave 0                                |
| CAP-16        | Metadata JSON conforms to schema 1.1.0                                                                                       | unit (Kotlin or Vitest cross-validation) — `MetadataSchemaConformanceTest` against `video_metadata.json` template        | `./gradlew testApkRolloutDebugUnitTest --tests "*.MetadataSchemaConformanceTest"`                      | ❌ Wave 0                                |
| CAP-17        | Filename format + per-day NNN counter + ls-derived recovery                                                                  | unit (Kotlin pure-fn) — `FilenameGeneratorTest`                                                                          | (already listed above)                                                                                 | (already listed above)                   |
| CAP-18        | Files are never re-encoded — bytes verifiable from device-write to S3 (Phase 5 mediates; Phase 3 unit-checks SHA invariance) | unit (Kotlin) — `FileFidelityTest` — write fixture, compute SHA, simulate stop+restart of finalize, ensure SHA unchanged | `./gradlew testApkRolloutDebugUnitTest --tests "*.FileFidelityTest"`                                   | ❌ Wave 0                                |
| CAP-19        | `imu_min_rate_hz_observed_p1` over synthetic IMU timestamp burst                                                             | unit (Kotlin pure-fn) — `ImuRateObserverTest`                                                                            | `./gradlew testApkRolloutDebugUnitTest --tests "*.ImuRateObserverTest"`                                | ❌ Wave 0                                |
| (JS bridge)   | start/stop Promise + event emitter contract (mock NativeModules)                                                             | unit (Vitest) — `__tests__/native/HumynCapture.test.ts`                                                                  | `npm test -- --run __tests__/native/HumynCapture.test.ts`                                              | ❌ Wave 0                                |
| (Wave 1 only) | Phase 2 cosmetic-fixup visual regressions                                                                                    | unit (Vitest + jest-image-snapshot) — `__tests__/visual/*.test.tsx`                                                      | `npm test -- --run __tests__/visual`                                                                   | ❌ Wave 0 (D-WAVE-06 plan creates)       |

### Sampling Rate

- **Per task commit:** Run targeted Kotlin test class for the touched file (`./gradlew testApkRolloutDebugUnitTest --tests "*.${ClassName}Test"`) + `npm test --run` for any TS file touched. <30 seconds in all cases.
- **Per wave merge:** Full mobile suite — `cd apps/mobile && npm test && cd android && ./gradlew :app:testApkRolloutDebugUnitTest`.
- **Phase gate:** Full suite green + Wave 1 on-device re-walk + (Phase 4 takes over for full E2E HEVC verification — Phase 3 acceptance per CONTEXT.md is module-ready + unit tests + JS bridge contract).

### Wave 0 Gaps

Phase 3 introduces an entirely new domain (`ai.humynlabs.capture.capture/`) and shares Phase 2's existing test infrastructure. The following test files are missing and MUST be created in the early plans (Wave 2 plan 1 wires them all):

- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/DriftCalculatorTest.kt` — covers CAP-08
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuRateObserverTest.kt` — covers CAP-19
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt` — covers CAP-17
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataSchemaConformanceTest.kt` — covers CAP-16
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HashStreamerTest.kt` — covers CAP-15
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SidecarManagerTest.kt` — covers D-FS-05 round-trip
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/UlidGeneratorTest.kt` — covers ULID format + monotonicity
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/SegmentTimerTest.kt` — covers CAP-09 timer + gap (Robolectric Handler fake-timer)
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ThermalGateTest.kt` — covers CAP-11/CAP-12 (Robolectric PowerManager mock)
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/HevcEncoderConfigTest.kt` — covers CAP-01 MediaFormat audit (pure-fn over the produced format object; reuse Phase 2 fixtures)
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/AacEncoderConfigTest.kt` — covers CAP-03
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/ImuWriterCsvFormatTest.kt` — covers CAP-05
- [ ] `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/fgs/HumynForegroundServiceTest.kt` — covers CAP-14
- [ ] `apps/mobile/__tests__/native/HumynCapture.test.ts` — covers JS bridge contract (mock NativeModules)
- [ ] `apps/mobile/__tests__/visual/*.test.tsx` (Wave 1 only) — covers cosmetic gaps per D-WAVE-06
- [ ] `apps/mobile/__tests__/visual/__image_snapshots__/` directory — D-WAVE-06 PNG baselines

**Framework install:** None (test infra already in place from Phase 2). New deps for Wave 1 only: `jest-image-snapshot` per D-WAVE-06.

## Security Domain

> Phase 3 is a device-local capture pipeline with no auth, no network IO (Phase 5 handles upload), no user-input rendering. The relevant ASVS surface is narrow.

### Applicable ASVS Categories

| ASVS Category                    | Applies       | Standard Control                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication                | no            | (Phase 1 + Phase 2 territory; Phase 3 module is invoked only after authenticated session.)                                                                                                                                                                                                                                                                  |
| V3 Session Management            | no            | (No session state in this module.)                                                                                                                                                                                                                                                                                                                          |
| V4 Access Control                | partial       | The module is registered as a `ReactPackage` so any JS code in the app can call it. JS-side exposure is by intent; no RCE surface.                                                                                                                                                                                                                          |
| V5 Input Validation              | yes           | `start(opts: CaptureSessionOpts)` MUST validate the bridge map: required fields present, ULIDs match length-26 format, `consent === true`, `dfovDegrees > 0`, `appVersion` matches semver. Use a Kotlin data-class + manual validation OR cross-validate against `shared/types/src/CaptureSessionOpts.ts` Zod schema on the JS side BEFORE the bridge call. |
| V6 Cryptography                  | yes (passive) | SHA-256 via `java.security.MessageDigest` (FIPS-140-validated provider on Android). Never roll our own hash.                                                                                                                                                                                                                                                |
| V8 Data Protection               | yes           | Files written to `context.filesDir/recordings/` and `context.filesDir/practice/` are app-private (Linux UID-scoped). Never use `getExternalFilesDir` (world-readable on older API levels). Practice files older than 24 h are deleted by app-launch sweep. Verified-and-uploaded files deleted by Phase 5's reconciliation sweep.                           |
| V9 Communications                | no            | No network IO in Phase 3.                                                                                                                                                                                                                                                                                                                                   |
| V12 API and Web Service Security | no            | No HTTP surface.                                                                                                                                                                                                                                                                                                                                            |

### Known Threat Patterns for Camera2 + RN module stack

| Pattern                                                                                                                                 | STRIDE                 | Standard Mitigation                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Malicious JS calls `start({contributor: { consent: false }})` and bypasses consent in the metadata JSON                                 | Tampering              | Manual validation in `CaptureSessionOpts.fromBridge` rejects with `consent_invalid` error. Also: Phase 2's `appStore.user.consent` is the upstream source; JS layer must NOT pass user-typed consent values. |
| Crash leaves `.session.json` with PII (contributor name/email) on disk indefinitely                                                     | Information disclosure | App-launch sweep catches orphans within one cold boot. Sidecar lives in `filesDir/` (app-private). On uninstall, all files removed by OS.                                                                    |
| `recordings/*` directory grows unbounded after Phase 5 fails to delete-on-`verified`                                                    | Repudiation / DoS      | Phase 5 owns reconciliation; Phase 3 explicitly does NOT touch verified-but-undeleted files (per CONTEXT.md). Phase 3 only deletes practice/\* > 24 h.                                                       |
| Permission revocation mid-record (user revokes Camera in Settings)                                                                      | DoS                    | Camera2 throws `CameraAccessException` on next request → caught + emit `onError({code: 'permission_revoked', recoverable: false})` → finalize segment best-effort.                                           |
| Foreground service downgrade race condition (Phase 3 stops service while Phase 5 calls `setUploadActive(true)` from a different thread) | Race condition         | Single-thread `setUploadActive` updates an `AtomicBoolean`; FGS lifecycle decisions read the boolean serialized through the service's `Handler`. Phase 5's planner must verify.                              |
| Path traversal via `filenameBase` injection (if JS could control filename)                                                              | Tampering              | Phase 3 generates filename natively (D-FS-03). JS never provides filename.                                                                                                                                   |
| Storage exhaustion DoS — capture writes until `IOException`                                                                             | DoS                    | Phase 4 owns pre-flight free-space check (out of Phase 3 scope per CONTEXT.md). Phase 3 surfaces `IOException` as `onError({code: 'storage_full', recoverable: false})`.                                     |

## Sources

### Primary (HIGH confidence)

- **Phase 2 source code** — `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/{EncoderProbe.kt,ImuProbe.kt,NalParser.kt,DeviceCaps.kt,HumynCompatModule.kt,HumynCompatPackage.kt}` — pattern source.
- **Phase 1 backend** — `apps/api/src/routes/recordings/{init.ts,schemas.ts}` + `shared/types/src/recording.ts` for wire-shape contract.
- **`idea-brief.md`** §2.1, §6.1–§6.7, §8.1–§8.3, §10 — capture-spec source-of-truth.
- **`engineering-handoff.md`** §4.3, §5, §6.3 — Native APIs + state machine + speech.
- **`video_metadata.json`** (repo root) — canonical metadata schema.
- **`.planning/research/STACK.md`** — version pins, encoder recipe, FGS recipe, OEM matrix.
- **`.planning/research/PITFALLS.md`** — Pitfalls 1–4 (B-frames, REALTIME clock, IMU rate, HDR).
- **`.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md` + `02-PATTERNS.md`** — established native-module pattern.
- **CLAUDE.md** project instructions — capture pipeline + file fidelity hard rules.

### Secondary (MEDIUM-HIGH confidence — verified in this research)

- [androidx.media3 release page](https://developer.android.com/jetpack/androidx/releases/media3) — Media3 1.10.0 latest stable, released 2026-03-26.
- [androidx/media GitHub source for FragmentedMp4Muxer.java](https://github.com/androidx/media/blob/release/libraries/muxer/src/main/java/androidx/media3/muxer/FragmentedMp4Muxer.java) — `setFragmentDurationMs(long)` setter and Builder pattern verified.
- [Android Developers Blog: Media3 1.5.0](https://android-developers.googleblog.com/2025/01/media3-150-whats-new.html) — fragmented MP4 + B-frame + edit list support release notes.
- [Android Developers — Foreground service types are required (Android 14)](https://developer.android.com/about/versions/14/changes/fgs-types-required) — `MissingForegroundServiceTypeException` semantics.
- [Android Developers — Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types) — `camera | microphone | dataSync` combination policy.
- [Android Developers — PowerManager.OnThermalStatusChangedListener](https://developer.android.com/reference/android/os/PowerManager.OnThermalStatusChangedListener) — listener API.
- [Android Developers — DynamicRangeProfiles + HDR video capture](https://developer.android.com/media/camera/camera2/hdr-video-capture) — STANDARD profile setup.
- [AOSP source/audio/implement-pre-processing](https://source.android.com/docs/core/audio/implement-pre-processing) — UNPROCESSED + VOICE_RECOGNITION audio source AGC behavior.
- [Firebase Remote Config Android KTX docs](https://firebase.google.com/docs/remote-config/android/get-started) — `getLong()` + `fetchAndActivate()`.
- [io.azam.ulidj on Maven Central](https://mvnrepository.com/artifact/io.azam.ulidj/ulidj) — Java/Kotlin ULID generator at 2.0.0 (released 2026-02-25).
- [GitHub issue androidx/media#1706](https://github.com/androidx/media/issues/1706) — `FragmentedMp4Muxer.writeSampleData` CPU spike under continuous load (informational; closed without specific resolution).

### Tertiary (LOW confidence — flagged for verification at plan time)

- The exact `setFragmentDurationMs` value of 30_000 ms producing moof boxes at exactly 30 s on Tensor encoder — needs on-device verification.
- The 200 ms `maxReportLatency` value on IMU producing physical sample rate ≥ 100 Hz on the full OEM matrix (Pixel 7a/8a/9, Galaxy S22/23/24, OnePlus Nord 3 5G) — Phase 4 thermal walk territory.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Phase 2 already proves out 60% of the moving parts; Media3 muxer is the only new dep and is documented in detail.
- Architecture: HIGH — locked by CONTEXT.md D-API/D-SEG/D-FS/D-IMU/D-FGS/D-THERM blocks; threading model is the only Claude's-Discretion item.
- Pitfalls: HIGH for the documented Phase 2 pitfalls + the Media3 muxer trap; MEDIUM for the audio source mode + finalize-on-trailing-edge edge cases.

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 for stable items (encoder, FGS, thermal, IMU); 2026-05-25 for the Media3 muxer pin (fast-moving release cadence — re-verify version on plan-cut day).
