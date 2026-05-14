// Plan 06-04 Task 3 — `thumbnailLedger.ts` per-key MMKV CRUD coverage.
//
// HIST-06 underlying infrastructure: every non-practice recording produces
// a thumbnail JPEG indexed under MMKV key `pendingThumb.{recordingId}.v1`.
// The ledger overlays filename + thumbnailPath onto the server's truth-source
// `GET /recordings` (CONTEXT D-04). Per CONTEXT D-04 the thumbnail survives
// the post-`verified` MP4 delete — `clearLocalPath` empties `mp4LocalPath`
// but preserves `thumbnailPath`.
//
// Key naming: `pendingThumb.{recordingId}.v1` — NOT scoped by user `sub`
// (RESEARCH Pitfall 8). recordingId is a server-issued ULID; scoping by
// sub would leak the ledger on logout/login. The truth-source row
// (`GET /recordings`) is already per-user-authed at the server.
//
// vitest.setup.ts already mocks react-native-mmkv with an in-memory store
// keyed by id; both `createMMKV` and the `MMKV` class hit the same shared
// store so we can drive the singleton directly here.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readEntry,
  writeEntry,
  clearLocalPath,
  deleteEntry,
  cleanupOpportunistic,
  type ThumbnailLedgerEntry,
} from '../../src/services/thumbnailLedger';
import { pendingThumbKey } from '../../src/state/keys';
import { secureMmkv } from '../../src/state/mmkv';

describe('pendingThumbKey', () => {
  it('returns the canonical per-recording key (pendingThumb.{id}.v1)', () => {
    expect(pendingThumbKey('01H8XGJWBWBAQ4TBKAYV5VW9XK')).toBe(
      'pendingThumb.01H8XGJWBWBAQ4TBKAYV5VW9XK.v1',
    );
  });

  it('does NOT scope by user sub (Pitfall 8 — recordingId is the natural index)', () => {
    // A second call with the same recordingId must yield the identical key
    // regardless of any user context — the row truth-source is per-user-authed
    // at the server.
    expect(pendingThumbKey('01HABC')).toBe(pendingThumbKey('01HABC'));
    expect(pendingThumbKey('01HXYZ')).not.toBe(pendingThumbKey('01HABC'));
  });
});

