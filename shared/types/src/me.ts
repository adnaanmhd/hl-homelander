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
}).extend({
  // Bug 5 / D7 (2026-06-04) — practice-tutorial completion timestamp (or null).
  // The client seeds its local ONB-08 flag from this so the tutorial is skipped
  // on a fresh install / new device once practice is done server-side.
  practiceCompletedAt: z.string().datetime().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// POST /me/practice-complete — idempotent: sets practice_completed_at if NULL,
// returns the (possibly pre-existing) timestamp. Bug 5 / D7.
export const MePracticeCompleteResponseSchema = z.object({
  practiceCompletedAt: z.string().datetime(),
});
export type MePracticeCompleteResponse = z.infer<typeof MePracticeCompleteResponseSchema>;

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
