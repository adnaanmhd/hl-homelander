# Roadmap: Homelander (Humyn Labs Capture)

## Overview

Homelander ships in seven phases organised as horizontal technical layers that culminate in a working three-channel rollout (signed APK to clan chiefs → Play Store → iOS App Store) within a single MVP milestone. Phase 1 lays the monorepo, the Fastify + Postgres + S3 backend skeleton, every REST endpoint in the spec, build flavors, S3 day-zero lifecycle, the legal-review track, and ships a standalone compat-recon APK to ~50 chiefs to harvest device-class coverage data before any user-facing app rollout. Phase 2 stands up the React Native mobile shell — the entire non-recording surface (Splash → Sign-up → Permissions → behavioral Compat-check → Tutorial chrome → Profile → Help Center → Forced Upgrade gate) — locked to the existing `prototype.html` + `design-spec.md` source of truth. Phase 3 builds the riskiest critical-path module: the `HumynCapture` Camera2 + MediaCodec native module that actually produces the spec-compliant HEVC + IMU CSV + metadata JSON bytes. Phase 4 layers `HumynHandDetector` + the recording-surface UX state machine on top of capture, integrates the practice-recording onboarding step, and lights up TTS / thermal / battery / lifecycle edges. Phase 5 ships `HumynUpload` (multipart S3 with the Android 14/15 foreground-service-type-downgrade + UIDT JobService architecture) plus the BullMQ hash-verify worker plus the promoted-from-v2 server-side IMU liveness fraud check. Phase 6 fills in the remaining client surfaces — Tasks / History / Home tile filters — backed by pgvector + tsvector RRF hybrid search and the `/contributions` aggregates. Phase 7 hardens observability dashboards, ports every Android native module to its iOS analogue, and runs the staged Play Store rollout (1% → 5% → 25% → 100%) followed by App Store submission within two weeks.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Backend & Distribution Recon** - Monorepo, Fastify + Postgres + S3 backend with all 17 endpoints, build flavors, compat-recon APK to chiefs, S3 lifecycle policy, legal-review track (completed 2026-05-08)
- [ ] **Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile** - RN app shell with Splash → Sign-up → Permissions → Compat → Tutorial chrome → Profile → Help Center → Forced Upgrade gate per locked designs
- [ ] **Phase 3: HumynCapture Native Module (Bytes-on-disk)** - Custom Camera2 + MediaCodec native module producing the locked HEVC / IMU / audio / metadata-JSON spec with timestamp alignment, drift, hashing, and segmentation
- [ ] **Phase 4: HandDetector, Recording UX & Practice Tutorial** - MediaPipe hand-gate + landscape recording surface state machine + thermal / battery / TTS / lifecycle edges + practice-recording integration
- [ ] **Phase 5: Upload Pipeline, Hash-Verify Worker & Anti-fraud** - S3 multipart with UIDT JobService + URLSession bg, hash-verify worker on BullMQ, server-side IMU liveness fraud check (promoted from v2)
- [ ] **Phase 6: Tasks, History, Home Tiles & Hybrid Search** - 65-task catalog with semantic + lexical RRF search, History grouped by day with in-app player, Home dynamic tiles with time-range filters
- [ ] **Phase 7: Observability, iOS Parity & Staged Rollout** - CloudWatch dashboards, Bull-Board, full iOS analogues for every native module, staged Play Store rollout, App Store submission

## Phase Details

### Phase 1: Foundation, Backend & Distribution Recon

**Goal**: Backend and distribution infrastructure exists and is exercised end-to-end before any user-facing client lands; the addressable-fleet question is answered before APK rollout starts.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-06, API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10, API-11, API-12, API-13, API-14, API-15, API-16, API-17, DIST-01, DIST-02, DIST-03, DIST-04, DIST-07, FRAUD-01, FRAUD-02, LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05
**Success Criteria** (what must be TRUE):

