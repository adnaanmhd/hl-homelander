# Homelander

## What This Is

Homelander is the codename for **Humyn Labs Capture** — an Android-first crowdsourced data-collection app that records strict-spec egocentric (head-mounted) video, audio, and IMU streams of people performing everyday tasks. The captured data trains physical/embodied AI: VLA/VLN models and humanoid robotics. Brand line: *Real Humyns. Real Intelligence.* MVP ships in three phases of distribution within one milestone — signed APK (early-user clan-chief distribution) → Play Store → iOS App Store — to users in India and Brazil, ages 18–35, on ₹30K+ phones, acquired through KGeN's clan-chief network.

## Core Value

**On-device capture quality is non-negotiable.** Every uploaded segment must hit 1080p / 30 FPS / ≥110° dFOV / IMU sustained ≥100 Hz / ±1 ms timestamp alignment between video, audio, and IMU. Without that, the data is worthless for training — payouts, retention, and scale all assume the bytes are usable. If anything else fails, we can fix it. If capture quality slips, the project fails.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — greenfield; ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**Capture pipeline**
- [ ] Camera2 + MediaCodec capture pipeline producing the locked spec (HEVC Main / 8 Mbps CBR / GOP 30 / no B-frames / no HDR / no stabilisation / 8-bit YUV 4:2:0)
- [ ] Parallel IMU capture (gyro + accel) at the device's max rate, with a ≥100 Hz sustained floor
- [ ] Sidecar IMU CSV (`timestamp_ns,sensor_type,x,y,z`) per recording
- [ ] Audio capture at 48 kHz mono AAC-LC 128 kbps
- [ ] Single-clock timestamping (`SystemClock.elapsedRealtimeNanos` / `mach_absolute_time`) across video / audio / IMU; Camera2 `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`
- [ ] Per-segment drift metadata (`max`, `mean`, `p99` ms) computed end-of-segment with the residual-subtraction methodology
- [ ] 10-minute auto-segmentation with 0.5 s gap; each segment is an independent recording (own MP4 / CSV / JSON / upload / QA decision); segment length remote-config-driven
- [ ] Fragmented MP4 with periodic moov flush every 30 s for crash resilience
- [ ] SHA-256 of MP4 + IMU CSV computed pre-upload and stamped into metadata JSON
- [ ] Foreground service of type `camera | microphone | dataSync` to deprioritize OS killing

**Onboarding & gating**
- [ ] Splash → Sign-up → Permissions → Compatibility → Tutorial flow per `design-spec.md` §1–8
- [ ] Google Sign-In + Play Integrity at sign-in (rooted/emulator/non-Play-Store rejected; APK flavor bypasses install-source check via Remote Config)
- [ ] One-time device compatibility check (resolution, FPS, ultrawide dFOV, IMU sustained 100 Hz over a 30 s window with preview running, mic 48 kHz, REALTIME timestamp source, root verdict, storage warning) — re-runs on app/OS update or new device, and tightens block existing devices that newly fail
- [ ] One-time onboarding tutorial: rig screen + 60 s practice recording (`practice = true` propagated through capture pipeline / metadata / upload-queue exclusion; never uploaded; not in History; not counted)
- [ ] MediaPipe HandLandmarker hand-detection gate (one-shot, IMAGE mode, `numHands=2`, all confidences 0.5, CPU delegate, custom Kotlin/Swift native modules wrapping `hand_landmarker.task`); pass = N consecutive 2-hand detections (5 on Android × 400 ms / 3 on iOS × 600 ms); Skip link from t=0; loading state if camera not ready; no timeout, no auto-cancel; silent bypass on native module unavailable; runs once per session, NOT re-run at 10-minute auto-segment cuts

**Recording surface**
- [ ] Landscape-locked recording surface with rotate prompt → ready → hand-gate → active → stop confirmation flow (per `design-spec.md` §7)
- [ ] Pre-record thermal gate (refuse start at ≥THROTTLING) and mid-record auto-stop at ≥THROTTLING_SEVERE
- [ ] Pause all in-flight uploads on record start; resume on stop
- [ ] Brightness drop to 5% of max at gate exit; restore on stop or exit
- [ ] Indian English female TTS for "Recording started" / "Recording stopped" / battery / thermal alerts; documented voice fallback chain
- [ ] All `idea-brief.md` §10 lifecycle edges (call answered/declined, alarm, rotation, force-quit, backgrounding, thermal, battery 15% / 5%, storage full, OS evict, logout) handled per spec
- [ ] <60 s discard rule with toast `Recording too short — discarded.`; ≥60 s contributes a toast `{Hh Mm} added to your contribution.`
- [ ] Mid-record exit confirmation modal (Stop / Keep recording); pre-record exit silent
- [ ] Re-press of record button starts a fresh recording (no countdown); switching tasks requires exiting the recording screen

