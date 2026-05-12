# Roadmap: Homelander (Humyn Labs Capture)

## Overview

Homelander ships in seven phases organised as horizontal technical layers that culminate in a signed-APK rollout direct to users within a single MVP milestone. (The staged Play Store rollout and the iOS App Store channel — along with the iOS native-module analogues — are descoped from this MVP to a follow-on milestone; see REQUIREMENTS.md §v2: DIST-05, DIST-06, IOS-01..07.) Phase 1 lays the monorepo, the Fastify + Postgres + S3 backend skeleton, every REST endpoint in the spec, build flavors, S3 day-zero lifecycle, the legal-review track, and ships a standalone compat-recon APK to ~50 chiefs to harvest device-class coverage data before any user-facing app rollout. Phase 2 stands up the React Native mobile shell — the entire non-recording surface (Splash → Sign-up → Permissions → behavioral Compat-check → Tutorial chrome → Profile → Help Center → Forced Upgrade gate) — locked to the existing `prototype.html` + `design-spec.md` source of truth. Phase 3 builds the riskiest critical-path module: the `HumynCapture` Camera2 + MediaCodec native module that actually produces the spec-compliant HEVC + IMU CSV + metadata JSON bytes. Phase 4 layers `HumynHandDetector` + the recording-surface UX state machine on top of capture, integrates the practice-recording onboarding step, and lights up TTS / thermal / battery / lifecycle edges. Phase 5 ships `HumynUpload` (multipart S3 with the Android 14/15 foreground-service-type-downgrade + UIDT JobService architecture) plus the BullMQ hash-verify worker plus the server→client verified/re-upload event channel — anti-fraud beyond Play Integrity is descoped to §v2 (FRAUD-05, FRAUD-06). Phase 6 fills in the remaining client surfaces — Tasks / History / Home tile filters — backed by server-side lexical (`ts_vector` + GIN) task search and the `/contributions` aggregates. Phase 7 hardens the observability stack — Firebase Analytics funnel, Crashlytics, structured CloudWatch logs, and the Bull-Board hash-verify dashboard — and production-hardens the signed-APK distribution pipeline (build flavors, release signing, in-app update channel). The semantic/pgvector + RRF hybrid-search layer (backend shipped in Phase 1), the server-side IMU-liveness fraud check (`imu-liveness-check.md` — FRAUD-03/04, descoped 2026-05-11), and the iOS / Play-Store-rollout work are parked in REQUIREMENTS.md §v2.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Backend & Distribution Recon** - Monorepo, Fastify + Postgres + S3 backend with all 17 endpoints, build flavors, compat-recon APK to chiefs, S3 lifecycle policy, legal-review track (completed 2026-05-08)
- [x] **Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile** - RN app shell with Splash → Sign-up → Permissions → Compat → Tutorial chrome → Profile → Help Center → Forced Upgrade gate per locked designs (completed 2026-05-10)
- [x] **Phase 3: HumynCapture Native Module (Bytes-on-disk)** - Custom Camera2 + MediaCodec native module producing the locked HEVC / IMU / metadata-JSON spec with timestamp alignment, drift, hashing, and segmentation (completed 2026-05-11; audio dropped 2026-05-11 to preserve ±1 ms drift target — see CLAUDE.md / idea-brief.md / 03-HUMAN-UAT.md GAP-3)
- [x] **Phase 4: HandDetector, Recording UX & Practice Tutorial** - MediaPipe hand-gate + landscape recording surface state machine + thermal / battery / TTS / lifecycle edges + practice-recording integration (completed 2026-05-12; on-hardware smoke walk verdict YES after the `/gsd-debug phase4-smoke-fixes` round — sub-60 s discard / <5 % battery start-guard / force-quit recovery / mid-record thermal abort + an auto-segment-rotate deadlock fixed & re-verified on a Pixel 10a; non-blocking follow-ups in 04-COSMETIC-GAPS.md; the original "[BLOCKING] §5b ±1 ms drift" gate was relaxed by the owner 2026-05-12 to measure-and-record — see CLAUDE.md drift banner / ULTRAWIDE-DRIFT-FINDINGS.md)
- [ ] **Phase 5: Upload Pipeline & Hash-Verify Worker** - S3 multipart with UIDT JobService + URLSession bg, hash-verify worker on BullMQ, server→client verified/re-upload event channel (server-side IMU-liveness check FRAUD-03/04 and the FRAUD-05/06 anti-fraud surface deferred to v2 — see REQUIREMENTS.md §v2). **Wave 1 = the `04-COSMETIC-GAPS.md` cosmetic-cleanup pass** (doc polish + the alert-tone re-check / device-distress-stop-navigation / defer-the-recovery-toast-to-Home code items), run before the upload work — mirrors how `02-COSMETIC-GAPS.md` was Phase 3's Wave 1.
- [ ] **Phase 6: Tasks, History, Home Tiles & Lexical Search** - 65-task catalog with server-side lexical (`ts_vector` + GIN) task search, History grouped by day with in-app player, Home dynamic tiles with time-range filters
- [ ] **Phase 7: Observability & APK Distribution Hardening** - Firebase Analytics funnel, Crashlytics, structured CloudWatch logs, Bull-Board hash-verify dashboard, signed-APK distribution pipeline production-hardened (iOS parity + staged Play Store / App Store rollout deferred — see REQUIREMENTS.md §v2)

