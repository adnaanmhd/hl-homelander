---
phase: 260522-elm-add-camera-intrinsics-cam-imu-offset-cal
reviewed: 2026-05-22T00:00:00Z
depth: quick
files_reviewed: 10
files_reviewed_list:
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
  - apps/api/src/db/schema.ts
  - apps/api/src/db/migrations/0009_recordings_calibration.sql
  - apps/api/src/routes/recordings/init.ts
  - shared/types/src/recording.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Quick Task 260522-elm: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** quick (+ targeted standard reads of the high-risk files)
**Files Reviewed:** 10
**Status:** issues_found (2 WARNING, 3 INFO — no BLOCKERs)

## Summary

Reviewed the camera-intrinsics + cam-IMU offset calibration + recording-id filename-prefix
change (metadata schema 1.1.0 -> 1.2.0). All six owner-flagged high-risk areas were traced
to ground truth and verified PASS:

1. **FilenameGenerator NNN-scan** — PASS. The `ulidPrefixPattern` char class
   `[0-9A-HJKMNP-TV-Z]` was checked against the actual minter alphabet in
   `UlidGenerator.CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"` — the regex covers
   the alphabet exactly (Q is in `P-T`, W is in `V-Z`; no over-match into I/L/O/U). Legacy
   un-prefixed files cannot false-match (the `_` after YYYYMMDD lands at index 8, breaking
   any 26-char run), so the strip is a no-op on them and the `split("_")` index-2 NNN parse
   still works. Mixed dirs honored. No collision risk.
2. **metadata.json byte-stability** — PASS. `MetadataComposer.compose()` appends
   `.put("calibration", calibration)` AFTER `.put("metadata", metadata)`; no existing key was
   reordered or reformatted. Purely additive.
