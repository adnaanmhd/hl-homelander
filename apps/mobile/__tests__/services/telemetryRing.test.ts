// telemetryRing service unit tests — D-HELP-02 (diagnostic-snapshot ring).
//
// Pattern: rely on the canonical react-native-mmkv mock from vitest.setup.ts.
// Buffer state lives in a single MMKV string at `telemetry.ring.v1`. Each
// test resets the key in beforeEach.
//
// Threat T-2.4-03 (DoS via unbounded buffer growth) is mitigated by the
// FIFO `splice(0, arr.length - 100)` in append(); Test 5 pins that bound.
import { describe, it, expect, beforeEach } from 'vitest';

import { secureMmkv } from '../../src/state/mmkv';
import { KEYS } from '../../src/state/keys';
import { telemetryRing, type TelemetryEvent } from '../../src/services/telemetryRing';

function freshRing() {
  secureMmkv.remove(KEYS.TELEMETRY_RING);
}

function makeEvent(
  name: string,
  ts: number,
  props: Record<string, string | number | boolean> = {},
): TelemetryEvent {
  return { name, ts, props };
}

describe('telemetryRing', () => {
  beforeEach(freshRing);

  it('Test 3: empty buffer → snapshot() returns []', () => {
    expect(telemetryRing.snapshot()).toEqual([]);
  });

  it('Test 4: append 5 events → snapshot returns those 5 in insertion order', () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`event_${i}`, 1000 + i, { i }));
    for (const e of events) telemetryRing.append(e);

    const snap = telemetryRing.snapshot();
    expect(snap).toHaveLength(5);
    expect(snap.map((e) => e.name)).toEqual([
      'event_0',
      'event_1',
      'event_2',
      'event_3',
      'event_4',
    ]);
  });

  it('Test 5: append 105 events → snapshot returns the LAST 100 (FIFO trim)', () => {
    for (let i = 0; i < 105; i += 1) {
      telemetryRing.append(makeEvent(`event_${i}`, 2000 + i));
    }

    const snap = telemetryRing.snapshot();
    expect(snap).toHaveLength(100);
    // Oldest 5 (indices 0-4) should have been dropped; the survivors are 5..104.
    expect(snap[0]?.name).toBe('event_5');
    expect(snap[snap.length - 1]?.name).toBe('event_104');
  });

  it('Test 6: clear() empties the buffer', () => {
    telemetryRing.append(makeEvent('event_a', 3000));
    telemetryRing.append(makeEvent('event_b', 3001));
    expect(telemetryRing.snapshot()).toHaveLength(2);

    telemetryRing.clear();

    expect(telemetryRing.snapshot()).toEqual([]);
    expect(secureMmkv.getString(KEYS.TELEMETRY_RING)).toBeUndefined();
  });
});
