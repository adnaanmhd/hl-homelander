// Analytics wrapper. Single call site for every Phase 2 telemetry event so
// (a) the event-name allowlist is enforced at runtime and (b) every event is
// mirrored into telemetryRing for the HELP-05 diagnostic snapshot.
//
// Source of truth for the allowlist: engineering-handoff.md §11 + the Phase 2
// D-HELP-02 ring contract. Adding a new event means a code-review pass that
// extends EVENT_NAMES below; runtime callers with an unknown name are dropped
// with a `__DEV__` warning (silent in release).
//
// PII guard (T-2.4-01): callers MUST NOT pass user-identifying fields in
// `props` — no name, email, task name, query content, or recording filename.
// Stick to IDs, durations, sizes, network type. The plan-checker greps event
// call sites; this module enforces the allowlist gate but does not inspect
// prop values (any redaction is a per-call-site concern).
//
// Firebase Analytics handoff: the `analytics().logEvent(name, props)` call
// is wired in plan 02-09 (signup screen) once Firebase is configured. We
// keep the surface stable here so call sites don't change when that lands.

import { telemetryRing } from '../services/telemetryRing';

/**
 * Frozen allowlist of every Phase 2 event we fire. Adding a new event
 * requires a code-review pass; runtime offenders are dropped with a dev
 * warning. Source: engineering-handoff.md §11 + D-HELP-02 telemetry ring.
 */
export const EVENT_NAMES = [
  // Splash + version
  'splash_shown',
  'upg_check_started',
  'upg_force_upgrade_shown',
  'upg_force_upgrade_apk_downloaded',
  'upg_force_upgrade_apk_hash_mismatch',
  'upg_force_upgrade_apk_download_failed',
  'upg_soft_banner_shown',
  'upg_soft_banner_dismissed',
  'upg_soft_banner_tapped',
  // Sign-up
  'signup_started',
  'signup_consent_checked',
  'signup_terms_opened',
  'signup_google_started',
  'signup_google_completed',
  'signup_google_failed',
  // Permissions
  'permission_camera_requested',
  'permission_camera_granted',
  'permission_camera_denied',
  'permission_mic_requested',
  'permission_mic_granted',
  'permission_mic_denied',
  // Compat
  'compat_started',
  'compat_check_passed',
  'compat_check_failed',
  'compat_completed',
  // Onboarding
  'rig_tutorial_shown',
  'rig_no_rig_link_tapped',
  // Onboarding — practice tutorial (Phase 4)
  'practice_intro_shown',
  'practice_started',
  'practice_complete_shown',
  'practice_complete_continued',
  // Recording (Phase 4)
  // recording_gate_* — the MediaPipe HandLandmarker pre-record gate funnel
  // (HAND-14; recording_gate_skipped is consumed by plan 04-09's Skip link).
  'recording_gate_started',
  'recording_gate_passed',
  'recording_gate_skipped',
  'recording_gate_bypassed',
  'recording_started',
  'recording_stopped',
  'recording_too_short',
  // IN-09 — fires when HumynCapture.stop() rejects (the segment may not have
  // finalized cleanly); the user gets a "finalizing failed" toast on the
  // real-recording ≥60s path instead of the clean-save toast.
  'recording_stop_failed',
  // Profile
  'profile_viewed',
  'profile_edited',
  'profile_logout',
  'profile_delete_requested',
  'profile_delete_confirmed',
  // Help
  'help_opened',
  'help_accordion_expanded',
  'help_contact_support_tapped',
  'help_report_problem_submitted',
  // WR-10 fix — useForegroundUserRehydrate failure telemetry. Fires when
  // the foreground rehydrate `/me` call throws (network down, server-side
  // JWT revoked, etc.). Lets the help-pull diagnostic snapshot show why
  // the avatar stayed at 'U' on a long-suspended app session.
  'rehydrate_user_failed',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const eventSet = new Set<string>(EVENT_NAMES);

// Hermes / RN provides __DEV__ as a global at runtime; vitest doesn't define
// it, so guard with a typeof check.
declare const __DEV__: boolean | undefined;
function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Log an analytics event. Mirrors to telemetryRing for HELP-05 diagnostic
 * snapshot. Drops with a dev warning when `name` is not in EVENT_NAMES.
 *
 * Phase 2 stub: the Firebase Analytics call lands in plan 02-09 (signup)
 * wiring; the surface is stable so call sites don't change.
 */
export function logEvent(
  name: EventName,
  props: Record<string, string | number | boolean> = {},
): void {
  if (!eventSet.has(name)) {
    if (isDev()) {
      console.warn(`[analytics] event '${name}' not in EVENT_NAMES allowlist; dropped`);
    }
    return;
  }
  try {
    // PII guard: do NOT add fields like email, name, taskName, queryContent,
    // recordingFilename. T-2.4-01 mitigation lives at the call sites.
    telemetryRing.append({ name, ts: Date.now(), props });
    // Firebase Analytics handoff (plan 02-09):
    //   import analytics from '@react-native-firebase/analytics';
    //   await analytics().logEvent(name, props);
  } catch (e) {
    if (isDev()) {
      console.warn('[analytics] logEvent failed', e);
    }
  }
}
