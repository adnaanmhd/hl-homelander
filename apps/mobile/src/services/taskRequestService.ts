// Phase 6 Wave 3 — `/task-requests` wrapper (TASK-08 + 06-CONTEXT D-09).
//
// Mirrors the existing `feedbackService.submitFeedback` multipart pattern
// (the closest analog — both ship a small JSON payload + an optional file
// part to a single endpoint protected by per-user rate-limit + an
// Idempotency-Key). Pre-network validation rejects out-of-range name +
// description so a typo doesn't burn the rate-limit budget.
//
// Wire shape (multipart/form-data) — matches the Phase 1
// TaskRequestCreateSchema:
//   field "name"        — 3..80 chars
//   field "description" — 10..240 chars
//   field "category"    — taxonomy category OR 'Other'
//   field "setting"     — 'indoor' | 'outdoor'
//   file  "sample"      — optional .mp4 (the sample-video preview the user
//                          chose via the file-picker; the server stages it
//                          to S3 under `task-request-samples/`)
//
// Idempotency-Key is a fresh UUIDv4 per call (Phase 1 API-15). The body
// shape on the sample part is Hermes-vs-JSDOM-aware via the same
// branching pattern feedbackService.ts uses — see that file for the
// full rationale on why a manual `{name, type, uri}` blob shape ships on
// real RN and a spec-compliant `Blob` ships under JSDOM tests.

import uuid from 'react-native-uuid';
import { apiClient } from './api';

export interface TaskRequestInput {
  /** 3..80 chars (server also validates per TaskRequestCreateSchema). */
  name: string;
  /** 10..240 chars. */
  description: string;
  /** A taxonomy category from `design-system/task-icons/mapping.ts` OR the literal 'Other'. */
  category: string;
  /** 'indoor' | 'outdoor' — TaskSettingSchema refines 'either' out for requests. */
  setting: 'indoor' | 'outdoor';
  /** Optional local file:// URI to a .mp4 the user picked. */
  sampleVideoUri?: string;
}

export interface TaskRequestResult {
  id: string;
}

/**
 * POST /task-requests — multipart submit. Throws (before network):
 *   - `task_request_name_length_out_of_range`        — name < 3 or > 80
 *   - `task_request_description_length_out_of_range` — description < 10 or > 240
 *   - `task_request_invalid_setting:${value}`         — setting not in enum
 *
 * Throws (network): the apiClient.postMultipart rejection text (Phase 1
 * problem-detail body when the backend returns 4xx/5xx).
 */
export async function submitTaskRequest(input: TaskRequestInput): Promise<TaskRequestResult> {
  // Pre-flight validation. The server also enforces these (Phase 1
  // TaskRequestCreateSchema) but rejecting client-side drops bad input
  // before the wire hop + the per-user rate-limit budget.
  if (input.name.length < 3 || input.name.length > 80) {
    throw new Error('task_request_name_length_out_of_range');
  }
  if (input.description.length < 10 || input.description.length > 240) {
    throw new Error('task_request_description_length_out_of_range');
  }
  if (input.setting !== 'indoor' && input.setting !== 'outdoor') {
    throw new Error(`task_request_invalid_setting:${String(input.setting)}`);
  }

  const form = new FormData();
  form.append('name', input.name);
  form.append('description', input.description);
  form.append('category', input.category);
  form.append('setting', input.setting);

  if (input.sampleVideoUri) {
    // Hermes-vs-JSDOM branch (see feedbackService.ts:152-176 for the full
    // rationale). On real RN, attach the file by URI via the legacy
    // FormData blob shape; on JSDOM (vitest), use a real Blob with the
    // file:// URI as the body bytes (the test never reads the bytes; it
    // only asserts that the part lands).
    const isHermes =
      typeof (globalThis as { HermesInternal?: unknown }).HermesInternal !== 'undefined';
    if (isHermes) {
      form.append(
        'sample',
        {
          uri: input.sampleVideoUri,
          name: 'sample.mp4',
          type: 'video/mp4',
        } as unknown as Blob,
        'sample.mp4',
      );
    } else {
      form.append('sample', new Blob([input.sampleVideoUri], { type: 'video/mp4' }), 'sample.mp4');
    }
  }

  return apiClient.postMultipart<TaskRequestResult>('/task-requests', form, {
    headers: { 'Idempotency-Key': uuid.v4() as string },
  });
}
