# Phase 3 Manual Smoke — apkRollout module-load + JS bridge contract

**Status:** OPEN — fill in the checkboxes during the manual smoke; commit the file when complete.

> Per CONTEXT.md D-WAVE-01: **Phase 3 acceptance is module-ready + Kotlin pure-fn unit tests + JS bridge contract.** Full 10-min E2E HEVC capture verification, drift methodology validation under live IMU, thermal cut-out timing, and the 25-min battery soak are deferred to Phase 4 smoke walks.

**Operator:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Date:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Device:** Pixel 10a (5C161JEA304304) **Android version:** \_\_\_\_

## Pre-flight

- [ ] Pixel 10a connected via adb (`adb devices` lists `5C161JEA304304`).
- [ ] apkRollout debug build installed: `cd apps/mobile/android && ./gradlew installApkRolloutDebug`.
- [ ] Backend reachable (Phase 1 dev API at the URL in `apps/mobile/.env.apkRollout`).
- [ ] Device signed into a Google account (Phase 2 sign-in completed).
- [ ] `adb logcat -c` to clear before each section so the logcat greps below match the latest run.

## §1 Module-load smoke

- [ ] Cold-launch the app (force-stop + tap launcher icon); observe no crash on splash.
- [ ] `adb logcat -t 200 | grep -i CaptureLaunchSweep` — confirm the sweep ran on app boot. (Empty output is acceptable on a clean install — the sweep silently no-ops on missing `recordings/` + `practice/` directories. Run it after at least one prior capture session in Phase 4 to see the real log lines.)
- [ ] `adb logcat | grep "capture.segment_minutes"` — confirms Firebase Remote Config defaults set on app boot. May appear only on the first install (defaults are persistent).
- [ ] `adb shell dumpsys notification | grep humyn_capture_fgs` — confirms the FGS notification channel was created at boot via `HumynForegroundNotification.ensureChannel`. Channel id = `humyn_capture_fgs`, importance LOW.
- [ ] `adb logcat | grep -i "HumynCaptureModule\|HumynCapturePackage\|ReactNativeJS"` — confirms the package list registered HumynCapturePackage alongside HumynCompat / HumynUpdater / AppFlavor / PlayIntegrity.
- [ ] No `MissingForegroundServiceTypeException` in logcat (Pitfall 6 mitigation verification — the FGS bitmask + manifest are in lock-step).

## §2 JS bridge contract smoke (validates the surface that Plan 03-10 lights up)

The bridge contract can be exercised today without a debug screen by tapping
through to whatever Phase 4 / dev-menu surface invokes `start()` (or by editing
a debug build to invoke `import { start } from 'src/native/HumynCapture'` once).

- [ ] Call `start(validOpts)` (validOpts shape per `apps/mobile/__tests__/native/HumynCapture.test.ts` `VALID_OPTS`).
  - **Until Plan 03-10 lands:** observe Promise rejects with code `not_implemented_in_03_09` and a message that includes `"durationMs=600000"` and `"taskId=<your-task-id>"`. This validates that the bridge surface is wired and the Kotlin opts validator runs end-to-end.
  - **After Plan 03-10 lands:** observe Promise resolves with `{sessionId, segmentId, recordingId, filenameBase}` OR rejects with `thermal_throttling` / `realtime_clock_unavailable` / `permission_revoked`.
- [ ] Pre-flight rejection paths surface the right code strings:
  - `consent_invalid` when `contributor.consent` is anything other than `true`.
  - `invalid_opts` (with `<field>` in message) for any other validator failure (e.g. `dfovDegrees: 0`, `appVersion: 'invalid'`).
- [ ] Confirm `onSegmentStart` event fires after `start()` resolves; payload contains `segmentId`, `recordingId`, `startedAt`, `filenameBase`. **(Deferred to after Plan 03-10 ships the orchestrator.)**
- [ ] Confirm `onSessionStop` event fires after `stop()` resolves; payload contains `sessionId`, `segmentsCompleted: N`. **(Deferred to after Plan 03-10.)**

## §3 FGS sanity smoke (after Plan 03-10 lands the orchestrator)

- [ ] Watch the foreground notification appear in the system tray during `start()`; title "Humyn Labs Capture", text "Recording in progress", priority LOW (no sound, no vibration, no badge).
- [ ] Confirm the notification is non-dismissible by user swipe while the service runs.
- [ ] Confirm notification disappears after `stop()` completes.
- [ ] Confirm no `MissingForegroundServiceTypeException` in logcat during the start/stop cycle.
- [ ] Confirm no `SecurityException` for camera/microphone/dataSync FGS types during the start cycle.

## §4 Storage smoke (after Plan 03-10 lands the orchestrator)

- [ ] After `start()` then immediate `stop()`, `adb shell run-as ai.humynlabs.capture.apk ls files/recordings` shows one triple `{base}.mp4`, `{base}.csv`, `{base}.json` AND no `{base}.session.json`.
- [ ] Hash-verify: `adb shell run-as ai.humynlabs.capture.apk cat files/recordings/{base}.mp4 | sha256sum` matches the `file_sha256` field in `{base}.json` byte-for-byte (CAP-15 / CAP-18: files travel byte-for-byte from device to S3; no re-encode).
- [ ] Force-kill the app mid-segment (`adb shell am force-stop ai.humynlabs.capture.apk`) → relaunch → observe CaptureLaunchSweep log lines indicating either `orphan_with_sidecar=...` (Phase 4 re-finalize candidate) or `corrupt_sidecar=...` / `orphan_no_sidecar=...` (triple discarded). The recording should be cleanly unrecoverable, not crash the next launch.

## Items deferred to Phase 4 (NOT in scope for Phase 3 sign-off)

| Behavior                                              | Why Phase 4                                                                                                                     | Reference                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 10-min E2E HEVC capture                               | Requires real RecordingScreen integration with Camera2 + MediaCodec + IMU pipeline                                              | D-WAVE-01                                    |
| Drift validation under live IMU                       | Requires real-device IMU stream sustained ≥ 100 Hz; methodology is correct only against physical `SensorEvent.timestamp` values | 03-VALIDATION.md Manual-Only                 |
| Thermal cut-out timing (~2.5 s graceful stop)         | Requires `cmd thermalservice override-status` on rooted dev device; can't simulate via Robolectric                              | 03-VALIDATION.md                             |
| 25-min battery / thermal soak (Pixel 7a-class budget) | Long-running real-hardware test; PROJECT.md battery budget = ≤ 8% drain over 25 min                                             | 03-VALIDATION.md                             |
| Pixel 8a / 7a / non-Pixel OEM matrix                  | Phase 4 broader fleet validation                                                                                                | feedback_functionality_first_during_smoke.md |
| Auto-segment 10-min cuts (real timing)                | Requires real-device 10-min run; Plan 03-08 SegmentTimerTest covers the unit-level invariant only                               | D-WAVE-01                                    |
| Background-upload + segment-finalize race             | Phase 5 owns the upload pipeline                                                                                                | D-FGS-02                                     |

## Sign-off

- [ ] All §1 boxes ticked (module-load smoke).
- [ ] All §2 boxes ticked through the `not_implemented_in_03_09` rejection path (until Plan 03-10 lands).
- [ ] §3 + §4 boxes are deferred until Plan 03-10 lands the orchestrator.

Operator signature: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

Smoke-walked-on: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** on Pixel 10a (5C161JEA304304).

Approved? **YES / NO**

If NO: describe the failure mode and link to the bug ticket below.

---

## Notes / failures
