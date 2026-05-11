# Stack Research — Homelander (Humyn Labs Capture)

**Domain:** Android-first crowdsourced egocentric (head-mounted) video + IMU data-collection app _(audio dropped 2026-05-11 — see amendment below)_
**Researched:** 2026-05-07
**Mode:** Validation + version-pinning + sharp-edge surfacing of an already-locked stack
**Overall confidence:** HIGH (verified against npm, Maven, Apple, Android, and vendor docs as of May 2026)

> **2026-05-11 amendment — Audio capture dropped.** Phase 3 smoke walks on Pixel 10a measured audio-pump CPU contention pushing `imu_video_drift_{mean,p99}_ms` outside the locked ±1 ms target. Audio dropped from the capture spec to preserve the drift invariant. Sections below still mention `AudioRecord`, AAC, FGS `microphone` bit, `RECORD_AUDIO` permission, etc. — those remain accurate as **library/version pins** for any future re-enable, but they are NOT currently exercised at runtime. `AacEncoder.kt` exists on disk (dead code) preserving the locked AAC values; everything else (audio pump, MuxerStartGate, AudioManager allocation) was deleted in commit `a1ab0ea`. Mic permission + FGS `microphone` bit retained for FGS-validation compatibility; see `idea-brief.md` §5.3 note ¹ for why. Re-enable contract: prove drift stays inside ±1 ms on Pixel 10a-class hardware before merging.

---

## Executive Summary — What's Locked, What Bends

The spec already locks the architecture: **Camera2 + MediaCodec for capture, AVCaptureSession + AVAssetWriter on iOS, MediaPipe HandLandmarker for the hand-gate, S3 multipart uploads, Fastify + Postgres + S3 backend**. This research validates those locks against current 2026 packages and surfaces the non-obvious sharp edges that will eat phase-1 time if not flagged now.

**Three load-bearing gotchas surfaced:**

1. **VisionCamera v4+ uses CameraX internally on Android.** The spec rejects CameraX. This means VisionCamera can serve the **preview surface and the `takePhoto()` calls feeding the hand-gate** (matching exactly what Figure does in `figure-app-hands.md`), but the **HEVC capture pipeline must be a separate custom Camera2 + MediaCodec native module** with its own `CameraDevice`/`CaptureSession`. This is a feature, not a bug — it's the only way to get reliable `KEY_BITRATE_MODE=CBR`, `KEY_LATENCY=1`, `MAX_B_FRAMES=0` control.
2. **MediaPipeTasksVision iOS pod has a known broken version range.** `0.10.21` works; `0.10.33+` has XCFramework linking issues with CocoaPods. Pin a known-good version explicitly and don't auto-update.
3. **React Native 0.83 (Dec 2025) is the most stable target** for production. RN 0.80 made Hermes V1 default and froze legacy architecture. RN 0.79+0.80+0.81+0.82+0.83 are all New-Architecture-stable; 0.83 is the explicit "no breaking changes" stability release. Detox 20.51.x supports RN 0.83. **Pin RN 0.83.x** — do NOT chase 0.85/0.86 which are too new for the surrounding ecosystem.

---

## Recommended Stack

### Mobile — React Native Core

