---
phase: quick-260522-elm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 — filename prefix + ls-scan fix
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
  # Task 2 — Camera2 calibration reader + MetadataComposer calibration block + sidecar threading
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
  - apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataComposerLiteralsTest.kt
  - apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CameraCalibrationReaderTest.kt
  - apps/mobile/android/app/src/test/resources/video_metadata_v1_2_0_template.json
  # Task 3 — backend jsonb column + route + zod + migration + tests
  - apps/api/src/db/schema.ts
  - shared/types/src/recording.ts
  - apps/api/src/routes/recordings/init.ts
  - apps/api/src/db/migrations/0009_recordings_calibration.sql
  - apps/api/test/routes/recordings-init.test.ts
  # Task 4 — docs
  - DATA-MODEL.md
  - .planning/REQUIREMENTS.md
  - CLAUDE.md
  - .planning/STATE.md
autonomous: true
requirements: [CAPTURE-QA-07, CAPTURE-QA-08, CAPTURE-QA-09]

must_haves:
  truths:
    - "Every video.mp4 / imu.csv / metadata.json on-disk filename is prefixed with the segment's 26-char recordingId ULID: {recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}"
    - 'FilenameGenerator still derives the correct per-day NNN even though the on-disk files now carry a leading ULID prefix'
    - 'metadata.filename / metadata.imu_filename carry the new ULID-prefixed names'
    - 'S3 object keys are UNCHANGED — still literally video.mp4 / imu.csv / metadata.json (recordingId is the folder, not the object name)'
    - 'metadata.json (schema 1.2.0) ALWAYS carries a top-level `calibration` block with the full key structure — camera intrinsics + cam_imu_extrinsics — present even when CameraCharacteristics is null (JVM tests) or uncalibrated (most Pixels)'
    - "Camera intrinsics are read from the ULTRAWIDE physical sub-camera's CameraCharacteristics (the lens HumynCapture actually records on), not the logical back camera"
    - 'When LENS calibration is null/UNCALIBRATED, intrinsics params are null + intrinsics_source = "camera2_uncalibrated"; when real values exist, source = "camera2"'
    - 'cam_imu_extrinsics carries T_cam_imu / T_imu_cam / T_cam_imu_translation_mm / timeshift_cam_imu_sec / timeshift_meaning / clock_sync_note / extrinsics_source, null when LENS_POSE_REFERENCE is not GYROSCOPE or values are null'
    - 'Existing imu_video_drift_{max,mean,p99}_ms fields are untouched — calibration ADDS offset/extrinsics telemetry'
    - 'Capture never blocks or throws on missing/null calibration'
    - 'recordings table has a `calibration jsonb` column; /recordings/init accepts + validates + persists the calibration block'
    - 'Hash-verify worker is unaffected (it re-hashes MP4 + CSV, not metadata.json)'
  artifacts:
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt'
      provides: 'Camera2 CameraCharacteristics → CameraCalibration data class with null-tolerant token mapping'
      contains: 'object CameraCalibrationReader'
    - path: 'apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt'
      provides: 'schema 1.2.0 compose() emitting the top-level calibration block'
      contains: '1.2.0'
    - path: 'apps/api/src/db/migrations/0009_recordings_calibration.sql'
      provides: 'recordings.calibration jsonb column'
      contains: 'ALTER TABLE'
  key_links:
    - from: 'CaptureSession.openSegment'
      to: 'CameraCalibrationReader.read(pick.ultrawideChars, pick.openableChars)'
      via: 'calibration captured at segment open, stashed on the sidecar'
      pattern: 'CameraCalibrationReader'
    - from: 'FinalizeWorker.finalize'
      to: 'MetadataComposer.compose(... calibration ...)'
      via: 'calibration threaded sidecar → FinalizeMetrics → compose'
      pattern: 'calibration'
    - from: 'apps/api/src/routes/recordings/init.ts'
      to: 'schema.recordings.calibration'
      via: 'INSERT persists the validated calibration jsonb'
      pattern: 'calibration'
---

<objective>
Add camera intrinsics, cam-IMU offset (temporal + spatial) calibration, and
recording-id filename prefixing to the per-segment metadata.json (Android only —
iOS native modules stay deferred). Bump metadata schema 1.1.0 → 1.2.0 and add a
single `calibration jsonb` column to the backend recordings table.

Purpose: emit calibration telemetry mirroring the SPC2 reference rig
(`meta.json` at repo root) so the training pipeline has per-segment intrinsics +
cam-IMU extrinsics, and prefix filenames with the recordingId so on-disk
artifacts are self-identifying. This is purely ADDITIVE — the existing metadata
shape (incl. `imu_video_drift_{max,mean,p99}_ms`), the capture spec, and the
drift gates are all unchanged.

Output:

