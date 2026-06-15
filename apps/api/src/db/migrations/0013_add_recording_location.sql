-- 0013 — Bug 3 / D3 (2026-06-04): precise GPS location on recordings.
--
-- Adds the `location` jsonb column to `recordings`, mirroring the metadata.json
-- `capture_device_info.location` block (schema 1.5.0):
--   { lat, lng, accuracy_m, provider, captured_at, label }
-- Persisted by POST /recordings/init on the new-row INSERT as the queryable
-- mirror of the on-device metadata. The client forwards the block verbatim from
-- metadata.json (UploadCoordinator.postInit); the server zod-validates it
-- (LocationSchema.nullable().optional()) and stores it sibling to ip_address.
--
-- **Overrides the formerly-LOCKED "no precise GPS leaves the device" constraint**
-- (owner sign-off `.planning/260604-locked-override-signoff.md` D3). The
-- consent-text + DPIA review is a SHIP gate — this column may land behind it.
--
-- Nullable: a segment captured with no fix (unavailable / partial COARSE grant),
-- or a pre-1.5.0 client, persists NULL. Non-indexed telemetry — not
-- authorization-bearing. The idempotent migration runner (scripts/migrate.ts;
-- schema_migrations bookkeeping) applies this exactly once; IF NOT EXISTS keeps
-- the ADD idempotent across reruns.

ALTER TABLE "recordings"
  ADD COLUMN IF NOT EXISTS "location" jsonb;
