import { defineConfig } from 'vitest/config';

// Serialize test execution against the shared dev Postgres DB. Multiple test
// files race on `db.delete(schema.<table>)` in their beforeEach hooks; running
// in parallel produced flaky failures (one file deleting rows mid-flight while
// another file's test is reading them). poolOptions.forks.singleFork=true forces
// one worker that runs files sequentially. Plan 12 will move to per-test
// BEGIN/ROLLBACK isolation so we can re-enable parallel.
//
// Plan 01-12: e2e tests live under test/e2e/** and are excluded here. They run
// via `pnpm test:e2e` against vitest.e2e.config.ts (longer timeouts for
// embedder cold-start + LocalStack multipart upload).
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/e2e/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
