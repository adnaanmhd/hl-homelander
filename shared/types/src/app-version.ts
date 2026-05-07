// Wire DTOs for GET /app/version (API-13).
//
// Per D-APK-02, the response shape is per-flavor:
//   - apkRollout  → { apkUrl, apkSha256, playStoreUrl: null }
//   - playStore   → { playStoreUrl, apkUrl: null, apkSha256: null }
//   - iosAppStore → { playStoreUrl: <App Store URL>, apkUrl: null, apkSha256: null }
//
// The discriminated-union shape lets clients narrow on `flavor` and access the
// correct upgrade URL without optional-chaining gymnastics. iosAppStore mirrors
// playStore's wire layout — only the URL host differs. The route is the only
// unauthenticated route in plan 01-08; pre-sign-in upgrade prompts read it.

import { z } from 'zod';
import { FlavorSchema } from './user.js';

export const AppVersionQuerySchema = z.object({
  flavor: FlavorSchema,
});
export type AppVersionQuery = z.infer<typeof AppVersionQuerySchema>;

export const AppVersionResponseSchema = z.discriminatedUnion('flavor', [
  z.object({
    flavor: z.literal('apkRollout'),
    minSupported: z.string(),
    latest: z.string(),
    forceUpgrade: z.boolean(),
    apkUrl: z.string().url(),
    apkSha256: z.string().length(64),
    playStoreUrl: z.null(),
  }),
  z.object({
    flavor: z.literal('playStore'),
    minSupported: z.string(),
    latest: z.string(),
    forceUpgrade: z.boolean(),
    apkUrl: z.null(),
    apkSha256: z.null(),
    playStoreUrl: z.string().url(),
  }),
  z.object({
    flavor: z.literal('iosAppStore'),
    minSupported: z.string(),
    latest: z.string(),
    forceUpgrade: z.boolean(),
    apkUrl: z.null(),
    apkSha256: z.null(),
    playStoreUrl: z.string().url(),
  }),
]);
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;
