# Project Research Summary

**Project:** Homelander (Humyn Labs Capture)
**Domain:** Android-first crowdsourced egocentric (head-mounted) video / audio / IMU data-collection app for embodied-AI training; paid-per-task; React Native + native modules; Fastify + Postgres + S3 backend; KGeN clan-chief distribution in India + Brazil
**Researched:** 2026-05-07
**Mode:** Validation + version-pinning + sharp-edge surfacing on top of an unusually-tight locked spec
**Confidence:** HIGH on capture-pipeline + architecture; HIGH on stack pins; MEDIUM on India/Brazil network specifics, OEM battery-manager defeat paths, and competitor-implementation specifics

---

## Executive Summary

The spec for Homelander is unusually tight for a greenfield project: `idea-brief.md`, `design-spec.md`, `engineering-handoff.md`, `task-taxonomy.md`, `prototype.html`, and `video_metadata.json` lock the architecture, the screens, the capture spec, the task catalog, and the metadata schema. Stack-discovery research therefore wasn't useful; the parallel research was deliberately framed as **validation + gotcha-surfacing** of an already-decided design, and that's what this synthesis distills. **The locked spec survives the research intact.** Camera2 + MediaCodec, AVCaptureSession + AVAssetWriter, MediaPipe HandLandmarker IMAGE-mode, S3 multipart presigned, Fastify + Postgres + S3 — all confirmed against current 2026 packages, vendor docs, and tracker bugs. What the research adds is a layer of **second-order knowledge** that won't be visible until a real device on a real network in a real warm room hits it: which encoder hints are silently ignored on which SoC, where Android 15's `dataSync` 6-hour cap kills the upload story, why VisionCamera is fine for the gate but fatal for the capture pipeline, and which OEM battery managers defeat `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` on a meaningful slice of the target fleet.

The recommended approach is to **respect the spec, then harden every layer where vendors lie about advertised behavior**. Three patterns repeat: (1) capture-pipeline contracts are hints not contracts (KEY_LATENCY, OIS-OFF, HDR-disabled, REALTIME-timestamp, sustained-100-Hz-IMU all need behavioral verification, not metadata reads), (2) Android 14/15 background restrictions force a UIDT JobService + foreground-service-type-downgrade architecture for upload that the brief doesn't explicitly call out, and (3) the capture-spec's IMU richness is itself the strategic moat — server-side IMU liveness (currently deferred to v2) is the single highest-leverage anti-fraud move and should be promoted into MVP backend scope before payouts go live.

The key risks shaping phase boundaries are: **device-class compatibility is a distribution-planning gate**, not just an engineering check (8% of the fleet failing REALTIME-timestamp breaks chief word-of-mouth before payouts start); **the upload pipeline restructure for Android 14/15 is foundational** and must be designed up-front, not patched in; **the hash-verify-then-delete flow has a verified-event-delivery problem** that needs explicit reconciliation logic on app launch; and **storage cost at 1M-hour scale doesn't survive S3 Standard** — lifecycle policies are a day-zero infra concern, not a v2 optimization. Capture-quality is the project's reason to exist; everything else can be fixed later, but the bytes have to be right.

---

## Key Findings

### Recommended Stack

The locked stack survives validation. Critical version-pinning surprises:

- **`react-native` 0.83.x** — first "no breaking changes" stability release (Dec 2025); Hermes V1 is default since 0.80; New Architecture is the only architecture. Going newer (0.85/0.86) breaks Detox + native module ecosystem.
- **`react-native-vision-camera` 4.7.3 (V4 line)** — V5 is a Nitro-modules rewrite with breaking API changes; spec, design, and Figure's reference all use V4's `Camera.takePhoto()`. **VisionCamera serves preview + photo-snap for the hand-gate ONLY; the HEVC capture pipeline must be a separate custom Camera2 + MediaCodec native module** because B-frame disabling, CBR mode, and KEY_LATENCY control aren't reliably exposed in higher-level APIs.
- **MediaPipe `tasks-vision` 0.10.21** (both Android Maven and iOS CocoaPod) — pinned for parity. **iOS pod 0.10.33+ has known XCFramework linking issues**; do not auto-update.
- **`fastify` 5.8.5 + `drizzle-orm` 0.45.2 + Postgres 17 + pgvector 0.8.0** — Drizzle preferred over Prisma for explicit `tsvector + pgvector` hybrid-search SQL; HNSW index over IVFFlat at the 65-task corpus size.
- **`@aws-sdk/client-s3` v3.1044.0** with `@aws-sdk/s3-request-presigner` — modular SDK v3 only; v2 (`aws-sdk` 2.x) entering maintenance.
- **LocalStack Community v4.x** — multipart presigned URLs work in v4+; **LocalStack Pro is NOT required for MVP**.
- **`@react-native-google-signin/google-signin` 16.1.2** — v13+ migrated to **Credential Manager API on Android** (mandatory for Android 14+). Configure with **Web** OAuth client ID, not Android.
- **Play Integrity Standard requests** (NOT Classic, which is deprecated higher-latency); **Google-Managed decryption** (default) — backend never handles keys.
- **`react-native-mmkv` 4.3.1** with **separate instances per concern** (`app`, `recordings`, `uploads`) — corruption isolation; native upload daemon and JS read/write disjoint key prefixes.

