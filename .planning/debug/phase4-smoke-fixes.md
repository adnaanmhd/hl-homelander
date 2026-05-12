---
status: resolved
trigger: 'Phase-4 on-hardware smoke-walk findings (04-MANUAL-SMOKE.md §6 + 04-COSMETIC-GAPS.md): (1) sub-60s recordings shown as "Recording too short — discarded." are NOT deleted from files/recordings/ (REC-07 finalize-deletes not happening → Phase 5 would upload sub-60s junk); (2) <5% battery start-guard (checkStartGuards in useRecordingLifecycle/RecordingScreen) does not block — record starts at 4% even though the 15% alert listener works; (3) force-quit recover-on-launch: CaptureLaunchSweep + "onCrashRecovery emitted — recovered=N" fire in logcat, but (a) no Home toast "Recording recovered after force-quit — uploading." (D-LIFE-04 bootRecoveryListener→showToast), (b) orphan .session.json not re-finalized into a usable {base}.json triple (orphan mp4 stays ~778-byte stub, sidecar not deleted), (c) old orphan sidecars not swept; (4) mid-record thermal abort does not respond to `cmd thermalservice override-status 4` (CRITICAL) — recording keeps going, no pill/tones/vibrate/voice/auto-stop; the pre-record refuse via override-status 3 works (synchronous getCurrentThermalStatus() read is fine), so the async PowerManager.addThermalStatusListener path is the gap. Plus cosmetic nits if cheap: start_gate.duration_ms occasionally bogus on the pass path; HumynGateCameraViewManager prop-setter warning. THEN resume the 04-MANUAL-SMOKE.md walk on Pixel 10a 5C161JEA304304, then phase complete 04 + REQUIREMENTS traceability + commit + route to Phase 5.'
created: 2026-05-12T00:00:00+05:30
updated: 2026-05-12T10:00:00+05:30
---

## Current Focus

hypothesis: |
Four independent defects on the Phase-4 recording lifecycle path; addressed as a batch.

- Bug 1 (sub-60s not deleted): REC-07 says "HumynCapture owns the file deletion at finalize" but RecordingScreen.tsx calls HumynCapture.stop() then derives the "too short — discarded" toast from durationMs without anything actually unlinking the <60s segment's mp4/csv/json. Likely the native finalize path writes the triple regardless of duration, or the JS-side discard branch only resets state. Fix: make the finalize (native or JS, whichever owns the files per REC-07) delete the segment artifacts when durationMs < 60_000.
- Bug 2 (<5% battery start-guard): checkStartGuards reads battery level via a source that `adb shell dumpsys battery set level 4` doesn't actually move, OR the guard threshold/comparison is wrong, OR the guard runs before the level is available. The 15% alert _listener_ (a separate runtime BatteryManager/event subscription) works, so the read source diverges between start-guard and listener. Fix: align the start-guard's battery read with the working listener's source (or fix the comparison).
- Bug 3 (force-quit recovery: toast missing + orphan not re-finalized + old sidecars not swept): three sub-defects. (a) bootRecoveryListener fires the RN event ("onCrashRecovery emitted — recovered=N") but the Home screen's listener→showToast wiring (D-LIFE-04) is broken — either no subscriber mounted at boot, or the toast surface isn't shown on the Home route, or the event name mismatches. (b) CaptureLaunchSweep identifies the orphan_with_sidecar as a "Phase 4 re-finalize candidate" but the re-finalize step that should mux/finalize the stub mp4 + sidecar into {base}.json + delete the .session.json is a stub or no-op. (c) the sweep only counts the freshest orphan; older .session.json files aren't enumerated/cleaned.
- Bug 4 (mid-record thermal abort): the pre-record refuse reads getCurrentThermalStatus() synchronously and works; the mid-record path relies on PowerManager.addThermalStatusListener which either is never registered, registered on a dead executor, or the override-status 4 doesn't deliver a callback on this Android-16 build. Fix: ensure the listener is registered (and consider a polling fallback) so SEVERE/CRITICAL mid-record triggers the alert pill / tones / vibrate / voice / auto-stop path the same way the battery-15% listener does.
  confirming_evidence: []
  falsification_test: |
  Bug 1: after a sub-60s recording + "discarded" toast, `adb shell run-as <pkg> ls files/recordings/` shows no leftover {base}.{mp4,csv,json}.
  Bug 2: `adb shell dumpsys battery unplug && adb shell dumpsys battery set level 4`, tap record → refused with the low-battery refuse path, recording does NOT start.
  Bug 3: `am force-stop` mid-record + relaunch → Home toast "Recording recovered after force-quit — uploading." appears AND the orphan becomes a complete {base}.{mp4,csv,json} triple with the .session.json deleted AND a second pre-existing orphan sidecar is also cleaned (recovered=2).
  Bug 4: `adb shell cmd thermalservice override-status 4` mid-record → alert pill + tones + vibrate + voice + auto-stop (graceful self-stop) within a few seconds.
  fix_rationale: ""
  blind_spots: |
