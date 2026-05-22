-- 0009 — Quick task 260522-elm CAPTURE-QA-08 / CAPTURE-QA-09
-- Add the `calibration` jsonb column to `recordings`.
--
-- Mirrors the metadata.json (schema 1.2.0) top-level `calibration` block:
-- camera intrinsics (model / resolution / params{fx,fy,cx,cy,skew} /
-- distortion_coeffs / intrinsics_source) + cam-IMU extrinsics (T_cam_imu /
-- T_imu_cam / T_cam_imu_translation_mm / timeshift_cam_imu_sec /
-- timeshift_meaning / clock_sync_note / extrinsics_source). Persisted by
-- /recordings/init on the new-row INSERT as the queryable mirror.
--
-- Nullable: older clients / pre-1.2.0 segments send nothing. Non-indexed
-- telemetry — not authorization-bearing. The idempotent migration runner
-- (apps/api/scripts/migrate.ts; schema_migrations bookkeeping) applies this
-- exactly once. IF NOT EXISTS keeps the ADD idempotent across reruns.

ALTER TABLE "recordings"
  ADD COLUMN IF NOT EXISTS "calibration" jsonb;
