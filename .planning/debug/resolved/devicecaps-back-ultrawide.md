---
slug: devicecaps-back-ultrawide
status: resolved
trigger: 'DeviceCaps.kt selects wrong back camera for ultrawide dFOV measurement; Pixel 10a returns 83° (likely main wide ~78°) instead of back ultrawide ~120°. Same root cause as morning DeviceCapsTest Robolectric fail.'
created: 2026-05-10
updated: 2026-05-10
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 02-21 (manual smoke walk §4 — last leg)
---

# Debug — DeviceCaps.kt back-ultrawide camera selection

## Symptoms

| Field                    | Value                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Expected behavior**    | DeviceCaps probe returns ultrawide dFOV ≥110° for the back ultrawide camera on Pixel-class devices (real spec for Pixel 10a back ultrawide ≈ 120°).                                                                                                                                                                                                                                                    |
| **Actual behavior**      | On Pixel 10a (5C161JEA304304, Android 16 / API 36, apkRollout debug build from commit cc867b7), runtime probe returns `ultrawideDfovDeg = 83°`, fails the ≥110° gate. Compat screen correctly displays "Ultrawide camera 110°+ required (yours: 83°)". 83° is consistent with the main wide-angle (~78° dFOV at focal length ~5 mm), suggesting wrong-camera selection rather than a unit/formula bug. |
| **Error / failure mode** | `ultrawideDfov.pass = false` in compat result. No exceptions; the probe runs end-to-end (after commit cc867b7 declared HIGH_SAMPLING_RATE_SENSORS). Robolectric test mirror: `DeviceCapsTest.dfov for Pixel 7a back ultrawide: expected ~118-122°, got 134.7°` — separate test-fixture mismatch + a current Robolectric/SoLoader environment NPE; NOT the same root cause (see Eliminated).            |
| **Timeline**             | First end-to-end on-device compat probe today (2026-05-10) after the IMU permission fix unblocked the probe path. Plan 02-15 was `code-ready-smoke-deferred` — DeviceCaps.kt has never run against a real device until today.                                                                                                                                                                          |
| **Reproduction**         | (1) Backend up at :8080 (already running per pre-flight). (2) Pixel 10a connected, adb reverse tcp:8080 tcp:8080. (3) App data preserved (signed in + perms granted + compatLastResult fail). (4) Force-stop + relaunch app → gate decision tree drops to CompatRunningScreen → probe runs → ultrawide check fails at 83°.                                                                             |

## Current Focus

```yaml
hypothesis: 'On Pixel 10a (Camera2 LOGICAL_MULTI_CAMERA), `cameraManager.cameraIdList` exposes only TWO public cameras: ID 0 (logical back, default-physical = main wide, focal 4.53mm, sensor 6.40×4.80mm → 82.86° dFOV) and ID 1 (front). The back ultrawide is physical-camera ID 3 (focal 1.85mm, sensor 4.71×3.49mm → 115.4° dFOV), reachable ONLY via `LOGICAL_MULTI_CAMERA.physicalIds` + `mgr.getCameraCharacteristics(physicalId)`. `pickBackUltrawideCamera()` iterates only the public ID list, so it picks logical camera 0 whose default-physical reports the main-wide intrinsics, yielding 82.86° ≈ 83° (matches observation to 0.14°).'
test: 'ROOT CAUSE CONFIRMED via direct device evidence — see Evidence section. Math closes exactly:
  - Pixel 10a logical cam 0 default-physical: focal=4.53mm, sensor=6.40×4.80mm
  - diag = √(40.96+23.04) = √64.0 = 8.00mm
  - dFOV = 2·atan(8.00/9.06)·(180/π) = 82.86°  ←  matches device readout 83°
  - Pixel 10a physical cam 3 (ultrawide): focal=1.854mm, sensor=4.713×3.494mm
  - diag = √(22.21+12.21) = 5.867mm
  - dFOV = 2·atan(5.867/3.708)·(180/π) = 115.42°  ←  predicted post-fix value, clears 110° gate'
expecting: 'Fix: extend pickBackUltrawideCamera to ALSO enumerate physical sub-cameras (`CameraCharacteristics.LOGICAL_MULTI_CAMERA.physicalIds`) of any logical multi-camera with LENS_FACING=BACK, then min-focal across the FLATTENED set of (top-level back cams ∪ physical sub-cams of logical back cams). Prediction: Pixel 10a post-fix → ultrawideDfovDeg ≈ 115° (clears 110° gate).'
next_action: 'VERIFIED on-device — CompatPassScreen rendered after fix. Compact summary follows.'
reasoning_checkpoint: ''
tdd_checkpoint: ''
```

## Anti-patterns to refuse (per .continue-here.md "Critical Anti-Patterns")