1. The Fastify backend runs against LocalStack S3 + Postgres 17 + pgvector locally, exposes every REST endpoint in the spec (`/auth/google`, `/me` CRUD + restore, `/tasks` + `/task-requests`, `/recordings` lifecycle, `/contributions` + timeseries, `/events`, `/feedback`, `/app/version`), enforces RFC 7807 errors + Idempotency-Key headers + per-user/IP rate limits, and serves task-search results via the pgvector + tsvector RRF (k=60) hybrid pipeline seeded from `mapping.json`
2. The backend rejects sign-in for rooted / emulator / non-Play-Store install verdicts via Play Integrity Standard, with the `apkRollout` build flavor opting into the install-source bypass via Remote Config keyed by `applicationId` and the `playStore` flavor structurally unable to opt in
3. The standalone `compatRecon` APK has been distributed to ~50 KGeN clan chiefs and the device-model coverage harvest produces a documented go/no-go on capture-fleet addressability before APK rollout begins
4. Three signed-APK build flavors (`apkRollout`, `playStore`, `iosAppStore`) coexist with distinct `applicationId`s, and `/auth/google` validates the supplied build-flavor field against the matching install-source policy
5. S3 buckets have a day-zero lifecycle policy (Glacier IR at +7 days, Deep Archive at +90 days), Indian DPDP + Brazilian LGPD counsel review is engaged, the canonical consent text is logged server-side with version, and the ANPD / DPB takedown response procedure plus data-subject-rights API surface are documented
   **Plans**: TBD

### Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile

**Goal**: Every non-recording client surface — sign-in, permission prompts, the upgraded behavioral compatibility check, the tutorial chrome, Profile, Help Center, and the Forced Upgrade gate — works end-to-end against the Phase 1 backend, with all locked designs implemented verbatim and the four research-flagged P1 gaps shipped.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, PERM-01, PERM-02, PERM-03, PERM-04, COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-04, COMPAT-05, COMPAT-06, COMPAT-07, COMPAT-08, ONB-01, ONB-02, HOME-07, HOME-08, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, HELP-01, HELP-02, HELP-03, HELP-04, HELP-05, UPG-01, UPG-02, UPG-03, UPG-04, UPG-05
**Success Criteria** (what must be TRUE):

1. A user can complete the locked Splash → Sign-up (Google + Terms-of-Use consent + verbatim popup) → Camera/Mic permission grants → device compatibility check → Rig screen (with "Don't have a rig yet" off-ramp) sequence on a Pixel 7a/8a-class device, with the session persisting across app launches via Keystore/Keychain
2. The compatibility check verifies _behavior_ not metadata — NAL-unit B-frame parse on a test clip, OIS-OFF readback, HDR-mode SDR force via `DynamicRangeProfile.STANDARD`, IMU sustained ≥100 Hz over a 30 s preview-running window with inter-sample p99 ≤ 12 ms, REALTIME timestamp source, ultrawide ≥110° dFOV, root verdict, and < 5 GB free-space warning — re-runs on app/OS update or new device, blocks downgraded devices, and the fail screen lists exactly which checks failed plus a non-brick recovery page
3. The bottom navigation has exactly three tabs (Home / Tasks / History), is suppressed on splash / auth / permissions / compat / tutorial / recording / force-upgrade screens, and Profile is reachable only via the avatar in the top-right
4. Profile shows Google avatar (read-only), editable name + nullable age + nullable gender, non-editable Joined date, lifetime contribution numeric (44 px mono) + "Across N tasks", "Coming soon" Payments card, app version + build identifier in the footer, Help Center entry, Logout (cancels in-flight upload, preserves queue), and Delete account flow with a `DELETE`-typing gate triggering 30-day soft-delete
5. Help Center shows the three accordions (Instructions Guide / FAQs / Troubleshooting) sourced verbatim from `help-center-content.md`, a Contact Support mailto entry, and an in-app "Report a problem" form posting diagnostic snapshots to `POST /feedback`; the Forced Upgrade gate calls `GET /app/version` (6 h cache), blocks below `min_supported`, and shows a dismissible banner below `latest`

**Plans:** 22 plans

Plans:
**Wave 1**

- [x] 02-01-mobile-npm-migration-PLAN.md — apps/mobile pnpm → npm migration (D-PKG-07; lands first, blocks rest of phase)
- [x] 02-02-test-scaffolding-and-deps-PLAN.md — Vitest screen tests + Robolectric Kotlin tests + HEVC fixtures
- [x] 02-03-state-store-and-hydration-PLAN.md — Zustand appStore + MMKV-hydrate boot
- [x] 02-04-installation-id-and-telemetry-ring-PLAN.md — installation_id mint + telemetry ring buffer + AppFlavor extensions
- [ ] 02-05-navigation-skeleton-PLAN.md — RootNativeStack + OnboardingStack + MainTabs scaffold + initial-route gate decision
- [ ] 02-06-humyn-compat-kotlin-shells-PLAN.md — HumynCompat module + EncoderProbe / ImuProbe / DeviceCaps / NalParser scaffolds
- [ ] 02-07-humyn-updater-kotlin-shell-PLAN.md — HumynUpdater module (APK download + SHA-256 + PackageInstaller)

