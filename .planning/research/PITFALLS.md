# Homelander Pitfalls Research

**Domain:** Android-first crowdsourced egocentric data-collection app (1080p HEVC + IMU + audio at scale; paid-per-QA-pass; India + Brazil; ₹30K phones)
**Researched:** 2026-05-07
**Confidence:** HIGH for capture-pipeline pitfalls (Context7 docs + AOSP source + tracker bugs); MEDIUM for India/Brazil network specifics; MEDIUM for fraud/operational pitfalls (industry pattern, project-specific tuning needed)
**Cross-references:** This file deliberately avoids re-stating items from `deferred-decisions.md` (per-upload attestation, perceptual-hash dedup, device-fingerprint binding, liveness gestures, on-device hands-in-frame Variant B, Wi-Fi-only toggle) and `strategic-suggestions.md` (success metrics, payments trust, retention loops, clan visibility, localization, brand narrative). Anything below is *additive* to those documents.

---

## How to read this file

The brief is unusually tight for a greenfield project. Most "stack-level pitfalls" you'd normally flag (which encoder API, which sync clock, which integrity API) are already locked in `idea-brief.md` §6 / §15. The pitfalls here are second-order: things that bite **even though** the spec is right, because the spec assumes vendor implementations honour the contract. They mostly **don't**. Each pitfall below is something that will not be visible until a real device on a real network in a real warm room hits it.

Severity ladder used throughout:

- **PROJECT-KILLER** — capture spec is the project's reason to exist (PROJECT.md "Core Value"). If this pitfall fires, uploaded bytes are training-grade-worthless; no amount of QA recovers them. ≥3 of these compounding will likely cap data quality below the training-pipeline bar.
- **QUALITY-DEGRADER** — recoverable with QA/backend re-runs but degrades pass rate, fleet trust, and user retention.
- **ANNOYANCE** — recoverable client-side or in support; doesn't threaten the core value.

---

## Critical Pitfalls

### Pitfall 1: HEVC encoder silently emits B-frames despite `KEY_LATENCY=1`

**Severity:** PROJECT-KILLER. Files never re-encoded (PROJECT.md Key Decisions); training pipeline expects exact bytes including frame ordering. A B-frame leak means the IMU↔video alignment methodology in §6.5 (least-squares fit on frame index) silently degrades because frame-presentation order ≠ encode order, and the per-frame drift methodology assumes monotonic correspondence.

**What goes wrong:**
`MediaFormat.KEY_LATENCY = 1` is a *hint* to the encoder, not a contract. On real devices we see three failure modes that all evade naive validation:

1. **MediaTek Dimensity 700/900/1080 + Helio class** (the Snapdragon-cheap-alternative SoC in many Xiaomi/Realme/Vivo ₹20–30K phones) — the OMX MTK encoder accepts `KEY_LATENCY=1` and `i-frame-interval=1` but intermittently produces single B-frames in the GOP under thermal pressure or when the encoder buffer fills. The MP4 plays fine in any player; the structural validator (`ffprobe -show_frames`) reveals it. This is the same SoC family that the linked AOSP issue #2711 documents as having intermittent HEVC pipeline regressions on Android 15.
2. **Snapdragon 7-series and below** — Qualcomm's `c2.qti.hevc.encoder` exposes `KEY_LATENCY` from Android 11+ but several OEM ROMs (Vivo FunTouch, Realme UI on Android 11/12) ship a vendor patch that re-enables a single B-frame to keep CBR rate-control stable when the bitrate-shaper underflows. You won't see this on Pixel.
3. **Exynos 1280/1380** (Samsung A-series mid-range, popular in Brazil) — accepts the flag but `KEY_BIT_RATE_MODE = BITRATE_MODE_CBR` interacts with the encoder's own scene-change detector. On rapid pan transitions (very common in egocentric kitchen/cleaning footage), the encoder switches to a transient VBR-like mode and emits a B-frame to recover, then switches back.

**Why it happens:**
KEY_LATENCY landed in Android 11 specifically for cloud-gaming decoders, not encoders; the AOSP "Low-latency decoding" doc (link below) is decoder-only. Encoder support was bolted on later by individual SoC vendors with no CTS test for B-frame absence. The Pixel 7a/10a development device class **does** honour it cleanly on Tensor G3/G5, which is why this hides at dev time.

**Prevention:**
Two layers:

1. **Compat-time:** during the §5.4 compat run, capture a 5-second test clip at the locked spec, write to disk, and structurally parse the H.265 NAL units with a hand-rolled scanner (or a bundled tiny `libhevc` parse). Verify zero B-slices (`slice_type == B_SLICE`). Block the device if any B-slice appears. This must be a real parse — not just metadata reads.
2. **Runtime:** include the same parse on the *first 30s* of every fresh recording (post-stop, pre-hash). If a B-slice is detected mid-recording, mark the metadata JSON `bframe_anomaly: true` and let the backend QA stage make the keep/discard call. Doing the parse pre-hash means the spec says "files NEVER re-encoded" still holds — we're observing, not modifying.

Empirical: target a 6-device test matrix beyond `testing-guide.md` §B.3 that *adds* (a) a Helio-class budget device (e.g. Redmi 13C 5G or Galaxy A15), (b) a Snapdragon 6/7 Gen mid-range (e.g. Galaxy A35, Moto G84), (c) an Exynos 1280/1380 Samsung. The current six-device matrix is heavy on flagships; B-frame leakage hides in the mid-range.

**Warning signs:**
- Drift `p99_ms` figures look fine but trend slowly upward over a 25-min sustained capture, then snap back.
- `ffprobe -show_frames` on a sample upload shows `pict_type=B`.
- Backend rehash matches but the training pipeline's frame-index sync stage flags drift > 1 ms.

**Phase to address:** Capture pipeline phase / device-compat phase. Block this *before* hand-gate or upload work — it determines whether captured bytes are usable.

---

### Pitfall 2: `SENSOR_INFO_TIMESTAMP_SOURCE != REALTIME` on a meaningful slice of the target fleet

**Severity:** PROJECT-KILLER for affected devices. ±1 ms alignment is impossible if the camera is on the `UNKNOWN` (monotonic) clock and the IMU is on `elapsedRealtimeNanos`, and the methodology in §6.5 silently produces nonsense drift figures.

**What goes wrong:**
Camera2 exposes `SENSOR_INFO_TIMESTAMP_SOURCE` with two values: `REALTIME` (== `elapsedRealtimeNanos`, what we want) and `UNKNOWN` (== `elapsedRealtimeNanos` *minus suspend time*, i.e. monotonic). On `UNKNOWN`-clock devices the camera and IMU timestamps drift apart by *seconds* every time the SoC enters any sleep state — including the brief drowsy state during heavy thermal recovery between auto-segment cuts.

**Why it happens:**
Even though `REALTIME` source has been in the API since Android 5.0, advertising it requires the camera HAL to literally hardware-stamp frames on the SoC realtime clock. Many MTK/Unisoc cheap-tier SoCs and some Exynos parts simply don't bother — they advertise `UNKNOWN` and the AOSP CTS doesn't fail them for it. The capture spec assumes 100% `REALTIME` availability, but it is not universal — published per-device data is sparse, and the `OpenCamera-Sensors` project explicitly lists this as a screening step because they hit the same problem.

The §5.4 compat check (per `idea-brief.md`) does test for `REALTIME`. The pitfall isn't in the spec — it's in *how we communicate failure to clan chiefs*. If 8% of the fleet fails this check, the chief network has 8% bricked-on-arrival devices and KGeN's word-of-mouth distribution narrative breaks before payouts ever start.

**Prevention:**
1. **Pre-distribution recon:** before APK rollout, ship a *standalone compat-only APK* (no recording, no auth, ~5 MB) to 50 chiefs and harvest the device-model + REALTIME availability data. Decide at that point whether to broaden the addressable device pool by accepting `UNKNOWN`-clock devices with a different sync methodology (cross-correlation of IMU peaks vs frame motion, not direct timestamping) — this is a v2 fallback, not MVP.
2. **Compat-fail UX:** the `engineering-handoff.md` §19 question "what happens after compat failure?" is currently undefined. For this specific failure mode, the language must not blame the user. "This phone's camera doesn't share a clock with its motion sensors. Try a different ₹30K+ phone." Anything more technical loses the chief. Explicit waitlist for a future v2 with cross-correlation sync.

**Warning signs:**
- Compat-check pass rate < 90% on first chief cohort.
- A bias in failures clustering on Helio P-series and Unisoc T-series chips (visible in compat-fail telemetry per device model).

**Phase to address:** Compat-check phase + chief-recon phase. This is a *distribution planning* gate, not just an engineering gate.

---

### Pitfall 3: IMU sustained 100 Hz drops under thermal load even when the spec advertises 500 Hz

**Severity:** PROJECT-KILLER if it fires during back-to-back 25-minute captures (PROJECT.md performance target). ±1 ms alignment requires sustained 100 Hz; the drift methodology weights p99, so a single thermal-induced drop to 60 Hz for 30 seconds tanks the segment.

**What goes wrong:**
Three distinct mechanisms compound:

1. **Sensor-batching hides the problem.** `SENSOR_DELAY_FASTEST` with `maxReportLatency > 0` allows the HAL to buffer events; the *delivered* sample rate as measured by event cadence in the listener can look fine while the *physical sampling* in the IMU has actually dropped. Compat checks that just count callbacks per second (per the `engineering-handoff.md` §5 hint at 700 ms) will *miss* this. AOSP docs confirm `maxReportLatency` decouples sampling from reporting.
2. **Multi-app sensor multiplexing.** If any other app (Google Fit, OEM step counter, screen-rotation listener — many OEM "intelligent" features do this) is also subscribed to the same sensor at a slower rate, the framework can decide to deliver at the *slower* requested rate when our app is backgrounded for the foreground service handoff. Documented in AOSP source.
3. **Thermal throttling at the sensor MCU level.** The IMU is on a separate sensor MCU on most phones (Pixel: AOC; Samsung: Sensor Hub). When SoC thermal headroom drops, the OS can request the sensor MCU to drop sample rate to save power. This is invisible from the application — it shows up only as fewer events in the listener. Tensor G3 has documented thermal throttling that affects this in the 15-minute window; G5 is better but not immune.