| Technology                   | Version (Pin)            | Purpose                     | Confidence | Why this version                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------ | --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native`               | **0.83.x**               | App framework               | HIGH       | First "no breaking changes" stability release (Dec 10, 2025); Hermes V1 default since 0.80; Legacy Architecture frozen since 0.80; New Architecture is the only architecture. Going newer (0.85/0.86) breaks Detox + native module ecosystem. Going older (0.78/0.79) misses Hermes V1 perf wins and pre-dates iOS-precompiled-binaries. |
| `react`                      | **19.2.x**               | UI runtime                  | HIGH       | Bundled with RN 0.83.                                                                                                                                                                                                                                                                                                                    |
| `hermes-engine`              | **bundled with RN 0.83** | JS engine                   | HIGH       | Hermes V1 (the perf rewrite) is default since RN 0.80. New Architecture _requires_ Hermes — JSC is no longer an option.                                                                                                                                                                                                                  |
| `typescript`                 | **5.5.x – 5.7.x**        | Static typing               | HIGH       | TS 6.0.3 is fresh on npm but `@types/react` and many RN deps lag; 5.5–5.7 is the sweet spot. Do NOT pin TS 6 in phase 1.                                                                                                                                                                                                                 |
| `react-native-nitro-modules` | n/a (deferred)           | Faster native module bridge | MEDIUM     | Required by VisionCamera v5; we're pinning v4 which uses TurboModules. Skip nitro-modules for now to keep the dependency tree small.                                                                                                                                                                                                     |

### Mobile — Camera, Hand-Gate, Capture Pipeline

| Technology                                                                             | Version (Pin)                          | Purpose                                                                                                         | Confidence | Why this version                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-vision-camera`                                                           | **4.7.3** (V4 line, last 4.x)          | Preview surface + `takePhoto()` for hand-gate                                                                   | HIGH       | V5 (5.0.x) is a full Nitro rewrite with breaking API changes (Constraints API replaces Formats, `capturePhoto()` replaces `takePhoto()`, switched from `react-native-worklets-core` to `react-native-worklets`). Spec, design, and figure-app-hands.md all reference the V4 `Camera.takePhoto()` API. Pin V4. **Both V4 and V5 use CameraX on Android** — this is fine for preview + photo snap, but the _capture pipeline_ (HEVC video) must NOT route through VisionCamera. |
| `react-native-worklets-core`                                                           | **1.6.3**                              | Worklet runtime for VisionCamera V4 frame processors                                                            | HIGH       | V4 still depends on `react-native-worklets-core` (NOT `react-native-worklets`). If we ever upgrade to V5, this swaps.                                                                                                                                                                                                                                                                                                                                                         |
| `react-native-reanimated`                                                              | **3.16.x**                             | Required peer for VisionCamera Skia frame processors and most RN UI animation libs                              | HIGH       | 3.16 is the last stable that pairs with RN 0.83. v4.x is too new for the wider RN 0.83 ecosystem.                                                                                                                                                                                                                                                                                                                                                                             |
| `@shopify/react-native-skia`                                                           | **1.x latest** (≥1.2.1)                | GPU-accelerated overlay drawing on the recording surface (custom progress ring, hand-gate UI)                   | HIGH       | VisionCamera V4 Skia frame processors require ≥1.2.1.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Custom native capture module: `HumynCapture` (Kotlin) + `HumynCaptureIOS` (Swift)**  | n/a — write from scratch               | Camera2 + MediaCodec (Android) / AVCaptureSession + AVAssetWriter (iOS) HEVC pipeline producing the locked spec | HIGH       | The capture pipeline CANNOT use VisionCamera or any wrapper because B-frame disabling, CBR mode, KEY_LATENCY, and exact-bytes guarantees are not exposed in higher-level APIs. This is hand-rolled Kotlin/Swift — see "Configuration Recipes" below.                                                                                                                                                                                                                          |
| **Custom native hand-detect module: `HandDetector` (Kotlin) + `HandDetector` (Swift)** | n/a — write from scratch, ~95 LOC each | MediaPipe HandLandmarker IMAGE-mode shim returning `landmarks().size` only                                      | HIGH       | Direct port of Figure's pattern from `figure-app-hands.md`. No third-party RN wrapper introduces a dependency tree we don't need.                                                                                                                                                                                                                                                                                                                                             |
| `com.google.mediapipe:tasks-vision` (Maven, Android)                                   | **0.10.21** (matched to iOS pin)       | Hand landmarker on Android                                                                                      | MEDIUM     | Latest series is 0.10.x; 0.10.21 is the version Figure ships and pairs cleanly with the iOS pod's known-good 0.10.21. Newer Maven artifacts exist but iOS has known issues at 0.10.33+, so pin both sides at 0.10.21 for parity. Bundle `hand_landmarker.task` (~7.8 MB) at `android/app/src/main/assets/hand_landmarker.task`.                                                                                                                                               |
| `MediaPipeTasksVision` (CocoaPod, iOS)                                                 | **0.10.21**                            | Hand landmarker on iOS                                                                                          | HIGH       | Sharp edge: 0.10.33+ has XCFramework linking issues (mediapipe issue #6258, March 2026). Stay on 0.10.21 — it's stable. `pod 'MediaPipeTasksVision', '0.10.21'`.                                                                                                                                                                                                                                                                                                              |

### Mobile — Sensors, Audio, Filesystem, OS Glue

| Technology                           | Version (Pin)                           | Purpose                                                                       | Confidence | Why this version                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SensorManager` (Android, framework) | platform                                | Gyro + Accel capture at SENSOR_DELAY_FASTEST with `maxReportLatency` batching | HIGH       | Spec-mandated. Implementation lives inside the `HumynCapture` Kotlin module — there is no RN library worth depending on for this; the framework API is fine.                                                                                                                                      |
| `CMMotionManager` (iOS, framework)   | platform                                | Gyro + Accel capture at the device's max rate                                 | HIGH       | Spec-mandated. iOS analogue lives in `HumynCaptureIOS`.                                                                                                                                                                                                                                           |
| `react-native-fs`                    | **2.20.0**                              | App sandbox file I/O (writing IMU CSV, reading hashes)                        | MEDIUM     | Last published mid-2024. Stable but unmaintained. Acceptable for MVP; consider `expo-file-system` (55.0.x) if RN team prefers Expo modules. RN-FS is fine if not using Expo.                                                                                                                      |
| `react-native-mmkv`                  | **4.3.1**                               | Encrypted key-value store (auth token, user prefs, upload-queue manifest)     | HIGH       | MMKV by Marc Rousavy (same author as VisionCamera). Faster than AsyncStorage, supports encryption out of the box. v4 is the New-Architecture-native rewrite.                                                                                                                                      |
| `react-native-keychain`              | **10.0.0**                              | Keystore (Android) / Keychain (iOS) for OAuth tokens                          | HIGH       | v10 supports New Architecture; canonical.                                                                                                                                                                                                                                                         |
| `react-native-tts` (ak1394)          | **4.1.1**                               | TTS for "Recording started", battery/thermal alerts; en-IN female voice       | MEDIUM     | Last published 2 years ago but works on RN 0.83. Voice availability depends on device's installed TTS engine. Implement the `idea-brief.md §13` fallback chain (en-IN female → en-IN any → en-US female → first en-\*) inside a thin wrapper. Alternative: `expo-speech` (55.0.13) if going Expo. |
| `react-native-config`                | **1.6.1**                               | `.env` plumbing for `API_BASE_URL`, build-flavor flags (APK-bypass)           | HIGH       | Standard.                                                                                                                                                                                                                                                                                         |
| `lucide-react-native`                | **1.14.0** (or `lucide-react` ≥0.400.0) | Task icons per `engineering-handoff.md §1.7`                                  | HIGH       | Engineering-handoff explicitly pins lucide ≥0.400.0; current `lucide-react-native` 1.14 satisfies it.                                                                                                                                                                                             |

### Mobile — Auth, Integrity, Background, Firebase

| Technology                                  | Version (Pin)                     | Purpose                                                                                                                                                | Confidence | Why this version                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@react-native-google-signin/google-signin` | **16.1.2**                        | Google Sign-In wrapping Android Credential Manager API + iOS Google Sign-In SDK                                                                        | HIGH       | v13+ migrated to Credential Manager on Android (mandatory for Android 14+). Configure with **Web** OAuth client ID (NOT Android), per the new Credential Manager requirement. `webClientId` auto-detected from `google-services.json` if Firebase is set up.                                                                                                                                 |
| `@react-native-firebase/app`                | **24.0.0**                        | Firebase RN SDK base                                                                                                                                   | HIGH       | All `@react-native-firebase/*` modules unified at v24 in 2026. Supports New Architecture.                                                                                                                                                                                                                                                                                                    |
| `@react-native-firebase/auth`               | **24.0.0**                        | Firebase Auth (token exchange in conjunction with Google Sign-In)                                                                                      | HIGH       | Pair with `@react-native-google-signin/google-signin` for the dual-flow: Google Sign-In returns an ID token, Firebase Auth exchanges it for a Firebase user.                                                                                                                                                                                                                                 |
| `@react-native-firebase/crashlytics`        | **24.0.0**                        | Native + JVM crash + ANR                                                                                                                               | HIGH       | Mandated by spec.                                                                                                                                                                                                                                                                                                                                                                            |
| `@react-native-firebase/analytics`          | **24.0.0**                        | Telemetry funnel per `engineering-handoff.md §11`                                                                                                      | HIGH       | Mandated by spec.                                                                                                                                                                                                                                                                                                                                                                            |
| `@react-native-firebase/remote-config`      | **24.0.0**                        | Toggle: APK-flavor install-source bypass, segment length default 10 min, hand-gate `targetHits`/`cadenceMs` per platform                               | HIGH       | Spec calls out Remote Config in 3 places — pre-flag the keys early so QA can tune without rebuilds.                                                                                                                                                                                                                                                                                          |
| **Play Integrity API** (Android, native)    | platform via Google Play services | Sign-in attestation: rejects rooted/emulator, enforces Play install-source for Play/TestFlight builds, bypassed for APK build flavor via Remote Config | HIGH       | Implement directly in Kotlin via `IntegrityManagerFactory.create(...)`. **Use Standard requests** (modern, low-latency, server hashes verdict) — **NOT Classic** (deprecated path, higher latency). **Decryption: Google-Managed (default)** — backend calls Google's decryption endpoint; we never handle keys. Self-managed keys are unnecessary for our threat model and add ops surface. |
| **DeviceCheck / App Attest** (iOS, native)  | platform                          | Sign-in attestation analogue on iOS                                                                                                                    | HIGH       | Apple's equivalent of Play Integrity. iOS analogue is required because the spec says "every Android choice has a clean iOS analogue."                                                                                                                                                                                                                                                        |
| **Foreground service (Android)**            | platform                          | Type: `camera \| microphone \| dataSync` for capture; type: `dataSync` for upload-only state                                                           | HIGH       | Android 14+ requires explicit `foregroundServiceType` in manifest _and_ matching `FOREGROUND_SERVICE_*` permissions. See "Configuration Recipes" for the manifest snippet.                                                                                                                                                                                                                   |
| **URLSession background config** (iOS)      | platform                          | iOS analogue for background uploads                                                                                                                    | HIGH       | `URLSessionConfiguration.background(withIdentifier:)`. iOS limits: app force-quit pauses uploads (resumed on next launch); spec already calls this out (`idea-brief.md §7.4`).                                                                                                                                                                                                               |

### Backend — Fastify Service

| Technology                      | Version (Pin)      | Purpose                                                                            | Confidence | Why this version                                                                                                                                                                                       |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node`                          | **22.x LTS (Jod)** | Runtime                                                                            | HIGH       | LTS line; aligns with Fastify 5 minimum.                                                                                                                                                               |
| `fastify`                       | **5.8.5**          | HTTP framework                                                                     | HIGH       | Fastify 5 line is current; 4.x is in maintenance only.                                                                                                                                                 |
| `@fastify/cors`                 | **11.2.0**         | CORS for the mobile client                                                         | HIGH       | v11 pairs with Fastify 5.                                                                                                                                                                              |
| `@fastify/jwt`                  | **10.0.0**         | Session-token signing/verification (post Google Sign-In + Play Integrity exchange) | HIGH       | v10 pairs with Fastify 5.                                                                                                                                                                              |
| `@fastify/rate-limit`           | **10.3.0**         | Per-IP throttling on `/auth/google`, `/recordings` mint, `/task-requests`          | HIGH       | Standard hardening.                                                                                                                                                                                    |
| `pino`                          | **10.3.1**         | Structured logging (CloudWatch defaults)                                           | HIGH       | Fastify's built-in logger.                                                                                                                                                                             |
| `pino-pretty`                   | **13.1.3**         | Dev-only log pretty-printer                                                        | HIGH       | Dev dependency.                                                                                                                                                                                        |
| `pg`                            | **8.20.0**         | Postgres node driver                                                               | HIGH       | Or use `postgres` (porsager) v3.4.9 if preferring SQL-tagged-template DX. Both production-grade.                                                                                                       |
| `drizzle-orm`                   | **0.45.2**         | Type-safe SQL builder + migrations                                                 | MEDIUM     | Recommended over Prisma for this project: Drizzle's SQL-first model gives explicit control over `tsvector`, `pgvector`, and hand-rolled hybrid-search queries. Prisma's hybrid-search story is weaker. |
| `google-auth-library`           | **10.6.2**         | Verify Google ID tokens server-side (`POST /auth/google` handler)                  | HIGH       | Official Google library.                                                                                                                                                                               |
| `@aws-sdk/client-s3`            | **3.1044.0**       | Mint S3 multipart presigned URLs, hash-verify on backend                           | HIGH       | AWS SDK v3 — modular (only the S3 client). Do NOT use the legacy `aws-sdk` v2.x (2.1693.0) — entering maintenance, drop in MVP.                                                                        |
| `@aws-sdk/s3-request-presigner` | **3.1044.0**       | `getSignedUrl(...)` helper for per-chunk URLs                                      | HIGH       | Companion to `client-s3`.                                                                                                                                                                              |
| `vitest`                        | **4.1.5**          | Tests (per `testing-guide.md §B.1`)                                                | HIGH       | v4 is current; aligns with the testing-guide reference.                                                                                                                                                |
| `zod`                           | **4.4.3**          | Request/response schema validation, contract sharing with mobile                   | HIGH       | Spec mentions zod schemas in `testing-guide.md §B.1`.                                                                                                                                                  |

### Backend — Postgres + Search

| Technology                                         | Version (Pin)             | Purpose                                                     | Confidence | Why this version                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**                                     | **17.x** (or 16.x stable) | Primary store                                               | HIGH       | PG 17 is stable; PG 16 is acceptable. Both support pgvector ≥0.8.0 cleanly.                                                                                                                                                                                            |
| **pgvector extension**                             | **0.8.0+**                | Vector similarity for `/tasks` semantic search              | HIGH       | 0.8.0 added iterative index scans (`hnsw.iterative_scan`, `ivfflat.iterative_scan`). Use **HNSW index** (`USING hnsw (embedding vector_cosine_ops)`) over IVFFlat — better speed-recall tradeoff at our task-corpus size (~65 tasks at v1, scaling to a few thousand). |
| **ts_vector / GIN index**                          | built-in to PG            | Lexical fallback for `/tasks` search                        | HIGH       | `CREATE INDEX tasks_fts_idx ON tasks USING gin (to_tsvector('english', name \|\| ' ' \|\| description))`.                                                                                                                                                              |
| **Hybrid search via Reciprocal Rank Fusion (RRF)** | SQL pattern, no extension | Combine pgvector cosine + ts_rank into a single ranked list | HIGH       | RRF formula: `score = SUM(1.0 / (60 + rank))` over both rank lists. K=60 is the canonical default. See "Configuration Recipes" for the SQL.                                                                                                                            |

### Infrastructure — Dev + Staging

| Technology               | Version (Pin)  | Purpose                                                                          | Confidence | Why this version                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | -------------- | -------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LocalStack Community** | **4.x latest** | Local S3 mock for dev                                                            | MEDIUM     | **Community edition supports `CreateMultipartUpload`, `UploadPart` (incl. presigned URLs), and `CompleteMultipartUpload`** — verified by the API coverage tables. There were historical issues (pre-3.x) with multipart-via-presigned-URL but the v4.x line resolves them. **LocalStack Pro is NOT required for MVP** — Community is sufficient. The S3-Pro features (object encryption with customer-managed keys, advanced lifecycle rules, etc.) are out of scope. |
| `docker-compose`         | latest         | Bring up Postgres + LocalStack + Fastify in dev                                  | HIGH       | Per `testing-guide.md §A.6`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Terraform**            | **1.10+**      | `infra/terraform/envs/{staging,prod}/`                                           | HIGH       | Per `testing-guide.md §A.6`, infra-as-code is in the project structure. Pin to a specific minor in `.terraform-version`.                                                                                                                                                                                                                                                                                                                                              |
| `k6`                     | latest         | Load test (200–300 concurrent uploads × 8 MB chunks per `testing-guide.md §B.6`) | HIGH       | The spec mandates a 10-min run before each Play Store rollout stage.                                                                                                                                                                                                                                                                                                                                                                                                  |

### Mobile Build Tools (Android side)

| Tool                        | Version              | Notes                                                                                                                                                                                        |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android Gradle Plugin (AGP) | **8.7+**             | RN 0.83 baseline                                                                                                                                                                             |
| Gradle                      | **8.11+**            | Pairs with AGP 8.7                                                                                                                                                                           |
| Kotlin                      | **2.0.21+**          | RN 0.83 ships Kotlin 2.x by default                                                                                                                                                          |
| compileSdk / targetSdk      | **35**               | Required for Play Store as of 2026                                                                                                                                                           |
| minSdk                      | **26 (Android 8.0)** | Pixel 7a runs Android 13+; ₹30K phones are universally Android 11+. minSdk 26 covers Camera2's mature feature set, foreground-service-type strictness lives at 34+ which is targetSdk-gated. |
| NDK                         | side-by-side latest  | For Hermes + MediaPipe native libs                                                                                                                                                           |
| JDK                         | **17 (Zulu)**        | Per `testing-guide.md §A.0`                                                                                                                                                                  |

### Mobile Build Tools (iOS side)

| Tool                  | Version                  | Notes                                                                                     |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Xcode                 | **16.0+**                | Required for iOS 17/18 SDKs and recent Hermes prebuilts                                   |
| iOS deployment target | **15.1**                 | Covers iPhone XS+ which is the floor for the ultrawide-camera + sustained-100-Hz-IMU spec |
| CocoaPods             | **1.16+**                | RN 0.83 podfile baseline                                                                  |
| Ruby                  | **3.2+** (asdf or rbenv) | Pod install reproducibility                                                               |

---

## Configuration Recipes (Copy-Pasteable)

### 1. Android: MediaCodec HEVC encoder configured to spec

Inside the `HumynCapture` Kotlin module (custom Camera2 + MediaCodec pipeline — NOT VisionCamera):

```kotlin
// HumynCaptureModule.kt — encoder configuration
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat

private fun configureHevcEncoder(width: Int = 1920, height: Int = 1080): MediaCodec {
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_HEVC)
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, width, height).apply {
        // Color: 8-bit YUV 4:2:0, surface input (zero-copy from Camera2)
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)

        // Bitrate: 8 Mbps CBR
        setInteger(MediaFormat.KEY_BIT_RATE, 8_000_000)
        setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR) // = 2

        // Frame rate + GOP: 30 fps, I-frame every 1 second (GOP = 30)
        setInteger(MediaFormat.KEY_FRAME_RATE, 30)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)

        // Profile: HEVC Main, no level pin (encoder picks the right level for 1080p30)
        setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain) // = 1

        // Low-latency: forces no B-frames + no frame reordering (Android 11+)
        setInteger(MediaFormat.KEY_LATENCY, 1)
        setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0) // belt-and-braces (some encoders honor MAX_B_FRAMES, some only KEY_LATENCY)

        // Encoder priority: realtime (0 = realtime, 1 = best-effort)
        setInteger(MediaFormat.KEY_PRIORITY, 0)

        // Operating rate: hint encoder to sustain 30 fps
        setInteger(MediaFormat.KEY_OPERATING_RATE, 30)

        // No HDR
        setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
        setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
        setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
    }
    codec.configure(format, /* surface */ null, /* crypto */ null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    return codec
}