- `adb shell dumpsys battery set level N` may not propagate to whatever API the start-guard reads on Android 16 — the "fix" might be to switch the read source rather than change logic.
- `cmd thermalservice override-status` may not deliver listener callbacks on Android 16 even when the listener is correctly registered (it could still fire on a real HAL escalation) — need to distinguish "listener not registered" from "test override not delivered to listeners". A unit/instrumentation check that the listener IS registered + a manual real-thermal note may be the best we can do.
- REC-07 ownership: confirm whether the _native_ HumynCapture finalize or the _JS_ RecordingScreen owns file deletion before patching — patching the wrong layer leaves the other path leaking.
- Force-quit re-finalize of a 778-byte stub mp4: a stub with no moov atom may be unrecoverable as playable video — "re-finalize" may mean "discard the unusable stub + its sidecar" rather than "produce a usable triple". Clarify the intended D-LIFE-04 behavior from the plan/runbook.

next_action: gather initial evidence — read RecordingScreen.tsx / useRecordingLifecycle / HumynCaptureModule + the Kotlin CaptureSession finalize path; locate checkStartGuards battery read vs the 15% listener; locate CaptureLaunchSweep + bootRecoveryListener + the Home toast wiring; locate the thermal listener registration.

## Symptoms

expected: |

1. A recording stopped under 60s shows "Recording too short — discarded." AND the segment's mp4/csv/json are removed from files/recordings/ (REC-07).
2. Tapping record with battery < 5% is refused (the low-battery start-guard blocks; recording never starts).
3. After `am force-stop` mid-record + relaunch: Home shows toast "Recording recovered after force-quit — uploading." (D-LIFE-04) AND the orphan .session.json is re-finalized into a usable {base}.json triple (sidecar deleted) AND older orphan sidecars are also swept.
4. Mid-record, when thermal status escalates to SEVERE/CRITICAL: alert pill + warning tones + vibrate + voice cue + graceful auto-stop (same UX path the battery-15% listener exercises).
   actual: |
5. Toast shows + RESET_FOR_FRESH happens, but the segment files persist in files/recordings/ (walk left \_002 6s, \_004 22s, \_005 ~4s, \_006 ~6s).
6. `dumpsys battery unplug && set level 4` → tap record → recording started anyway. The 15% alert _listener_ works.
7. logcat shows `CaptureLaunchSweep: orphan_with_sidecar=…009 — Phase 4 re-finalize candidate` + `HumynCapture: onCrashRecovery emitted — recovered=1`, BUT (a) no Home toast appeared, (b) orphan \_009.mp4 stays a 778-byte stub (no metadata JSON, sidecar not deleted), (c) older \_021403_004.session.json orphan wasn't swept (recovered=1, not 2).
8. `cmd thermalservice override-status 4` (CRITICAL) mid-record → nothing (no pill/tones/vibrate/voice/auto-stop; recording kept going). Pre-record refuse via override-status 3 (SEVERE) works fine.
   Cosmetic: a gate-PASS practice run stamped `start_gate.duration_ms: 59929` (≈ whole recording) — gateDurationMs = confirmedAt − startedAt in RecordingScreen.tsx run(); state.gate.startedAt not reliably captured before confirmedAt on the pass path. Skip runs stamp sane ~600–2700 ms. Also `ViewManagerPropertyUpdater: Could not find generated setter for class HumynGateCameraViewManager` warning every time <HumynGateCameraView> mounts (prop setters not fully declared in gatecamera/HumynGateCameraViewManager.kt — benign so far).
   errors: |
   `ViewManagerPropertyUpdater: Could not find generated setter for class HumynGateCameraViewManager` (logcat warning, benign).
   No exceptions/crashes — these are silent behavioral gaps.
   reproduction: |
   On Pixel 10a (5C161JEA304304), debug build with **DEV**, via the long-press dev affordance on Home → RecordingScreen.