Full version table, configuration recipes (HEVC encoder for Android + iOS, MediaPipe wiring, foreground service manifest, Drizzle schema, RRF hybrid-search SQL), and "what NOT to use" calls live in [STACK.md](./STACK.md).

### Expected Features

The locked feature set is solid for the *capture-quality-first* MVP thesis. The deliberate exclusions (notifications, async-QA UI, payouts UI, retention loops) are defensibly out of scope. **But the research surfaced ~6 table-stakes oversights** that a barebones recording app should ship — most are sub-day work and likely oversights, not deliberate cuts:

**Add to MVP (P1, total ~5-7 days):**
- **In-app feedback / "Report a problem" form** — the only current channel is `[EMAIL_ADDRESS]` mailto in Help Center; users on a buggy 11pm cellular session uninstall instead of emailing.
- **App version display** in Profile or Help Center footer.
- **Pull-to-refresh** on Tasks / History / Home tile filters.
- **Network-state surfacing** (subtle banner in Pending Uploads tile when offline).
- **Recurring storage check** before each recording start (compat-time check is one-time; users record for weeks).
- **Compat-fail "what now" page** — engineering-handoff §19 Q2 is undefined; without recovery copy the app becomes a brick.
- **"Don't have a rig yet" off-ramp** on tutorial Rig Screen.
- **Server-side rate limits per user / IP** (backend; trivial; catches early farming pre-payouts).
- **Updated payouts copy with explicit window date** — "Payments coming soon" is the single largest known retention bomb.

**P2 (post-MVP, sequenced first):**
- **Per-recording QA-status chip** on History rows (the "Feedback (coming soon)" hook is already in the spec — keep that slot live).
- **Earnings ledger** (read-only) — partially covered by contribution tile but framed as duration not earnings.
- **Server-side IMU liveness fraud check** — backend-only, no app changes; the capture spec is already collecting the data.
- **Server-side perceptual-hash dedup**.
- **Wi-Fi-only upload toggle + monthly data ceiling** when cellular complaints emerge.

**Defer (P3 / v2+):** Streaks, clan-leaderboards, reputation tiers, in-app referrals, daily quests, in-app payments / cash-out, notifications channel, localization (Hindi / Portuguese), continuous on-device hands-in-frame, real-time framing guides, dark mode for non-recording surfaces.

**Closest published analogue:** Micro1's iPhone-on-forehead workflow (MIT Tech Review, April 2026) — Tesla / Figure-adjacent contracting at $15/hr with AI + human review. The Glassdoor / Indeed reviews of Micro1 / Outlier / Toloka all cluster the same complaints: **payout opacity** and **rejection-without-feedback**. Both have lightweight v1.x answers and are the largest known retention risks beyond capture quality itself.

Full landscape, anti-feature reasoning, competitor matrix, and feature dependency graph in [FEATURES.md](./FEATURES.md).

### Architecture Approach

**Pattern:** JS-as-orchestrator, native-as-pipeline. The JS layer never touches a frame buffer, an audio sample, an IMU reading, or a TCP chunk byte. It sends commands and receives high-level events. All hot paths run in Kotlin/Swift.

**Major components:**

