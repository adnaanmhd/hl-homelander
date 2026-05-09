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

  const diagnostic = buildDiagnosticSnapshot();
  const form = new FormData();
  form.append('category', input.category);
  form.append('message', input.message);
  // RN's FormData polyfill accepts a `{ name, type, string }` blob-shape
  // (react-native/Libraries/Network/FormData.js → falls through to a
  // text/* part with the supplied content-type). On JSDOM (vitest) FormData
  // requires a real Blob, so we hand it a Blob in either runtime. The
  // multipart Content-Type carries `application/json` so @fastify/multipart's
  // mimetype allowlist accepts the part.
  const diagnosticJson = JSON.stringify(diagnostic);
  let diagnosticPart: Blob;
  if (typeof Blob !== 'undefined') {
    diagnosticPart = new Blob([diagnosticJson], { type: 'application/json' });
    form.append('diagnostic', diagnosticPart, 'diagnostic.json');
  } else {
    // RN < 0.76 fallback path: cast the polyfill blob-shape to Blob to satisfy
    // FormData.append's TS signature. The native FormData class reads
    // { name, type, string } and emits the multipart part correctly.
    form.append(
      'diagnostic',
      {
        name: 'diagnostic.json',
        type: 'application/json',
        string: diagnosticJson,
      } as unknown as Blob,
      'diagnostic.json',
    );
  }

  await apiClient.postMultipart<unknown>('/feedback', form, {
    headers: { 'Idempotency-Key': uuid.v4() as string },
  });
}