## Phase Details

### Phase 1: Foundation, Backend & Distribution Recon

**Goal**: Backend and distribution infrastructure exists and is exercised end-to-end before any user-facing client lands; the addressable-fleet question is answered before APK rollout starts.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-06, API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, API-09, API-10, API-11, API-12, API-13, API-14, API-15, API-16, API-17, DIST-01, DIST-02, DIST-03, DIST-04, DIST-07, FRAUD-01, FRAUD-02, LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05
**Success Criteria** (what must be TRUE):

1. The Fastify backend runs against LocalStack S3 + Postgres 17 + pgvector locally, exposes every REST endpoint in the spec (`/auth/google`, `/me` CRUD + restore, `/tasks` + `/task-requests`, `/recordings` lifecycle, `/contributions` + timeseries, `/events`, `/feedback`, `/app/version`), enforces RFC 7807 errors + Idempotency-Key headers + per-user/IP rate limits, and serves task-search results via the `ts_vector` lexical pipeline seeded from `mapping.json` _(the pgvector + RRF k=60 hybrid layer shipped in this phase's backend but was descoped from the MVP client search surface 2026-05-11 — Phase 6 consumes the lexical path only; semantic/RRF parked in REQUIREMENTS.md §v2 as SEARCH-V2-01)_
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
- [x] 02-05-navigation-skeleton-PLAN.md — RootNativeStack + OnboardingStack + MainTabs scaffold + initial-route gate decision
- [x] 02-06-humyn-compat-kotlin-shells-PLAN.md — HumynCompat module + EncoderProbe / ImuProbe / DeviceCaps / NalParser scaffolds
- [x] 02-07-humyn-updater-kotlin-shell-PLAN.md — HumynUpdater module (APK download + SHA-256 + PackageInstaller)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-08-splash-and-version-service-PLAN.md — Splash + versionService (GET /app/version + 6h cache + force-upgrade decision)
- [x] 02-09-signup-screen-and-terms-modal-PLAN.md — SignupScreen + TermsOfUseModal + auth orchestration
- [x] 02-10-permissions-screen-and-manifest-PLAN.md — Camera + Mic runtime prompts + manifest declarations
- [x] 02-11-rig-tutorial-screen-PLAN.md — Tutorial Rig screen + "Don't have a rig" off-ramp

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 02-12-compat-encoder-probe-PLAN.md — NAL B-frame parser + 5 s HEVC test clip + OIS / HDR readback
- [x] 02-13-compat-imu-probe-PLAN.md — IMU sustained 100 Hz over 30 s with 1080p preview + p99 inter-sample
- [x] 02-14-compat-device-caps-and-permissions-PLAN.md — DeviceCaps (resolution / fps / dfov / mic / realtime / root / storage) + locationPermission helper

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 02-15-compat-screens-and-service-PLAN.md — compatService + 4 compat screens (Running / Pass / Fail / Recovery)
- [x] 02-16-home-skeleton-and-tabs-PLAN.md — HomeSkeleton + TopBar + 3-tab MainTabs + structural HOME-07/08 lock
- [x] 02-17-profile-screen-PLAN.md — ProfileScreen (PROF-01..05) + inline-edit + durationFormatter
- [x] 02-18-help-center-and-feedback-PLAN.md — HelpCenter + AccordionItem + ReportProblemSheet + feedbackService + content build script
- [x] 02-19-logout-and-delete-account-PLAN.md — LogoutModal + DeleteAccountModal (DELETE-typing gate) + DELETE /me wiring
- [x] 02-20-force-upgrade-and-soft-banner-PLAN.md — ForceUpgradeScreen (per-flavor) + SoftUpgradeBanner + REQUEST_INSTALL_PACKAGES verify

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 02-21-manual-smoke-runbook-PLAN.md — 02-MANUAL-SMOKE.md runbook + Open Questions tracking + Crashlytics gate (authoring complete; operator on-device walk-through pending — code-ready-smoke-deferred)
- [x] 02-22-android-manifest-ci-finalize-PLAN.md — PERM-04 static + Gradle merged-manifest CI gate + RootStack route registry + phase-wide no-hex-literals gate

  **UI hint**: yes

### Phase 3: HumynCapture Native Module (Bytes-on-disk)

**Goal**: A custom Kotlin Camera2 + MediaCodec native module produces a fragmented MP4 + IMU CSV + metadata JSON triple that satisfies every value in the locked capture spec on a real Pixel 7a/8a-class device, with byte-for-byte file fidelity from device to S3.
**Depends on**: Phase 1
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19
**Success Criteria** (what must be TRUE):

1. A 10-minute recording on a Pixel 7a/8a produces a 1920×1080 / 30 FPS / HEVC Main / 8 Mbps CBR / GOP 30 / no-B-frame (verified at NAL-unit level) / 8-bit YUV 4:2:0 / no-HDR / no-OIS fragmented MP4 with periodic moov flush every 30 s and zero frame drops, alongside a sidecar IMU CSV (`timestamp_ns,sensor_type,x,y,z`) sustaining a ≥100 Hz floor _(originally also: "with 48 kHz mono AAC-LC 128 kbps audio" — DROPPED 2026-05-11 per CLAUDE.md / idea-brief.md banner; 03-HUMAN-UAT.md GAP-3)_
2. Both streams (video, IMU) timestamp against a single `SystemClock.elapsedRealtimeNanos` clock with `SENSOR_INFO_TIMESTAMP_SOURCE = REALTIME`, and the per-segment metadata JSON (matching `video_metadata.json` schema) records `imu_video_drift_max_ms`, `imu_video_drift_mean_ms`, `imu_video_drift_p99_ms` computed via residual-subtraction at end-of-segment, with the runtime IMU floor observation `imu_min_rate_hz_observed_p1` rejecting segments where sustained rate drops below 80 Hz _(originally said "All three streams (video, audio, IMU)" — audio dropped 2026-05-11)_
3. A 25-minute continuous capture session auto-segments every 10 minutes (remote-config-driven default) with a 0.5 s gap, each segment owning its own MP4 / CSV / JSON / ULID `recording_id` with no `parent_recording_id` linkage and filenames following `YYYYMMDD_HHMMSS_NNN.<ext>`
4. Pre-record thermal check refuses to start when `getCurrentThermalStatus() ≥ THROTTLING` with the documented toast, mid-record `≥ THROTTLING_SEVERE` ends the segment cleanly within ~2.5 s, the foreground service runs as `camera | microphone | dataSync` with `KEEP_SCREEN_ON`, and in-flight uploads pause on record start and resume on stop
5. SHA-256 of the MP4 and SHA-256 of the IMU CSV are computed at finalize and stamped into the metadata JSON as `file_sha256` / `imu_sha256`, and the resulting MP4 / CSV / JSON files are NEVER decoded, re-encoded, transcoded, or stripped between device and S3

**Plans:** 11/11 plans complete

Plans:
**Wave 1** _(Phase 2 cosmetic fix-up — D-WAVE-04..05; lands first per memory `project_phase3_wave1_cosmetic_fixup.md`; parallel-OK among the three since file ownership doesn't overlap)_

- [x] 03-01-cosmetic-asset-prep-PLAN.md — Wave 1a — pre-cropped @1x/@2x/@3x logo + rig asset PNGs + jest-image-snapshot dev dep + Vitest expect.extend adapter (no screen edits)
- [x] 03-02-cosmetic-screen-fixup-PLAN.md — Wave 1b — RethinkSans diagnosis + value-prop spacing + CTA position/width across Sign-up/Permissions + BottomNav Lucide icons + 4-of-5 EMAIL_ADDRESS substitution + 6 visual snapshot baselines (depends on Plan 03-01 assets + infra)
- [x] 03-03-cosmetic-functional-regressions-PLAN.md — Wave 1 — navigator-touching changes (useTabTopBarProps hook Pattern 71, useForegroundUserRehydrate hook Pattern 72, CompatFail+CompatRecovery merge, CompatPass auto-advance, route-registry REMOVED_PHASE_2_ROUTES list, 5th [EMAIL_ADDRESS] substitution closes OQ-1 end-to-end, 03-WAVE1-SMOKE.md operator runbook)
- [x] 03-11-wave1-polish-PLAN.md — Wave 1 polish (D-WAVE-09 amendments protocol) — A1 Permissions copy + A2 RigTutorial illustration (asset replacement OR escalation) + A3 BottomNav lift via `useSafeAreaInsets()` + A4 TopBar orange wordmark Image on Home/Tasks/History + A5 CompatFail "What Now" removal + A6 Splash/Sign-up logos shrink ~20%; refreshes 7 visual baselines; gates Wave 2 entry per D-WAVE-08 (depends on 03-03)

**Wave 2 entry** _(Wave 2 entry — blocked on Wave 1 commits + Plan 03-11 polish + operator re-walk per D-WAVE-08; Plan 03-04 `depends_on: [03-03, 03-11]`)_

- [x] 03-04-capture-foundation-muxer-bridge-PLAN.md — `androidx.media3:media3-muxer:1.10.0` Gradle dep + FragmentedMuxerWrapper.kt + 17 capture/ Wave 0 Kotlin test stubs (Task 2a) + 1 fgs/ Wave 0 stub (Task 2b) + HumynCapture.ts JS bridge stubs + CaptureSessionOpts Zod schema; includes Task 0 pre-flight that requires `re-walked-on:` stamp in 03-WAVE1-SMOKE.md before any encoder work

**Wave 3** _(parallel — pure-fn primitives + metadata + FGS; depend only on Plan 03-04)_

- [x] 03-05-pure-fn-primitives-PLAN.md — DriftCalculator (CAP-08), ImuRateObserver (CAP-19), FilenameGenerator (CAP-17 with filename_seq_exhausted guard at NNN=999), UlidGenerator (io.azam.ulidj wrapper per checker issue #15), HashStreamer (CAP-15), SidecarManager (D-FS-05) — flips 6 Wave 0 stubs to GREEN
- [x] 03-06-metadata-composer-PLAN.md — MetadataComposer (CAP-16, schema_version → 1.1.0 with imu_min_rate_hz_observed_p1) — flips 1 stub
- [x] 03-07-foreground-service-thermal-PLAN.md — HumynForegroundService + Notification + AndroidManifest entry + ThermalGate (CAP-11/12/14) — flips 2 stubs

**Wave 4** _(encoder/audio/IMU wrappers + segment timer; depend on 03-04 + 03-05)_

- [x] 03-08-encoder-imu-segment-timer-PLAN.md — HevcEncoder (CAP-01), AacEncoder (CAP-03 — _AAC encoder shipped but capture path was unwired 2026-05-11; AacEncoder.kt retained as dead code per GAP-3 disposition_), ImuWriter (CAP-04/05/06), SegmentTimer (CAP-09), BackUltrawidePicker shared util — flips 4 stubs

**Wave 5** _(orchestrator part 1 — bridge surface; depends on 03-04..08)_

- [x] 03-09-orchestrator-bridge-wireup-PLAN.md — HumynCaptureModule + Package + SegmentDurationConfig + CaptureSessionOptsBridge (dedicated file per checker issue #14) + CaptureLaunchSweep + MainApplication wire-up + JS bridge integration test (5th describe block) + 03-MANUAL-SMOKE.md runbook (start()/stop() ship as `not_implemented_in_03_09` stubs; Plan 03-10 replaces)

**Wave 6** _(orchestrator part 2 — segment lifecycle + final stub flips; depends on 03-09)_

- [x] 03-10-capture-session-finalize-PLAN.md — CaptureSession.kt orchestrator + FinalizeWorker.kt + replace HumynCaptureModule.start()/stop() bodies — flips final 5 stubs (StartGateCarryover, EventEmission, ClockAlignment, RealtimeGate, FileFidelity). Pump loop appends `bufferInfo.presentationTimeUs * 1_000L` to seg.videoFrameTimestamps for CAP-08 (per checker issue #2). Both files use SystemClock.elapsedRealtimeNanos exclusively (per checker issue #10).

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

**Plans:** 12 plans (10 original + 2 gap-closure)

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — RN deps install (VisionCamera 4.7.3 / tts / fs / orientation-locker / worklets-core / reanimated / firebase-analytics + crashlytics) + vitest mocks + orientation-locker Android manifest/activity wiring (completed 2026-05-11)
- [x] 04-02-PLAN.md — 5 native module shells (HumynHandDetector / HumynPhoneState / HumynBattery / HumynScreenBrightness / HumynBeep) + JS bindings + MediaPipe `tasks-vision:0.10.21` gradle dep + `hand_landmarker.task` asset + MainApplication registration + native-binding tests
- [x] 04-03-PLAN.md — `practiceDoneKey(sub)` MMKV helper + `decodeGoogleSubFromJwt` util extraction + `setPracticeDone` action + `computeInitialRoute` per-account tutorial gate + RigTutorial Next-CTA retarget (completed 2026-05-11)
      **Wave 2** _(blocked on Wave 1)_
- [x] 04-04-PLAN.md — HumynHandDetectorModule.kt MediaPipe HandLandmarker body (IMAGE mode, numHands=2, CPU delegate, RGB_565/320×240/recycle — HAND-13)
- [x] 04-05-PLAN.md — HumynPhoneState (AudioFocus only) + HumynBattery (ACTION_BATTERY_CHANGED) + HumynScreenBrightness (per-window override) + HumynBeep (SoundPool) bodies + the 2 pre-baked .wav assets (completed 2026-05-11)
      **Wave 3** \*(blocked on Wave 1)\_
- [x] 04-06-PLAN.md — PracticeIntroScreen (§6) + PracticeCompleteScreen (§8 — confetti + scale-pop + [40,80,40]ms haptic, writes ONB-08 flag) + OnboardingStack routes + analytics events + practiceFlow test + 2 visual baselines
- [x] 04-07-PLAN.md — recState.ts state machine (§4.3) + 5 recording components (GateRing/VoiceCuePill/StopConfirmModal/AlertPill/RotatePrompt) + RecordingScreen shell + RootNativeStack Recording route + route-registry.test.ts update (Pattern 54 — adds a `REQUIRED_PHASE_4_ROUTES = ['Recording']` block; `PracticeIntro`/`PracticeComplete` get added to it by plan 04-09 since 04-06 registers them in the same wave) + 8 visual baselines (completed 2026-05-11)
      **Wave 4** _(blocked on Waves 2+3)_
- [x] 04-08-PLAN.md — useRecordingLifecycle hook (idea-brief §10 policy table + practice 60s hard cap + checkStartGuards) + ttsVoice.ts (REC-14 fallback + speakCue) + durationFormat.ts (REC-04 / HOME-06) + `__DEV__`-gated dev affordance on TasksPlaceholder (completed 2026-05-11)
      **Wave 5** _(blocked on Wave 4)_
- [x] 04-09-PLAN.md — RecordingScreen live wiring: VC `<Camera>` on the compat ultrawide lens + HAND-12 pre-warm + useHandGate poll loop + gate-pass→active TTS-masked transition + buildCaptureOpts + RemoteConfig gate reads + useRecordingLifecycle mount + §7h post-stop routing + HAND-14 analytics + brightness/orientation + route-registry.test.ts `PracticeIntro`/`PracticeComplete` additions (completed 2026-05-11)
      **Wave 6** _(blocked on Wave 5)_
- [x] 04-10-PLAN.md — onCrashRecovery event (Phase-3 sweep emit + JS binding) + Toast host + bootRecoveryListener + `04-MANUAL-SMOKE.md` on-hardware acceptance runbook (incl. the **[BLOCKING] ±1ms drift re-measurement** on the gate→record handoff) + ROADMAP/STATE refresh (completed 2026-05-11)
      **Wave 7 — gap closure** _(addresses 04-VERIFICATION.md gaps: CR-01 blocker + WR-01..07 + IN-01/02/09; parallel — no file overlap between 04-11 and 04-12)_
- [x] 04-11-PLAN.md — CR-01 (recording surface reachable in a release build — production orientation→LANDSCAPE_DETECTED path + no-`__test_initialState` render test + `04-MANUAL-SMOKE.md` §2 amendment) + WR-01 (RemoteConfig gate cadence/target reach the reducer via SET_GATE_CONFIG) + WR-02 (no orphaned native capture session on a gate→record exit) + WR-07 (practice 60s cap survives the stop-confirm modal) + WR-06/IN-01/IN-02/IN-09 in-file polish
- [x] 04-12-PLAN.md — WR-03 (HumynHandDetectorModule.cleanup() serialised with detect() on bgExecutor — no MediaPipe crash on unmount-during-gate-poll) + WR-04 (HumynBeepModule first playTone() audible — pre-load + OnLoadCompleteListener + pending-play queue + play()-return-value check)

  **UI hint**: yes

### Phase 5: Upload Pipeline & Hash-Verify Worker

**Goal**: A finished recording uploads automatically as a three-file bundle, survives backgrounding / force-quit / Android 14/15 service-type restrictions / OEM battery managers, gets re-hashed server-side and either confirmed via a `verified` event or queued for re-upload. _(The server-side IMU-liveness check — FRAUD-03/04 — was briefly in this phase, then descoped to §v2 on 2026-05-11; FRAUD-05/06 (per-account upload-rate cap + pre-payout fraud dashboard) descoped to §v2 on 2026-05-12 — see CONTEXT.md D-04. The upload bundle still carries the IMU CSV, it is just not analysed server-side at MVP.)_
**Depends on**: Phase 3
**Requirements**: UP-01, UP-02, UP-03, UP-04, UP-05, UP-06, UP-07, UP-08, UP-09, UP-10, UP-11, UP-12, UP-13, UP-14, UP-15, UP-16, UP-17, UP-18, UP-19, VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06, VERIFY-07
**Success Criteria** (what must be TRUE):

1. On recording stop, the bundle (MP4 + IMU CSV + metadata JSON) uploads automatically via S3 multipart presigned URLs with 8 MB chunks on Wi-Fi / 2 MB on cellular (cellular S3 part size = 5 MiB — reconciled to S3's 5-MiB minimum non-final part size, 2026-05-12; idea-brief.md §7.1 still states 2 MB, not edited), 3 chunks parallel per file × 2 files parallel, exponential backoff (2 / 4 / 8 / 16 / 32 / 64 s → DLQ), no manual user-cancel, no whole-file restart on chunk fail, and TCP_MAXSEG=1280 + 30-second no-progress abandon-and-retry-with-fresh-socket on cellular
2. Uploads survive backgrounding and force-quit on Android via a foreground service that downgrades type from `camera|microphone|dataSync` (during recording) → `dataSync` (post-recording) → stops after 5 min idle, with a UIDT JobService (`setUserInitiated(true)` + `RUN_USER_INITIATED_JOBS` permission) handling true-background work to defeat the Android 15 6-hour `dataSync` cap; iOS uses `URLSessionConfiguration.background` + `sessionSendsLaunchEvents = true` with the multipart-complete POST running as a foreground task inside `urlSessionDidFinishEvents`; uploads pause during recording and resume on stop, logout cancels in-flight but preserves the queue, and same-user re-login resumes
3. The first-upload OEM battery-optimization walkthrough surfaces per-vendor deep-links and steps for Xiaomi (MIUI), Oppo (ColorOS), Vivo (FunTouch), Samsung (OneUI), and stock Android, the Pending Uploads tile shows per-file progress (filename / duration / thumbnail / state), and cellular uploads are allowed by default with no Wi-Fi-only toggle
4. The hash-verify worker (BullMQ + Redis + ECS, scaled on queue depth) consumes S3 multipart-complete events via EventBridge → SQS, re-hashes both MP4 and IMU CSV, flips `recordings.qa_status` to `'verified'` (emit `verified` event) on match or `'hash-mismatch'` (emit `re-upload` event) on mismatch; events deliver piggy-backed on the next API response, the app deletes local MP4 + CSV + JSON only on `verified`, re-uploads from the still-present local copy on `re-upload`, and an app-launch reconciliation sweep cleans local files for any verified-but-undeleted set

**Plans:** 8 plans (Wave 1 = 05-01 + 05-02 cleanup ‖ ; Wave 2 = 05-03 backend infra/worker + 05-04 mobile native foundation ‖ ; Wave 3 = 05-05 backend HTTP surface + 05-06 mobile transfer engine ‖ ; Wave 4 = 05-07 FGS/UIDT/battery-opt ; Wave 5 = 05-08 Pending Uploads UI + reconcile + wire-up + smoke)

Plans:

**Wave 1**

- [x] 05-01-PLAN.md — Wave 1: Android+RN cleanup code (D-03 CaptureLaunchSweep discards crash-truncated fragments; D-05 device-distress→Home nav; D-07 recovery-toast 5s revert + annotation)
- [x] 05-02-PLAN.md — Wave 1: docs/housekeeping (FRAUD-05/06 → §v2; phase re-title; ROADMAP trims + the rescinded duration_seconds:0 note; CLAUDE.md Redis carve-out + backend pins; STACK.md Redis pin; 04-MANUAL-SMOKE refresh + design-spec/UI-SPEC owner deviations; the Wave-1 cleanup smoke runbook; VALIDATION.md per-task map)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 05-03-PLAN.md — Wave 2: backend infra + hash-verify worker (Redis container + bullmq/ioredis/sqs deps + lib/queue.ts; recording_events_outbox table + enum + migration + [BLOCKING] schema push; recording-state hash-mismatch→pending edge; sha256-stream; recording-events; verify-recording; workers/hash-verify.ts; cron/verify-sweep.ts; shared-types stub; Vitest scaffolds) — VERIFY-01..04, VERIFY-07
- [x] 05-04-PLAN.md — Wave 2: HumynUpload Android native-module foundation (HumynUploadModule/Package + register in MainApplication; UploadQueueStore native-owned JSON queue with the D-08 practice filter + the UP-13 owner-pin; UploadModels chunk-size 8MiB/5MiB + partsCountFor; manifest perms + UploadJobService <service>; native/HumynUpload.ts; UploadQueueStoreTest) — UP-02, UP-05, UP-11, UP-13, UP-17

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 05-05-PLAN.md — Wave 3: backend HTTP surface (events-outbox onSend plugin + the \_events envelope + the Pattern-22 schema additions; POST /recordings/:id/reupload; GET /recordings/verified-ids; req.ip→recordings.ipAddress; the /finalize dev shim; the verify-queue Terraform module — SQS+DLQ + EventBridge rule + worker ECS task + queue-depth autoscaling + least-privilege IAM; Vitest scaffolds) — VERIFY-01, VERIFY-05, VERIFY-06, VERIFY-07, UP-16, UP-18
- [ ] 05-06-PLAN.md — Wave 3: HumynUpload transfer engine (ChunkUploader — streaming PUT-per-part + ETag + 2/4/8/16/32/64s retry→dead-letter + the 30s no-progress watchdog + the best-effort MSS clamp; UploadCoordinator — /init→PUT(metadata+parts, 6-permit semaphore = 3∥×2∥)→/finalize, per-part-state persistence, debounced progress, pause/owner-aware; NetworkMonitor; HumynUploadModule wiring; JUnit scaffolds) — UP-01, UP-03, UP-04, UP-17, UP-19

**Wave 4** _(blocked on Wave 3 completion)_

- [ ] 05-07-PLAN.md — Wave 4: OS-survival hardening (HumynForegroundService type-downgrade lifecycle recording→dataSync→idle-stop + onTimeout→UIDT handoff + the drain on the FGS thread; UploadJobService UIDT JobService; BatteryOptimizationHelper AOSP-first + resolveActivity-gated OEM deep-links; BatteryOptimizationScreen first-upload walkthrough; the extended two-sided manifest↔bitmask lock) — UP-06, UP-07, UP-09, UP-10

**Wave 5** _(blocked on Wave 4 completion)_

- [ ] 05-08-PLAN.md — Wave 5: client-surface wire-up (PendingUploadsScreen + UploadStatusChip incl. the 'Paused — no Wi-Fi' variant + the §21.7 resolution; Home-tile real data; recordingEvents \_events consumer + uploadReconcile sweep + the HumynUploadModule.reupload @ReactMethod + the auto-enqueue/pause/resume/logout wiring; the end-to-end upload smoke runbook) — UP-05, UP-10, UP-11, UP-12, UP-13, UP-14, UP-15, UP-16, VERIFY-06

### Phase 6: Tasks, History, Home Tiles & Lexical Search

**Goal**: A user can browse and search the 65-task catalog, view dynamic Home contribution tiles with time-range filters, and review every recording in History with in-app playback while local copies exist.
**Depends on**: Phase 2
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, TASK-09, TASK-10, HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-09, HOME-10, HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07, HIST-08, HIST-09, HIST-10, HIST-11
**Success Criteria** (what must be TRUE):

1. A user can browse all 65 tasks across 10 categories (Cooking, Dishwashing, Kitchen, Cleaning, Tidying, Laundry, Gardening, Pet Care, Home Maintenance, Hobby) sourced from `task-taxonomy.md`, filter by horizontally-scrollable per-category pills, and search via the always-visible 200 ms-debounced server-side lexical (`ts_vector` + GIN, fuzzy fallback) query — task cards show lucide-react icons (28 px stroke 1.75) via `<TaskIcon task={slug} />`, names verbatim, category eyebrow, 1-2 line description, and a non-prototype "no results" empty state with `SearchX` icon + send-request link
2. Tapping a task opens the details sheet with category chip + optional outdoor chip + verbatim name and description + the 4-rule Universal block (`front_hand` / `videocam` / `lightbulb` / `apps`) + max-3-bullet "For this task" instructions (server-validated against duplicate universal-rule strings) + Start Recording CTA; users can submit a Send Request form (3-80 char name / 10-240 char description / category + Other / Indoor/Outdoor / optional ≤30 s ≤50 MB sample video) and never see request status
3. The Home screen shows the first-time empty hero ("Record your first task") + zero-state tiles for new users and the dynamic hero (lifetime contribution numeric + task count + Start Recording CTA) + real-data tiles for returning users; recording-duration and tasks-recorded tiles toggle across today / yesterday / this week / this month / all time / custom range using the canonical duration formatter (`<1m → Xs`, `<1h → Xm`, `≥1h → Xh Ym` floored to previous minute), Pending Uploads tile is visible only when count > 0 and tapping opens the upload-queue screen, pull-to-refresh on tiles fetches fresh `/contributions` data, and a non-blocking offline banner appears in the Pending Uploads tile when network is unreachable
4. Every successful recording (≥60 s) appears in History grouped by day newest-first, filterable across the same six time-range options, with rows showing filename + duration + task name + recorded-at timestamp (`May 4, 2026 | 15:49`) + upload-state chip (Uploaded at / In progress / Paused due to network / Failed-with-retry) + first-frame thumbnail + disabled "Feedback (coming soon)" slot
5. Tapping a thumbnail opens the in-app fullscreen player (play / pause / seek only — no download / share / export / delete) while the local MP4 still exists; once the `verified` event clears the local copy, the thumbnail remains but tap shows "This recording has been securely uploaded. Local copy cleared."; empty-state copy renders correctly with no-recordings vs filter-applied variants
   **Plans**: TBD
   **UI hint**: yes

### Phase 7: Observability & APK Distribution Hardening

**Goal**: The operational observability stack visible to ops can detect a regression before users complain, and the signed-APK distribution pipeline (build flavors, release signing, in-app update channel) is production-hardened. (iOS parity and the staged Play Store → App Store rollout are descoped from this MVP to a follow-on milestone — see REQUIREMENTS.md §v2: DIST-05, DIST-06, IOS-01..07.)
**Depends on**: Phase 6
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05
**Success Criteria** (what must be TRUE):

1. The full event funnel from `engineering-handoff.md` §11 (signup*\*, permission*\_, compat\__, recording*\*, gate*_, upload\__, history*\*, profile*_, help\_\_) emits via Firebase Analytics, native + JVM crashes + ANRs report via Firebase Crashlytics, the backend emits structured CloudWatch logs with per-device-model + per-OS-version + per-locale cohorting, the Bull-Board dashboard surfaces queue depth + retry counts + DLQ for the hash-verify worker, and Sentry / Datadog / third-party RUM are explicitly absent at MVP
2. The signed-APK distribution pipeline is production-hardened — the `apkRollout` flavor builds a release-signed APK with its distinct `applicationId`, `HumynUpdater` downloads + SHA-256-verifies + installs the next APK via `PackageInstaller`, `GET /app/version` drives the force-upgrade gate against `min_supported` plus the dismissible banner below `latest`, and a release / signing / key-rotation runbook is documented (Play Store + iOS App Store distribution channels deferred — see REQUIREMENTS.md §v2: DIST-05, DIST-06, IOS-01..07)
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

(Per research SUMMARY.md, parallelization opportunities exist where indicated — Phase 2 with Phase 3, Phase 4 (HandDetector portion) with Phase 5 (Upload portion). Numeric order is the default execution order; parallelization is a planning-time choice.)

| Phase                                                      | Plans Complete | Status      | Completed  |
| ---------------------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Foundation, Backend & Distribution Recon                | 13/13          | Complete    | 2026-05-08 |
| 2. Mobile Shell, Onboarding, Permissions, Compat & Profile | 22/22          | Complete    | 2026-05-10 |
| 3. HumynCapture Native Module (Bytes-on-disk)              | 11/11          | Complete    | 2026-05-11 |
| 4. HandDetector, Recording UX & Practice Tutorial          | 10/10          | In progress | -          |
| 5. Upload Pipeline & Hash-Verify Worker                    | 0/TBD          | Not started | -          |
| 6. Tasks, History, Home Tiles & Lexical Search             | 0/TBD          | Not started | -          |
| 7. Observability & APK Distribution Hardening              | 0/TBD          | Not started | -          |
