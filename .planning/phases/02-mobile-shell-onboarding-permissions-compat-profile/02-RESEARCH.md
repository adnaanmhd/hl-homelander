# Phase 2: Mobile Shell, Onboarding, Permissions, Compat & Profile — Research

**Researched:** 2026-05-08
**Domain:** React Native Android non-recording client surface — sign-in, permissions, behavioral compat-check, tutorial chrome, Profile, Help Center, Forced Upgrade
**Confidence:** HIGH on stack pins, navigation graph, force-upgrade flow, design-token wiring, profile/help/feedback surfaces; MEDIUM-HIGH on the compat-check primitives (NAL parse, OIS readback, HDR force, IMU sustained probe, dFOV computation, root verdict) — APIs are documented but per-OEM behavior requires real-device validation; LOW on free-space threshold semantics under user-data containers (verifiable in code, no API drift).

**Key constraint:** Designs LOCKED, capture spec LOCKED, stack LOCKED. This research is the technical "how" for 41 already-decided requirements — every recommendation is anchored to either an explicit Phase 1 artifact, a CONTEXT.md decision, or a documented Android/RN API.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Navigation architecture:**

- **D-NAV-01:** React Navigation v7 (`@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`).
- **D-NAV-02:** Navigator graph:
  ```
  RootNativeStack
    ├── OnboardingStack (Splash → Signup → Permissions → Compat → RigTutorial)
    ├── MainTabs (bottom-tabs: Home / Tasks / History)  ← Profile is pushed onto Root, not a tab
    ├── Recording (full-bleed, Phase 4)
    ├── Player (full-bleed, Phase 6)
    └── ForceUpgrade (modal presentation)
  ```
- **D-NAV-03:** Deep-link surface ships per engineering-handoff §3.4. Phase 2 wires routes that exist by Phase 2 (signup, home, profile, help). Phase-4/6 routes resolve to placeholder handlers.
- **D-NAV-04:** Hardware back behavior matches engineering-handoff §3.3 — Sign-up exits app; Permissions/Compat/Tutorial have no back; Tasks/History/Profile/Help back to Home; ForceUpgrade modal blocks back when `hardBlock=true`.

**Onboarding state & resume:**

- **D-STATE-01:** Single MMKV instance `humyn.secure` (already wired). Keys versioned `.v1`:
  - `auth.jwt.v1` (exists)
  - `onboarding.consent.v1` — `{ acceptedAt, consentVersion }`
  - `onboarding.permsGranted.v1` — `{ camera, mic, grantedAt }`
  - `onboarding.compatPassed.v1` — `{ signature, runAt, passed: true }`
  - `onboarding.tutorialDone.v1` — `{ doneAt, googleSub }`
  - `installation_id.v1` — UUID minted at first launch
  - `compat.lastResult.v1` — full CompatResult
  - `appVersion.cache.v1` — `{ response, fetchedAt }`
  - `appVersion.softBannerDismissed.{latest}` — boolean per-version
  - `telemetry.ring.v1` — last-100-events JSON array
- **D-STATE-02:** Zustand single store at `apps/mobile/src/state/appStore.ts`. Hydrates from MMKV on App.tsx mount. No Redux, no Context-only.
- **D-STATE-03:** Cold start re-computes initial route from MMKV. Background→foreground re-checks JWT expiry + OS-level permission status. Transient screens (Compat-running) restart their work — not persisted mid-flight.
- **D-STATE-04:** AUTH-11 detected client-side via `compatSignature` containing `installation_id`. New install on a new device → fresh UUID → signature mismatch → forced compat re-run.

**Compat-check execution path:**

- **D-COMPAT-01:** Slim `HumynCompat` Kotlin module at `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt`. Separate from Phase 3's HumynCapture.
- **D-COMPAT-02:** Three method surface:
  - `runEncoderProbe()` → `{ bFramePresent, oisOff, hdrSdrForced, encoderClipPath }`
  - `runImuProbe(durationMs=30000, withPreview=true)` → `{ sustainedHz, p99IntervalMs, samplesCollected }`
  - `readDeviceCaps()` → `{ resolutionMax, fpsMax, ultrawideDfovDeg, micSampleRateMax, realtimeTimestampSource, rooted, freeStorageGB }`
- **D-COMPAT-03:** `compatSignature` = `sha256(${appVersionCode}|${Build.FINGERPRINT}|${installation_id}).slice(0,16)`. Stored in `compat.lastResult.v1.signature`.
- **D-COMPAT-04:** Probe clips at `context.cacheDir/compat-probe-{epochMs}.mp4` (~5 MB). Deleted in Kotlin `finally`. App-launch sweep in `MainApplication.onCreate` unlinks orphans.
- **D-COMPAT-05:** `CompatResult` Zod schema at `shared/types/CompatResult.ts` (see schema in CONTEXT.md). `failedKeys` drives COMPAT-06 fail screen; `measured*` fields drive "yours: 44 Hz" copy.

**Design tokens & primitives:**

- **D-UI-01:** Typed-constants at `apps/mobile/src/ui/tokens.ts`. No theme provider. Light-only at MVP.
- **D-UI-02:** Eight primitives: `Text`, `Button`, `Pressable`, `ScreenContainer`, `Sheet`, `Modal`, `Field`, `Icon`.
- **D-UI-03:** Fonts via `react-native-asset`. Brand fonts copied from `design-system/` to `apps/mobile/assets/fonts/`.
- **D-UI-04:** `lucide-react-native` for general icons; existing `<TaskIcon>` continues for task-card icons (out of Phase 2 scope but the namespace constraint is preserved).
- **D-UI-05:** Light-only at MVP — no dark-mode tokens.

**Forced-upgrade flow (per-flavor):**

- **D-UPG-01:** Single flavor-aware `ForceUpgradeScreen` reads `flavor` from `getFlavorContext()`. apkRollout downloads APK + SHA-256 verifies + launches `PackageInstaller.Session`; playStore opens `market://`.
- **D-UPG-02:** Hash-mismatch → delete file, show error, emit `force_upgrade_apk_hash_mismatch` Firebase Analytics event with `{apk_url, expectedHash, actualHash, downloadedSize}`. NEVER pass mismatched APK to PackageInstaller.
- **D-UPG-03:** `REQUEST_INSTALL_PACKAGES` declared only in `apps/mobile/android/app/src/apkRollout/AndroidManifest.xml` (already present per Phase 1).
- **D-UPG-04:** Version check fires on Splash. MMKV cache `appVersion.cache.v1`. 5 s timeout. Network failure → proceed without gating. After resolve: `installedVersion < min_supported` → `navigation.replace('ForceUpgrade', { hardBlock: true })`; `< latest && !forceUpgrade` → set `softUpgradeAvailable: true`.
- **D-UPG-05:** Soft-upgrade banner mounts at top of Home only. Per-`latest` dismiss key in MMKV.
- **D-UPG-06:** `installedVersion` from `BuildConfig.VERSION_NAME`. Tiny semver helper.
- **D-UPG-07:** Phase 2 first task validates Phase 1 `/app/version` returns the right per-flavor fields. Wire shape verified: discriminated union by `flavor` (`apkRollout` → `apkUrl`+`apkSha256`; `playStore` → `playStoreUrl`).

**Mobile package-manager migration (lands FIRST in Phase 2):**

- **D-PKG-01..07:** Isolate `apps/mobile/` from pnpm workspace. Mobile uses npm with `file:` link to `shared/types`. Workspace surgery: remove `apps/mobile` from `pnpm-workspace.yaml`. CI gets a separate "Mobile build" job. Lint-staged + Husky updated. Phase 1 historical docs not rewritten. Plan **02-01** is the dedicated migration plan; nothing else lands until 02-01 is green.

**Profile, Help Center, Account-delete:**

- **D-PROF-01:** Inline Field-edit pattern with optimistic UI + revert-on-error toast.
- **D-HELP-01:** Help-Center content parsed at build-time from `help-center-content.md` to `apps/mobile/src/screens/help/content.json`; committed.
- **D-HELP-02:** Diagnostic-snapshot ring buffer at `telemetry.ring.v1` (capped 100 entries via FIFO). `POST /feedback` body includes `{ appVersion, buildIdentifier, osVersion, deviceModel, telemetryRing: [...] }`.
- **D-DEL-01:** Typing-gate modal → `DELETE /me` (Phase 1) → on 200, clear MMKV under `humyn.secure` → `navigation.reset()` to `OnboardingStack/Signup`. Restore is server-side via re-sign-in within 30 days.

### Claude's Discretion

- **Motion/animation library** — default Reanimated 3.16.x.
- **Haptics library** — default `react-native-haptic-feedback`.
- **Toast implementation** — default hand-rolled using `Sheet` primitive.
- **Inline-edit Field UX micro-details** — keyboard avoidance, focus management, error display position.
- **Help-Center markdown parsing tool** — default small Node script using `marked`.
- **Semver comparison helper** — default hand-rolled (constrained `M.m.p` shape).
- **Splash duration / animation** — ~2.4 s minimum visual presence; version check in parallel.
- **Deep-link routes for Phase-4/6 surfaces** — default placeholder handlers resolving to "Coming soon".
- **`react-native-permissions` vs platform-direct** — default `react-native-permissions`.
- **Profile Joined-date formatting**.

### Deferred Ideas (OUT OF SCOPE)