1. **`HumynCapture` native module** (Kotlin + Swift) — Camera2 / AVCaptureSession lifecycle, MediaCodec / AVAssetWriter HEVC encoder, AudioRecord / AVAudioRecorder, SensorManager / CMMotionManager, MP4 mux, IMU CSV writer, SHA-256, drift compute, metadata JSON. Pure native — RN never touches a frame.
2. **`HumynHandDetector` native module** (Kotlin + Swift) — One-shot bitmap → hand-count via MediaPipe HandLandmarker. ~95 LOC each platform; direct port of Figure's pattern.
3. **`HumynUpload` native module** — **Two services in a trench coat on Android**: a `dataSync` foreground service while in-app + a **UIDT JobService** that owns the chunk PUT loop and survives process kill. iOS: `URLSession.background(withIdentifier:)`.
4. **`HumynIntegrity` native module** — Play Integrity (Android) + DeviceCheck (iOS), called once at sign-in.
5. **JS layer** — Navigation, screens, **`recState` XState machine** (the only state machine that earns its keep), Zustand stores for everything else (`auth`, `tasks`, `recordings`, `uploads`, `contrib`, `prefs`), MMKV persist with separate instances per concern.
6. **Fastify HTTP API** — All synchronous client requests, presigned-URL minting, hybrid task search (pgvector + tsvector via Reciprocal Rank Fusion), idempotency, RFC 7807 errors. Single binary, multiple ECS replicas behind ALB.
7. **Hash-verify worker** — Same TS codebase, BullMQ consumer on Redis, deployed as a separate ECS task scaled on queue depth. Re-hashes MP4 + CSV from S3 after multipart-complete; flips `recordings.qa_status='verified'`. **Not Lambda at MVP** — switch to S3 EventBridge → Lambda only at 1M-hour scale.
8. **Postgres (RDS) + Redis (ElastiCache) + S3 + CloudFront** — single Postgres for all durable state including pgvector + tsvector hybrid search; Redis for BullMQ broker + idempotency cache; S3 with **lifecycle policy from day 0** (Glacier IR at +7 days, Deep Archive at +90 days); CloudFront signed URLs for in-app player playback only (≤5-minute TTL).

**Key data-flow principles:**
- **Two-clock upload:** JS owns the queue *model*; native owns the live transfer. JS writes `queue.row.{id}` keys; native writes `queue.row.{id}.chunks.{partNumber}` keys. No collision. Cold-boot reconciliation by querying native for in-flight transfers and merging with MMKV state.
- **Files NEVER re-encoded** — server treats MP4 as opaque; only the worker reads bytes; only to hash-verify; never to decode.
- **Local file deletion gated on backend `verified` event**, NOT on upload-success-200. Verified events delivered piggy-backed on next API response (no FCM/APNs at MVP); app-launch sweep reconciles missed events.

Full system diagram (3 planes: device → backend → infra), recommended monorepo layout, foreground-service architecture by lifecycle phase, scaling considerations, and 6 architectural patterns + 7 anti-patterns in [ARCHITECTURE.md](./ARCHITECTURE.md).

### Critical Pitfalls

The pitfalls research surfaced **17 issues**, 12 of which are PROJECT-KILLER severity, 5 of which are QUALITY-DEGRADER. Each one is something that won't fire on Pixel 10a in dev. The top ones reshape phase boundaries:

1. **HEVC encoder silently emits B-frames despite `KEY_LATENCY=1`** on MediaTek Dimensity / Snapdragon 7-and-below / Exynos 1280-1380 (the ₹20-30K Indian/Brazilian fleet). MediaFormat hints aren't contracts. **Prevention: NAL-unit parse on compat-time test clip + first 30s of every recording.** Capture-pipeline phase gate.

2. **`SENSOR_INFO_TIMESTAMP_SOURCE != REALTIME` on a meaningful slice of the target fleet** — Camera2 advertises but doesn't deliver on cheap-tier MTK / Unisoc SoCs. **Prevention: standalone compat-only APK to 50 chiefs pre-rollout to harvest device-model coverage data.** This is a **distribution-planning gate, not just an engineering check.**

3. **IMU sustained 100Hz drops under thermal load** even when the spec advertises 500Hz, hidden by sensor batching. **Prevention: compat-check upgrade with `maxReportLatency=0` AND inter-sample p99 ≤ 12ms; runtime continuous monitoring with `imu_min_rate_hz_observed_p1` field; reject segments client-side if rate drops below 80Hz.**