describe('thumbnailLedger CRUD', () => {
  beforeEach(() => {
    // The mock's in-memory store is keyed by MMKV `id` — `humyn.secure`.
    // `clearAll()` wipes all keys for this id (across the per-test isolation).
    secureMmkv.clearAll();
  });

  it('Test 1: writeEntry / readEntry roundtrip preserves all fields', () => {
    const entry: ThumbnailLedgerEntry = {
      recordingId: '01H8XGJWBWBAQ4TBKAYV5VW9XK',
      thumbnailPath: '/data/data/com.humyn/files/thumbs/20260514_100530_001.thumb.jpg',
      filename: '20260514_100530_001.mp4',
      mp4LocalPath: '/data/data/com.humyn/files/recordings/20260514_100530_001.mp4',
      createdAtMs: 1747214730000,
    };
    writeEntry(entry);
    const round = readEntry(entry.recordingId);
    expect(round).toEqual(entry);
  });

  it('Test 2: readEntry returns null for unknown recordingId', () => {
    expect(readEntry('01HNOTHERE_DOES_NOT_EXIST_ID')).toBeNull();
  });

  it('Test 3: clearLocalPath empties mp4LocalPath but preserves thumbnailPath (D-04)', () => {
    const entry: ThumbnailLedgerEntry = {
      recordingId: '01HCLEAR_LOCAL_PATH_TEST_ID',
      thumbnailPath: '/data/data/com.humyn/files/thumbs/sample.thumb.jpg',
      filename: 'sample.mp4',
      mp4LocalPath: '/data/data/com.humyn/files/recordings/sample.mp4',
      createdAtMs: 1747214730000,
    };
    writeEntry(entry);
    clearLocalPath(entry.recordingId);
    const after = readEntry(entry.recordingId);
    expect(after).not.toBeNull();
    expect(after!.mp4LocalPath).toBe('');
    // The thumbnail survives the post-verified MP4 delete (D-04 invariant).
    expect(after!.thumbnailPath).toBe('/data/data/com.humyn/files/thumbs/sample.thumb.jpg');
    expect(after!.filename).toBe('sample.mp4');
    expect(after!.recordingId).toBe(entry.recordingId);
    expect(after!.createdAtMs).toBe(1747214730000);
  });

  it('Test 4: clearLocalPath on unknown id is a no-op (no throw)', () => {
    // The clear path runs from the `_events` outbox-drain hook on the
    // `verified` event — if the ledger entry has already been GC'd by
    // cleanupOpportunistic or never written (a re-installed device that
    // replays an envelope), it must not throw.
    expect(() => clearLocalPath('01HUNKNOWN_RECORDING_ID_HERE')).not.toThrow();
    expect(readEntry('01HUNKNOWN_RECORDING_ID_HERE')).toBeNull();
  });

  it('Test 5: deleteEntry removes the row (subsequent readEntry returns null)', () => {
    const entry: ThumbnailLedgerEntry = {
      recordingId: '01HDELETE_ENTRY_TEST_RECID',
      thumbnailPath: '/path/thumb.jpg',
      filename: 'foo.mp4',
      mp4LocalPath: '/path/foo.mp4',
      createdAtMs: 1,
    };
    writeEntry(entry);
    expect(readEntry(entry.recordingId)).not.toBeNull();
    deleteEntry(entry.recordingId);
    expect(readEntry(entry.recordingId)).toBeNull();
  });

  it('Test 6: writeEntry handles thumbnailPath: null (D-05 extractor-failed fallback)', () => {
    // When the native extractor returns null (best-effort throw + null path),
    // the JS side still writes the ledger entry so the History row can render
    // the gradient + first-letter overlay. The ledger entry's
    // `thumbnailPath: null` IS the signal to use the fallback.
    const entry: ThumbnailLedgerEntry = {
      recordingId: '01HNULL_THUMB_TEST_RECID01',
      thumbnailPath: null,
      filename: 'no-thumb.mp4',
      mp4LocalPath: '/path/no-thumb.mp4',
      createdAtMs: 42,
    };
    writeEntry(entry);
    const round = readEntry(entry.recordingId);
    expect(round).not.toBeNull();
    expect(round!.thumbnailPath).toBeNull();
    expect(round!.filename).toBe('no-thumb.mp4');
  });

  it('Test 7: readEntry returns null on JSON-parse failure (corrupted MMKV value)', () => {
    // A reinstall or schema-bump from a third party (paranoid defense) could
    // leave a non-JSON string under the key — readEntry must swallow and
    // return null, never crash the History render.
    secureMmkv.set(pendingThumbKey('01HCORRUPT_TEST_RECORDING'), '{ this is not json');
    expect(readEntry('01HCORRUPT_TEST_RECORDING')).toBeNull();
  });
});

describe('cleanupOpportunistic (D-04a — best-effort cold-start GC)', () => {
  beforeEach(() => {
    secureMmkv.clearAll();
  });

  it('Test 8: deletes ledger entries whose id is NOT in the server set', () => {
    const keep: ThumbnailLedgerEntry = {
      recordingId: '01HKEEPABCDEFGHIJKLMNOPQRS',
      thumbnailPath: '/p/k.thumb.jpg',
      filename: 'k.mp4',
      mp4LocalPath: '/p/k.mp4',
      createdAtMs: 1,
    };
    const drop: ThumbnailLedgerEntry = {
      recordingId: '01HDROP1234567890ABCDEFGHJ',
      thumbnailPath: '/p/d.thumb.jpg',
      filename: 'd.mp4',
      mp4LocalPath: '/p/d.mp4',
      createdAtMs: 2,
    };
    writeEntry(keep);
    writeEntry(drop);
    cleanupOpportunistic(new Set([keep.recordingId]));
    expect(readEntry(keep.recordingId)).not.toBeNull();
    expect(readEntry(drop.recordingId)).toBeNull();
  });

  it('Test 9: leaves non-pendingThumb keys untouched (AUTH_JWT etc.)', () => {
    // The reconcile sweep iterates ALL MMKV keys; the `startsWith('pendingThumb.')`
    // prefix filter must not touch sibling keys (auth.jwt.v1 etc.).
    secureMmkv.set('auth.jwt.v1', 'token-stays');
    secureMmkv.set('onboarding.consent.v1', 'consent-stays');
    cleanupOpportunistic(new Set<string>());
    expect(secureMmkv.getString('auth.jwt.v1')).toBe('token-stays');
    expect(secureMmkv.getString('onboarding.consent.v1')).toBe('consent-stays');
  });
});
