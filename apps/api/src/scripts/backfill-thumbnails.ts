// One-shot server-poster-thumbnail backfill (BUG-3 / D-THUMB) — CLI wrapper.
//
// Recovers existing recordings with no server poster (qa_status uploaded/verified
// AND s3_key_thumbnail NULL) by deriving a JPEG from the stored video object.
// The reusable, testable core lives in src/lib/thumbnail-backfill.ts; this file
// is just the CLI surface (env preflight + ffmpeg check + exit codes). It lives
// under src/ (not scripts/) so `tsc -b` emits dist/scripts/backfill-thumbnails.js
// into the Docker image, making it runnable as a one-off ECS task.
//
// Usage (staging/prod — DATABASE_URL + AWS_* + RECORDINGS_BUCKET exported, and
// ffmpeg on PATH, the SAME dependency as /recordings/:id/finalize):
//   dev:   pnpm --filter @humyn/api backfill:thumbnails
//   image: node dist/scripts/backfill-thumbnails.js   (one-off ECS task)
//
// Idempotent: only touches still-thumbless rows, so it's safe to re-run (e.g.
// after a deploy that adds ffmpeg, or to pick up rows a flaky first pass skipped).
// Since 2026-06-10 the API process also runs this sweep itself at boot + hourly
// (src/app.ts) — this CLI remains for one-off ops runs.

import { getPool } from '../db/index.js';
import { backfillThumbnails } from '../lib/thumbnail-backfill.js';
import { isFfmpegAvailable } from '../lib/thumbnail.js';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[backfill-thumbnails] DATABASE_URL not set');
    process.exit(1);
  }
  if (!isFfmpegAvailable()) {
    console.error(
      '[backfill-thumbnails] ffmpeg not found on PATH — cannot generate posters. ' +
        'Install ffmpeg (or run inside the API image, which bundles it) and re-run.',
    );
    process.exit(1);
  }

  const result = await backfillThumbnails();
  console.log(
    `[backfill-thumbnails] complete — candidates=${result.candidates} ` +
      `generated=${result.generated} failed=${result.failed}`,
  );
  // Drain the pg pool so the process exits cleanly (and the final logs flush)
  // without relying on process.exit yanking the runtime out from under an open
  // pool. A non-zero failed count isn't fatal (per-row best-effort; a re-run
  // retries) but gets a distinct exit code so an operator notices.
  await getPool().end();
  process.exit(result.failed > 0 ? 2 : 0);
}

main().catch(async (err) => {
  console.error('[backfill-thumbnails] failed', err);
  await getPool()
    .end()
    .catch(() => {});
  process.exit(1);
});
