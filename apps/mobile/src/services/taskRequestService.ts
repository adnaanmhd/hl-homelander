// Phase 6 Wave 3 — `/task-requests` wrapper (TASK-08 + 06-CONTEXT D-09).
//
// Sends a JSON body matching Phase 1 TaskRequestCreateSchema:
//   field "name"        — 3..80 chars
//   field "description" — 10..240 chars
//   field "category"    — taxonomy category OR 'Other'
//   field "setting"     — 'indoor' | 'outdoor'
//
// The Plan 06-05 original draft of this wrapper used multipart/form-data on
// the assumption that the sample-video file picker (TASK-08 OPTIONAL field)
// would ship at MVP. Plan 06-07 D-sample-video deferred the picker; the
// server route at apps/api/src/routes/tasks/create-request.ts only accepts
// JSON (no multipart parser registered). Hitting it with multipart returns
// 415 Unsupported Media Type — caught during the 06-MANUAL-SMOKE walk
// 2026-05-14. When the sample-video upload lands in §v2 it gets its own
// /task-requests/sample endpoint OR multipart support is added to the
// existing route + an S3 staging key.
//
// Idempotency-Key is a fresh UUIDv4 per call (Phase 1 API-15).

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
 * POST /task-requests — JSON submit. Throws (before network):
 *   - `task_request_name_length_out_of_range`        — name < 3 or > 80
 *   - `task_request_description_length_out_of_range` — description < 10 or > 240
 *   - `task_request_invalid_setting:${value}`         — setting not in enum
 *   - `task_request_sample_video_not_supported_at_mvp` — sampleVideoUri set at MVP
 *
 * Throws (network): the apiClient.post rejection text (Phase 1 problem-detail
 * body when the backend returns 4xx/5xx).
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

  // The server route (apps/api/src/routes/tasks/create-request.ts) accepts a
  // JSON body matching TaskRequestCreateSchema; it has no multipart parser
  // registered for this path. The original multipart framing here anticipated
  // a sample-video file picker that Plan 06-07 explicitly deferred (TASK-08
  // OPTIONAL note + Plan 06-07 D-sample-video). Hitting the route with
  // multipart returns 415 Unsupported Media Type (smoke-walk finding
  // 2026-05-14). When the sample-video upload lands in §v2 it gets a
  // dedicated /task-requests/sample endpoint or a multipart parser added to
  // the server route — not a quiet re-shape of this method.
  if (input.sampleVideoUri) {
    throw new Error('task_request_sample_video_not_supported_at_mvp');
  }
  const body: {
    name: string;
    description: string;
    category: string;
    setting: 'indoor' | 'outdoor';
  } = {
    name: input.name,
    description: input.description,
    category: input.category,
    setting: input.setting,
  };
  return apiClient.post<TaskRequestResult>('/task-requests', body, {
    idempotencyKey: uuid.v4() as string,
  });
}
