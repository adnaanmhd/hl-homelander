import { defineConfig } from 'vitest/config';

// Serialize test execution against the shared dev Postgres DB. Multiple test
// files race on `db.delete(schema.<table>)` in their beforeEach hooks; running
// in parallel produced flaky failures (one file deleting rows mid-flight while
// another file's test is reading them). poolOptions.forks.singleFork=true forces
// one worker that runs files sequentially. Plan 12 will move to per-test
// BEGIN/ROLLBACK isolation so we can re-enable parallel.
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
