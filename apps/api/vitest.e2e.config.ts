// E2E vitest config — separate from vitest.config.ts (the unit/integration config).
//
// Why a separate config?
//   - The e2e suite exercises every Phase 1 endpoint in sequence (golden path)
//     plus 9 negative-path scenarios. Several tests do real LocalStack S3
//     multipart uploads + Play-Integrity-mocked /auth/google flow + Postgres
//     trigger fan-out, which is slow (3-5s per test on a warm machine, more
//     on cold start because of the embedder model load).
//   - The unit-test pool already runs in singleFork mode at file granularity,
//     but the e2e suite lives at `test/e2e/**` and is excluded from the unit
//     config's include glob (`test/**/*.test.ts` excludes `test/e2e/**` here
//     by way of explicit overrides).
//   - The hookTimeout is bumped to 120s to accommodate the embedder cold-start
//     (preloadEmbedder() in setup.ts) — first run downloads the ~24 MB model.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    globalSetup: ['test/e2e/global-setup.ts'],
    setupFiles: ['test/e2e/setup.ts'],
    testTimeout: 120_000, // e2e tests can be slow (model load, multipart upload)
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }, // serial — we share the dev DB
    },
  },
});
