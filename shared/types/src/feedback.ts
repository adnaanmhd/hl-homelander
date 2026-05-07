// Wire DTOs for POST /feedback (API-12). The wire form is multipart/form-data;
// these schemas describe the FIELDS portion. The diagnostic.json file part is
// optional and validated at the route (content-type allowlist + 5 MB cap).
//
// Categories — derived from help-center-content.md FAQs + Troubleshooting and
// kept stable here. If new help-center entries land, this enum updates in lock
// step so the in-app feedback selector matches the support taxonomy.

import { z } from 'zod';

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
export const FeedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);

export const FeedbackFieldsSchema = z.object({
  category: FeedbackCategorySchema,
  message: z.string().min(1).max(4000),
});
export type FeedbackFields = z.infer<typeof FeedbackFieldsSchema>;

export const FeedbackResponseSchema = z.object({
  id: z.string().length(26),
  diagnosticS3Key: z.string().nullable(),
});
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
