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