**Why it happens:**
The compat-check only proves the device *can* sustain 100 Hz over 30s with a preview running — but a recording running on a thermally-loaded SoC, plus an active foreground service notification, plus an active upload in another foreground service, plus the encoder, plus MediaPipe at gate time — that's a different load profile.

**Prevention:**
1. **Compat-check upgrade:** the §5.4 30s sustained sample must ALSO bind both sensors with `maxReportLatency = 0` (force no batching) AND verify the inter-sample interval p99 is ≤ 12 ms (i.e. ≤ 100 Hz floor, not just an average). This catches the batching mask.
2. **Runtime continuous monitoring:** during each recording, sample inter-arrival time of IMU events and emit a metadata field `imu_min_rate_hz_observed_p1` (1st percentile of observed rate). Reject the segment client-side if it drops below 80 Hz at any point — it's not training-grade and we'd rather discard than waste backend QA cycles. Surface in History as "Recording too noisy — discarded" (reuse the existing < 60s discard toast pattern).
3. **Aggressively unsubscribe other listeners.** On recording start, briefly unbind the rotation/orientation listener used for the landscape gate (we don't need it after lock). Every additional listener is a multiplexing risk.

**Warning signs:**
- Drift `p99_ms` rises in the second 10-minute auto-segment relative to the first.
- Telemetry: `compat_step_completed.measured` near 100–120 Hz, never higher (suspicious — a real Pixel 7a returns ~400+ Hz).
- Inter-sample interval p99 jumps mid-recording when the encoder kicks into thermal-recovery mode.

**Phase to address:** Capture pipeline phase. Compat-check phase needs the upgraded sustained test before chief rollout.

---

### Pitfall 4: HDR auto-engages on bright scenes despite `CONTROL_SCENE_MODE_DISABLED` — Pixel 8/9/10, Galaxy S/A 2024+

**Severity:** PROJECT-KILLER for affected segments. 8-bit Main HEVC profile is locked. If HDR engages, the encoder switches to 10-bit (or HDR10) and the file's color depth is wrong relative to metadata; backend rehash matches but the training pipeline rejects the color-space tag mismatch.

**What goes wrong:**
On Pixel 8+ and Galaxy S/A 2024+ models, "Ultra HDR" / "HDR Auto" is a system-level scene-mode override that engages whenever the HAL's exposure analysis detects sufficient dynamic range — *bright outdoor with sky* or *kitchen with window backlight*, both common in our task taxonomy. The Camera2 application setting `CONTROL_SCENE_MODE = DISABLED` does NOT disable this; only `CONTROL_SCENE_MODE_HDR` *or* the more recent `DynamicRangeProfiles` API does, and the latter is Android 13+ only.

**Why it happens:**
HDR is bolted onto Camera2 at multiple layers — `CONTROL_SCENE_MODE_HDR`, `EXTENSION_HDR`, `SET_TONE_MAP_*`, and now `DynamicRangeProfile`. Disabling all of them is an arms race; the OEM ships a new HDR mode each year. The Android 13 HDR video-capture doc explicitly says the HAL can preselect HDR if the app doesn't *positively* select SDR.

**Prevention:**
Set ALL of the following on every CaptureRequest:

```
CONTROL_SCENE_MODE = SCENE_MODE_DISABLED
CONTROL_AE_MODE = AE_MODE_ON  (not AE_MODE_ON_AUTO_FLASH or HDR variants)
CONTROL_AWB_MODE = AWB_MODE_AUTO
TONEMAP_MODE = TONEMAP_MODE_FAST or LINEAR (NOT HIGH_QUALITY which often implies HDR tone map)
COLOR_CORRECTION_MODE = TRANSFORM_MATRIX
```

And on Android 13+:

```
DynamicRangeProfile.STANDARD  (force 8-bit SDR)
```

And verify post-frame:
```
Result.SENSOR_DYNAMIC_BLACK_LEVEL  (not the HDR variant)
Result.STATISTICS_HDR_MODE  // some HALs surface this; check it
```

Also: at MediaCodec level, set `MediaFormat.KEY_PROFILE = HEVCProfileMain` (not Main10), and ASSERT the codec's reported output `KEY_PROFILE` actually returns Main. Some HALs silently substitute Main10 with 8-bit content padded — a compliance-but-wrong outcome.

**Warning signs:**
- File size diverges from the 8 Mbps × duration math by ~20%.
- Color tags in the MP4 box show `bt2020` or `arib-std-b67` instead of `bt709`.
- Visible "snap" in preview luminance when entering a bright kitchen — that's HDR engaging.

**Phase to address:** Capture pipeline phase. Add a *file-format validator* runner pre-hash that checks the MP4's color tags match the locked spec.

---

### Pitfall 5: OIS active despite `LENS_OPTICAL_STABILIZATION_MODE_OFF` — silent failure on Galaxy and OnePlus

**Severity:** QUALITY-DEGRADER. Spec requires stabilization OFF (idea-brief §2.1). OIS introduces motion that decouples camera from IMU at sub-frame timescales — the gyro reads "head moved 3°" but the camera frame shows ~0° because OIS counter-rotated the lens. This degrades vision-IMU correlation (the foundation of the deferred IMU liveness check in `imu-liveness-check.md` §4.5).

**What goes wrong:**
On Galaxy S22+ ultrawide modules, OnePlus 11 OxygenOS, and several Xiaomi devices, `LENS_OPTICAL_STABILIZATION_MODE = OFF` is accepted by the camera HAL but the OIS module continues running because the OEM's OIS driver lives below the HAL and doesn't always respect the API request. The XDA forum discussions document this on specific Galaxy and Xiaomi devices.

Crucially: the *ultrawide* camera on most of these devices has *no* OIS hardware (only the main wide module does), so this is **only a problem on devices where the ultrawide module specifies `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` includes any non-OFF value**. The §5.4 compat check should already reject ultrawide-with-OIS by reading this characteristic — but the compat check only reads the *advertised* set. The actual hardware behavior may differ.

**Why it happens:**
OEMs differentiate via "always-on OIS" branding for their main wide camera and the firmware-level decision to ignore app-level off requests. Ultrawide modules are usually OIS-free, so this is a smaller surface area — but Vivo X80+ class phones are starting to ship OIS on the ultrawide too.

**Prevention:**
1. Compat-check rejection: read `LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION` for the chosen ultrawide camera ID. If it advertises any value other than `[OFF]`, reject the device. Most ultrawide modules will satisfy this.
2. Where OIS is hardware-present and the device passes (rare for ultrawide), runtime check: read back `LENS_OPTICAL_STABILIZATION_MODE` from the CaptureResult on every Nth frame. If it ever returns ON despite the request, fail the segment client-side and emit `ois_anomaly: true`.
3. CONTROL_VIDEO_STABILIZATION_MODE = OFF is a separate setting (electronic stab) and per `idea-brief.md` §6.2 is also OFF — verify *both*.

**Warning signs:**
- Drift `p99_ms` exceeds 1 ms specifically when the user is walking (gait events on the IMU; OIS smoothing on the camera).
- `landscape_enforcement.mp4` reference: any "smoothness" of the recording while the rig is shaking is a smoking gun.

**Phase to address:** Compat-check phase + capture-pipeline phase.

---

### Pitfall 6: Foreground-service-from-background ban kills the upload-resume path on Android 14+

**Severity:** PROJECT-KILLER for upload reliability. Per `idea-brief.md` §7.4, the foreground service is supposed to "survive backgrounding and OS-evicted-from-memory." Android 14's behavior change makes this impossible without a workaround.

**What goes wrong:**
Per the AOSP "Foreground service types" docs and Android 14 changes:

1. After Android 14, an app **cannot start a `microphone` or `camera` foreground service while in the background** — even if it had one running and the OS killed it, the app must be brought to the foreground by the user before the service can be re-started.
2. After Android 15, `dataSync` foreground services are capped at **6 hours of running in any 24-hour window**. After that, the app must be brought to the foreground by the user. Heavy-uploader days (a chief recording back-to-back for 4 hours and queueing 30 GB of upload) blow past this in a few hours.
3. After Android 14, there's no grace period — apps that violate get an immediate `ForegroundServiceStartNotAllowedException`.

The capture spec uses `camera | microphone | dataSync` (PROJECT.md). The `camera` and `microphone` portions are ONLY needed during recording; the `dataSync` portion is what runs during background upload. So the lifecycle must be:
- Recording active → service type = `camera | microphone | dataSync`
- Recording stopped, upload running → service type = `dataSync` only
- App OS-evicted while only `dataSync` was running → on app-relaunch (cold start, user-initiated), service can resume — but this is no longer "automatic survival of OS eviction"

This means recordings made when the user backgrounds the app, then the OS kills it, then 6 hours pass, then the user opens the app — those uploads do still resume on next app open (per the §7.4 hint at "limited iOS, similar to Android"). What CANNOT happen on Android 14+ is uploading in the absolute background indefinitely without the user ever opening the app. The brief implies that's possible — it isn't on Android 14+.

**Why it happens:**
Android 14 and 15 are explicit responses to abuse: apps were declaring `dataSync` and using it to run forever. Google clamped down. There's no exemption short of `mediaPlayback` (we're not playing media) or `specialUse` (which Play Store reviews for exact match to the use case and crowdsourced ML data collection is borderline; unlikely to be approved without a written exception).

**Prevention:**
1. **Lifecycle the service-type dynamically:** start as `camera | microphone | dataSync` while recording, downgrade to `dataSync` only on stop, stop the service entirely if upload queue empties for > 5 minutes.
2. **Set realistic expectations in the §5.9 user-facing copy:** per `engineering-handoff.md` §13 say "Uploads run in the background while you have the app open from time to time" — not "uploads run forever." This is honest.
3. **Use WorkManager with constraints for the truly-background queue.** WorkManager (post-Android 14 properly typed) is the right tool for "upload when network/charge available, but you accept being deferred to maintenance windows." The current foreground service is the right tool for "upload right now, fast, while user is around." Layer them: while user is in app or 6 hours after, foreground service drains the queue; after that, WorkManager keeps it warm.
4. **Crucially: do NOT rely on the foreground service to get a recording's hash-verify event back to the client.** The whole `verified` event → delete-local handshake (§7.3) needs to survive a multi-day app-cold period. Use WorkManager with retry constraints, OR check on every app-foreground for pending-verify events from the backend.