**Wave 2** _(blocked on Wave 1 completion)_

- [ ] 02-08-splash-and-version-service-PLAN.md — Splash + versionService (GET /app/version + 6h cache + force-upgrade decision)
- [ ] 02-09-signup-screen-and-terms-modal-PLAN.md — SignupScreen + TermsOfUseModal + auth orchestration
- [ ] 02-10-permissions-screen-and-manifest-PLAN.md — Camera + Mic runtime prompts + manifest declarations
- [ ] 02-11-rig-tutorial-screen-PLAN.md — Tutorial Rig screen + "Don't have a rig" off-ramp

**Wave 3** _(blocked on Wave 2 completion)_

- [ ] 02-12-compat-encoder-probe-PLAN.md — NAL B-frame parser + 5 s HEVC test clip + OIS / HDR readback
- [ ] 02-13-compat-imu-probe-PLAN.md — IMU sustained 100 Hz over 30 s with 1080p preview + p99 inter-sample
- [ ] 02-14-compat-device-caps-and-permissions-PLAN.md — DeviceCaps (resolution / fps / dfov / mic / realtime / root / storage) + locationPermission helper

**Wave 4** _(blocked on Wave 3 completion)_

- [ ] 02-15-compat-screens-and-service-PLAN.md — compatService + 4 compat screens (Running / Pass / Fail / Recovery)
- [ ] 02-16-home-skeleton-and-tabs-PLAN.md — HomeSkeleton + TopBar + 3-tab MainTabs + structural HOME-07/08 lock
- [ ] 02-17-profile-screen-PLAN.md — ProfileScreen (PROF-01..05) + inline-edit + durationFormatter
- [ ] 02-18-help-center-and-feedback-PLAN.md — HelpCenter + AccordionItem + ReportProblemSheet + feedbackService + content build script
- [ ] 02-19-logout-and-delete-account-PLAN.md — LogoutModal + DeleteAccountModal (DELETE-typing gate) + DELETE /me wiring
- [ ] 02-20-force-upgrade-and-soft-banner-PLAN.md — ForceUpgradeScreen (per-flavor) + SoftUpgradeBanner + REQUEST_INSTALL_PACKAGES verify

**Wave 5** _(blocked on Wave 4 completion)_

- [ ] 02-21-manual-smoke-runbook-PLAN.md — 02-MANUAL-SMOKE.md runbook + Open Questions tracking + Crashlytics gate
- [ ] 02-22-android-manifest-ci-finalize-PLAN.md — PERM-04 static + Gradle merged-manifest CI gate + RootStack route registry

  **UI hint**: yes

### Phase 3: HumynCapture Native Module (Bytes-on-disk)

**Goal**: A custom Kotlin Camera2 + MediaCodec native module produces a fragmented MP4 + IMU CSV + metadata JSON triple that satisfies every value in the locked capture spec on a real Pixel 7a/8a-class device, with byte-for-byte file fidelity from device to S3.
**Depends on**: Phase 1
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19
**Success Criteria** (what must be TRUE):

1. A 10-minute recording on a Pixel 7a/8a produces a 1920×1080 / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no-B-frame (verified at NAL-unit level) / 8-bit YUV 4:2:0 / no-HDR / no-OIS fragmented MP4 with periodic moov flush every 30 s and zero frame drops, alongside a sidecar IMU CSV (`timestamp_ns,sensor_type,x,y,z`) sustaining a ≥100 Hz floor with 48 kHz mono AAC-LC 128 kbps audio
2. All three streams (video, audio, IMU) timestamp against a single `SystemClock.elapsedRealtimeNanos` clock with `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`, and the per-segment metadata JSON (matching `video_metadata.json` schema) records `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` computed via residual-subtraction at end-of-segment, with the runtime IMU floor observation `imu_min_rate_hz_observed_p1` rejecting segments where sustained rate drops below 80 Hz
3. A 25-minute continuous capture session auto-segments every 10 minutes (remote-config-driven default) with a 0.5 s gap, each segment owning its own MP4 / CSV / JSON / ULID `recording_id` with no `parent_recording_id` linkage and filenames following `YYYYMMDD_HHMMSS_NNN.<ext>`
4. Pre-record thermal check refuses to start when `getCurrentThermalStatus() ≥ THROTTLING` with the documented toast, mid-record `≥ THROTTLING_SEVERE` ends the segment cleanly within ~2.5 s, the foreground service runs as `camera | microphone | dataSync` with `KEEP_SCREEN_ON`, and in-flight uploads pause on record start and resume on stop
5. SHA-256 of the MP4 and SHA-256 of the IMU CSV are computed at finalize and stamped into the metadata JSON as `file_sha256` / `imu_sha256`, and the resulting MP4 / CSV / JSON files are NEVER decoded, re-encoded, transcoded, or stripped between device and S3
   **Plans**: TBD

