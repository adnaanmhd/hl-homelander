// 07-11 G-06 closure — MainTabs renders translated tab labels.
//
// MainTabs uses a custom `BottomNav` tabBar that owns the per-tab label
// rendering (via `useTranslation()` + the `tabs.{home,tasks,history}`
// catalog keys). We assert two contracts here:
//
//   Test 1: source-grep — MainTabs.tsx declares `tabBarLabel: t('tabs.home')`
//           (and ditto for tasks/history) as belt-and-suspenders for any
//           future tabBar swap (the plan's `<interfaces>` contract).
//   Test 2: source-grep — BottomNav.tsx maps every TABS row's `labelKey` to
//           a `tabs.*` namespace key (no hardcoded English `label` field
//           survives) and renders via `t(tab.labelKey)`.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import enCatalog from '../../src/i18n/locales/en.json';

const MAIN_TABS_SRC = readFileSync(
  resolve(import.meta.dirname, '../../src/navigation/MainTabs.tsx'),
  'utf8',
);
const BOTTOM_NAV_SRC = readFileSync(
  resolve(import.meta.dirname, '../../src/components/BottomNav.tsx'),
  'utf8',
);

describe('MainTabs / BottomNav i18n — 07-11 G-06', () => {
  it("MainTabs declares tabBarLabel: t('tabs.home') / .tasks / .history per Tab.Screen", () => {
    expect(MAIN_TABS_SRC).toContain("tabBarLabel: t('tabs.home')");
    expect(MAIN_TABS_SRC).toContain("tabBarLabel: t('tabs.tasks')");
    expect(MAIN_TABS_SRC).toContain("tabBarLabel: t('tabs.history')");
    // The route `name` props stay English for route-stability.
    expect(MAIN_TABS_SRC).toContain('name="Home"');
    expect(MAIN_TABS_SRC).toContain('name="Tasks"');
    expect(MAIN_TABS_SRC).toContain('name="History"');
  });

  it('BottomNav renders translated tab labels via t(tab.labelKey)', () => {
    expect(BOTTOM_NAV_SRC).toContain('useTranslation');
    expect(BOTTOM_NAV_SRC).toContain('{t(tab.labelKey)}');
    // The TABS array uses labelKey, not the historical hardcoded label string.
    expect(BOTTOM_NAV_SRC).toContain("labelKey: 'tabs.home'");
    expect(BOTTOM_NAV_SRC).toContain("labelKey: 'tabs.tasks'");
    expect(BOTTOM_NAV_SRC).toContain("labelKey: 'tabs.history'");
  });

  it('en.json carries `tabs.home / tasks / history` with English source values', () => {
    expect(enCatalog.tabs.home).toBe('Home');
    expect(enCatalog.tabs.tasks).toBe('Tasks');
    expect(enCatalog.tabs.history).toBe('History');
  });
});
