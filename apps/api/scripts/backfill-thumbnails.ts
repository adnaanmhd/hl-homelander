// One-shot server-poster-thumbnail backfill (BUG-3 / D-THUMB) — CLI wrapper.
//
// Recovers existing recordings with no server poster (qa_status uploaded/verified
// AND s3_key_thumbnail NULL) by deriving a JPEG from the stored video object.
// The reusable, testable core lives in src/lib/thumbnail-backfill.ts; this file
// is just the CLI surface (env preflight + ffmpeg check + exit codes).
//
// Usage (staging/prod — DATABASE_URL + AWS_* + RECORDINGS_BUCKET exported, and
// ffmpeg on PATH, the SAME dependency as /recordings/:id/finalize):
//   pnpm --filter @humyn/api exec tsx scripts/backfill-thumbnails.ts
//
// Idempotent: only touches still-thumbless rows, so it's safe to re-run (e.g.
// after a deploy that adds ffmpeg, or to pick up rows a flaky first pass skipped).

import { getPool } from '../src/db/index.js';
import { backfillThumbnails } from '../src/lib/thumbnail-backfill.js';
import { isFfmpegAvailable } from '../src/lib/thumbnail.js';

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