// Camera2 capture session must use REALTIME timestamp source:
// captureSessionBuilder.setTemplateType(CameraDevice.TEMPLATE_RECORD)
// requestBuilder.set(CaptureRequest.SENSOR_INFO_TIMESTAMP_SOURCE, ...) — verified per-camera at compat-check
// requestBuilder.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE, CONTROL_VIDEO_STABILIZATION_MODE_OFF)

// MediaMuxer for fragmented MP4 with 30s flush:
// muxer = MediaMuxer(path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
// On Android 33+: muxer.addTrack(...) supports fragmented output natively; otherwise use MP4ParserBuilder
// or move to ExoPlayer's MediaCodec wrapper. For MVP, stay on framework MediaMuxer + manual fragmentation
// (write moov to a sidecar every 30s, then mp4parser-based finalize).
```

**Sharp edge:** `KEY_LATENCY=1` is a hint — not all OEM encoders honor it. Always also set `KEY_MAX_B_FRAMES=0`. Verify on each device-class in the perf matrix (Pixel 7a, Samsung S22, OnePlus 11, Xiaomi 13) that the resulting bitstream has zero B-frames using `mediainfo` or `ffprobe -show_frames`.

**Sharp edge:** `BITRATE_MODE_CBR=2` is supported on most modern encoders, but some (especially older Mediatek / Spreadtrum chipsets) silently fall back to VBR. The compat check should include a 5-second test encode that sniffs the actual encoder type and rejects devices where CBR isn't honored.

### 2. iOS: AVAssetWriter HEVC configured to spec

Inside the `HumynCaptureIOS` Swift module:

```swift
// HumynCaptureIOS.swift — AVAssetWriter video input configuration
import AVFoundation