9. Record < 60s then Stop → check `adb shell run-as <pkg> ls -l files/recordings/`.
10. `adb shell dumpsys battery unplug && adb shell dumpsys battery set level 4` → tap record.
11. Start recording → `adb shell am force-stop <pkg>` → relaunch app → watch Home + `adb shell run-as <pkg> ls files/recordings/`.
12. Start recording → `adb shell cmd thermalservice override-status 4` → observe.
    (Pre-record thermal refuse to compare: `adb shell cmd thermalservice override-status 3` then tap record → correctly refused.)
    started: Surfaced during the 2026-05-12 on-hardware smoke walk (post the `handgate-never-passes` debug-session fix — native Camera2 gate + ultrawide HEVC recording + VisionCamera removed). These code paths are Phase-4-era; not previously exercised on hardware.

## Follow-on (after find-and-fix; handled by the orchestrator, not this session)

- Rebuild + re-walk 04-MANUAL-SMOKE.md on the Pixel 10a, one step at a time with the user: §3 (sub-60s discard deletes; auto-segment two ≥60s segments to confirm preserved start_gate), §4 (battery <5% refuse; force-quit recover toast + actual re-finalize) + the deferred §4(a)/(b) phone-call answered/declined, §4(c) alarm, §4(h) storage <5GB, §5 (mid-record SEVERE/CRITICAL graceful self-stop). Consider re-applying SegmentDurationConfig.kt's 2-min DEBUG_REVERT hack for the re-walk to avoid a 25-min recording, then revert again.
- On §6 = YES: update 04-HUMAN-UAT.md (each result:→pass, fix Summary counts, status→resolved); `node .claude/get-shit-done/bin/gsd-tools.cjs phase complete 04`; update .planning/REQUIREMENTS.md traceability; commit; route to Phase 5.

## Evidence

- timestamp: 2026-05-12T10:00:00+05:30
  finding: |
  Bug 1 root cause confirmed by reading the finalize path: FinalizeWorker.finalize
  always writes the {base}.{mp4,csv,json} triple; CaptureSession.stop() always
  calls it; RecordingScreen.handleStop's <60s branch only dispatches RESET_FOR_FRESH.
  No layer deletes a sub-60s segment's artifacts. Fix applied to the native
  CaptureSession.stop() (REC-07 = "HumynCapture owns the deletion at finalize").
- timestamp: 2026-05-12T10:00:00+05:30
  finding: |
  Bug 2 root cause confirmed: checkStartGuards reads lastBatteryLevelRef, only
  populated by onBatteryChanged inside the `monitoring` effect (gate/active/
  stop-confirm); checkStartGuards runs in `pre-flight` → ref is always -1 → never
  blocks. Added HumynBattery.getCurrentLevel() sync sticky-broadcast read.
- timestamp: 2026-05-12T10:00:00+05:30
  finding: |
  Bug 3(b) root cause confirmed: CaptureLaunchSweep only logged + listed
  "re-finalize candidate" — no actual re-finalize/discard existed. Bug 3(c):
  no pass enumerated a lone .session.json. Both fixed; the 778-byte stub case
  is discarded (no playable moov/moof box structure → unrecoverable as video,
  per D-FS-04 "discard if header parse fails").
