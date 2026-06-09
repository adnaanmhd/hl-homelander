// BUG-3 (2026-06-09) — one-shot, idempotent server-poster-thumbnail backfill.
//
// Recovers existing recordings that finalized BEFORE server-side posters shipped
// (or finalized while the deployed image lacked ffmpeg): rows with
// qa_status IN ('uploaded','verified') AND s3_key_thumbnail IS NULL. For each, a
// poster JPEG is derived from the EXISTING s3_key_video object and PUT to
// thumb.jpg, then s3_key_thumbnail is set — exactly the column the History list
// (GET /recordings) presigns. This is the PRIMARY recovery for the "no uploaded
// videos have thumbnails" symptom (the finalize-retry path is shadowed by the
// idempotency cache + the device dropping rows after a 200, so it can't recover
// the existing fleet — this script can).
//
// Idempotent: it only ever selects STILL-thumbless rows, so a partial run (or a
// re-run after fixing a flaky video) resumes cleanly and never regenerates an
// existing poster. Best-effort per row: a generation failure (undecodable video,
// transient S3 error) is logged and skipped — the row stays NULL and a later
// re-run retries it. Bounded concurrency so we never spawn hundreds of ffmpeg at
// once (the footgun the plan calls out for lazy per-request generation).
//
// 'verified' is a dead-but-retained success synonym (Enh 3 / D1) — included so a
// legacy verified row (empty cohort at MVP) still gets a poster.

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getS3Client, RECORDINGS_BUCKET, recordingKeys } from './s3-client.js';
import { generatePosterThumbnail } from './thumbnail.js';

export interface BackfillResult {
  /** Rows that were thumbless at the start of the run. */
  candidates: number;
  /** Posters successfully generated + persisted. */
  generated: number;
  /** Rows skipped after a generation/persist failure (retried on a re-run). */
  failed: number;
}

export interface BackfillOptions {
  /** Max concurrent ffmpeg subprocesses (default 4 — well under the lazy-gen footgun). */
  concurrency?: number;
  /** Progress sink (defaults to console.log). Tests pass a no-op. */
  log?: (msg: string) => void;
}

/**
 * Run the thumbnail backfill once. Returns counts; never throws on a per-row
 * failure (only on a fatal DB error). Safe to call repeatedly.
 */
export async function backfillThumbnails(opts: BackfillOptions = {}): Promise<BackfillResult> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const log = opts.log ?? ((m: string) => console.log(m));
  const s3 = getS3Client();
  const bucket = RECORDINGS_BUCKET();

  const rows = await db
    .select({
      id: schema.recordings.id,
      userId: schema.recordings.userId,
      s3KeyVideo: schema.recordings.s3KeyVideo,
    })
    .from(schema.recordings)
    .where(
      and(
        inArray(schema.recordings.qaStatus, ['uploaded', 'verified']),
        isNull(schema.recordings.s3KeyThumbnail),
      ),
    );

  log(`[backfill-thumbnails] ${rows.length} thumbless uploaded/verified rows to process`);
  let generated = 0;
  let failed = 0;
  let cursor = 0;

  // Bounded-concurrency worker pool. JS is single-threaded so `cursor++` is
  // atomic; the concurrency bounds only the in-flight ffmpeg subprocesses.
  async function worker(): Promise<void> {
    while (cursor < rows.length) {
      const r = rows[cursor++]!;
      const keys = recordingKeys({ userId: r.userId, recordingId: r.id });
      try {
        await generatePosterThumbnail({
          s3,
          bucket,
          videoKey: r.s3KeyVideo,
          thumbKey: keys.thumbnail,
        });
        await db
          .update(schema.recordings)
          .set({ s3KeyThumbnail: keys.thumbnail })
          .where(eq(schema.recordings.id, r.id));
        generated += 1;
      } catch (err) {
        failed += 1;
        log(`[backfill-thumbnails] skip ${r.id}: ${(err as Error).message}`);
      }
      const done = generated + failed;
      if (done % 25 === 0 || done === rows.length) {
        log(`[backfill-thumbnails]   ${done}/${rows.length} (${generated} ok, ${failed} failed)`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

  log(`[backfill-thumbnails] done — ${generated} written, ${failed} skipped (re-run retries them)`);
  return { candidates: rows.length, generated, failed };
}