- New `calibration` top-level block in metadata.json (schema 1.2.0), ALWAYS
  present with full key structure + null fallback.
- ULID-prefixed on-disk filenames; S3 object keys unchanged.
- `recordings.calibration jsonb` column + /recordings/init persistence.
- Doc updates across DATA-MODEL.md, REQUIREMENTS.md, CLAUDE.md, STATE.md.
  </objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@DATA-MODEL.md
@meta.json
@.planning/STATE.md

<critical_rules>
From CLAUDE.md — the executor MUST honor these:

- **Files never re-encoded.** metadata.json stays byte-stable EXCEPT the new
  top-level `calibration` block. Do NOT reorder, reformat, or rename any
  existing key (schema_version / recording_id / contributor_info / task_info /
  capture_device_info / metadata). The `calibration` block is purely additive,
  added as a NEW top-level sibling key.
- **Drift gates / capture spec UNCHANGED.** This adds offset/extrinsics
  telemetry ALONGSIDE the existing `imu_video_drift_{max,mean,p99}_ms` fields in
  the `metadata` block. It does not replace them, does not gate on calibration,
  and does not touch the ultrawide lens code or the fps/resolution cancel gates.
- **On-device upload queue is MMKV-backed (not Redis).** The hash-verify worker
  queue is the only Redis carve-out and is UNAFFECTED — it re-hashes MP4 + CSV
  only, never metadata.json. Do not touch the worker.
- **Android only.** iOS HumynCaptureIOS analogues stay deferred. Do not add iOS
  code.
- **Drift metrics = {max, mean, p99}** — three figures per segment, untouched.
  </critical_rules>

<interfaces>
<!-- Extracted from the codebase. Executor should use these directly. -->

KEY FILENAME / SESSION SITE — CaptureSession.openSegment (CaptureSession.kt ~L279):

```kotlin
val base = FilenameGenerator.nextBase(now, listOf(recordingsDir, practiceDir))
val mp4 = File(outDir, "$base.mp4")
val csv = File(outDir, "$base.csv")
val json = File(outDir, "$base.json")
val sidecarFile = File(outDir, "$base.session.json")
```

The `recordingId` is the openSegment parameter (a 26-char ULID minted by
UlidGenerator.next() in preFlightAndStartFirstSegment / rotateSegment). The
ultrawide physical sub-camera is `pick.ultrawideChars` / `pick.physicalUltrawideId`
(UltrawidePick); the logical openable is `pick.openableChars` / `pick.openableId`.

FILENAME SCANNER — FilenameGenerator.nextBase (FilenameGenerator.kt):

```kotlin
.filter { it.startsWith("${today}_") }
.mapNotNull { it.split("_").getOrNull(2)?.toIntOrNull() }  // <-- index 2 = NNN
```

CRITICAL: With a leading 26-char ULID prefix, `split("_")` token indices shift
and `getOrNull(2)` no longer points at NNN. nextBase MUST strip a leading
26-char ULID prefix (or match the `YYYYMMDD_HHMMSS_NNN` tail) before parsing.

ULTRAWIDE PICK — BackUltrawidePicker.pick(mgr): UltrawidePick(openableId,
openableChars, ultrawideChars, physicalUltrawideId). `ultrawideChars` is the
physical sub-camera's CameraCharacteristics — read intrinsics/extrinsics from THIS.

METADATA COMPOSER — MetadataComposer.kt:

- `const val CURRENT_SCHEMA_VERSION = "1.1.0"` → bump to "1.2.0".
- `compose(sidecar, m): JSONObject` returns top-level keys: schema_version,
  recording_id, contributor_info, task_info, capture_device_info, metadata.
  ADD a new top-level `calibration` sibling (do NOT nest inside `metadata`).
- `data class FinalizeMetrics(...)` and the nested
  `MetadataComposer.SidecarPayload(...)` are the threading types.

SIDECAR — SidecarManager.kt has TWO payload types: the package-level
`SidecarPayload` (data class at top of SidecarManager.kt, written/read by
SidecarManager.write/read) AND the nested `MetadataComposer.SidecarPayload`.
FinalizeWorker.adaptSidecar bridges them one-to-one. New calibration field must
be added to BOTH + the bridge + SidecarManager.write/read (with a backward-
compatible null/default for older sidecars on disk).

BACKEND recordings table — apps/api/src/db/schema.ts (export const recordings,
~L156). Existing nullable drift columns: imuVideoDriftMaxMs etc. Add
`calibration: jsonb('calibration')` (nullable).

INIT BODY SCHEMA — shared/types/src/recording.ts `RecordingsInitRequestSchema`
(~L65). This is the body the init route validates; init.ts INSERTs the
recordings row. Add an optional nullable `calibration` field; persist it in the
`db.insert(schema.recordings).values({...})` block in init.ts (~L337).