private func makeVideoInput() -> AVAssetWriterInput {
    let compressionProperties: [String: Any] = [
        // Profile: HEVC Main, encoder picks level
        AVVideoProfileLevelKey: kVTProfileLevel_HEVC_Main_AutoLevel as String, // = "HEVC_Main_AutoLevel"

        // Bitrate: 8 Mbps average; CBR-ish via DataRateLimits
        AVVideoAverageBitRateKey: 8_000_000,

        // CBR enforcement: cap per-second data rate at 8 Mbps; this gets us close to CBR
        // (AVFoundation does not expose a true CBR toggle; this is the standard idiom)
        AVVideoDataRateLimitsKey: [8_000_000 / 8 * 1.05, 1.0], // 1.05× over 1 sec

        // GOP: keyframe every 30 frames (= 1 sec at 30 fps)
        AVVideoMaxKeyFrameIntervalKey: 30,
        AVVideoMaxKeyFrameIntervalDurationKey: 1.0, // belt-and-braces

        // No B-frames: disable frame reordering — this IS how you turn off B-frames in AVFoundation
        AVVideoAllowFrameReorderingKey: false,

        // Frame rate hint to encoder
        AVVideoExpectedSourceFrameRateKey: 30,
    ]

    let outputSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.hevc,
        AVVideoWidthKey: 1920,
        AVVideoHeightKey: 1080,
        AVVideoCompressionPropertiesKey: compressionProperties,
    ]

    let input = AVAssetWriterInput(mediaType: .video, outputSettings: outputSettings)
    input.expectsMediaDataInRealTime = true
    return input
}

// IMU clock alignment:
// All sample buffers timestamped via `mach_absolute_time` converted to CMTime.
// CMMotionManager: `motionManager.deviceMotionUpdateInterval = 1.0 / maxRateHz`
// IMU samples carry `motion.timestamp` (already mach_absolute_time domain).
```

**Sharp edge:** AVFoundation does not expose a true CBR toggle. `AVVideoDataRateLimitsKey: [bytesPerSec, intervalSec]` is the documented workaround. Use a 5% overshoot (`8_000_000/8 * 1.05`) as the per-second cap to avoid encoder starvation on high-motion frames while staying close to spec.

**Sharp edge:** `AVVideoAllowFrameReorderingKey: false` is the canonical way to disable B-frames in HEVC under AVFoundation. Verified across Apple Developer Forums threads and the openradar database.

**Sharp edge:** AVAssetWriter's first frame in HEVC mode is excessively large unless `AVVideoDataRateLimitsKey` is set (rdar://47395179). Always set it.

### 3. MediaPipe HandLandmarker — single shared model bundle

Pin `hand_landmarker.task` (~7.8 MB) once and reuse on both platforms:

```
project_root/
  shared/assets/hand_landmarker.task    ← downloaded once from Google
  apps/mobile/android/app/src/main/assets/hand_landmarker.task   ← symlink or build-time copy
  apps/mobile/ios/Resources/hand_landmarker.task                  ← symlink or build-time copy
```

Android (`HandDetectorModule.kt`):

```kotlin
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerOptions

private fun createLandmarker(ctx: Context): HandLandmarker {
    return HandLandmarker.createFromOptions(ctx,
        HandLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder()
                .setModelAssetPath("hand_landmarker.task")
                .build()) // CPU delegate (default) — NOT GPU
            .setRunningMode(RunningMode.IMAGE)         // single-frame, blocking
            .setNumHands(2)
            .setMinHandDetectionConfidence(0.5f)
            .setMinHandPresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .build())
}

@ReactMethod
fun detectHands(imagePath: String, promise: Promise) {
    executor.execute {
        val bmp = BitmapFactory.decodeFile(imagePath)
        val res = getOrCreate().detect(BitmapImageBuilder(bmp).build())
        promise.resolve(res.landmarks().size) // 0 / 1 / 2
    }
}
```

iOS (`HandDetector.swift`):

```swift
import MediaPipeTasksVision

private func createLandmarker() throws -> HandLandmarker {
    let options = HandLandmarkerOptions()
    options.baseOptions.modelAssetPath = Bundle.main.path(forResource: "hand_landmarker", ofType: "task")!
    options.runningMode = .image           // not .video / .liveStream
    options.numHands = 2
    options.minHandDetectionConfidence = 0.5
    options.minHandPresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5
    // CPU delegate is default; do NOT set .GPU
    return try HandLandmarker(options: options)
}

@objc(detectHands:resolver:rejecter:)
func detectHands(_ imagePath: String,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    queue.async {
        guard let img = UIImage(contentsOfFile: imagePath),
              let mpImg = try? MPImage(uiImage: img) else { reject("decode-failed", "...", nil); return }
        do {
            let res = try self.getOrCreate().detect(image: mpImg)
            resolve(res.landmarks.count)
        } catch {
            reject("detect-failed", error.localizedDescription, error)
        }
    }
}
```

Why these pins, again: 0.10.21 is what Figure ships in `0.16.0.apk` (validated via the decompiled jadx output) AND it's a known-good iOS pod version. Locking both sides to the same version eliminates platform-skew bugs.

### 4. Android 14+ foreground service manifest

Capture service (active while recording):

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<application ...>
    <service
        android:name=".capture.CaptureService"
        android:foregroundServiceType="camera|microphone|dataSync"
        android:exported="false" />

    <service
        android:name=".upload.UploadService"
        android:foregroundServiceType="dataSync"
        android:exported="false" />
</application>
```

Runtime API (Kotlin):

```kotlin
// CaptureService.kt
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notif = buildOngoingNotification()
    // Android 14+: must pass the type bitmask matching the manifest
    ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notif,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    )
    return START_STICKY
}
```

**Sharp edge:** Android 14 `MissingForegroundServiceTypeException` fires if the manifest lacks `foregroundServiceType` OR if the runtime `startForeground(...)` type bitmask doesn't match. Both are required.

**Sharp edge:** Camera and microphone foreground services are _while-in-use_ — you cannot START them while the app is in the background. This is fine for our flow (recording always starts foreground), but it constrains the upload-only path: the `UploadService` must only declare `dataSync` (which IS startable from background).

