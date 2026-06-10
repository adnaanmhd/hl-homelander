// Feedback service — wraps the Phase 1 POST /feedback endpoint for the
// Phase 2 Help Center Report-a-problem flow (HELP-05 + D-HELP-02).
//
// Wire shape (multipart/form-data):
//   field "category"   — one of FEEDBACK_CATEGORIES (8 values; matches Phase 1
//                         shared/types/src/feedback.ts FEEDBACK_CATEGORIES)
//   field "message"    — 1..4000 chars (matches FeedbackFieldsSchema)
//   file  "diagnostic" — application/json blob, ≤5 MB (D-HELP-02 snapshot:
//                         { appVersion, buildIdentifier, osVersion, deviceModel,
//                           telemetryRing })
//
// Idempotency (Phase 1 API-15): a fresh key is minted per call so client-side
// retries dedupe at the backend. Phase 1 plan 01-08 falls back to
// (method, path, undefined-body) hashing for multipart, so the Idempotency-Key
// header is the only retry-dedup signal — never reuse it across calls.
//
// Why react-native-uuid instead of ulid (deviation from plan body): the
// mobile dep tree ships react-native-uuid (UUIDv4) but NOT ulid; the Phase 1
// idempotency hook stores keys raw (the shape is opaque to the backend) so a
// UUIDv4 satisfies the uniqueness contract identically. Same reasoning that
// landed in profileService.ts via plan 02-17 — keeps a single key-generation
// library in the mobile bundle.
//
// Why pre-network validation: a category typo or a 4001-char message would
// otherwise burn a multipart request + the backend rate-limit budget
// (5/min/user per Phase 1 plan 01-08). Pre-flight rejection drops bad input
// before the wire hop.
//
// Threat T-2.18-01 (PII leak via telemetryRing): the ring's append-side
// allow-list is enforced in src/util/analytics.ts (engineering-handoff §11 —
// event names + non-PII attrs only). This service is a dumb passthrough.

import { Platform, NativeModules } from 'react-native';
import uuid from 'react-native-uuid';
import { apiClient } from './api';
import { telemetryRing } from './telemetryRing';
import { stripControlChars, stripControlCharsDeep } from '../lib/sanitizeControlChars';