SPC2 REFERENCE SHAPE — meta.json (repo root) `calibration.camera` +
`calibration.cam_imu_extrinsics`. MIRROR these shapes (model, resolution,
params{fx,fy,cx,cy,...}, distortion_coeffs[], T_cam_imu, T_imu_cam,
T_cam_imu_translation_mm, timeshift_cam_imu_sec, timeshift_meaning).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Recording-id filename prefix + FilenameGenerator ls-scan fix (CAPTURE-QA-07)</name>
  <files>
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FilenameGenerator.kt
    apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/FilenameGeneratorTest.kt
  </files>
  <action>
    Implement the ULID filename prefix (CAPTURE-QA-07).

    1. CaptureSession.openSegment (CaptureSession.kt ~L286): keep
       `val base = FilenameGenerator.nextBase(now, listOf(recordingsDir, practiceDir))`
       UNCHANGED (nextBase still returns `YYYYMMDD_HHMMSS_NNN`). AFTER that line,
       assemble the prefixed filename base:
       `val filenameBase = "${recordingId}_$base"` and build the four files from
       it: `File(outDir, "$filenameBase.mp4")` / `.csv` / `.json` /
       `.session.json`. Use `filenameBase` for the `Segment.filenameBase` and
       `SidecarPayload.filenameBase` fields (so metadata.filename =
       `${filenameBase}.mp4` and imu_filename = `${filenameBase}.csv` flow
       automatically through FinalizeWorker's existing
       `"${seg.filenameBase}.mp4"` / `.csv` stamping — verify no other stamping
       site hardcodes the date base). Do NOT change FilenameGenerator.nextBase's
       returned format. The `recordingId` is already the 26-char ULID passed into
       openSegment (CAP-09).

    2. FilenameGenerator.nextBase (FilenameGenerator.kt): the ls-scan now sees
       on-disk files named `{26-char-ULID}_YYYYMMDD_HHMMSS_NNN.{ext}`. The
       current `.filter { it.startsWith("${today}_") }` +
       `.split("_").getOrNull(2)` breaks because (a) the name no longer STARTS
       with the date, and (b) the ULID adds an underscore-free 26-char token that
       shifts split indices. Fix: strip a leading 26-char ULID prefix before
       matching. Concretely — for each `nameWithoutExtension`, compute the
       "date-tail": if the name matches `^[0-9A-HJKMNP-TV-Z]{26}_` (Crockford
       base32 ULID; or simpler: a leading 26-char token followed by `_`), drop
       the first 27 chars to get the `YYYYMMDD_HHMMSS_NNN` tail; otherwise use the
       name as-is (backward compat with pre-prefix files still on disk). THEN
       apply the existing `startsWith("${today}_")` filter and
       `split("_").getOrNull(2)` NNN parse on the date-tail. Keep the MAX_PER_DAY
       throw behavior. Add a KDoc note explaining the ULID-prefix strip and that
       it is backward-compatible with un-prefixed legacy files.

    3. FilenameGeneratorTest.kt: update existing fixtures + add coverage. The
       existing tests write files like `20260505_001234_005.mp4` (un-prefixed) —
       keep those passing (legacy-compat path). ADD new tests that write
       ULID-prefixed files (e.g.
       `01HZX0000000000000000000XX_20260505_001234_005.mp4` — a syntactically
       valid 26-char ULID + `_` + date base) and assert nextBase still returns
       `20260505_HHMMSS_006`. Add a mixed-dir test (one prefixed + one legacy
       file for the same day) asserting the max across both is honored.

    Confirm in the commit message that S3 object keys are UNCHANGED: per
    DATA-MODEL.md §3 the S3 objects are literally `video.mp4` / `imu.csv` /
    `metadata.json` under `recordings/{userId}/{recordingId}/` — the device-side
    filename is local-only and the upload path PUTs to the fixed object keys
    (verify recordingKeys() in apps/api/src/lib/s3-client.js / the client upload
    builder do NOT derive the object key from the local filename; note the
    verification in the commit body).

  </action>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests "ai.humynlabs.capture.capture.FilenameGeneratorTest" 2>&1 | tail -20 || echo "GRADLE-UNAVAILABLE — see manual-verification note"</automated>
  </verify>
  <done>
    On-disk filenames are `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`;
    FilenameGenerator.nextBase parses the correct NNN over both ULID-prefixed and
    legacy files; FilenameGeneratorTest green (or, if the Gradle/Android toolchain
    is broken in this env per STATE.md, the test file compiles and the logic is
    inspected — flag as on-toolchain verification). metadata.filename /
    imu_filename carry the prefix. S3 object keys verified unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Camera2 calibration reader + MetadataComposer 1.2.0 calibration block + sidecar threading (CAPTURE-QA-08, CAPTURE-QA-09)</name>
  <files>
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CameraCalibrationReader.kt
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/MetadataComposer.kt
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/SidecarManager.kt
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/CaptureSession.kt
    apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/FinalizeWorker.kt
    apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/CameraCalibrationReaderTest.kt
    apps/mobile/android/app/src/test/java/ai/humynlabs/capture/capture/MetadataComposerLiteralsTest.kt
    apps/mobile/android/app/src/test/resources/video_metadata_v1_2_0_template.json
  </files>
  <action>
    Add live-Camera2 intrinsics + cam-IMU extrinsics to metadata.json, schema
    1.2.0. Mirror the SPC2 `meta.json` `calibration.camera` +
    `calibration.cam_imu_extrinsics` shapes.

    1. NEW CameraCalibrationReader.kt (package ai.humynlabs.capture.capture).
       Define data classes:
       - `CameraCalibration(camera: CameraIntrinsics, camImuExtrinsics: CamImuExtrinsics)`
       - `CameraIntrinsics(model: String, resolutionWidth: Int?, resolutionHeight: Int?, fx: Double?, fy: Double?, cx: Double?, cy: Double?, skew: Double?, distortionCoeffs: List<Double>?, intrinsicsSource: String)`
       - `CamImuExtrinsics(tCamImu: List<List<Double>>?, tImuCam: List<List<Double>>?, tCamImuTranslationMm: List<Double>?, timeshiftCamImuSec: Double, timeshiftMeaning: String, clockSyncNote: String, extrinsicsSource: String)`
       Provide `read(ultrawideChars: CameraCharacteristics?, openableChars: CameraCharacteristics?): CameraCalibration`:
       - Intrinsics from the ULTRAWIDE physical sub-camera chars:
         `LENS_INTRINSIC_CALIBRATION` (fx, fy, cx, cy, skew — 5-element array per
         Camera2 spec: [fx, fy, cx, cy, s]), `LENS_DISTORTION` (radial/tangential
         coeffs), `SENSOR_INFO_ACTIVE_ARRAY_SIZE` (intrinsics reference frame →
         resolution width/height). Check `LENS_INFO_AVAILABLE` /
         `LENS_POSE_REFERENCE` for calibration availability.
       - Fallback contract: when chars is null (JVM unit tests — CameraCharacteristics
         cannot be constructed) OR LENS_INTRINSIC_CALIBRATION is null/empty
         (UNCALIBRATED — common on Pixels), emit `model = "pinhole"`, all params
         null, distortionCoeffs null, `intrinsicsSource = "camera2_uncalibrated"`.
         When real values exist, `intrinsicsSource = "camera2"`.
       - Extrinsics from `LENS_POSE_TRANSLATION` (meters, 3-vector) +
         `LENS_POSE_ROTATION` (quaternion x,y,z,w) + `LENS_POSE_REFERENCE`. Build
         a 4x4 `T_cam_imu` (rotation matrix from quaternion + translation column)
         AND `T_cam_imu_translation_mm` (translation * 1000). Provide `T_imu_cam`
         as the inverse if computable, else null. When `LENS_POSE_REFERENCE` is
         not `GYROSCOPE` (Camera2 only relates pose to GYROSCOPE/IMU when
         reference == GYROSCOPE) or values are null, set tCamImu / tImuCam /
         tCamImuTranslationMm null and `extrinsicsSource = "camera2_no_imu_reference"`
         (use `"camera2"` when real values exist).
       - Temporal: `timeshiftCamImuSec = 0.0` always (default), `timeshiftMeaning
         = "t_imu = t_cam + timeshift"` (verbatim from meta.json), `clockSyncNote`
         derived from `SENSOR_INFO_TIMESTAMP_SOURCE` on the openable chars:
         `SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME` → "camera + imu share the boottime
         (elapsedRealtimeNanos) clock" else "camera timestamps not on the shared
         boottime clock".
       - NEVER throw — wrap every CameraCharacteristics.get in try/catch returning
         the null-fallback. Keep the quaternion→matrix math + token mapping in
         pure internal functions (e.g. `quaternionToRotationMatrix`,
         `intrinsicArrayToParams`) so CameraCalibrationReaderTest can exercise them
         on the JVM with no Android framework objects.

    2. CaptureSession.openSegment: after `pick` is in scope, call
       `val calibration = CameraCalibrationReader.read(pick.ultrawideChars, pick.openableChars)`
       and stash it on the SidecarPayload (new field — see step 3). Capture it at
       segment open (the chars are already resolved by BackUltrawidePicker.pick).
       Must NOT block or throw — the reader is null-safe.

    3. Thread `calibration: CameraCalibration` through:
       - SidecarManager.kt package-level `SidecarPayload` data class: add
         `val calibration: CameraCalibration? = null` (nullable + default for
         backward compat). SidecarManager.write: serialize the calibration block
         under a `"calibration"` key (mirror meta.json shape; null params →
         JSONObject.NULL). SidecarManager.read: deserialize with a null fallback
         when the key is absent (older sidecars on disk → null → composer emits
         the uncalibrated-fallback block).
       - MetadataComposer.SidecarPayload (nested): add the same
         `calibration: CameraCalibration? = null` field.
       - FinalizeWorker.adaptSidecar: map `s.calibration` → the nested payload.
       - MetadataComposer.compose: emit a NEW top-level `calibration` sibling key
         (NOT inside `metadata`). When `sidecar.calibration` is null, emit the
         full uncalibrated-fallback structure (so the block is ALWAYS present with
         the full key set). Structure mirrors meta.json:
         `calibration.camera` = { model, resolution:[w,h] (or null), params:{fx,fy,cx,cy,skew} (nulls ok), distortion_coeffs:[...] or null, intrinsics_source }
         `calibration.cam_imu_extrinsics` = { T_cam_imu, T_imu_cam, T_cam_imu_translation_mm, timeshift_cam_imu_sec, timeshift_meaning, clock_sync_note, extrinsics_source }.
       - Bump `CURRENT_SCHEMA_VERSION` 1.1.0 → 1.2.0. Update the MetadataComposer
         KDoc top-level-keys list (add `calibration`) and the schema-bump comment.

    4. MetadataComposerLiteralsTest.kt: the existing comment-stripped grep gate
       bans the specific SPEC literals (1920x1080 / 30 / hevc / cbr / etc.) — the
       calibration block introduces NONE of those, so it should stay green;
       confirm the calibration `.put(...)` keys don't trip any banned-literal
       assertion. Update the schema-version assertion (1.1.0 → 1.2.0) and any
       top-level-key conformance assertion to include `calibration`. Add explicit
       assertions: (a) compose() output ALWAYS has a top-level `calibration`
       object with `camera` + `cam_imu_extrinsics` children even when
       `sidecar.calibration == null`; (b) the null-fallback path stamps
       `intrinsics_source == "camera2_uncalibrated"` and null params; (c) existing
       `imu_video_drift_*` fields are still present and unchanged.

    5. Rename / add the schema fixture: copy
       `video_metadata_v1_1_0_template.json` → `video_metadata_v1_2_0_template.json`
       adding the `calibration` top-level block (uncalibrated fallback variant) and
       bumping schema_version to 1.2.0. Update any test that loads the 1_1_0
       template (e.g. MetadataSchemaConformanceTest) to reference the 1_2_0
       template — grep test/resources usages first. Keep the 1_1_0 template only
       if a test still pins to it; otherwise update references.

    ON-HARDWARE NOTE (encode in the SUMMARY): real intrinsics/extrinsics VALUES
    only exist on a real Pixel ultrawide sub-camera; most Pixels report
    UNCALIBRATED so the null-fallback path is the EXPECTED CI-and-typical-device
    output. JVM unit tests can ONLY verify the null-fallback path + key structure
    + the pure math helpers (quaternion→matrix on hand-supplied values). Genuine
    non-null Camera2 calibration output is a MANUAL on-device smoke item, NOT
    CI-verifiable.

  </action>
  <verify>
    <automated>cd apps/mobile/android && ./gradlew :app:testDebugUnitTest --tests "ai.humynlabs.capture.capture.CameraCalibrationReaderTest" --tests "ai.humynlabs.capture.capture.MetadataComposerLiteralsTest" 2>&1 | tail -25 || echo "GRADLE-UNAVAILABLE — toolchain broken per STATE.md; verify by code inspection + on-device smoke"</automated>
  </verify>
  <done>
    metadata.json (schema 1.2.0) always carries the top-level `calibration` block
    with camera intrinsics + cam_imu_extrinsics + null fallback contract;
    intrinsics read from the ultrawide physical sub-camera; capture never throws on
    null/uncalibrated chars; drift fields untouched; calibration threaded
    SidecarPayload → FinalizeMetrics → compose; literals grep gate still green;
    1_2_0 fixture present and referenced. On-hardware value verification flagged as
    manual smoke (not CI).
  </done>
