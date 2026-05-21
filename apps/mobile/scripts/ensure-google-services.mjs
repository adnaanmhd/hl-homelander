#!/usr/bin/env node
/**
 * Fail fast before Gradle when google-services.json is missing.
 */
import { accessSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(
  root,
  'android/app/src/apkRollout/google-services.json',
);

try {
  accessSync(dest);
} catch {
  console.error(`
error: missing ${dest}

Firebase config is per-developer (gitignored). To fix:

  1. Firebase Console → project homelander-24045 (GCP #130483521533)
  2. Project settings → Your apps → Android "ai.humynlabs.capture.apk"
  3. Download google-services.json
  4. bash scripts/setup-google-services.sh ~/Downloads/google-services.json

See android/app/src/apkRollout/google-services.json.example for the expected shape.
`);
  process.exit(1);
}
