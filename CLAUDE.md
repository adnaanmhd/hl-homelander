<!-- GSD:project-start source:PROJECT.md -->

## Project

**Homelander** — codename for **Humyn Labs Capture**. Android-first React Native app that records strict-spec egocentric (head-mounted) video + IMU streams of everyday tasks. Captured data trains physical/embodied AI (VLA/VLN, humanoid robotics). Brand: _Real Humyns. Real Intelligence._ MVP ships as a signed APK direct to users in India + Brazil, ages 18–35, on ₹30K+ phones. (Play Store and iOS App Store channels are deferred to a follow-on milestone — see the descope banner below.)

**Core Value — capture quality is non-negotiable.** Every uploaded segment: 1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz. Video↔IMU drift (`imu_video_drift_{max,mean,p99}_ms`) is **measured and recorded** in every segment's metadata — the original ±1 ms gate is relaxed (see the drift banner below). If 1080p/30/≥110°/≥100 Hz slips, the project fails.

> **±1 ms drift gate relaxed 2026-05-12.** The LOCKED spec (`idea-brief.md` §2.1) calls for ±1 ms video↔IMU timestamp alignment. On the Phase-4 capture path the HEVC stream records on the **ultrawide** physical sub-camera via `CONTROL_ZOOM_RATIO` (required to actually hit ≥110° dFOV instead of streaming the ~83° main wide) — the ultrawide's heavy distortion-correction / fusion pipeline regresses drift to ~1.7–6.2 ms (a clean 10-min gate-pass segment: max 6.16 / mean 5.58 / p99 5.63 ms). **Owner decision: keep computing & recording the three drift figures in every segment's metadata as fleet-health telemetry; do NOT gate Phase completion / smoke sign-off / finalization / uploads on them; do NOT change the ultrawide lens code.** `idea-brief.md` §2.1 and `.planning/REQUIREMENTS.md` still state ±1 ms — not edited; revisit in a dedicated pass if the spec docs should be aligned. Full write-up + mitigation options if ever revisited: `ULTRAWIDE-DRIFT-FINDINGS.md` (repo root). Trail: debug session `.planning/debug/handgate-never-passes.md` (Stage 2), `04-MANUAL-SMOKE.md` §5b.

> **Capture-quality cancel gate added 2026-05-17.** Finalize-time enforcement of the LOCKED capture spec. `FinalizeWorker` cancels segments with `mean_fps < 29` (`fps_dropped`; threshold tightened from 28 → 29 the same day after the Pixel-10a + Pixel-8a cancel-walk — both devices stamped ~30 fps clean on healthy recordings, so 29.0 catches genuine drops without flagging measurement noise around the LOCKED 30 fps target), MP4 track-header `width < 1920 OR height < 1080` (`resolution_dropped`), or `videoFrameTimestamps.size < 2` (`insufficient_frames`); the cancel happens AFTER the encoder finishes, not as a live abort. Canceled segments NEVER enter the upload queue and render as non-retryable History rows on the existing chip-failed visual with reason-specific copy ("Canceled — frame rate dropped" / "Canceled — resolution dropped" / "Canceled — recording too short"); the MP4 + IMU CSV + JSON are deleted from cacheDir after the History ledger entry is persisted (write-then-delete). The server is not notified (local-only). `MetadataComposer.compose()` no longer carries hardcoded spec literals — every spec-relevant field (`fps` / `resolution` / `video_codec` / `video_profile` / `bitrate_bps` / `bitrate_mode` / `gop` / `color_space` / `color_depth_bits` / `b_frames` / `orientation`) is derived from the encoder's `OUTPUT_FORMAT_CHANGED` MediaFormat + MediaExtractor track-header read + measured surface rotation; `hdr` + `image_stabilization` stay configured-literal with a cite to the EncoderProbe compat-check truth-source. EncoderProbe tightened to verify 1920×1080 surface deliverability (not just codec presence). The relaxed ±1 ms drift gate is unchanged — this banner ADDS fps + resolution gates, it does not touch drift. `idea-brief.md` §2.1 is unchanged (the spec didn't drift; this is enforcement). Android only — iOS native modules deferred. Full trail: `.planning/quick/260517-p5g-capture-spec-enforcement-metadata-truthf/`, `.planning/REQUIREMENTS.md` §v1 (CAPTURE-QA-01..06).

