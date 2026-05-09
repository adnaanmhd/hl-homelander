// Plan 02-05 — humyn:// deep-link config covers Phase 2 routes per
// engineering-handoff.md §3.4.

import { describe, it, expect } from 'vitest';
import { linking } from '../../src/navigation/linking';

describe('linking', () => {
  it('declares humyn:// as a prefix', () => {
    expect(linking.prefixes).toContain('humyn://');
  });

  it('maps /signup → OnboardingStack.Signup', () => {
    const ob = (linking.config!.screens as Record<string, unknown>).OnboardingStack as {
      screens: Record<string, string>;
    };
    expect(ob.screens.Signup).toBe('signup');
  });

  it('maps /home → MainTabs.Home', () => {
    const tabs = (linking.config!.screens as Record<string, unknown>).MainTabs as {
      screens: Record<string, string>;
    };
    expect(tabs.screens.Home).toBe('home');
  });

  it('declares Profile and HelpCenter at Root level', () => {
    const screens = linking.config!.screens as Record<string, unknown>;
    expect(screens.Profile).toBe('profile');
    expect(screens.HelpCenter).toBe('help');
  });

  it('maps /tasks and /history to MainTabs siblings', () => {
    const tabs = (linking.config!.screens as Record<string, unknown>).MainTabs as {
      screens: Record<string, string>;
    };
    expect(tabs.screens.Tasks).toBe('tasks');
    expect(tabs.screens.History).toBe('history');
  });
});
