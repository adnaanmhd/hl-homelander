<!-- GSD:project-start source:PROJECT.md -->

## Project

**Homelander** — codename for **Humyn Labs Capture**. Android-first React Native app that records strict-spec egocentric (head-mounted) video + IMU streams of everyday tasks. Captured data trains physical/embodied AI (VLA/VLN, humanoid robotics). Brand: _Real Humyns. Real Intelligence._ MVP ships as a signed APK direct to users in India + Brazil, ages 18–35, on ₹30K+ phones. (Play Store and iOS App Store channels are deferred to a follow-on milestone — see the descope banner below.)

**Core Value — capture quality is non-negotiable.** Every uploaded segment: 1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz. Video↔IMU drift (`imu_video_drift_{max,mean,p99}_ms`) is **measured and recorded** in every segment's metadata — the original ±1 ms gate is relaxed (see the drift banner below). If 1080p/30/≥110°/≥100 Hz slips, the project fails.

> **±1 ms drift gate relaxed 2026-05-12.** The LOCKED spec (`idea-brief.md` §2.1) calls for ±1 ms video↔IMU timestamp alignment. On the Phase-4 capture path the HEVC stream records on the **ultrawide** physical sub-camera via `CONTROL_ZOOM_RATIO` (required to actually hit ≥110° dFOV instead of streaming the ~83° main wide) — the ultrawide's heavy distortion-correction / fusion pipeline regresses drift to ~1.7–6.2 ms (a clean 10-min gate-pass segment: max 6.16 / mean 5.58 / p99 5.63 ms). **Owner decision: keep computing & recording the three drift figures in every segment's metadata as fleet-health telemetry; do NOT gate Phase completion / smoke sign-off / finalization / uploads on them; do NOT change the ultrawide lens code.** `idea-brief.md` §2.1 and `.planning/REQUIREMENTS.md` still state ±1 ms — not edited; revisit in a dedicated pass if the spec docs should be aligned. Full write-up + mitigation options if ever revisited: `ULTRAWIDE-DRIFT-FINDINGS.md` (repo root). Trail: debug session `.planning/debug/handgate-never-passes.md` (Stage 2), `04-MANUAL-SMOKE.md` §5b.

