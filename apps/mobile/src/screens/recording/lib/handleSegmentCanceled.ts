// handleSegmentCanceled — pure helper for RecordingScreen's onSegmentCanceled
// subscription. Extracted from RecordingScreen.tsx so it can be unit-tested
// without mounting the full screen. Quick task 260517-p5g CAPTURE-QA-04..06.
//
// Contract (write-then-delete):
//   1. Practice-guard: when isPractice || taskId === '__practice__', the
//      handler returns early WITHOUT writing a History row or deleting
//      files (ONB-04 — practice never appears in History).
//   2. Otherwise, write the History ledger entry FIRST (best-effort MMKV
//      write; failure is silently swallowed so the disk-reclaim path
//      below still runs).
//   3. Then unlink the three bundle files (MP4 + IMU CSV + metadata JSON)
//      from cacheDir. Best-effort — a missing file is OK.
//   4. NEVER call HumynUpload.enqueue — that's the whole point of the
//      cancel. (`UploadQueueStore.enqueue` has a belt-and-braces backstop
//      that refuses canceled rows, but this handler is the primary gate.)
//
// The function is pure-with-side-effects: all I/O is delegated to the
// injected `deps` so tests can mock the History write + file unlinks.

import type { SegmentCanceledEvent } from '../../../native/HumynCapture';
import type { ThumbnailLedgerEntry } from '../../../services/thumbnailLedger';

/**
 * Injected dependencies — keeps the helper testable without spinning up
 * MMKV, RNFS, or the React tree.
 */
export interface HandleSegmentCanceledDeps {
  /** isPractice flag from the recording route params. */
  isPractice: boolean;
  /** taskId from the recording route params (`'__practice__'` for practice). */
  taskId: string;
  /** History ledger write — mirrors `thumbnailLedger.writeEntry`. */
  writeLedgerEntry: (entry: ThumbnailLedgerEntry) => void;
  /**
   * Unlink a file from cacheDir. Mirrors `RNFS.unlink`. May throw on a
   * missing file — the caller swallows the rejection.
   */
  unlink: (path: string) => Promise<void>;
  /**
   * Optional clock seam for the `createdAtMs` ledger field. Defaults to
   * `Date.now()`; tests override for determinism.
   */
  now?: () => number;
}

/**
 * Handle one `onSegmentCanceled` event from the native FinalizeWorker.
 *
 * Returns a Promise that resolves when the unlinks have settled — used
 * by tests to assert call ordering. Production callers `void` the
 * Promise (it's best-effort).
 */
export async function handleSegmentCanceled(
  event: SegmentCanceledEvent,
  deps: HandleSegmentCanceledDeps,
): Promise<void> {
  // ONB-04 — practice never appears in History. The native cancel event
  // technically can't fire on a practice segment (practice short-circuits
  // out of finalize earlier), but defense-in-depth: a future change that
  // re-routes practice through FinalizeWorker MUST NOT leak a History row.
  if (deps.isPractice || deps.taskId === '__practice__') return;

  // 1. Write the History ledger entry FIRST (per write-then-delete).
  //    Best-effort: a MMKV failure leaves no History row but the files
  //    still get deleted to reclaim disk.
  const cancel: ThumbnailLedgerEntry['cancel'] = { reason: event.reason };
  if (event.meanFps != null) cancel!.meanFps = event.meanFps;
  if (event.width != null) cancel!.width = event.width;
  if (event.height != null) cancel!.height = event.height;
  try {
    const entry: ThumbnailLedgerEntry = {
      recordingId: event.recordingId,
      thumbnailPath: null, // No thumbnail extractable from a canceled segment.
      filename: `${event.filenameBase}.mp4`,
      mp4LocalPath: null, // Files are about to be deleted.
      createdAtMs: (deps.now ?? Date.now)(),
      taskId: deps.taskId,
      durationMs: event.durationMs,
      cancel,
    };
    deps.writeLedgerEntry(entry);
  } catch {
    // Best-effort — see note above.
  }

  // 2. Delete the three bundle files AFTER the ledger write resolves.
  //    Best-effort per-file; a missing file is fine (already cleaned by a
  //    prior partial-cancel attempt, etc.).
  await Promise.allSettled([
    deps.unlink(event.mp4Path).catch(() => undefined),
    deps.unlink(event.csvPath).catch(() => undefined),
    deps.unlink(event.jsonPath).catch(() => undefined),
  ]);

  // 3. DO NOT call HumynUpload.enqueue — that's the entire point of the
  //    cancel. The UploadQueueStore.enqueue belt-and-braces backstop
  //    catches a future regression that ever constructs a canceled
  //    UploadRow directly.
}
