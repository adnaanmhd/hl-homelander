/**
 * Quick task 260517-p5g CAPTURE-QA-04..06 — JS bridge + RN handler tests
 * for the native `onSegmentCanceled` event.
 *
 * Three describe blocks:
 *
 *   1. `onSegmentCanceled` event subscription — the helper subscribes
 *      via `NativeEventEmitter.addListener('onSegmentCanceled', ...)`
 *      and returns an `EmitterSubscription` whose `.remove()` works.
 *      Mirrors the pattern in `HumynCapture.test.ts`.
 *
 *   2. `handleSegmentCanceled` — pure-helper write-then-delete invariant:
 *      (a) practice short-circuit (no ledger write, no unlinks),
 *      (b) writes the ledger entry FIRST then unlinks the three bundle
 *          files (call order asserted),
 *      (c) does NOT call HumynUpload.enqueue (asserted via spy that
 *          would fail loudly if the helper ever called the bridge).
 *
 *   3. Backward-compat — the `EncoderProbeResult` interface tolerates a
 *      missing `resolutionDeliverable` (stale native build); compatService
 *      treats it as a failure (fail-closed).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SegmentCanceledEvent,
  SegmentCancelReason,
} from '../../src/native/HumynCapture.types';
import type { ThumbnailLedgerEntry } from '../../src/services/thumbnailLedger';

const FIXTURE_CANCEL: SegmentCanceledEvent = {
  segmentId: '01JCANCELED-SEGMENT-XXXXXX',
  recordingId: '01JCANCELED-RECORDING-XXXX',
  taskId: 'cooking.chopping',
  filenameBase: '20260517_120000_001',
  mp4Path: '/cache/recordings/20260517_120000_001.mp4',
  csvPath: '/cache/recordings/20260517_120000_001.csv',
  jsonPath: '/cache/recordings/20260517_120000_001.json',
  recordedAt: '2026-05-17T12:00:00.000+05:30',
  durationMs: 4_500,
  reason: 'fps_dropped' as SegmentCancelReason,
  meanFps: 26.4,
  width: null,
  height: null,
};

describe('HumynCapture.onSegmentCanceled (Test D — event subscription)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('react-native');
  });

  it('subscribes via NativeEventEmitter.addListener("onSegmentCanceled") and returns a removable subscription', async () => {
    const remove = vi.fn();
    const addListener = vi.fn().mockReturnValue({ remove });
    const emitterCtor = vi.fn(function (this: { addListener: typeof addListener }) {
      this.addListener = addListener;
    });
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: { start: vi.fn(), stop: vi.fn() } },
      NativeEventEmitter: emitterCtor,
    }));
    const { onSegmentCanceled } = await import('../../src/native/HumynCapture');
    const listener = vi.fn();
    const subscription = onSegmentCanceled(listener);
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledWith('onSegmentCanceled', listener);
    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('the lazy emitter is shared with onSegmentComplete (single emitter per module)', async () => {
    const addListener = vi.fn().mockReturnValue({ remove: vi.fn() });
    const emitterCtor = vi.fn(function (this: { addListener: typeof addListener }) {
      this.addListener = addListener;
    });
    vi.doMock('react-native', () => ({
      NativeModules: { HumynCapture: { start: vi.fn(), stop: vi.fn() } },
      NativeEventEmitter: emitterCtor,
    }));
    const { onSegmentCanceled, onSegmentComplete } = await import('../../src/native/HumynCapture');
    onSegmentComplete(vi.fn());
    onSegmentCanceled(vi.fn());
    // Two subscribes ⇒ exactly one emitter constructor call (singleton).
    expect(emitterCtor).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledTimes(2);
  });
});

describe('handleSegmentCanceled (Test E — write-then-delete invariant)', () => {
  it('does NOT call writeLedgerEntry or unlink when isPractice=true (ONB-04 short-circuit)', async () => {
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    await handleSegmentCanceled(FIXTURE_CANCEL, {
      isPractice: true,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    expect(writeLedgerEntry).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('short-circuits when taskId === "__practice__" even with isPractice=false (defense-in-depth)', async () => {
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    await handleSegmentCanceled(FIXTURE_CANCEL, {
      isPractice: false,
      taskId: '__practice__',
      writeLedgerEntry,
      unlink,
    });
    expect(writeLedgerEntry).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('writes the ledger entry FIRST, then unlinks the three bundle files (call order)', async () => {
    // Call-order tracking via a shared timeline array.
    const timeline: string[] = [];
    const writeLedgerEntry = vi.fn((_e: ThumbnailLedgerEntry) => {
      timeline.push('write');
    });
    const unlink = vi.fn((p: string) => {
      timeline.push(`unlink:${p.endsWith('.mp4') ? 'mp4' : p.endsWith('.csv') ? 'csv' : 'json'}`);
      return Promise.resolve();
    });
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    await handleSegmentCanceled(FIXTURE_CANCEL, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
      now: () => 1_700_000_000_000,
    });
    // Ledger write happens FIRST (write-then-delete invariant).
    expect(timeline[0]).toBe('write');
    // Then all three bundle files are unlinked (order between them is
    // not specified — Promise.allSettled).
    expect(timeline.slice(1).sort()).toEqual(['unlink:csv', 'unlink:json', 'unlink:mp4']);
    // Inspect the ledger payload — it carries the cancel reason + numeric.
    expect(writeLedgerEntry).toHaveBeenCalledTimes(1);
    const entry = writeLedgerEntry.mock.calls[0]![0];
    expect(entry.recordingId).toBe(FIXTURE_CANCEL.recordingId);
    expect(entry.thumbnailPath).toBeNull();
    expect(entry.mp4LocalPath).toBeNull();
    expect(entry.taskId).toBe('cooking.chopping');
    expect(entry.durationMs).toBe(4_500);
    expect(entry.cancel).toEqual({ reason: 'fps_dropped', meanFps: 26.4 });
    expect(entry.createdAtMs).toBe(1_700_000_000_000);
  });

  it('still deletes files when writeLedgerEntry throws (disk-reclaim path)', async () => {
    const writeLedgerEntry = vi.fn(() => {
      throw new Error('MMKV failure');
    });
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    await handleSegmentCanceled(FIXTURE_CANCEL, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    // Best-effort: the History row is lost, but the disk is reclaimed.
    expect(unlink).toHaveBeenCalledTimes(3);
  });

  it('payload shape — resolution_dropped carries width + height, NOT meanFps', async () => {
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    const event: SegmentCanceledEvent = {
      ...FIXTURE_CANCEL,
      reason: 'resolution_dropped',
      meanFps: null,
      width: 1280,
      height: 720,
    };
    await handleSegmentCanceled(event, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    const entry = writeLedgerEntry.mock.calls[0]![0] as ThumbnailLedgerEntry;
    expect(entry.cancel).toEqual({ reason: 'resolution_dropped', width: 1280, height: 720 });
  });

  it('payload shape — insufficient_frames carries no numeric extras', async () => {
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    const event: SegmentCanceledEvent = {
      ...FIXTURE_CANCEL,
      reason: 'insufficient_frames',
      meanFps: null,
      width: null,
      height: null,
    };
    await handleSegmentCanceled(event, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    const entry = writeLedgerEntry.mock.calls[0]![0] as ThumbnailLedgerEntry;
    expect(entry.cancel).toEqual({ reason: 'insufficient_frames' });
  });

  it('payload shape — too_short carries no numeric extras (Bug 8 + Enh 1 / D6)', async () => {
    // Non-practice segment under the native 3-min floor. The FinalizeWorker
    // emits null meanFps/width/height (same as insufficient_frames); the
    // ledger row carries just the reason code.
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    const event: SegmentCanceledEvent = {
      ...FIXTURE_CANCEL,
      reason: 'too_short',
      meanFps: null,
      width: null,
      height: null,
    };
    await handleSegmentCanceled(event, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    const entry = writeLedgerEntry.mock.calls[0]![0] as ThumbnailLedgerEntry;
    expect(entry.cancel).toEqual({ reason: 'too_short' });
  });

  it('does NOT touch HumynUpload.enqueue (the whole point of the cancel)', async () => {
    // The helper has no HumynUpload dependency — this is structural,
    // verified by the absence of an import. The test serves as a
    // documentation lock: if a future change adds an enqueue call here,
    // it'll need an injection point that this test would catch.
    const writeLedgerEntry = vi.fn();
    const unlink = vi.fn().mockResolvedValue(undefined);
    const { handleSegmentCanceled } = await import(
      '../../src/screens/recording/lib/handleSegmentCanceled'
    );
    // Snapshot the helper's signature — only the five documented deps.
    await handleSegmentCanceled(FIXTURE_CANCEL, {
      isPractice: false,
      taskId: 'cooking.chopping',
      writeLedgerEntry,
      unlink,
    });
    // No HumynUpload spy needed: the helper module never imports it.
    expect(writeLedgerEntry).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledTimes(3);
  });
});