> **Calibration + filename-prefix added 2026-05-22 (metadata schema 1.2.0).** Purely additive — does NOT touch the drift gates / capture spec / the ultrawide lens code / the fps+resolution cancel gates. Three additions: (1) **ULID filename prefix** — on-device artifacts are now `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}` (video/imu/metadata/sidecar); `FilenameGenerator.nextBase`'s per-day NNN ls-scan strips a leading 26-char ULID prefix before parsing (backward-compatible with legacy un-prefixed files). **S3 object keys are UNCHANGED** — still literally `video.mp4` / `imu.csv` / `metadata.json` under `recordings/{userId}/{recordingId}/` (the key is derived from `recordingKeys()`, never the local filename). (2) **Live-Camera2 camera intrinsics** — a NEW top-level `calibration.camera` block in `metadata.json` (model / resolution / params{fx,fy,cx,cy,skew} / distortion*coeffs / intrinsics_source) read from the **ultrawide physical sub-camera's** `CameraCharacteristics` (the lens HumynCapture records on). Null-fallback contract: when the device reports UNCALIBRATED (common on Pixels) the params are null + `intrinsics_source = "camera2_uncalibrated"` — the block is ALWAYS present with the full key structure, the `CameraCalibrationReader` never throws and never blocks capture. (3) **Cam-IMU offset (temporal + spatial)** — `calibration.cam_imu_extrinsics` (T_cam_imu / T_imu_cam / T_cam_imu_translation_mm from `LENS_POSE*\*`; timeshift default 0.0 + clock-sync note from `SENSOR*INFO_TIMESTAMP_SOURCE`; null + `extrinsics_source = "camera2_no_imu_reference"`when`LENS_POSE_REFERENCE != GYROSCOPE`). Mirrors the SPC2 reference rig's `meta.json`. The existing `imu_video_drift*{max,mean,p99}\_ms`fields are untouched. Backend: a nullable`recordings.calibration jsonb`column +`/recordings/init`validates (zod, null params tolerated) + persists it on the new-row INSERT; the hash-verify worker is unaffected (it re-hashes MP4 + IMU CSV only, never`metadata.json`). Genuine non-null intrinsics/extrinsics VALUES exist only on real Pixel hardware whose ultrawide reports a factory calibration — JVM/CI verifies only the null-fallback path + key structure + the pure math helpers (on-device value verification is a manual smoke item). Android only — iOS `HumynCaptureIOS`analogues stay deferred.`idea-brief.md`§2.1 unchanged (no spec values changed). Full trail:`.planning/quick/260522-elm-add-camera-intrinsics-cam-imu-offset-cal/`, `.planning/REQUIREMENTS.md`§v1 (CAPTURE-QA-07..09),`DATA-MODEL.md` §4.

