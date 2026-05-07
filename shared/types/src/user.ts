import { z } from 'zod';

export const FlavorSchema = z.enum(['apkRollout', 'playStore', 'iosAppStore']);
export type Flavor = z.infer<typeof FlavorSchema>;

export const UserSchema = z.object({
  id: z.string().length(26),
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().int().min(13).max(120).nullable(),
  gender: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  consentVersion: z.string(),
  consentAcceptedAt: z.string().datetime(),
  flavor: FlavorSchema,
  applicationId: z.string(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  deleteGraceUntil: z.string().datetime().nullable(),
});
export type User = z.infer<typeof UserSchema>;

// PATCH /me body — only editable fields
export const UserPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  age: z.number().int().min(13).max(120).nullable().optional(),
  gender: z.string().max(40).nullable().optional(),
});
export type UserPatch = z.infer<typeof UserPatchSchema>;