/** Phase 1 wire enum — copied verbatim from shared/types/src/feedback.ts. */
export const FEEDBACK_CATEGORIES = [
  'app-crashed',
  'task-doesnt-start',
  'upload-stuck',
  'login-issue',
  'video-quality-issue',
  'imu-issue',
  'thermal-issue',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/**
 * D-HELP-02 — diagnostic snapshot shape attached to every feedback submission.
 * The backend stores the full blob in S3 (`humyn-feedback-{env}/feedback/...`)
 * and the first 100 KB inline on the feedback row for support read-throughs
 * without an S3 hop (Phase 1 plan 01-08).
 */
export interface DiagnosticSnapshot {
  appVersion: string;
  buildIdentifier: string;
  osVersion: string;
  deviceModel: string;
  telemetryRing: ReturnType<typeof telemetryRing.snapshot>;
}

interface AppFlavorNativeShape {
  versionName?: string;
  versionCode?: number;
  flavor?: string;
  deviceModel?: string;
}

/**
 * Assemble the diagnostic snapshot from the AppFlavor native module + the
 * telemetry ring. Native-module fields fall back to safe defaults when the
 * module isn't registered (e.g., unit tests without the AppFlavor mock).
 */
export function buildDiagnosticSnapshot(): DiagnosticSnapshot {
  const flav = NativeModules.AppFlavor as AppFlavorNativeShape | undefined;
  const versionName = flav?.versionName ?? '0.0.0';
  const versionCode = flav?.versionCode ?? 0;
  const flavor = flav?.flavor ?? 'unknown';
  const deviceModel = flav?.deviceModel ?? 'unknown';
  return {
    appVersion: versionName,
    buildIdentifier: `${versionName}-${flavor} (${versionCode})`,
    osVersion: `${Platform.OS} ${Platform.Version}`,
    deviceModel,
    telemetryRing: telemetryRing.snapshot(),
  };
}

export interface SubmitFeedbackInput {
  category: FeedbackCategory;
  message: string;
}

/**
 * POST /feedback as multipart with `category` + `message` fields and a
 * `diagnostic` JSON blob part. Mints a fresh Idempotency-Key per call (Phase 1
 * API-15). Pre-flight validates category + message length so bad input
 * doesn't burn a network round-trip or the per-user rate-limit budget.
 *
 * Throws (before network):
 *   - `feedback_invalid_category:{value}`            — category not in enum
 *   - `feedback_message_length_out_of_range`         — message < 1 or > 4000
 *
 * Throws (network): the `apiClient.postMultipart` rejection text, which
 * mirrors the Phase 1 problem-detail body when the backend returns 4xx/5xx.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  if (!FEEDBACK_CATEGORIES.includes(input.category)) {
    throw new Error(`feedback_invalid_category:${String(input.category)}`);
  }
  if (input.message.length < 1 || input.message.length > 4000) {
    throw new Error('feedback_message_length_out_of_range');
  }

  // Phase 6 item 1 (2026-06-10, Bug 6) — belt-and-braces sanitize over the
  // WHOLE snapshot + the user's message. Ring entries are sanitized at append
  // time now, but a HISTORICALLY poisoned ring (persisted before this build)
  // would otherwise keep shipping NUL/C0 bytes that 500'd /feedback. \t\n\r
  // survive (legitimate in a typed message).
  const diagnostic = stripControlCharsDeep(buildDiagnosticSnapshot());
  const safeMessage = stripControlChars(input.message);
  const form = new FormData();
  form.append('category', input.category);
  form.append('message', safeMessage);
  // quick-260510-008 — branch on Hermes-presence (NOT Platform.OS — see
  // below) for the diagnostic part shape.
  //
  // Original code: `if (typeof Blob !== 'undefined') { Blob path } else { legacy }`.
  // Hermes (RN 0.83 new architecture) provides a Blob polyfill, so the Blob
  // path was always taken on-device. But RN's networking layer
  // (RCTNetworking + okhttp on Android) silently emits "Network request
  // failed" on the response-read side AFTER the server has returned 201
  // when the multipart body contains a Blob part. The server log shows
  // 201 + a written DB row (we observed this twice on Pixel 10a during the
  // Phase 2 §9 smoke walk on 2026-05-10) but the client's `await
  // res.text()` rejects with that fetch-level error string. Misleading UX:
  // the user sees "Failed" even though their feedback row landed cleanly.
  //
  // Fix: use the legacy `{ name, type, string }` blob-shape on real RN (the
  // multipart path that ships through the native FormData implementation
  // directly, no Blob wrapper). JSDOM (vitest) keeps the spec-compliant
  // Blob branch — JSDOM's FormData throws TypeError on arbitrary-object
  // values, so we can't share the legacy shape with the test runtime.
  //
  // Why `HermesInternal` global instead of `Platform.OS`: Platform.OS is
  // mocked to 'android' in vitest.setup.ts (apps/mobile is Android-MVP),
  // so a Platform-based branch routes JSDOM tests through the legacy path
  // and trips JSDOM's Blob-conversion guard. The HermesInternal global is
  // only injected by the Hermes engine; JSDOM doesn't have it. Cleanly
  // partitions production runtime from test runtime without leaking test-
  // specific knowledge into the production code path.
  //
  // The multipart Content-Type carries `application/json` either way so
  // @fastify/multipart's mimetype allowlist accepts the part.
  const diagnosticJson = JSON.stringify(diagnostic);
  const isHermes =
    typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined';
  if (isHermes) {
    // RN native FormData implementation reads { name, type, string } and emits
    // the multipart part correctly without going through the Blob/RCTBlobManager
    // path that triggers the response-read failure on RN 0.83 new arch.
    form.append(
      'diagnostic',
      {
        name: 'diagnostic.json',
        type: 'application/json',
        string: diagnosticJson,
      } as unknown as Blob,
      'diagnostic.json',
    );
  } else {
    // JSDOM (vitest) path — spec-compliant FormData requires a real Blob.
    form.append(
      'diagnostic',
      new Blob([diagnosticJson], { type: 'application/json' }),
      'diagnostic.json',
    );
  }

  await apiClient.postMultipart<unknown>('/feedback', form, {
    headers: { 'Idempotency-Key': uuid.v4() as string },
  });

  // Phase 6 item 2 (2026-06-10, Bug 6) — send-and-clear, finally wired (the
  // design was documented on telemetryRing.clear() but never called). The
  // events are now archived on the feedback row/S3; clearing means (a) a
  // historically poisoned ring stops replaying on every report and (b) a
  // SECOND report carries fresh events instead of the same 100 forever.
  // Only after a 2xx — a failed POST keeps the ring for the retry.
  try {
    telemetryRing.clear();
  } catch {
    /* best-effort — never fail a delivered report over local cleanup */
  }
}
