// Wire DTOs for /me — GET, PATCH, DELETE, POST /me/restore (plan 01-08).
// PATCH body uses the existing UserPatchSchema in user.ts (name + age + gender).
// Response shape derives from UserSchema; email + applicationId + flavor +
// avatarUrl + consentVersion are read-only here (mutated only by /auth/google).

import { z } from 'zod';
import { UserSchema } from './user.js';
import { EventsEnvelopeSchema } from './recording.js';

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
  // Pattern 22 — `GET /me` / `PATCH /me` are authenticated carriers for the
  // `events-outbox` onSend hook (Plan 05-05); accept the optional `_events` key.
}).extend(EventsEnvelopeSchema.shape);
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