**Sharp edge:** Android 15 added a 6-hour max runtime cap on `dataSync`-only services. We're nowhere near that for typical clan member usage, but flag it for v2 if upload backlogs ever exceed 6 hours per session.

### 5. Play Integrity: Standard Request, Google-Managed Decryption

Android (Kotlin, in `IntegrityManager` wrapper):

```kotlin
// PlayIntegrityHelper.kt
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import java.security.MessageDigest

private val cloudProjectNumber: Long = BuildConfig.GCP_PROJECT_NUMBER

suspend fun requestIntegrityToken(requestPayload: String): String {
    val manager = IntegrityManagerFactory.createStandard(context)
    val provider = manager.prepareIntegrityToken(
        StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
            .setCloudProjectNumber(cloudProjectNumber)
            .build()
    ).await()

    // Hash the request payload (SHA-256) — defends against replay
    val requestHash = sha256Hex(requestPayload)
    val token = provider.request(
        StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
            .setRequestHash(requestHash)
            .build()
    ).await().token()

    return token  // POST to backend; backend asks Google to decrypt
}

private fun sha256Hex(s: String): String =
    MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
```

Backend (Fastify, Node, decrypt via Google):

```typescript
// integrity.ts
import { google } from 'googleapis';

const playintegrity = google.playintegrity('v1');

export async function decryptIntegrityToken(token: string, packageName: string) {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/playintegrity'],
  });
  const res = await playintegrity.v1.decodeIntegrityToken({
    auth,
    packageName,
    requestBody: { integrityToken: token },
  });
  return res.data.tokenPayloadExternal!;
  // → { requestDetails, appIntegrity, deviceIntegrity, accountDetails }
}
```

**Sharp edge:** "Standard" is the API to use for new integrations. "Classic" is the older, pre-warmed-token-less variant; do not use it. Standard prepares the token provider in the background, making the per-request token mint sub-100ms.

**Sharp edge:** APK build-flavor bypass: Remote Config flag `apk_flavor_bypass_install_source` is read at sign-in. Backend logic:

```typescript
if (
  verdict.appIntegrity.appRecognitionVerdict !== 'PLAY_RECOGNIZED' &&
  !buildFlavorBypassEnabled(buildFlavor)
) {
  reject('install-source-not-play');
}
```

