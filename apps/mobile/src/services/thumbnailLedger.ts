// thumbnailLedger — per-recording MMKV overlay for History row metadata
// (HIST-06; Phase 6 CONTEXT D-04 + D-05; Plan 06-04 Task 3).
//
// The server's `GET /recordings` is the truth-source for the History row list
// (CONTEXT D-04 — re-install survives, the rows re-fetch from the server). This
// MMKV ledger overlays filename + thumbnailPath + the device-local MP4 path,
// keyed by `recording_id`. On re-install the ledger is empty and the row
// renders the gradient + first-letter task-name fallback (D-04); when present
// the row shows the real first-frame thumbnail (D-05) and the player tap path
// resolves to the local MP4 (vs. the presigned stream URL — Plan 06-06).
//
// Lifecycle:
//   1. `FinalizeWorker` (Kotlin, Plan 06-04 Task 2) computes the thumbnail and
//      emits `onSegmentComplete` with `thumbnailPath: string | null`.
//   2. The JS-side segment-complete handler in RecordingScreen (Plan 06-09) calls
//      `writeEntry({ recordingId, thumbnailPath, filename, mp4LocalPath, ... })`
//      next to the existing `HumynUpload.enqueue(...)` call. The ledger write
//      and the upload enqueue are siblings — not a transaction; a crash between
//      the two leaves an enqueued-but-unledgered row (which still renders via
//      the D-04 fallback).
//   3. The `_events`-envelope outbox-drain hook in `recordingEvents.ts` calls
//      `clearLocalPath(recordingId)` on `verified` — empties `mp4LocalPath` but
//      PRESERVES `thumbnailPath` (D-04).
//   4. `cleanupOpportunistic` runs on cold start (D-04a) — best-effort GC of
//      ledger entries whose `recording_id` is no longer in the server's recent
//      `/recordings?range=all` set (server-side takedown / rejected / deleted-
//      account). NOT load-bearing — the row truth-source is still the server.
//
// MMKV API note: `react-native-mmkv@4.x` Nitro-module spec exposes `remove(key)`
// (not `.delete(key)`); the project-wide singleton in `state/mmkv.ts` uses
// `createMMKV(...)` whose returned instance carries `remove`. Every existing
// service / store uses `.remove(...)` (see `services/uploadReconcile.ts`,
// `state/appStore.ts`, `__tests__/state/hydrate.test.ts`). The vitest mock in
// `vitest.setup.ts` exports both `delete` and `remove` as aliases for
// portability; we use `remove` to match the production singleton's true API.
//
// Pitfall 8 (RESEARCH): the key namespace is `pendingThumb.{recordingId}.v1`
// — NOT scoped by user sub. recordingId is a server-issued ULID; the truth-
// source row is per-user-authed at the server. See `state/keys.ts` for the
// helper.

import { secureMmkv } from '../state/mmkv';
import { pendingThumbKey } from '../state/keys';

/**
 * A single ledger row — overlay metadata for one finalized non-practice
 * recording. Mirrors the server's `GET /recordings/:id` row shape only on the
 * fields the History row + Player path consume locally (filename + thumb path
 * + the local MP4 path). All other fields (qa_status, duration_ms, task_id,
 * created_at) come from the server payload.
 */
export interface ThumbnailLedgerEntry {
  /** The server-issued ULID — the natural key. */
  recordingId: string;
  /**
   * `filesDir/thumbs/<base>.thumb.jpg` — the first-frame JPEG path. Null
   * when the native extractor returned null (best-effort failure — the
   * History row renders the gradient + first-letter fallback per D-04).
   */
  thumbnailPath: string | null;
  /**
   * The on-disk filename for the row's `<base>.mp4`. The History row shows
   * this verbatim; absent → falls back to a derived `<YYYYMMDD_HHMMSS_NNN>.mp4`
   * from the server-side `created_at` ULID.
   */
  filename: string;
  /**
   * `filesDir/recordings/<base>.mp4` — the local copy used by the in-app
   * Player when present. Empty string after the post-`verified` MP4 unlink
   * (D-04 invariant: thumbnail survives, local MP4 does not).
   */
  mp4LocalPath: string;
  /** Wall-clock at ledger write (Date.now()). Useful for cold-start TTL. */
  createdAtMs: number;
}

