import { z } from 'zod';
import { FlavorSchema } from './user.js';

export const AuthNonceResponseSchema = z.object({
  nonceId: z.string().length(26),
  nonce: z.string().min(1),
});
export type AuthNonceResponse = z.infer<typeof AuthNonceResponseSchema>;

export const AuthGoogleRequestSchema = z.object({
  googleIdToken: z.string().min(1),
  // iosAppStore sends '' (App Attest deferred to Phase 7 per RESEARCH §2.1 iOS note)
  integrityToken: z.string(),
  flavor: FlavorSchema,
  applicationId: z.string().min(1),
  nonceId: z.string().length(26),
});
export type AuthGoogleRequest = z.infer<typeof AuthGoogleRequestSchema>;

export const AuthGoogleResponseSchema = z.object({
  jwt: z.string().min(1),
  user: z.object({
    id: z.string().length(26),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().url().nullable(),
    flavor: FlavorSchema,
    applicationId: z.string(),
    consentVersion: z.string(),
  }),
});
export type AuthGoogleResponse = z.infer<typeof AuthGoogleResponseSchema>;