- **Do NOT lower the 110° dFOV gate.** The capture spec is LOCKED in `idea-brief.md §2.1` and is the project's reason to exist (PROJECT.md core value). Acceptable post-fix Pixel 10a measurement: 115–125°. A fix that produces 100° is still wrong.
- **Do NOT downgrade IMU sampling rate** to dodge HIGH_SAMPLING_RATE_SENSORS — that bug is already fixed (commit cc867b7). The ultrawide bug is independent.
- **Do NOT touch** `apps/mobile/src/screens/signup/SignupScreen.tsx` or `apps/mobile/src/ui/primitives/Text.tsx` (Phase 3 Wave 1 cosmetic backlog; uncommitted by design per `feedback_functionality_first_during_smoke.md`).
- **Do NOT touch** `apps/mobile/.env.apkRollout`'s `API_BASE_URL=http://localhost:8080` — adb reverse is the validated transport on this Wi-Fi.
- If diagnostic logs are added to DeviceCaps.kt during investigation, sentinel-tag them with `DEBUG_REVERT_BEFORE_COMMIT` and confirm `git diff` is clean before any fix commit lands.

## Required reading (in order, before code edits)

1. `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt` — Kotlin native module; camera-selection logic.
2. `apps/mobile/android/app/src/test/java/ai/humynlabs/capture/compat/DeviceCapsTest.kt` — Robolectric.
3. `idea-brief.md §2.1` — LOCKED capture spec confirming ≥110° dFOV is non-negotiable.
4. `apps/mobile/src/services/compatService.ts` — JS orchestrator. Confirm wire shape (`ultrawideDfovDeg` field). DO NOT modify; works post-IMU fix.
5. `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md` §Pitfall 5 (lines 646-660) — pre-existing dFOV-camera-selection note that did NOT anticipate Camera2 LOGICAL_MULTI_CAMERA on modern Pixels.

## Live environment (verified at session open)

- Backend `http://localhost:8080/healthz` → `{"status":"ok"}` ✓
- `adb devices` → `5C161JEA304304 device` ✓
- `adb reverse --list` → `UsbFfs tcp:8080 tcp:8080` ✓
- App on device: apkRollout debug build from commit cc867b7; signed in, perms granted, compatLastResult shows ultrawide fail.

## Evidence

- 2026-05-10: Pixel 10a runtime probe → `ultrawideDfovDeg = 83°` (via on-device compat run). 83° ≈ Pixel main-wide spec.
- 2026-05-10: Read `DeviceCaps.kt`. `pickBackUltrawideCamera()` iterates `mgr.cameraIdList`, filters `LENS_FACING=BACK`, picks min-focal. Algorithm is sound for non-logical multi-cam devices but never expands `LOGICAL_MULTI_CAMERA.physicalIds`. **Sub-hypotheses (a) blind cameraIdList[0] and (b) filter-and-stop-at-first-match are eliminated** — the picker DOES enumerate and DOES use min-focal. The bug is upstream: it never sees the ultrawide because the public cameraIdList only contains the LOGICAL camera.
- 2026-05-10: `adb shell dumpsys media.camera` on Pixel 10a:
  - "Number of camera devices: 2" (public Camera2 IDs 0 and 1)
  - Logical camera 0: `LENS_FACING=BACK`, `LOGICAL_MULTI_CAMERA.physicalIds=[2,3]`, `availableCapabilities` includes `LOGICAL_MULTI_CAMERA`, `DefaultPhysicalCamId=2`.
  - Logical 0 default characteristics: `availableFocalLengths=[4.53]`, `physicalSize=[6.40, 4.80]`. Plug into formula → **82.86° dFOV** (matches device 83° exactly).
  - Physical sub-camera 2: `availableFocalLengths=[4.53]`, `physicalSize=[6.40, 4.80]` → main wide.
  - Physical sub-camera 3: `availableFocalLengths=[1.854]`, `physicalSize=[4.713, 3.494]` → ultrawide. **Predicted dFOV = 115.42°.**