**Warning signs:**
- Crashlytics reports `ForegroundServiceStartNotAllowedException` on real devices.
- Telemetry: `recordings.qa_status='verified'` events not delivered to client → users on aggressive battery-optimization OEMs see permanent "uploaded, awaiting verification" state.
- Pending-uploads tile shows growing-in-the-background queue that never drains because the service couldn't restart.

**Phase to address:** Upload pipeline phase. This restructures §7.4 fundamentally; do this as a foundational design call before building, not as a fix-up.

---

### Pitfall 7: OEM battery managers (MIUI/OxygenOS/FunTouch/OneUI) defeat the spec entirely on a non-trivial fraction of the target fleet

**Severity:** PROJECT-KILLER for OEM-affected users. Worth restating because the brief's §7.4 line "we request battery-optimization exemption at first upload" is *necessary but not sufficient* — none of these OEMs honour the standard Android battery-optimization API.

**What goes wrong:**
- **Xiaomi MIUI 13/14** (huge share in India, ₹15–25K segment): Even after the user grants `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, MIUI's own "Battery Saver" still kills foreground services. The dontkillmyapp.com Xiaomi entry documents this. The defeat path requires **three** user actions on the device: standard exemption, autostart toggle in Security Center, and dragging the app down in the recent-apps tray to "lock" it. **MIUI 14 introduces a fourth: "Background autostart" per-app toggle.** Each one is silent if not done.
- **Oppo/Realme ColorOS (heavy in India)** and **Vivo FunTouch (heavy in both India and Brazil)**: similar but distinct paths. Vivo's "iManager" has its own background-app whitelist that is independent of the Android battery-opt setting.
- **Samsung OneUI (huge share in Brazil)**: better than the Chinese OEMs but still has "Adaptive Battery" + "Sleeping Apps" + "Deep Sleep Apps" (three lists) that each can independently block the service.
- **OnePlus OxygenOS post-merger**: behaviorally equivalent to ColorOS now.
- The dontkillmyapp.com data plus our deferred-decisions.md note ("Xiaomi enables battery optimization again and again for apps after the app updates filters") confirm: even when the user grants exemption, *the OS may revert it* on app update.

**Why it happens:**
OEMs win battery-life benchmarks by killing background services. There's no commercial incentive for them to honour the AOSP API; only carrier/regulator pressure changes this, and that's slow. KGeN's clan-chief network is concentrated in price-conscious Indian/Brazilian segments — exactly where these OEMs dominate.

**Prevention:**
1. **In-app "OEM whitelisting walkthrough"** — at first upload, detect the manufacturer (`Build.MANUFACTURER`) and show a tailored guided sequence:
   - Xiaomi: open Security Center → Permissions → Autostart → enable Humyn; AND Battery → App battery saver → No restrictions; AND lock app in recents.
   - Oppo/Realme: Settings → Battery → Power Consumption Protection → Allow background activity.
   - Vivo: Settings → Battery → Background power consumption → Allow.
   - Samsung: Settings → Apps → Humyn → Battery → Unrestricted; AND Settings → Battery → Background usage limits → Never sleeping apps → add Humyn.
   - Stock Pixel: standard `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
2. **Re-prompt periodically** if uploads are stalling — detect upload-stalled-while-app-backgrounded by checking `WorkManager.getStatuses()` on every app foreground; if last successful chunk > 1 hour ago and queue non-empty, re-show the OEM-specific walkthrough.
3. **Communicate honestly to clan chiefs** that on aggressive-OEM devices, opening the app once per day is part of how it works. This must NOT be hidden behind "Pending uploads" tile copy that only says counts — add a small `Last synced 4h ago` timestamp.

The current PROJECT.md already mentions battery-opt exemption at first upload. The pitfall is that this single exemption is **insufficient on every Chinese OEM**.

**Warning signs:**
- Crashlytics + analytics: `recording_uploaded` count substantially lower than `recording_stopped` (≥ 60s) count, clustered by Build.MANUFACTURER.
- Support tickets clustered around "uploads stuck."

**Phase to address:** Upload pipeline phase + onboarding phase. The OEM walkthrough is itself a roadmap line item.

---

### Pitfall 8: MediaPipe HandLandmarker false-negatives on Fitzpatrick V/VI under warm-low-light conditions

**Severity:** QUALITY-DEGRADER, but with **discriminatory impact** that could become a PROJECT-KILLER on chief-network-trust grounds. Skin-tone bias in hand detection is well-documented in the broader literature (e.g. NIST FRVT for face); MediaPipe's hand model has not been independently audited for it but published reports of degradation on darker skin under uncontrolled lighting are consistent with the broader pattern (`deferred-decisions.md` already flagged this for the deferred Variant B).

**What goes wrong:**
The one-shot pre-record gate (`idea-brief.md` §5.8) requires 5 consecutive 2-hand detections (Android × 400 ms cadence). On users with Fitzpatrick V/VI under typical Indian-kitchen warm-bulb (2700K) low-lux conditions, the gate accumulator never advances, the user taps Skip every recording, and they get a quiet but persistent message that the app's defaults aren't tuned for them. Even if Skip is silent and friction-free, the relative-friction differential discriminates.

**Specific failure modes on top of skin tone:**
- Cooking gloves (hands look textured/non-palm-like) — model false-negative.
- Henna/mehndi — alters palm texture; model is trained on bare skin.
- Bandages — false-negative.
- Wet hands fresh from dishwashing (specular highlights) — false-negative.
- Hand resting on stove, oven, kettle (hot surface near hand) — *false-positive* in some lighting (the warm rim looks hand-like to the model). This means the gate can pass on a stove-pointed phone with no hands.
- Rubber kitchen gloves of certain colors — false-negative.

**Why it happens:**
MediaPipe's hand_landmarker.task model was trained on ~30k images (Google's published spec) without a detailed Fitzpatrick distribution. Performance under low-lux + warm color temperature + V/VI is the worst case in the broader hand-detection literature. Confidence threshold of 0.5 (per spec) is the default — it could be tuned per-platform, per-device-class via Remote Config (`engineering-handoff.md` §19 Q12).

**Prevention:**
1. **Make Skip silently first-class.** Already done in the spec — confirm the Skip link is visible from t=0 with no friction. The pitfall is making the *Skip rate* a leading indicator of bias, not a thing-we-feel-okay-about.
2. **Per-population confidence tuning via Remote Config.** Instrument `recording_gate_skipped` with a coarse skin-tone signal (do NOT log image data — that's PII; instead log the average frame Y-channel luminance at gate start, which correlates with both ambient brightness AND skin tone in a way that lets us tune without identifying users). Track Skip-rate by device-locale (`en-IN` vs `pt-BR`) as a coarse proxy. If Skip rate > 30% in either locale, lower `minHandDetectionConfidence` from 0.5 to 0.3 via Remote Config — possibly all the way to 0.1, since the gate is one-shot pre-record and even a few false-positives are tolerable (they just let the user start sooner; they don't introduce data quality issues).
3. **Add a flashlight nudge.** If gate has been at counter=0 for > 4 seconds, show a small "Try better lighting?" link below the prompt. Optional — don't gate this on it.
4. **Don't ship the false-positive-on-stove problem.** Since users can Skip, false-positives only matter if they let users start a recording without intent — and that's fine, the recording is still real. The bigger risk: false-positives during the deferred Variant B continuous detection. Out of MVP scope but flagged for v2.
5. **Surface the reality in `help-center-content.md` Troubleshooting:** "If hand detection isn't picking you up, tap Skip — it doesn't affect your earnings."

**Warning signs:**
- `recording_gate_skipped` > 20% rate in any locale.
- Bias of skip-rate by device manufacturer (correlates with target-population).
- Support tickets about "the camera doesn't see my hands."

**Phase to address:** Hand-gate phase + observability phase (telemetry instrumentation must support tuning).

---

### Pitfall 9: `Camera.takePhoto()` warm-up latency on first call leaves the gate ring stuck at 0 for 2–4 seconds

**Severity:** QUALITY-DEGRADER. The hand-gate uses VisionCamera's `takePhoto()` per cadence (400 ms Android, 600 ms iOS) — `engineering-handoff.md` §19 Q13 already flags the takePhoto-vs-frame-processor tradeoff but doesn't quantify the warm-up.

**What goes wrong:**
On VisionCamera 4.x, the first `takePhoto()` call after camera initialization can take 1–4 seconds depending on device. While `gate.loading` state shows the spinner, the gate's accumulator can't advance because no image has been delivered yet. Users see a stuck progress ring. Two compounding issues from VisionCamera issue tracker:

1. takePhoto on Android can hang if called before `onInitialized` fires (issue #2020).
2. Even after onInitialized, the *first* photo capture incurs the camera-pipeline warm-up that subsequent calls don't (issue #1157, #1585).

**Why it happens:**
takePhoto sets up a still-capture pipeline that is separate from the preview pipeline; the first call has to allocate and configure the JPEG encoder buffers. Subsequent calls reuse them.

**Prevention:**
1. **Pre-warm the photo pipeline.** As soon as the recording screen mounts and the camera is ready (post-rotation lock, before the user taps record), fire one throwaway `takePhoto()` and discard the result. Cost: ~one bitmap allocation, ~3 MB peak memory for ~200 ms. Saves the user 2–4 seconds of stuck progress on every gate.
2. **Switch to a frame-processor plugin** for the gate (the §19 Q13 alternative). Frame processor reads frames continuously from the preview stream — there is no per-call warm-up because the stream is already running. Trade-off: more code surface, frame-processor lifecycle interaction with the new architecture has its own bugs (VisionCamera issues #2614, #1554, #1821).
3. **Show a faster spinner with progress.** The current `gate.loading` state uses an indeterminate spinner. Switch to an "almost-determinate" spinner that animates faster initially so the user perceives progress.
4. **Validate `onInitialized` is fired.** Per VisionCamera docs all camera functions are available *immediately after* onInitialized — but this is *after* you've called and waited for it. Bind takePhoto behind an `await onInitialized` promise; the spec already does this (§5.8 "Loading state if camera not ready"), confirm in implementation.

**Warning signs:**
- `recording_gate_started → recording_gate_passed` median duration > 4 seconds (the gate target is 2 seconds wall clock per the spec). On a Pixel 7a-class device the gate should pass in 2.0–2.4 seconds; if median is > 3.5 seconds, takePhoto warm-up is likely the cause.
- Bitmap memory in the Profiler spikes to 30+ MB on first takePhoto call (suggests full-res photo, not the small one we expect).

**Phase to address:** Hand-gate phase.

---

### Pitfall 10: Bitmap memory pressure if `takePhoto` returns full-resolution photo (12 MP × 4 = 48 MB allocation)

**Severity:** QUALITY-DEGRADER. App OOM on lower-end ₹30K phones (4–6 GB RAM) is a hard kill of the recording session. The hand-gate's `HandDetector.detectHands(path)` decodes a bitmap.

**What goes wrong:**
VisionCamera's takePhoto by default returns the camera sensor's full resolution — on a 12 MP ultrawide that's 4032×3024 = ~12 million pixels × 4 bytes ARGB = ~48 MB per bitmap. Passing the path to `HandDetector.detectHands()` triggers `BitmapFactory.decodeFile(path)` — another 48 MB allocation. Multiply by gate cadence and you can be allocating 240 MB/second of bitmap memory if the gate is held for 5 seconds.

The brief sets `engineering-handoff.md` §12 budget: keep recording session under 200 MB peak. The hand-gate runs *before* recording, but the camera + preview + gate combined can push past 300 MB on devices that need it kept under 250 MB.

**Why it happens:**
takePhoto's `enableShutterSound` and resolution are configurable but not always set. If the native Kotlin `HandDetector` module decodes via `BitmapFactory.decodeFile()` without `inSampleSize` or `inPreferredConfig = RGB_565`, you get the worst case.

**Prevention:**
1. **Configure takePhoto to a small resolution.** Set `photoResolution: { width: 320, height: 240 }` or smaller — MediaPipe Hand Landmarker works fine on tiny images for binary detection. The spec doesn't pin this; pin it in the native module.
2. **In the native HandDetector module (Kotlin):** decode with `BitmapFactory.Options.inSampleSize = 4` (or larger) and `inPreferredConfig = RGB_565` (half the memory of ARGB_8888).
3. **Recycle bitmaps explicitly.** After MediaPipe returns the count, call `bitmap.recycle()`. The JS GC will not reclaim native bitmap memory in time — call `recycle()` from Kotlin.
4. **Profile peak memory** during the gate at the device matrix's lowest-RAM device (the deferred-decisions.md compat-policy concern about "phones that pass §5.4 but fail palm-detector NNAPI/GPU" is related; budget memory same way).

**Warning signs:**
- Crashlytics OOM crashes scoped to the gate state.
- Native heap > 200 MB during gate (visible in Profiler).
- Background memory pressure visible during gate (Pixel 8 dropping app in recent-apps tray after gate exit on RAM-pressured devices).

**Phase to address:** Hand-gate phase.

---

### Pitfall 11: MediaMuxer fragmented MP4 + audio + video occasionally throws `IllegalStateException` mid-recording (Android tracker bug #1781)

**Severity:** PROJECT-KILLER for affected segments. The whole §6.6 mid-recording resilience story (faststart / fragmented MP4 / 30s flush) breaks if the muxer crashes 30–60 seconds into a recording.

**What goes wrong:**
Per `androidx/media` issue #1781: `Mp4Muxer` and `FragmentedMp4Muxer` can throw an `IllegalStateException` between 30 and 60 seconds into a multi-track (video + audio) recording, due to an assertion in `MP4Writer.java` / `FragmentedMp4Writer.java`. The ETag mismatches between the video and audio sample-table writes when track timestamps drift; the writer asserts and crashes.

The brief assumes fragmented MP4 is the canonical resilience strategy. If the muxer crashes, the entire foreground service is taken down with the assertion — the recording is lost. The 0.5s gap between auto-segments and `idea-brief.md` §5.8 doesn't help if segment 1 itself crashes.

**Why it happens:**
This is a real bug in androidx-media's muxer (the MediaPipe-recommended muxer rather than AOSP's MediaMuxer directly). Vendors and apps that use `MediaMuxer` directly are still subject to occasional similar bugs, but androidx-media issue #1781 is concrete and unpatched as of the most recent versions.

**Prevention:**
1. **Use AOSP's `MediaMuxer` directly, not androidx-media's `FragmentedMp4Muxer`.** AOSP's MediaMuxer's fragmented mode (`MediaMuxer(path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)` plus periodic-restart, OR explicit fragmented-mode if available on the API level) is more boring and more battle-tested than androidx-media's wrapper.
2. **Wrap muxer calls in try/catch and on `IllegalStateException`, pivot to fallback path:** finalize the current MP4 with what we have, mark `muxer_anomaly: true` in metadata, start a new MP4 immediately. The < 60s discard rule (§5.8) handles segments that die early. Segments ≥ 60s get uploaded with the anomaly flag.
3. **Keep the periodic 30s `moov` flush** — if the muxer crashes between flushes, we still recover up to the last flush.
4. **Stress test this exact failure mode** on the device matrix: record continuous for 90 seconds × 20 trials per device, count IllegalStateException occurrences. Pre-rollout gate.

**Warning signs:**
- Crashlytics: `IllegalStateException` in MediaMuxer.writeSampleData stack frames.
- Recordings that end at exactly 35–55 seconds with no user action — clustering means the muxer's hitting it.
- `recording_stopped.reason='unknown'` in telemetry.

**Phase to address:** Capture pipeline phase.

---

### Pitfall 12: Per-upload cellular MTU drops on Jio + Vivo Brasil cause TLS multipart PUTs to silently retry-storm

**Severity:** QUALITY-DEGRADER. PROJECT.md's §14 day-0 ingest target is 500–1000 hours/day. If 30% of uploads stall mid-chunk on cellular MTU issues, ingest is well below target.

**What goes wrong:**
LTE links MTU 1428 (per RFC and observed); 5G can be 1380. CGNAT'd cellular paths (Jio's everything-on-CGNAT, Airtel's similar approach in low-tier zones, Vivo Brasil's similar setup) further reduce effective MTU because CGNAT NAT44 traversal eats option-room. When our 8 MB chunked PUTs hit a path with a smaller MTU than what the client/server negotiated, the kernel either fragments (slow, reorder-prone) or drops with no ICMP back (carrier blocks ICMP) — *blackholing*.

The Medium piece on Jio vs TCP shows this empirically: instead of clean ICMP-back errors, we see "duplicate TCP ACKs and TCP Out-of-Order packets" — the upload looks like it's retrying within the TCP layer but actually progress stalls. The TLS multipart PUT keeps retrying chunks with exponential backoff (per §7.1's 2/4/8/16/32/64s schedule) and burns hours making progress.

**Why it happens:**
Mobile carriers don't standardize MTU; CGNAT eats overhead unpredictably; the OS network stack does PMTUD but ICMP fragmentation-needed responses are rate-limited or blocked by mobile carriers; a 1500-byte assumption from the app layer is wrong.

**Prevention:**
1. **MSS clamping at the client.** Set socket option `TCP_MAXSEG = 1280` on the upload connection (Java `SocketOptions.IP_TOS` proxy or use `OkHttp`'s socket factory). 1280 is below all cellular MTUs and still leaves comfortable headroom.
2. **Smaller chunk size on cellular.** Detect connection type (`ConnectivityManager.NetworkCapabilities.TRANSPORT_CELLULAR`); use 2 MB chunks on cellular instead of 8 MB. Smaller chunks mean a stalled chunk is 4× cheaper to retry.
3. **HTTP/2 server push not relevant; HTTP/3 (QUIC over UDP) might help** — UDP with PMTUD is more graceful, but S3 doesn't speak HTTP/3 to clients yet (it's HTTP/2). Skip this.
4. **Detect long-stalls and back off harder.** If a single chunk has had no bytes-acknowledged progress in 30 seconds, abandon it and retry with a fresh socket. The current backoff schedule retries the chunk after 2/4/8s; if the socket itself is wedged (MTU blackhole), no amount of retry-on-the-same-socket helps.
5. **Re-test against PMTU blackhole conditions:** in the testing-guide.md §B.3.6 network conditions expansion, add a "cellular blackhole" scenario — set the local NIC MTU to 1300, the route to S3 via that NIC, and verify upload completes without retry-storm.

**Warning signs:**
- Telemetry: `upload_chunk_failed` clustering on cellular network type (already in the testing-guide watch list — confirms this is on the radar).
- Telemetry: chunk retry count > 3 on cellular but rare on Wi-Fi.
- Chunks completing fine on Pixel + Jio Wi-Fi but failing on Pixel + Jio cellular when path goes through CGNAT.

**Phase to address:** Upload pipeline phase. Field testing in India + Brazil specifically.

---

### Pitfall 13: TV-replay attack against the on-device hand-gate is trivial; IMU liveness deferral leaves a real fraud hole

**Severity:** PROJECT-KILLER as a *business-model* pitfall, not a code pitfall. Paid-per-QA-pass means fraudsters have direct financial incentive. Without the deferred IMU liveness check (per `imu-liveness-check.md` §3), the on-device hand-gate alone is defeated by:

- Phone propped on tripod pointing at a TV/laptop showing a real recording (TV shows real hands; gate passes; whole 10 min is fake).
- Phone strapped to a stationary mount with a glove on the lens; gate passes by accident or by Skip; recording is meaningless.

`imu-liveness-check.md` already covers this — but the doc says "deferred to v2." Combined with Play Integrity at sign-in only (no per-upload attestation, also deferred), the *first day* of payouts has zero serious fraud detection beyond rooted-device rejection.

**Why it happens:**
The brief's risk profile assumed (a) no one will pay $X to operate a phone-bank to scam $Y in early payouts because Y is small, and (b) clan chiefs will exert social pressure against fraud. (a) is sound until payouts go live and aren't capped; (b) is only true if the chief network's incentives are aligned, which they aren't for a chief whose clan is fully online and behind a NAT.

