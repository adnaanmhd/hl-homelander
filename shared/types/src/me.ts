// Wire DTOs for /me — GET, PATCH, DELETE, POST /me/restore (plan 01-08).
// PATCH body uses the existing UserPatchSchema in user.ts (name + age + gender).
// Response shape derives from UserSchema; email + applicationId + flavor +
// avatarUrl + consentVersion are read-only here (mutated only by /auth/google).

import { z } from 'zod';
import { UserSchema } from './user.js';

export const MeResponseSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  age: true,
  gender: true,
  avatarUrl: true,
  consentVersion: true,
  flavor: true,
  applicationId: true,
  deletedAt: true,
  deleteGraceUntil: true,
  createdAt: true,
  // (Enh 3 / D1, 2026-06-04: the `_events` envelope was removed with the
  // hash-verify flow — /me is no longer an events carrier.)
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// DELETE /me?confirm=DELETE — accidental-click guard (CONTEXT-discretion).
export const MeDeleteQuerySchema = z.object({
  confirm: z.literal('DELETE'),
});

export const MeDeleteResponseSchema = z.object({
  ok: z.literal(true),
  deleteGraceUntil: z.string().datetime(),
});
export type MeDeleteResponse = z.infer<typeof MeDeleteResponseSchema>;

export const MeRestoreResponseSchema = z.object({
  ok: z.literal(true),
});
export type MeRestoreResponse = z.infer<typeof MeRestoreResponseSchema>;