- timestamp: 2026-05-12T10:00:00+05:30
  finding: |
  Bug 4: the OnThermalStatusChangedListener IS correctly registered (single-arg
  overload, fired on the main executor); `cmd thermalservice override-status N`
  just doesn't deliver listener callbacks for the override on this Android-16
  build (the synchronous getCurrentThermalStatus() read it moves is what makes
  the pre-flight refuse work). Added a 5 s synchronous thermal poll fallback
  (de-duplicated against the listener) on the session HandlerThread.
- timestamp: 2026-05-12T10:00:00+05:30
  finding: |
  apps/mobile: 597 vitest tests pass, tsc clean. apps/mobile/android: main
  Kotlin source (:app:compileApkRolloutDebugKotlin) compiles clean with all
  fixes. Kotlin Robolectric test set can't run here — PRE-EXISTING unrelated
  compile error in HumynHandDetectorModuleTest.kt (verified on the clean tree).

## Eliminated

- "the JS RecordingScreen owns the <60s file deletion" — eliminated: no JS layer
  unlinks anything; REC-07 ("HumynCapture owns the deletion at finalize") points
  at the native CaptureSession.stop()/finalize path. Patched there.
- "the OnThermalStatusChangedListener isn't registered (dead executor / wrong
  thread)" — eliminated for bug 4: the single-arg overload registers fine on the
  main executor; `cmd thermalservice override-status` simply doesn't notify
  listeners on this build. The poll fallback is the fix, not re-registering.
- "the 778-byte stub mp4 can be re-finalized into a playable triple" — eliminated:
  a force-quit stub has no moov/moof, so it's unrecoverable as video; D-LIFE-04's
  intent for that case is "discard the unusable stub + its sidecar" (D-FS-04's
  "discard if MP4 corrupt"). Only a stub with ≥1 flushed 30s fragment is recoverable.

## Resolution

root_cause: |
Four independent Phase-4 recording-lifecycle defects, root-caused + fixed as a batch:

Bug 1 (sub-60s recordings not deleted) — REC-07's "HumynCapture owns the file
deletion at finalize" was never actually implemented. `CaptureSession.stop()`
always handed the segment to `FinalizeWorker` (which writes the full
mp4/csv/json triple regardless of duration), and the JS `handleStop` <60s
branch only showed the toast + `RESET_FOR_FRESH` — nothing unlinked the
short segment's files. They survived in `files/recordings/` and would feed
Phase 5's upload queue.