- PROJECT.md / REQUIREMENTS.md / ROADMAP.md cleanup of stale clan-chief / KGeN narrative (carried forward).
- Practice recording, hand-gate UX, recording surface (Phase 4).
- Tasks browsing, Task details sheet, Send Request form, History list, Player (Phase 6).
- Upload pipeline + diagnostic-snapshot delivery via piggy-backing (Phase 5).
- iOS analogues — `HumynCompat` Swift analogue, fonts wired into iOS (Phase 7).
- Reanimated motion tuning, fancy transitions (planner-level inside each Phase 2 plan).
- Profile name validation specifics (length limits, profanity filtering).
- Coarse Location permission prompt (Phase 4 — delayed to first recording).
- Help-Center markdown live-reload during dev (nice-to-have).
- In-app restore-account UX (v2).
- APK download progress UI polish (planner-level).
- Soft-banner copy A/B testing (v2).
- Compat-tightening propagation flow (Remote Config bar-raising — planner-level inside Phase 2 if scope allows, else slips to Phase 4).
- APK SHA-256 fingerprint disclosure UX in Profile / Help Center (planner picks within Phase 2).

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                     | Research Support                                                                                                                                                                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01   | Google sign-up CTA                                                                                              | Reuse `signInWithGoogle()` (apps/mobile/src/services/auth.ts); wrap in design-spec §2 layout                                                                                                                                                                                                    |
| AUTH-02   | Terms-of-Use consent checkbox gating                                                                            | Local Zustand state + alert("Please accept the Terms of Use to continue.") on unchecked tap                                                                                                                                                                                                     |
| AUTH-03   | Terms popup with verbatim §5.2 copy                                                                             | `Modal` primitive (D-UI-02); copy lifted from idea-brief.md §5.2 / design-spec.md §18.1                                                                                                                                                                                                         |
| AUTH-04   | Fetch name/email/birthday/age/gender from Google                                                                | `signInWithGoogle()` already returns `{id, email, name, avatarUrl}`; age/gender absent (Google withholds restricted scopes); persist as null                                                                                                                                                    |
| AUTH-05   | Play Integrity at sign-in; reject rooted/emulator/non-Play                                                      | Phase 1 backend `/auth/google` enforces; `requestIntegrityToken` already wired                                                                                                                                                                                                                  |
| AUTH-07   | Session persists via Keychain/Keystore                                                                          | JWT in MMKV `humyn.secure` (encrypted); Keychain refresh-token slot reserved per Phase 1                                                                                                                                                                                                        |
| AUTH-08   | Logout cancels in-flight upload, preserves queue, returns to Sign-up                                            | Phase 2 has no upload pipeline; placeholder hook calls `clearStoredJwt()` + `navigation.reset()`                                                                                                                                                                                                |
| AUTH-09   | Soft-delete account (30-day restore)                                                                            | `DELETE /me?confirm=DELETE` (Phase 1 API-03); restore via re-sign-in; no in-app restore UI                                                                                                                                                                                                      |
| AUTH-10   | DELETE-typing gate before account-delete API fires                                                              | Modal with `Field` requiring exact `DELETE` string; backend already requires `?confirm=DELETE` query param                                                                                                                                                                                      |
| AUTH-11   | Same Google account, new device → re-run compat                                                                 | Client-side via `installation_id`-bearing `compatSignature` (D-COMPAT-03)                                                                                                                                                                                                                       |
| PERM-01   | Camera permission prompt + denied recovery                                                                      | `react-native-permissions` `request(PERMISSIONS.ANDROID.CAMERA)`; denied state → `openSettings()` link per design-spec §3.1.1                                                                                                                                                                   |
| PERM-02   | Microphone permission prompt                                                                                    | `react-native-permissions` `request(PERMISSIONS.ANDROID.RECORD_AUDIO)`                                                                                                                                                                                                                          |
| PERM-03   | Coarse Location prompt before first recording                                                                   | **OUT of Phase 2** — deferred to Phase 4; only Camera + Mic prompt in Phase 2                                                                                                                                                                                                                   |
| PERM-04   | Manifest-only permissions for sensors, foreground service, wake lock, network state                             | Update `apps/mobile/android/app/src/main/AndroidManifest.xml` to add `CAMERA`, `RECORD_AUDIO`, `WAKE_LOCK`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_MICROPHONE`, `FOREGROUND_SERVICE_DATA_SYNC`. Sensors are normal-permission (no `<uses-permission>` required) |
| COMPAT-01 | One-time compat after permissions: resolution, FPS, dFOV, gyro+accel, 48 kHz mic, REALTIME timestamp, root      | `HumynCompat.readDeviceCaps()` per D-COMPAT-02                                                                                                                                                                                                                                                  |
| COMPAT-02 | IMU sustained ≥100 Hz over 30 s window with 1080p preview running                                               | `HumynCompat.runImuProbe(30000, withPreview=true)` per D-COMPAT-02                                                                                                                                                                                                                              |
| COMPAT-03 | Free-space < 5 GB warning (non-blocking)                                                                        | `StatFs(Environment.getDataDirectory().path).availableBytes` in `readDeviceCaps()`; surface as `warningOnly: true` in CompatResult so the planner can render the non-blocking banner                                                                                                            |
| COMPAT-04 | Re-run after app/OS update, new device                                                                          | `compatSignature` includes `appVersionCode + Build.FINGERPRINT + installation_id` (D-COMPAT-03)                                                                                                                                                                                                 |
| COMPAT-05 | Bar-raise — previously-passed but now-failing devices blocked from new recordings                               | Phase 2 ships the gate via `compatSignature`-triggered re-run; Remote Config bar-raising knob is deferred (CONTEXT.md deferred-ideas)                                                                                                                                                           |
| COMPAT-06 | Fail screen lists exactly which checks failed; user cannot proceed                                              | `CompatResult.failedKeys` drives the fail screen; navigator gate prevents progression                                                                                                                                                                                                           |
| COMPAT-07 | Behavioral checks: NAL B-frame parse + OIS readback + HDR→SDR force + IMU p99 ≤ 12 ms with `maxReportLatency=0` | `HumynCompat.runEncoderProbe()` + `runImuProbe()` per D-COMPAT-02                                                                                                                                                                                                                               |
| COMPAT-08 | Compat-fail "what now" recovery page                                                                            | Static screen below COMPAT-06; copy: "Try a different qualifying device. Contact support." (planner finalizes the wording)                                                                                                                                                                      |
| ONB-01    | Rig screen with verbatim copy                                                                                   | design-spec §5: "You'll need a head rig" + body. Static layout; sticky `Next` → `OnboardingComplete` (no practice in Phase 2)                                                                                                                                                                   |
| ONB-02    | "Don't have a rig yet" off-ramp                                                                                 | Secondary link → recovery info + `mailto:[EMAIL_ADDRESS]`; no soft-lock                                                                                                                                                                                                                         |
| HOME-07   | Bottom nav has exactly 3 tabs (Home/Tasks/History); Profile via avatar                                          | `MainTabs` with 3 `Tab.Screen`s; avatar in `TopBar.Logo` pushes Profile onto RootNativeStack                                                                                                                                                                                                    |
| HOME-08   | Bottom nav suppressed on splash/auth/perms/compat/tutorial/recording/force-upgrade                              | Automatic — tabs only mounted inside `MainTabs`; OnboardingStack/Recording/Player/ForceUpgrade are RootNativeStack siblings                                                                                                                                                                     |
| PROF-01   | Avatar (read-only), name+age+gender editable, Joined date                                                       | `GET /me` (Phase 1 API-02) for read; `PATCH /me` (UserPatchSchema) for write; inline-edit pattern                                                                                                                                                                                               |
| PROF-02   | Payments & Earnings card with verbatim §5.11 copy + Coming-soon badge                                           | Static card; copy lifted from idea-brief.md §5.11 / design-spec §15                                                                                                                                                                                                                             |
| PROF-03   | Lifetime contribution numeric (44 px mono) + "Across N tasks"                                                   | `GET /contributions` (ContributionsLifetimeSchema returns `durationMs`, `taskCount`); duration formatter `apps/mobile/src/util/durationFormatter.ts`                                                                                                                                            |
| PROF-04   | Help Center, Logout, Delete account entries                                                                     | Stack-pushed routes for Help; modals for Logout + Delete                                                                                                                                                                                                                                        |
| PROF-05   | App version + build identifier in footer                                                                        | `${BuildConfig.VERSION_NAME}-${BuildConfig.FLAVOR_NAME} (${BuildConfig.VERSION_CODE})` exposed via existing `AppFlavor` native module + extending it to include versionName/versionCode                                                                                                         |
| HELP-01   | 3 accordions, collapsed by default: Instructions Guide, FAQs, Troubleshooting                                   | Custom `Accordion` domain component; rows from `content.json`                                                                                                                                                                                                                                   |
| HELP-02   | Help Center copy verbatim from `help-center-content.md`                                                         | Build-time `apps/mobile/scripts/build-help-content.mjs` parses MD → JSON; runs as `prebuild` script                                                                                                                                                                                             |
| HELP-03   | Contact Support → mailto with `[EMAIL_ADDRESS]` placeholder                                                     | `Linking.openURL('mailto:[EMAIL_ADDRESS]?subject=Humyn+Labs+Support')`                                                                                                                                                                                                                          |
| HELP-04   | Help Center reachable only from Profile                                                                         | No nav entry from Home/Tasks/History; only Profile → Help Center stack push                                                                                                                                                                                                                     |
| HELP-05   | In-app "Report a problem" form → POST /feedback with diagnostic snapshot                                        | `multipart/form-data` to `POST /feedback` (FeedbackFieldsSchema: category enum + message); diagnostic JSON attached as a file part. Telemetry ring buffer in `telemetry.ring.v1`                                                                                                                |
| UPG-01    | `GET /app/version` on app open                                                                                  | Splash mounts → reads cache → calls endpoint if stale (D-UPG-04)                                                                                                                                                                                                                                |
| UPG-02    | Response shape `{ min_supported, latest, force_upgrade }` (per-flavor extras)                                   | Phase 1 `AppVersionResponseSchema` discriminated union by flavor — verified                                                                                                                                                                                                                     |
| UPG-03    | `installedVersion < min_supported` → block screen + Play Store deep-link                                        | Per-flavor: apkRollout downloads APK; playStore `market://`                                                                                                                                                                                                                                     |
| UPG-04    | `< latest && !force_upgrade` → dismissible soft banner on Home                                                  | Per-version dismiss key in MMKV (D-UPG-05)                                                                                                                                                                                                                                                      |
| UPG-05    | Version response cached 6 hours                                                                                 | Backend already sends `Cache-Control: public, max-age=21600`; client also caches via MMKV `appVersion.cache.v1.fetchedAt`                                                                                                                                                                       |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives carry the same authority as locked Phase 2 decisions. Plans must not contradict.