3. **Calibration null-fallback contract** — PASS. `CameraCalibrationReader.read()` never
   throws (every `chars.get()` is wrapped in `safeGet`'s `catch (_: Throwable)`); null chars,
   short/absent `LENS_INTRINSIC_CALIBRATION`, and `LENS_POSE_REFERENCE != GYROSCOPE` all route
   to full-key null-fallback blocks with the correct source flags. `CalibrationJson` emits the
   full key structure in every path.
4. **Calibration jsonb migration** — PASS. `0009` uses `ADD COLUMN IF NOT EXISTS ... jsonb`
   (nullable, idempotent). The runner (`apps/api/scripts/migrate.ts`) discovers raw `.sql`
   files lexicographically and tracks them in `schema_migrations` (the drizzle `_journal.json`
   is metadata-only and not consulted by this runner, though its 0009 entry is consistent).
   Applies in its own TX. Backward-compatible with existing rows.
5. **zod validation on /recordings/init** — PASS. `calibration` is
   `CalibrationSchema.nullable().optional()`; absent (old clients) and explicit-null payloads
   both validate, and the uncalibrated device block (model + intrinsics_source present, params
   numbers-or-null via `z.record(z.string(), z.number().nullable())`) passes. Persisted only on
   the new-row INSERT (`body.calibration ?? null`), not on the idempotent re-presign path.
6. **S3 object keys unchanged** — PASS. The `{recordingId}_` prefix is applied only to the
   local on-disk `filenameBase`; the upload path PUTs to the fixed `recordingKeys()`
   (video.mp4 / imu.csv / metadata.json). No S3 key derives from the local filename.

The two WARNINGs below are genuine concerns that should be looked at; neither blocks ship.

## Warnings

### WR-01: T_cam_imu rotation/translation convention is unverified against Camera2 pose semantics

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt:194-203`
**Issue:** `tCamImu` is built as `homogeneous(rot, [tx,ty,tz])` directly from
`LENS_POSE_ROTATION` (a quaternion) and `LENS_POSE_TRANSLATION`. Per the Camera2 spec,
`LENS_POSE_ROTATION` is defined as the rotation **from the android-sensor coordinate frame to
the camera frame**, and `LENS_POSE_TRANSLATION` is the camera-optical-center position **in the
android-sensor frame** — i.e. the raw values describe a `T_imu_cam`-flavored relationship, not
necessarily the `T_cam_imu` the field name claims. The code labels the as-is matrix `tCamImu`
and the transpose-inverse `tImuCam`, which may be exactly inverted from the meta.json
convention (`T_cam_imu` consumed downstream by the training pipeline). Because almost every
Pixel reports UNCALIBRATED (null path), this is latent — but the first device that DOES report
a factory pose will emit a possibly-flipped extrinsic with no in-app signal.
**Fix:** Validate the rotation/translation direction against the SPC2 reference rig's meta.json
on a real device that reports `LENS_POSE_REFERENCE_GYROSCOPE` (this is already named a MANUAL
on-device smoke item in the file header — make it a blocking smoke check before any non-null
extrinsic is trusted by training, and add a docstring note that the convention is
unverified). Confirm whether `T_cam_imu` should be `homogeneous(rot, t)` or `invertRigid(rot, t)`.

### WR-02: metadata.filename / imu_filename value changed shape — confirm no downstream consumer parses them

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt:161-162` (`mp4Filename = "${seg.filenameBase}.mp4"`), surfaced at `MetadataComposer.kt:286,289`
**Issue:** `metadata.filename` and `metadata.imu_filename` now carry the recordingId-prefixed
base (e.g. `01HZX..._20260505_001234_005.mp4`) instead of the legacy un-prefixed
`20260505_001234_005.mp4`. This is a value change inside the metadata block (keys unchanged, so
byte-stability of keys is fine), but any server-side or training-pipeline code that parses
`filename`/`imu_filename` for the date-tail, NNN, or expects a fixed format will silently see a
new shape. The S3 object keys are unaffected (verified), so upload integrity is fine.
**Fix:** Grep the backend + training ingest for `imu_filename` / `filename` parsing. If nothing
parses them (they appear to be informational provenance only), document that explicitly in the
quick-task SUMMARY so the format change is recorded. If something does parse them, either keep
the prefix out of the metadata field or update the parser.

## Info

### IN-01: `arrayInt` uses `getInt` on a resolution element that the writer emits as Int — fine, but type-fragile on round-trip

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt:489-490`
**Issue:** `arrayInt` calls `arr.getInt(idx)`. The writer always puts Ints
(`resolutionArrayOrNull`), so the sidecar round-trip is safe. If a future schema or an
externally-authored sidecar stored resolution as a double (`1920.0`), `org.json.getInt` would
truncate rather than throw, but the whole block is in the `fromJson` try/catch anyway.
**Fix:** None required; optional `optInt`/range-tolerant read if external sidecars ever appear.

### IN-02: `quaternionToRotationMatrix` zero-norm -> identity is silent

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt:277-284`
**Issue:** A zero-norm quaternion degrades to identity rotation with no log/flag. A genuine
all-zero `LENS_POSE_ROTATION` would then emit a misleading identity-rotation extrinsic stamped
`extrinsics_source = "camera2"` (looks calibrated). Low likelihood (a device reporting GYROSCOPE
pose reference with an all-zero quaternion is malformed firmware).
**Fix:** Optional — treat a zero-norm quaternion as the no-imu fallback
(`extrinsics_source = "camera2_no_imu_reference"`) instead of identity, so an obviously-bad
pose is not labeled calibrated.

### IN-03: `clock_sync_note` default on read is `""` while the writer fallback is the full unshared string

**File:** `apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt:457`
**Issue:** `CalibrationJson.fromJson` defaults `clockSyncNote` to `""` via
`ext.optString("clock_sync_note", "")`, whereas every writer path emits a non-empty note
(`CLOCK_SYNC_SHARED` / `CLOCK_SYNC_UNSHARED` / the fallback string). A re-finalized older sidecar
missing the key would round-trip an empty `clock_sync_note` into metadata.json. Cosmetic — the
field is human-readable telemetry, not parsed.
**Fix:** Default to the unshared string (matching `uncalibratedFallback`) for consistency:
`ext.optString("clock_sync_note", "camera timestamps not on the shared boottime clock")`.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