</task>

<task type="auto">
  <name>Task 3: Backend calibration jsonb column + /recordings/init persistence + migration + tests (CAPTURE-QA-08/09 backend)</name>
  <files>
    apps/api/src/db/schema.ts
    shared/types/src/recording.ts
    apps/api/src/routes/recordings/init.ts
    apps/api/src/db/migrations/0009_recordings_calibration.sql
    apps/api/test/routes/recordings-init.test.ts
  </files>
  <action>
    Persist the calibration block to Postgres via /recordings/init.

    1. apps/api/src/db/schema.ts — `recordings` table (~L156): add a nullable
       `calibration: jsonb('calibration')` column (import `jsonb` from
       'drizzle-orm/pg-core' if not already imported — check the existing imports;
       `events.properties` already uses jsonb so the import exists). Place it
       logically near the drift columns or after the s3 keys — it holds the whole
       metadata.json `calibration` block (camera + cam_imu_extrinsics). Nullable —
       older clients / pre-1.2.0 segments send nothing.

    2. shared/types/src/recording.ts — `RecordingsInitRequestSchema` (~L65): add an
       optional, nullable `calibration` field. Define a permissive zod shape that
       tolerates null params (the uncalibrated fallback):
       ```
       const CalibrationCameraSchema = z.object({
         model: z.string(),
         resolution: z.array(z.number()).length(2).nullable().optional(),
         params: z.record(z.string(), z.number().nullable()).nullable().optional(),
         distortion_coeffs: z.array(z.number()).nullable().optional(),
         intrinsics_source: z.string(),
       });
       const CalibrationExtrinsicsSchema = z.object({
         T_cam_imu: z.array(z.array(z.number())).nullable().optional(),
         T_imu_cam: z.array(z.array(z.number())).nullable().optional(),
         T_cam_imu_translation_mm: z.array(z.number()).nullable().optional(),
         timeshift_cam_imu_sec: z.number(),
         timeshift_meaning: z.string(),
         clock_sync_note: z.string(),
         extrinsics_source: z.string(),
       });
       export const CalibrationSchema = z.object({
         camera: CalibrationCameraSchema,
         cam_imu_extrinsics: CalibrationExtrinsicsSchema,
       });
       ```
       Add `calibration: CalibrationSchema.nullable().optional()` to
       RecordingsInitRequestSchema. Export `CalibrationSchema` + its type. Keep the
       schema lenient (jsonb tolerates extra keys / null params) — do not over-
       constrain so a slightly-evolved device block still validates. Rebuild
       shared-types if the build emits dist (`pnpm --filter @humyn/shared-types build`).

    3. apps/api/src/routes/recordings/init.ts — the new-row INSERT
       (`db.insert(schema.recordings).values({...})`, ~L337): add
       `calibration: body.calibration ?? null,`. The idempotent re-presign path
       (replyExistingRowIdempotent) does NOT mutate the row, so calibration is set
       only on first insert — correct (the metadata.json carrying calibration is
       PUT to S3 separately; the column is the queryable mirror). No change needed
       to finalize.ts (init owns the row insert + metadata mirroring).

    4. Generate the migration: run drizzle-kit to emit the ALTER, then rename to
       the deterministic `0009_recordings_calibration.sql` (per the Phase-1
       Pattern: deterministic migration filenames) and update
       `apps/api/src/db/migrations/meta/_journal.json` accordingly. If drizzle-kit
       is unavailable in-sandbox, hand-write
       `ALTER TABLE "recordings" ADD COLUMN "calibration" jsonb;` as
       `0009_recordings_calibration.sql` and add the journal entry matching the
       existing migration-runner bookkeeping convention (check
       0008_tasks_name_search_includes_category.sql + the journal for the exact
       shape). The idempotent migration runner (Pattern 23) applies it.

    5. apps/api/test/routes/recordings-init.test.ts: add coverage —
       (a) /init with a full calibration block (real-values variant) → 201 and the
       persisted row's `calibration` column round-trips the block;
       (b) /init with the uncalibrated-fallback calibration (null params) → 201,
       persisted, null params tolerated;
       (c) /init with NO calibration field → 201, column is null (backward compat).
       Re-seed the dev DB before running if needed (the suite truncates per
       beforeEach — known gotcha). Hash-verify worker is untouched — note in the
       test/SUMMARY that it re-hashes MP4+CSV only, calibration is not in its path.

  </action>
  <verify>
    <automated>set -a && source apps/api/.env && set +a && WORKER_BOOTSTRAP=false pnpm --filter @humyn/api test -- recordings-init 2>&1 | tail -25</automated>
  </verify>
  <done>
    recordings table has a nullable `calibration jsonb` column; migration
    0009_recordings_calibration.sql exists + journal updated; /recordings/init
    accepts + validates (zod, null-params tolerated) + persists calibration on the
    new-row INSERT; recordings-init tests cover full / uncalibrated / absent
    cases and pass; hash-verify worker untouched.
  </done>