4. **HDR auto-engages on Pixel 8/9/10 + Galaxy S/A 2024+** despite `CONTROL_SCENE_MODE_DISABLED` — bright kitchens, window backlight. **Prevention: set `DynamicRangeProfile.STANDARD` (Android 13+) + verify color tags in MP4 are bt709 not bt2020.**

5. **OIS active despite `LENS_OPTICAL_STABILIZATION_MODE_OFF`** on Galaxy S22+ / OnePlus 11 / Xiaomi. **Prevention: read `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` at compat; runtime CaptureResult readback.**

6. **Foreground-service-from-background ban kills upload-resume on Android 14+; `dataSync` capped at 6h/24h on Android 15+.** The brief's §7.4 line "service survives backgrounding and OS eviction" is structurally impossible without a redesign. **Prevention: dynamic service-type lifecycle (downgrade `camera|microphone|dataSync` → `dataSync` post-recording → stop after 5 min idle); UIDT JobService for true background; WorkManager for retry constraints.** This is a foundational design call, not a fix-up.

7. **OEM battery managers (Xiaomi MIUI, Oppo/Realme ColorOS, Vivo FunTouch, Samsung OneUI) defeat `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` on a non-trivial fraction of the fleet.** MIUI 14 requires THREE user actions; the standard exemption alone is insufficient. **Prevention: in-app OEM-specific walkthrough at first upload with per-OEM deep-links to Settings.**

8. **MediaPipe HandLandmarker false-negatives on Fitzpatrick V/VI under warm-low-light** — Indian-kitchen 2700K bulb conditions. **Discriminatory impact** that could become a project-killer on chief-network-trust grounds. **Prevention: per-population confidence tuning via Remote Config (drop `minHandDetectionConfidence` from 0.5 to 0.3 to 0.1 if Skip-rate >30% in any locale); track Skip-rate as a leading bias indicator.**

9. **`Camera.takePhoto()` warm-up latency** of 2-4 seconds on first call leaves the gate ring stuck at 0. **Prevention: pre-warm the photo pipeline at recording-screen mount.**

10. **Bitmap memory pressure** if `takePhoto` returns full-resolution photo (12MP × 4 = 48MB allocation × gate cadence). **Prevention: pin photo resolution at 320×240; native `inSampleSize=4` + `RGB_565`; explicit `bitmap.recycle()`.**

