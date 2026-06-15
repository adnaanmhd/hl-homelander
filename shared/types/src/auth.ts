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
  // Bug 4 / D2 (2026-06-04) — the stable per-install id (UUID v4 from the
  // client's getInstallationId()). Binds the account to the most-recent device:
  // the server writes it onto users.current_installation_id on each sign-in and
  // requireAuth 401s a prior device whose JWT installationId no longer matches
  // (newest-login-wins). Overrides LOCKED D-AUTH-03 (stateless, no denylist).
  installationId: z.string().min(1).max(128),
  // Review fix (2026-06-10) — true for a MACHINE-initiated re-auth (the upload
  // pipeline's silent Google re-auth on token expiry). Newest-LOGIN-wins means
  // interactive logins only: when silent is set and the account is bound to a
  // DIFFERENT installation, the server replies 401 `device-evicted` WITHOUT
  // rebinding (and never creates an account / stamps consent) — otherwise a
  // drawer phone's background drain would steal the binding and evict the
  // phone the user is actively using. Optional: absent (old APKs, interactive
  // sign-in) keeps full last-writer-wins behavior.
  silent: z.boolean().optional(),
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
    // Bug 5 / D7 (2026-06-04) — practice-tutorial completion timestamp (or null).
    // Returned at sign-in so the client deterministically seeds its local ONB-08
    // flag (no extra /me round-trip) and a returning user on a fresh install /
    // new device skips the tutorial on FIRST launch (CompatPass → MainTabs).
    practiceCompletedAt: z.string().datetime().nullable(),
  }),
});
export type AuthGoogleResponse = z.infer<typeof AuthGoogleResponseSchema>;