**Prevention:**
1. **Promote IMU liveness checks (cheap subset 4.1 + 4.5 from `imu-liveness-check.md` §7) into MVP backend scope.** Zero on-device cost, zero capture-spec changes. The doc's own §9 says "promote IMU liveness from deferred to MVP-or-near-MVP" — heed it.
2. **Lock payouts behind a manual-QA gate for the first ~6 weeks of operation.** Flatly: do not pay for anything that hasn't been hand-reviewed at first. PROJECT.md already says "payouts run offline" — keep them offline AND keep them manual until the data ingest is calibrated.
3. **Pre-payout fraud monitoring dashboard (backend-only, not user-visible).** Track per-account: same-task-recorded-N-times, all-recordings-from-same-IP, zero-IMU-variance segments, walking-tasks-with-no-gait. None of these block uploads at MVP, but they feed the QA queue.
4. **Refuse account-on-account-bind payments** until per-upload attestation is added (deferred). The single-account-per-device rule at MVP is enforced by Play Integrity at sign-in only — the same Google account on N devices will produce N independent uploads. Compute account-level upload rates and reject after a per-account daily cap (e.g. > 4 hours of uploaded content per account per day is highly suspicious for a single human).

**Warning signs:**
- `recording.contributor_info.email` repeats across many recordings + `capture_device_info.model` differs (account roaming).
- Many recordings with `imu_video_drift_p99_ms` near zero AND `gyro_rms` near zero — phone propped, not head-mounted.
- High volume from a small set of IP /24 ranges.

**Phase to address:** Backend/QA phase. Treat as "MVP-must-have for backend even though deferred for app." Re-promote IMU liveness from deferred-decisions.md.

---

### Pitfall 14: Bystander consent under DPDP (India) and LGPD (Brazil) — uploader-attests model is fragile

**Severity:** QUALITY-DEGRADER for legal/compliance, can become a PROJECT-KILLER if a regulator opens enforcement during MVP. `strategic-suggestions.md` §4 already flagged this for v2; it remains under-addressed for MVP.

**What goes wrong:**
The current `idea-brief.md` §5.2 consent text has the *uploader* attest "no one being recorded is a minor" and "I have the necessary permissions to share this content." This is a passable v1 stance but:

- **DPDP (India)** § 7-8 require purpose-limited consent that is "free, specific, informed, unconditional and unambiguous" from the data principal — i.e. each recorded person, not the uploader on their behalf. Children (< 18) require explicit parental consent. The uploader attesting on behalf of the household passes a face check but not a deep audit.
- **LGPD (Brazil)** Art. 8 similar — and processing of "sensitive personal data" (which arguably includes biometric video of identifiable individuals) requires an explicit lawful basis.
- **Egocentric video naturally captures bystanders** — in cooking/dishwashing/cleaning tasks, family members walk through the frame. They are non-consenting data subjects.

The brief flags "minors not permitted; enforced via Terms only" as the position. Neither DPDP nor LGPD treats Terms as a substitute for collected consent.

**Why it happens:**
Crowdsourced data collection at scale historically (Ego4D, etc.) sidesteps this by recruiting consented teams and doing on-site shoots, not by enrolling random users. We're enrolling random users at scale — the legal exposure is greater than the academic prior art.

**Prevention:**
1. **MVP-acceptable hardening:**
   - Tighten the §5.2 consent text to specifically enumerate "you are responsible for ensuring no person enters the camera frame without their consent."
   - Add a recording-time visible reminder (during gate or as a top toast on first recording per session): "Make sure anyone who walks into your frame has agreed to be recorded." (Not in the current spec.)
   - Log per-recording an explicit "no minors visible" attestation that travels with the metadata JSON.