**Tasks**
- [ ] All 65 tasks across 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby) rendered from `task-taxonomy.md`
- [ ] Lucide-react task icons via `<TaskIcon task={slug} />` from `design-system/task-icons/` (mapping is single source of truth; `iconKey` constrained to `LucideIconName` union)
- [ ] Server-side semantic search on task name + description with fuzzy lexical fallback (English only, 200 ms debounce)
- [ ] Per-category pills (horizontally scrollable) + always-visible search bar
- [ ] Task details sheet with Universal rules block (4 equal-weight rules: hands-in-frame / mount / lighting / close other apps) + per-task instructions (max 3 task-specific bullets; server validation rejects bullets that duplicate universal-rule strings)
- [ ] Send Request sheet (name / description / category / setting / optional 30 s sample video); user does not see request status

**Upload pipeline**
- [ ] S3 multipart with presigned URLs, 8 MB chunks, 3 chunks in parallel per file × 2 files in parallel
- [ ] Resumable per-chunk retries with exponential backoff (2 / 4 / 8 / 16 / 32 / 64 → DLQ)
- [ ] Foreground service survives backgrounding and force-quit (battery-optimization exemption requested at first upload)
- [ ] Pause during active recording, resume on stop
- [ ] Upload bundle = MP4 + IMU CSV + metadata JSON; files NEVER decoded / re-encoded / transcoded / stripped
- [ ] Backend re-hash on receive; `verified` event triggers local file delete; `re-upload` event triggers retry from local copy
- [ ] Local files NEVER deleted before backend `verified` event
- [ ] No manual user-cancel for uploads; logout cancels in-flight but preserves queue (same-user re-login resumes)
- [ ] Cellular uploads allowed by default (no Wi-Fi-only toggle)

**Other surfaces**
- [ ] Home with first-time vs returning hero variants; contribution tiles (today / yesterday / week / month / all / custom range) with the documented duration formatter (`<1m → Xs`, `<1h → Xm`, `≥1h → Xh Ym` floored to previous minute); Pending uploads tile hidden when 0
- [ ] Tasks / History / Home bottom nav (3 tabs); Profile reached via avatar; bottom nav suppressed on splash / auth / permissions / compat / tutorial / recording / force-upgrade
- [ ] History grouped by day with thumbnail + filename + duration + task + recorded-at + upload-state chips; tap thumbnail opens in-app fullscreen player while local copy exists; once `verified` and local copy cleared, thumbnail remains but tap shows the "securely uploaded, local copy cleared" message; no delete, no share, no export
- [ ] Profile: avatar (read-only from Google), name (editable), age + gender (editable, nullable), Joined date (non-editable), payments coming-soon card, Help Center entry, Logout, Delete account (30-day soft delete + restore window + DELETE typing gate)
- [ ] Help Center (3 accordions sourced verbatim from `help-center-content.md`) + Contact Support mailto to `[EMAIL_ADDRESS]` (final TBD)
- [ ] Forced upgrade gate via `GET /app/version` returning `{min_supported, latest, force_upgrade}`; `< min_supported` blocks with Play Store deep-link; `< latest` shows dismissible banner; response cached 6 h

**Backend (Fastify + Postgres + S3)**
- [ ] `POST /auth/google` — exchange Google ID token for Humyn session token
- [ ] `GET /me`, `PATCH /me`, `DELETE /me` (soft delete + 30-day grace), `POST /me/restore`
- [ ] `GET /tasks` + `GET /tasks/{id}` seeded from `mapping.json`; `POST /task-requests` + `GET /task-requests`
- [ ] `POST /recordings` (mints presigned multipart URLs), `PATCH /recordings/{id}` (status), `GET /recordings`, `GET /recordings/{id}` (signed playback URL)
- [ ] Hash-verify pipeline: re-hash MP4 + CSV after upload; emit `verified` or `re-upload` event back to client
- [ ] `GET /contributions` + `GET /contributions/timeseries?bucket=day&range=` for tile filters
- [ ] `POST /events` for telemetry batches (Firebase Analytics primary; backend ingest TBD)
- [ ] `GET /app/version` for forced-upgrade gate
- [ ] pgvector + ts_vector hybrid search powering `/tasks` semantic + lexical lookup
- [ ] RFC 7807 `application/problem+json` error shape; idempotency-key support on creates

