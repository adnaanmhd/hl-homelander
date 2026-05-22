---
phase: quick-260522-elm
verified: 2026-05-22T00:00:00Z
status: human_needed
score: 12/12 must-have truths verified (CI-verifiable scope); 1 on-hardware smoke item outstanding
overrides_applied: 0
human_verification:
  - test: 'On a real Pixel, capture a segment and inspect metadata.json calibration.camera.intrinsics_source and calibration.cam_imu_extrinsics.extrinsics_source'
    expected: "intrinsics_source reflects the device's actual calibration state; if the ultrawide reports a factory calibration, non-null fx/fy/cx/cy; if LENS_POSE_REFERENCE == GYROSCOPE, non-null T_cam_imu. On most Pixels the UNCALIBRATED null-fallback (camera2_uncalibrated / camera2_no_imu_reference) is the expected output."
    why_human: 'CameraCharacteristics is null in JVM/CI; genuine non-null Camera2 intrinsics/extrinsics values exist only on real Pixel hardware whose ultrawide reports factory calibration. JVM/CI can only verify the null-fallback path + full key structure + pure math helpers.'
  - test: 'If a non-null extrinsic is ever observed on-device, validate the T_cam_imu rotation/translation direction against the SPC2 meta.json convention before training trusts it (REVIEW WR-01)'
    expected: 'T_cam_imu / T_imu_cam direction matches the meta.json cam-IMU convention; the as-is homogeneous(rot,t) vs invertRigid(rot,t) labeling is correct.'
    why_human: 'Camera2 LENS_POSE_ROTATION/TRANSLATION semantics describe an imu->cam-flavored relationship; the convention is unverified against meta.json and only observable on a device reporting GYROSCOPE pose reference. Latent (null on most Pixels) but should block trust in any non-null extrinsic.'
notes:
  - "STATE.md was NOT updated with a 2026-05-22 entry (Task 4 deliverable). Last activity still reads 2026-05-18; 0 mentions of 260522. SUMMARY deferred this to 'the orchestrator's docs commit'. Non-blocking doc-tracking miss — does not affect the capture/backend goal — but should be closed in the docs commit. DATA-MODEL.md / REQUIREMENTS.md / CLAUDE.md were all updated correctly."
---

# Quick 260522-elm: Camera Intrinsics + Cam-IMU Offset Calibration + Filename Prefix Verification Report

**Phase Goal:** Add camera intrinsics (live Camera2, ultrawide physical sub-camera), cam-IMU offset calibration (temporal + spatial), and recording-id ULID filename prefixing to per-segment metadata.json (Android only); bump metadata schema 1.1.0 -> 1.2.0; thread a `calibration jsonb` column through the backend /recordings/init path; update docs.
**Verified:** 2026-05-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | On-disk video/imu/metadata filename prefixed with 26-char recordingId ULID `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`          | VERIFIED | CaptureSession.kt:301 `val filenameBase = "${recordingId}_$base"`; files built from it L303-306; recordingId = `UlidGenerator.next()` (L200)                                                                                                                                                                                                                         |
| 2   | FilenameGenerator derives correct per-day NNN despite leading ULID prefix                                                       | VERIFIED | FilenameGenerator.kt:47 `ulidPrefixPattern = Regex("^[0-9A-HJKMNP-TV-Z]{26}_")`; stripUlidPrefix (L88-91) runs before `startsWith(today_)` + `split("_").getOrNull(2)` (L69-73); legacy un-prefixed files fall through unchanged                                                                                                                                     |
| 3   | metadata.filename / imu_filename carry the ULID-prefixed names                                                                  | VERIFIED | FinalizeWorker.kt:161-162 `mp4Filename = "${seg.filenameBase}.mp4"` / `.csv` — uses the prefixed filenameBase; fixture L157/160 shows prefixed names                                                                                                                                                                                                                 |
| 4   | S3 object keys UNCHANGED — literally video.mp4 / imu.csv / metadata.json                                                        | VERIFIED | s3-client.ts:46-48 `recordingKeys()` derives keys from `{userId, recordingId}`, never the local filename; init.ts:348-350 uses `keys.video/imu/metadata`                                                                                                                                                                                                             |
| 5   | metadata.json (1.2.0) ALWAYS carries top-level `calibration` block with full key structure even when null/uncalibrated          | VERIFIED | MetadataComposer.kt:365-367 `sidecar.calibration ?.let { CalibrationJson.toJson } ?: CalibrationJson.uncalibratedFallback()`; emitted L376 AFTER metadata (byte-stable); CalibrationJson.uncalibratedFallback (L401-425) emits full key set; MetadataSchemaConformanceTest enforces key set + always-present calibration                                             |
| 6   | Camera intrinsics read from the ULTRAWIDE physical sub-camera's CameraCharacteristics                                           | VERIFIED | CaptureSession.kt:319 `CameraCalibrationReader.read(pick.ultrawideChars, pick.openableChars)`; readIntrinsics uses ultrawideChars (CameraCalibrationReader.kt:100,108)                                                                                                                                                                                               |
| 7   | LENS uncalibrated -> params null + intrinsics_source="camera2_uncalibrated"; real values -> "camera2"                           | VERIFIED | CameraCalibrationReader.kt:112-135 (calibrated path stamps SOURCE_CALIBRATED), L138-151 (uncalibratedIntrinsics stamps SOURCE_UNCALIBRATED); short/null LENS_INTRINSIC_CALIBRATION -> fallback L113-117                                                                                                                                                              |
| 8   | cam_imu_extrinsics carries T_cam_imu/T_imu_cam/translation_mm/timeshift/meaning/clock_sync_note/source, null when not GYROSCOPE | VERIFIED | CameraCalibrationReader.kt:163-224; gates on LENS_POSE_REFERENCE_GYROSCOPE (L175-180); null path -> noImuExtrinsics + SOURCE_NO_IMU_REF; timeshift 0.0 + verbatim meaning + clock-sync from SENSOR_INFO_TIMESTAMP_SOURCE (L226-236)                                                                                                                                  |
| 9   | Existing imu*video_drift*{max,mean,p99}\_ms untouched — calibration is additive                                                 | VERIFIED | MetadataComposer.kt:294-296 drift fields unchanged inside metadata block; calibration appended as a separate top-level sibling L376                                                                                                                                                                                                                                  |
| 10  | Capture never blocks or throws on missing/null calibration                                                                      | VERIFIED | CameraCalibrationReader: every chars.get wrapped in safeGet try/catch (L336-342); null chars -> fallbacks (L109, L169); reader returns, never throws                                                                                                                                                                                                                 |
| 11  | recordings table has `calibration jsonb`; /init accepts + validates + persists                                                  | VERIFIED | schema.ts:184 `calibration: jsonb('calibration')`; recording.ts:69-89 CalibrationSchema + L119 `calibration: CalibrationSchema.nullable().optional()`; init.ts:362 `calibration: body.calibration ?? null` on new-row INSERT; migration 0009 ADD COLUMN IF NOT EXISTS; backend vitest 209 passed (orchestrator) incl. recordings-init full/uncalibrated/absent cases |
| 12  | Hash-verify worker unaffected                                                                                                   | VERIFIED | hash-verify.ts re-hashes by recordingId only, no metadata/calibration refs; sqs-poller.ts references metadata.json solely as an object-key match for event-collapse, never parses calibration                                                                                                                                                                        |

