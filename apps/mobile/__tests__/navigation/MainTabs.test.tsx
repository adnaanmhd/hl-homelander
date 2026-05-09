// Plan 02-05 + 02-16 — MainTabs renders EXACTLY 3 tabs (Home, Tasks, History).
//
// HOME-07 satisfied STRUCTURALLY: the BottomNav component renders 3
// Pressables and only 3 — Profile is NOT a tab here, it's a sibling of
// MainTabs at the RootNativeStack level.
//
// This file ships TWO complementary gates:
//   1. Runtime render gate (02-05) — boots the navigator under the
//      bottom-tabs vitest mock, confirms BottomNav renders three tabs with
//      the expected accessibility labels, and confirms no fourth tab labelled
//      "Profile" appears. Catches regressions in BottomNav's own contract.
//   2. Structural source-grep gate (02-16) — reads MainTabs.tsx as a
//      pre-bundled string (Vite `?raw` import) and asserts EXACTLY 3
//      Tab.Screen elements in the order Home → Tasks → History, with NO
//      Profile tab. Catches future plans that try to sneak a fourth tab
//      into the navigator graph (T-2.16-01 mitigation). The grep gate is
//      independent of any RN/test mock state — it would catch a violation
//      even if the runtime test were mistakenly skipped.
//
// Why `?raw` instead of node:fs: the mobile tsconfig pins types:[] +
// moduleResolution:Bundler (per plan 02-05 deviation #3 — RN ecosystem
// requires Bundler resolution). Adding @types/node just to read MainTabs.tsx
// during a unit test would balloon the dep tree. Vite's `?raw` import is
// the idiomatic Vitest 4 way to inline a file's contents at compile time.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import MainTabs from '../../src/navigation/MainTabs';
import MainTabsSource from '../../src/navigation/MainTabs.tsx?raw';

// ---------------------------------------------------------------------------
// 1. Runtime render gate (02-05) — exercises the BottomNav contract.
// ---------------------------------------------------------------------------
describe('MainTabs (runtime render)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders exactly 3 tabs labeled Home/Tasks/History', () => {
    const { getAllByLabelText } = render(<MainTabs />);
    expect(getAllByLabelText('Home tab').length).toBe(1);
    expect(getAllByLabelText('Tasks tab').length).toBe(1);
    expect(getAllByLabelText('History tab').length).toBe(1);
  });

  it('does NOT render a fourth tab labelled Profile', () => {
    const { queryAllByLabelText } = render(<MainTabs />);
    expect(queryAllByLabelText('Profile tab').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Structural source-grep gate (02-16) — reads MainTabs.tsx as a string.
// Catches future plans that try to add a fourth Tab.Screen registration.
// Independent of mock state.
// ---------------------------------------------------------------------------
const SOURCE: string = MainTabsSource;

describe('MainTabs structural HOME-07 invariant (T-2.16-01)', () => {
  it('declares EXACTLY 3 Tab.Screen elements', () => {
    // Strip line comments before counting to avoid false positives from a
    // future doc comment that mentions <Tab.Screen> in markdown.
    const code = SOURCE.split('\n')
      .filter((l: string) => !l.trim().startsWith('//'))
      .join('\n');
    const matches = code.match(/<Tab\.Screen\b/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('declares the tabs in the order Home → Tasks → History', () => {
    const homeIdx = SOURCE.indexOf('name="Home"');
    const tasksIdx = SOURCE.indexOf('name="Tasks"');
    const historyIdx = SOURCE.indexOf('name="History"');
    expect(homeIdx).toBeGreaterThan(0);
    expect(tasksIdx).toBeGreaterThan(homeIdx);
    expect(historyIdx).toBeGreaterThan(tasksIdx);
  });

  it('does NOT declare a Profile tab (HOME-07: Profile reachable only via TopBar avatar)', () => {
    expect(SOURCE).not.toContain('name="Profile"');
  });
});
