<!-- GSD:project-start source:PROJECT.md -->

## Project

**Homelander** — codename for **Humyn Labs Capture**. Android-first React Native app that records strict-spec egocentric (head-mounted) video + IMU streams of everyday tasks. Captured data trains physical/embodied AI (VLA/VLN, humanoid robotics). Brand: _Real Humyns. Real Intelligence._ MVP ships as a signed APK direct to users in India + Brazil, ages 18–35, on ₹30K+ phones. (Play Store and iOS App Store channels are deferred to a follow-on milestone — see the descope banner below.)

**Core Value — capture quality is non-negotiable.** Every uploaded segment: 1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms video↔IMU timestamp alignment. If capture quality slips, the project fails.

> **Audio dropped 2026-05-11.** Original spec included 48 kHz mono AAC-LC. Phase 3 smoke on Pixel 10a showed audio-pump CPU contention pushed `imu_video_drift_{mean,p99}_ms` from ~1.8/2.1 ms to ~5.5/5.8 ms — outside ±1 ms. Audio dropped to preserve the drift invariant; training pipeline consumes video + IMU only. Post-unwire smoke 7: drift mean 0.594 ms / p99 0.728 ms ✓. Trail: `.planning/phases/03-humyn-capture-native-module/03-HUMAN-UAT.md` GAP-3 + commits `a1ab0ea` (unwire), `1a3e039` (closure). Re-introducing audio requires on-hardware proof drift stays inside ±1 ms.

> **MVP descoped 2026-05-11.** (1) **Semantic search dropped from the MVP client surface** — the `ts_vector` lexical path is the MVP task search; the pgvector + RRF (k=60) hybrid layer shipped in the Phase 1 backend but is not surfaced. (2) **Play Store staged rollout, the iOS App Store channel, and all iOS native-module analogues are deferred** to a follow-on milestone — MVP is Android-only via the signed APK. Phase 7 narrowed to observability + APK-distribution hardening. Trail: `.planning/ROADMAP.md` (Phases 6 + 7), `.planning/REQUIREMENTS.md` §v2 (SEARCH-V2-01, DIST-05, DIST-06, IOS-01..07), `.planning/STATE.md` Roadmap Evolution + Deferred Items.

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

- `react-native-vision-camera@4.7.3` — preview + `takePhoto()` only. Do NOT use for HEVC video pipeline. V5 (Nitro rewrite) deferred.
- `react-native-worklets-core@1.6.3` (V4 pairs with this, NOT `react-native-worklets`).
- `react-native-reanimated@3.16.x` (4.x too new for the RN 0.83 ecosystem).
- `@shopify/react-native-skia@1.x` (≥1.2.1) — V4 Skia frame-processor minimum.
- **`HumynCapture` (Kotlin) / `HumynCaptureIOS` (Swift)** — hand-rolled Camera2+MediaCodec / AVCaptureSession+AVAssetWriter HEVC pipeline. Owns the locked capture spec.
- **`HandDetector` (Kotlin + Swift)** — ~95 LOC each, MediaPipe HandLandmarker IMAGE mode, hand-count only.
- `com.google.mediapipe:tasks-vision@0.10.21` (Android) + `MediaPipeTasksVision@0.10.21` (iOS pod). **Pin both at 0.10.21** — iOS pod 0.10.33+ has XCFramework linking issues (mediapipe #6258).

### Mobile — Sensors / FS / storage / glue

- `SensorManager` (Android) / `CMMotionManager` (iOS) — inside HumynCapture, no RN library.
- `react-native-fs@2.20.0`, `react-native-mmkv@4.3.1`, `react-native-keychain@10.0.0`.
- `react-native-tts@4.1.1` — uses `idea-brief.md §13` fallback chain (en-IN female → en-IN any → en-US female → first en-\*).
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
- `zod@4.4.3`, `vitest@4.1.5`, `drizzle-kit@0.x`.

### Postgres + search

- PostgreSQL **17.x** (or 16.x), `pgvector@0.8.0+` with **HNSW** index over IVFFlat, built-in `ts_vector` + GIN index, hybrid via **Reciprocal Rank Fusion** (K=60).

### Infra (dev)

- LocalStack Community **4.x** (multipart presigned works on v4; Pro not required), `docker-compose`, Terraform **1.10+**, `k6` for load tests.

### Build tools

- **Android:** AGP 8.7+, Gradle 8.11+, Kotlin 2.0.21+, compileSdk/targetSdk **35**, minSdk **26**, JDK 17 (Zulu).
- **iOS:** Xcode 16.0+, deployment target **15.1**, CocoaPods 1.16+, Ruby 3.2+.

## Do NOT Use

- **VisionCamera for the HEVC pipeline** — no `KEY_BITRATE_MODE` / `KEY_LATENCY` / `MAX_B_FRAMES`. Use the custom Camera2+MediaCodec module.
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
- **Redis at MVP** — Postgres-only; queue lives on device.
- **`react-native-background-fetch`** for upload — use FGS `dataSync` (Android) / URLSession background (iOS).
- **Sentry / Datadog / Bugsnag** at MVP — Crashlytics + Firebase Analytics only.

## Version Compatibility Pinpoints

- RN 0.83 ↔ all `@react-native-firebase/*` 24.0.0.
- RN 0.83 ↔ VisionCamera 4.7.3 ↔ `worklets-core` 1.6.3 ↔ reanimated 3.16.x ↔ Skia 1.x (≥1.2.1).
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