**Observability**
- [ ] Firebase Crashlytics (native + JVM crash + ANR)
- [ ] Firebase Analytics — full event funnel from `engineering-handoff.md` §11 (signup, permission, compat, recording_started/gate/armed/stopped, upload, history, profile, etc.)

**Cross-platform**
- [ ] iOS analogues for every Android subsystem (AVCaptureSession + AVAssetWriter + CMMotionManager + MediaPipe iOS + AVSpeechSynthesizer + URLSession background config)
- [ ] iOS App Store ships ≤2 weeks after Play Store rollout (within the same MVP milestone)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **SSO with KGeN** — Google sign-in only at MVP. *Why: SSO integration is its own coordination cost; Google works for both target geos.*
- **Async QA pipeline + user-facing QA feedback UI** — backend produces hashes/integrity events; QA scoring deferred. *Why: capture quality is the first lever; QA tooling lives separately.*
- **In-app payments / payouts UI** — payouts run offline; in-app data feeds the ledger but isn't surfaced. *Why: regulatory and operational surface area is large; offline-first defers it cleanly.*
- **Notifications of any kind** — no scheduled local reminders, no event-driven (upload, QA, payment), no `POST_NOTIFICATIONS` runtime prompt, no FCM/APNs use. *Why: opt-in design isn't done; deferring keeps the surface small and brand-trust risk low.*
- **Per-upload Play Integrity attestation, perceptual-hash duplicate detection, device-fingerprint binding, liveness gestures** — fraud beyond sign-in. *Why: deferred until fraud volume justifies the cost; see `deferred-decisions.md`.*
- **Server-side IMU liveness fraud check** — *Why: backend is greenfield; capture spec already records the data needed, so this can land in v2 without app changes. See `imu-liveness-check.md`.*
- **Localization** — English only. *Why: Hindi / Portuguese / Spanish are obvious next; copy isn't externalised yet.*
- **Wi-Fi-only upload toggle, monthly data ceiling, data-usage breakdown** — *Why: not enough data on real cellular usage to design well.*
- **Continuous on-device hands-in-frame enforcement during recording** (cue loop / auto-stop on absence) — only the one-shot pre-record gate is in MVP. *Why: continuous detection has thermal / battery / skin-tone-bias risks not yet validated.*
- **Real-time framing guides** (rule-of-thirds, horizon level, motion-too-fast) — *Why: alongside continuous hands-in-frame; not justified until QA data shows the lift.*
- **Mobile dark mode** for non-recording surfaces — light-only with one dark surface (recording). *Why: not enough usage data to design well; tokens are future-proofed.*
- **Web / PWA / desktop / tablet builds** — *Why: capture flow needs platform sensors that web can't reliably hit.*
- **Strategic concerns parked for v2** — MVP success-metrics dashboards, retention loops (streaks / leaderboards / quests), clan-structure visibility, in-app referrals, bystander-consent UI, payment-trust ledger UI, brand narrative work. *Why: MVP ships flat; learn first, layer later. See `strategic-suggestions.md`.*
- **MVP success metrics** — no quant gates blocking phase completion. *Why: explicit user choice; metrics are a v2 concern.*
- **Editable Google profile fields beyond name / age / gender** — avatar is read-only; email is read-only. *Why: avatar editing wasn't in spec and would add an upload surface.*
- **Multi-account on a single device** — one account at a time. *Why: complicates session management with no clear MVP value.*
- **Manual upload cancel** — uploads run automatically; logout cancels in-flight but preserves the queue. *Why: prevents users from losing data they thought they'd kept.*
- **User-side recording deletion** (local or server-side) — *Why: integrity of the dataset; deletion creates payout-dispute and dataset-management complexity.*
- **Streaming uploaded recordings back from the server** after local copy is cleared — playback only while local exists. *Why: signed-URL playback adds backend surface for no clear MVP user value.*
- **Programmatic Do Not Disturb toggling during recording** — *Why: requires `ACCESS_NOTIFICATION_POLICY` and Settings deep-link; not justified at MVP.*
- **Additional client-side file encryption** beyond Android FBE — *Why: marginal security gain doesn't justify the I/O cost; explicitly rejected, not deferred.*

