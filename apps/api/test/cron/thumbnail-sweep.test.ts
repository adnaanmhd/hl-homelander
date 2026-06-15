// Phase 4 item 1 (2026-06-10, Bug 4) — the in-process thumbnail recovery
// sweep. Scheduling guard: ffmpeg-absent → loud warn + NO backfill + NO
// interval; present → boot sweep after bootDelayMs (deferred off the cold-start
// window; tests pass 0) with per-sweep counts logged; the re-entry guard skips
// a tick that fires mid-backfill.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/lib/thumbnail.js', () => ({
  isFfmpegAvailable: vi.fn(() => true),
}));
vi.mock('../../src/lib/thumbnail-backfill.js', () => ({
  backfillThumbnails: vi.fn(async () => ({ candidates: 0, generated: 0, failed: 0 })),
}));

import {
  startThumbnailSweep,
  stopThumbnailSweep,
  runThumbnailSweepOnce,
} from '../../src/cron/thumbnail-sweep.js';
import { isFfmpegAvailable } from '../../src/lib/thumbnail.js';
import { backfillThumbnails } from '../../src/lib/thumbnail-backfill.js';

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

beforeEach(() => {
  vi.mocked(isFfmpegAvailable).mockReset().mockReturnValue(true);
  vi.mocked(backfillThumbnails)
    .mockReset()
    .mockResolvedValue({ candidates: 3, generated: 2, failed: 1 });
});

afterEach(() => {
  stopThumbnailSweep();
});

describe('thumbnail sweep (Phase 4, Bug 4)', () => {
  it('ffmpeg absent → warns loudly, never calls backfill, schedules nothing', async () => {
    vi.mocked(isFfmpegAvailable).mockReturnValue(false);
    const log = makeLogger();
    startThumbnailSweep(log);
    await new Promise((r) => setTimeout(r, 0));
    expect(log.warn).toHaveBeenCalledWith({}, expect.stringContaining('thumbnail sweep DISABLED'));
    expect(backfillThumbnails).not.toHaveBeenCalled();
  });

  it('ffmpeg present → boot sweep fires (bootDelayMs elapsed) and logs scanned/generated/failed', async () => {
    const log = makeLogger();
    startThumbnailSweep(log, 60 * 60 * 1000, 0);
    await new Promise((r) => setTimeout(r, 0));
    expect(backfillThumbnails).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 2 }));
    expect(log.info).toHaveBeenCalledWith(
      { scanned: 3, generated: 2, failed: 1 },
      'thumbnail_sweep_complete',
    );
  });

  it('boot sweep is DEFERRED — nothing runs inside the boot-delay window, and stop cancels it', async () => {
    const log = makeLogger();
    startThumbnailSweep(log, 60 * 60 * 1000, 60 * 1000);
    await new Promise((r) => setTimeout(r, 0));
    expect(backfillThumbnails).not.toHaveBeenCalled();
    stopThumbnailSweep(); // clears the pending boot timer too
    await new Promise((r) => setTimeout(r, 0));
    expect(backfillThumbnails).not.toHaveBeenCalled();
  });

  it('a backfill failure is logged and never throws (the next tick retries)', async () => {
    vi.mocked(backfillThumbnails).mockRejectedValue(new Error('db down'));
    const log = makeLogger();
    await runThumbnailSweepOnce(log);
    expect(log.warn).toHaveBeenCalledWith({ err: expect.any(Error) }, 'thumbnail_sweep_failed');
  });

  it('re-entry guard: a tick that fires mid-backfill is skipped, not stacked', async () => {
    let release!: () => void;
    vi.mocked(backfillThumbnails).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ candidates: 0, generated: 0, failed: 0 });
        }),
    );
    const log = makeLogger();
    const first = runThumbnailSweepOnce(log); // holds _running
    await new Promise((r) => setTimeout(r, 0));
    await runThumbnailSweepOnce(log); // overlapping tick → skipped
    expect(backfillThumbnails).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith({}, 'thumbnail_sweep_skipped_already_running');
    release();
    await first;
  });
});