- HAL-level dump confirms three back lenses ("RearWide hal id 3", "Rear hal id 2", "Front hal id 1"), with the back ultrawide being hal 3 = physical Camera2 ID 3.
- 2026-05-10: Test fixture `DeviceCapsTest.dfov for Pixel 7a back ultrawide` uses Sony IMX787 datasheet values (focal 1.93mm, sensor 7.40×5.55mm). Plugged into the diagonal formula → 134.68° (raw-package-sensor-diagonal). The test asserts 113-122° (marketed dFOV class). This is a **fixture mismatch**, not a production-code bug — marketed dFOV is post-crop/active-area, while the formula uses package physical size. Decoupled from the on-device 83° bug.
- 2026-05-10: Current Robolectric run shows ALL 6 tests fail with `NullPointerException at File.java:278` originating in `SoLoader.init` → `ApplicationSoSource.getNativeLibDirFromContext`, called unconditionally from `MainApplication.onCreate`. Tests never reach assertions. This is a separate test-environment regression from the on-device 83° bug; the 134.7° figure in the orchestrator brief was from an older run before the SoLoader env broke. Out of scope for this debug session per anti-pattern rules (functionality first; cosmetic/test cleanup deferred).
- Cross-reference: `02-RESEARCH.md §Pitfall 5` (lines 646-660) describes exactly the implemented algorithm. Research did not anticipate post-Pixel-7-class devices where the ultrawide is hidden inside a logical multi-camera. This is the documentation gap.
- 2026-05-10 post-fix: built + installed apkRollout debug, force-stopped + relaunched on Pixel 10a → CompatRunningScreen → probe completed → **CompatPassScreen rendered ("You're in. All checks passed.", Next button enabled)**. Since `compatService.ts` line 90 gates pass strictly on `caps.ultrawideDfovDeg >= 110`, the screen rendering is direct proof the dFOV is now ≥110° (predicted 115.42°). All other checks also pass.

## Eliminated

- **(a) blind cameraIdList[0] pick** — code DOES iterate the full list. Eliminated by reading source.
- **(b) filter LENS_FACING=BACK and stop at first match** — code uses `minByOrNull { focal }` over the filtered list. Eliminated by reading source.
- **(c) wrong dFOV formula or wrong axis** — formula is `2·atan(diag/(2·f))`, exactly correct. The 82.86° prediction from logical-cam intrinsics matches device 83° to 0.14°, proving the formula is right; the inputs (which camera) are wrong.
- **Robolectric Pixel 7a 134.7° fail is the SAME root cause** — Eliminated. The current Robolectric failure mode is environmental (SoLoader NPE), not assertion-driven; the historical 134.7° was a fixture-vs-marketed-dFOV mismatch, decoupled from the LOGICAL_MULTI_CAMERA enumeration bug fixed here.

## Resolution

```yaml
root_cause: |
  DeviceCaps.kt's pickBackUltrawideCamera() iterated only the PUBLIC Camera2
  cameraIdList. On modern Pixel-class devices the back is a single
  LOGICAL_MULTI_CAMERA whose physical sub-cameras (main wide, ultrawide,
  optional telephoto) live behind CameraCharacteristics.LOGICAL_MULTI_CAMERA.physicalIds.
  Reading the logical camera's default LENS_INFO_AVAILABLE_FOCAL_LENGTHS and
  SENSOR_INFO_PHYSICAL_SIZE returns the main-wide intrinsics (Pixel 10a:
  focal 4.53mm / sensor 6.40×4.80mm → 82.86° dFOV ≈ observed 83°). The
  ultrawide physical sub-camera (Pixel 10a physical ID 3: focal 1.854mm /
  sensor 4.713×3.494mm → 115.4° dFOV) was never visited.
fix: |
  Replaced pickBackUltrawideCamera with pickBackUltrawide returning a typed
  UltrawidePick(openableId, openableChars, ultrawideChars). The picker now
  flattens (top-level back cameras ∪ each top-level's
  CameraCharacteristics.physicalCameraIds on API 28+) and selects the min-focal
  candidate across the flattened set. Resolution / FPS / timestamp source still
  come from the openable LOGICAL parent (physical sub-cameras don't expose their
  own session config); only dFOV reads from the picked physical sub-camera's
  characteristics. Back-compat alias pickBackUltrawideCamera() preserved for
  callers/tests that only need the openable ID.
verification: |
  Built apkRollout debug from updated DeviceCaps.kt, installed on Pixel 10a
  (5C161JEA304304), force-stopped + relaunched. App routed to Compat screen,
  ran the probe, and rendered CompatPassScreen ("You're in. All checks
  passed.") — proving caps.ultrawideDfovDeg ≥ 110 (predicted 115.42° from the
  physical-3 sub-camera intrinsics dumped from `dumpsys media.camera`). The 83°
  failure is gone; no IMU regression (probe completes without HIGH_SAMPLING_RATE_SENSORS
  block — independently fixed in commit cc867b7).
files_changed:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/compat/DeviceCaps.kt
deferred:
  - DeviceCapsTest.kt fixture refresh + LOGICAL_MULTI_CAMERA fixture: out of
    scope for this functionality-first debug session. Current Robolectric env
    fails all tests at SoLoader init (separate regression). Track separately.
  - 02-RESEARCH.md §Pitfall 5 doc update to mention LOGICAL_MULTI_CAMERA
    expansion: optional documentation chore.
```