## Context

**Pre-existing spec assets — locked source of truth:**
- `idea-brief.md` — canonical product spec (capture spec, user journey, lifecycle, anti-fraud, perf targets, tech stack, rollout)
- `design-spec.md` — screen-by-screen design with full state enumeration (form factor, tokens, every screen, every state, transitions)
- `prototype.html` — click-through source of truth for designs
- `engineering-handoff.md` — engineering contract (tokens, components, navigation, state machines, native APIs, data model, REST API surface, validation rules, accessibility, telemetry, perf budgets, edge cases, security)
- `task-taxonomy.md` — 65 tasks across 10 categories with universal rules, per-task instructions, settings (indoor/outdoor)
- `help-center-content.md` — verbatim Help Center copy (Instructions Guide / FAQs / Troubleshooting)
- `figure-app-hands.md` — reverse-engineered reference for Figure's "Minutes" app showing the MediaPipe HandLandmarker integration pattern; informs our hand-gate
- `imu-liveness-check.md` — server-side fraud-detection design (deferred to v2)
- `strategic-suggestions.md` — PM-level concerns parked for v2
- `deferred-decisions.md` — technical decisions parked for v2 (note: hands-in-frame is now MVP via the one-shot gate, so that entry is partially superseded — clean up post-init)
- `video_metadata.json` — canonical metadata schema for uploaded segments (per-recording fields, drift figures, hashes, capture spec)
- `testing-guide.md` — Pixel 10a runbook + five-layer testing strategy (note: references a now-missing `implementation-plan.md`; treat that as discarded — the GSD roadmap will replace it)
- `design-system/` — Humyn Labs Brand Book PDF, fonts, logos, task-icons package (`mapping.ts`, `mapping.json`, `TaskIcon.tsx`, README)
- `0.16.0.apk` + `apk-extracted/` + `jadx-out/` — Figure's Minutes app, reverse-engineered for hand-detection reference (NOT our app code)
- `landscape_enforcement.mp4`, `home_screen_reference.png`, `logo.js` — reference assets

**Codebase state:** zero source code today. Everything below the docs is fresh-greenfield. The repo will follow a monorepo layout with `apps/mobile/`, `apps/api/`, `shared/`, `infra/terraform/` (refined during planning).

**Acquisition channel:** KGeN clan chiefs invite their clans; clans contribute. At MVP, chiefs are regular users — no clan-aware UI, no role distinction.

**Capture device class:** ₹30K+ Android phones with ultrawide rear cameras and ≥100 Hz sustained IMU. Pixel 7a-class is the perf benchmark; Pixel 10a is the primary dev device.

**Egocentric capture method:** phone mounted on an externally-supplied head rig; all footage is therefore *egocentric_head*.

**Performance targets:**
- Day-0 ingest: ≥500–1000 hours of uploaded recordings per day
- Concurrency: ≥200–300 simultaneous uploads with no perceivable mobile-side overhead
- Encoder: sustained 1080p30 HEVC for ≥20 min back-to-back chained 10-minute segments on Pixel 7a-class without frame drop or thermal cut-out under cool-start conditions
- Battery: 20-min recording session ≤8% drain

## Constraints