### Phase 4: HandDetector, Recording UX & Practice Tutorial

**Goal**: A user can press the record button on a task, pass through the MediaPipe hand-gate, capture a real recording with the full landscape state machine and thermal/battery/TTS lifecycle handling, and complete the first-time 60-second practice-recording onboarding flow.
**Depends on**: Phase 3
**Requirements**: ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08, HAND-01, HAND-02, HAND-03, HAND-04, HAND-05, HAND-06, HAND-07, HAND-08, HAND-09, HAND-10, HAND-11, HAND-12, HAND-13, HAND-14, REC-01, REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, REC-08, REC-09, REC-10, REC-11, REC-12, REC-13, REC-14, REC-15, REC-16
**Success Criteria** (what must be TRUE):

1. A user pressing the record button enters a once-per-session hand-gate that runs MediaPipe HandLandmarker (IMAGE mode, `numHands=2`, all confidences 0.5, CPU delegate) via a custom Kotlin native module wrapping `hand_landmarker.task` — gate passes on N consecutive 2-hand detections (5 on Android × 400 ms / 3 on iOS × 600 ms), Skip link is visible from t=0 with brightness still dropping to 5%, native-module-unavailable triggers silent bypass, and gate cadence + confidences + targets are Firebase Remote Config keys; the gate does NOT re-run at 10-minute auto-segment cuts
2. On gate pass (not skip / not silent bypass), the system fires an 80 ms vibrate + Indian English female TTS "Recording started" (with the documented voice fallback chain en-IN female → en-IN neutral → en-US female → first available en-\*) + brightness drop to 5%, with TTS overlay text duplicated for accessibility
3. The recording surface auto-rotates and locks to landscape, displays the 3-second "Don't exit while recording." overlay, shows the minute-bar timer + HH:MM:SS counter + floating stop button, fires "Recording stopped" + the duration toast on stop, discards <60 s recordings with the documented toast and never persists them, and starts a fresh recording on re-press without a countdown
4. Every `idea-brief.md` §10 lifecycle edge is honored on a real device — phone-call answered / alarm / rotation / force-quit / OS-evict / storage-full stops recording per the table; phone-call declined continues; battery ≤15% fires alert pill + 520 Hz beep + haptic + voice cue with new recordings refused below 5%; battery ≤5% ends the segment immediately; recurring storage check runs before each recording start; DND is never programmatically toggled
5. A first-time user runs the tutorial Rig screen → 60-second practice recording with `practice = true` propagated through capture / metadata / upload-queue exclusion (never uploaded, never in History, never counted), all multimodal alerts active, hard-cap auto-stop at exactly 60 s, then sees the Practice-complete screen with confetti + light haptic `[40, 80, 40]` ms; tutorial runs once per install per Google account with no re-entry path
   **Plans**: TBD
   **UI hint**: yes

### Phase 5: Upload Pipeline, Hash-Verify Worker & Anti-fraud

**Goal**: A finished recording uploads automatically as a three-file bundle, survives backgrounding / force-quit / Android 14/15 service-type restrictions / OEM battery managers, gets re-hashed server-side and either confirmed via a `verified` event or queued for re-upload, and the dataset is protected from TV-replay fraud by the promoted-from-v2 IMU-liveness backend check before payouts go live.
**Depends on**: Phase 3
**Requirements**: UP-01, UP-02, UP-03, UP-04, UP-05, UP-06, UP-07, UP-08, UP-09, UP-10, UP-11, UP-12, UP-13, UP-14, UP-15, UP-16, UP-17, UP-18, UP-19, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06, VERIFY-07, FRAUD-03, FRAUD-04, FRAUD-05, FRAUD-06
**Success Criteria** (what must be TRUE):