</task>

<task type="auto">
  <name>Task 4: Doc updates — DATA-MODEL, REQUIREMENTS, CLAUDE banner, STATE (verified against code)</name>
  <files>
    DATA-MODEL.md
    .planning/REQUIREMENTS.md
    CLAUDE.md
    .planning/STATE.md
  </files>
  <action>
    Update docs to match the shipped code. Verify each statement against the
    actual Task 1-3 implementation before writing (do not document aspirational
    behavior).

    1. DATA-MODEL.md:
       - §4: bump "Schema version: 1.1.0" → "1.2.0". Note it now has SIX blocks
         (add `calibration`). Add a `### calibration` subsection documenting the
         two children: `camera` (model, resolution, params{fx,fy,cx,cy,skew},
         distortion_coeffs[], intrinsics_source ∈ {"camera2","camera2_uncalibrated"})
         and `cam_imu_extrinsics` (T_cam_imu, T_imu_cam, T_cam_imu_translation_mm,
         timeshift_cam_imu_sec, timeshift_meaning, clock_sync_note, extrinsics_source).
         State the null-fallback contract: the block is ALWAYS present; params are
         null when the device reports UNCALIBRATED (common on Pixels). State that
         drift fields are unchanged and calibration is additive telemetry.
       - §3 / §4: update the `filename` / `imu_filename` description — local
         on-disk names are now `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`. EXPLICITLY
         note S3 object keys are UNCHANGED (still literally video.mp4 / imu.csv /
         metadata.json under recordings/{userId}/{recordingId}/).
       - §7 recordings DDL: add the `calibration` jsonb (nullable) column row with
         note "whole metadata.json calibration block (camera intrinsics +
         cam-IMU extrinsics); nullable".

    2. .planning/REQUIREMENTS.md — under "### Recording — Capture Quality Gate"
       (after CAPTURE-QA-06, ~L117), add three new requirements following the
       CAPTURE-QA-0x numbering convention, marked `[x]` (delivered this task):
       - **CAPTURE-QA-07**: recording-id filename prefix —
         `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}` for video/imu/metadata/sidecar;
         FilenameGenerator's per-day NNN scan strips a leading 26-char ULID; S3
         object keys unchanged.
       - **CAPTURE-QA-08**: live-Camera2 camera intrinsics in metadata.json
         (schema 1.2.0) `calibration.camera` from the ultrawide physical
         sub-camera's CameraCharacteristics; null fallback +
         `intrinsics_source: "camera2_uncalibrated"` when UNCALIBRATED; never
         blocks capture.
       - **CAPTURE-QA-09**: cam-IMU offset (temporal + spatial) in
         `calibration.cam_imu_extrinsics` from LENS_POSE_* ; timeshift default 0.0
         + clock-sync note from SENSOR_INFO_TIMESTAMP_SOURCE; null when
         LENS_POSE_REFERENCE != GYROSCOPE; drift fields untouched.
       Also add the three IDs to the implementation-status table near L463-468
       (Source: "Quick 260522-elm", Status: "Complete").

    3. CLAUDE.md — add a dated banner (2026-05-22) near the other dated banners
       (after the "Capture-quality cancel gate added 2026-05-17" banner). Cover:
       schema 1.2.0 bump; the `{recordingId}_` filename prefix (S3 keys
       unchanged); live-Camera2 intrinsics (`calibration.camera`, ultrawide
       physical sub-camera) + cam-IMU extrinsics (`calibration.cam_imu_extrinsics`,
       LENS_POSE_*) ADDED to metadata.json with the null-fallback contract
       (`intrinsics_source: "camera2_uncalibrated"` when the device is UNCALIBRATED
       — common on Pixels — block always present); backend `recordings.calibration
       jsonb` column. State it does NOT touch drift gates / capture spec / the
       ultrawide lens code; Android only (iOS deferred). Trail:
       `.planning/quick/260522-elm-.../`, REQUIREMENTS.md §v1 (CAPTURE-QA-07..09).

    4. .planning/STATE.md — add a Decisions / Last-activity entry (2026-05-22)
       noting the schema 1.2.0 bump + the three CAPTURE-QA-07..09 additions + the
       on-hardware-only verification gap for genuine intrinsics values. Update the
       "Last activity" line. Do NOT touch the drift banner / capture-spec
       statements.

    Leave idea-brief.md §2.1 unchanged (no spec values change).

  </action>
  <verify>
    <automated>grep -q "1.2.0" DATA-MODEL.md && grep -q "calibration" DATA-MODEL.md && grep -q "CAPTURE-QA-07" .planning/REQUIREMENTS.md && grep -q "CAPTURE-QA-08" .planning/REQUIREMENTS.md && grep -q "CAPTURE-QA-09" .planning/REQUIREMENTS.md && grep -q "2026-05-22" CLAUDE.md && echo DOCS-OK</automated>
  </verify>
  <done>
    DATA-MODEL.md at schema 1.2.0 with the documented `calibration` block + the
    `{recordingId}_` filename note (S3 keys unchanged) + the recordings.calibration
    DDL row; REQUIREMENTS.md has CAPTURE-QA-07/08/09 + status-table rows; CLAUDE.md
    has the 2026-05-22 banner; STATE.md updated. idea-brief.md untouched.
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                    | Description                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| device → API (/recordings/init)             | client-supplied `calibration` jsonb crosses into Postgres persistence      |
| Camera2 framework → CameraCalibrationReader | untrusted/null/UNCALIBRATED CameraCharacteristics on arbitrary OEM devices |
| on-disk filename → upload object key        | local ULID-prefixed filename must NOT influence the fixed S3 object key    |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                                                 | Disposition | Mitigation Plan                                                                                                                                                                                     |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-elm-01  | Denial of Service      | CameraCalibrationReader.read on null/UNCALIBRATED chars (JVM tests, most Pixels)          | mitigate    | every CameraCharacteristics.get wrapped in try/catch → null-fallback block; reader NEVER throws; capture never blocks on missing calibration                                                        |
| T-elm-02  | Tampering              | client-supplied `calibration` jsonb at /recordings/init                                   | mitigate    | zod CalibrationSchema validates shape at route entry (null params tolerated); jsonb column is non-indexed telemetry, not authorization-bearing; no SQL string interpolation (drizzle parameterizes) |
| T-elm-03  | Tampering              | filename prefix shifting S3 object key                                                    | mitigate    | S3 object key derived from recordingKeys() (fixed video.mp4/imu.csv/metadata.json), NOT the local filename; verified + noted in Task 1 commit                                                       |
| T-elm-04  | Information disclosure | calibration block leaking precise device pose / location                                  | accept      | intrinsics + cam-IMU extrinsics are rigid-body lens geometry, contain no PII or precise GPS (coarse-location rule unaffected); training-pipeline-consumed telemetry                                 |
| T-elm-05  | Tampering              | FilenameGenerator NNN scan corrupted by ULID prefix → filename collision → file overwrite | mitigate    | nextBase strips the 26-char ULID prefix before NNN parse; FilenameGeneratorTest covers prefixed + legacy + mixed-dir cases so the per-day max is always honored                                     |

