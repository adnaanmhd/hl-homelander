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
import { describe, it, expect, vi, afterEach } from 'vitest';

// Phase 6 Wave 5 (Plan 06-09) — MainTabs now mounts HomeScreen / TasksScreen /
// HistoryScreen (the atomic 3-tab swap). All three pull design-system task
// icons via the cross-package `design-system/task-icons` barrel; the
// barrel's web variant (`TaskIcon.tsx`) imports from `lucide-react` which
// isn't installed in the mobile npm tree (Metro picks `TaskIcon.native.tsx`
// at runtime via the `.native.tsx` resolver hook — Vite doesn't honour that
// resolver). The mock factory mirrors the established pattern from
// `apps/mobile/__tests__/screens/tasks/TasksScreen.test.tsx`: stub the
// barrel at both call-site relative paths (4-level + 5-level) so any
// transitive import resolves to a tiny test shim.
vi.mock('../../../design-system/task-icons', async () => {
  const ReactMod = await import('react');
  return {
    TaskIcon: (props: { task: string; size?: number }) =>
      ReactMod.createElement('span', {
        'data-testid': 'TaskIcon',
        'data-task': props.task,
        size: props.size,
      }),
  };
});
vi.mock('../../../../design-system/task-icons', async () => {
  const ReactMod = await import('react');
  return {
    TaskIcon: (props: { task: string; size?: number }) =>
      ReactMod.createElement('span', {
        'data-testid': 'TaskIcon',
        'data-task': props.task,
        size: props.size,
      }),
  };
});

// HumynUpload native module — both HomeScreen and (post-swap) MainTabs
// pull this transitively. Stub the queue + listeners so the navigator
// boots without trying to hit the real native bridge.
vi.mock('../../src/native/HumynUpload', () => ({
  HumynUpload: {
    getQueueSafe: vi.fn(async () => []),
    drainNowSafe: vi.fn(async () => undefined),
    reupload: vi.fn(async () => undefined),
    getConnectivitySafe: vi.fn(async () => ({ online: true })),
    isBatteryOptimizationExemptSafe: vi.fn(async () => false),
    oemAutostartAvailableSafe: vi.fn(async () => false),
    openOemAutostartSafe: vi.fn(async () => false),
    requestBatteryOptimizationExemptionSafe: vi.fn(async () => undefined),
  },
  onUploadQueueChanged: vi.fn(() => ({ remove: () => undefined })),
  onUploadProgress: vi.fn(() => ({ remove: () => undefined })),
  onConnectivityChanged: vi.fn(() => ({ remove: () => undefined })),
}));

// contributionsApi — HomeScreen fetches lifetime + aggregate on focus.
vi.mock('../../src/services/contributionsApi', () => ({
  fetchLifetime: vi.fn(async () => ({
    durationMs: 0,
    recordingCount: 0,
    taskCount: 0,
    perTask: [],
  })),
  fetchContributionsAggregate: vi.fn(async () => ({ buckets: [] })),
}));

// tasksApi — TasksScreen + HistoryScreen both consume this.
vi.mock('../../src/services/tasksApi', () => ({
  fetchTasks: vi.fn(async () => ({ items: [], nextCursor: null })),
  useTaskSearch: vi.fn(() => ({ results: null, loading: false, error: null })),
}));

// recordingsApi — HistoryScreen fetches on focus.
vi.mock('../../src/services/recordingsApi', () => ({
  fetchRecordings: vi.fn(async () => ({ items: [], next_cursor: null })),
}));

// thumbnailLedger — HistoryScreen reads per-recording overlays + (quick task
// 260517-p5g CAPTURE-QA-05) every entry for canceled-row synthesis.
vi.mock('../../src/services/thumbnailLedger', () => ({
  readEntry: vi.fn(() => null),
  readAllEntries: vi.fn(() => []),
}));

// uploadReconcile — HomeScreen schedules reconcileOnce on focus.
vi.mock('../../src/services/uploadReconcile', () => ({
  reconcileOnce: vi.fn(async () => 0),
}));

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