Bug 2 (<5% battery start-guard doesn't block) — `useRecordingLifecycle.checkStartGuards()`
read `lastBatteryLevelRef`, which is populated ONLY by the `onBatteryChanged`
subscription mounted inside the `monitoring` effect (substate ∈
{gate, active, stop-confirm}). But `checkStartGuards()` runs during the
`pre-flight` substate — before that subscription mounts — so the ref was
always `-1` ("no reading yet") and the guard never blocked. (The mid-record
15% alert listener works because by then the subscription IS mounted.)
Diverging read sources, exactly as hypothesized.

Bug 3 (force-quit recovery):
(a) toast missing — the `onCrashRecovery` event fires (logcat confirmed
"recovered=1"), but its delivery window is fragile on the new arch
(HumynCaptureModule construction + LifecycleEventListener registration ↔
JS bundle eval + installBootRecoveryListener subscribe ↔ first
onHostResume emit), and `<ToastHost />` may not be mounted when the emit
lands; the `RCTDeviceEventEmitter` drops events with no JS listener and
`crashRecoveryEmitted` latched even on an empty holder. Fragile event-only
delivery.
(b) orphan .session.json not re-finalized — `CaptureLaunchSweep` only LOGGED
"orphan_with_sidecar=… — Phase 4 re-finalize candidate" and added the base
to its return list; there was no actual re-finalize OR discard. The
778-byte force-quit stub mp4 (no `moov`, no fragments) just sat there
forever with its sidecar.
(c) old orphan sidecars not swept — the sweep's Pass 1 iterates `.mp4`s and
Pass 2 iterates non-sidecar `.json`s; nothing enumerated a lone
`.session.json` with no matching `.mp4`, so it accumulated and inflated
the "recovered" count expectation.

Bug 4 (mid-record thermal abort doesn't fire) — `cmd thermalservice
    override-status N` reliably moves `PowerManager.getCurrentThermalStatus()`
(so the pre-flight refuse via `override-status 3` works) but on this
Android-16 build does NOT deliver `OnThermalStatusChangedListener` callbacks
for the override, so the mid-record graceful-stop / onThermalAbort never
fired. The async listener path is the gap, as hypothesized — but the listener
itself is correctly registered; the fix is a polling fallback (the
`override-status` path may also never notify listeners even on a real HAL
escalation on some OEM ROMs).

Cosmetic 1 (start_gate.duration_ms bogus on pass path) — `gateDurationMs =
    (state.gate.confirmedAt ?? 0) - (state.gate.startedAt ?? 0)`: when
`state.gate.startedAt` is null on the pass path it computes `confirmedAt - 0`,
leaking the absolute `performance.now()` value (≈59929 ms ≈ time since
process start).

Cosmetic 2 (ViewManagerPropertyUpdater warning) — `HumynGateCameraViewManager`
had zero `@ReactProp` setters, so RN's `ViewManagersPropertyCache` logs
"Could not find generated setter for class HumynGateCameraViewManager" on
every `<HumynGateCameraView>` mount (it looks for a codegen'd `$$PropsSetter`,
then any `@ReactProp` method, finds neither, warns). Benign.

fix: |
Bug 1 — CaptureSession.kt: `stop()` now, after `closeSegmentResources()`
stamps `endedAtNs`, checks `segmentsCompleted == 0 && durationMs < 60_000`;
if so it calls a new `discardSegmentArtifacts(seg)` (deletes mp4/csv/json/sidecar)
INSTEAD of running FinalizeWorker. A session that already auto-segmented
(≥10 min) keeps a trailing short segment (segments are independent units).
New const `MIN_KEPT_DURATION_MS = 60_000`.

Bug 2 — HumynBatteryModule.kt: new `getCurrentLevel()` ReactMethod that reads
the sticky `ACTION_BATTERY_CHANGED` via `registerReceiver(null, filter)`
synchronously (no receiver registered), resolving `{level, isCharging}`
(level = -1 when unknown). HumynBattery.ts exposes `getCurrentLevel()`
(never throws — `{level:-1}` fallback). useRecordingLifecycle.ts:
`checkStartGuards()` now `await batteryGetCurrentLevel()` on demand and
falls back to the cached event value only if the native read returns
"unknown".

Bug 3(a) — HumynCaptureModule.kt: new `getPendingRecovery()` ReactMethod
returning `{recovered: string[]}` from `CaptureLaunchSweep.pendingRecovery`
(does NOT clear the holder — both channels read it; the JS side dedups).
`onHostResume` no longer latches `crashRecoveryEmitted` on an empty holder
and no longer clears the holder. HumynCapture.ts exposes `getPendingRecovery()`.
bootRecoveryListener.ts rewritten with TWO channels: a synchronous
`getPendingRecovery()` query (reliable, no boot-timing race) AND the legacy
`onCrashRecovery` event; shows the Home toast the first time either reports
`recovered.length > 0` (validated string[]), longer `RECOVERY_TOAST_MS=5000`,
`delivered` flag for one-shot, removes the event sub only after a toast
actually showed. App.tsx: `installBootRecoveryListener()` moved from
module-eval into a `useEffect` so `<ToastHost />` is mounted before the
query resolves.

Bug 3(b) — CaptureLaunchSweep.kt rewritten: an orphan `.mp4` + valid sidecar
now goes through `tryReFinalize()`: `mp4LooksPlayable()` does a top-level
ISO-BMFF box scan (header-only; O(box count)) for `ftyp` + `moov` + ≥1
`moof`; if present → SHA the mp4/csv, compose `video_metadata.json` from the
sidecar (drift/IMU-floor degenerate — the per-frame timestamps were lost
with the crash; CLAUDE.md's drift gate is telemetry-only), `writeAtomic`,
delete the sidecar → complete triple, base reported "recovered". If absent
(the 778-byte stub) → discard the triple (mp4 + csv + sidecar), NOT
"recovered". D-FS-04's "discard if MP4 corrupt (header parse fails)" honored.

Bug 3(c) — CaptureLaunchSweep.kt: new Pass 3 deletes any `.session.json` with
no matching `.mp4` (plus a lone `.csv` residue).

Bug 4 — ThermalGate.kt: new `currentStatus()` (synchronous
`getCurrentThermalStatus()` read). CaptureSession.kt: new 5 s thermal poll
(`startThermalPoll()`/`stopThermalPoll()` on the session HandlerThread) +
`onThermalEscalation(status)` single chokepoint used by BOTH the
`OnThermalStatusChangedListener` AND the poll, de-duplicated via
`@Volatile thermalAbortFired` (emits `onThermalAbort` once, posts the 2.5 s
graceful self-stop). Poll cancelled in `stop()` and `cleanupAfterPreFlightFailure`.

Cosmetic 1 — RecordingScreen.tsx: monotonic `gateStartMsRef` (captured in the
gate-enter effect) + `gateConfirmedMsRef` (captured at the top of the
gate.confirmed→active effect, before the SETTLE_MS handoff); `gateDurationMs`
= clamp(confirmed − start, 0, 5 min), or 0 if start is null. No longer
derived from `state.gate.{startedAt,confirmedAt}`.

Cosmetic 2 — HumynGateCameraViewManager.kt: one no-op `@ReactProp(name="gateActive")`
setter so RN finds at least one `@ReactProp` and skips the warning.

verification: |

- apps/mobile vitest: 597 tests pass (590 pre-existing + 7 new for
  HumynBattery.getCurrentLevel and HumynCapture.getPendingRecovery);
  crashRecoveryToast.test.tsx + CaptureLaunchSweepTest.kt rewritten for the
  new re-finalize/discard + dual-channel-toast contracts.
- apps/mobile `tsc --noEmit`: clean.
- apps/mobile/android `:app:compileApkRolloutDebugKotlin`: clean (all 4 fixes
  - cosmetics compile against the real Android toolchain).
- Kotlin Robolectric unit tests (`testApkRolloutDebugUnitTest`) CANNOT run in
  this dev env: the test source set fails to compile due to a PRE-EXISTING,
  unrelated error in `HumynHandDetectorModuleTest.kt` ("Cannot create an
  instance of an abstract class", lines 65/85 — present on the clean tree too).
  Updated CaptureLaunchSweepTest.kt is authored to the new contract but not
  executed here; it'll run on a working Android toolchain during the orchestrator's
  on-hardware re-walk prep.
- On-hardware confirmation (Pixel 10a 5C161JEA304304) is the orchestrator's
  re-walk of 04-MANUAL-SMOKE.md, not this session: bug 1 (ls files/recordings/
  after a <60s discard), bug 2 (dumpsys battery set level 4 → record refused),
  bug 3 (am force-stop mid-record + relaunch → Home toast + orphan re-finalized-
  or-discarded + old sidecar swept), bug 4 (cmd thermalservice override-status 4
  → pill/tones/vibrate/voice/auto-stop within ~5–7 s — the poll fires every 5 s).

Unit/integration-testable here: bug 1 logic (Kotlin — pending the test-set
compile fix), bug 2 (JS + Kotlin signature), bug 3(a) dual-channel toast (JS,
7+ tests pass), bug 3(b)/(c) sweep (Kotlin test authored — pending compile
fix), cosmetic 1 (JS — covered indirectly by recState/RecordingScreen tests).
Requires the on-hardware re-walk to fully confirm: bug 4 (the override-status
listener-vs-poll behavior is device/ROM-specific — the poll IS verified to be
registered + cancelled by inspection), bug 1/2/3 end-to-end on real hardware.

files_changed: |
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureLaunchSweep.kt
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/HumynCaptureModule.kt
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/ThermalGate.kt
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/battery/HumynBatteryModule.kt
apps/mobile/android/app/src/main/java/ai/humynlabs/capture/gatecamera/HumynGateCameraViewManager.kt
apps/mobile/src/native/HumynBattery.ts
apps/mobile/src/native/HumynCapture.ts
apps/mobile/src/screens/recording/useRecordingLifecycle.ts
apps/mobile/src/screens/recording/RecordingScreen.tsx
apps/mobile/src/boot/bootRecoveryListener.ts
apps/mobile/App.tsx
apps/mobile/**tests**/screens/recording/crashRecoveryToast.test.tsx (rewritten)
apps/mobile/**tests**/native/HumynBattery.test.ts (added getCurrentLevel tests)
apps/mobile/**tests**/native/HumynCapture.test.ts (added getPendingRecovery tests)
apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CaptureLaunchSweepTest.kt (rewritten for new contract)

## Re-walk verification (2026-05-12, on-hardware — Pixel 10a 5C161JEA304304, Android 16, operator Adnaan Mohammed)

All four bugs verified fixed on hardware via the `04-MANUAL-SMOKE.md` re-walk (verdict YES):

- **Bug 1 (sub-60 s discard deletes):** X-modal → Stop on a ~45 s recording → "Recording too short — discarded." toast + `files/recordings/` empty (logcat: `CaptureSession.stop()` → `discardSegmentArtifacts`). ✓
- **Bug 2 (<5 % battery refuse-to-start):** `dumpsys battery unplug && set status 3 && set level 4` → tap record → refused with "Battery too low to start a recording. Charge to at least 15%." toast, no gate/recording (logcat: no FGS / no `CaptureSession`). ✓
- **Bug 3 (force-quit recovery):** ~60 s recording → `am force-stop` → relaunch → Home toast "Recording recovered after force-quit — uploading." ✓ + orphan re-finalized into a `{base}.{mp4,csv,json}` triple, on-disk SHAs match the composed metadata, `.session.json` deleted ✓ (logcat: `CaptureLaunchSweep: ... — re-finalized into triple`, `onCrashRecovery emitted — recovered=1`, `[bootRecovery] getPendingRecovery → {"recovered":[...]}` → `showToast`). A <30 s force-quit (before the first `moof` flush) → `CaptureLaunchSweep: ... — mp4 unrecoverable, discarding triple` → stub mp4 + csv + sidecar all deleted, no misleading toast ✓. A pre-existing lone `_002.session.json` → swept on a later launch (`orphan_sidecar_no_mp4=…002 — deleting`) ✓.
- **Bug 4 (mid-record thermal abort):** `cmd thermalservice override-status 4` mid-record → "Phone too hot" pill + 800 ms vibrate + voice "Phone too hot, stopping recording" + graceful self-stop within ~2.5 s + "Recording stopped — phone needs to cool." toast ✓ (logcat: `onThermalEscalation(status=4)` → 2.5 s delayed `stop()`). Pre-record `override-status 3` → `start()` rejects `thermal_throttling` (logcat: `start() failed — code=thermal_throttling`) + voice "Phone too warm" + stays in Ready ✓. (The async OS `OnThermalStatusChangedListener` actually delivered the override callback this run; the new 5 s poll is the belt-and-suspenders backup; both route through one de-duped `thermalAbortFired` chokepoint.)
- **Cosmetic 1 (`start_gate.duration_ms`):** a gate-pass stamped `duration_ms: 1943` (sane); identical across an auto-segment cut. ✓
- **Cosmetic 2 (`HumynGateCameraViewManager` warning):** no longer in logcat on `<HumynGateCameraView>` mount. ✓

### Bonus bug found+fixed mid-round (NOT in the original four)

**Auto-segment cut deadlocked the session HandlerThread.** `openCameraSync` / `openCaptureSession` passed `sessionHandler` as the handler for the Camera2 `StateCallback`, then blocked on a `CountDownLatch` the callback counts down. The FIRST segment open is fine — `CaptureSession.start()` runs on the capture-executor thread, so the callback dispatches on `sessionHandler` (a different thread). But `rotateSegment()` runs _on_ `sessionHandler` (posted via `sessionHandler.post { rotateSegment() }`) → `openSegment` → `openCameraSync` → `latch.await` on `sessionHandler`, while the camera framework's `onOpened` post sat behind it on the same looper → 2 s timeout → `IllegalStateException("camera_open_timeout")` → `onError(segment_open_failed)` → `onError(rotate_failed)` → session silently dead, no segment 2. Surfaced on the re-walk's first ~3½ min recording (the first walk's §3 "auto-cut verified" was apparently imprecise — its §5b "segments" `_003`/`_007`/`_008` are non-consecutive = separate recordings, not auto-cuts). **Fix:** a dedicated `HumynCapture-CameraCb` HandlerThread for the Camera2 framework callbacks (`openCamera` + `createCaptureSession`), distinct from `sessionHandler`, quit in `cleanupAfterPreFlightFailure` + `stop()`. **Verified:** ~3½ min recording → clean SILENT ~2-min auto-cut (no `onError`, camera re-opened for seg 2 in ~0.8 s) → two consecutive triples `_130130_001` (120.7 s) + `_130331_002` (90.8 s) with identical `start_gate` blocks (CAP-09/CAP-10) + ffprobe-confirmed spec-compliance + matching SHAs.

### New follow-up findings (non-blocking — filed to `04-COSMETIC-GAPS.md`)

- `HumynBeep.playTone` alert tones (battery-15 % 520 Hz beep + thermal-abort descending tone sequence) were inaudible on the walk — almost certainly the device's near-zero media volume (`AHal::Waves: ... MaxVolume: 0.0362078` in logcat), not a code regression; needs a re-check with media volume up.
- Battery-critical (5 %) / thermal mid-record stop leaves you on RecordingScreen-'ready' (with the <60 s "discarded" toast for a short take) rather than routing to Home — debatable; the normal sub-60 s discard flow does the same.
- The crash-recovery Home toast uses a 15 s duration as a workaround (it fires while the SplashScreen bootstrap is still up); proper fix = defer it to the post-bootstrap / Home-mount moment.
- Force-quit recovery only salvages a recording that crossed a 30 s `moof` flush (inherent to the fragmented-MP4 design — `FragmentedMuxerWrapper` writes a `moof` every 30 s); a crash in the first ~30 s leaves only the init segment, which is correctly discarded. Phase-5 upload should tolerate a recovered segment's `duration_seconds: 0` + null `imu_video_drift_*` / `imu_min_rate_*`.

### Net code changes vs. the session-manager fix (this re-walk session)

- `apps/mobile/android/.../capture/CaptureSession.kt` — added the `HumynCapture-CameraCb` HandlerThread + swapped `openCameraSync` / `openCaptureSession` to dispatch the Camera2 `StateCallback` on it (the auto-segment-deadlock fix); kept a small `Log.e` on the `openSegment` / `rotateSegment` `onError` paths and `Log.w` on `onThermalEscalation`; reverted the temporary `thermalPoll tick` / `stop()`-call-trace debug logging.
- `apps/mobile/android/.../capture/HumynCaptureModule.kt` — added a `Log.e("HumynCapture", "start() failed — code=…", t)` on the `start()` reject path (kept — genuinely useful; `start()` rejections were silent before); reverted the temporary `stop()`-call-trace log.
- `apps/mobile/android/.../capture/SegmentDurationConfig.kt` — temporarily set a 2-min `DEBUG_REVERT` override for the re-walk's auto-segment test, then reverted to the original 10-min form (net no change).
- `apps/mobile/src/boot/bootRecoveryListener.ts` — `RECOVERY_TOAST_MS` 5 s → 15 s (the toast was firing on the SplashScreen and fading before Home — that was the actual "no toast" cause); reverted the temporary `[bootRecovery]` `console.log`s.
- `apps/mobile/__tests__/screens/recording/crashRecoveryToast.test.tsx` — `advanceTimersByTime(6_000)` → `20_000` to match the 15 s `RECOVERY_TOAST_MS`.
- `apps/mobile` vitest 597 pass, `tsc --noEmit` clean, `:app:assembleApkRolloutDebug` builds; the apkRollout debug APK boots clean on hardware (Crashlytics init OK, no red box).

(Pre-existing, unrelated, NOT touched: the `apps/mobile/android/.../HumynHandDetectorModuleTest.kt` test-source-set compile error blocking `testApkRolloutDebugUnitTest`; the `react-native-reanimated` RN-0.83 patch note — the app builds & runs fine in this env regardless.)
