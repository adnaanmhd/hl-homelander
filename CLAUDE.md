<!-- GSD:project-start source:PROJECT.md -->

## Project

**Homelander**

Homelander is the codename for **Humyn Labs Capture** — an Android-first crowdsourced data-collection app that records strict-spec egocentric (head-mounted) video, audio, and IMU streams of people performing everyday tasks. The captured data trains physical/embodied AI: VLA/VLN models and humanoid robotics. Brand line: _Real Humyns. Real Intelligence._ MVP ships in three phases of distribution within one milestone — signed APK (early-user clan-chief distribution) → Play Store → iOS App Store — to users in India and Brazil, ages 18–35, on ₹30K+ phones, acquired through KGeN's clan-chief network.

**Core Value:** **On-device capture quality is non-negotiable.** Every uploaded segment must hit 1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment between video, audio, and IMU. Without that, the data is worthless for training — payouts, retention, and scale all assume the bytes are usable. If anything else fails, we can fix it. If capture quality slips, the project fails.

### Constraints

- **Tech stack — Designs LOCKED.** `prototype.html`, `design-spec.md`, and `engineering-handoff.md` are the design source of truth. No new design work — every screen, state, copy string, animation curve, and token comes verbatim from those files. Task icons come from `design-system/task-icons/`. — _Why: extensive design pass already complete; rework wastes the investment and introduces drift._
- **Tech stack — Capture spec LOCKED.** Every value in `idea-brief.md` §2.1 is hard. Any device or codec choice that can't deliver these numbers is rejected at compat-check time. — _Why: bytes-on-disk quality is the project's reason to exist._
- **Tech stack — capture pipeline:** Camera2 + MediaCodec (Android), AVCaptureSession + AVAssetWriter (iOS). CameraX rejected. — _Why: B-frame and bitrate-mode controls aren't reliably exposed in higher-level APIs._
- **Tech stack — hand gate:** MediaPipe HandLandmarker (`hand_landmarker.task` ~7.8 MB) wrapped in custom Kotlin (Android) / Swift (iOS) RN modules. IMAGE mode, single-frame, hand-count only. — _Why: matches Figure's pattern; no third-party RN wrapper introduces a dependency tree we don't need._
- **Tech stack — app framework:** React Native (Hermes new architecture) with native modules for capture, hand detection, and upload service. — _Why: testing-guide assumes RN + Kotlin TurboModules; engineering-handoff also leaves RN as the recommended path; avoids dual codebase maintenance for the surface UI._
- **Tech stack — backend:** Fastify + Postgres (with pgvector + ts_vector for hybrid task search) + S3 (LocalStack in dev), Vitest for tests. — _Why: established in testing-guide §A.6 and §B.1; matches the multipart presigned-URL upload model._
- **Auth:** Google Sign-In + Play Integrity at sign-in only. Per-upload attestation deferred. APK build flavor bypasses install-source check via Remote Config (Play Store builds cannot opt into the bypass). — _Why: balances fraud floor with rollout flexibility for early-user APK distribution._
- **Distribution sequence:** signed APK (early-user clan-chief distribution) → Play Store fast-follow → iOS App Store fast-follow (≤2 weeks after Play Store). All within the same MVP milestone. — _Why: chief network needs the app before Play approval cycles complete; Play Integrity is preserved on the Play track._
- **Geos / locale:** India + Brazil at MVP; English only. Localization deferred. — _Why: clan-chief network is concentrated there; localization is post-launch._
- **Battery / thermal budget:** 25-min sustained capture on Pixel 7a-class without thermal cut-out, with ≤8% battery drain. — _Why: clan members may record back-to-back sessions; thermal cut-outs lose data._
- **No notifications channel.** No `POST_NOTIFICATIONS`, no FCM/APNs at MVP. — _Why: opt-in design isn't done; deferring keeps the surface small._
- **No success metrics.** MVP ships ship-by-vibe — no quant gates blocking phase completion. — _Why: explicit choice; metrics phase is a v2 concern (see `strategic-suggestions.md` §1)._
- **Privacy / consent:** consent text in `idea-brief.md` §5.2 is the canonical version; consent timestamps logged server-side with version. Coarse location only — no precise GPS leaves the device. — _Why: regulatory exposure (DPDP / LGPD) and brand trust._
- **Files never re-encoded.** MP4, IMU CSV, and metadata JSON travel byte-for-byte from device to S3. — _Why: training pipeline expects the encoder's exact bytes (timestamps, tags, every metadata box)._
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

Full stack pins, configuration recipes, alternatives considered, version compatibility matrix, OEM-specific edge cases, and sources live in `.planning/research/STACK.md`. Read that file when picking or upgrading a library, debugging an OEM-specific issue, or wiring up a configuration recipe.

**One-line summary of locked choices** (full rationale in STACK.md):

- **Mobile:** RN 0.83 + Hermes (New Arch) · VisionCamera 4.7.3 (preview/photo only) · custom `HumynCapture` Kotlin/Swift module for HEVC pipeline (Camera2 + MediaCodec / AVAssetWriter) · MediaPipe HandLandmarker 0.10.21 in custom `HandDetector` module · `@react-native-firebase/*` 24.0.0 · `@react-native-google-signin/google-signin` 16.1.2 (Credential Manager) · MMKV 4.3.1 · Keychain 10.0.0
- **Backend:** Node 22 LTS · Fastify 5.8.5 · Drizzle ORM 0.45.2 · `pg` 8.20.0 · `@aws-sdk/client-s3` 3.1044.0 (v3 only) · zod 4.4.3 · vitest 4.1.5
- **Data:** Postgres 17 · pgvector 0.8.0 (HNSW) + tsvector GIN + RRF for hybrid `tasks` search · LocalStack Community 4.x for dev S3
- **Build:** AGP 8.7+ / Gradle 8.11+ / Kotlin 2.0.21+ / compileSdk 35 / minSdk 26 / JDK 17 · Xcode 16+ / iOS deployment 15.1 / CocoaPods 1.16+

**Hard rules** (do not violate without re-reading STACK.md):

- Capture pipeline must NOT route through VisionCamera or CameraX — encoder controls aren't exposed.
- MediaPipe pinned at **0.10.21 on both Android and iOS**. iOS pod 0.10.33+ has known XCFramework issues (mediapipe#6258).
- VisionCamera stays on V4 (4.7.3) with `react-native-worklets-core` 1.6.3 — NOT V5 + `react-native-worklets`.
- AWS SDK v3 only. Never `aws-sdk` v2.
- All `@react-native-firebase/*` modules at the same unified version (24.0.0).
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

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