/**
 * Read the entry for `recordingId`, or null if absent or unparseable.
 *
 * Defensively swallows JSON-parse failures (a third-party reinstall /
 * schema bump could leave a non-JSON value under the key; HEad render must
 * never crash on a corrupt MMKV value — it just falls back to the D-04 row).
 */
export function readEntry(recordingId: string): ThumbnailLedgerEntry | null {
  const raw = secureMmkv.getString(pendingThumbKey(recordingId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ThumbnailLedgerEntry;
  } catch {
    return null;
  }
}

/**
 * Write or overwrite the entry. Called by the JS-side segment-complete
 * handler (Plan 06-09 wires the call site in RecordingScreen.tsx); the
 * Kotlin-side `FinalizeWorker` does NOT write MMKV directly — the encrypted
 * MMKV's key derivation lives JS-side (state/mmkv.ts), so a single
 * derivation source keeps the encryption invariant intact.
 */
export function writeEntry(entry: ThumbnailLedgerEntry): void {
  secureMmkv.set(pendingThumbKey(entry.recordingId), JSON.stringify(entry));
}

/**
 * D-04 — clear `mp4LocalPath` while preserving `thumbnailPath`. Called
 * from the `_events`-envelope `verified` consumer hook (the existing Phase 5
 * recordingEvents outbox drain in `services/recordingEvents.ts` is extended
 * by Plan 06-08 to invoke this — the History row keeps its thumbnail but
 * the Player path now resolves to the presigned-stream URL).
 *
 * No-op on unknown id (a re-installed device may replay a `verified`
 * envelope whose ledger entry was never written / has been GC'd).
 */
export function clearLocalPath(recordingId: string): void {
  const e = readEntry(recordingId);
  if (!e) return;
  writeEntry({ ...e, mp4LocalPath: '' });
}

/**
 * Remove the ledger entry. NOT called on `verified` (use `clearLocalPath`);
 * called by `cleanupOpportunistic` and by any future hard-delete path
 * (account deletion, takedown).
 */
export function deleteEntry(recordingId: string): void {
  secureMmkv.remove(pendingThumbKey(recordingId));
}

/**
 * D-04a — opportunistic best-effort GC on cold start. Compare ledger keys
 * to the latest `/recordings?range=all` id set; remove any ledger entry not
 * in the server's recent list (server-side takedown / rejected / deleted-
 * account).
 *
 * NOT load-bearing — Phase 5's `uploadReconcile.ts` owns the per-`verified`
 * sweep. If this never runs the worst case is a few stale ledger entries
 * holding orphan thumbnail JPEGs in `filesDir/thumbs/` — disk leak, not a
 * correctness issue.
 *
 * The filter `^pendingThumb\.([0-9A-Z]{26})\.v1$` matches the canonical
 * Crockford-base32 ULID shape that Phase 3 `UlidGenerator` mints; an entry
 * with a malformed key (a future schema bump uses a different shape) is
 * left alone so the migration path stays open.
 */
export function cleanupOpportunistic(serverRecordingIds: Set<string>): void {
  const allKeys = secureMmkv.getAllKeys();
  for (const k of allKeys) {
    if (!k.startsWith('pendingThumb.')) continue;
    const idMatch = /^pendingThumb\.([0-9A-Z]{26})\.v1$/.exec(k);
    if (!idMatch) continue;
    const id = idMatch[1]!;
    if (!serverRecordingIds.has(id)) {
      secureMmkv.remove(k);
    }
  }
}