</threat_model>

<verification>
- FilenameGeneratorTest green across prefixed / legacy / mixed-dir fixtures (or
  code-inspected if the Android/Gradle toolchain is broken in-env per STATE.md).
- CameraCalibrationReaderTest + MetadataComposerLiteralsTest green: calibration
  block ALWAYS present, null-fallback path stamps `camera2_uncalibrated`, drift
  fields unchanged, schema_version == 1.2.0, literals grep gate still green.
- recordings-init.test.ts green: full / uncalibrated / absent calibration → 201
  + correct persisted column value.
- `grep -q calibration apps/api/src/db/schema.ts`; migration
  0009_recordings_calibration.sql present + journal updated.
- Docs grep gate (DOCS-OK) passes.
- MANUAL on-device smoke (NOT CI): on a real Pixel, confirm a captured segment's
  metadata.json `calibration.camera.intrinsics_source` reflects the device's
  actual calibration state, and (if calibrated) non-null fx/fy/cx/cy from the
  ultrawide sub-camera + non-null T_cam_imu when LENS_POSE_REFERENCE == GYROSCOPE.
  This is the ONLY way to verify genuine non-null Camera2 values — JVM/CI can only
  verify the null-fallback path + key structure.
</verification>

<success_criteria>

- On-disk filenames are `{recordingId}_{YYYYMMDD_HHMMSS_NNN}.{ext}`; S3 object
  keys unchanged; per-day NNN scan correct.
- metadata.json schema 1.2.0 always carries a top-level `calibration` block
  (camera intrinsics + cam_imu_extrinsics) mirroring meta.json, with the
  null-fallback contract; intrinsics read from the ultrawide physical sub-camera;
  capture never throws/blocks on null/uncalibrated chars.
- `imu_video_drift_{max,mean,p99}_ms` and the capture spec / drift gates / the
  ultrawide lens code are all unchanged.
- `recordings.calibration jsonb` column added + migrated; /recordings/init
  validates + persists; hash-verify worker untouched.
- DATA-MODEL.md / REQUIREMENTS.md / CLAUDE.md / STATE.md updated to match code.
- Android only — no iOS code.
  </success_criteria>

<output>
After completion, create
`.planning/quick/260522-elm-add-camera-intrinsics-cam-imu-offset-cal/260522-elm-SUMMARY.md`.
Record in the SUMMARY: the on-hardware-only verification gap (genuine Camera2
intrinsics/extrinsics values exist only on real Pixel hardware — JVM/CI verifies
only the null-fallback path + key structure + pure math helpers); the S3-object-key-
unchanged verification; and that the hash-verify worker path is unaffected.
</output>