- **Designs LOCKED.** `prototype.html` + `design-spec.md` + `engineering-handoff.md` are source of truth. Every screen, state, copy string, animation curve, and token comes verbatim from those files. No new design work.
- **Capture spec LOCKED.** Every value in `idea-brief.md` §2.1 is hard. Phase 2's `HumynCompat.runEncoderProbe()` validates that the device CAN hit those values; any device that cannot is rejected.
- **Tech stack LOCKED:** RN 0.83 (Hermes new arch), VisionCamera 4.7.3 (NOT for capture pipeline), MediaPipe 0.10.21 pinned both Android + iOS, `@react-native-firebase/*` 24.0.0, Google Sign-In 16.1.2 (Credential Manager API), MMKV 4.3.1, Keychain 10.0.0. AWS SDK v3 only.
- **Auth:** Google Sign-In + Play Integrity at sign-in only (per-upload deferred to v2).
- **APK build flavor bypasses install-source check via Remote Config; Play Store flavor cannot opt in.** Already enforced in Phase 1; Phase 2 inherits.
- **No notifications channel.** No `POST_NOTIFICATIONS`, no FCM/APNs.
- **No success metrics gating phase completion.** MVP ships ship-by-vibe.
- **Privacy / consent:** consent text in `idea-brief.md` §5.2 is canonical; consent timestamps logged server-side. Coarse location only.
- **Files never re-encoded.** (Capture-pipeline rule; Phase 2 doesn't capture, but the compat-probe clip MUST be deleted, not retained.)
- **GSD workflow enforcement.** Use GSD commands; no direct repo edits outside a GSD workflow.

## Architectural Responsibility Map

Phase 2 is entirely Android-tier device-plane work. iOS is deferred to Phase 7. No backend work.

| Capability                                                             | Primary Tier                                                              | Secondary Tier                                               | Rationale                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in orchestration (Google + Play Integrity + JWT exchange)         | RN/JS service                                                             | Kotlin native (`PlayIntegrity`)                              | `signInWithGoogle()` already lives in JS; Kotlin module just emits Play Integrity token. Already wired in Phase 1.                                                                            |
| Sign-up screen UI                                                      | RN/JS                                                                     | —                                                            | Pure RN composition over the existing service                                                                                                                                                 |
| Permission prompts                                                     | RN/JS via `react-native-permissions`                                      | Android runtime permission system                            | Library wraps the platform `ActivityCompat.requestPermissions` flow                                                                                                                           |
| Manifest-only permission declarations                                  | Build-time / AndroidManifest                                              | —                                                            | `apps/mobile/android/app/src/main/AndroidManifest.xml` declarations                                                                                                                           |
| Compat-check probes (NAL parse, OIS, HDR, IMU, dFOV, root, free-space) | Kotlin native (`HumynCompat`)                                             | Camera2 + MediaCodec + SensorManager + StatFs framework APIs | Encoder/sensor/storage APIs are platform-native; JS just calls and renders results                                                                                                            |
| Compat-result schema + storage                                         | RN/JS (Zod + MMKV)                                                        | shared/types/CompatResult.ts                                 | Schema is the JS↔Kotlin contract; storage lives in MMKV                                                                                                                                      |
| Compat-result rendering (running, pass, fail screens)                  | RN/JS                                                                     | —                                                            | Pure UI                                                                                                                                                                                       |
| Onboarding state + navigator gate                                      | RN/JS (Zustand + MMKV + React Navigation)                                 | —                                                            | Pure JS; native modules only consulted on cold-start (compatSignature)                                                                                                                        |
| Rig tutorial screen                                                    | RN/JS                                                                     | —                                                            | Static screen                                                                                                                                                                                 |
| Bottom-nav structural gating (HOME-07/08)                              | RN/JS (React Navigation tree)                                             | —                                                            | Tab bar only mounted inside MainTabs; suppression is structural, not flag-based                                                                                                               |
| Profile screen (read/write `/me`, lifetime contribution)               | RN/JS                                                                     | Backend API (Phase 1 endpoints)                              | UI + apiClient calls                                                                                                                                                                          |
| Help Center accordions                                                 | RN/JS                                                                     | Build-time MD parser                                         | Content baked at build; UI is pure RN                                                                                                                                                         |
| Help Center "Report a problem" form                                    | RN/JS                                                                     | Backend `POST /feedback`                                     | Multipart upload of fields + diagnostic JSON                                                                                                                                                  |
| Telemetry ring buffer                                                  | RN/JS (MMKV)                                                              | —                                                            | FIFO trim on every analytics event                                                                                                                                                            |
| Account-delete typing gate + API call                                  | RN/JS                                                                     | Backend `DELETE /me?confirm=DELETE`                          | UI gate before API                                                                                                                                                                            |
| Forced Upgrade gate (`GET /app/version`)                               | RN/JS                                                                     | Backend (Phase 1 API-13)                                     | Splash-time HTTP call + MMKV cache                                                                                                                                                            |
| APK download + SHA-256 verify (apkRollout flavor)                      | RN/JS (fetch + crypto-browserify or platform digest) **OR** Kotlin native | Filesystem (`cacheDir`)                                      | Hashing 30+ MB on the JS thread blocks UI; **prefer** a tiny Kotlin extension on `HumynCompat` (or new `HumynUpdater` module) that streams + hashes during download, returns `{path, sha256}` |
| `PackageInstaller.Session` launch (apkRollout)                         | Kotlin native                                                             | Platform PackageInstaller framework API                      | Must be Kotlin — JS cannot drive `PackageInstaller`                                                                                                                                           |
| Soft-upgrade banner                                                    | RN/JS                                                                     | —                                                            | Pure UI + MMKV dismiss state                                                                                                                                                                  |

**Why this matters:** Misassignment risk is highest on (a) the APK download/hash step (don't hash on JS thread — UI freezes), (b) the IMU sustained-rate probe (must run in a Kotlin background thread with REALTIME timestamp source — not RN's main thread), and (c) the encoder-probe NAL parse (Kotlin must walk the bitstream). Everything else is pure RN composition over already-shipped Phase 1 services.

## Standard Stack

### Core (already pinned by Phase 1 / STACK.md — not under debate)

| Library                                             | Version | Purpose                                               | Why standard                                                                  |
| --------------------------------------------------- | ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `react-native`                                      | 0.83.0  | App framework                                         | LOCKED in CLAUDE.md / STACK.md; first "no breaking changes" stability release |
| `react`                                             | 19.2.0  | UI runtime                                            | Bundled with RN 0.83                                                          |
| `@react-native-firebase/app` `auth` `remote-config` | 24.0.0  | Firebase + Remote Config (apk-bypass)                 | LOCKED                                                                        |
| `@react-native-google-signin/google-signin`         | 16.1.2  | Google Sign-In (Credential Manager API)               | LOCKED                                                                        |
| `react-native-mmkv`                                 | 4.3.1   | Encrypted KV store (auth, onboarding, telemetry ring) | LOCKED — already used at `humyn.secure`                                       |
| `react-native-keychain`                             | 10.0.0  | Refresh-token slot (reserved, empty at MVP)           | LOCKED                                                                        |
| `react-native-config`                               | 1.6.1   | `.env` plumbing for `API_BASE_URL` and Web Client ID  | LOCKED                                                                        |
| `react-native-nitro-modules`                        | 0.35.6  | (transitively used by MMKV 4.x)                       | Already installed                                                             |

### New in Phase 2 (versions verified against npm/registry; planner re-verifies at install time)

| Library                          | Version (recommended)                     | Purpose                                                                           | Why this version                                                                                                       |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@react-navigation/native`       | ^7.2.2                                    | Navigation root                                                                   | RN 0.83 + new-arch compatible; `react-native-screens 4.x` is the matched dep [VERIFIED: npm registry as of 2026-05-08] |
| `@react-navigation/native-stack` | ^7.x                                      | Native-stack navigator (Onboarding + Profile + Player + Recording + ForceUpgrade) | Pairs with native v7                                                                                                   |
| `@react-navigation/bottom-tabs`  | ^7.x                                      | Bottom-tabs navigator (3 tabs)                                                    | Pairs with native v7                                                                                                   |
| `react-native-screens`           | ^4.x                                      | Native screen primitives required by native-stack v7                              | Required by `@react-navigation/native-stack` v7 [CITED: reactnavigation.org/docs/upgrading-from-6.x]                   |
| `react-native-safe-area-context` | latest stable for RN 0.83                 | Safe-area insets                                                                  | Required by React Navigation v7; planner pins to current at install time                                               |
| `zustand`                        | ^5.x                                      | App state store                                                                   | Locked per D-STATE-02; small (~1 KB), zero peer deps                                                                   |
| `lucide-react-native`            | 1.14.0                                    | General iconography                                                               | LOCKED at this version per STACK.md; matches engineering-handoff §1.7                                                  |
| `react-native-asset`             | latest stable (devDep)                    | Font asset linker                                                                 | Locked per D-UI-03; matches RN 0.83 ecosystem                                                                          |
| `react-native-permissions`       | ^5.x (RN 0.83 + new-arch supporting line) | Unified permission API                                                            | Library actively maintains New Architecture compatibility [CITED: github.com/zoontek/react-native-permissions]         |
| `react-native-haptic-feedback`   | latest stable                             | Permission-grant + compat-pass haptics                                            | Default; planner-discretion (CONTEXT.md)                                                                               |
| `react-native-reanimated`        | 3.16.x                                    | Compat ring stroke + scalePop logo + soft-banner enter                            | Locked per STACK.md (V4 VisionCamera Skia-frame-processor pair); 4.x rejected as too new                               |

### Possibly avoid (planner-discretion items)

| Instead of                     | Could use                                                | Tradeoff                                                                             |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `react-native-haptic-feedback` | hand-rolled `Vibrator.vibrate(20)` Kotlin wrapper        | Trivial; fine if planner prefers no extra dep                                        |
| `react-native-toast-message`   | hand-rolled toast via `Sheet` primitive                  | CONTEXT.md default is hand-rolled — Phase 2 only needs error toasts on PATCH failure |
| `semver` package               | hand-rolled `M.m.p` comparator                           | 5–10 LOC; a full semver lib is overkill                                              |
| `marked`                       | Tiny regex-based MD-to-JSON for help-center build script | `marked` is fine; light enough; safer                                                |

**Installation (after 02-01 npm migration completes):**

```bash
cd apps/mobile
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs \
  react-native-screens react-native-safe-area-context \
  zustand lucide-react-native react-native-permissions \
  react-native-haptic-feedback react-native-reanimated
npm install --save-dev react-native-asset
```

**Version verification protocol:** Before plan 02-02 (the first dep-install plan after 02-01), the planner MUST run `npm view <pkg> version` for every entry above to confirm the registry hasn't moved past what RN 0.83 + new-arch supports. Lock the resolved versions in `package.json` (no `^` carets for the Phase 2 set; carets allowed only for `@react-navigation/*` patches).

## Architecture Patterns

### System Architecture Diagram

```
                      ┌─────────────────────────────────────────────────────┐
                      │                  Cold start                          │
                      └──────────────────────┬──────────────────────────────┘
                                             ▼
                                ┌─────────────────────────────────┐
                                │ MainApplication.onCreate         │
                                │ ─ register native modules        │
                                │ ─ sweep cacheDir/compat-probe-*  │
                                └──────────────┬──────────────────┘
                                               ▼
                                ┌──────────────────────────────────┐
                                │ App.tsx                          │
                                │ ─ hydrate Zustand from MMKV      │
                                │ ─ compute initial route          │
                                └──────────────┬───────────────────┘
                                               ▼
                              ┌────────────────────────────────────┐
                              │   <NavigationContainer>            │
                              │   <RootNativeStack>                │
                              └────────────────┬───────────────────┘
                                               │
              ┌────────────────────────────────┼─────────────────────────────────┐
              ▼                                ▼                                 ▼
   ┌─────────────────────┐       ┌──────────────────────────┐         ┌─────────────────────┐
   │ OnboardingStack     │       │ MainTabs                 │         │ ForceUpgrade (modal)│
   │ Splash → Signup →   │       │ Home / Tasks / History   │         │ Splash version-chk  │
   │ Permissions →       │       │ ↑ Profile pushed onto    │         │ trips this; reads   │
   │ Compat → RigTutorial│       │   Root via avatar        │         │ flavor → routes to  │
   └─────────┬───────────┘       └────────┬─────────────────┘         │ APK download or     │
             │                            │                            │ market:// link      │
             │                            ▼                            └─────────────────────┘
             │                  ┌─────────────────┐
             │                  │ Profile         │
             │                  │ → Help          │
             │                  │ → Logout modal  │
             │                  │ → Delete modal  │
             │                  └────────┬────────┘
             │                           │
             │                           ▼
             │                  Backend (Phase 1)
             │                  /me, /feedback, /contributions
             │
             ▼
   Native modules (Kotlin)
   ─ HumynCompat:    runEncoderProbe / runImuProbe / readDeviceCaps
   ─ AppFlavor:      flavor / applicationId (existing)
   ─ PlayIntegrity:  requestIntegrityToken (existing)
   ─ HumynUpdater:   downloadAndHashApk + launchPackageInstaller (NEW; apkRollout only)

   ┌──────────────────────────────────────────────────────────────────┐
   │  MMKV humyn.secure (encrypted)                                   │
   │  auth.jwt.v1, onboarding.{consent,permsGranted,compatPassed,    │
   │  tutorialDone}.v1, installation_id.v1, compat.lastResult.v1,    │
   │  appVersion.cache.v1, appVersion.softBannerDismissed.{latest},  │
   │  telemetry.ring.v1                                               │
   └──────────────────────────────────────────────────────────────────┘
```

Data flow:

1. Cold start → `MainApplication.onCreate` does cacheDir orphan-sweep, registers Kotlin modules.
2. `App.tsx` boots → reads MMKV synchronously (MMKV is sync) → hydrates Zustand → computes initial route via the gate-decision tree below → renders `<NavigationContainer>`.
3. Splash mounts → fires `GET /app/version` (with `?flavor=`) in parallel with the 2.4 s splash animation → caches response → routes to ForceUpgrade if `installedVersion < min_supported`, else proceeds.
4. Sign-up screen consumes `signInWithGoogle()` (existing). On success → `navigation.replace('Permissions')`.
5. Permissions screen prompts Camera + Mic via `react-native-permissions`. On both granted → `navigation.replace('Compat')`.
6. Compat screen calls `HumynCompat.runEncoderProbe()` + `runImuProbe(30000, true)` + `readDeviceCaps()` in sequence → assembles `CompatResult` → writes MMKV → routes pass → RigTutorial; fail → CompatFail.
7. RigTutorial → `Next` → `navigation.replace('MainTabs')` (Phase 4 will inject Practice between RigTutorial and MainTabs; Phase 2 stops at RigTutorial).
8. MainTabs renders Home (skeleton — full Home is Phase 6); avatar tap pushes Profile.
9. Profile reads `GET /me` + `GET /contributions` via `apiClient`; inline edits via `PATCH /me`. Help Center is a stack-pushed screen.
10. Help Center "Report a problem" form posts to `POST /feedback` with the `telemetry.ring.v1` snapshot.

### Initial route gate-decision tree (consumed by App.tsx)

```
forceUpgradeBlocked ?           → ForceUpgrade (hardBlock)
JWT missing or expired ?        → OnboardingStack.Splash (Splash → Signup → ...)
permsGranted false ?            → OnboardingStack.Permissions
compatSignature stale or fail ? → OnboardingStack.Compat
tutorialDone false ?            → OnboardingStack.RigTutorial
default                         → MainTabs.Home
```

The version-check happens in parallel with the 2.4 s Splash animation. If the response arrives before the animation finishes and `installedVersion < min_supported`, the splash transitions to ForceUpgrade instead of Sign-up. If the response is slow, the user sees Sign-up briefly and then ForceUpgrade modal-presents over it.

### Recommended Project Structure

```
apps/mobile/
├── package.json                       # npm-managed (post-02-01); file: link to ../../shared/types
├── package-lock.json                  # NEW (committed) — npm lockfile
├── App.tsx                            # REPLACED — NavigationContainer + RootStack
├── android/app/src/main/AndroidManifest.xml  # add CAMERA, RECORD_AUDIO, FOREGROUND_SERVICE_*, WAKE_LOCK
├── android/app/src/main/java/ai/humynlabs/capture/
│   ├── compat/
│   │   ├── HumynCompatModule.kt       # NEW — 3-method native module
│   │   ├── HumynCompatPackage.kt      # NEW — registers module
│   │   ├── EncoderProbe.kt            # NEW — NAL B-frame parse + OIS + HDR readback
│   │   ├── ImuProbe.kt                # NEW — 30 s sustained Hz + p99 jitter
│   │   ├── DeviceCaps.kt              # NEW — dFOV calc, mic, REALTIME, root, storage
│   │   └── NalParser.kt               # NEW — H.265 Annex B → slice_type extraction
│   ├── updater/                       # apkRollout-flavor source set may scope
│   │   ├── HumynUpdaterModule.kt      # NEW — APK download + SHA-256 + PackageInstaller
│   │   └── HumynUpdaterPackage.kt
│   └── MainApplication.kt             # add HumynCompatPackage + HumynUpdaterPackage to packages list
├── android/app/src/apkRollout/AndroidManifest.xml  # already has REQUEST_INSTALL_PACKAGES
├── assets/fonts/                      # NEW — RethinkSans-{Regular,Medium,SemiBold,Bold,ExtraBold}.ttf
├── react-native.config.js             # NEW (or update) — assets: ['./assets/fonts/']
├── scripts/
│   ├── build-help-content.mjs         # NEW — parse help-center-content.md → JSON
│   └── verify-merged-manifests.sh     # existing, keep
└── src/
    ├── ui/
    │   ├── tokens.ts                  # NEW — colors, typography, spacing, radii, motion
    │   ├── primitives/
    │   │   ├── Text.tsx
    │   │   ├── Button.tsx
    │   │   ├── Pressable.tsx
    │   │   ├── ScreenContainer.tsx
    │   │   ├── Sheet.tsx
    │   │   ├── Modal.tsx
    │   │   ├── Field.tsx
    │   │   └── Icon.tsx
    │   └── domain/                    # per-phase domain components
    │       ├── Accordion.tsx
    │       ├── ProgressRing.tsx       # 130×130 SVG ring (compat)
    │       └── Toast.tsx
    ├── state/
    │   ├── appStore.ts                # Zustand single store
    │   ├── hydrate.ts                 # Boot-time MMKV → store hydration
    │   └── keys.ts                    # MMKV key constants (versioned)
    ├── navigation/
    │   ├── RootStack.tsx              # RootNativeStack
    │   ├── OnboardingStack.tsx        # Splash → Signup → Permissions → Compat → RigTutorial
    │   ├── MainTabs.tsx               # Home / Tasks / History
    │   ├── linking.ts                 # humyn:// deep-link config
    │   └── initialRoute.ts            # Gate-decision tree
    ├── screens/
    │   ├── splash/SplashScreen.tsx
    │   ├── signup/
    │   │   ├── SignupScreen.tsx       # REPLACES SignIn.tsx (deleted)
    │   │   └── TermsOfUseModal.tsx
    │   ├── permissions/PermissionsScreen.tsx
    │   ├── compat/
    │   │   ├── CompatRunningScreen.tsx
    │   │   ├── CompatPassScreen.tsx   # ("You're in.")
    │   │   ├── CompatFailScreen.tsx   # COMPAT-06 (lists failedKeys)
    │   │   └── CompatRecoveryScreen.tsx  # COMPAT-08 ("what now")
    │   ├── tutorial/RigTutorialScreen.tsx
    │   ├── home/HomeSkeleton.tsx      # Phase 2 ships only the bottom-nav-anchored shell + soft-banner
    │   ├── tasks/TasksPlaceholder.tsx # Phase 6 fills in
    │   ├── history/HistoryPlaceholder.tsx # Phase 6 fills in
    │   ├── profile/
    │   │   ├── ProfileScreen.tsx
    │   │   ├── DeleteAccountModal.tsx
    │   │   └── LogoutModal.tsx
    │   ├── help/
    │   │   ├── HelpCenterScreen.tsx
    │   │   ├── ReportProblemSheet.tsx
    │   │   └── content.json           # generated by scripts/build-help-content.mjs
    │   └── force-upgrade/ForceUpgradeScreen.tsx
    ├── services/
    │   ├── auth.ts                    # existing — extend with `signOut()`
    │   ├── api.ts                     # existing — extend with GET/PATCH/DELETE + multipart
    │   ├── compatService.ts           # NEW — wraps HumynCompat + assembles CompatResult
    │   ├── versionService.ts          # NEW — /app/version + cache + force-upgrade decision
    │   ├── feedbackService.ts         # NEW — POST /feedback + diagnostic snapshot assembly
    │   ├── installationId.ts          # NEW — UUID minting + persistence
    │   └── telemetryRing.ts           # NEW — FIFO 100-entry ring buffer
    ├── native/
    │   ├── AppFlavor.ts               # existing — extend to expose versionName/versionCode
    │   ├── PlayIntegrity.ts           # existing
    │   ├── HumynCompat.ts             # NEW — typed surface for the Kotlin module
    │   └── HumynUpdater.ts            # NEW — apkRollout-only typed surface
    ├── util/
    │   ├── durationFormatter.ts       # NEW — HOME-06 formatter (Phase 6 reuses)
    │   ├── semver.ts                  # NEW — tiny M.m.p comparator
    │   └── analytics.ts               # NEW — wraps @react-native-firebase/analytics + writes ring
    └── types/
        └── react-native.d.ts          # existing (was deleted in plan 01-13; do not re-add)

shared/types/src/
└── CompatResult.ts                    # NEW — Zod schema for the compat result wire shape
```

### Pattern 1: Zustand store hydrated from MMKV at boot

**What:** A single Zustand store at `src/state/appStore.ts` whose initial state is computed from MMKV reads in `src/state/hydrate.ts` BEFORE the navigator mounts. `App.tsx` calls `hydrate()` synchronously (MMKV is sync), then passes the resulting initial state to `useAppStore.setState(initial)` before render.

**When to use:** Bootstrap state + navigator initial route. Phase 6 will reuse for tile filters and contribution cache.

**Example:**

```typescript
// src/state/appStore.ts
import { create } from 'zustand';
import type { CompatResult } from '@humyn/shared-types';

interface AppState {
  jwt: string | null;
  consentAcceptedAt: string | null;
  permsGranted: { camera: boolean; mic: boolean } | null;
  compatPassed: { signature: string; runAt: string } | null;
  tutorialDone: boolean;
  compatLastResult: CompatResult | null;
  installationId: string;
  appVersionCache: { response: AppVersionResponse; fetchedAt: number } | null;
  softUpgradeAvailable: { latest: string } | null;
  // actions:
  setCompatResult(r: CompatResult): void;
  signOut(): void;
}
export const useAppStore = create<AppState>((set) => ({
  // ... initial state set in hydrate(), not here
  jwt: null,
  // ...
  setCompatResult: (r) => {
    secureMmkv.set('compat.lastResult.v1', JSON.stringify(r));
    set({
      compatLastResult: r,
      compatPassed: r.passed ? { signature: r.signature, runAt: r.runAt } : null,
    });
  },
  signOut: () => {
    clearStoredJwt();
    set({ jwt: null });
  },
}));
```

### Pattern 2: Kotlin TurboModule with structured Promise resolution

**What:** Phase 1 established the TurboModule shape — a Kotlin class extending `ReactContextBaseJavaModule`, methods annotated `@ReactMethod` taking a `Promise`, registered via a `ReactPackage` in `MainApplication.kt`. JS-side surface is a typed `interface` over `NativeModules.{Name}`.

**When to use:** Every native capability — `HumynCompat`, `HumynUpdater`. Mirrors the existing `AppFlavor` and `PlayIntegrity` modules.

**Example:**

```kotlin
// apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/HumynCompatModule.kt
class HumynCompatModule(reactCtx: ReactApplicationContext) : ReactContextBaseJavaModule(reactCtx) {
  override fun getName() = "HumynCompat"

  @ReactMethod
  fun runImuProbe(durationMs: Double, withPreview: Boolean, promise: Promise) {
    backgroundExecutor.execute {
      try {
        val result = ImuProbe(reactApplicationContext).run(durationMs.toLong(), withPreview)
        promise.resolve(Arguments.makeNativeMap(mapOf(
          "sustainedHz" to result.sustainedHz,
          "p99IntervalMs" to result.p99IntervalMs,
          "samplesCollected" to result.samplesCollected
        )))
      } catch (t: Throwable) {
        promise.reject("IMU_PROBE_ERROR", t)
      }
    }
  }
}
```

```typescript
// src/native/HumynCompat.ts
interface HumynCompatNativeModule {
  runEncoderProbe(): Promise<{
    bFramePresent: boolean;
    oisOff: boolean;
    hdrSdrForced: boolean;
    encoderClipPath: string;
  }>;
  runImuProbe(
    durationMs: number,
    withPreview: boolean,
  ): Promise<{ sustainedHz: number; p99IntervalMs: number; samplesCollected: number }>;
  readDeviceCaps(): Promise<{
    resolutionMax: { w: number; h: number };
    fpsMax: number;
    ultrawideDfovDeg: number;
    micSampleRateMax: number;
    realtimeTimestampSource: boolean;
    rooted: boolean;
    freeStorageGB: number;
  }>;
}
const native = NativeModules.HumynCompat as HumynCompatNativeModule | undefined;
```

### Pattern 3: Per-flavor manifest scoping

**What:** Permissions Play Store rejects (REQUEST_INSTALL_PACKAGES) live in `android/app/src/apkRollout/AndroidManifest.xml`, not the base manifest. Phase 1 already set this up; Phase 2 inherits unchanged.

**When to use:** Any apkRollout-only capability. The HumynUpdater module's `PackageInstaller.Session` launch is gated on this permission, so the module itself can ship in the base source set, but at runtime it'll throw `SecurityException` on the playStore flavor — defensively guard with `getFlavorContext().flavor === 'apkRollout'` before calling.

### Pattern 4: Build-time content baking

**What:** `apps/mobile/scripts/build-help-content.mjs` parses `help-center-content.md` with `marked` (or hand-rolled regex), emits `src/screens/help/content.json`. Run as `prebuild` script in `package.json` so the JSON cannot fall out of sync with the markdown source.

**When to use:** Static content sourced verbatim from spec assets. Phase 2 also uses this for the verbatim Terms-of-Use copy from idea-brief.md §5.2 — bake it once into a `terms.ts` constant rather than re-typing.

**Example:**

```javascript
// apps/mobile/scripts/build-help-content.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const md = readFileSync('../../help-center-content.md', 'utf8');
// Parse the 3 H2 sections (Instructions Guide, FAQs, Troubleshooting)
// Emit { sections: [{ title, body: markdown-string }, ...] }
const tokens = marked.lexer(md);
// ... extraction logic ...
writeFileSync('src/screens/help/content.json', JSON.stringify(out, null, 2));
```

### Anti-Patterns to Avoid

- **Don't put compat-probe logic on the JS thread.** The 30 s IMU probe must run in a Kotlin background thread; the encoder probe writes ~5 MB to disk and walks the bitstream — both block the UI if dispatched from JS. JS calls `runImuProbe()` and awaits; Kotlin owns the worker.
- **Don't sha256 a 30 MB APK on the JS thread.** Hashing in JS via `react-native-quick-crypto` or `crypto-browserify` is feasible but stalls the UI. Stream-and-hash in Kotlin during download (use `MessageDigest.getInstance("SHA-256")`).
- **Don't dispatch navigator transitions from inside MMKV write callbacks.** MMKV is synchronous; writes succeed before render. Update Zustand state, then transition.
- **Don't introspect React Navigation's internals to suppress the bottom tab bar.** Suppression is structural — tabs only exist inside `MainTabs`. Routes outside MainTabs (Onboarding, Recording, Player, ForceUpgrade) automatically have no tab bar. Don't try to conditionally hide the tab bar from inside `tabBarStyle` callbacks; that path leads to flicker bugs.
- **Don't issue `GET /app/version` from every screen.** Splash issues it once with the 6 h MMKV cache. Background→foreground re-checks expire-time, not always-refetches.
- **Don't bake the Web Client ID at build time only.** It's already wired via `react-native-config` in `apps/mobile/.env.{flavor}`. Phase 2's Sign-up screen reuses that path verbatim.
- **Don't use `expo-*` modules.** Stack is bare RN; mixing in expo modules drags in the expo runtime.
- **Don't add `dangerouslySetInnerHTML`-style markdown rendering for Help Center.** Build-time parse to plain text + structure; render with native primitives. Markdown-on-the-fly bloats bundle and risks XSS surface.

## Don't Hand-Roll

| Problem                                                        | Don't build                                                    | Use Instead                                                                                                                          | Why                                                                                                                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission prompts (Camera, Mic) + denied recovery             | Direct `PermissionsAndroid` calls + manual settings deep-link  | `react-native-permissions` v5+ with `request()` + `openSettings()`                                                                   | Library normalizes Android 13+ "denied vs permanently denied" semantics; STACK.md acceptable per CONTEXT.md discretion                                                    |
| Bottom-tab + native-stack navigation                           | Hand-rolled stack with React state                             | `@react-navigation/native` v7 + `native-stack` + `bottom-tabs`                                                                       | LOCKED in CONTEXT.md D-NAV-01                                                                                                                                             |
| Persistent KV store (auth + onboarding flags + telemetry ring) | AsyncStorage / file-system / Realm                             | `react-native-mmkv` 4.3.1 (already wired)                                                                                            | LOCKED; encrypted; sync API                                                                                                                                               |
| State management                                               | Redux + redux-persist + redux-toolkit                          | `zustand` 5.x                                                                                                                        | LOCKED in CONTEXT.md D-STATE-02                                                                                                                                           |
| Google Sign-In                                                 | OAuth2 + custom WebView                                        | `@react-native-google-signin/google-signin` 16.1.2                                                                                   | LOCKED                                                                                                                                                                    |
| Play Integrity attestation                                     | Custom signing + certificate-pinning                           | Google's `IntegrityManager` SDK + Standard requests                                                                                  | LOCKED; already wired in Phase 1                                                                                                                                          |
| H.265 Annex B NAL parsing                                      | Pull a 50 KB parser library + bring its license review through | Hand-rolled (~80 LOC) walks start codes + reads `nal_unit_type` from header byte 1 + parses `slice_type` from `slice_segment_header` | The minimal version we need is small; references: `figgis/fd509a02d4b1aa89f6ef` gist + Eyevinn `mp4ff/hevc` Go package as cross-check. Pulling a library here adds bloat. |
| Semver comparison (`installedVersion < min_supported`)         | Full `semver` package                                          | Hand-rolled `compareSemver(a, b)` (~10 LOC, splits on `.`, compares ints)                                                            | CONTEXT.md discretion; constrained `M.m.p` shape                                                                                                                          |
| MD parsing for help-center build script                        | A heavy MDX pipeline                                           | `marked` lexer + structure-extraction                                                                                                | Default; CONTEXT.md discretion                                                                                                                                            |
| TTS for "Recording started"                                    | (Out of Phase 2)                                               | (Phase 4 territory: `react-native-tts` 4.1.1 per STACK.md)                                                                           | Phase 2 doesn't speak                                                                                                                                                     |
| APK download + chunk-resume                                    | Background-fetch infrastructure                                | Single fetch + `MessageDigest` streaming digest in Kotlin (apkRollout flavor)                                                        | Phase 2's APK is single-shot at force-upgrade time; no resume logic needed                                                                                                |
| Confetti animation (Practice-complete)                         | (Out of Phase 2)                                               | (Phase 4 territory)                                                                                                                  | —                                                                                                                                                                         |
| Toast                                                          | A library (`react-native-toast-message`)                       | Hand-rolled via the `Sheet` primitive                                                                                                | CONTEXT.md discretion default                                                                                                                                             |

**Key insight:** The HumynCompat NAL parser is the one place where "build it ourselves vs use a library" tilts toward build-it-ourselves: we only need to extract `slice_type` to detect B-frames in a 5-second clip. A 30-line Kotlin function suffices and we own the sharp edges. For everything else (permissions, navigation, state, MMKV, Google Sign-In, Play Integrity), use the locked libraries.

## Common Pitfalls

### Pitfall 1: KEY_LATENCY=1 doesn't reliably suppress B-frames on every encoder

**What goes wrong:** A 5-second probe encode passes the encoder-config check (config sets `KEY_LATENCY=1` + `KEY_MAX_B_FRAMES=0`) but the bitstream actually contains B-slices on a Mediatek Helio or low-end Spreadtrum chipset. Compat-check passes; Phase 3 capture pipeline ships B-frames; training data fails QA.
**Why it happens:** OEM encoder drivers honor the keys inconsistently — some respect MAX_B_FRAMES, some respect KEY_LATENCY, some respect neither and silently insert B-frames. STACK.md flags this explicitly.
**How to avoid:** The compat probe MUST do a NAL-level parse on the encoded bytes, not just trust the encoder config. `EncoderProbe.kt` walks the Annex B bitstream and reads `slice_type` from the slice_segment_header. If ANY slice has `slice_type == 1` (B-slice in HEVC), `bFramePresent: true`.
**Warning signs:** Compat-pass on a non-Pixel device + later QA-rejection of the same device's recordings for B-frame content.

### Pitfall 2: OIS-OFF readback assumes the OEM honors the request

**What goes wrong:** `CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE = OFF` is set, but `TotalCaptureResult.LENS_OPTICAL_STABILIZATION_MODE` reads back as ON or UNKNOWN on Samsung Exynos S22 / some MIUI builds. Capture metadata claims OIS is off; physical sensor still stabilizes; IMU↔video alignment drifts because OIS shifts the optical center between frames.
**Why it happens:** Some OEMs treat the request as "permission to disable" rather than "command to disable" and override based on scene/lighting heuristics.
**How to avoid:** `EncoderProbe.kt` MUST read back `result.get(CaptureResult.LENS_OPTICAL_STABILIZATION_MODE)` from a TotalCaptureResult after the probe encode and assert it equals `LENS_OPTICAL_STABILIZATION_MODE_OFF`. If `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` doesn't include OFF as a supported mode, this branch is moot; pass.
**Warning signs:** Compat passes but Phase 3 IMU↔video drift figures spike on specific OEM/model combinations.

### Pitfall 3: HDR DynamicRangeProfile defaults vary across Android versions

**What goes wrong:** The compat probe sets `OutputConfiguration.setDynamicRangeProfile(DynamicRangeProfiles.STANDARD)`, but on Android 12 (API 31) the Profile API doesn't exist (added API 33). Probe crashes; compat false-fails on perfectly-fine Android 12 devices.
**Why it happens:** `DynamicRangeProfiles` was added in Android 13 (API 33). minSdk is 26 in this project, so devices on Android 8-12 (API 26-32) don't have the API.
**How to avoid:** Wrap the call in `Build.VERSION.SDK_INT >= 33`. On older devices, HDR isn't a concern (the API to ask for HDR doesn't exist either, so the device can't accidentally produce it). Set `hdrSdrForced: true` automatically for `SDK_INT < 33`.
**Warning signs:** Compat-fail on API 31/32 devices for `hdrSdrForced: false` when the device is incapable of HDR in the first place. [CITED: developer.android.com/media/camera/camera2/hdr-video-capture]

### Pitfall 4: SensorManager `SENSOR_DELAY_FASTEST` doesn't sustain ≥100 Hz under load

**What goes wrong:** A short idle sample reports 200 Hz from the gyro; the 30-second probe with a Camera2 preview running drops sustained rate to 60 Hz on a low-end phone because the SoC is sharing cycles with the camera ISP.
**Why it happens:** The stated maximum sample rate is the ceiling, not the floor. Background camera/ISP work and thermal throttling reduce actual delivery.
**How to avoid:** **The COMPAT-02 / D-COMPAT-02 design mandates 30 s sustained probing with the preview running.** Compute `sustainedHz = samplesCollected / (probeDurationMs/1000)`. Compute `p99IntervalMs` over inter-sample diffs. Reject if either threshold fails. Use `setTimestampSource` not implicitly available; instead set `maxReportLatency=0` (no batching) so the OS delivers samples promptly. NOTE: there is no `SensorManager.setTimestampSource` API on Android; the IMU clock domain is determined by the sensor type and HAL. Use `SystemClock.elapsedRealtimeNanos()` as the reference clock and trust the IMU sample's `event.timestamp` (in `SystemClock.elapsedRealtimeNanos` domain after Android 4.4+ HAL revisions). [CITED: SensorManager API reference]
**Warning signs:** Devices that pass a 1-second compat probe but fail under sustained load. The 30-second window catches them; the brief-sample anti-pattern doesn't.

### Pitfall 5: dFOV computation requires the right per-camera characteristics

**What goes wrong:** Computing dFOV from `LENS_INFO_AVAILABLE_FOCAL_LENGTHS[0]` and `SENSOR_INFO_PHYSICAL_SIZE` for the **default** camera produces ~70° on a Pixel 7a — which fails the ≥110° check, even though the Pixel 7a has an ultrawide capable of ≥110°.
**Why it happens:** The default rear camera is the main lens, not the ultrawide. The compat probe MUST iterate `cameraManager.cameraIdList`, find the camera that's `CameraCharacteristics.LENS_FACING == BACK` and has the SHORTEST focal length (the ultrawide), and compute dFOV from that camera's characteristics.
**How to avoid:** `DeviceCaps.kt` enumerates all back-facing cameras, picks the one with the smallest `LENS_INFO_AVAILABLE_FOCAL_LENGTHS[0]`, then computes:

```kotlin
val w = sensorPhysicalSize.width
val h = sensorPhysicalSize.height
val diag = sqrt(w*w + h*h)
val dFov = Math.toDegrees(2 * atan2(diag.toDouble(), 2 * focalLength.toDouble())).toFloat()
```

Then `ultrawideDfovDeg = max(dFov_per_back_camera)`. Reject `< 110°`. [CITED: developer.android.com/reference/android/hardware/camera2/CameraCharacteristics + diagonal FOV formula `2*atan(sensor_dim / (2*focal_length))`]
**Warning signs:** All ultrawide-equipped Pixels fail compat — almost always a wrong-camera-picked bug.

### Pitfall 6: Play Integrity Standard request rate-limits and quota

**What goes wrong:** Compat re-runs after every OS update fire the integrity request hundreds of times per device per year; quota is exceeded; sign-in fails with no actionable error.
**Why it happens:** Standard Integrity has high quota (warm-pool of pre-prepared tokens); the per-app quota is generous but not infinite. We're not under quota pressure for sign-in (one call per sign-in) but we should NOT call Play Integrity from the compat probe.
**How to avoid:** **Phase 2's `HumynCompat.readDeviceCaps()` must NOT call Play Integrity.** The "rooted" verdict comes from a heuristic (e.g., the `RootBeer` library or a tiny manual check for `su` binary in known paths) — NOT a Play Integrity round-trip. Play Integrity remains on the sign-in path (Phase 1) only. For compat, we use a lightweight rooted-detection that surfaces an `unverified` verdict if the device looks rooted; the authoritative gate is the sign-in Play Integrity check. [CITED: developer.android.com/google/play/integrity/standard]

**Note on rooted detection:** Maintained options as of 2026:

- `RootBeer` library (Java, Maven, Apache 2): checks `/system/app/Superuser.apk`, `/system/xbin/su`, `test-keys` build tag, busybox, etc. Lightweight; ~30 KB. Heuristic only.
- Hand-rolled (~50 LOC): checks the same paths inline. Acceptable; one less dep.
- Play Integrity verdict from sign-in: backend stores it; client can read `recordings/me/whatever` response. Authoritative but not available pre-sign-in.

Recommendation: Use the manual heuristic for client-side compat (RootBeer-equivalent) — surface as `compat.checks.root.verdict` (a string). The sign-in Play Integrity is the actual gate.

### Pitfall 7: APK download SHA-256 mismatch on slow CDN propagation

**What goes wrong:** After a release, `/app/version` returns the new `apk_sha256` immediately, but the CloudFront edge serving `apk_url` still has the old APK cached for ~5 minutes. Force-upgrade flow downloads the old APK; SHA mismatches; the user is told the update failed.
**Why it happens:** Cache-invalidation lag between the version manifest update (DB write) and the CDN object update.
**How to avoid:** D-UPG-02 already specifies emit-on-mismatch telemetry. Plan-checker should ensure the failure is non-blocking — user can retry. Backend release pipeline should publish APK to S3 with cache-bust query param, OR atomically swap to a new versioned URL like `humyn-labs-capture-v0.1.1.apk` (already the pattern in `seedAppVersions`). Recommend: planner verifies the release pipeline uses versioned filenames (it does — `humyn-labs-capture-v${VERSION}.apk`).
**Warning signs:** Spike in `force_upgrade_apk_hash_mismatch` events immediately after each release.

### Pitfall 8: `PackageInstaller` requires the calling app to be the `installer` of the target package

**What goes wrong:** apkRollout-flavor app (`ai.humynlabs.capture.apk`) tries to install an APK; on Android 13+ the install fails silently or with `STATUS_FAILURE_BLOCKED` because the user hasn't granted "Install unknown apps" for our app.
**Why it happens:** Even with `REQUEST_INSTALL_PACKAGES` declared (a normal permission, not requested at runtime), Android 8+ requires per-app user consent via `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`.
**How to avoid:** Before launching `PackageInstaller.Session`, check `packageManager.canRequestPackageInstalls()`. If false, launch `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` with a `data: Uri.parse("package:" + applicationId)` URI to deep-link the user directly to the toggle for our app. After they return, re-check; if true, launch installer. [CITED: developer.android.com/reference/android/content/pm/PackageInstaller.Session]
**Warning signs:** Silent install failures on apkRollout flavor; users stuck on force-upgrade screen.

### Pitfall 9: GMS-less (Huawei) devices can't sign in

**What goes wrong:** A target user has a Huawei device with no Google Play Services. Sign-in fails with `developer_error` from `GoogleSignin.hasPlayServices`, which the user reads as "the app is broken."
**Why it happens:** `@react-native-google-signin/google-signin` 16.x uses Credential Manager which depends on GMS. India + Brazil markets are predominantly GMS-equipped (Huawei post-2019 is rare in both), but it's not zero.
**How to avoid:** Pre-check `GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })` (already done in Phase 1's `signInWithGoogle()`). On `play_services_not_available`, the Sign-up screen MUST surface an explicit "Sign-in requires Google Play Services" error with a link to the Help Center. Don't just throw the raw error string. [CITED: github.com/react-native-google-signin/google-signin]
**Warning signs:** Crashlytics `signup_google_failed { reason: 'play_services_not_available' }` clustered on `Build.MANUFACTURER == HUAWEI`.

### Pitfall 10: Hermes new-arch + native module promise rejection wraps the Java exception type

**What goes wrong:** `HumynCompat.runImuProbe()` rejects with `Error: IMU_PROBE_ERROR`, but the Java/Kotlin stack trace and meaningful failure cause are lost on the JS side.
**Why it happens:** RN 0.83's Hermes new-arch promise bridge passes only `code` + `message` from `Promise.reject(code, throwable)`. The Throwable's stack and message are NOT serialized into the JS Error object.
**How to avoid:** Always emit a structured failure shape: `Promise.reject(code, message, throwable)` includes the message; wrap message with the Kotlin exception's class + message: `promise.reject("IMU_PROBE_ERROR", "${t::class.simpleName}: ${t.message}", t)`. JS side: the `Error.message` will contain the wrapped string. Plus: in dev builds, Logcat shows the full stack via the third arg.
**Warning signs:** "IMU_PROBE_ERROR" Crashlytics issues with no stack to debug.

## Runtime State Inventory

> Phase 2 is greenfield mobile-shell scaffolding — no rename / refactor / migration. Section omitted per template guidance.

## Code Examples

Verified patterns from Phase 1 + locked references.

### Compat NAL B-frame parse (Kotlin, hand-rolled)

```kotlin
// apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/NalParser.kt
// HEVC NAL unit type 0..31 are VCL. nal_unit_type for a B-slice has slice_type=1
// inside the slice_segment_header. We walk the Annex B bitstream looking for
// 0x000001 / 0x00000001 start codes, read the 2-byte NAL header, and only parse
// the slice header when nal_unit_type indicates a coded slice (TRAIL_N=0..RSV_VCL31=31
// excluding non-VCL ranges).
//
// References:
//   - figgis/fd509a02d4b1aa89f6ef (HEVC bitstream parser gist)
//   - chemag/h265nal (C++ reference)
//   - Eyevinn/mp4ff/hevc (Go reference; ParseSliceHeader)
class NalParser {
    data class SliceInfo(val nalUnitType: Int, val sliceType: Int)

    fun parse(bytes: ByteArray): List<SliceInfo> {
        val out = mutableListOf<SliceInfo>()
        var i = 0
        while (i < bytes.size - 4) {
            // Find next start code (0x000001 or 0x00000001)
            val startLen = matchStartCode(bytes, i)
            if (startLen == 0) { i++; continue }
            val nalStart = i + startLen
            if (nalStart + 2 >= bytes.size) break
            // HEVC NAL header is 2 bytes; nal_unit_type = (header[0] >> 1) & 0x3F
            val nalUnitType = (bytes[nalStart].toInt() shr 1) and 0x3F
            // VCL (coded slice) NAL types are 0..31
            if (nalUnitType in 0..31) {
                // first_slice_segment_in_pic_flag (1 bit) + slice_segment_header parsing.
                // slice_type is extracted via Exp-Golomb decoding of the third field.
                // Implementation: read bits past the NAL header (skip 2 bytes), then
                // call BitReader to read first_slice_segment_in_pic_flag (u(1)),
                // skip if not first slice ... For B-frame detection we only need
                // slice_type ∈ {0,1,2} where 1=B, 0=P, 2=I (HEVC slice_type ordering).
                // Full impl ~80 LOC; skipping here for brevity.
                val sliceType = readSliceType(bytes, nalStart + 2)
                out.add(SliceInfo(nalUnitType, sliceType))
            }
            i = nalStart + 2
        }
        return out
    }
    // Detect B-frame: any slice with sliceType == 1 (HEVC convention)
    fun anyBFrames(slices: List<SliceInfo>) = slices.any { it.sliceType == 1 }
    // ...
}
```

[CITED: github.com/chemag/h265nal + figgis/fd509a02d4b1aa89f6ef]

### dFOV computation for ultrawide camera (Kotlin)

```kotlin
// apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
fun computeUltrawideDfov(ctx: Context): Float {
    val mgr = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    var maxDfov = 0f
    for (id in mgr.cameraIdList) {
        val c = mgr.getCameraCharacteristics(id)
        if (c.get(CameraCharacteristics.LENS_FACING) != CameraCharacteristics.LENS_FACING_BACK) continue
        val focals = c.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: continue
        val sensor = c.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: continue
        // Ultrawide = shortest focal length on this back camera
        val focal = focals.min() ?: continue
        val w = sensor.width
        val h = sensor.height
        val diag = Math.sqrt((w * w + h * h).toDouble()).toFloat()
        val dFov = Math.toDegrees(2.0 * Math.atan2(diag.toDouble(), 2.0 * focal.toDouble())).toFloat()
        if (dFov > maxDfov) maxDfov = dFov
    }
    return maxDfov
}
```

[CITED: developer.android.com/reference/android/hardware/camera2/CameraCharacteristics; FOV formula `2*atan(d/(2f))`]

### IMU sustained-rate probe (Kotlin)

```kotlin
// apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/ImuProbe.kt
class ImuProbe(private val ctx: Context) {
    data class Result(val sustainedHz: Float, val p99IntervalMs: Float, val samplesCollected: Int)

    fun run(durationMs: Long, withPreview: Boolean): Result {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val gyro = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE) ?: throw IllegalStateException("no_gyro")
        val timestamps = mutableListOf<Long>()
        val latch = CountDownLatch(1)
        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) { timestamps.add(e.timestamp) }
            override fun onAccuracyChanged(s: Sensor, a: Int) {}
        }
        // SENSOR_DELAY_FASTEST (= 0 µs) requests max rate; maxReportLatency=0 disables batching
        sm.registerListener(listener, gyro, SensorManager.SENSOR_DELAY_FASTEST, 0)
        // (If withPreview): start a 1080p Camera2 preview on a dummy SurfaceTexture; release at end.
        Handler(Looper.getMainLooper()).postDelayed({ latch.countDown() }, durationMs)
        latch.await()
        sm.unregisterListener(listener)
        // Compute sustainedHz over the last 25s (skip first 5s warm-up)
        val warmupNs = 5_000_000_000L
        val first = timestamps.firstOrNull() ?: throw IllegalStateException("no_samples")
        val sustained = timestamps.filter { it - first > warmupNs }
        val durSec = (sustained.last() - sustained.first()) / 1_000_000_000.0
        val sustainedHz = (sustained.size / durSec).toFloat()
        // p99 of inter-sample interval
        val intervalsMs = sustained.zipWithNext { a, b -> (b - a) / 1_000_000.0 }
        val p99Ms = intervalsMs.sorted()[(intervalsMs.size * 99 / 100).coerceAtMost(intervalsMs.size - 1)].toFloat()
        return Result(sustainedHz, p99Ms, timestamps.size)
    }
}
```

[CITED: developer.android.com/reference/android/hardware/SensorManager; SENSOR_DELAY_FASTEST = 0 µs]

### React Navigation v7 root-stack setup (TypeScript)

```typescript
// apps/mobile/src/navigation/RootStack.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore } from '../state/appStore';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';
import ForceUpgradeScreen from '../screens/force-upgrade/ForceUpgradeScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import HelpCenterScreen from '../screens/help/HelpCenterScreen';

const Root = createNativeStackNavigator();

export default function RootStack() {
  const initialRoute = useAppStore((s) => computeInitialRoute(s));
  return (
    <Root.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Root.Screen name="Onboarding" component={OnboardingStack} />
      <Root.Screen name="MainTabs" component={MainTabs} />
      <Root.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
      <Root.Screen name="HelpCenter" component={HelpCenterScreen} options={{ headerShown: true, title: 'Help Center' }} />
      <Root.Screen name="ForceUpgrade" component={ForceUpgradeScreen} options={{ presentation: 'modal' }} />
      {/* Recording (Phase 4) and Player (Phase 6) slot in here as later siblings */}
    </Root.Navigator>
  );
}
```

[CITED: reactnavigation.org/docs/native-stack-navigator]

### Force-upgrade APK download + SHA-256 verify (Kotlin)

```kotlin
// apps/mobile/android/app/src/main/java/ai/humynlabs/capture/updater/HumynUpdaterModule.kt
@ReactMethod
fun downloadAndVerifyApk(url: String, expectedSha256: String, promise: Promise) {
    bgExecutor.execute {
        try {
            val cacheFile = File(reactApplicationContext.cacheDir, "update-${System.currentTimeMillis()}.apk")
            val md = MessageDigest.getInstance("SHA-256")
            val conn = (URL(url).openConnection() as HttpURLConnection).apply { connectTimeout = 30_000; readTimeout = 60_000 }
            conn.inputStream.use { input ->
                FileOutputStream(cacheFile).use { out ->
                    val buf = ByteArray(64 * 1024)
                    var n = input.read(buf)
                    while (n != -1) {
                        md.update(buf, 0, n)
                        out.write(buf, 0, n)
                        n = input.read(buf)
                    }
                }
            }
            val actualHex = md.digest().joinToString("") { "%02x".format(it) }
            if (actualHex != expectedSha256) {
                cacheFile.delete()
                promise.reject("HASH_MISMATCH", "expected=$expectedSha256 actual=$actualHex size=${cacheFile.length()}")
                return@execute
            }
            promise.resolve(Arguments.makeNativeMap(mapOf("path" to cacheFile.absolutePath, "sha256" to actualHex)))
        } catch (t: Throwable) {
            promise.reject("DOWNLOAD_FAILED", "${t::class.simpleName}: ${t.message}", t)
        }
    }
}

