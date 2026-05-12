// recordingEvents — the `_events`-envelope consumer (Plan 05-08; UP-14/15/16,
// VERIFY-05; 05-RESEARCH Pattern 3 + Pitfall 3).
//
// Every authenticated API response MAY carry a `_events` array (drained from
// the server's `recording_events_outbox` by the events-outbox onSend hook,
// Plan 05-05): `[{ recording_id, event_type: 'verified' | 're-upload' }]`.
// `services/api.ts` intercepts each parsed JSON body and calls
// `processRecordingEvents(body._events)` when present.
//
// For each event (idempotent on `${recording_id}:${event_type}` via the shared
// MMKV `UPLOAD_PROCESSED_EVENTS` set — D-STATE-01, no new instance):
//   - `verified`  → `HumynUpload.clearVerified([recording_id])` — unlinks the
//                   local mp4/csv/json + drops the queue row (UP-15). This +
//                   the reconciliation sweep are the ONLY paths that delete a
//                   recording's local files (UP-14 — never before a `verified`).
//   - `re-upload` → `HumynUpload.reupload(recording_id)` — flips the row's
//                   re-upload state so the coordinator re-mints via
//                   `POST /recordings/:id/reupload` and re-PUTs from the
//                   still-present local copy (UP-16).
//   - redelivered (key already in the set) → no-op.
//
// Defence-in-depth (T-5-08-01 / T-5-08-02): the payload shape is validated
// before any action — `recording_id` a 26-char ULID-ish string, `event_type`
// one of the two literals (mirrors `bootRecoveryListener.ts`'s "don't trust the
// payload shape blindly"). Per-event errors are swallowed (the next delivery /
// the reconciliation sweep is the convergent backstop). A build without the
// `HumynUpload` native module (iOS / JSDOM) never crashes — the bridge throws
// the canonical "not registered" error, which is caught.

import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';
import { HumynUpload } from '../native/HumynUpload';

export type RecordingEventType = 'verified' | 're-upload';

export interface RecordingServerEvent {
  recording_id: string;
  event_type: RecordingEventType;
}

/** FIFO cap on the processed-events set — keeps the MMKV blob bounded (T-5-08-05). */
const PROCESSED_CAP = 500;

function isValidEvent(x: unknown): x is RecordingServerEvent {
  if (x == null || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  if (typeof e.recording_id !== 'string' || e.recording_id.length !== 26) return false;
  return e.event_type === 'verified' || e.event_type === 're-upload';
}

function readProcessed(): string[] {
  const raw = secureMmkv.getString(KEYS.UPLOAD_PROCESSED_EVENTS);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    /* corrupt blob → treat as empty (we'll just re-process; the actions are convergent) */
  }
  return [];
}

function writeProcessed(set: string[]): void {
  // FIFO trim before persisting so the array physically shrinks to the cap.
  const trimmed = set.length > PROCESSED_CAP ? set.slice(set.length - PROCESSED_CAP) : set;
  secureMmkv.set(KEYS.UPLOAD_PROCESSED_EVENTS, JSON.stringify(trimmed));
}

/** Build the de-dup key for an event. Exported so the reconciliation sweep can pre-mark ids. */
export function processedEventKey(recordingId: string, eventType: RecordingEventType): string {
  return `${recordingId}:${eventType}`;
}

/** Mark a `${recording_id}:${event_type}` key processed without acting on it. Used by the sweep. */
export function markEventProcessed(recordingId: string, eventType: RecordingEventType): void {
  const key = processedEventKey(recordingId, eventType);
  const set = readProcessed();
  if (set.includes(key)) return;
  set.push(key);
  writeProcessed(set);
}

/**
 * Consume a `_events` envelope. Safe to call with anything — non-arrays / bad
 * shapes are ignored. Returns the number of events actually acted on (0 for a
 * fully-redelivered batch / a malformed payload) — handy for tests.
 */
export function processRecordingEvents(events: unknown): number {
  if (!Array.isArray(events) || events.length === 0) return 0;
  let acted = 0;
  for (const raw of events) {
    if (!isValidEvent(raw)) continue;
    const { recording_id, event_type } = raw;
    const key = processedEventKey(recording_id, event_type);
    const set = readProcessed();
    if (set.includes(key)) continue; // redelivered — no-op (idempotent)
    try {
      if (event_type === 'verified') {
        // UP-15 — unlink the local triple + drop the row.
        void HumynUpload.clearVerified([recording_id]).catch(() => undefined);
      } else {
        // UP-16 — re-upload from the still-present local copy.
        void HumynUpload.reupload(recording_id).catch(() => undefined);
      }
      set.push(key);
      writeProcessed(set);
      acted += 1;
    } catch {
      // No native module / a transient bridge failure — leave the key UNMARKED
      // so the next delivery (or the reconciliation sweep) retries. Swallow.
    }
  }
  return acted;
}

export default processRecordingEvents;
