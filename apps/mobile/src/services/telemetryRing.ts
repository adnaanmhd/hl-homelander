// FIFO 100-entry telemetry ring buffer. Backs the HELP-05 diagnostic snapshot
// (D-HELP-02): when a user submits a help-center "report a problem" entry the
// last 100 events are attached so support can replay the funnel.
//
// State lives in a single MMKV string at `telemetry.ring.v1` — JSON-encoded
// array. We accept the JSON.parse cost on every append in exchange for a
// dead-simple persistence model; at 100 entries × ~50 bytes the blob caps at
// ~5 KB (well below MMKV's per-entry sweet spot).
//
// Threat T-2.4-03 (DoS via unbounded growth) is mitigated by the
// `splice(0, arr.length - RING_CAP)` trim on every append — the array
// physically shrinks to the cap before being persisted.
//
// Threat T-2.4-01 (PII leak) is enforced by the `analytics.logEvent`
// call-site allowlist (EVENT_NAMES + props discipline) — see
// `../util/analytics.ts`. This module is the dumb storage layer; it does
// not validate event content.

import { secureMmkv } from '../state/mmkv';
import { KEYS } from '../state/keys';

export interface TelemetryEvent {
  name: string;
  ts: number; // epoch ms
  props: Record<string, string | number | boolean>;
}

const RING_CAP = 100;

function read(): TelemetryEvent[] {
  const raw = secureMmkv.getString(KEYS.TELEMETRY_RING);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TelemetryEvent[];
  } catch {
    /* fallthrough — corrupted blob → treat as empty */
  }
  return [];
}

function write(arr: TelemetryEvent[]): void {
  secureMmkv.set(KEYS.TELEMETRY_RING, JSON.stringify(arr));
}

export const telemetryRing = {
  /** Append an event; FIFO-trim the array to the last RING_CAP entries. */
  append(event: TelemetryEvent): void {
    const arr = read();
    arr.push(event);
    if (arr.length > RING_CAP) arr.splice(0, arr.length - RING_CAP);
    write(arr);
  },
  /** Return a copy of the current buffer (insertion order, oldest first). */
  snapshot(): TelemetryEvent[] {
    return read();
  },
  /** Drop the buffer. Used by the HELP-05 diag-snapshot send-and-clear flow. */
  clear(): void {
    secureMmkv.remove(KEYS.TELEMETRY_RING);
  },
};