@ReactMethod
fun launchInstaller(apkPath: String, promise: Promise) {
    val pkg = reactApplicationContext.packageManager
    if (!pkg.canRequestPackageInstalls()) {
        // Deep-link to the per-app "Install unknown apps" toggle
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + reactApplicationContext.packageName))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
        promise.reject("INSTALL_NOT_ALLOWED", "user must enable install-unknown-apps for this app")
        return
    }
    val installer = pkg.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    val sessionId = installer.createSession(params)
    installer.openSession(sessionId).use { session ->
        FileInputStream(apkPath).use { input ->
            session.openWrite("base.apk", 0, input.available().toLong()).use { out ->
                input.copyTo(out)
                session.fsync(out)
            }
        }
        val pi = PendingIntent.getBroadcast(reactApplicationContext, 0,
            Intent("ai.humynlabs.capture.INSTALL_COMPLETE"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
        session.commit(pi.intentSender)
    }
    promise.resolve(true)
}
```

[CITED: developer.android.com/reference/android/content/pm/PackageInstaller.Session + Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES]

### Diagnostic snapshot for `POST /feedback` (TypeScript)

```typescript
// apps/mobile/src/services/feedbackService.ts
import { telemetryRing } from './telemetryRing';
import { getFlavorContext } from '../native/AppFlavor';
import { Platform } from 'react-native';
import { Buffer } from 'buffer'; // already polyfilled by RN

export async function submitFeedback(
  category: FeedbackCategory,
  message: string,
): Promise<FeedbackResponse> {
  const { flavor, applicationId } = getFlavorContext();
  const diagnostic = {
    appVersion: NativeModules.AppFlavor.versionName, // extend AppFlavor for this
    buildIdentifier: NativeModules.AppFlavor.versionCode,
    flavor,
    applicationId,
    osVersion: Platform.Version,
    deviceModel: NativeModules.AppFlavor.deviceModel,
    telemetryRing: telemetryRing.snapshot(), // last 100 events
  };
  const form = new FormData();
  form.append('category', category);
  form.append('message', message);
  form.append('diagnostic', {
    uri: `data:application/json;base64,${Buffer.from(JSON.stringify(diagnostic)).toString('base64')}`,
    type: 'application/json',
    name: 'diagnostic.json',
  } as any);
  // POST /feedback (Phase 1 API-12 — multipart/form-data)
  // ... fetch implementation
}
```

[CITED: shared/types/src/feedback.ts (Phase 1 wire shape)]

## State of the Art

| Old approach                             | Current approach                                             | When changed                                                    | Impact                                             |
| ---------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------- |
| Google Sign-In legacy SDK (one-tap-less) | Credential Manager API                                       | Android 14+ requires Credential Manager (RN-google-signin v13+) | Already adopted in Phase 1; no Phase 2 work needed |
| SafetyNet attestation                    | Play Integrity Standard                                      | SafetyNet shut down end of 2024                                 | Already adopted in Phase 1                         |
| `PermissionsAndroid` direct              | `react-native-permissions` (unified API)                     | RN 0.71+ ecosystem default                                      | Adopt in Phase 2                                   |
| AsyncStorage                             | MMKV                                                         | RN 0.70+ ecosystem default                                      | Already adopted; auth.ts uses it                   |
| React Navigation v6 (JS-stack)           | React Navigation v7 (native-stack default)                   | Nov 2024                                                        | Adopt in Phase 2                                   |
| Redux + persist                          | Zustand + MMKV                                               | 2023+ ecosystem trend                                           | Adopt in Phase 2                                   |
| `react-native-webview` for Terms-of-Use  | Modal with verbatim baked text                               | Always preferable for static legal text                         | Adopt in Phase 2                                   |
| HDR-blind Camera2 (assume SDR)           | Explicit `DynamicRangeProfile.STANDARD` force on Android 13+ | Android 13 added the API                                        | Adopt in compat probe                              |

**Deprecated/outdated:**

- **`react-native-camera`** (the old one) — archived; never use. STACK.md flags.
- **MediaPipeTasksVision pod 0.10.33+** on iOS — known XCFramework issue. STACK.md pins 0.10.21 both sides. Phase 2 doesn't touch this; flagged for Phase 4.
- **VisionCamera V5** — too new; V4 is the locked target. STACK.md.
- **AsyncStorage** for auth — slow + plaintext. Already replaced.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                | Section                  | Risk if wrong                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `@react-navigation/native` v7.2.2 + `react-native-screens` v4.x is the current RN 0.83 + new-arch stable pair as of 2026-05-08                                                                       | Standard Stack           | If a 7.3 lands with a Phase 2-incompatible breaking change, planner pins to 7.2.x. Risk: low; v7 is stable. [CITED: reactnavigation.org]                                                                                                      |
| A2  | `react-native-permissions` v5.x supports RN 0.83 + new-arch                                                                                                                                          | Standard Stack           | If incompatible, fall back to `PermissionsAndroid` direct API (10 LOC); risk: low [CITED: github.com/zoontek/react-native-permissions]                                                                                                        |
| A3  | `zustand` v5.x is the current stable; persist middleware path is supported but Phase 2 uses manual MMKV→hydrate (not Zustand persist)                                                                | Standard Stack           | None — Phase 2 doesn't depend on the persist middleware [VERIFIED: pmndrs/zustand npm registry]                                                                                                                                               |
| A4  | `RootBeer`-equivalent rooted detection is an acceptable client-side heuristic for COMPAT-01 root check; the authoritative root verdict is still backend-side via Play Integrity at sign-in           | Compat probe / Pitfall 6 | Could miss new root-cloaking techniques. Acceptable risk: backend Play Integrity is the binding gate.                                                                                                                                         |
| A5  | The 30-second IMU sustained probe correctly captures the sub-100-Hz devices that pass an instantaneous probe; specifically, throttled SoCs under camera-preview load drop sustained rate within 30 s | Pitfall 4                | If 30 s is too short, the probe misses devices that throttle at 5+ minutes. Acceptable for Phase 2; Phase 3 capture pipeline runtime check (`imu_min_rate_hz_observed_p1`) catches sustained drops in the actual recording.                   |
| A6  | `BuildConfig.VERSION_NAME` from Android Gradle build is reliably set to a semver `M.m.p` string for the version-comparison helper                                                                    | D-UPG-06                 | If the gradle build sets a non-semver `versionName`, the comparator throws. Mitigation: planner adds a `setupVersionName` Gradle script that asserts semver shape at build time. Risk: low; current Phase 1 build sets `versionName "0.1.0"`. |
| A7  | The `apkRollout` flavor's APK is single-shot at force-upgrade time (no chunked resume)                                                                                                               | Don't Hand-Roll          | If the APK is large (>50 MB) on cellular, partial-failure UX is worse than chunk-resume. Acceptable for MVP; APK target size is ~30 MB.                                                                                                       |
| A8  | Phase 1's `seedAppVersions` already returns the right per-flavor shape from `/app/version`                                                                                                           | UPG-07 verification      | Phase 2 plan 02-01 (or 02-02) MUST verify against the running backend; if mismatched, file a Phase 1 fix-forward plan. [VERIFIED: read of apps/api/src/routes/app-version/get.ts]                                                             |
| A9  | `react-native-mmkv` 4.3.1 supports synchronous reads from React lifecycle (App.tsx mount path), enabling boot-time hydration without a Promise                                                       | D-STATE-02               | If MMKV becomes async in a future minor (it won't — sync is the headline feature), pattern breaks. Risk: zero. [VERIFIED: react-native-mmkv 4.x is sync]                                                                                      |
| A10 | MediaPipe HandLandmarker is NOT needed in Phase 2 (Phase 4) — confirmed                                                                                                                              | Compat scope             | If the compat probe needs hand detection (it doesn't — MediaPipe is for the recording-time gate), HumynCompat would need MediaPipe. Confirmed not needed.                                                                                     |
| A11 | `react-native-haptic-feedback` works on RN 0.83 new-arch; alternative is hand-rolled `Vibrator` Kotlin call                                                                                          | Standard Stack           | Library-discretion decision; risk: low                                                                                                                                                                                                        |

## Open Questions

1. **Final Help Center support email (`[EMAIL_ADDRESS]` placeholder).**

   - What we know: copy is verbatim per HELP-03; placeholder is `[EMAIL_ADDRESS]` per help-center-content.md and design-spec.md §17.
   - What's unclear: the actual address.
   - Recommendation: planner ships with `[EMAIL_ADDRESS]` literal; STATE.md `.Blockers` already flags this as deferred. Phase 2 planner can either (a) ship the placeholder and let a doc/cleanup pass swap it later, or (b) request the address from the user as a 1-question check-in.

2. **Compat-fail "what now" recovery copy (COMPAT-08).**

   - What we know: needs to be a non-brick page; mentions "try a different qualifying device, contact support."
   - What's unclear: exact wording.
   - Recommendation: lift verbatim from help-center-content.md §3 ("Compatibility check failed") so the in-app message matches Help. Planner picks the precise extraction.

3. **`installation_id` minting source (`react-native-uuid` vs Kotlin native).**

   - What we know: D-COMPAT-03 mentions either; CONTEXT.md §specifics flags it.
   - What's unclear: which.
   - Recommendation: extend `AppFlavor` Kotlin module with a `getOrMintInstallationId(): Promise<string>` method that uses `java.util.UUID.randomUUID()` and persists to MMKV. Avoids adding a JS UUID lib.

4. **Soft-banner copy (UPG-04).**

   - What we know: dismissible banner on Home; per-`latest` dismiss key in MMKV.
   - What's unclear: exact copy + CTA label per design-spec §9 (which is Phase-6-blank-tile-only at this writing).
   - Recommendation: planner picks placeholder copy ("Update available — Tap to install") and notes it'll be replaced when Phase 6 finalizes Home design.

5. **`HumynUpdater` module split — same package as `HumynCompat` or separate?**

   - What we know: D-COMPAT-01 says "two modules, focused; no shared library extraction."
   - What's unclear: whether `HumynUpdater` is a third module or folded into HumynCompat.
   - Recommendation: separate module (`HumynUpdater`). Compat is sense-only; Updater writes filesystem + launches PackageInstaller. Different concern, different audit surface.

6. **Where in the navigator does the soft-upgrade banner live?**

   - What we know: D-UPG-05 says "top of Home only."
   - What's unclear: HomeSkeleton has very little in Phase 2 (Phase 6 fills it). Where exactly?
   - Recommendation: HomeSkeleton in Phase 2 renders just `<TopBar.Logo /> + <SoftUpgradeBanner /> (when applicable) + <BottomNav>`. Phase 6 adds the dynamic hero + tiles between.

7. **Backend `/app/version` response field naming (camelCase vs snake_case).**
   - What we know: shared/types schema is camelCase (`minSupported`, `forceUpgrade`, `apkUrl`, `apkSha256`); UPG-02 in REQUIREMENTS.md uses snake_case (`min_supported`, `latest`, `force_upgrade`).
   - What's unclear: Are snake_case fields the wire form or just doc shorthand?
   - Recommendation: VERIFIED from `apps/api/src/routes/app-version/get.ts` — wire shape is camelCase. REQUIREMENTS.md snake_case is doc shorthand. Phase 2 client uses camelCase; planner cross-references shared/types.

## Environment Availability

> Phase 2 is mobile development; required environment is the mobile dev toolchain. Phase 1 already installed/audited most of it. Re-verifies:

| Dependency                  | Required by                                                    | Available                                          | Version       | Fallback                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 22 LTS                 | RN bundler + scripts                                           | ✓ (verified Phase 1)                               | 22.x          | —                                                                                                                                                    |
| pnpm 9.15+                  | Workspace root + backend (post-02-01)                          | ✓                                                  | 9.15.0        | —                                                                                                                                                    |
| **npm 10+**                 | Phase 2 mobile (post-02-01)                                    | ✓ (ships with Node 22)                             | 10.x          | —                                                                                                                                                    |
| JDK 17 (Zulu/Temurin)       | Android Gradle                                                 | ✓ (verified Phase 1)                               | 17.x          | —                                                                                                                                                    |
| Android SDK + cmdline-tools | Android Gradle build                                           | ✓ (verified Phase 1)                               | compileSdk 35 | —                                                                                                                                                    |
| `adb` on PATH               | On-device manual smoke                                         | ✓                                                  | —             | —                                                                                                                                                    |
| Pixel 7a/8a/10a hardware    | Real-device smoke (compat probe + APK install + sustained IMU) | **PARTIAL** — Phase 1 used a Pixel 7a-class device | —             | LocalStack S3 for backend auth-flow tests; emulator for non-camera/non-IMU flows; **physical Pixel REQUIRED for compat probe + force-upgrade smoke** |
| Watchman                    | RN file-watcher (Metro)                                        | ✓ (verified Phase 1)                               | latest        | metro can run without it (slower)                                                                                                                    |
| `react-native-asset` CLI    | Font linking                                                   | Adds during plan 02-XX                             | —             | Manual copy to `android/app/src/main/assets/fonts/` works as fallback                                                                                |

**Missing dependencies with no fallback:**

- Real Pixel 7a-class device for the compat probe smoke + the apkRollout PackageInstaller flow + 30 s sustained IMU probe under preview-running load. Mitigation: same operator setup as Phase 1's 13-MANUAL-SMOKE; CI cannot run these.

**Missing dependencies with fallback:**

- For unit-tests + storyboard-style screen tests, the existing JSDOM + Vitest setup (Phase 1 plan 01-13) handles every TypeScript-side concern.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property                   | Value                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Framework (JS/TS)          | Vitest 4.1.5 + JSDOM 25.0.1 (already configured in Phase 1)                                                                              |
| Framework (Kotlin)         | JUnit 4 + Robolectric (NEW for Phase 2; planner adds to `apps/mobile/android/app/build.gradle` testImplementation)                       |
| Mobile config file         | `apps/mobile/vitest.config.ts` (existing)                                                                                                |
| Kotlin config file         | `apps/mobile/android/app/build.gradle` (Phase 2 adds Robolectric block)                                                                  |
| Quick run command (JS/TS)  | `cd apps/mobile && npm run test` (post-02-01 npm migration)                                                                              |
| Quick run command (Kotlin) | `cd apps/mobile/android && ./gradlew :app:testApkRolloutDebugUnitTest`                                                                   |
| Full suite command         | `cd apps/mobile && npm run test && cd android && ./gradlew :app:testApkRolloutDebugUnitTest && cd ../.. && cd apps/api && pnpm run test` |
| Phase manual-smoke runbook | `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-MANUAL-SMOKE.md` (NEW; written at phase end)                  |

### Phase Requirements → Test Map

| Req ID                             | Behavior                                                                           | Test type                 | Automated command                                                                                                                                                    | File exists?                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| AUTH-01                            | "Continue with Google" CTA renders + dispatches `signInWithGoogle()`               | unit                      | `npx vitest run __tests__/SignupScreen.test.tsx`                                                                                                                     | ❌ Wave 0                                                             |
| AUTH-02                            | Unchecked consent + tap shows alert; no nav                                        | unit                      | `npx vitest run __tests__/SignupScreen.test.tsx`                                                                                                                     | ❌ Wave 0                                                             |
| AUTH-03                            | Terms popup renders verbatim §5.2 copy                                             | unit (snapshot)           | `npx vitest run __tests__/TermsOfUseModal.test.tsx`                                                                                                                  | ❌ Wave 0                                                             |
| AUTH-04                            | name/email returned; age/gender nullable                                           | unit                      | mock `signInWithGoogle()` to return shape with null age/gender                                                                                                       | ❌ Wave 0                                                             |
| AUTH-05                            | Play Integrity rejection surfaces error                                            | unit                      | mock `apiClient.post` to throw on `/auth/google`                                                                                                                     | ❌ Wave 0                                                             |
| AUTH-07                            | Session persists across cold start                                                 | unit                      | hydrate from MMKV mock containing `auth.jwt.v1` → `useAppStore.getState().jwt` truthy                                                                                | ❌ Wave 0                                                             |
| AUTH-08                            | Logout clears JWT + nav.reset                                                      | unit                      | `npx vitest run __tests__/LogoutModal.test.tsx`                                                                                                                      | ❌ Wave 0                                                             |
| AUTH-09                            | DELETE-typing gate before API                                                      | unit                      | type ≠ DELETE → button disabled; type = DELETE → button enabled → calls `DELETE /me`                                                                                 | ❌ Wave 0                                                             |
| AUTH-10                            | (same as AUTH-09 — UI gate test)                                                   | unit                      | (same)                                                                                                                                                               | ❌                                                                    |
| AUTH-11                            | New-device compat re-run via `installation_id`                                     | unit                      | mock different `installation_id` → `compatSignature` mismatch → initial route = Compat                                                                               | ❌ Wave 0                                                             |
| PERM-01/02                         | Camera + Mic prompts dispatched                                                    | unit                      | mock `react-native-permissions` `request()` → assert called with `PERMISSIONS.ANDROID.CAMERA` and `RECORD_AUDIO`                                                     | ❌ Wave 0                                                             |
| PERM-04                            | Manifest declarations present                                                      | static                    | grep `apps/mobile/android/app/src/main/AndroidManifest.xml` for required permissions; CI script                                                                      | ❌ Wave 0 — extend `verify-merged-manifests.sh`                       |
| COMPAT-01..03                      | `readDeviceCaps()` returns expected shape; `failedKeys` populated correctly        | unit (Kotlin)             | Robolectric mocks Camera2/SensorManager/StatFs → assert `CompatResult.checks.*.pass`                                                                                 | ❌ Wave 0 (Kotlin)                                                    |
| COMPAT-04                          | Re-run triggered when `installation_id` changes                                    | unit (JS)                 | hydrate with old signature → mock current signature → assert `compatPassed` cleared                                                                                  | ❌ Wave 0                                                             |
| COMPAT-06                          | Fail screen lists `failedKeys`                                                     | unit (snapshot)           | `npx vitest run __tests__/CompatFailScreen.test.tsx`                                                                                                                 | ❌ Wave 0                                                             |
| COMPAT-07 (NAL parse)              | NAL parser correctly extracts `slice_type` from canned bitstream                   | unit (Kotlin)             | provide a 1-frame I-only HEVC bitstream fixture + a 3-frame IBP bitstream fixture; assert `anyBFrames()` returns false / true                                        | ❌ Wave 0 — fixtures in `apps/mobile/android/app/src/test/resources/` |
| COMPAT-07 (OIS readback)           | OIS verdict reflects `LENS_OPTICAL_STABILIZATION_MODE`                             | unit (Kotlin Robolectric) | shadow Camera2; verify `oisOff` flips correctly                                                                                                                      | ❌ Wave 0                                                             |
| COMPAT-07 (HDR force)              | `DynamicRangeProfile.STANDARD` set on API ≥ 33; auto-pass on API < 33              | unit (Kotlin)             | shadow Build.VERSION.SDK_INT                                                                                                                                         | ❌ Wave 0                                                             |
| COMPAT-07 (IMU sustained)          | `runImuProbe()` returns expected sustainedHz on canned timestamp stream            | unit (Kotlin)             | inject a fake timestamp generator; assert `sustainedHz` and `p99IntervalMs`                                                                                          | ❌ Wave 0                                                             |
| COMPAT-07 (full integration)       | Behavioral check on real device passes/fails                                       | manual-only               | physical Pixel 7a/8a/10a smoke per 02-MANUAL-SMOKE                                                                                                                   | ❌ Wave 0                                                             |
| COMPAT-08                          | Recovery page renders + nav back from CompatFail works                             | unit                      | snapshot test                                                                                                                                                        | ❌ Wave 0                                                             |
| ONB-01/02                          | Rig screen renders verbatim copy + off-ramp link                                   | unit (snapshot)           | snapshot test                                                                                                                                                        | ❌ Wave 0                                                             |
| HOME-07/08                         | 3 tabs only inside MainTabs; no tab bar on Onboarding/Profile/etc.                 | unit (integration)        | render `<NavigationContainer>` at each route → assert `getByTestId('BottomNav')` query result                                                                        | ❌ Wave 0                                                             |
| PROF-01..05                        | Profile renders all fields; PATCH /me on edit                                      | unit                      | mock `apiClient.patch` → fire edit → assert called with right body                                                                                                   | ❌ Wave 0                                                             |
| HELP-01..05                        | Accordions render verbatim from content.json; mailto link; report-a-problem submit | unit                      | snapshot accordion bodies; mock `Linking.openURL` for mailto; mock `apiClient.post` for /feedback                                                                    | ❌ Wave 0                                                             |
| UPG-01..05                         | `versionService` correctly evaluates min_supported/latest; soft-banner persistence | unit                      | unit-test the `compareSemver` helper + the version-decision tree in isolation                                                                                        | ❌ Wave 0                                                             |
| UPG-03 (force-upgrade APK install) | Real flow on apkRollout flavor                                                     | manual-only               | physical Pixel — install old APK, bump backend `min_supported`, cold-start app, verify ForceUpgrade screen, click Update, verify SHA-256 + system installer launches | ❌ Wave 0 — covered by 02-MANUAL-SMOKE                                |

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npm run test` (the ~17 s vitest unit suite). Touches Kotlin? Also `./gradlew :app:testApkRolloutDebugUnitTest` (~2 min cold; ~30 s incremental).
- **Per wave merge:** Full suite — vitest + Kotlin unit + backend Phase 1 e2e (the e2e suite is Phase 1's, but Phase 2 changes that touch backend contracts re-run it).
- **Phase gate:** Full suite green + 02-MANUAL-SMOKE checkbox-walkthrough on a physical Pixel + Crashlytics zero-new-issues for the apkRollout build before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] Add `@testing-library/react-native` (or rely on the existing JSDOM + react-test-renderer host-component shim)
- [ ] Add Kotlin `testImplementation` block in `apps/mobile/android/app/build.gradle` for JUnit 4 + Robolectric
- [ ] Create `apps/mobile/android/app/src/test/resources/hevc-fixtures/` with canned bitstream samples (1-frame I-only, 3-frame IBP)
- [ ] Create `apps/mobile/__tests__/` test files for each screen (Signup, Permissions, Compat[Running|Pass|Fail|Recovery], RigTutorial, ProfileScreen, HelpCenterScreen, ReportProblemSheet, ForceUpgradeScreen, LogoutModal, DeleteAccountModal)
- [ ] Create `apps/mobile/__tests__/services/` for `compatService`, `versionService`, `feedbackService`, `installationId`, `telemetryRing`, `durationFormatter`, `semver`
- [ ] Create `apps/mobile/__tests__/state/` for `appStore` + `hydrate` (MMKV mock fixtures)
- [ ] Create `02-MANUAL-SMOKE.md` runbook covering: cold-start sign-up + permissions + compat happy path + compat-fail simulation + Profile edit + Help mailto + Report a problem + force-upgrade APK install on apkRollout flavor + force-upgrade market:// on playStore flavor

## Security Domain

> `security_enforcement` is `true` in `.planning/config.json`. ASVS L1 controls applicable to Phase 2 surfaces:

### Applicable ASVS categories

| ASVS category                 | Applies | Standard control                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication             | yes     | Phase 1 already enforces — Google Sign-In + Play Integrity Standard + JWT (HS256, 30-day TTL); Phase 2 reuses; client validates JWT payload's flavor + applicationId match build constants (D-AUTH-05, defense-in-depth). [VERIFIED: apps/mobile/src/services/auth.ts lines 137-145] |
| V3 Session Management         | yes     | JWT in MMKV `humyn.secure` instance with `encryptionKey: 'humyn-mmkv-v1'` (AES-128 at rest); Keychain refresh-token slot reserved (empty at MVP). Logout clears JWT. No multi-session (one-account-one-device per spec). [VERIFIED: apps/mobile/src/services/auth.ts]                |
| V4 Access Control             | yes     | Backend RFC 7807 enforces (Phase 1); client validates JWT decoded payload (flavor + applicationId).                                                                                                                                                                                  |
| V5 Input Validation           | yes     | All wire bodies validated by zod schemas in `shared/types/` (Phase 1 established pattern). Phase 2 adds: `CompatResult` Zod schema; Profile inline edits use `UserPatchSchema` (already shipped); feedback fields use `FeedbackFieldsSchema` (already shipped).                      |
| V6 Cryptography               | yes     | SHA-256 of APK download via Kotlin `MessageDigest.getInstance("SHA-256")` (NOT a JS crypto library); MMKV uses XChaCha20 internally for `encryptionKey`-flagged instances. NEVER hand-roll crypto.                                                                                   |
| V7 Error Handling and Logging | yes     | RFC 7807 errors decoded client-side; PII not logged in telemetry ring (event names + non-PII attrs only); Crashlytics scrubs paths.                                                                                                                                                  |
| V8 Data Protection            | yes     | Coarse location only (Phase 4); Help Center mailto `[EMAIL_ADDRESS]` placeholder doesn't leak user PII automatically; "Report a problem" diagnostic snapshot includes user-controlled `message` text + non-PII telemetry ring (per HELP-05 spec).                                    |
| V9 Communications             | yes     | TLS via OS network stack; backend has CORS configured (Phase 1); APK download MUST be over HTTPS (URL from backend will be CloudFront-signed, https-only).                                                                                                                           |
| V14 Configuration             | yes     | `react-native-config` per-flavor `.env` files; secrets (Web Client ID, etc.) NOT committed; `.gitignore` already excludes them per Phase 1.                                                                                                                                          |

### Known threat patterns for the Phase 2 stack

| Pattern                                                                                         | STRIDE     | Standard mitigation                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MITM on `GET /app/version` returning a malicious `apk_url`                                      | Tampering  | TLS + APK SHA-256 verification by client (D-UPG-02). The catastrophic event (`force_upgrade_apk_hash_mismatch`) is logged.                                                                                                                                            |
| Replaying an old JWT after logout                                                               | Spoofing   | JWT 30-day expiry; logout clears MMKV; backend has token-version claim that future revocation pass can invalidate (already in JWT shape).                                                                                                                             |
| Modifying `compat.lastResult.v1` in MMKV to fake a pass                                         | Tampering  | MMKV is encrypted at rest. Compat-pass is a _gate_, not a _grant_ — backend re-checks integrity at sign-in (Play Integrity), and Phase 3 capture pipeline enforces real spec at runtime. Tampering only affects the local UX gate; cannot upload non-spec recordings. |
| Help Center "Report a problem" form used to exfiltrate other users' PII                         | Disclosure | Form submits a diagnostic snapshot of the SUBMITTING user only; backend `/feedback` is JWT-authenticated, so the snapshot is bound to that user's `sub`. No cross-user data possible.                                                                                 |
| Account-delete typing gate bypassed via JS console / Hermes debugger                            | Tampering  | Backend `DELETE /me?confirm=DELETE` requires the exact query param; client-side gate is UX defense-in-depth, backend is the binding gate. (Already enforced — MeDeleteQuerySchema).                                                                                   |
| Token leak via Crashlytics native crash                                                         | Disclosure | JWT is in MMKV (encrypted); never written to `console.log` or stack trace. AppFlavor + PlayIntegrity surfaces don't take JWT. ✓                                                                                                                                       |
| `REQUEST_INSTALL_PACKAGES` abused on apkRollout to install attacker APK                         | Elevation  | The download URL is signed by our backend; SHA-256 verifies the bytes; `PackageInstaller` requires user approval at the OS level for the install itself. Three layers — a compromise needs all three.                                                                 |
| Diagnostic snapshot leaks PII via telemetry ring                                                | Disclosure | Telemetry events are pre-filtered: per Phase 1 / engineering-handoff §11, NO event includes name, email, task name, query content, or recording filenames — only IDs, durations, sizes, network type. Re-verify in plan.                                              |
| Soft-banner dismiss key (`appVersion.softBannerDismissed.{latest}`) injection via tampered MMKV | Tampering  | Cosmetic-only; tampering at most hides the banner. No security impact.                                                                                                                                                                                                |

## Sources

### Primary (HIGH confidence)

- [Android CameraCharacteristics API reference](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics) — `LENS_INFO_AVAILABLE_FOCAL_LENGTHS`, `SENSOR_INFO_PHYSICAL_SIZE`, `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION`, `LENS_FACING` (fetched 2026-05-08)
- [Android SensorManager API reference](https://developer.android.com/reference/android/hardware/SensorManager) — `SENSOR_DELAY_FASTEST`, `registerListener` with maxReportLatency (fetched 2026-05-08)
- [Android Camera2 HDR video capture guide](https://developer.android.com/media/camera/camera2/hdr-video-capture) — `OutputConfiguration.setDynamicRangeProfile(DynamicRangeProfiles.STANDARD)`, API 33+ (fetched 2026-05-08)
- [Android Play Integrity API — Standard request](https://developer.android.com/google/play/integrity/standard) — `IntegrityManagerFactory.createStandard`, request flow (fetched 2026-05-08)
- [Android Play Integrity API — Verdicts](https://developer.android.com/google/play/integrity/verdicts) — MEETS_BASIC_INTEGRITY / MEETS_DEVICE_INTEGRITY / MEETS_STRONG_INTEGRITY semantics (fetched 2026-05-08)
- [PackageInstaller.Session API reference](https://developer.android.com/reference/android/content/pm/PackageInstaller.Session) — `openWrite`, `commit`, `IntentSender` (fetched 2026-05-08)
- [Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_UNKNOWN_APP_SOURCES) — per-app install consent (fetched 2026-05-08)
- [React Navigation v7 docs](https://reactnavigation.org/docs/upgrading-from-6.x/) — `react-native-screens 4.x` requirement, native-stack defaults (fetched 2026-05-08)
- [React Native 0.83 release notes](https://reactnative.dev/blog/2025/12/10/react-native-0.83) — no breaking changes; new-arch-only (fetched 2026-05-08)
- `.planning/research/STACK.md` — locked stack pins, configuration recipes, OEM sharp edges (in-repo, 2026-05-07)
- `.planning/research/PITFALLS.md` — Phase 2 hot-spot pitfalls (Pitfall 1, 14, 15)
- `engineering-handoff.md` — design tokens (§1), component inventory (§2), navigation graph (§3), state machines (§4), native APIs (§5), data model (§7), API surface (§8), validation (§9), accessibility (§10), telemetry (§11), edge cases (§13), security (§14)
- `design-spec.md` — screen-by-screen contract; Phase 2 hot-spots: §0 (foundations), §1 (Splash), §2 (Sign-up), §3 (Permissions), §4 (Compat), §5 (Tutorial Rig), §15 (Profile), §17 (Help Center), §18 (Modals)
- `idea-brief.md` §5.2 (Terms-of-Use canonical text), §5.4 (compat-check spec), §5.11 (Profile spec), §9 (Forced Upgrade), §13 (TTS), §14 (perf budgets)
- `help-center-content.md` — verbatim Help Center copy
- `apps/api/src/routes/app-version/get.ts` — Phase 1 backend implementation; **VERIFIED** that response shape is camelCase discriminated-union by flavor

### Secondary (MEDIUM confidence)

- [zoontek/react-native-permissions GitHub](https://github.com/zoontek/react-native-permissions) — RN 0.83 + new-arch compatibility (fetched 2026-05-08)
- [react-native-google-signin/google-signin GitHub](https://github.com/react-native-google-signin/google-signin) — Credential Manager migration, GMS-required caveat (fetched 2026-05-08)
- [pmndrs/zustand npm](https://www.npmjs.com/package/zustand) — v5.x current; persist middleware available but Phase 2 uses manual MMKV hydration
- [chemag/h265nal](https://github.com/chemag/h265nal) — H.265 NAL unit parser reference (C++; we port the slice_type extraction logic to Kotlin)
- [figgis/fd509a02d4b1aa89f6ef gist](https://gist.github.com/figgis/fd509a02d4b1aa89f6ef) — H.265/HEVC bitstream parser cross-reference

### Tertiary (LOW confidence)

- Various blog posts (drcsystems, lucentinnovation, callstack) on RN 0.83 — read but not cited; cross-verified with the official RN 0.83 release post
- "Assessing Jitter in Sensor Time Series from Android Mobile Devices" (IEEE 7501679) — academic context for the IMU jitter problem; not used directly because we measure inter-sample p99 in our probe rather than rely on published jitter figures

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dep is either Phase-1-locked or has an authoritative version on npm; v7 React Navigation + react-native-screens 4 is the documented matched pair
- Architecture (navigator graph, store, file structure): HIGH — directly follows CONTEXT.md decisions; no novel architectural risk
- Compat-check primitives (NAL parse, OIS readback, HDR force, IMU sustained): MEDIUM-HIGH — APIs are documented and correct; OEM honoring of the requests has known sharp edges (Pitfalls 1, 2, 4) that the probe design itself catches; physical-device validation is mandatory
- Force-upgrade flow: HIGH — Phase 1 backend already returns the right shape; PackageInstaller pattern is standard; Settings deep-link is the documented path for unknown-app-sources consent
- Profile + Help Center + Feedback: HIGH — every backend endpoint and Zod schema already shipped in Phase 1; build-time MD parsing is standard
- Pitfalls: HIGH — every pitfall has an in-repo or external reference and a concrete mitigation
- Security domain: HIGH — Phase 1 already addresses V2/V3/V4/V5 with shipped code; Phase 2 introduces V6 (APK SHA-256) and V8 (diagnostic snapshot scope) with documented controls

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 days; locked stack reduces churn risk)

## RESEARCH COMPLETE
