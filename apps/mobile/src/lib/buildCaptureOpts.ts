// buildCaptureOpts — assembles the Phase-3 D-API-02 `CaptureSessionOpts` map
// for `HumynCapture.start()`. The Kotlin side re-validates with the same Zod
// shape (defense-in-depth across the JS↔Kotlin trust boundary, T-3.3-01 /
// T-3.3-01), so this builder MUST produce a shape that passes
// `CaptureSessionOptsSchema.parse`.
//
// Security V11 — `contributor.consent` is NEVER defaulted: it is sourced from
// the verified `/me` consent state (the app store's `consent` slice). If that
// state is absent the builder THROWS rather than emitting `consent: true` —
// metadata JSON must never claim consent that wasn't recorded.
//
// Profile-data — `contributor.name` and `contributor.email` are NEVER
// defaulted to `''` either: empty/whitespace values throw with
// `code: 'profile_incomplete'`. The Kotlin bridge re-validates the same
// two fields with `requireNonEmpty` (CaptureSessionOptsBridge.kt:84-85,
// T-3.3-01) — this JS-side guard is the surface that turns the failure
// into a clear user-facing toast instead of an opaque bridge rejection.
//
// `dfovDegrees` comes from `compat.lastResult.v1.checks.ultrawideDfov.measuredDeg`
// (Phase 2 D-COMPAT-05 already validates it's positive); `startGate.{passed,
// skipped,bypassed,durationMs}` from the gate result; `startGate.{consecutive
// HitsRequired,platformCadenceMs}` from `readGateConfig()` (HAND-11); `location`
// is always `null` (coarse location is not attached at MVP); `appVersion` from
// the AppFlavor native module's `versionName` (the Phase-1 versioning script's
// `BuildConfig.VERSION_NAME` — bare semver for playStore, `-apk`-suffixed for
// apkRollout).

import type { CaptureSessionOpts } from '@humyn/shared-types';

/** The narrow `CaptureSessionOpts.contributor.gender` enum. */
type NarrowGender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
const NARROW_GENDERS: ReadonlySet<string> = new Set([
  'male',
  'female',
  'non-binary',
  'prefer-not-to-say',
]);

/**
 * Coerce a free-form `/me` gender string to the narrow `CaptureSessionOpts`
 * enum. Anything unrecognized (including `''`, `'other'`, casing variants) → `null`.
 */
export function coerceGender(g: string | null | undefined): NarrowGender | null {
  if (g != null && NARROW_GENDERS.has(g)) return g as NarrowGender;
  return null;
}

export interface BuildCaptureOptsArgs {
  taskId: string;
  taskName: string;
  taskCategory: string;
  taskSetting: 'indoor' | 'outdoor';
  isPractice: boolean;
  gate: { passed: boolean; skipped: boolean; bypassed: boolean; durationMs: number };
  gateConfig: { targetHits: number; cadenceMs: number };
  compat: { ultrawideDfovMeasuredDeg: number };
  user: {
    name: string;
    email: string;
    age: number | null;
    gender: string | null;
    /** True iff the verified `/me` consent state is present (NOT a hardcoded literal). */
    consentPresent: boolean;
  };
  appVersion: string;
}

/**
 * Build the `CaptureSessionOpts` for `HumynCapture.start()`. Throws if
 * `args.user.consentPresent` is false (V11 — consent is never defaulted).
 * Also throws (code 'profile_incomplete') if args.user.email is
 * empty/whitespace; the Kotlin bridge re-validates with `requireNonEmpty`
 * on email. `name` is OPTIONAL — empty string flows through to the
 * sidecar JSON's `contributor.name` (2026-05-17 owner decision: profile
 * name must not gate recording).
 */
export function buildCaptureOpts(args: BuildCaptureOptsArgs): CaptureSessionOpts {
  if (!args.user.consentPresent) {
    throw new Error('Cannot start a capture session without recorded consent');
  }
  // V11-mirror for EMAIL only — the Kotlin bridge re-validates with the
  // same `requireNonEmpty` (CaptureSessionOptsBridge.kt:85, T-3.3-01).
  // The JS guard makes the failure mode actionable: a clear toast
  // (RecordingScreen maps `code: 'profile_incomplete'` to "Please
  // complete your profile.") instead of an opaque bridge rejection.
  if (args.user.email == null || args.user.email.trim().length === 0) {
    throw Object.assign(
      new Error('Cannot start a capture session without a contributor profile email'),
      { code: 'profile_incomplete' as const },
    );
  }
  return {
    taskId: args.taskId,
    taskName: args.taskName,
    taskCategory: args.taskCategory,
    taskSetting: args.taskSetting,
    contributor: {
      name: args.user.name ?? '',
      email: args.user.email,
      age: args.user.age,
      gender: coerceGender(args.user.gender),
      // Sourced from the verified /me consent state being present — see the
      // `consentPresent` guard above. The Kotlin side also re-validates this
      // with z.literal(true) (T-3.3-01).
      consent: true,
    },
    isPractice: args.isPractice,
    startGate: {
      type: 'hand_detection',
      passed: args.gate.passed,
      skipped: args.gate.skipped,
      bypassed: args.gate.bypassed,
      durationMs: Math.max(0, Math.round(args.gate.durationMs)),
      consecutiveHitsRequired: args.gateConfig.targetHits,
      platformCadenceMs: args.gateConfig.cadenceMs,
    },
    location: null,
    appVersion: args.appVersion,
    dfovDegrees: args.compat.ultrawideDfovMeasuredDeg,
  };
}