1. On recording stop, the bundle (MP4 + IMU CSV + metadata JSON) uploads automatically via S3 multipart presigned URLs with 8 MB chunks on Wi-Fi / 2 MB on cellular, 3 chunks parallel per file × 2 files parallel, exponential backoff (2 / 4 / 8 / 16 / 32 / 64 s → DLQ), no manual user-cancel, no whole-file restart on chunk fail, and TCP_MAXSEG=1280 + 30-second no-progress abandon-and-retry-with-fresh-socket on cellular
2. Uploads survive backgrounding and force-quit on Android via a foreground service that downgrades type from `camera|microphone|dataSync` (during recording) → `dataSync` (post-recording) → stops after 5 min idle, with a UIDT JobService (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS` permission) handling true-background work to defeat the Android 15 6-hour `dataSync` cap; iOS uses `URLSessionConfiguration.background` + `sessionSendsLaunchEvents = true` with the multipart-complete POST running as a foreground task inside `urlSessionDidFinishEvents`; uploads pause during recording and resume on stop, logout cancels in-flight but preserves the queue, and same-user re-login resumes
3. The first-upload OEM battery-optimization walkthrough surfaces per-vendor deep-links and steps for Xiaomi (MIUI), Oppo (ColorOS), Vivo (FunTouch), Samsung (OneUI), and stock Android, the Pending Uploads tile shows per-file progress (filename / duration / thumbnail / state), and cellular uploads are allowed by default with no Wi-Fi-only toggle
4. The hash-verify worker (BullMQ + Redis + ECS, scaled on queue depth) consumes S3 multipart-complete events via EventBridge → SQS, re-hashes both MP4 and IMU CSV, flips `recordings.qa_status` to `'verified'` (emit `verified` event) on match or `'hash-mismatch'` (emit `re-upload` event) on mismatch; events deliver piggy-backed on the next API response, the app deletes local MP4 + CSV + JSON only on `verified`, re-uploads from the still-present local copy on `re-upload`, and an app-launch reconciliation sweep cleans local files for any verified-but-undeleted set
5. The backend produces a `liveness_score ∈ [0, 1]` per uploaded segment via the IMU-liveness check (stillness gate, gravity-axis check, saccade density, optional walking-segment FFT, vision-motion correlation per `imu-liveness-check.md` §4) with tunable thresholds, enforces a per-account daily upload-rate cap as a coarse fraud heuristic, and the pre-payout fraud monitoring dashboard surfaces liveness-score distribution + hash-mismatch rate + account-fingerprint clustering + OEM/region anomalies
   **Plans**: TBD

### Phase 6: Tasks, History, Home Tiles & Hybrid Search

**Goal**: A user can browse and search the 65-task catalog, view dynamic Home contribution tiles with time-range filters, and review every recording in History with in-app playback while local copies exist.
**Depends on**: Phase 2
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10, HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-09, HOME-10, HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07, HIST-08, HIST-09, HIST-10, HIST-11
**Success Criteria** (what must be TRUE):

1. A user can browse all 65 tasks across 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby) sourced from `task-taxonomy.md`, filter by horizontally-scrollable per-category pills, and search via the always-visible 200 ms-debounced server-side semantic + lexical RRF query — task cards show lucide-react icons (28 px stroke 1.75) via `<TaskIcon task={slug} />`, names verbatim, category eyebrow, 1-2 line description, and a non-prototype "no results" empty state with `SearchX` icon + send-request link
2. Tapping a task opens the details sheet with category chip + optional outdoor chip + verbatim name and description + the 4-rule Universal block (`front_hand` / `videocam` / `lightbulb` / `apps`) + max-3-bullet "For this task" instructions (server-validated against duplicate universal-rule strings) + Start Recording CTA; users can submit a Send Request form (3-80 char name / 10-240 char description / category + Other / Indoor/Outdoor / optional ≤30 s ≤50 MB sample video) and never see request status
3. The Home screen shows the first-time empty hero ("Record your first task") + zero-state tiles for new users and the dynamic hero (lifetime contribution numeric + task count + Start Recording CTA) + real-data tiles for returning users; recording-duration and tasks-recorded tiles toggle across today / yesterday / this week / this month / all time / custom range using the canonical duration formatter (`<1m → Xs`, `<1h → Xm`, `≥1h → Xh Ym` floored to previous minute), Pending Uploads tile is visible only when count > 0 and tapping opens the upload-queue screen, pull-to-refresh on tiles fetches fresh `/contributions` data, and a non-blocking offline banner appears in the Pending Uploads tile when network is unreachable
4. Every successful recording (≥60 s) appears in History grouped by day newest-first, filterable across the same six time-range options, with rows showing filename + duration + task name + recorded-at timestamp (`May 4, 2026 | 15:49`) + upload-state chip (Uploaded at / In progress / Paused due to network / Failed-with-retry) + first-frame thumbnail + disabled "Feedback (coming soon)" slot
5. Tapping a thumbnail opens the in-app fullscreen player (play / pause / seek only — no download / share / export / delete) while the local MP4 still exists; once the `verified` event clears the local copy, the thumbnail remains but tap shows "This recording has been securely uploaded. Local copy cleared."; empty-state copy renders correctly with no-recordings vs filter-applied variants
   **Plans**: TBD
   **UI hint**: yes

### Phase 7: Observability, iOS Parity & Staged Rollout

**Goal**: Every Android subsystem has a working iOS analogue shipping in TestFlight ≤2 weeks after the staged Play Store rollout completes, and the operational observability stack visible to ops can detect a regression before users complain.
**Depends on**: Phase 6
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, IOS-01, IOS-02, IOS-03, IOS-04, IOS-05, IOS-06, IOS-07, DIST-05, DIST-06
**Success Criteria** (what must be TRUE):

1. The full event funnel from `engineering-handoff.md` §11 (signup*\*, permission*\_, compat\__, recording*\*, gate*_, upload\__, history*\*, profile*_, help\_\_) emits via Firebase Analytics, native + JVM crashes + ANRs report via Firebase Crashlytics, the backend emits structured CloudWatch logs with per-device-model + per-OS-version + per-locale cohorting, the Bull-Board dashboard surfaces queue depth + retry counts + DLQ for the hash-verify worker, and Sentry / Datadog / third-party RUM are explicitly absent at MVP
2. The iOS app captures 1080p / 30 FPS / HEVC / 8 Mbps CBR / no-B-frames / no-HDR / no-OIS recordings via the `HumynCapture` AVCaptureSession + AVAssetWriter + CMMotionManager + AVAudioRecorder analogue (with `AVVideoAllowFrameReorderingKey: false`), runs the same `hand_landmarker.task` bundle through the `HumynHandDetector` MediaPipe iOS Tasks Vision pod 0.10.21 analogue, and uploads via the `HumynUpload` URLSession background config analogue with the documented post-completion handoff pattern
3. The iOS app passes sign-in via the `HumynIntegrity` DeviceCheck / App Attest analogue, ships TTS via `AVSpeechSynthesisVoice(language: "en-IN")` filtered to female with the documented fallback chain, and targets iOS 15.1 deployment
4. The Play Store rollout completes the staged sequence 1% → 5% → 25% → 100% with a k6 load-test gate at each stage and no thermal cut-out / hash-mismatch / liveness-score anomaly triggering rollback
5. The iOS App Store submission ships ≤2 weeks after Play Store rollout reaches 100% (within the same MVP milestone)
   **Plans**: TBD
   **UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

(Per research SUMMARY.md, parallelization opportunities exist where indicated — Phase 2 with Phase 3, Phase 4 (HandDetector portion) with Phase 5 (Upload portion), iOS analogues in Phase 7 with Phase 6 if a second engineer is dedicated. Numeric order is the default execution order; parallelization is a planning-time choice.)

| Phase                                                      | Plans Complete | Status      | Completed  |
| ---------------------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Foundation, Backend & Distribution Recon                | 13/13          | Complete    | 2026-05-08 |
| 2. Mobile Shell, Onboarding, Permissions, Compat & Profile | 0/22           | Planned     | -          |
| 3. HumynCapture Native Module (Bytes-on-disk)              | 0/TBD          | Not started | -          |
| 4. HandDetector, Recording UX & Practice Tutorial          | 0/TBD          | Not started | -          |
| 5. Upload Pipeline, Hash-Verify Worker & Anti-fraud        | 0/TBD          | Not started | -          |
| 6. Tasks, History, Home Tiles & Hybrid Search              | 0/TBD          | Not started | -          |
| 7. Observability, iOS Parity & Staged Rollout              | 0/TBD          | Not started | -          |
