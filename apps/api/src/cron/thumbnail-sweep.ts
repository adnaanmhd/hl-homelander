// Phase 4 item 1 (2026-06-10, Bug 4 / IMPLEMENTATION-PLAN-260610 §5) — the
// in-process poster-thumbnail recovery sweep.
//
// Why in-process: the manual backfill CLI was structurally unrunnable in
// staging (not compiled into the image until Phase 0, DB in a private subnet,
// no pipeline to exec it) — so "run the backfill" silently never happened and
// the fleet sat thumbless. Running backfillThumbnails() inside the API process
// (which already has DB + S3 + ffmpeg) makes recovery self-healing: rows whose
// finalize-time generation failed get retried every sweep, with no operator
// action. The CLI remains for one-off ops use.
//
// Shape mirrors cron/dsr-hard-delete.ts: module-level timer guard, run once at
// boot + hourly, unref'd so the timer never pins the process. Concurrency 2 —
// half the CLI default; the sweep shares the API process with live traffic.
//
// Scale-out note: assumes ECS desired_count = 1 (same invariant as the
// eviction LRU — see the boot log in app.ts). Two instances would run
// duplicate sweeps; backfillThumbnails is idempotent so that's wasteful, not
// corrupting, but don't scale out without revisiting.

import { isFfmpegAvailable } from '../lib/thumbnail.js';
import { backfillThumbnails } from '../lib/thumbnail-backfill.js';

export const THUMBNAIL_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
// Review fix (2026-06-10) — the boot sweep is DEFERRED: a post-deploy boot is
// exactly when the backlog is largest, and an immediate sweep (candidate
// SELECT + up to 2 concurrent ffmpeg spawns) would contend with the new ECS
// task's first live requests during cold start.
export const THUMBNAIL_SWEEP_BOOT_DELAY_MS = 60 * 1000;

export interface SweepLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

let _timer: NodeJS.Timeout | undefined;
let _bootTimer: NodeJS.Timeout | undefined;
let _running = false;

/**
 * One sweep pass. Exported for tests. Never throws; logs scanned/generated/
 * failed counts. The `_running` guard skips an hourly tick that fires while a
 * large backfill from the previous tick is still in flight.
 */
export async function runThumbnailSweepOnce(logger: SweepLogger): Promise<void> {
  if (_running) {
    logger.info({}, 'thumbnail_sweep_skipped_already_running');
    return;
  }
  _running = true;
  try {
    const res = await backfillThumbnails({
      concurrency: 2,
      // Route the backfill's per-row progress lines through the app logger.
      log: (msg: string) => logger.info({}, msg),
    });
    logger.info(
      { scanned: res.candidates, generated: res.generated, failed: res.failed },
      'thumbnail_sweep_complete',
    );
  } catch (err) {
    // A fatal DB error etc. — the next tick retries; never crash the API.
    logger.warn({ err }, 'thumbnail_sweep_failed');
  } finally {
    _running = false;
  }
}

/**
 * Start the sweep: once at boot (after [THUMBNAIL_SWEEP_BOOT_DELAY_MS]) + every
 * [THUMBNAIL_SWEEP_INTERVAL_MS]. No-ops (with a loud warn) when ffmpeg is
 * absent — generation cannot work, and a sweep that fails every row hourly is
 * just noise.
 */
export function startThumbnailSweep(
  logger: SweepLogger,
  intervalMs: number = THUMBNAIL_SWEEP_INTERVAL_MS,
  bootDelayMs: number = THUMBNAIL_SWEEP_BOOT_DELAY_MS,
): void {
  if (_timer) return;
  if (!isFfmpegAvailable()) {
    logger.warn(
      {},
      'thumbnail sweep DISABLED — ffmpeg not on PATH; thumbless rows will not self-heal',
    );
    return;
  }
  _bootTimer = setTimeout(() => {
    _bootTimer = undefined;
    void runThumbnailSweepOnce(logger);
  }, bootDelayMs);
  _bootTimer.unref?.();
  _timer = setInterval(() => {
    void runThumbnailSweepOnce(logger);
  }, intervalMs);
  _timer.unref?.();
}

export function stopThumbnailSweep(): void {
  if (_bootTimer) {
    clearTimeout(_bootTimer);
    _bootTimer = undefined;
  }
  if (_timer) {
    clearInterval(_timer);
    _timer = undefined;
  }
}
