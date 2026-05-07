// Deterministic regenerator for apps/api/src/legal/consent-text-hash.ts.
// Reads CONSENT_TEXT, writes the SHA-256 hex into consent-text-hash.ts.
//
// Run: pnpm --filter @humyn/api run legal:hash
//
// Boot-guard (apps/api/src/legal/boot-guard.ts) verifies the on-disk
// consent-text.ts SHA-256 against the constant this script writes. Any drift
// refuses to start the API at process boot — counsel-trust requires this.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CONSENT_TEXT } from '../src/legal/consent-text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HASH_FILE = resolve(__dirname, '../src/legal/consent-text-hash.ts');

const hash = createHash('sha256').update(CONSENT_TEXT).digest('hex');

const banner = `// THIS FILE IS GENERATED. Do not edit by hand.
// Run: pnpm --filter @humyn/api run legal:hash
//
// Boot-guard (apps/api/src/legal/boot-guard.ts) refuses to start the API if the
// on-disk consent-text.ts SHA-256 does not match this constant. CI runs the
// hash regenerator before tests so any consent-text mutation without a paired
// hash refresh fails the build (W7).
`;

// Emit in the prettier-canonical split form: prettier (printWidth=100) splits
// `export const CONSENT_TEXT_SHA256 = '<64-char-hex>';` (102 cols) onto two
// lines. Match it here so re-running `pnpm legal:hash` post-commit yields no
// diff (the determinism contract the boot-guard relies on).
const body = `export const CONSENT_TEXT_SHA256 =
  '${hash}';
`;

writeFileSync(HASH_FILE, banner + body, 'utf8');
console.log(`[legal-hash] wrote ${HASH_FILE} (sha256=${hash})`);