The `buildFlavor` comes from a build-flavor-baked constant, NOT from the client request body (clients can't lie about being the "APK flavor").

### 6. S3 Multipart Presigned Upload — backend mints, client uploads

Backend (`POST /recordings`):

```typescript
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB — matches spec, exceeds the 5 MiB minimum
const URL_TTL_SECONDS = 60 * 60; // 1 h

export async function mintMultipartUrls(
  s3: S3Client,
  bucket: string,
  key: string,
  totalBytes: number,
) {
  // Step 1: initiate
  const init = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: 'video/mp4' }),
  );
  const uploadId = init.UploadId!;

  // Step 2: pre-sign every part URL
  const partCount = Math.ceil(totalBytes / CHUNK_SIZE);
  const parts = await Promise.all(
    Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => {
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: URL_TTL_SECONDS },
      );
      return { partNumber, url };
    }),
  );

  return { uploadId, parts };
  // Client: PUT each chunk to its URL → capture ETag from response header → POST { uploadId, parts: [{partNumber, etag}] } back
}

export async function completeMultipart(
  s3: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
          .sort((a, b) => a.PartNumber - b.PartNumber),
      },
    }),
  );
}
```

Client (`apps/mobile`, RN side, but invoked by the native upload service):

```typescript
const CHUNK_SIZE = 8 * 1024 * 1024;
const PER_FILE_PARALLELISM = 3; // 3 chunks in parallel per file
const FILE_PARALLELISM = 2; // 2 files at once
const RETRY_BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 32_000, 64_000]; // → DLQ
```

**Sharp edge:** S3 minimum part size is **5 MiB except for the last part** (which can be smaller). 8 MiB satisfies this comfortably. Going smaller than 5 MiB would force CompleteMultipartUpload to reject. Spec calls 8 MB and that's what AWS SDK uses as the default chunk size for transfer manager — well-trodden territory.

**Sharp edge:** ETag header from `UploadPart` PUT responses is required for `CompleteMultipartUpload`. Browsers (and some HTTP clients) hide ETag by default due to CORS. **The S3 bucket CORS policy MUST set `ExposeHeaders: ["ETag"]`**. The native upload module on Android (`OkHttp`) and iOS (`URLSession`) reads ETag without restriction, so this is mainly a worry for any backend-driven operation.

**Sharp edge:** Always implement `AbortMultipartUploadCommand` cleanup. Orphaned multipart uploads cost money. Backend cron: weekly `ListMultipartUploads` → abort any older than 7 days.

### 7. Hybrid `tasks` search: pgvector + ts_vector with RRF

Schema:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE tasks (
  id           text PRIMARY KEY,                  -- slug, e.g. "chopping"
  name         text NOT NULL,
  category     text NOT NULL,
  setting      text NOT NULL CHECK (setting IN ('indoor', 'outdoor')),
  icon_key     text NOT NULL,
  description  text NOT NULL,
  instructions text[] NOT NULL CHECK (array_length(instructions, 1) BETWEEN 1 AND 3),
  embedding    vector(384) NOT NULL,              -- e.g. all-MiniLM-L6-v2 dim=384, or text-embedding-3-small@384
  fts          tsvector GENERATED ALWAYS AS (
                  to_tsvector('english', name || ' ' || description)
                ) STORED
);

CREATE INDEX tasks_embedding_idx ON tasks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX tasks_fts_idx       ON tasks USING gin (fts);
```

Hybrid query (RRF, k=60):

```sql
WITH
  vec AS (
    SELECT id, RANK() OVER (ORDER BY embedding <=> $1::vector) AS rank
    FROM tasks
    ORDER BY embedding <=> $1::vector
    LIMIT 50
  ),
  fts AS (
    SELECT id, RANK() OVER (ORDER BY ts_rank_cd(fts, q) DESC) AS rank
    FROM tasks, plainto_tsquery('english', $2) q
    WHERE fts @@ q
    ORDER BY ts_rank_cd(fts, q) DESC
    LIMIT 50
  )
SELECT t.*,
       COALESCE(1.0/(60 + vec.rank), 0) + COALESCE(1.0/(60 + fts.rank), 0) AS rrf_score
FROM tasks t
LEFT JOIN vec ON vec.id = t.id
LEFT JOIN fts ON fts.id = t.id
WHERE vec.id IS NOT NULL OR fts.id IS NOT NULL
ORDER BY rrf_score DESC
LIMIT 20;
```

Inputs: `$1` = query embedding (computed via embedding API call before this query), `$2` = raw query string (for tsquery).

**Sharp edge:** `<=>` is cosine **distance** (lower = more similar); subtract from 1 if you want similarity. RANK() over an ORDER BY of distance gives rank-1 to the closest. RRF doesn't care about absolute scores — only ranks.

**Sharp edge:** `RANK()` ties: rare with vector distances (continuous), common with `ts_rank_cd` (discrete). Switch to `ROW_NUMBER()` if ties cause non-deterministic ordering — at our 65-task scale, this won't matter.

**Sharp edge:** Embedding model choice is OUT OF SCOPE for this stack research — that's a roadmap decision (tradeoff: small fast self-hosted model vs API-based OpenAI/Cohere call per query). Default suggestion: `text-embedding-3-small` at 384 dim via OpenAI API for v1 (cheap, well-known); migrate to self-hosted `all-MiniLM-L6-v2` if cost becomes an issue.

---

## Alternatives Considered

| Recommended                                    | Alternative                                                              | When Alternative Makes Sense                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-native-vision-camera` 4.7.3             | VisionCamera **5.0.x**                                                   | If/when we need 15× faster JSI bridge or RAW capture support — none of which the spec needs. V5 forces a switch to `react-native-worklets` (Software Mansion) and Nitro Modules. Defer.                      |
| Custom Camera2 + MediaCodec module             | **CameraX with `VideoCapture` + custom encoder profile**                 | Never — explicitly rejected by spec because B-frames and bitrate-mode aren't reliably exposed.                                                                                                               |
| MediaPipe HandLandmarker                       | **TensorFlow Lite hand-detection model**, **MLKit Hand Detection**       | If MediaPipe ever drops support for `RunningMode.IMAGE`, fall back to TFLite. MLKit doesn't expose hand-landmarks at all (face-only-ish).                                                                    |
| Drizzle ORM                                    | **Prisma**, **TypeORM**                                                  | Prisma's migration story is great but its hybrid-search-with-pgvector story is weak (you fall back to raw SQL anyway). TypeORM is enterprise-y but slower-moving. Drizzle wins for this use case.            |
| Fastify                                        | **Hono**, **Express**, **NestJS**                                        | Hono is faster but ecosystem is smaller (no `@fastify/jwt` equivalent maturity). Express is fine but slower. NestJS adds DI complexity we don't need at MVP scale.                                           |
| LocalStack Community                           | **LocalStack Pro**, **MinIO**                                            | LocalStack Pro adds object encryption with KMS and IAM emulation — out of scope. MinIO is a real S3-compatible object store; faster locally but adds another infra concept. Stick with LocalStack Community. |
| `@react-native-google-signin/google-signin` 16 | `expo-auth-session`                                                      | If the project pivots to Expo. As long as we're bare RN, the dedicated Google package is more battle-tested and uses the new Credential Manager API correctly.                                               |
| Drizzle migrations                             | **Sqitch**, **Liquibase**, **plain `*.sql` files via `node-pg-migrate`** | Drizzle generates idempotent SQL diffs from the schema — the most ergonomic option for a TypeScript-first team.                                                                                              |
| AWS SDK v3 (`@aws-sdk/client-s3`)              | AWS SDK v2 (`aws-sdk`)                                                   | Never — v2 is in maintenance mode; v3 is mandatory for new code.                                                                                                                                             |

---

## What NOT to Use (and why)

| Avoid                                                                                                   | Specific problem                                                                                                                                                                                                                                                            | Use Instead                                                                                           |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **VisionCamera as the HEVC capture pipeline**                                                           | V4 uses CameraX on Android (rejected by spec); V5 uses Camera2 on Android but exposes `videoBitRate` only as `low/normal/high` multipliers, not absolute bitrate; neither exposes `KEY_BITRATE_MODE`, `KEY_LATENCY`, or `MAX_B_FRAMES`. Bytes-on-disk would not match spec. | Custom Camera2 + MediaCodec native module. VisionCamera serves preview + `takePhoto()` only.          |
| **CameraX (any version)**                                                                               | Spec rejects. CameraX abstracts away the exact controls we need (B-frame disabling, CBR, KEY_LATENCY); device-specific quirks bleed through.                                                                                                                                | Camera2 directly.                                                                                     |
| **MediaPipeTasksVision iOS pod 0.10.33+**                                                               | Documented XCFramework linking issues with CocoaPods (mediapipe issue #6258, March 2026); 0.10.33+ also adds C++ symbols that conflict with SwiftUI previews (issue #5455).                                                                                                 | Pin `MediaPipeTasksVision = 0.10.21` (also matches Figure's reference).                               |
| **Third-party RN MediaPipe wrappers** (`react-native-mediapipe`, `vision-camera-mediapipe-hands`, etc.) | Unmaintained, pin to old MediaPipe versions, add a JS bridge surface for what is fundamentally a 95-line native module. The figure-app-hands.md reference proves the in-house module is trivial.                                                                            | 95-line custom Kotlin + Swift modules.                                                                |
| **`react-native-camera`** (the older one, by `react-native-camera/react-native-camera`)                 | Archived. Replaced by VisionCamera.                                                                                                                                                                                                                                         | VisionCamera 4.7.3.                                                                                   |
| **Hermes JSC (legacy JS engine)**                                                                       | Cannot run the New Architecture (which requires JSI which requires Hermes). RN 0.80 froze the option.                                                                                                                                                                       | Hermes V1 (default since RN 0.80).                                                                    |
| **`react-native-track-player`, `react-native-sound`** for TTS                                           | Wrong tool — we need text-to-speech, not audio playback.                                                                                                                                                                                                                    | `react-native-tts` (4.1.1) or `expo-speech` (55.0.13).                                                |
| **AsyncStorage** for the upload-queue manifest or auth tokens                                           | Slow, lossy under app-kill on Android, plaintext.                                                                                                                                                                                                                           | `react-native-mmkv` 4.3.1 with encryption for non-secrets, `react-native-keychain` 10 for secrets.    |
| **`expo-camera`** (instead of VisionCamera)                                                             | Doesn't expose ultrawide-camera selection by physical lens, doesn't support custom MediaCodec encoder.                                                                                                                                                                      | VisionCamera + custom native modules.                                                                 |
| **`react-native-firebase` v22 or older**                                                                | Doesn't fully support New Architecture. Some modules pre-v23 had TurboModule issues.                                                                                                                                                                                        | All `@react-native-firebase/*` at **24.0.0** (unified version).                                       |
| **AWS SDK v2 (`aws-sdk`)**                                                                              | Maintenance-mode; bigger bundle; legacy callbacks.                                                                                                                                                                                                                          | `@aws-sdk/client-s3` v3 (modular).                                                                    |
| **Prisma** for tasks search                                                                             | Hybrid-search via raw SQL is awkward in Prisma; you lose type safety on the pgvector + tsvector custom query.                                                                                                                                                               | Drizzle ORM (SQL-first, type-safe).                                                                   |
| **Redis for upload queue** at MVP                                                                       | Adds infra; the upload queue lives on the device anyway, and the backend is stateless per request.                                                                                                                                                                          | Postgres + Drizzle. Add Redis only when load-test shows API rate-limiting needs distributed counters. |
| **`react-native-background-fetch`** for upload                                                          | iOS background-fetch is unreliable for sustained data-sync work; Android needs WorkManager separately.                                                                                                                                                                      | URLSession background config (iOS, native), foreground service of type `dataSync` (Android, native).  |
| **Sentry, Datadog, Bugsnag, Grafana Cloud** at MVP                                                      | Spec explicitly defers all observability beyond Crashlytics + Analytics.                                                                                                                                                                                                    | Firebase Crashlytics + Firebase Analytics.                                                            |

---

## Stack Patterns by Variant

**If we ever migrate to VisionCamera V5:**

- Replace `react-native-worklets-core@1.6.3` → `react-native-worklets@0.8.3`
- Add `react-native-nitro-modules@0.35.6`
- Update all `Camera.takePhoto(...)` call sites → `Camera.capturePhoto(...)`
- Update Frame Processor plugin signatures (Nitro typing system)
- Re-validate Skia frame-processor compatibility
- Reason to delay: V5 shipped 4 months ago (April 2026) and V4 is fine for our use case.

**If iOS 17 minimum is acceptable:**

- iOS deployment target can rise from 15.1 → 17.0
- Enables: AVFoundation HEVC improvements, native LiveText API for a future task-list screen
- Reason to delay: ₹30K-equivalent iPhones (used iPhone XS/SE2/11) need to be supported, and they cap at iOS 17 anyway. 15.1 buys headroom.

**If the API moves to monorepo-shared zod schemas:**

- `shared/types/` package exports zod schemas
- Mobile imports them for client-side validation
- Backend imports them for `request.body` validation in Fastify routes
- This is the canonical pattern with Drizzle + zod; testing-guide.md already alludes to it.

**If we need to scale beyond LocalStack Community for dev:**

- Switch to MinIO (`docker run -d -p 9000:9000 -p 9001:9001 minio/minio server /data`) for higher-fidelity S3 emulation
- Or: dedicated AWS dev account with strict IAM (one-developer-per-bucket-prefix policy)
- Reason to delay: 65 tasks × a small upload load is well within LocalStack Community.

---

## Version Compatibility Matrix

| Package A                                   | Compatible With                                                 | Notes                                         |
| ------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `react-native@0.83.x`                       | `@react-native-firebase/*@24.0.0`                               | All firebase modules unified at v24           |
| `react-native@0.83.x`                       | `react-native-vision-camera@4.7.3`                              | V4 supports New Architecture                  |
| `react-native-vision-camera@4.7.3`          | `react-native-worklets-core@1.6.3`                              | V4 uses worklets-core, NOT worklets           |
| `react-native-vision-camera@4.7.3`          | `react-native-reanimated@3.16.x`                                | Skia frame-processors require reanimated ≥3.0 |
| `react-native-vision-camera@4.7.3`          | `@shopify/react-native-skia@1.x` (≥1.2.1)                       | V4 minimum                                    |
| `com.google.mediapipe:tasks-vision@0.10.21` | `MediaPipeTasksVision@0.10.21` (CocoaPods)                      | Lock both sides at 0.10.21                    |
| `pgvector@0.8.0+`                           | `postgres@16` or `postgres@17`                                  | HNSW iterative scan available                 |
| `@aws-sdk/client-s3@3.1044.0`               | `@aws-sdk/s3-request-presigner@3.1044.0`                        | Always pin both at the same minor             |
| `detox@20.51.1`                             | `react-native@0.83.x`                                           | RN 0.83 added in detox 20.47.0                |
| `fastify@5.8.5`                             | `@fastify/cors@11`, `@fastify/jwt@10`, `@fastify/rate-limit@10` | Fastify 5 plugin generation                   |

---

## OEM-Specific Sharp Edges (Surfaced from Spec + Field Research)

### Xiaomi / MIUI

- **Most aggressive battery optimization** in the matrix. `Settings → Battery → App battery saver → Humyn Labs → No restrictions` is _required_ for sustained-upload survival. Spec already calls out battery-optimization-exemption request at first upload — this needs to specifically deep-link MIUI's "Autostart" settings on Xiaomi devices, which is a different page than stock Android.
- **Region-locked Mi services** can interfere with Google Play Integrity. India ROMs ship clean; Brazil ROMs sometimes ship bundled with extra HMS-style stubs. Compat-check should include a Play Services availability probe.
- **HEVC encoder availability:** Xiaomi 13's Snapdragon 8 Gen 2 has hardware HEVC encode; older Redmi-class devices may use a software fallback that doesn't honor `KEY_LATENCY=1`. Compat-check encode-test mandatory.

### Oppo / OnePlus / OxygenOS / ColorOS

- **Background activity restrictions** are gentler than MIUI but still present. `Settings → Battery → App-specific power management → Humyn Labs → Allow background activity`.
- **Dimensity-chipset variants** (low-end OnePlus / Oppo phones) have weak NNAPI; this matters less for us since MediaPipe runs CPU-delegated, but flags broader thermal headroom.

### Samsung / OneUI

- **Game Booster / App Power Saver** can suspend the foreground service even at FOREGROUND_SERVICE_TYPE_CAMERA. `Settings → Battery → Background usage limits → Never sleeping apps → add Humyn Labs`.
- **Exynos vs Snapdragon S22:** Exynos S22 has historically had unstable HEVC encoder timestamps; the Snapdragon variant is fine. If the perf matrix's S22 is Exynos, expect higher drift figures — flag for the perf gate.

### Vivo / Funtouch

- **iManager / WhiteList:** in-house battery manager that overrides system battery-optimization settings. Spec's Settings deep-link won't reach iManager directly. Best UX is a one-time "Tap here to open iManager" instructional card after first upload.

### Pixel 7a / 8a / 10a (the spec's reference class)

- **Tensor G3/G4/G5 thermal:** sustained 1080p30 HEVC + IMU + audio + occasional MediaPipe is on the edge of what these chips comfortably handle. Specifically, _G3_ (Pixel 8) may throttle to `THROTTLING_SEVERE` after ~22 minutes; the perf gate is 25 minutes. Test on the actual hardware; if it fails, the spec's already documented mid-record auto-stop path triggers cleanly.
- **`SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`** is reliably available on Pixels — many lower-end phones report `UNKNOWN`, which the compat-check rejects.

### iOS — iPhone XR/XS/SE2/11 (₹30K-equivalent iPhone)

- **iPhone XR has no ultrawide rear camera** — fails ultrawide compat-check. Document this in compat-fail UX.
- **iPhone SE 2 / SE 3 have no ultrawide either.** Same.
- **Minimum iPhone with ultrawide is iPhone 11.** This is your iOS floor for the spec to even be runnable.
- **CMMotionManager max rates:** A12+ devices (iPhone XR / 11+) deliver gyro at up to 100 Hz reliably; some report 200 Hz on A14+. Sustained ≥100 Hz is comfortable.

---

## Build / Install Quickstart

```bash
# Mobile (apps/mobile/)
pnpm install
# Pin in package.json (selected entries):
#   "react-native": "0.83.x",
#   "react-native-vision-camera": "4.7.3",
#   "react-native-worklets-core": "1.6.3",
#   "react-native-reanimated": "3.16.x",
#   "@shopify/react-native-skia": "1.x",
#   "@react-native-firebase/app": "24.0.0",
#   "@react-native-firebase/auth": "24.0.0",
#   "@react-native-firebase/crashlytics": "24.0.0",
#   "@react-native-firebase/analytics": "24.0.0",
#   "@react-native-firebase/remote-config": "24.0.0",
#   "@react-native-google-signin/google-signin": "16.1.2",
#   "react-native-mmkv": "4.3.1",
#   "react-native-keychain": "10.0.0",
#   "react-native-tts": "4.1.1",
#   "react-native-config": "1.6.1",
#   "lucide-react-native": "1.14.0",

# Android Gradle (apps/mobile/android/app/build.gradle):
# implementation 'com.google.mediapipe:tasks-vision:0.10.21'
# (place hand_landmarker.task in android/app/src/main/assets/)

# iOS Podfile (apps/mobile/ios/Podfile):
# pod 'MediaPipeTasksVision', '0.10.21'
# (add hand_landmarker.task to the Xcode resources bundle)

# Backend (apps/api/)
pnpm install
# Pin in package.json (selected entries):
#   "fastify": "5.8.5",
#   "@fastify/cors": "11.2.0",
#   "@fastify/jwt": "10.0.0",
#   "@fastify/rate-limit": "10.3.0",
#   "pg": "8.20.0",
#   "drizzle-orm": "0.45.2",
#   "@aws-sdk/client-s3": "3.1044.0",
#   "@aws-sdk/s3-request-presigner": "3.1044.0",
#   "google-auth-library": "10.6.2",
#   "googleapis": "171.4.0",
#   "pino": "10.3.1",
#   "zod": "4.4.3",
# Dev:
#   "vitest": "4.1.5",
#   "pino-pretty": "13.1.3",
#   "drizzle-kit": "0.x"

# Local infra (docker-compose.yml — already referenced in testing-guide.md §A.6)
# services:
#   postgres:    image: pgvector/pgvector:pg17  (bundles pgvector 0.8.0)
#   localstack:  image: localstack/localstack:4
```

---

## Confidence Per Recommendation

| Item                                                                        | Confidence  | Verification source                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN 0.83.x as the pin                                                        | HIGH        | reactnative.dev releases page, callstack.com 0.83 announcement                                                                                                                                                                    |
| VisionCamera 4.7.3 (V4 line)                                                | HIGH        | npm registry, V4 vs V5 release notes, github.com/mrousavy/react-native-vision-camera                                                                                                                                              |
| react-native-worklets-core 1.6.3                                            | HIGH        | npm registry                                                                                                                                                                                                                      |
| MediaPipe Android 0.10.21 + iOS pod 0.10.21                                 | MEDIUM-HIGH | Maven Central + figure-app-hands.md decompile + iOS pod issue #6258 (knockout of 0.10.33+)                                                                                                                                        |
| Custom Camera2 + MediaCodec capture pipeline (NOT VisionCamera)             | HIGH        | Spec rejection of CameraX + Marc Rousavy's "Camera APIs on Android" blog confirming CameraX abstracts away the controls we need                                                                                                   |
| MediaCodec encoder recipe (KEY_BITRATE_MODE, KEY_LATENCY, KEY_MAX_B_FRAMES) | HIGH        | Android MediaFormat docs + Google's SampleVideoEncoder + Codec Wiki MediaCodec page                                                                                                                                               |
| AVAssetWriter HEVC recipe (`AVVideoAllowFrameReorderingKey: false`)         | HIGH        | Apple Developer Forums threads 91165 / 90902, openradar rdar://47395179                                                                                                                                                           |
| Foreground service type bitmask                                             | HIGH        | developer.android.com/about/versions/14/changes/fgs-types-required                                                                                                                                                                |
| Play Integrity Standard + Google-managed decryption                         | HIGH        | developer.android.com/google/play/integrity/standard                                                                                                                                                                              |
| `@react-native-firebase/*` 24.0.0 unified                                   | HIGH        | npm registry                                                                                                                                                                                                                      |
| `@react-native-google-signin/google-signin` 16.1.2 + Credential Manager     | HIGH        | npm registry + react-native-google-signin docs                                                                                                                                                                                    |
| Detox 20.51.1 supports RN 0.83                                              | HIGH        | Detox releases, 20.47.0 changelog                                                                                                                                                                                                 |
| LocalStack Community supports S3 multipart presigned                        | MEDIUM-HIGH | LocalStack 4.x has resolved historical pre-3.x multipart issues; community docs list `CreateMultipartUpload` and `UploadPart` as supported. Pro is not required for the multipart flow. Verify in dev with a one-time smoke test. |
| pgvector 0.8.0 + HNSW + ts_vector RRF SQL                                   | HIGH        | postgresql.org/about/news/pgvector-080-released, multiple Tigerdata + Neon + ParadeDB write-ups                                                                                                                                   |
| AWS SDK v3 multipart presigned recipe                                       | HIGH        | docs.aws.amazon.com presigned + multipart-upload pages, github.com/aws/aws-sdk-js-v3                                                                                                                                              |
| Drizzle ORM over Prisma for hybrid search                                   | MEDIUM      | Drizzle's raw SQL escape hatch is cleaner; Prisma is also viable but more friction.                                                                                                                                               |
| `react-native-tts` 4.1.1 for en-IN                                          | MEDIUM      | Library is unmaintained but functional; voice availability is device-dependent. Spec's fallback chain handles missing voices. Acceptable for MVP.                                                                                 |
| Custom IMU capture inside `HumynCapture`                                    | HIGH        | SensorManager + CMMotionManager are platform APIs; no third-party library is needed or wanted.                                                                                                                                    |

---

## Sources

### Verified — npm registry (queried 2026-05-07)

- `react-native@0.85.3` (latest stable; pin **0.83.x**)
- `react-native-vision-camera@5.0.9` (latest; pin **4.7.3**)
- `react-native-worklets-core@1.6.3`, `react-native-worklets@0.8.3`
- `react-native-reanimated@4.3.0`
- `@shopify/react-native-skia@2.6.2`
- `@react-native-firebase/{app,auth,crashlytics,analytics,remote-config}@24.0.0`
- `@react-native-google-signin/google-signin@16.1.2`
- `detox@20.51.1`
- `fastify@5.8.5`
- `@aws-sdk/client-s3@3.1044.0`, `@aws-sdk/s3-request-presigner@3.1044.0`
- `drizzle-orm@0.45.2`, `pg@8.20.0`, `zod@4.4.3`, `vitest@4.1.5`
- `pino@10.3.1`, `pino-pretty@13.1.3`
- `react-native-mmkv@4.3.1`, `react-native-keychain@10.0.0`, `react-native-tts@4.1.1`
- `lucide-react-native@1.14.0`
- `google-auth-library@10.6.2`, `googleapis@171.4.0`

### Verified — Official documentation

- [Android MediaFormat KEY\_\* constants](https://developer.android.com/reference/android/media/MediaFormat) — encoder configuration keys
- [Android Foreground Service Types (Android 14+)](https://developer.android.com/about/versions/14/changes/fgs-types-required) — manifest declaration + runtime API
- [Android Foreground Service Types reference](https://developer.android.com/develop/background-work/services/fgs/service-types) — camera/microphone/dataSync semantics
- [Android 15 Foreground Service changes (dataSync 6h cap)](https://developer.android.com/about/versions/15/changes/foreground-service-types)
- [Play Integrity API — Standard request](https://developer.android.com/google/play/integrity/standard)
- [Play Integrity API — Setup](https://developer.android.com/google/play/integrity/setup)
- [Play Integrity API — Verdicts](https://developer.android.com/google/play/integrity/verdicts)
- [MediaPipe Hand Landmarker — Android guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/android)
- [MediaPipe Hand Landmarker — iOS setup](https://ai.google.dev/edge/mediapipe/solutions/setup_ios)
- [Maven Central — com.google.mediapipe:tasks-vision](https://mvnrepository.com/artifact/com.google.mediapipe/tasks-vision)
- [Apple Developer — AVAssetWriter](https://developer.apple.com/documentation/avfoundation/avassetwriter)
- [Apple Developer Forums — AVAssetWriter HEVC discussion (thread 91165)](https://developer.apple.com/forums/thread/91165)
- [WWDC 2017 Session 511 — Working with HEIF and HEVC](https://asciiwwdc.com/2017/sessions/511)
- [AWS S3 — multipart upload overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [AWS S3 — presigned URL upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [pgvector 0.8.0 release announcement](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [pgvector GitHub README](https://github.com/pgvector/pgvector)

### Verified — Vendor blogs / authoritative posts

- [VisionCamera V5 announcement (Margelo blog)](https://blog.margelo.com/whats-new-in-visioncamera-v5)
- [VisionCamera V4 release notes (GitHub)](https://github.com/mrousavy/react-native-vision-camera/releases/tag/v4.0.0)
- [VisionCamera Skia Frame Processors guide](https://react-native-vision-camera.com/docs/guides/skia-frame-processors)
- [Marc Rousavy — Camera APIs on Android](https://mrousavy.com/blog/Camera-APIs-on-Android) (CameraX vs Camera2 tradeoffs)
- [React Native 0.83 release coverage (Callstack)](https://www.callstack.com/events/react-native-0-83)
- [Hybrid search with PostgreSQL and pgvector — Jonathan Katz](https://jkatz05.com/post/postgres/hybrid-search-postgres-pgvector/)
- [Hybrid Search in PostgreSQL: The Missing Manual — ParadeDB](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
- [Building Hybrid Search for RAG with pgvector + tsvector + RRF — DEV.to](https://dev.to/lpossamai/building-hybrid-search-for-rag-combining-pgvector-and-full-text-search-with-reciprocal-rank-fusion-6nk)

### Verified — GitHub / package issues (knockout findings)

- [MediaPipe iOS pod 0.10.33 XCFramework issue #6258 (March 2026)](https://github.com/google-ai-edge/mediapipe/issues/6258) — knockout of 0.10.33+
- [Detox React Native 0.79 support (issue #4799)](https://github.com/wix/Detox/issues/4799)
- [Detox 20.47.0 — RN 0.83 support added](https://github.com/wix/Detox/releases)
- [Figure's Minutes app decompile (in-repo: `figure-app-hands.md`)](file:///Users/adnaan/Documents/hl-homelander/figure-app-hands.md) — confirms 0.10.21 + RunningMode.IMAGE pattern

---

_Stack research for: Homelander (Humyn Labs Capture) — Android-first egocentric data-collection app_
_Researched: 2026-05-07_
