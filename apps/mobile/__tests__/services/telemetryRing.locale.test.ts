// telemetry ring — locale events (I18N-12 / D-30).
//
// D-30 specifies that locale telemetry rides on the EXISTING
// `telemetryRing.append()` API with no schema change. This plan extends
// the `EVENT_NAMES` allowlist in `apps/mobile/src/util/analytics.ts` so
// `logEvent('locale_chosen', ...)` / `logEvent('locale_changed', ...)`
// no longer get dropped with a `[analytics] not in EVENT_NAMES allowlist`
// dev warning when the call sites (plan 07-04 ChooseLanguageScreen
// Continue + LanguageSheet row tap) land in Wave 2.
//
// `telemetryRing.ts` itself is NOT modified (D-30). The acceptance
// criteria asserts `git diff --stat apps/mobile/src/services/telemetryRing.ts`
// is empty for this plan.
//
// Test location follows the project convention `apps/mobile/__tests__/...`.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EVENT_NAMES, logEvent } from '../../src/util/analytics';

// Mirror the existing analytics.test.ts pattern (mock telemetryRing.append
// so we can observe the call without depending on the MMKV write path).
const ringAppend = vi.fn();
vi.mock('../../src/services/telemetryRing', () => ({
  telemetryRing: {
    append: (...args: unknown[]) => ringAppend(...args),
    snapshot: () => [],
    clear: () => undefined,
  },
}));

describe('telemetry ring — locale events (I18N-12 / D-30)', () => {
  beforeEach(() => {
    ringAppend.mockReset();
  });

  it('locale_chosen + locale_changed are in EVENT_NAMES allowlist', () => {
    expect(EVENT_NAMES).toContain('locale_chosen');
    expect(EVENT_NAMES).toContain('locale_changed');
  });

  it('logEvent accepts locale_chosen with installation_id + chosen_locale', () => {
    expect(() =>
      logEvent('locale_chosen' as never, {
        installation_id: 'install-xyz',
        chosen_locale: 'hi-IN',
      }),
    ).not.toThrow();
    expect(ringAppend).toHaveBeenCalledTimes(1);
    const call = ringAppend.mock.calls[0]?.[0] as { name: string; props: Record<string, unknown> };
    expect(call.name).toBe('locale_chosen');
    expect(call.props).toEqual({ installation_id: 'install-xyz', chosen_locale: 'hi-IN' });
  });

  it('logEvent accepts locale_changed with from_locale + to_locale', () => {
    expect(() =>
      logEvent('locale_changed' as never, {
        installation_id: 'install-xyz',
        from_locale: 'en',
        to_locale: 'pt-BR',
      }),
    ).not.toThrow();
    expect(ringAppend).toHaveBeenCalledTimes(1);
    const call = ringAppend.mock.calls[0]?.[0] as { name: string; props: Record<string, unknown> };
    expect(call.name).toBe('locale_changed');
    expect(call.props).toEqual({
      installation_id: 'install-xyz',
      from_locale: 'en',
      to_locale: 'pt-BR',
    });
  });
});