- **Tech stack — Designs LOCKED.** `prototype.html`, `design-spec.md`, and `engineering-handoff.md` are the design source of truth. No new design work — every screen, state, copy string, animation curve, and token comes verbatim from those files. Task icons come from `design-system/task-icons/`. — *Why: extensive design pass already complete; rework wastes the investment and introduces drift.*
- **Tech stack — Capture spec LOCKED.** Every value in `idea-brief.md` §2.1 is hard. Any device or codec choice that can't deliver these numbers is rejected at compat-check time. — *Why: bytes-on-disk quality is the project's reason to exist.*
- **Tech stack — capture pipeline:** Camera2 + MediaCodec (Android), AVCaptureSession + AVAssetWriter (iOS). CameraX rejected. — *Why: B-frame and bitrate-mode controls aren't reliably exposed in higher-level APIs.*
- **Tech stack — hand gate:** MediaPipe HandLandmarker (`hand_landmarker.task` ~7.8 MB) wrapped in custom Kotlin (Android) / Swift (iOS) RN modules. IMAGE mode, single-frame, hand-count only. — *Why: matches Figure's pattern; no third-party RN wrapper introduces a dependency tree we don't need.*
- **Tech stack — app framework:** React Native (Hermes new architecture) with native modules for capture, hand detection, and upload service. — *Why: testing-guide assumes RN + Kotlin TurboModules; engineering-handoff also leaves RN as the recommended path; avoids dual codebase maintenance for the surface UI.*
- **Tech stack — backend:** Fastify + Postgres (with pgvector + ts_vector for hybrid task search) + S3 (LocalStack in dev), Vitest for tests. — *Why: established in testing-guide §A.6 and §B.1; matches the multipart presigned-URL upload model.*
- **Auth:** Google Sign-In + Play Integrity at sign-in only. Per-upload attestation deferred. APK build flavor bypasses install-source check via Remote Config (Play Store builds cannot opt into the bypass). — *Why: balances fraud floor with rollout flexibility for early-user APK distribution.*
- **Distribution sequence:** signed APK (early-user clan-chief distribution) → Play Store fast-follow → iOS App Store fast-follow (≤2 weeks after Play Store). All within the same MVP milestone. — *Why: chief network needs the app before Play approval cycles complete; Play Integrity is preserved on the Play track.*
- **Geos / locale:** India + Brazil at MVP; English only. Localization deferred. — *Why: clan-chief network is concentrated there; localization is post-launch.*
- **Battery / thermal budget:** 25-min sustained capture on Pixel 7a-class without thermal cut-out, with ≤8% battery drain. — *Why: clan members may record back-to-back sessions; thermal cut-outs lose data.*
- **No notifications channel.** No `POST_NOTIFICATIONS`, no FCM/APNs at MVP. — *Why: opt-in design isn't done; deferring keeps the surface small.*
- **No success metrics.** MVP ships ship-by-vibe — no quant gates blocking phase completion. — *Why: explicit choice; metrics phase is a v2 concern (see `strategic-suggestions.md` §1).*
- **Privacy / consent:** consent text in `idea-brief.md` §5.2 is the canonical version; consent timestamps logged server-side with version. Coarse location only — no precise GPS leaves the device. — *Why: regulatory exposure (DPDP / LGPD) and brand trust.*
- **Files never re-encoded.** MP4, IMU CSV, and metadata JSON travel byte-for-byte from device to S3. — *Why: training pipeline expects the encoder's exact bytes (timestamps, tags, every metadata box).*

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Project codename = "Homelander"; product brand = "Humyn Labs Capture" | Codename matches existing directory and is in active internal use | — Pending |
| Discard the missing `implementation-plan.md`; let the GSD roadmap derive phase structure fresh | testing-guide forward-referenced it but it's gone; rebuilding it from the GSD pass is cleaner than archeology | — Pending |
| Backend included in MVP scope (Fastify + Postgres + S3) | Hash-verify and presigned URLs are core to upload reliability; can't ship the app without it | — Pending |
| iOS shipped within the same MVP milestone (≤2 weeks after Play Store) | Per `idea-brief.md` §15 rollout plan; Android tech choices already constrained to those with iOS analogues | — Pending |
| No MVP success metrics | Explicit user choice; ship and learn | — Pending |
| Designs locked to `prototype.html` + `design-spec.md` + `engineering-handoff.md`; no new design work | Substantial design investment already complete | — Pending |
| Hand-detection gate moved into MVP (one-shot pre-record); supersedes the deferred "hands-in-frame" entry in `deferred-decisions.md` | `idea-brief.md` §4 retires the deferred entry | — Pending |
| Server-side IMU liveness fraud check deferred to v2 despite the doc's recommendation to promote | Capture spec already collects the data; can land later without app changes | — Pending |
| React Native + native modules over fully-native dual codebases | Surface UI shares; capture / hand-gate / upload stay native per platform | — Pending |
| Files never re-encoded; original encoder bytes uploaded as-is | Training pipeline expects exact bytes | — Pending |
| Local file deletion gated on backend `verified` event (not on upload-success 200) | Hash-verify supersedes naive upload-success delete | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-07 after initialization*
