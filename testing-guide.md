# Humyn Labs — Testing Guide

Two parts:

- **Part A** — exact workflow from "Claude Code has produced the codebase per `implementation-plan.md`" to "the app is running on a connected Pixel 10a, debugged via Android Studio."
- **Part B** — the layered testing strategy and concrete checklists, including a Pixel 10a-specific per-session checklist.

Source documents this leans on: `idea-brief.md` (spec), `implementation-plan.md` (architecture), `engineering-handoff.md` (perf budgets, telemetry events, edge-case table).

---

# Part A — From Claude-generated code to running on a Pixel 10a

Assumes macOS with Android Studio installed. The codebase lives at `/Users/adnaan/Documents/hl-homelander/` with the structure from `implementation-plan.md` §3 (`apps/mobile/`, `apps/api/`, etc.).

## A.0 One-time machine setup (skip if already done)

```bash
# Node + package manager
brew install node@20 pnpm watchman

# JDK 17 (RN 0.75+ requires it)
brew install --cask zulu@17

# Expose adb on PATH (Android Studio installs the SDK; this just makes life easier)
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator' >> ~/.zshrc
source ~/.zshrc

# Verify
node -v        # v20.x
pnpm -v        # any
adb version    # Android Debug Bridge x.x.x
java -version  # openjdk 17
```

In Android Studio: **Settings → Languages & Frameworks → Android SDK**:

- **SDK Platforms** tab: install **Android 15 (API 35)** — our `targetSdk`.
- **SDK Tools** tab: install **Android SDK Build-Tools 35**, **NDK (Side by side) latest**, **CMake**, **Android SDK Platform-Tools**.

## A.1 Install JS dependencies

```bash
cd /Users/adnaan/Documents/hl-homelander
pnpm install         # at monorepo root — installs apps/mobile, apps/api, shared/*
```

Pod install for iOS is not required for Android-only testing.

## A.2 Prep the Pixel 10a (one-time per device)

On the phone:

1. **Settings → About phone → tap "Build number" 7 times** → "You are now a developer"
2. **Settings → System → Developer options:**
   - **USB debugging: ON**
   - **Stay awake: ON** (keeps screen on while charging — useful for long captures)
   - **Window/Transition/Animator scale: all 1×** (do not 0.5× — masks real perf)

Plug in via a **USB-C data cable** (not charge-only). Accept the **"Allow USB debugging from this computer?"** prompt — tick "Always allow from this computer".

```bash
adb devices
# Expected:
# List of devices attached
# 4A09....    device
```

If `unauthorized` appears instead of `device`: unplug, replug, accept the prompt. If empty: the cable is charge-only or USB debugging isn't actually enabled.

## A.3 Open the project in Android Studio

**File → Open** → navigate to `/Users/adnaan/Documents/hl-homelander/apps/mobile/android/` → **Open**.

Open the `android/` subfolder, **not** `apps/mobile/`. Studio is an Android-Gradle IDE; pointing it at the RN root confuses it.

Wait for **Gradle sync** to complete (status bar at the bottom). First sync downloads the Android Gradle Plugin, NDK, and CMake — 5–15 min on a fresh machine.

If sync fails, check the **Build** tool window for the actual error. Most common cause: SDK location not set. **File → Project Structure → SDK Location** → point at `~/Library/Android/sdk`.

The Pixel 10a should appear in the **device dropdown** at the top toolbar (next to the green Run button) as "Pixel 10a (USB)".

## A.4 Start the Metro bundler

In a terminal that stays open while you test:

```bash
cd /Users/adnaan/Documents/hl-homelander/apps/mobile
pnpm start
# Metro on http://localhost:8081 — leave running
```

## A.5 Run the app on the phone

Two paths — pick one.

**Path 1: from Android Studio (recommended for the first run)**

1. Pixel 10a selected in the device dropdown.
2. Run configuration dropdown (left of the device dropdown) set to **app**.
3. Click the green **Run ▶** button.

Gradle compiles Kotlin TurboModule code + bundles MediaPipe's `hand_landmarker.task` (~7.8 MB) + builds the APK + installs + launches. **First build: 5–10 min.** Incremental rebuilds: 30–60s.

**Path 2: from the command line (faster for repeat iterations)**

```bash
cd /Users/adnaan/Documents/hl-homelander/apps/mobile
pnpm android        # = react-native run-android
```

Metro from A.4 must be running.

## A.6 Hook up the backend

The app needs a backend for sign-in, tasks, and presigned URLs. Two options.

**Option 1: Backend running locally on your Mac**

