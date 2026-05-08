// Global setup — runs ONCE before all worker pools start, so env vars are
// populated in the parent vitest process and inherited by every worker fork.
// This runs strictly before `setupFiles` (per-worker) and before any test
// file's imports resolve, so src/db/index.ts's lazy pool, jwt secret, S3
// client, and embedder all see the right env at module-load time.
//
// CI workflows export env directly (.github/workflows/api-ci.yml) — this
// helper is a no-op when the env vars are already set.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export default function globalSetup(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // global-setup.ts is at apps/api/test/e2e/; .env is at apps/api/.env (two up).
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