11. **`MediaMuxer` / `FragmentedMp4Muxer` `IllegalStateException` 30-60s into multi-track recording** (active bug androidx/media #1781). **Prevention: use AOSP MediaMuxer directly, NOT androidx-media's wrapper; try/catch around `writeSampleData` with finalize-and-restart fallback.**

12. **Cellular MTU blackholes on Jio (CGNAT) + Vivo Brasil** cause TLS multipart PUTs to silently retry-storm. **Prevention: TCP_MAXSEG=1280; smaller (2MB) chunks on cellular; 30-second no-progress abandon-and-retry-with-fresh-socket.**

13. **TV-replay attack against the on-device hand-gate is trivial** — phone-on-tripod pointing at TV showing a real recording defeats the gate completely. Combined with Play Integrity at sign-in only, **Day 1 of payouts has zero serious fraud detection.** **Prevention: PROMOTE IMU LIVENESS (currently deferred to v2) into MVP backend scope** — zero on-device cost, the data is already collected. Lock payouts behind manual-QA gate for the first 6 weeks.

14. **DPDP (India) + LGPD (Brazil) bystander consent** — uploader-attests model is fragile. **Prevention: tighten consent text; recording-time bystander reminder; retain Indian + Brazilian counsel before Play Store launch; document ANPD / DPB takedown response procedure now.**

15. **Hash-verify-then-delete delivery race** — verified events can be dropped on app uninstall+reinstall, account roaming, or 3-week disuse. **Prevention: include verified events on every API response; app-launch sweep reconciles backend's known list against local files.**

16. **Storage cost at 1M-hour scale doesn't survive S3 Standard** — $10M/year vs $1-2M/year on aggressive Glacier tiering. **Prevention: lifecycle policy from day 0** (Glacier IR at +7d, Deep Archive at +90d).

17. **Tensor G3 (Pixel 8a) vs Tensor G5 (Pixel 10a) thermal divergence** — 60% throttle vs sustained-cool. **Pixel 10a as primary dev device hides thermal cut-outs that Pixel 7a/8a will hit.** **Prevention: add Pixel 8a as the explicit thermal-stress device.**

Full pitfall details in [PITFALLS.md](./PITFALLS.md).

---

## Cross-Cutting Findings (mentioned in 2+ research dimensions)

These should shape phase structure:

| Finding | Stack | Features | Architecture | Pitfalls |
|---|:---:|:---:|:---:|:---:|
| **Capture pipeline must be Camera2 + MediaCodec custom native module — VisionCamera fine for gate but cannot carry HEVC** | x | | x | x |
| **Compat-check must verify *behavior*, not advertised metadata** | x | | x | x |
| **Android 14/15 background restrictions force foreground-service-type-downgrade + UIDT JobService for upload** | x | x | x | x |
| **OEM battery-manager walkthrough is itself an MVP roadmap line item** | x | x | | x |
| **MediaPipe HandLandmarker confidence + cadence belong in Remote Config from day 1** | x | x | x | x |
| **Server-side IMU liveness should be promoted from v2-deferred to MVP backend scope** | | x | | x |
| **Verified-event delivery needs explicit reconciliation** (no FCM/APNs means polling, polling has known dropouts) | | | x | x |
| **S3 lifecycle policy is a day-zero infra concern**, not a v2 cost optimization | | | x | x |
| **Pixel 7a/8a (Tensor G2/G3) is the perf benchmark, not Pixel 10a (Tensor G5)** | | | | x |
| **In-app feedback channel + app-version display + payouts-window-date copy are sub-day MVP additions** | | x | | |
| **Distribution-recon APK to clan chiefs before APK rollout** | | x | | x |

---

## Decisions the Roadmap Must Resolve

1. **What is the published payout-window date?** — replaces "Payments coming soon" copy.
2. **Is the in-app feedback channel additive to or replacing the email mailto?**
3. **Who owns rig-distribution / rig-replacement operationally — clan chiefs or central ops?**
4. **What QA accept/reject signal is the backend going to expose, and on what schedule?** — gates v1.1 chip + earnings ledger.
5. **Is 1M hours a true target or aspirational?** — affects lifecycle aggressiveness urgency.
6. **Embedding provider for `/tasks` semantic search** — OpenAI `text-embedding-3-small` default vs local sentence-transformers.
7. **Hash-verify worker placement** — BullMQ + ECS at MVP; Lambda at 1M-hour scale. Migration trigger should be explicit, not implicit.
8. **APK build flavor application ID** — `ai.humynlabs.capture.apk` vs `ai.humynlabs.capture` — locked before flavor structure built.
9. **Are the 7 added table-stakes items in scope for MVP?** — research recommends yes; team confirms.

---

## Implications for Roadmap

### Phase 0: Monorepo + tooling + shared types
**Rationale:** Blocks everything. Zod schema for `Recording` is the contract for HumynCapture's metadata JSON output AND the backend's `POST /recordings` body shape — both downstream phases depend on it.
**Delivers:** pnpm workspaces; CI skeleton; LocalStack docker-compose; Drizzle migration tooling; `shared/types/Recording.ts` + `shared/drift/`; version-pin recipe locked.
**Research flag:** Standard. Skip research-phase.

### Phase 1: Backend skeleton + Auth + Distribution Recon
**Rationale:** Backend stub + Google Sign-In + Play Integrity blocks mobile auth flow. **This phase ALSO ships the standalone compat-only APK to 50 clan chiefs** to harvest device-model coverage data — Pitfall 2 is a distribution-planning gate.
**Delivers:** Working backend in dev; `/auth/google`, `/me`, `/app/version`, `/tasks` (taxonomy seed); compat-only APK harvest; addressable-fleet go/no-go.
**Avoids:** Pitfall 2 surprising rollout; Pitfall 11 backend schemas locked early.
**Research flag:** **NEEDS phase research** — Credential Manager migration on Android (post-Sept 2024); Play Integrity Standard vs Classic decryption.

### Phase 2: Mobile shell + Onboarding + Permissions + Compat Check
**Rationale:** Parallelizes with Phase 3. Compat-check is the device-class gate for everything downstream — upgraded compat (NAL-unit parse, IMU p99, REALTIME readback, OIS check, HDR-mode SDR-force, sustained-110°-dFOV) lands here.
**Delivers:** Splash → Sign-up → Permissions → Compat → Tutorial; bottom nav; Profile + Help Center (verbatim copy); Forced upgrade gate; design tokens; XState `recState` skeleton; **adds in-app feedback form, app-version display, pull-to-refresh, compat-fail recovery copy, rig off-ramp** (4 of the 7 P1 gaps).
**Avoids:** Pitfalls 1, 2, 3, 4, 5 — all blocked at compat by behavioral verification, not metadata reads.
**Research flag:** **NEEDS phase research** — upgraded compat methodology (NAL-unit parser, IMU inter-sample p99 measurement under preview load).

### Phase 3: HumynCapture native module
**Rationale:** Slowest, riskiest critical-path phase. Build on real Pixel 8a (Tensor G3 thermal benchmark — Pitfall 17) and a Helio-class budget device side-by-side.
**Delivers:** HEVC Main / 8Mbps CBR / GOP 30 / no B-frames / no HDR pipeline; SystemClock.elapsedRealtimeNanos timestamping; ±1ms drift methodology with residual-subtraction; per-segment metadata JSON with `max`/`mean`/`p99` drift; SHA-256 pre-upload; fragmented MP4 with 30s moov flush; 10-min auto-segmentation with 0.5s gap; foreground service `camera|microphone|dataSync`.
**Uses:** Custom Kotlin TurboModule (no VisionCamera); SensorManager; AOSP MediaMuxer (NOT androidx-media).
**Avoids:** Pitfalls 1, 3, 4, 5, 11, 17.
**Research flag:** **NEEDS phase research** — MediaCodec encoder configuration on real MTK / Exynos / Snapdragon-7 hardware; AOSP MediaMuxer fragmented-mode behavior on Android 14+.

### Phase 4: HumynHandDetector native module + hand-gate UI
**Rationale:** Depends on Phase 3 only for camera-preview surface; can be built mostly in isolation. Pitfalls 8, 9, 10 live here. Remote Config integration is a Phase-1 backend dependency.
**Delivers:** MediaPipe HandLandmarker IMAGE-mode shim; pre-warm photo pipeline; pinned 320×240; native `bitmap.recycle()`; Skip link from t=0; Y-channel luminance proxy telemetry.
**Avoids:** Pitfalls 8, 9, 10.
**Research flag:** Standard patterns. Skip research-phase but instrument skin-tone-bias telemetry.

### Phase 5: HumynUpload native module + UIDT + foreground service architecture
**Rationale:** Android 14/15 service-type lifecycle (Pitfall 6) restructures the upload story fundamentally — design up-front. Pitfall 7 (OEM walkthrough) ships here as part of first-upload UX. Pitfall 12 (cellular MTU clamping) ships here.
**Delivers:** S3 multipart with presigned URLs; 8MB chunks (2MB on cellular); 3-chunks-parallel × 2-files-parallel; resumable retries 2/4/8/16/32/64 → DLQ; foreground service that downgrades type post-recording; UIDT JobService for true-background; URLSession bg config on iOS; OEM walkthrough at first upload (Xiaomi/Oppo/Vivo/Samsung/stock); pause-during-recording / resume-on-stop; **adds network-state surfacing + recurring storage check** (2 of the 7 P1 gaps).
**Uses:** Android UIDT JobService + `RUN_USER_INITIATED_JOBS` permission; `URLSessionConfiguration.background`; OkHttp socket factory for TCP_MAXSEG.
**Avoids:** Pitfalls 6, 7, 12.
**Research flag:** **NEEDS phase research** — UIDT JobService production examples; per-OEM battery-walkthrough deep-link URLs.

### Phase 6: Hash-verify worker + verified-event delivery
**Rationale:** Longest critical-path edge in dependency graph. Pitfall 15 (verified-event delivery race) is foundational. **Pitfall 13 (TV-replay fraud) is MVP-must-have**: promote IMU liveness from v2-deferred into this phase before payouts go live.
**Delivers:** S3 EventBridge → SQS → BullMQ; worker re-hashes MP4 + CSV; `qa_status='verified'|'hash-mismatch'`; verified-event-piggyback on every API response + app-launch sweep + storage-cleanup tile; **server-side IMU liveness check (promoted from v2)**; per-account daily upload-rate cap; pre-payout fraud monitoring dashboard; **server-side rate limits per user/IP** (1 of the 7 P1 gaps).
**Avoids:** Pitfalls 13, 15.
**Research flag:** **NEEDS phase research** — IMU liveness algorithms (`imu-liveness-check.md` §4.5 cross-correlation); reconciliation logic.

### Phase 7: Tasks surfaces + Hybrid search + History + Home tiles
**Rationale:** Backend `/tasks` semantic search needs an embedding provider; pgvector + tsvector via RRF.
**Delivers:** All 65 tasks × 10 categories with lucide-react icons; per-category pills + search bar (200ms debounce); task details with Universal rules; Send Request sheet; Home hero variants; contribution tiles; History with thumbnails + state chips + in-app player.
**Uses:** pgvector HNSW; tsvector GIN; RRF fusion (k=60); CloudFront signed URLs (5-min TTL).
**Research flag:** **NEEDS phase research** — embedding pipeline (OpenAI vs local; cost; refresh-on-taxonomy-update).

### Phase 8: Recording surface lifecycle edges + thermal/battery alerts + TTS
**Rationale:** All `idea-brief.md` §10 lifecycle edges; thermal gate; brightness; en-IN female TTS with fallback chain; <60s discard rule.
**Delivers:** Full state machine edges; thermal monitor; TTS wrapper; haptics; rotate prompt.
**Research flag:** Standard. Skip research-phase but verify on Pixel 8a thermal-stress runs.

### Phase 9: iOS analogues
**Rationale:** Per spec, iOS App Store ships ≤2 weeks after Play Store rollout. iOS analogues to all four native modules.
**Delivers:** iOS feature parity; TestFlight; App Store submission.
**Uses:** Xcode 16+; iOS 15.1 deployment target; CocoaPods 1.16+; MediaPipeTasksVision 0.10.21 (NOT 0.10.33+).
**Research flag:** **NEEDS phase research** — AVAssetWriter first-frame oversize bug (rdar://47395179); URLSession multipart-complete-from-bg-task gotcha (Amplify iOS #3173); iPhone 13 Pro shutter latency.

### Phase 10: Distribution + APK build flavors + Play Store + App Store
**Rationale:** Three things must be true simultaneously: different `applicationId`, Remote Config keyed by `applicationId`, backend `/auth/google` flavor field validation. Staged rollout.
**Delivers:** Three signed builds in three channels; staged Play rollout (1% → 5% → 25% → 100%); k6 load test gate before each stage.
**Avoids:** Risk 7 mismatch.
**Research flag:** **NEEDS phase research** — Play Internal Track + TestFlight + APK rollout sequencing within one milestone.

### Phase 11: Observability uplift + Foundation/Legal
**Rationale:** Crashlytics + Firebase Analytics ship from Phase 1; this phase adds structured-logs aggregation + queue-metrics dashboard before Play 100% rollout (Risk 3). Pitfall 14 (DPDP/LGPD) requires counsel review **before Play Store launch**.
**Delivers:** CloudWatch Logs Insights dashboards; Bull-Board; per-device-model + per-OS-version cohorting; DPDP / LGPD legal review sign-off; consent text translation; ANPD / DPB takedown response procedure; data-subject-rights API surface defined.
**Avoids:** Pitfalls 14, 16; Risk 3.
**Research flag:** **NEEDS phase research** — DPDP / LGPD compliance specifics.

### Phase Ordering Rationale

- **Backend-first (Phase 1) is non-negotiable** — Google Sign-In flavor verification, presigned URL minting, and metadata JSON schema gate everything. Distribution recon absorbs the worst-case "device class doesn't exist" surprise.
- **Mobile shell (Phase 2) parallelizes with HumynCapture (Phase 3)** with two engineers.
- **HumynCapture (Phase 3) is the longest, riskiest critical-path edge** — build on Pixel 8a, not Pixel 10a.
- **HandDetector (Phase 4) and HumynUpload (Phase 5) parallelize** — disjoint native code.
- **Hash-verify worker (Phase 6) is the second-longest critical-path edge** — promotes IMU liveness from v2 to MVP backend scope.
- **iOS (Phase 9) parallelizes with Phase 7-8 if a second engineer is dedicated**; otherwise tail-end.
- **Distribution (Phase 10) is a milestone gate.**
- **Foundation/Legal (Phase 11) gates Play Store launch** — counsel review must complete first.

### Research Flags Summary

**NEEDS phase research:** Phase 1, 2, 3, 5, 6, 7, 9, 10, 11
**Standard patterns (skip):** Phase 0, 4, 8

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm, Maven, Apple, Android, vendor docs as of May 2026. Three load-bearing gotchas surfaced. Configuration recipes copy-pasteable. |
| Features | MEDIUM-HIGH | HIGH on competitor-feature presence (multi-source); MEDIUM on Outlier/Toloka/Sapien implementation specifics; LOW on India/Brazil contributor expectations beyond Karya. |
| Architecture | HIGH | Every layer anchored to spec. MEDIUM on seams the spec leaves open: Android 15 dataSync 6h cap, hash-verify worker placement, secrets manager. |
| Pitfalls | HIGH on capture-pipeline | MEDIUM on India/Brazil network specifics, OEM defeat paths, fraud / operational. Anchored to AOSP source, tracker bugs, vendor docs. |

**Overall confidence:** HIGH for shipping the locked spec. MEDIUM on the empirical perf bar across the actual fleet — needs distribution recon (Phase 1) to confirm.

### Gaps to Address

- **Embedding provider for `/tasks`** undecided — flag for Phase 7.
- **APK build flavor application ID** — must be locked before Phase 10.
- **Real device coverage for the actual fleet** — Pixel 7a/8a + Helio-class + Snapdragon 7-class + Exynos 1280/1380 must be in test matrix; current testing-guide six-device matrix is heavy on flagships. **Procurement is a project-management gap.**
- **Counsel engagement for DPDP / LGPD** — operational, parallel non-engineering track gating Play Store launch.
- **1M-hour storage cost target reality-check** — affects lifecycle aggressiveness urgency.
- **Payouts-window date** — replaces "Payments coming soon."
- **Rig-distribution operational owner** — gates rig off-ramp UX.
- **QA accept/reject signal schedule** — gates v1.1 QA-status chip + earnings ledger.

---

## Sources

### Primary (HIGH confidence)
- Locked-spec inputs: `idea-brief.md`, `engineering-handoff.md`, `design-spec.md`, `task-taxonomy.md`, `prototype.html`, `video_metadata.json`, `figure-app-hands.md`, `imu-liveness-check.md`, `strategic-suggestions.md`, `deferred-decisions.md`, `testing-guide.md`, `help-center-content.md`
- Android Developers — Foreground service types / Android 14 / 15 / UIDT JobService / Camera2 / HDR video / Credential Manager / Play Integrity error codes
- AOSP source — Sensor batching, low-latency decoding, FBE, camera stream config, HDR modes
- Apple Developer — URLSessionConfiguration / waitsForConnectivity / URLSession background config
- AWS — S3 multipart, presigned URLs, S3 pricing, EventBridge / SQS
- Tracker bugs: androidx/media #1781, #2711, Google Issue Tracker #36916900, VisionCamera #1157/#1585/#2020/#2614/#1554/#1821, facebook/react-native #55571/#54859/#47592, expo/expo #42669, AWS Amplify iOS #3173

### Secondary (MEDIUM confidence)
- Competitor evidence — Sapien, Outlier, Toloka, Karya, BeMyEye, DoorDash Tasks, Vader/EgoPlay, Project Aria, MIT Tech Review (Micro1 — closest published analogue, April 2026)
- OEM battery-manager defeat paths — dontkillmyapp.com, deferred-decisions.md
- Tensor G3 vs G5 thermal — XDA, Beebom, Mundobytes
- Cellular MTU + CGNAT — Cloudflare MSS, nickvsnetworking, Medium "Jio vs TCP"
- DPDP / LGPD — DLA Piper, Seqrite
- OpenCamera-Sensors (synchronized Camera2 + IMU reference)

### Tertiary (LOW confidence)
- India/Brazil contributor-expectation specifics beyond Karya — needs Phase 1 cohort testing
- Specific competitor rates for video data (most published numbers are aggregate)
- Vader/EgoPlay implementation specifics (litepaper went down during research)
- DoorDash Tasks (March 2026, limited public review data)
- Whether locked capture spec is unusually-strict or appropriately-strict for target geo's hardware mix — needs Phase 1 chief recon

---

*Research synthesis for: Homelander (Humyn Labs Capture)*
*Synthesized: 2026-05-07*
*Ready for roadmap: yes*
