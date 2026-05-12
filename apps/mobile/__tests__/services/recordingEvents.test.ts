// recordingEvents — the `_events`-envelope consumer (Plan 05-08; UP-14/15/16).
//
// Coverage:
//   - a `verified` event → HumynUpload.clearVerified([id]) called + the
//     `${id}:verified` key marked processed in MMKV
//   - a redelivered `verified` (key already processed) → NO second clearVerified
//   - a `re-upload` event → HumynUpload.reupload(id) called
//   - a malformed event (bad shape / wrong type / short id) → skipped, no crash
//   - a `verified` event with no matching queue row → still calls clearVerified
//     (the native side no-ops on an unknown id) — no crash
//   - mixed batch: only the valid + not-yet-processed events are acted on
//
// Mocking: `../../src/state/mmkv` is the shared MMKV singleton — we use a tiny
// in-memory Map stand-in. `../../src/native/HumynUpload` is mocked so
// clearVerified/reupload are spies.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mmkvStore, hooks } = vi.hoisted(() => ({
  mmkvStore: new Map<string, string>(),
  hooks: {
    clearVerified: vi.fn().mockResolvedValue(undefined),
    reupload: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/state/mmkv', () => ({
  secureMmkv: {
    getString: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string) => {
      mmkvStore.set(k, v);
    },
    delete: (k: string) => {
      mmkvStore.delete(k);
    },
  },
}));

vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    clearVerified: hooks.clearVerified,
    reupload: hooks.reupload,
  },
}));

import { processRecordingEvents } from '../../src/services/recordingEvents';
import { KEYS } from '../../src/state/keys';

const ID_A = 'A1B2C3D4E5F6G7H8J9K0LMNPQR'; // 26 chars
const ID_B = 'Z9Y8X7W6V5U4T3S2R1Q0PONMLK'; // 26 chars

function processedSet(): string[] {
  const raw = mmkvStore.get(KEYS.UPLOAD_PROCESSED_EVENTS);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

describe('recordingEvents — processRecordingEvents (Plan 05-08)', () => {
  beforeEach(() => {
    mmkvStore.clear();
    hooks.clearVerified.mockReset();
    hooks.clearVerified.mockResolvedValue(undefined);
    hooks.reupload.mockReset();
    hooks.reupload.mockResolvedValue(undefined);
  });

  it('a `verified` event calls HumynUpload.clearVerified([id]) and marks it processed', () => {
    const acted = processRecordingEvents([{ recording_id: ID_A, event_type: 'verified' }]);
    expect(acted).toBe(1);
    expect(hooks.clearVerified).toHaveBeenCalledWith([ID_A]);
    expect(processedSet()).toContain(`${ID_A}:verified`);
  });

  it('a redelivered `verified` event is a no-op (idempotent on ${id}:verified)', () => {
    processRecordingEvents([{ recording_id: ID_A, event_type: 'verified' }]);
    hooks.clearVerified.mockReset();
    const acted = processRecordingEvents([{ recording_id: ID_A, event_type: 'verified' }]);
    expect(acted).toBe(0);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
  });

  it('a `re-upload` event calls HumynUpload.reupload(id)', () => {
    const acted = processRecordingEvents([{ recording_id: ID_B, event_type: 're-upload' }]);
    expect(acted).toBe(1);
    expect(hooks.reupload).toHaveBeenCalledWith(ID_B);
    expect(processedSet()).toContain(`${ID_B}:re-upload`);
  });

  it('a `verified` then a `re-upload` for the same id are distinct keys (both act)', () => {
    processRecordingEvents([
      { recording_id: ID_A, event_type: 'verified' },
      { recording_id: ID_A, event_type: 're-upload' },
    ]);
    expect(hooks.clearVerified).toHaveBeenCalledWith([ID_A]);
    expect(hooks.reupload).toHaveBeenCalledWith(ID_A);
    expect(processedSet()).toEqual(
      expect.arrayContaining([`${ID_A}:verified`, `${ID_A}:re-upload`]),
    );
  });

  it('malformed events are skipped (bad type / short id / non-object) — no crash', () => {
    const acted = processRecordingEvents([
      { recording_id: ID_A, event_type: 'bogus' },
      { recording_id: 'too-short', event_type: 'verified' },
      null,
      'not-an-object',
      { event_type: 'verified' }, // no recording_id
      42,
    ]);
    expect(acted).toBe(0);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
    expect(hooks.reupload).not.toHaveBeenCalled();
  });

  it('a `verified` event with no matching queue row still calls clearVerified (native no-ops)', () => {
    // recordingEvents doesn't consult the queue — it always forwards to
    // clearVerified, which is convergent (the native side no-ops an unknown id).
    expect(() =>
      processRecordingEvents([{ recording_id: ID_B, event_type: 'verified' }]),
    ).not.toThrow();
    expect(hooks.clearVerified).toHaveBeenCalledWith([ID_B]);
  });

  it('non-array / empty payloads are ignored', () => {
    expect(processRecordingEvents(undefined)).toBe(0);
    expect(processRecordingEvents(null)).toBe(0);
    expect(processRecordingEvents([])).toBe(0);
    expect(processRecordingEvents({ recording_id: ID_A, event_type: 'verified' })).toBe(0);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
  });

  it('a mixed batch acts only on the valid + not-yet-processed events', () => {
    // Pre-mark ID_A:verified as processed.
    mmkvStore.set(KEYS.UPLOAD_PROCESSED_EVENTS, JSON.stringify([`${ID_A}:verified`]));
    const acted = processRecordingEvents([
      { recording_id: ID_A, event_type: 'verified' }, // already processed → skip
      { recording_id: ID_B, event_type: 're-upload' }, // new → act
      { recording_id: 'bad', event_type: 'verified' }, // malformed → skip
    ]);
    expect(acted).toBe(1);
    expect(hooks.clearVerified).not.toHaveBeenCalled();
    expect(hooks.reupload).toHaveBeenCalledWith(ID_B);
  });
});