> **Upload verification + ALL hashing removed 2026-06-04 (Enh 3 / D1; owner sign-off `.planning/260604-locked-override-signoff.md`).** The server hash-verify worker **and** the device-side SHA-256 of `video.mp4` + `imu.csv` are gone. `metadata.json` drops `file_sha256` / `imu_sha256` (schema 1.3.0 → **1.4.0**); `/recordings/init` no longer accepts them; `recordings` drops `file_sha256` / `imu_sha256` / `verified_at`, and migration 0011 drops the `recordings_to_verify` + `recording_events_outbox` tables + the `recording_event_type` enum. **`uploaded` is now terminal success** — the device deletes its local MP4/CSV/JSON on a `/finalize` 200 (no longer on a server `verified` event). The `qa_status` enum keeps its legacy `verified` / `hash-mismatch` values (Postgres can't cheaply drop enum values) but **nothing writes them**; read paths treat `verified` as a success synonym for `uploaded`. The BullMQ/Redis/SQS/EventBridge verify infra — and the `bullmq` / `ioredis` / `@aws-sdk/client-sqs` deps, the `redis` dev container, and the `verify-queue` + `redis` Terraform modules — are dead (reaped as a fast-follow). ⚠ **KEEP `AppFlavorModule.sha256First16Hex`** — the compat-signature device fingerprint (`compatSignature.ts`), unrelated to upload verification. Trail: `IMPLEMENTATION-PLAN-260604.md` §6.

> **3-minute per-segment minimum added 2026-06-04 (Bug 8 + Enh 1 / D6).** `FinalizeWorker` adds a `too_short` cancel reason (`durationMs < 180_000`, non-practice) alongside the existing fps/resolution/insufficient-frames gates — dropped segments are never enqueued and render as non-retryable "Canceled — recording too short" History rows (the whole-recording case also surfaces the "Recording too short — discarded" toast). A ≥3-min recording that auto-segments at the 10-min cap and leaves a trailing <3-min segment **drops that trailing segment** (minor tail-data loss accepted, per sign-off D6). Enforcement only — `idea-brief.md §2.1` capture-spec values are unchanged. Extends the 2026-05-17 cancel-gate model above.

> **Single-device, newest-login-wins 2026-06-04 (Bug 4 / D2) — overrides LOCKED `D-AUTH-03`** (stateless 30-day JWT, no denylist; `.planning/phases/01-foundation-backend-distribution-recon/01-CONTEXT.md`). The minted JWT now carries `installationId`; `users.current_installation_id` holds the most-recent sign-in's id; `requireAuth` 401s (client slug `device-evicted`) any JWT whose `installationId` diverges, via a per-request LRU `sub → current_installation_id` lookup (60 s TTL). A reinstall on the same phone rotates the installation id → a new device that evicts the prior session (accepted). Legacy no-claim JWTs are forced to re-sign-in once. Auth is now stateful (one cached lookup/request). Owner sign-off `.planning/260604-locked-override-signoff.md` D2.

> **Precise GPS location SHIPPED 2026-06-04 (Bug 3 / D3) — overrides the formerly-LOCKED coarse-only constraint.** Precise lat/lng capture (metadata schema **1.5.0**: `capture_device_info.location` → `{ lat, lng, accuracy_m, provider, captured_at, label }`; `ACCESS_FINE_LOCATION`; `recordings.location jsonb`; onboarding permission gate D4 — full denial blocks, partial COARSE grant still records). The **consent text was updated** ("approximate location" → "precise location (GPS coordinates)") across the client modal (`TermsOfUseModal.tsx`) + `en.json` + the server `CONSENT_TEXT` (boot-guard SHA regenerated via `pnpm --filter @humyn/api legal:hash`), and the **consent version bumped `1.0.0` → `1.1.0`** — forcing every existing user to re-accept on next launch. The owner **waived the prior consent/DPIA review gate** (2026-06-04, via execution checkpoint). Trail: `.planning/260604-bug3-precise-location-consent-dpia.md`, `.planning/260604-locked-override-signoff.md` D3.

> **Audio dropped 2026-05-11.** Original spec included 48 kHz mono AAC-LC. Phase 3 smoke on Pixel 10a showed audio-pump CPU contention pushed `imu_video_drift_{mean,p99}_ms` from ~1.8/2.1 ms to ~5.5/5.8 ms — outside the then-active ±1 ms gate. Audio dropped; training pipeline consumes video + IMU only. Post-unwire smoke 7: drift mean 0.594 ms / p99 0.728 ms. Trail: `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3 + commits `a1ab0ea` (unwire), `1a3e039` (closure). Audio stays dropped (the drift gate's relaxation 2026-05-12 doesn't reopen it — re-introducing audio is its own decision, and would still need fresh on-hardware drift evidence).

> **MVP descoped 2026-05-11.** (1) **Semantic search dropped from the MVP client surface** — the `ts_vector` lexical path is the MVP task search; the pgvector + RRF (k=60) hybrid layer shipped in the Phase 1 backend but is not surfaced. (2) **Play Store staged rollout, the iOS App Store channel, and all iOS native-module analogues are deferred** to a follow-on milestone — MVP is Android-only via the signed APK. Phase 7 narrowed to observability + APK-distribution hardening. Trail: `.planning/ROADMAP.md` (Phases 6 + 7), `.planning/REQUIREMENTS.md` §v2 (SEARCH-V2-01, DIST-05, DIST-06, IOS-01..07), `.planning/STATE.md` Roadmap Evolution + Deferred Items.

> **IMU-liveness fraud check deferred 2026-05-11.** The server-side IMU-liveness gate in `imu-liveness-check.md` (stillness / gravity-axis / saccade-density / gait-FFT / vision–motion-correlation checks → `liveness_score ∈ [0,1]`) was briefly promoted into the Phase 5 MVP backend, then descoped back to v2/post-MVP. **MVP anti-fraud = Play Integrity at sign-in + the on-device one-shot hand gate only.** (FRAUD-05's per-account daily upload-rate cap + FRAUD-06's pre-payout fraud dashboard were themselves descoped to §v2 on 2026-05-12 — see `.planning/phases/05-upload-pipeline-hash-verify-worker-anti-fraud/05-CONTEXT.md` D-04 + `.planning/REQUIREMENTS.md` §v2; the MVP upload path is fully uncapped per account.) The upload bundle still carries the IMU CSV (training consumes it); it is just not analysed server-side at MVP. Trail: `.planning/REQUIREMENTS.md` §v2 (FRAUD-03..06), `.planning/ROADMAP.md` Phase 5, `.planning/STATE.md` Deferred Items + Decisions, `deferred-decisions.md` (Fraud & integrity), quick task `.planning/quick/260511-kfs-descope-imu-liveness-check-to-v2/`.

### Constraints (LOCKED)

- **Designs:** `prototype.html`, `design-spec.md`, `engineering-handoff.md` are the design source of truth. Task icons from `design-system/task-icons/`. No new design work — every screen, state, copy string, animation curve, token verbatim from those files.
- **Capture spec:** every value in `idea-brief.md` §2.1 is hard. Devices/codecs that can't deliver are rejected at compat-check.
- **Capture pipeline:** Camera2 + MediaCodec (Android), AVCaptureSession + AVAssetWriter (iOS). CameraX rejected — B-frame + bitrate-mode controls not reliably exposed.
- **Hand gate:** MediaPipe HandLandmarker (`hand_landmarker.task` ~7.8 MB) in custom Kotlin/Swift RN modules. IMAGE mode, single-frame, hand-count only. Mirrors Figure's pattern.
- **App framework:** React Native (Hermes new architecture) + native modules for capture, hand detection, upload service.
- **Backend:** Fastify + Postgres (`ts_vector` lexical task search at MVP; pgvector + RRF hybrid layer shipped but descoped from the MVP client — see §v2 SEARCH-V2-01) + S3 (LocalStack in dev). Vitest for tests.
- **Auth:** Google Sign-In + Play Integrity at sign-in only. Per-upload attestation deferred. **Single-device, newest-login-wins (Bug 4 / D2, 2026-06-04 — overrides LOCKED `D-AUTH-03`; see banner above): the account binds to the most-recent device; the prior device is force-logged-out (401 `device-evicted`) on its next request, gated by a per-request LRU `sub → current_installation_id` lookup.** APK build flavor bypasses install-source check via Remote Config (Play Store builds cannot opt into the bypass).
- **Distribution:** signed APK direct to users at MVP. Play Store staged rollout + iOS App Store channel (and the iOS native-module analogues) deferred to a follow-on milestone — see `.planning/REQUIREMENTS.md` §v2 (DIST-05, DIST-06, IOS-01..07). Direct-to-user; no intermediary distribution channel.
- **Geos / locale:** India + Brazil at MVP, English only. Localization deferred.
- **Battery / thermal:** 25-min sustained capture on Pixel 7a-class without thermal cut-out, with ≤8% battery drain.
- **No notifications.** No `POST_NOTIFICATIONS`, no FCM/APNs at MVP.
- **No success metrics.** Ship-by-vibe at MVP; no quant gates block phase completion (`strategic-suggestions.md` §1).
- **Privacy / consent:** `idea-brief.md` §5.2 is canonical. Server logs consent timestamp + version. **Precise location (GPS coordinates) captured per recording (Bug 3 / D3, 2026-06-04 — overrides the formerly-LOCKED coarse-only constraint; consent text updated + consent version bumped `1.0.0` → `1.1.0`, forcing re-consent; partial COARSE grant still records, only full denial blocks).**
- **Files never re-encoded.** MP4, IMU CSV, metadata JSON travel byte-for-byte device → S3. (The rule covers the three captured payload files; upload hashing + server verification were removed 2026-06-04 — Enh 3 / D1 — and the server-generated poster thumbnail (Bug 6 / D5, `recordings/{userId}/{recordingId}/thumb.jpg`) is a NEW derived object, not a re-encode of the captured bytes.)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Tech Stack — Pins

Full rationale, OEM sharp edges, version sources, and config recipes: `research/STACK.md`.

### Mobile — Core

- `react-native@0.83.x`, `react@19.2.x`, Hermes (bundled), `typescript@5.5–5.7` (NOT TS 6). New Architecture only.

### Mobile — Camera / hand-gate / capture

- `react-native-reanimated@4.x` (≥4.3.1) — the RN-0.83-compatible line (new-arch only, peer `react-native: 0.81–0.85`). The 3.x line does NOT compile against RN 0.83 on Android (references the removed Paper-era `UIManagerModuleListener` / `Systrace.TRACE_TAG_REACT_JAVA_BRIDGE` / `UIManagerModule.addUIManagerListener` / `LengthPercentage.resolve(float,float)` APIs).
- `react-native-worklets@0.8.x` — peer dep of reanimated 4 (the standalone worklets runtime). `babel.config.js` MUST end with `react-native-worklets/plugin` (replaces the old `react-native-reanimated/plugin`).
- `react-native-svg@15.x` (≥15.15.4) — the RotatePrompt portrait-phone glyph + the GateRing, etc.
- **`react-native-vision-camera` REMOVED 2026-05-12** (debug session `handgate-never-passes`). It was the original pre-record hand-gate camera (preview + `takePhoto()`), but on a logical-multi-camera Android device it can't disable AF or reach the ultrawide sub-camera — replaced by the hand-rolled native Camera2 gate camera (`HumynGateCamera` below). Its `react-native-worklets-core` peer + the `@shopify/react-native-skia` frame-processor dep went with it. (Camera permissions are `react-native-permissions`, not VisionCamera.)
- **`HumynCapture` (Kotlin) / `HumynCaptureIOS` (Swift)** — hand-rolled Camera2+MediaCodec / AVCaptureSession+AVAssetWriter HEVC pipeline. Owns the locked capture spec. Records on the **back ultrawide** physical sub-camera (≥110° dFOV) by driving `CONTROL_ZOOM_RATIO` to the lower bound of `CONTROL_ZOOM_RATIO_RANGE` on the logical back camera, AF off + fixed focus (the ultrawide path costs video↔IMU drift — see the drift banner up top).
- **`HumynGateCamera` (Kotlin Camera2)** — the pre-record hand-gate camera: opens the back logical camera, drives `CONTROL_ZOOM_RATIO` to the ultrawide, AF off + fixed focus; `<HumynGateCameraView>` is the live preview (a Camera2-fed TextureView), shown from the `'ready'` substate (once landscape) through the gate so the operator/helper can check rig placement + hands-in-frame before pressing Start. Released before `HumynCapture.start()` opens its own Camera2 session (one back-camera client at a time). Replaced the VisionCamera `<Camera>`. (iOS analogue deferred with the rest of the iOS native modules.)
- **`HandDetector` (Kotlin + Swift)** — ~95 LOC each, MediaPipe HandLandmarker IMAGE mode, hand-count only. Frame source is `HumynGateCamera.captureFrame()` (a JPEG to `cacheDir/hand-gate/`), not VisionCamera `takePhoto()`. The bundled `hand_landmarker.task` MUST be `noCompress`'d in `app/build.gradle` (Deflate-compressed → MediaPipe can't memory-map it → throws every poll).
- `com.google.mediapipe:tasks-vision@0.10.21` (Android) + `MediaPipeTasksVision@0.10.21` (iOS pod). **Pin both at 0.10.21** — iOS pod 0.10.33+ has XCFramework linking issues (mediapipe #6258).

### Mobile — Sensors / FS / storage / glue

- `SensorManager` (Android) / `CMMotionManager` (iOS) — inside HumynCapture, no RN library.
- `react-native-fs@2.20.0`, `react-native-mmkv@4.3.1`, `react-native-keychain@10.0.0`.
- `react-native-tts@4.1.1` — recording-cue voice. ⚠ **OWNER DEVIATION 2026-05-12** from `idea-brief.md §13` / `engineering-handoff.md §6.3` / REQ REC-14 (which mandate _en-IN female_): the cue voice is now **en-US, female-leaning** (`Tts.setDefaultLanguage('en-US')` baseline → an en-US female-ish voice → any en-US → first en-\*). On the Pixel 10a the engine's en-IN fallback sounded bad to the owner. `ttsVoice.ts` keeps the `EnIn` symbol names to avoid churning import sites. (`RigTutorialScreen.tsx` has a related owner-directed deviation — a one-line camera-framing tip added to its "verbatim §5" copy.)
- `react-native-config@1.6.1`, `lucide-react-native@1.14.0`.

### Mobile — Auth / integrity / Firebase

- `@react-native-google-signin/google-signin@16.1.2` — Credential Manager API on Android 14+. Configure with the **Web** OAuth client ID (not Android).
- All `@react-native-firebase/{app,auth,crashlytics,analytics,remote-config}@24.0.0` (unified).
- **Play Integrity** (Android, native): Standard requests + Google-Managed decryption. Bypassed for APK build flavor via Remote Config.
- **DeviceCheck / App Attest** (iOS, native): iOS analogue.
- **Foreground service** (Android 14+): types `camera|microphone|dataSync` for capture, `dataSync` for upload-only state. Match with `FOREGROUND_SERVICE_*` permissions.
- **URLSession background config** (iOS) for uploads.

### Backend (Node 22 LTS / Jod)

- `fastify@5.8.5`, `@fastify/cors@11.2.0`, `@fastify/jwt@10.0.0`, `@fastify/rate-limit@10.3.0`.
- `pino@10.3.1`, `pino-pretty@13.1.3` (dev).
- `pg@8.20.0`, `drizzle-orm@0.45.2` (chosen over Prisma for hybrid-search ergonomics).
- `google-auth-library@10.6.2`, `googleapis@171.4.0`.
- `@aws-sdk/client-s3@3.1044.0` + `@aws-sdk/s3-request-presigner@3.1044.0` (pin both at same minor). NOT `aws-sdk` v2.
- ~~`bullmq@5.76.8`, `ioredis@5.10.1`, `@aws-sdk/client-sqs@3.1044.0`, Redis 7.x~~ **REMOVED 2026-06-04 (Enh 3 / D1 — upload verification + hashing dropped).** Were: the hash-verify worker queue (Redis-backed; retries/backoff/concurrency/queue-depth metrics for ECS autoscaling); the thin prod SQS-poller (S3→EventBridge→SQS→queue.add); Redis **7.x** (ElastiCache prod / `redis:7-alpine` dev). All dead now that verification is gone — deps + dev container + `verify-queue`/`redis` Terraform reaped as a fast-follow. (The same-minor rule still applies to the remaining `@aws-sdk/client-s3` ↔ `s3-request-presigner` deps.)
- `zod@4.4.3`, `vitest@4.1.5`, `drizzle-kit@0.x`.

### Postgres + search

- PostgreSQL **17.x** (or 16.x), `pgvector@0.8.0+` with **HNSW** index over IVFFlat, built-in `ts_vector` + GIN index, hybrid via **Reciprocal Rank Fusion** (K=60).

### Infra (dev)

- LocalStack Community **4.x** (multipart presigned works on v4; Pro not required), `docker-compose`, Terraform **1.10+**, `k6` for load tests.

### Build tools

- **Android:** AGP 8.7+, Gradle 8.11+, Kotlin 2.0.21+, compileSdk/targetSdk **35**, minSdk **26**, JDK 17 (Zulu).
- **iOS:** Xcode 16.0+, deployment target **15.1**, CocoaPods 1.16+, Ruby 3.2+.

## Do NOT Use

- **`react-native-vision-camera`** (any role) — REMOVED 2026-05-12. Was the hand-gate camera; on a logical-multi-camera Android device it can't disable AF or reach the ultrawide sub-camera, and it never had `KEY_BITRATE_MODE` / `KEY_LATENCY` / `MAX_B_FRAMES` for the HEVC pipeline anyway. The gate runs on the hand-rolled native Camera2 `HumynGateCamera`; the HEVC pipeline is `HumynCapture`; camera permissions are `react-native-permissions`. (Its `react-native-worklets-core` peer + the `@shopify/react-native-skia` frame-processor dep went with it.)
- **CameraX (any version)** — spec rejects; controls we need not exposed.
- **`MediaPipeTasksVision` iOS pod 0.10.33+** — XCFramework linking issues. Stay at 0.10.21.
- **Third-party RN MediaPipe wrappers** — unmaintained; the in-house module is ~95 LOC.
- **`react-native-camera`** (archived), **`expo-camera`** (no physical-lens selection / custom MediaCodec).
- **Hermes JSC / legacy JS engine** — JSI requires Hermes V1.
- **`react-native-track-player` / `react-native-sound`** for TTS — wrong tool; use `react-native-tts`.
- **AsyncStorage** for tokens or upload queue — MMKV (encrypted, non-secrets) + Keychain (secrets).
- **`@react-native-firebase/*` v22 or older** — pre-New-Arch TurboModule issues.
- **AWS SDK v2 (`aws-sdk`)** — maintenance-mode; use v3 modular.
- **Prisma** for hybrid task search — type-safety lost on raw SQL fallback.
- **Redis (any usage)** — REMOVED 2026-06-04 (Enh 3 / D1). The on-device upload queue still lives on device (JSON-on-disk in `filesDir/upload-queue/queue.json`, native-module-owned — note: NOT MMKV; CLAUDE.md was historically stale here, see `UPLOAD-PIPELINE.md` §6.1) per the "queue lives on device" rule. The _hash-verify worker_ queue was the one Redis carve-out (BullMQ-on-Redis-on-ECS, VERIFY-01/07) — **that whole flow is gone**, so Redis is no longer used anywhere at MVP.
- **`react-native-background-fetch`** for upload — use FGS `dataSync` (Android) / URLSession background (iOS).
- **Sentry / Datadog / Bugsnag** at MVP — Crashlytics + Firebase Analytics only.

## Version Compatibility Pinpoints

- RN 0.83 ↔ all `@react-native-firebase/*` 24.0.0.
- RN 0.83 ↔ reanimated 4.x (≥4.3.1) ↔ `react-native-worklets` 0.8.x (reanimated 4's peer) — `babel.config.js` ends with `react-native-worklets/plugin`. (reanimated 3.x is NOT RN-0.83-compatible on Android. `react-native-vision-camera` + `react-native-worklets-core` were removed 2026-05-12 — no VisionCamera/Skia compat pin anymore.)
- mediapipe `tasks-vision` 0.10.21 ↔ `MediaPipeTasksVision` 0.10.21 (lock both).
- `pgvector` 0.8.0+ ↔ PG 16/17 (HNSW iterative scan).
- `@aws-sdk/client-s3` ↔ `@aws-sdk/s3-request-presigner` (always same minor).
- Detox 20.51.1 ↔ RN 0.83 (added in 20.47.0).
- Fastify 5 ↔ `@fastify/cors@11`, `@fastify/jwt@10`, `@fastify/rate-limit@10`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Entry points:

- `/gsd-quick` — small fixes, doc updates, ad-hoc tasks
- `/gsd-debug` — investigation and bug fixing
- `/gsd-execute-phase` — planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