> **Audio dropped 2026-05-11.** Original spec included 48 kHz mono AAC-LC. Phase 3 smoke on Pixel 10a showed audio-pump CPU contention pushed `imu_video_drift_{mean,p99}_ms` from ~1.8/2.1 ms to ~5.5/5.8 ms — outside the then-active ±1 ms gate. Audio dropped; training pipeline consumes video + IMU only. Post-unwire smoke 7: drift mean 0.594 ms / p99 0.728 ms. Trail: `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3 + commits `a1ab0ea` (unwire), `1a3e039` (closure). Audio stays dropped (the drift gate's relaxation 2026-05-12 doesn't reopen it — re-introducing audio is its own decision, and would still need fresh on-hardware drift evidence).

> **MVP descoped 2026-05-11.** (1) **Semantic search dropped from the MVP client surface** — the `ts_vector` lexical path is the MVP task search; the pgvector + RRF (k=60) hybrid layer shipped in the Phase 1 backend but is not surfaced. (2) **Play Store staged rollout, the iOS App Store channel, and all iOS native-module analogues are deferred** to a follow-on milestone — MVP is Android-only via the signed APK. Phase 7 narrowed to observability + APK-distribution hardening. Trail: `.planning/ROADMAP.md` (Phases 6 + 7), `.planning/REQUIREMENTS.md` §v2 (SEARCH-V2-01, DIST-05, DIST-06, IOS-01..07), `.planning/STATE.md` Roadmap Evolution + Deferred Items.

> **IMU-liveness fraud check deferred 2026-05-11.** The server-side IMU-liveness gate in `imu-liveness-check.md` (stillness / gravity-axis / saccade-density / gait-FFT / vision–motion-correlation checks → `liveness_score ∈ [0,1]`) was briefly promoted into the Phase 5 MVP backend, then descoped back to v2/post-MVP. **MVP anti-fraud = Play Integrity at sign-in + per-account daily upload-rate cap + the on-device one-shot hand gate only.** The upload bundle still carries the IMU CSV (training consumes it); it is just not analysed server-side at MVP. Trail: `.planning/REQUIREMENTS.md` §v2 (FRAUD-03, FRAUD-04), `.planning/ROADMAP.md` Phase 5, `.planning/STATE.md` Deferred Items + Decisions, `deferred-decisions.md` (Fraud & integrity), quick task `.planning/quick/260511-kfs-descope-imu-liveness-check-to-v2/`.

### Constraints (LOCKED)

- **Designs:** `prototype.html`, `design-spec.md`, `engineering-handoff.md` are the design source of truth. Task icons from `design-system/task-icons/`. No new design work — every screen, state, copy string, animation curve, token verbatim from those files.
- **Capture spec:** every value in `idea-brief.md` §2.1 is hard. Devices/codecs that can't deliver are rejected at compat-check.
- **Capture pipeline:** Camera2 + MediaCodec (Android), AVCaptureSession + AVAssetWriter (iOS). CameraX rejected — B-frame + bitrate-mode controls not reliably exposed.
- **Hand gate:** MediaPipe HandLandmarker (`hand_landmarker.task` ~7.8 MB) in custom Kotlin/Swift RN modules. IMAGE mode, single-frame, hand-count only. Mirrors Figure's pattern.
- **App framework:** React Native (Hermes new architecture) + native modules for capture, hand detection, upload service.
- **Backend:** Fastify + Postgres (`ts_vector` lexical task search at MVP; pgvector + RRF hybrid layer shipped but descoped from the MVP client — see §v2 SEARCH-V2-01) + S3 (LocalStack in dev). Vitest for tests.
- **Auth:** Google Sign-In + Play Integrity at sign-in only. Per-upload attestation deferred. APK build flavor bypasses install-source check via Remote Config (Play Store builds cannot opt into the bypass).
- **Distribution:** signed APK direct to users at MVP. Play Store staged rollout + iOS App Store channel (and the iOS native-module analogues) deferred to a follow-on milestone — see `.planning/REQUIREMENTS.md` §v2 (DIST-05, DIST-06, IOS-01..07). Direct-to-user; no intermediary distribution channel.
- **Geos / locale:** India + Brazil at MVP, English only. Localization deferred.
- **Battery / thermal:** 25-min sustained capture on Pixel 7a-class without thermal cut-out, with ≤8% battery drain.
- **No notifications.** No `POST_NOTIFICATIONS`, no FCM/APNs at MVP.
- **No success metrics.** Ship-by-vibe at MVP; no quant gates block phase completion (`strategic-suggestions.md` §1).
- **Privacy / consent:** `idea-brief.md` §5.2 is canonical. Server logs consent timestamp + version. Coarse location only — no precise GPS leaves the device.
- **Files never re-encoded.** MP4, IMU CSV, metadata JSON travel byte-for-byte device → S3.

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
- `bullmq@5.76.8`, `ioredis@5.10.1` — the hash-verify worker queue (Redis-backed; retries/backoff/concurrency/queue-depth metrics for ECS autoscaling). `@aws-sdk/client-sqs@3.1044.0` (pinned to the same minor as `@aws-sdk/client-s3` per the "always same minor" rule) — the thin SQS-poller in prod (S3→EventBridge→SQS→queue.add). Redis **7.x** (ElastiCache prod; `redis:7-alpine` container in dev).
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
- **Redis for the on-device upload queue** — the upload queue lives on device (MMKV-backed, native-module-owned) per VERIFY-spec / the "queue lives on device" rule. The _hash-verify worker_ queue, by contrast, IS BullMQ-on-Redis-on-ECS per VERIFY-01/07 + the ROADMAP — that's the one Redis carve-out at MVP. No other Redis usage.
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
