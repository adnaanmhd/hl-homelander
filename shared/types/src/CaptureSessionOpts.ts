// Phase 3 D-API-02 — start(opts) bridge map for HumynCapture.start().
// Mirrors apps/mobile/android/app/src/main/java/ai/humynlabs/capture/capture/
// CaptureSessionOpts.fromBridge(ReadableMap) (Plan 03-09; Kotlin native side
// re-validates with the same shape — defense-in-depth across the JS↔Kotlin
// trust boundary per the threat-model T-3.3-01 entry).
//
// Schema-version coupling: when this contract changes, the per-segment
// metadata JSON `schema_version` field bumps too. As of Phase 3:
//   - 1.0.0: Phase 1's video_metadata.json baseline (Phase-3-pre-finalize).
//   - 1.1.0: this version, adds `imu_min_rate_hz_observed_p1` to the
//     metadata.metadata block per D-IMU-02. The actual field lives on the
//     metadata-JSON output (plan 03-06), not on this opts schema; recorded
//     here as a doc anchor so the schema-version bump rationale stays
//     visible at the `start(opts)` call site.

import { z } from 'zod';
// Bug 3 / D3 (2026-06-04) — the precise-GPS block shared with the
// /recordings/init wire shape (single source of truth for the lat/lng/
// accuracy_m/provider/captured_at/label object the Kotlin bridge parses).
import { LocationSchema } from './recording.js';

export const CaptureSessionOptsSchema = z.object({
  taskId: z.string().min(1),
  taskName: z.string().min(1),
  taskCategory: z.string().min(1),
  taskSetting: z.enum(['indoor', 'outdoor']),
  contributor: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().nullable(),
    gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).nullable(),
    // Hard refuse on consent !== true. Threat-model T-3.3-01:
    // `start({contributor: { consent: false }})` could otherwise bypass
    // consent in metadata JSON; z.literal(true) makes Zod parse reject
    // every non-true value (false / null / undefined / "true" string / 1).
    consent: z.literal(true),
  }),
  isPractice: z.boolean(),
  startGate: z.object({
    type: z.literal('hand_detection'),
    passed: z.boolean(),
    skipped: z.boolean(),
    bypassed: z.boolean(),
    durationMs: z.number().int().nonnegative(),
    consecutiveHitsRequired: z.number().int().positive(),
    platformCadenceMs: z.number().int().positive(),
  }),
  // Bug 3 / D3 (2026-06-04): was `z.string().nullable()` (coarse label). Now the
  // precise GPS object resolved by the HumynLocation native module before
  // start(); null when the fix was unavailable. The Kotlin bridge re-validates
  // this exact shape (CaptureSessionOptsBridge.parseLocation).
  location: LocationSchema.nullable(),
  // Semver shape — `MAJOR.MINOR.PATCH` with optional pre-release/build
  // suffix. Matches the BuildConfig.VERSION_NAME values produced by the
  // Phase 1 versioning script (plan 01-10) — playStore values are bare
  // semver, apkRollout values carry a `-apk` suffix appended via
  // `versionNameSuffix '-apk'` in apps/mobile/android/app/build.gradle.
  appVersion: z.string().regex(/^\d+\.\d+\.\d+(?:[+-].+)?$/),
  // JS pre-resolves from compat.lastResult.v1.checks.ultrawideDfov.measuredDeg.
  // Phase 2 D-COMPAT-05 already validates this is a positive number.
  dfovDegrees: z.number().positive(),
});
export type CaptureSessionOpts = z.infer<typeof CaptureSessionOptsSchema>;