2. **Legal-engagement (must, before broader Brazil rollout):** retain Indian counsel for DPDP and Brazilian counsel for LGPD before Play Store launch. Pre-validate the consent text translation and the data-subject-rights handling (right-to-deletion, right-to-portability — neither is in the brief's v1 scope).
3. **Add a `bystanders_disclosed: bool` field** to the `task-request` form for tasks the user submits, AND a backend-side per-task review for "is this likely to involve bystanders?" — high-risk tasks (Pet Care if children play with pets; Dishwashing if children help) flagged for additional QA review.
4. **Document the ANPD (Brazil) and DPB (India) takedown response procedure now**, even if not exercised. Both regulators can issue a takedown notice for a specific data subject; the deletion path needs to be operational on day one.

**Warning signs:**
- Any takedown notice from DPB or ANPD.
- Account-deletion requests citing "I didn't know I was being recorded" — bystander complaint.
- Press attention to data-subject-rights handling.

**Phase to address:** Foundation/legal phase. Cannot ship to production without legal review.

---

### Pitfall 15: Hash-verify-and-delete failure modes — race between backend `verified` event and client receiving it

**Severity:** QUALITY-DEGRADER. PROJECT.md Key Decision: "Local file deletion gated on backend `verified` event." If the verified event is dropped (network partition, app uninstalled+reinstalled, account roaming) the local storage fills with verified-but-not-deleted files indefinitely.

**What goes wrong:**
The current spec (§7.3) doesn't specify the *transport* for the `verified` event. Three plausible options each have failure modes:

1. **Long-poll on app foreground.** Client polls `GET /recordings/{id}` on every app open. Failure mode: user records 50 segments, never opens app for 3 weeks, local storage fills (2 GB / 10 min × 50 = 100 GB; phone fails first). Storage-full pre-record check (§5.4) prevents new recordings but doesn't recover old.
2. **WebSocket / push.** Not in MVP scope (no FCM/APNs per brief).
3. **Piggyback on next API call.** Client gets pending `verified` events as part of `GET /recordings` responses. Failure mode: app uninstalled+reinstalled — pending verifies never delivered to the new install; local files (if backed up to Google Photos cache or similar) are forgotten on the new install but storage on the new install is fresh.

**Why it happens:**
The brief locks "no notifications" channel which removes the cleanest delivery mechanism (a silent FCM data-only push to trigger client-side cleanup). The remaining mechanisms are all polling.

**Prevention:**
1. **Always include "verified events to-process" payload on every API call response.** Bake it into the standard error envelope or a top-level field. Every API call refreshes the client's verified-event log.
2. **On app launch, sweep for verified-not-deleted files.** Maintain a small SQLite (or scoped storage manifest) of known recordings; on launch, query the backend for a digest of `verified` events (e.g. `GET /recordings?status=verified&since={last-known-id}`); reconcile.
3. **Don't trust local-storage manifest exclusively** — also walk the recordings directory and reconcile with backend's known list. If the manifest got corrupted (Android's app-data can get corrupted by FBE issues), the file scan recovers.
4. **Cap the local-storage burden.** Per-recording is ~1.2 GB at 10 min × 8 Mbps. If local recordings exceed N GB AND the backend has marked all of them verified AND we still haven't deleted (because the client never got the events), surface an "Open the app on Wi-Fi to clean up storage" tile on Home.
5. **Telemetry to detect this:** track time-from-`verified`-event to client-side-delete. If the p99 of this across the fleet is > 24 hours, the delivery mechanism is broken.

**Warning signs:**
- Pending uploads tile not refreshing.
- Storage warning toasts (per §5.4 < 5 GB) firing on devices with otherwise OK behavior.
- Backend storage growing faster than client-deletion telemetry would predict (server has the file, client should have deleted, client hasn't).

**Phase to address:** Backend phase + client storage phase.

---

### Pitfall 16: Storage cost math at 1M hours assumes Glacier; payout-window math doesn't survive S3 Standard

**Severity:** QUALITY-DEGRADER. PROJECT.md's stated goal is 1M hours; backend infra cost determines whether payouts can scale.

**What goes wrong:**
At 8 Mbps × 1M hours = 8 × 10⁶ Mb × 3600s = 2.88 × 10¹⁰ Mb = 3.6 × 10¹⁰ MB / 1024 = ~3.5 × 10⁷ GB = 35 PB.

S3 pricing (as of 2026):
- **S3 Standard:** $0.023 / GB / month → 35 PB × 1000 GB/TB × 1024 TB/PB × $0.023 = **~$823K / month** = $9.9M / year.
- **S3 Glacier Instant Retrieval:** $0.004 / GB / month → ~$143K / month = $1.7M / year.
- **S3 Glacier Deep Archive:** $0.00099 / GB / month → ~$35K / month = $420K / year.

The §7 spec says "files NEVER decoded / re-encoded / transcoded / stripped" — so we have full byte-perfect storage of every accepted segment. If we keep everything on S3 Standard for "fresh access," we hit $10M/year storage just for the cap. If we tier aggressively to Glacier within 30 days of QA, the cap is more like $1–2M/year.

**Why it happens:**
The brief implicitly assumes "S3 cost is OK" without doing the multiplied math at 1M hours. At MVP (Day-0: 500–1000 hours/day) the cost is a few hundred $/month — totally fine. But the *whole point* is 1M hours, and the runway must support that without forcing a re-architecture.

**Prevention:**
1. **Backend lifecycle policy: tier accepted segments to Glacier Instant Retrieval at +7 days, Deep Archive at +90 days.** S3 Lifecycle rules — straightforward to set up. Training pipeline gets sub-hour latency from Instant Retrieval; long-tail data sits in Deep Archive.
2. **Reject (and immediately delete) any segment that fails IMU liveness or hash-verify.** Don't pay for storing fraud bytes.
3. **Budget separately for retrieval costs** — Glacier IR retrieval is ~$0.01/GB; if training pulls 10% of stored data per quarter, retrieval at 1M-hour scale is meaningful (~$35K/quarter at IR).
4. **Choose region aggressively.** ap-south-1 (Mumbai) is ~10% cheaper than us-east-1 for storage; locating compute near data also reduces egress. Egress to *training compute* (probably us-east-1 H100 clusters or similar) is a non-trivial line item — $0.09/GB → at 35 PB × 0.09 = $3.2M one-time IF you ever move it all. In practice training pulls subsets, but the worst case is large.
5. **Implicit assumption to verify with the team:** is 1M hours a true target or aspirational? If the real plan is 100K hours in MVP year, the cost story is 1/10th and we don't need aggressive tiering.

**Warning signs:**
- Monthly S3 bill growing faster than ingest hours growing.
- Backend cost > 30% of payout outflow.
- Ops team paging on bucket-size growth before engineering team has lifecycle rules deployed.

**Phase to address:** Backend infra phase. Day 0 lifecycle rules on the bucket.

---

### Pitfall 17: Tensor G3 vs Tensor G5 thermal divergence — Pixel 7a is *not* a "good enough" stand-in for Pixel 10a-class devices

**Severity:** QUALITY-DEGRADER for development workflow. The brief says "Pixel 7a-class is the perf benchmark; Pixel 10a is the primary dev device" but Tensor G3 (Pixel 8/8a/9) and Tensor G5 (Pixel 10/10a) have notably different thermal behavior.

**What goes wrong:**
Per published reviews:
- Tensor G3 (Pixel 8/8a, 7a is G2) throttles aggressively under sustained load — at ~32°C battery temp, primary core drops to 1.9 GHz and performance cores to 1.4 GHz. 60% throttle in the 15-min CPU stress test.
- Tensor G5 (Pixel 10) maintains working temperature better; reviews credit it with significantly cooler sustained performance.
- Pixel 7a is **Tensor G2**, still the brief's perf benchmark; G2's thermal profile is closer to G3 than G5.

If development happens on Pixel 10a (G5) but the brief targets Pixel 7a (G2), the dev device is *better* than the perf benchmark and thermal cut-outs hide. Any "it works on dev" assertion needs the §B.3.7 thermal-kill stress test on Pixel 7a or Pixel 8a — neither of which is currently in the testing-guide six-device matrix as the *thermal* stress device.

**Why it happens:**
Pixel naming conventions move quickly; "Pixel 7a-class" was set early in the brief's history when Pixel 7a was a current device. By the time the app ships (~MVP target), Pixel 7a is end-of-life and Pixel 10a is mainstream. The G3 vs G5 thermal divergence didn't exist when Pixel 7a was the benchmark.

**Prevention:**
1. **Explicit thermal stress device in the matrix:** add a Pixel 8a or Pixel 9 (Tensor G3) to the testing-guide §B.3 device matrix specifically *for thermal stress*. This is the actual ₹30K-class Pixel.
2. **Add the §B.3.2 25-min sustained capture test on Pixel 8a, not just Pixel 10a.** PROJECT.md says "Pixel 7a-class" but Pixel 7a's resolution and FOV are closer to Pixel 8a than to 10a; ensure the rebuild on the matrix is current.
3. **Don't accept Pixel 10a passing the thermal test as proof Pixel 7a/8a will pass it.** Run the test on the actual benchmark device.
4. **Fleet thermal monitoring telemetry:** track `recording_alert.type='thermal'` and `recording_stopped.reason='thermal'` clustered by `Build.MODEL`; the trend tells us where the floor is on the actual fleet, not on dev devices.

**Warning signs:**
- `recording_alert.type='thermal'` rate > 5% on any device class.
- `recording_stopped.reason='thermal'` clustered on G3-class Pixels but absent on G5-class.
- Pixel 8a sustained 25-min test fails where Pixel 10a passes.

**Phase to address:** Testing phase. Update testing-guide §B.3 device matrix.

---

## Technical Debt Patterns

Shortcuts that look reasonable but bite in this specific app.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Build.MANUFACTURER detection for OEM walkthrough | One UI surface | Misses sub-brand variants (Redmi vs Mi, Realme vs Oppo, OnePlus vs Oppo post-merger) | Early MVP only; revisit with telemetry data showing skip-rate per actual OEM |
| Trusting MediaCodec's reported OUTPUT_FORMAT_CHANGED to mean the encoder honours config | Saves work | B-frame leakage, HDR engagement, OIS engagement all hide behind "format reported correct" | NEVER — always verify with NAL-unit parse on a sample clip |
| Letting takePhoto return full-res photos to MediaPipe | Less native code | Bitmap memory pressure → OOM on 4 GB devices | Never; pin photo resolution at 320×240 for the gate |
| Treating compat-check as "does this device *advertise* the feature" | Quick to ship | Vendors lie in CameraCharacteristics; OIS / REALTIME / sustained-IMU all sometimes-advertised-sometimes-true | Never — every compat check must verify behavior, not metadata |
| Using FragmentedMp4Muxer (androidx-media) over AOSP MediaMuxer | Slightly more idiomatic for chunked writes | Active bug #1781; muxer crashes mid-recording | Never on this app; use AOSP MediaMuxer with explicit fragmented mode |
| Re-encoding an MP4 to add faststart / fragmented MP4 / strip metadata | "Cleans up" the file | Violates the locked "files NEVER re-encoded" PROJECT decision; training pipeline rejects | Never — flush early/often instead, and pick muxer settings up front |
| Storing all uploads on S3 Standard for "freshness" | Simplifies retrieval | $10M/year at 1M hours; payout economics break | Never at full scale; lifecycle policy from day 0 |
| Trusting REQUEST_IGNORE_BATTERY_OPTIMIZATIONS as the only OEM-bypass | Minimal code | Defeated by every Chinese OEM | Never; always pair with OEM-specific walkthrough |
| Polling for `verified` events only when user opens the app | Simple to ship | Storage fills on long-disuse | Acceptable if we explicitly cap local storage and force a "clean up" path |
| Logging full hand-detection confidence values for debugging | Easy to debug | Inferring user demographics from confidence patterns is a privacy leak | Acceptable in dev builds; strip in production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Camera2 | Setting CONTROL_SCENE_MODE = HDR explicitly to "force off" | Set CONTROL_SCENE_MODE = SCENE_MODE_DISABLED (different value); also set DynamicRangeProfile = STANDARD on Android 13+ |
| MediaPipe HandLandmarker | Loading hand_landmarker.task on every gate invocation | Load once at app start; reuse the HandLandmarker instance; runs much faster |
| SensorManager | Trusting the requested sample rate as the actual sample rate | Always measure inter-sample interval p99 and reject below floor |
| Play Integrity (classic) | Single-attempt at sign-in, fail = block | Retry with exponential backoff on `NETWORK_ERROR` (per AOSP docs); allow 24h grace if Integrity is degraded for the user's network |
| Play Integrity (standard) | Mistakenly using classic when standard is intended | Standard requires server-side decryption + Play setup; classic is short-lived nonces. Confirm which is in use |
| Google Sign-In via play-services-auth | Continuing to ship the deprecated com.google.android.gms:play-services-auth | Migrate to Credential Manager (Jetpack androidx.credentials); Google deprecated old SDK in 2024 with removal in 2025 (already past in 2026) |
| URLSession background config (iOS) | Setting `waitsForConnectivity = true` | Background sessions always wait for connectivity; setting it does nothing. The real gotcha is force-quit produces NSURLErrorBackgroundTaskCancelledReasonUserForceQuitApplication; surface this in §5.9 onboarding copy |
| Firebase Crashlytics + RN | Not symbolicating Hermes JS stack traces | Upload Hermes source maps; without them, crashes show as `0x10dec...` not function names |
| AAC-LC encoder | Setting AudioRecord MediaRecorder.AudioSource.MIC | Use AudioSource.UNPROCESSED on supported devices to bypass AGC; fall back to MIC where unsupported |
| WorkManager + foreground service | Double-running both for the same upload | Use foreground service while app is hot; WorkManager only when foreground service stops; coordinate via shared state |
| MediaMuxer (AOSP) | Passing `MUXER_OUTPUT_MPEG_4` and assuming faststart | MediaMuxer writes moov *at end* by default; need explicit periodic fragmentation. AOSP does not have a one-flag faststart mode |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| MediaCodec input buffer pool not pre-allocated | Frame drops in the first 2 seconds of recording | Pre-allocate via `createInputSurface()` at ready-state; don't wait for record-tap | Always — visible from segment 1 |
| MediaPipe model allocated per gate invocation | Gate takes 3+ seconds extra on cold path | Singleton HandLandmarker; lazy-init at app start | Always — every gate run |
| Bitmap allocations for hand-gate at full sensor resolution | OOM on 4 GB phones | Pin takePhoto resolution to 320×240; RGB_565; recycle | At ~50 photos cumulative on the phone |
| Multiple Camera2 sessions opened-and-closed during gate→recording transition | Camera reset ~600 ms | Reuse single CameraDevice + reconfigure CaptureSession | Always |
| Foreground service notification updated on every IMU sample | UI thread jank, battery cost | Update notification at most every 5 seconds; debounce | At ~200 Hz IMU sustained |
| Logcat output during recording (V or D level) | Capture pipeline jitter; thermal acceleration | Production builds: only E and W; no I/D/V from native code | At ~10 minutes capture |
| Uploading from the main thread / RN bridge | UI freeze during upload | Native upload service runs on its own thread pool; bridge to JS only for progress | At first 8 MB chunk |
| Network probe polling (e.g. checking for connectivity every 1s during upload pause) | Wakelock leak; battery drain | Use ConnectivityManager.NetworkCallback (event-driven); zero polling | Within an hour of pause |
| pgvector + ts_vector hybrid task search without LIMIT | DB CPU spike on query | Always paginate with LIMIT 50; cache top-N | When task catalog grows past ~200 |
| Hash computation (SHA-256) on UI thread | Stop button → toast latency > 250 ms | SHA-256 on a worker thread; show progress | At 1 GB+ recording (~10 min) |

---

## Security Mistakes

Domain-specific issues beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `Build.PRODUCT` / `Build.MANUFACTURER` for OEM detection | OEM strings are spoofable on rooted devices; fraud mules can mask Xiaomi as Pixel | Pair with Play Integrity strong verdict; use device-class as a hint only, not a trust signal |
| Storing presigned S3 URLs in plaintext | URL is bearer-token; anyone with the URL can upload garbage to that key | Store URLs in EncryptedSharedPreferences (Android) / Keychain (iOS); short expiry (≤ 15 min) |
| Including IP address / location data in metadata JSON before consent flow completes | Pre-consent data harvest = DPDP/LGPD violation | Server populates `ip_address` (per spec); device defers `location` until after consent timestamp logged |
| Using SHA-256 client hash as proof of integrity | Doesn't prove provenance; proves only file hasn't changed in transit | Pair with HMAC using a per-session key issued by backend; otherwise an attacker can substitute their own file + hash |
| Logging Recording filename to telemetry | Filename = YYYYMMDD_HHMMSS — leaks user's recording habits / time of day routines | Strip timestamps from logged filenames; use ULID for `recording_id` in logs |
| Decoding and re-encoding video for thumbnail | Violates "files never re-encoded" + introduces a thumbnail attack surface | Use MediaMetadataRetriever to extract frame and downsize for thumbnail only — never write back |
| Linking recordings to clan-chief identity in the metadata | Chief PII in every uploaded segment; data-subject-rights nightmare | Recording metadata should not include clan or chief data; surface this at backend join only |
| Trusting `consent.locationConsent` boolean alone | If a user toggles location off post-consent, retroactive recordings still claim consent | Per-recording snapshot of consent state at recording-stop time |
| Per-upload Play Integrity at sign-in time only (current MVP) | Compromised app builds upload junk and earn payouts | Move per-upload attestation forward (deferred-decisions.md flagged) BEFORE payouts go live |
| Account-deletion grace = 30 days (per PROJECT.md) | DPDP and LGPD both have right-to-deletion; 30 days is OK but communicate clearly the data state during grace | Document at consent flow that deletion is reversible during 30 days; data-subject-rights API for deeper deletion outside of soft-delete |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent voice fallback when en-IN female TTS unavailable | User in Hindi-speaking household hears en-US female robotic voice; brand mismatch | Pre-flight check in compat: if no en-IN voice installed, surface a one-time prompt to install Google TTS voice pack (deep-link to Settings); allow proceeding with fallback |
| Hand-gate Skip is silent on success but verbal on pass | Skip-rate users get no audio confirmation that they entered active recording | Add a soft haptic-only confirmation on Skip exit; without it, low-skin-tone users (who skip more) get a worse flow |
| Brightness 5% during recording but full-bright on stop modal | Display flicker when stop modal pops; jarring | Animate brightness restoration over 300 ms |
| Pending uploads tile uses count only | "7 pending" doesn't tell user if they're stuck or progressing | Add a small sub-line: "Last sync 4h ago" or "Uploading..." with elapsed |
| Storage warning at < 5 GB only triggers at recording start | Mid-recording storage exhaustion still happens (storage-full event in §10) | Pre-warn at 8 GB at recording start (8 GB is what 10 min HEVC uses); that's already built in to the spec but the COPY in the warning needs to specify hours-of-headroom remaining |
| Compat-check failure on REALTIME timestamp source has no recovery path | Engineering-handoff §19 Q2 "what happens after compat fails?" — undefined | Show waitlist signup ("we'll email you when your phone is supported") — moves users to v2 instead of losing them |
| Auto-rotation on recording entry can fail on certain Samsung OneUI rotation-locked configs | User taps record, screen doesn't rotate, gets stuck | Detect rotation lock; surface "Disable rotation lock to record" prompt with a deep-link to Settings |
| 60-second discard rule with no warning at 50 seconds | User stops at 58 seconds expecting a save | Add a "Almost there..." subtle animation at 50–60 seconds showing the imminent 60s threshold |
| TTS "Recording stopped" voice cue plays at full volume even if device is on Vibrate | Disturbs others in shared spaces | Honour AudioManager.RINGER_MODE_VIBRATE / SILENT — fall back to haptic-only |
| MediaPipe gate's "loading" state has indefinite spinner | Looks broken if camera takes 4+ seconds to start | Add a 3-second-max timeout: "Tap Skip if camera doesn't start" surfaced at 3 seconds |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in implementation but commonly miss critical pieces.

- [ ] **HEVC encoder configuration:** Often missing the post-encode NAL-unit verification — verify zero B-slices in compat-time and runtime sample
- [ ] **Camera2 timestamp source:** Often missing — read back `SENSOR_INFO_TIMESTAMP_SOURCE` from CameraCharacteristics AND check post-frame `Result.SENSOR_TIMESTAMP` is in elapsedRealtimeNanos domain (compare to a known-good elapsedRealtimeNanos call)
- [ ] **OIS disable:** Often missing the read-back — verify `Result.LENS_OPTICAL_STABILIZATION_MODE = OFF` in CaptureResult, not just in the Request
- [ ] **HDR disable:** Often missing — verify `Result.SENSOR_DYNAMIC_BLACK_LEVEL` and color-tag in MP4 output is bt709, not bt2020
- [ ] **IMU sustained 100 Hz:** Often missing the inter-sample interval p99 check — *advertised* rate isn't *delivered* rate
- [ ] **Foreground service type:** Often missing the dynamic downgrade — service starts as `camera|microphone|dataSync` but should drop to `dataSync` only post-recording
- [ ] **Battery optimization exemption:** Often missing OEM-specific walkthrough — REQUEST_IGNORE_BATTERY_OPTIMIZATIONS alone is insufficient
- [ ] **Hash-verify-and-delete:** Often missing the verified-event-replay sweep on app launch
- [ ] **MediaMuxer fragmented MP4:** Often missing the periodic moov flush — without it, crash mid-record loses the whole file
- [ ] **Hand-gate cleanup:** Often missing `bitmap.recycle()` — native bitmap memory leaks
- [ ] **Network MTU handling:** Often missing TCP_MAXSEG = 1280 — cellular blackholes look like timeout retries
- [ ] **Storage warning math:** Often missing the FBE overhead — `StatFs.getAvailableBytes()` returns CE-storage-decrypted bytes; on FBE the actual writable space can be slightly less than reported
- [ ] **Play Integrity retry policy:** Often missing exponential backoff — single-shot on NETWORK_ERROR fails for users on flaky cellular
- [ ] **Verified-event delivery:** Often missing — only triggered on `GET /recordings/{id}` not on app launch
- [ ] **Drift methodology:** Often missing the residual-subtraction step — direct timestamp-difference produces inflated max/p99
- [ ] **Audio AGC:** Often missing AudioSource.UNPROCESSED — MIC source has implicit AGC on most devices
- [ ] **TTS voice fallback:** Often missing the en-IN-female-not-installed case — silent fallback to en-US is still en-US
- [ ] **Hand-gate Remote Config:** Often missing — `target_hits` and `cadence_ms` and `minHandDetectionConfidence` should all be Remote-Config keys
- [ ] **CompatCheck re-run on OS update:** Often missing — only re-runs on app update or device change
- [ ] **Fragmented MP4 timestamp resync:** Often missing — after a moov flush, next fragment timestamps must continue monotonically
- [ ] **Per-segment metadata `start_gate` block:** Often missing the `bypassed` and `skipped` fields — the spec calls them out but implementations often forget

---

## Recovery Strategies

When a pitfall fires despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| HEVC B-frame leak detected post-upload | MEDIUM | Backend reject + re-record request; user gets notified next time they open the app; no payout for that segment |
| REALTIME timestamp not available on a deployed device | HIGH | Ship app update that does cross-correlation IMU-vision sync (v2 fallback path); existing recordings on that device are not training-grade |
| Sustained 100 Hz IMU not maintained mid-recording | LOW (per recording) | Mark segment with `imu_min_rate_hz_observed_p1` field; backend QA discards segments below threshold; no payout for those |
| HDR auto-engaged | MEDIUM | Backend rejects on color-tag mismatch; user gets re-record prompt |
| OIS active despite disable request | MEDIUM | Backend marks segment for cross-correlation re-sync; if drift is recoverable, accept; else discard |
| Foreground service killed mid-recording | LOW | Existing fragmented MP4 + 30s flush recovers up to last flush; segment ends at < 60s = discard, ≥ 60s = upload partial |
| OEM battery manager kills upload mid-chunk | LOW per chunk, but compounds | WorkManager retry on app foreground; chunk resumes from last byte; on user's next app open uploads complete |
| MediaPipe false-negative on dark skin / warm lighting | LOW | User taps Skip; recording proceeds normally; fix is Remote Config tune of `minHandDetectionConfidence` |
| TakePhoto warm-up stuck | LOW | User taps Skip after 4 seconds (visible link); fix is pre-warm or frame-processor migration |
| MediaMuxer IllegalStateException | MEDIUM | Catch + finalize current MP4 + restart with new MP4; mark `muxer_anomaly` in metadata |
| Cellular MTU blackhole | LOW | TCP_MAXSEG clamping prevents most; rare leak handled by 30s no-progress abandon-and-retry |
| Verified event not delivered | LOW | App-launch sweep reconciles |
| Storage cost growth at scale | MEDIUM | S3 lifecycle to Glacier IR/DA; if not configured day 0, retroactive lifecycle is straightforward |
| Bystander complaint (DPDP/LGPD) | HIGH | Pre-built DSAR (data-subject-access-request) handler; legal-engagement playbook defined |
| Skin-tone bias in gate | MEDIUM | Remote Config tune `minHandDetectionConfidence` → 0.3 then 0.1; possibly add a bypass-on-3-skip session-level flag |
| Tensor G3 thermal throttle on 25-min sustained capture | MEDIUM | Confirm in testing; if unrecoverable, raise the Pixel-7a-class bar to "Tensor G5+" — narrows fleet but preserves spec |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. The phase names are placeholders — the orchestrator's roadmap will assign concrete phase numbers.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. HEVC B-frame leak | Capture Pipeline + Compat Check | NAL-unit parse on compat sample + first 30s of every recording |
| 2. REALTIME timestamp unavailable | Compat Check + Distribution Recon | Standalone-compat-only APK to chiefs pre-launch; harvest device-model coverage data |
| 3. IMU sustained 100 Hz drops | Capture Pipeline + Compat Check | Inter-sample p99 ≤ 12 ms in compat; runtime per-recording field |
| 4. HDR auto-engage | Capture Pipeline | MP4 color-tag verification on every segment |
| 5. OIS active despite disable | Compat Check + Capture Pipeline | LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION pre-check + CaptureResult readback |
| 6. Android 14+ FGS-from-bg ban | Upload Pipeline + Architecture | Lifecycle service-types properly; WorkManager + FGS layered |
| 7. OEM battery managers | Upload Pipeline + Onboarding | OEM walkthrough at first upload; per-OEM detection |
| 8. MediaPipe skin-tone bias | Hand-Gate + Observability | Skip-rate by locale telemetry; Remote Config tuning hooks |
| 9. takePhoto warm-up | Hand-Gate | Pre-warm photo pipeline at recording-screen mount |
| 10. Bitmap memory pressure | Hand-Gate | Pin takePhoto resolution; native recycle calls |
| 11. MediaMuxer crash | Capture Pipeline | Use AOSP MediaMuxer; try/catch + restart fallback |
| 12. Cellular MTU blackhole | Upload Pipeline | TCP_MAXSEG clamping; smaller cellular chunks; field test India + Brazil |
| 13. TV-replay fraud | Backend / QA Pipeline | Promote IMU liveness from deferred to MVP backend scope |
| 14. DPDP/LGPD bystander consent | Foundation / Legal | Counsel review pre-Play-Store; consent text hardening; DSAR handler |
| 15. Verified event delivery | Backend + Client Storage | App-launch sweep; piggyback on every API response |
| 16. Storage cost at scale | Backend Infra | S3 lifecycle policy from day 0 |
| 17. Tensor G3 vs G5 thermal | Testing | Add Pixel 8a (G3) as the thermal-stress device |

---

## What this file deliberately does NOT cover

To avoid duplication with existing docs:

- **Anti-fraud beyond what's in the spec** — `imu-liveness-check.md` covers the deferred IMU-liveness pipeline; `deferred-decisions.md` covers per-upload attestation, perceptual-hash dedup, device-fingerprint binding, liveness gestures.
- **MVP success metrics** — `strategic-suggestions.md` §1.
- **Payments and trust** — `strategic-suggestions.md` §2.
- **Retention loops** — `strategic-suggestions.md` §5.
- **Localization** — `strategic-suggestions.md` §8 and `deferred-decisions.md`.
- **On-device hands-in-frame Variant B (continuous)** — `deferred-decisions.md` documents this thoroughly; the only relevant pitfall here (Pitfall 8) is the *one-shot* gate's bias, which IS in MVP.
- **Wi-Fi-only toggle** — `deferred-decisions.md`.
- **Continuous on-device hand detection** — `deferred-decisions.md` Variant B.

---

## Sources

### Authoritative (HIGH confidence)

- [AOSP — Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [AOSP — Foreground service types are required (Android 14)](https://developer.android.com/about/versions/14/changes/fgs-types-required)
- [AOSP — Changes to foreground service types for Android 15](https://developer.android.com/about/versions/15/changes/foreground-service-types)
- [AOSP — Sensor Batching](https://source.android.com/docs/core/interaction/sensors/batching)
- [AOSP — Low-latency decoding in MediaCodec](https://source.android.com/docs/core/media/low-latency-media)
- [AOSP — File-based encryption (FBE)](https://source.android.com/docs/security/features/encryption/file-based)
- [AOSP — Camera2 stream configurations](https://source.android.com/docs/core/camera/stream-config)
- [AOSP — Camera2 HDR modes](https://source.android.com/docs/core/camera/hdr-modes)
- [Android Developers — CameraCharacteristics reference](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics)
- [Android Developers — Credential Manager replaces legacy Google Sign-In](https://android-developers.googleblog.com/2024/09/streamlining-android-authentication-credential-manager-replaces-legacy-apis.html)
- [Android Developers — Migration from legacy Google Sign-In](https://developer.android.com/identity/sign-in/legacy-gsi-migration)
- [Android Developers — Play Integrity error codes](https://developer.android.com/google/play/integrity/error-codes)
- [Android Developers — Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Android Developers — Background optimization](https://developer.android.com/topic/performance/background-optimization)
- [Android Developers — Restrictions on starting a foreground service from the background](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)
- [Android Developers — HDR video capture](https://developer.android.com/media/camera/camera2/hdr-video-capture)
- [Apple Developer — waitsForConnectivity (URLSessionConfiguration)](https://developer.apple.com/documentation/foundation/nsurlsessionconfiguration/2908812-waitsforconnectivity)
- [AWS S3 — Pricing (Standard / Glacier IR / Glacier DA)](https://aws.amazon.com/s3/pricing/)
- [AWS — Implementing secure file uploads to S3 at the edge](https://aws.amazon.com/blogs/networking-and-content-delivery/implementing-secure-file-uploads-to-amazon-s3-at-the-edge-choosing-the-right-pattern/)

### Tracker bugs / GitHub issues (HIGH confidence on existence; MEDIUM on impact for our exact stack)

- [androidx/media #2711 — H.265/HEVC fails on MediaTek Dimensity after Android 15 upgrade](https://github.com/androidx/media/issues/2711)
- [androidx/media #1781 — Mp4Muxer / FragmentedMp4Muxer IllegalStateException 30–60s in](https://github.com/androidx/media/issues/1781)
- [Google Issue Tracker #36916900 — SensorEvent timestamp behavior](https://issuetracker.google.com/issues/36916900)
- [VisionCamera #1585 — takePhoto() not always resolving Android](https://github.com/mrousavy/react-native-vision-camera/issues/1585)
- [VisionCamera #1157 — takePhoto too slow](https://github.com/mrousavy/react-native-vision-camera/issues/1157)
- [VisionCamera #2020 — Camera stuck on first takePhoto on Pixel 5 emulator](https://github.com/mrousavy/react-native-vision-camera/issues/2020)
- [VisionCamera #2614 — Migrate to new architecture](https://github.com/mrousavy/react-native-vision-camera/issues/2614)
- [VisionCamera #1554 / #1821 — Camera View not Fabric compatible (early new-arch)](https://github.com/mrousavy/react-native-vision-camera/issues/1554)
- [VisionCamera 4.0.0 release notes — CameraX rewrite](https://github.com/mrousavy/react-native-vision-camera/releases/tag/v4.0.0)
- [facebook/react-native #55571 — Hermes V1 + DevTools + high-volume TurboModule crash](https://github.com/facebook/react-native/issues/55571)
- [facebook/react-native #54859 — iOS 26 TurboModule SIGABRT](https://github.com/facebook/react-native/issues/54859)
- [facebook/react-native #47592 — RN 0.76 Android crash on launch](https://github.com/facebook/react-native/issues/47592)
- [reactwg/react-native-new-architecture #276 — RCTTurboModule.mm exception handling](https://github.com/reactwg/react-native-new-architecture/discussions/276)
- [expo/expo #42669 — Hermes V1 bytecode v96 mismatch (Expected 96 got 98)](https://github.com/expo/expo/issues/42669)
- [moonlight-android/decoder-errata.txt — MediaCodec inconsistencies across chipsets](https://github.com/moonlight-stream/moonlight-android/blob/master/decoder-errata.txt)
- [OpenCamera-Sensors — Synchronized Camera + IMU recording reference](https://github.com/MobileRoboticsSkoltech/OpenCamera-Sensors)

### Community / industry (MEDIUM confidence)

- [dontkillmyapp.com — Xiaomi MIUI battery optimization](https://dontkillmyapp.com/xiaomi)
- [Knox — File-based encryption (FBE) and full-disk encryption (FDE)](https://docs.samsungknox.com/admin/knox-platform-for-enterprise/kbas/kba-360039577713/)
- [9to5Google — Tensor overheating leaked documents](https://9to5google.com/2024/11/08/google-tensor-pixel-overheating-leaked-documents/)
- [XDA Developers — Galaxy S22 Camera2 OIS disable inconsistencies](https://xdaforums.com/t/is-it-possible-to-disable-ois-optical-image-stabilization.3707251/)
- [Pixel 8 Pro performance evaluation (Tensor G3 throttling)](https://www.xda-developers.com/google-pixel-8-pro-performance-evaluation/)
- [Tensor G5 performance analysis](https://mundobytes.com/en/Google-Tensor-G5-performance-analysis/)
- [Beebom — Google Tensor G3 benchmarks and thermal performance](https://beebom.com/google-tensor-g3-benchmarks/)
- [nickvsnetworking.com — MTU in LTE & 5G transmission networks](https://nickvsnetworking.com/mtu-in-lte-5g-transmission-networks-part-1/)
- [Cloudflare — What is MSS](https://www.cloudflare.com/learning/network-layer/what-is-mss/)
- [Medium — Jio vs TCP congestion control](https://ritikk.medium.com/jio-vs-tcp-905b7a17ea63)
- [Approov — Limitations of Google Play Integrity API](https://approov.io/blog/limitations-of-google-play-integrity-api-ex-safetynet)
- [Fingerprint — Android device reputation network for fraud detection](https://fingerprint.com/blog/android-device-reputation-network-fraud-detection/)
- [Fingerprint — Detect device farm fraud](https://fingerprint.com/blog/how-to-detect-device-farm-fraud/)
- [Razorpay — Device fingerprinting for payments in India 2026](https://razorpay.com/blog/device-fingerprinting-payments-india)
- [DLA Piper — Brazil LGPD overview](https://www.dlapiperdataprotection.com/index.html?t=law&c=BR)
- [Seqrite — DPDP India privacy guide](https://www.seqrite.com/understanding-data-privacy-and-dpdp-act/)
- [SwiftLee — URLSessionConfiguration opt-in configurations](https://www.avanderlee.com/swift/urlsessionconfiguration/)
- [Use Your Loaf — URLSession Waiting For Connectivity](https://useyourloaf.com/blog/urlsession-waiting-for-connectivity/)
- [Google Tensor G5 specs and benchmarks (NanoReview)](https://nanoreview.net/en/soc/google-tensor-g5)

### Internal (load-bearing context — read in full at start of task)

- `/Users/adnaan/Documents/hl-homelander/.planning/PROJECT.md`
- `/Users/adnaan/Documents/hl-homelander/idea-brief.md` (capture spec §2, lifecycle §10, anti-fraud §11, perf §14)
- `/Users/adnaan/Documents/hl-homelander/engineering-handoff.md` (native APIs §5, edge cases §13, security §14)
- `/Users/adnaan/Documents/hl-homelander/imu-liveness-check.md` (deferred fraud cases — not duplicated above)
- `/Users/adnaan/Documents/hl-homelander/strategic-suggestions.md` (PM concerns parked for v2 — not duplicated above)
- `/Users/adnaan/Documents/hl-homelander/deferred-decisions.md` (technical decisions parked for v2 — not duplicated above)
- `/Users/adnaan/Documents/hl-homelander/testing-guide.md` (device matrix; pitfalls 1, 5, 8, 17 expand it)

---

*Pitfalls research for: Homelander (Humyn Labs Capture)*
*Researched: 2026-05-07*