**Score:** 12/12 truths verified within the CI-verifiable scope.

### Required Artifacts

| Artifact                                                     | Expected                                          | Status   | Details                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/android/.../CameraCalibrationReader.kt`         | Camera2 chars -> CameraCalibration, null-tolerant | VERIFIED | 505 LOC; `object CameraCalibrationReader` + `object CalibrationJson` + pure math helpers; substantive, wired into CaptureSession  |
| `apps/mobile/android/.../MetadataComposer.kt`                | schema 1.2.0 emit + top-level calibration         | VERIFIED | CURRENT_SCHEMA_VERSION = "1.2.0" (L57); calibration emitted L376                                                                  |
| `apps/api/src/db/migrations/0009_recordings_calibration.sql` | recordings.calibration jsonb                      | VERIFIED | `ALTER TABLE "recordings" ADD COLUMN IF NOT EXISTS "calibration" jsonb;`; journal entry tag `0009_recordings_calibration` present |

### Key Link Verification

| From                       | To                                                                    | Via                                             | Status | Details                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CaptureSession.openSegment | CameraCalibrationReader.read(pick.ultrawideChars, pick.openableChars) | calibration at segment open, stashed on sidecar | WIRED  | CaptureSession.kt:319 + L376 stashed on SidecarPayload.calibration                                                                        |
| FinalizeWorker.finalize    | MetadataComposer.compose(... calibration ...)                         | sidecar -> adaptSidecar -> compose              | WIRED  | FinalizeWorker.kt:149 adaptSidecar -> L485 `calibration = s.calibration` -> L183 compose; MetadataComposer reads sidecar.calibration L365 |
| init.ts                    | schema.recordings.calibration                                         | INSERT persists validated jsonb                 | WIRED  | init.ts:362 `calibration: body.calibration ?? null` in db.insert(schema.recordings).values                                                |

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable       | Source                                                       | Produces Real Data                                 | Status                                                            |
| ------------------------------- | ------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------- |
| metadata.json calibration block | sidecar.calibration | CameraCalibrationReader.read(ultrawideChars) at segment open | On-device only — null on JVM/most Pixels by design | FLOWING (structure) / on-device value verification = human_needed |
| recordings.calibration column   | body.calibration    | client metadata.json calibration -> /recordings/init         | Yes (round-trips via zod -> INSERT)                | FLOWING — recordings-init tests assert round-trip                 |

### Behavioral Spot-Checks

| Behavior                                  | Command                                  | Result                                                                                                                                   | Status                           |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Android capture unit suite                | gradle (orchestrator-run)                | CameraCalibrationReaderTest 13, FilenameGeneratorTest 10, MetadataComposerLiteralsTest 21, MetadataSchemaConformanceTest 14 — 0 failures | PASS (orchestrator)              |
| Backend vitest incl. recordings-init      | pnpm test (orchestrator, full dev stack) | 42 files / 209 passed, 2 skipped, 0 failed; migration 0009 applied                                                                       | PASS (orchestrator)              |
| DB calibration column / migration applied | psql                                     | psql not installed locally — relied on orchestrator confirmation (209 tests green against migrated DB)                                   | SKIP (verified via orchestrator) |

### Requirements Coverage

| Requirement   | Source Plan | Description                                                              | Status               | Evidence                                                            |
| ------------- | ----------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------- |
| CAPTURE-QA-07 | 260522-elm  | ULID filename prefix; per-day NNN scan strips ULID; S3 keys unchanged    | SATISFIED            | Truths 1-4; REQUIREMENTS.md L118 `[x]`; status table L472 Complete  |
| CAPTURE-QA-08 | 260522-elm  | Live-Camera2 intrinsics from ultrawide sub-camera; null fallback         | SATISFIED (CI scope) | Truths 5-7,10; REQUIREMENTS.md L119; on-device values = human smoke |
| CAPTURE-QA-09 | 260522-elm  | Cam-IMU offset; null when not GYROSCOPE; drift untouched; backend column | SATISFIED (CI scope) | Truths 8-9,11; REQUIREMENTS.md L120; on-device values = human smoke |

### Anti-Patterns Found

| File                       | Line    | Pattern                                                                                       | Severity | Impact                                                                                                                             |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CameraCalibrationReader.kt | 277-284 | zero-norm quaternion -> silent identity (REVIEW IN-02)                                        | Info     | Malformed firmware could stamp identity rotation as "camera2"; very low likelihood; null on most Pixels                            |
| CameraCalibrationReader.kt | 194-203 | T_cam_imu rotation/translation convention unverified vs Camera2 pose semantics (REVIEW WR-01) | Warning  | Latent — non-null extrinsic could be inverted vs meta.json convention; folded into human-verification item 2                       |
| FinalizeWorker.kt          | 161-162 | metadata.filename/imu_filename value shape changed (REVIEW WR-02)                             | Info     | Keys unchanged (byte-stable); S3 keys unaffected; sqs-poller/hash-verify do not parse these fields — verified no downstream parser |

### Human Verification Required

#### 1. On-device calibration values (genuine non-null path)

**Test:** Capture a segment on a real Pixel; inspect metadata.json `calibration.camera.intrinsics_source` and `calibration.cam_imu_extrinsics.extrinsics_source`.
**Expected:** Reflects the device's actual calibration state. If the ultrawide reports factory calibration -> non-null fx/fy/cx/cy; if LENS_POSE_REFERENCE == GYROSCOPE -> non-null T_cam_imu. On most Pixels the UNCALIBRATED null-fallback is the expected output.
**Why human:** CameraCharacteristics is null in JVM/CI; non-null values only exist on real hardware. (Stated as a manual smoke item in the plan + SUMMARY; per the verification-boundary rule this is NOT a gap.)

#### 2. T_cam_imu convention validation (REVIEW WR-01)

**Test:** If any non-null extrinsic is observed on-device, validate the rotation/translation direction against the SPC2 meta.json convention before training trusts it.
**Expected:** T_cam_imu / T_imu_cam direction matches the meta.json cam-IMU convention.
**Why human:** Camera2 pose semantics are imu->cam-flavored; the as-is labeling is unverified and only observable on a GYROSCOPE-pose-reference device.

### Gaps Summary

No goal-blocking gaps. All 12 observable truths are verified in the merged codebase: the ULID filename prefix + NNN-scan strip, the always-present schema-1.2.0 calibration block (ultrawide intrinsics + cam-IMU extrinsics with the correct null-fallback contract and source flags), untouched drift fields, the never-throw/never-block capture path, and the backend `recordings.calibration jsonb` column with zod-validated /recordings/init persistence. All 3 artifacts are substantive, all 3 key links wired, and the hash-verify worker is confirmed unaffected. Both the Android capture unit suite and the backend vitest run green (orchestrator-confirmed, full dev stack, migration 0009 applied).

The only outstanding item is the expected on-device hardware smoke for genuine non-null Camera2 intrinsics/extrinsics values (and, conditional on that, the WR-01 extrinsic-convention check) — explicitly out of CI scope per the verification boundary. Status is therefore `human_needed`, not `gaps_found`.

One non-blocking doc-tracking miss: STATE.md was not updated with a 2026-05-22 entry (Task 4 deliverable; SUMMARY deferred it to the orchestrator's docs commit). DATA-MODEL.md, REQUIREMENTS.md (CAPTURE-QA-07/08/09 + status table), and the CLAUDE.md 2026-05-22 banner were all updated correctly. Recommend closing the STATE.md entry in the docs commit.

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
