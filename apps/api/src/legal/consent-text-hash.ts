// THIS FILE IS GENERATED. Do not edit by hand.
// Run: pnpm --filter @humyn/api run legal:hash
//
// Boot-guard (apps/api/src/legal/boot-guard.ts) refuses to start the API if the
// on-disk consent-text.ts SHA-256 does not match this constant. CI runs the
// hash regenerator before tests so any consent-text mutation without a paired
// hash refresh fails the build (W7).
export const CONSENT_TEXT_SHA256 =
  '1c78b1ed6cf3211ab4f3e438d47bfcad34e91fbe9cff1e70ee4c2f3fbcc2c56f';