```bash
# Terminal 2: Postgres + LocalStack (S3 mock)
cd /Users/adnaan/Documents/hl-homelander
docker compose up postgres localstack

# Terminal 3: Fastify
cd apps/api
pnpm dev            # Fastify on http://localhost:3000
```

The phone reaches your Mac via the Mac's LAN IP:

```bash
ipconfig getifaddr en0     # e.g. 192.168.1.42
```

Set the API base URL in the dev env file:

```bash
# apps/mobile/.env.development
API_BASE_URL=http://192.168.1.42:3000
```

Rebuild (A.5) so the env is picked up. Phone and Mac must share WiFi.

**Option 2: Point at staging** (if `infra/terraform/envs/staging/` is deployed)

```bash
# apps/mobile/.env.development
API_BASE_URL=https://api-staging.humyn.ai
```

## A.7 First-run smoke test on the phone

Once the app launches, run this end-to-end. If any step fails: stop, debug, fix.

1. **Splash → Sign-up** → **Continue with Google** → pick your Google account → grant consent.
2. **Permissions** → grant Camera + Mic.
3. **Compat check** → all 7 items pass. (Pixel 10a's ultrawide + Tensor G5 IMU easily clear the bar.)
4. **Onboarding** → Rig screen → Practice intro → **Start practice** → rotate to landscape → bring hands clearly into frame → hand-gate passes in ~2s → record 60s → auto-stops.
5. **Practice complete** → continue to Home.
6. **Start Recording** → pick a task → **Start Recording** → record 90s → stop.
7. Verify: file appears in **History** with thumbnail. Open **Pending uploads** tile → upload completes → file disappears from pending. Tap thumbnail → fullscreen player works.

If a step hangs, check the Metro terminal (A.4) for JS errors and **Logcat** in Android Studio (View → Tool Windows → Logcat) for native errors.

## A.8 Iterating

| Change type            | What to do                                                     | Time    |
| ---------------------- | -------------------------------------------------------------- | ------- |
| JS / TS code           | Save → press **R** twice in Metro, or shake phone → **Reload** | ~1s     |
| Kotlin / native module | Click **Run ▶** again, or `pnpm android`                      | 30–60s  |
| Gradle deps            | **File → Sync Project with Gradle Files**, then rebuild        | 1–3 min |

## A.9 Pulling diagnostics

**Logcat in Android Studio:** View → Tool Windows → Logcat → filter dropdown "Show only selected application" → `ai.humynlabs` → search bar:

```
tag:HumynCapture | tag:HumynUpload | tag:HumynHandGate
```

**Profiler:** View → Tool Windows → Profiler → **+** → select Pixel 10a → Humyn Labs.

- **CPU** profile during a 1-min capture; look for jank > 16 ms on the UI thread.
- **Memory** profile during capture; peak should stay < 200 MB per `engineering-handoff.md` §12.

**In-app diagnostic harness:** long-press the home-screen logo 5× within 3s → live IMU rate, encoder queue depth, thermal state graph, upload queue, last 100 telemetry events. "Dump queue to share-sheet" emails you the JSON.

**Command-line introspection (terminal):**

```bash
# Live logs filtered to our modules:
adb logcat -c
adb logcat HumynCapture:V HumynUpload:V HumynHandGate:V HumynIntegrity:V *:E

# Encoder state during capture:
adb shell dumpsys media.codec | grep -A 20 "video/hevc"

# Battery stats around a sustained-capture run:
adb shell dumpsys batterystats --reset       # before
# … run the test …
adb shell dumpsys batterystats > batstats-$(date +%s).txt

# Thermal stream during a 25-min capture:
adb shell "while true; do dumpsys thermalservice | grep 'Current temperatures' -A 1; sleep 5; done"
```

## A.10 Common first-run failures

| Symptom                           | Fix                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `adb devices` → `unauthorized`    | Unplug, replug, accept the dialog on the phone                                                                          |
| `adb devices` empty               | Bad USB cable (try another), or USB debugging not actually enabled                                                      |
| Metro: "Unable to resolve module" | `pnpm install` was incomplete — re-run at repo root                                                                     |
| Gradle: "SDK location not found"  | File → Project Structure → SDK Location → `~/Library/Android/sdk`                                                       |
| App opens but stuck on splash     | Metro not running, or phone can't reach Metro. Same WiFi? Or shake → Dev Settings → Debug server host = `<mac-ip>:8081` |
| App opens but sign-in fails       | `API_BASE_URL` wrong, or BE not running. Verify: `curl http://<mac-ip>:3000/healthz` from your Mac                      |
| Compat check fails on HEVC        | `adb shell dumpsys media.codec                                                                                          | grep -i hevc` should list an encoder. Pixel 10a has it; if missing, the build excluded HEVC support. |
| Hand-gate never passes            | Lighting too dim or hands outside ultrawide FOV. Test under bright light first; check `HumynHandGate` errors in Logcat  |
| Build OOMs (Gradle)               | Increase Studio heap: Help → Edit Custom VM Options → `-Xmx4096m`                                                       |

---

# Part B — Testing checklist

Five layers, each catching what the layer below cannot. The hard parts of this app — capture, hand-gate, upload survival, thermal — only show up on physical devices, so the manual layers carry more weight than usual.

## B.1 Layer 1 — Automated tests in CI (every PR)

**JS / TS unit tests (Jest)** — pure logic only:

- [ ] `shared/drift.ts` — drift methodology, with synthetic frame + IMU timestamps and known-drift fixtures
- [ ] State machines: `recState`, `permStep`, `runCompat`, hand-gate phase transitions
- [ ] Duration formatters (`< 1m → Xs`, `< 1h → Xm`, `≥ 1h → Xh Ym`)
- [ ] Filename convention generator (`YYYYMMDD_HHMMSS_NNN`)
- [ ] Custom date range validation (`from ≤ to ≤ today`, max 365 days)
- [ ] Zod schema round-trips for every API contract in `shared/types/`

**Native unit tests** — module logic only:

- [ ] Kotlin (JUnit + Robolectric where needed): encoder config builder, IMU CSV row formatter, hash computation, drift compute
- [ ] Swift (XCTest): same coverage on iOS halves

**Backend tests (Vitest)** — Fastify against ephemeral Postgres + LocalStack S3:

- [ ] Per-route: zod validation, auth hook, business logic
- [ ] Hash-verify webhook end-to-end (post a fake S3 event, assert `recordings.qa_status` flips)
- [ ] pgvector + ts_vector hybrid search returns expected ranking on a fixed task fixture

**E2E tests (Detox)** — emulator/simulator, headless in CI:

- [ ] Sign-up flow (mock Play Integrity + Firebase Auth)
- [ ] Permissions screens (force grant via Detox)
- [ ] Compat-check pass + fail variants (mock the native module to return canned results)
- [ ] Tasks list: pill filter, search debounce, request-a-task sheet
- [ ] History filter sheet with custom range
- [ ] Account delete + restore flow

**What CI cannot catch** (and you must accept): real Camera2 / AVCaptureSession behavior, real IMU rates, real thermal, real upload survival across backgrounding, real hand-detection accuracy on real lighting.

## B.2 Layer 2 — Simulator / emulator manual smoke (per developer, daily)

What works without a physical device:

- [ ] All UI: splash, sign-up, permissions, home, tasks, history, profile, help, all sheets/modals
- [ ] Onboarding flow (rig screen, practice intro)
- [ ] Compat-check screen with a debug-only "Force pass / force fail" hook in the diagnostic harness
- [ ] Diagnostic harness itself (long-press logo)

What is stubbed (you'll get fake behavior):

- [ ] Recording surface — emulator has no real camera; use the "pretend rotated" debug pill in `design-spec.md` §7a, and a stub `HumynCapture` that emits canned frames
- [ ] Hand-gate — force-bypass via debug toggle
- [ ] Upload — uses LocalStack S3; chunks upload, but the foreground service doesn't survive emulator background-kill the way it does on real devices
- [ ] Thermal / battery alerts — debug menu in diagnostic harness has "Trigger battery 15%", "Trigger thermal kill" buttons (internal builds only)

Goal: 5-min sanity check before pushing a PR.

## B.3 Layer 3 — Perf lab on physical devices (every release candidate)

Six-phone matrix from `implementation-plan.md` §10:

| Device                  | Why it's in the matrix                                                      |
| ----------------------- | --------------------------------------------------------------------------- |
| Pixel 7a (or Pixel 10a) | Stock Android perf benchmark — `idea-brief.md` §14 specifies Pixel 7a-class |
| Samsung S22             | Exynos chipset variance; OneUI battery optimization                         |
| OnePlus 11              | Snapdragon 8 Gen 2; OxygenOS thermal behavior                               |
| Xiaomi 13               | MIUI battery optimization (most aggressive OEM)                             |
| iPhone 13 Pro           | Minimum iOS device with ultrawide                                           |
| iPhone 15 Pro           | Latest iOS hardware; A17 thermal                                            |

Scenario suite to run on every device, every release candidate. Track in a spreadsheet, one row per device-scenario.

### B.3.1 Cold start to first recording end-to-end

- [ ] Install fresh, sign up, complete onboarding
- [ ] Record a 60-second practice
- [ ] Record a 90-second real task
- [ ] Verify: timer accurate, voice cues fire, file in history, upload completes, thumbnail tappable, hash-verify event arrives

### B.3.2 25-minute sustained capture (the §14 perf gate)

Record continuously across 2 auto-segment boundaries (10 min + 10 min + 5 min):

- [ ] Frame count == `30 × duration_s` exactly (zero drops)
- [ ] No thermal cut-out (status never reaches `THROTTLING_SEVERE` in diagnostic harness graph)
- [ ] `drift_p99_ms < 1.0` in metadata JSON for each segment
- [ ] Battery drain ≤ 8% (per `engineering-handoff.md` §12)

### B.3.3 All §10 lifecycle edges

One row of the brief's §10 table per test:

- [ ] Phone call answered mid-record → stops, uploads if ≥ 60s
- [ ] Phone call declined → recording continues
- [ ] Alarm rings → stops, uploads if ≥ 60s
- [ ] Force-quit mid-record → recording lost; pending uploads continue
- [ ] Rotate to portrait mid-record → stops with toast
- [ ] Battery drops to 15% → toast appears, recording continues
- [ ] Battery drops to 5% → segment ends cleanly
- [ ] Storage pre-record < 5 GB → warning shown
- [ ] Storage fills mid-record → segment ends cleanly
- [ ] Logout while uploads pending → in-flight cancels, queue preserved, re-login resumes

### B.3.4 Hand-gate scenarios

- [ ] Hands clearly in frame → passes in ~2s
- [ ] Hands obscured → counter never advances
- [ ] One hand only → counter resets every check
- [ ] Skip path → bypasses gate, no voice cue, no haptic
- [ ] Force native module unavailable (replace `hand_landmarker.task` with junk in test-only build) → silent bypass

### B.3.5 OEM battery optimization torture (Xiaomi, OnePlus, Samsung specifically)

- [ ] Start a recording, stop, immediately background the app, lock the phone
- [ ] Leave overnight (8+ hours)
- [ ] Open app next morning → upload completed or resumed cleanly
- [ ] Re-run with battery mode set to **Restricted** — uploads should still complete (this is where worst real-world bugs hide)

### B.3.6 Network conditions

Use Network Link Conditioner (iOS) or `tc qdisc` (Android):

- [ ] "Edge" — recording unaffected, upload pauses/resumes gracefully
- [ ] "3G" — upload completes slowly, no chunk losses
- [ ] "Lossy WiFi" — chunks retry per backoff (2s → 4s → 8s …)
- [ ] "DNS Failure" — uploads pause, recover when DNS returns

### B.3.7 Thermal kill

- [ ] Wrap the phone in a sock near a heater, start recording
- [ ] Alert pill appears at `THROTTLING_SEVERE`
- [ ] Voice cue "Phone too hot, stopping recording" fires
- [ ] Segment ends cleanly within 2.5s
- [ ] New recordings refused until cool

### B.3.8 Auth + integrity edges

- [ ] Root the phone with Magisk → Play Integrity rejects sign-in
- [ ] Install via raw APK (not Play track) → Play Integrity rejects sign-in
- [ ] Reinstall via Play Internal Testing track → sign-in succeeds

### B.3.9 Account delete + restore

- [ ] Delete account → log in within 30 days → restored, history intact
- [ ] (Test-only) BE clock advanced past 30 days → log in → fresh signup required, uploaded recordings remain on server

## B.4 Layer 4 — Closed sideload beta (5–10 chiefs)

Highest-signal layer: real heads, real rigs, real homes, real Indian/Brazilian cellular.

**Setup:**

- [ ] Distribute via **Play Internal Testing track** (not raw APK — preserves Play Integrity per `implementation-plan.md` §8)
- [ ] Each tester gets a head rig + week-1 mission checklist (3 different tasks, 1 force-quit, 1 overnight pending-upload, 1 back-to-back 25-min session)
- [ ] Daily: pull diagnostic-harness "Dump queue to share-sheet"

**What you watch:**

- [ ] Crashlytics dashboard daily — any non-zero crash rate is a stop-ship
- [ ] Analytics funnel: `signup_google_succeeded → practice_done_view → first non-practice recording_uploaded` — < 80% conversion = something is broken
- [ ] `recording_gate_skipped` rate — > 20% means MediaPipe is false-negativing on the field population; tune `minHandDetectionConfidence` via Remote Config
- [ ] `upload_chunk_failed` clustered by network type — surfaces cellular flakiness before production
- [ ] `compat_check_failed` clustered by device model — feeds the Layer 3 device matrix

**Exit gate:**

- [ ] 5 consecutive days of zero new Crashlytics issues
- [ ] ≥ 90% upload success rate
- [ ] ≥ 80% practice → first-real conversion

## B.5 Layer 5 — Staged Play Store + App Store rollout

Once Layer 4 gate is met:

**Play Store:**

- [ ] Production track, country-staged: India 1% → 10% → 50% → 100% → Brazil 10% → Brazil 100%
- [ ] ~2–3 days at each stage
- [ ] **Halt conditions:** Crashlytics crash-free rate < 99.5% OR upload success rate < 90%
- [ ] Force-upgrade `min_supported` version locked at the first staged release; `latest` updates each release; both via `/app/version`

**App Store** (iOS, T+2 weeks):

- [ ] TestFlight cohort first (same chiefs if they have iPhones, plus team)
- [ ] Phased release via App Store Connect (1d → 2d → 5d → 10d → 100% over 7 days)
- [ ] Same halt conditions

## B.6 Backend testing (separate axis)

- [ ] **Local:** docker-compose with Postgres + pgvector + LocalStack S3. Every dev runs locally for app dev.
- [ ] **Staging:** separate AWS account, identical Terraform. Mobile debug build can point at staging via build flavor.
- [ ] **Load test (k6):** before every Play Store rollout stage, 10-min run against staging hitting `idea-brief.md` §14 numbers — 200–300 concurrent uploaders × 8 MB chunks. Assert: API p99 < 200 ms, upload completion p99 < 60s on 10 Mbps.
- [ ] **Chaos drill (one-time, before prod launch):** kill the API container mid-upload, kill Postgres standby, kill Redis. Uploads auto-resume; API fails over within 60s.

## B.7 Pixel 10a per-session checklist

Run this end-to-end on the Pixel 10a for every release candidate. Tensor G5 thermal behavior under sustained 1080p30 HEVC + IMU + audio + MediaPipe is the single highest-risk thing on this device class.

### Pre-session

- [ ] Pixel 10a charged ≥ 80%
- [ ] **Settings → Apps → Humyn Labs → Battery → Unrestricted** (we'll re-enable Restricted later)
- [ ] Phone and Mac on the same WiFi
- [ ] Metro bundler running (A.4)
- [ ] BE running locally or staging configured (A.6)
- [ ] App freshly installed via Play Internal Testing track
- [ ] `adb shell dumpsys batterystats --reset` (clean baseline)

### Session

- [ ] Cold install + first-run end-to-end (sign-up → practice → first real recording → upload verified)
- [ ] 25-minute sustained capture: zero frame drop, thermal stays ≤ `THROTTLING`, `drift_p99 < 1ms`, battery drain ≤ 8%
- [ ] All §10 lifecycle edges (B.3.3)
- [ ] Hand-gate happy + obscured + skip + silent-bypass paths (B.3.4)
- [ ] Auto-segment cut at 10 min: silent transition, no gate re-run, both segments upload
- [ ] Background overnight with pending uploads → all completed by morning (B.3.5)
- [ ] Switch battery mode to **Restricted**, repeat the overnight test → uploads still complete
- [ ] Account delete + restore within 30 days (B.3.9)
- [ ] Logout mid-upload → re-login resumes

### Post-session diagnostics

- [ ] `adb shell dumpsys batterystats > batstats-pixel10a-$(date +%s).txt` — verify drain
- [ ] Diagnostic harness → "Dump queue to share-sheet" — capture the JSON
- [ ] Logcat sweep: zero `E/HumynCapture`, `E/HumynUpload`, `E/HumynHandGate` errors
- [ ] Crashlytics dashboard: zero new issues for this build
- [ ] Compare drift figures across all segments — `drift_p99_ms` should be < 1.0 throughout

### Bug filing (every issue from this device)

Include:

- [ ] Build fingerprint: `adb shell getprop ro.build.fingerprint`
- [ ] App version (top of diagnostic harness)
- [ ] `recState` at time of bug (from harness)
- [ ] Last 100 telemetry events (harness export)
- [ ] Logcat tail (last 200 lines)
- [ ] Steps to reproduce

---

## What this guide does not cover

- iOS-specific testing flow (Xcode + iPhone) — add when iOS workstream starts.
- Backend-specific load test scripts (k6) — live in `apps/api/test/load/` once written.
- QA review web app — deferred from MVP per `implementation-plan.md` §1 (internal tooling scope).
