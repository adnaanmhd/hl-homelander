import { z } from 'zod';

export const TaskSettingSchema = z.enum(['indoor', 'outdoor', 'either']);
export type TaskSetting = z.infer<typeof TaskSettingSchema>;

export const TaskSchema = z.object({
  id: z.string().length(26),
  slug: z.string().min(1).max(80),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1).max(40),
  setting: TaskSettingSchema,
  iconKey: z.string().min(1),
  instructions: z.array(z.string().min(1)).max(3),
});
export type Task = z.infer<typeof TaskSchema>;

// POST /task-requests body
export const TaskRequestCreateSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(240),
  category: z.string().min(1).max(40), // taxonomy or 'Other'
  setting: TaskSettingSchema.refine((s) => s !== 'either', {
    message: 'either not allowed for requests',
  }),
  sampleVideoS3Key: z.string().optional(),
});
export type TaskRequestCreate = z.infer<typeof TaskRequestCreateSchema>;

// === /tasks query schemas (added by plan 01-06) ===

// GET /tasks list — cursor pagination by ULID id
export const TasksListQuerySchema = z.object({
  cursor: z.string().length(26).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category: z.string().min(1).max(40).optional(),
  setting: TaskSettingSchema.optional(),
});
export type TasksListQuery = z.infer<typeof TasksListQuerySchema>;

export const TasksListResponseSchema = z.object({
  items: z.array(TaskSchema),
  nextCursor: z.string().length(26).nullable(),
});
export type TasksListResponse = z.infer<typeof TasksListResponseSchema>;

// GET /tasks/search — RRF k=60 hybrid (vector cosine + tsvector BM25 via ts_rank)
export const TasksSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().min(1).max(40).optional(),
  setting: TaskSettingSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type TasksSearchQuery = z.infer<typeof TasksSearchQuerySchema>;

export const TasksSearchResponseSchema = z.object({
  items: z.array(TaskSchema.extend({ rrf_score: z.number() })),
});
export type TasksSearchResponse = z.infer<typeof TasksSearchResponseSchema>;

// GET / POST /task-requests response
export const TaskRequestSchema = TaskRequestCreateSchema.extend({
  id: z.string().length(26),
  userId: z.string().length(26),
  status: z.enum(['pending', 'reviewed', 'rejected', 'accepted']),
  createdAt: z.string().datetime(),
});
export type TaskRequest = z.infer<typeof TaskRequestSchema>;
