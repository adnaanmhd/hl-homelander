// analytics util unit tests — engineering-handoff §11 + D-HELP-02 mirror.
//
// logEvent() must (a) gate on the EVENT_NAMES allowlist (engineering-handoff
// §11 — schema-creep guard at runtime), (b) mirror every accepted event into
// telemetryRing.append (HELP-05 diagnostic snapshot), and eventually (Phase
// 2.09) call Firebase Analytics. The Firebase call is stubbed in this plan;
// we verify the ring-mirror contract here.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const ringAppend = vi.fn();

vi.mock('../../src/services/telemetryRing', () => ({
  telemetryRing: {
    append: (...args: unknown[]) => ringAppend(...args),
    snapshot: () => [],
    clear: () => undefined,
  },
}));

describe('logEvent', () => {
  beforeEach(() => {
    ringAppend.mockReset();
  });

  it('Test 7: logEvent("signup_started", {foo:"bar"}) appends a TelemetryEvent to the ring', async () => {
    const before = Date.now();
    const { logEvent } = await import('../../src/util/analytics');
    logEvent('signup_started', { foo: 'bar' });
    const after = Date.now();

    expect(ringAppend).toHaveBeenCalledTimes(1);
    const call = ringAppend.mock.calls[0]?.[0] as {
      name: string;
      ts: number;
      props: Record<string, unknown>;
    };
    expect(call.name).toBe('signup_started');
    expect(call.props).toEqual({ foo: 'bar' });
    expect(call.ts).toBeGreaterThanOrEqual(before);
    expect(call.ts).toBeLessThanOrEqual(after);
  });

  it('Test 8: blocked event name (not in EVENT_NAMES) is silently dropped — ring NOT mutated', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { logEvent } = await import('../../src/util/analytics');

    // Cast through unknown to bypass the EventName literal-union compile-time
    // guard — we are intentionally exercising the runtime allowlist gate.
    (logEvent as unknown as (n: string, p?: Record<string, string | number | boolean>) => void)(
      'bogus_event',
      { foo: 'bar' },
    );

    expect(ringAppend).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
