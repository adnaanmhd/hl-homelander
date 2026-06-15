// THIS FILE IS GENERATED. Do not edit by hand.
// Run: pnpm --filter @humyn/api run legal:hash
//
// Boot-guard (apps/api/src/legal/boot-guard.ts) refuses to start the API if the
// on-disk consent-text.ts SHA-256 does not match this constant. CI runs the
// hash regenerator before tests so any consent-text mutation without a paired
// hash refresh fails the build (W7).
export const CONSENT_TEXT_SHA256 =
  '6c7dfcc73aa8fb3c7008a067b12deb9b3220c0ff8ab7457b319ca2296f605d35';
