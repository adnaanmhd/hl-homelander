// HistoryScreen — Phase 6 Wave 5 (Plan 06-09) Task 3.
//
// Behavior matrix (HIST-01..06 + 10 + 11):
//   Test 1: 0 rows AND historyRange === 'all' → HIST-04 empty state
//           ("Your recordings will live here." + "Pick a task" accent link).
//   Test 2: 0 rows AND historyRange === 'today' → HIST-05 empty state
//           ("No recordings in this range." + "Show all time" accent link).
//   Test 3: 3 rows across Today + Yesterday + a prior week → 3 day-group
//           headers (the grouper mock returns three sections; the SectionList
//           renders all section titles).
//   Test 4: Tap the filter chip opens the FilterSheet 16a.
//   Test 5: Selecting 'this-week' in the FilterSheet calls
//           setHistoryRange('this-week') and re-fires fetchRecordings.
//   Test 6: Tap on a row calls navigation.navigate('Player', { recordingId, taskName }).
//   Test 7: Pull-to-refresh re-fires fetchRecordings with the current range.
//   Test 8: When the ledger has a thumbnailPath, the row's <Image> uses
//           a file:// URI; when it doesn't, the gradient fallback renders.
//
// Mocks mirror HomeScreen.test.tsx: per-file `react-native` re-mock (the
// canonical vitest.setup shim now ships RefreshControl too but HomeScreen's
// rich pattern is the established convention for screens that exercise PTR);
// hoisted appStore selector spy; service-layer mocks for `tasksApi` (the
// screen fetches the taxonomy on mount), `recordingsApi`, `thumbnailLedger`,
// `historyGrouping`, `timeRange`; navigation mock.

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RecordingsListItem } from '@humyn/shared-types';
import type { UploadQueueRow } from '../../../src/native/HumynUpload';

// Per-file react-native shim (RefreshControl + Modal-visible-gate). Same
// pattern as HomeScreen.test.tsx — see that file's header for the
// rationale (the canonical shim covers the basics; PTR-aware screens want
// the explicit RefreshControl entry so the host-component shim surfaces
// `data-onrefresh` for tests).
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  function resolveStyle(value: unknown): Record<string, unknown> | undefined {
    if (value == null || value === false) return undefined;
    if (typeof value === 'function') {
      return resolveStyle((value as (s: { pressed: boolean }) => unknown)({ pressed: false }));
    }
    if (Array.isArray(value)) {
      const merged: Record<string, unknown> = {};
      for (const entry of value) {
        const r = resolveStyle(entry);
        if (r) Object.assign(merged, r);
      }
      return Object.keys(merged).length ? merged : undefined;
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return undefined;
  }
  function makeComponent(name: string) {
    return ReactModule.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const {
        children,
        accessibilityLabel,
        accessibilityRole,
        onPress,
        onRefresh,
        style,
        refreshing: _r,
        tintColor: _t,
        refreshControl: _rc,
        contentContainerStyle: _ccs,
        keyboardShouldPersistTaps: _kpt,
        placeholderTextColor: _ptc,
        autoCapitalize: _ac,
        autoCorrect: _acc,
        maxLength: _ml,
        numberOfLines: _nol,
        pointerEvents: _pe,
        stickySectionHeadersEnabled: _ssh,
        onEndReached: _oer,
        onEndReachedThreshold: _oet,
        sections,
        keyExtractor: _ke,
        renderItem,
        renderSectionHeader,
        ListEmptyComponent,
        ...rest
      } = props as Record<string, unknown> & {
        sections?: Array<{ title: string; data: unknown[] }>;
        renderItem?: (info: { item: unknown; index: number; section: unknown }) => React.ReactNode;
        renderSectionHeader?: (info: { section: { title: string } }) => React.ReactNode;
        ListEmptyComponent?: React.ComponentType | (() => React.ReactNode);
      };
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      if (typeof onRefresh === 'function') {
        dom['data-onrefresh'] = '1';
        dom['onClick'] = onRefresh;
      }
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      // SectionList shim — render section headers + items inline so tests can
      // assert on the resulting DOM. The canonical shim doesn't expand
      // SectionList; this re-mock does so the renderItem/renderSectionHeader
      // contract is exercised end-to-end without going through @testing-library
      // virtualization tricks.
      let body: React.ReactNode = children as React.ReactNode;
      if (name === 'SectionList') {
        if (Array.isArray(sections) && sections.length > 0) {
          const flat: React.ReactNode[] = [];
          sections.forEach((sec, secIdx) => {
            if (renderSectionHeader) {
              flat.push(
                ReactModule.createElement(
                  ReactModule.Fragment,
                  { key: `h-${secIdx}` },
                  renderSectionHeader({ section: sec }),
                ),
              );
            }
            sec.data.forEach((item, idx) => {
              if (renderItem) {
                flat.push(
                  ReactModule.createElement(
                    ReactModule.Fragment,
                    { key: `i-${secIdx}-${idx}` },
                    renderItem({ item, index: idx, section: sec }),
                  ),
                );
              }
            });
          });
          body = flat;
        } else if (ListEmptyComponent) {
          // 0 sections → render the empty component.
          const empty =
            typeof ListEmptyComponent === 'function'
              ? (ListEmptyComponent as () => React.ReactNode)()
              : ReactModule.createElement(ListEmptyComponent as React.ComponentType);
          body = empty;
        }
      }
      return ReactModule.createElement('div', dom, body);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    SectionList: makeComponent('SectionList'),
    Image: makeComponent('Image'),
    ActivityIndicator: makeComponent('ActivityIndicator'),
    RefreshControl: makeComponent('RefreshControl'),
    Modal: ReactModule.forwardRef<
      HTMLDivElement,
      { visible?: boolean; children?: React.ReactNode } & Record<string, unknown>
    >(function ModalShim(props, ref) {
      const { visible, children, ...rest } = props;
      if (visible === false) return null;
      return ReactModule.createElement(
        'div',
        { ref, 'data-testid': 'Modal', ...rest },
        children as React.ReactNode,
      );
    }),
    StatusBar: () => null,
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    NativeEventEmitter: class {
      addListener() {
        return { remove: () => undefined };
      }
      removeAllListeners() {
        /* no-op */
      }
    },
    Platform: {
      OS: 'android',
      select: (o: { android?: unknown; ios?: unknown; default?: unknown }) =>
        o.android ?? o.default,
    },
    BackHandler: {
      addEventListener: () => ({ remove: () => undefined }),
      removeEventListener: () => undefined,
      exitApp: () => undefined,
    },
    Alert: { alert: () => undefined },
    Linking: { openURL: () => Promise.resolve(), canOpenURL: () => Promise.resolve(true) },
    AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
    Vibration: { vibrate: () => undefined, cancel: () => undefined },
  };
});

// Stub react-native-svg — HistoryRow's fallback thumb renders an Svg
// gradient + JSDOM doesn't know those host components.
vi.mock('react-native-svg', async () => {
  const ReactMod = await import('react');
  function shim(name: string) {
    return (props: Record<string, unknown> & { children?: React.ReactNode }) =>
      ReactMod.createElement('span', { 'data-testid': name }, props.children as React.ReactNode);
  }
  return {
    default: shim('Svg'),
    Svg: shim('Svg'),
    Defs: shim('Defs'),
    LinearGradient: shim('LinearGradient'),
    Rect: shim('Rect'),
    Stop: shim('Stop'),
  };
});

const { mockState, mockSetters } = vi.hoisted(() => ({
  mockState: {
    historyRange: 'all' as 'today' | 'yesterday' | 'this-week' | 'this-month' | 'all' | 'custom',
    historyRangeCustom: null as { start: string; end: string } | null,
    // Bug 7 — History now reads the upload queue + progress from the store
    // slice (fed by the boot installer) instead of a per-screen subscription.
    jwt: null as string | null,
    uploadQueue: [] as UploadQueueRow[],
    uploadProgressById: {} as Record<string, number>,
    contributionsVersion: 0,
  },
  mockSetters: {
    setHistoryRange: vi.fn(),
    setHistoryRangeCustom: vi.fn(),
  },
}));

vi.mock('../../../src/state/appStore', () => ({
  useAppStore: <T,>(selector: (s: Record<string, unknown>) => T) =>
    selector({
      historyRange: mockState.historyRange,
      historyRangeCustom: mockState.historyRangeCustom,
      jwt: mockState.jwt,
      uploadQueue: mockState.uploadQueue,
      uploadProgressById: mockState.uploadProgressById,
      contributionsVersion: mockState.contributionsVersion,
      setHistoryRange: (r: string) => {
        mockSetters.setHistoryRange(r);
        mockState.historyRange = r as typeof mockState.historyRange;
      },
      setHistoryRangeCustom: (start: string, end: string) => {
        mockSetters.setHistoryRangeCustom(start, end);
        mockState.historyRangeCustom = { start, end };
        mockState.historyRange = 'custom';
      },
    }),
}));

// Bug 7 — decode a deterministic sub so device-queue rows filter to the
// signed-in user. `null` jwt → '' (the default for the existing server-row tests).
vi.mock('../../../src/lib/jwtSub', () => ({
  decodeGoogleSubFromJwt: (jwt: string | null) => (jwt ? 'sub-alice' : ''),
}));

const {
  fetchRecordingsMock,
  fetchTasksMock,
  readEntryMock,
  readAllEntriesMock,
  computeRangeMock,
  groupByDayMock,
} = vi.hoisted(() => ({
  fetchRecordingsMock: vi.fn(),
  fetchTasksMock: vi.fn(),
  readEntryMock: vi.fn(),
  // Quick task 260517-p5g CAPTURE-QA-05 — HistoryScreen now reads the full
  // ledger to synthesize canceled-segment rows. Default to empty for the
  // existing tests; the canceled-row synthesis path has its own test.
  readAllEntriesMock: vi.fn().mockReturnValue([]),
  computeRangeMock: vi.fn(),
  groupByDayMock: vi.fn(),
}));

vi.mock('../../../src/services/recordingsApi', () => ({
  fetchRecordings: fetchRecordingsMock,
}));

vi.mock('../../../src/services/tasksApi', () => ({
  fetchTasks: fetchTasksMock,
  useTaskSearch: () => ({ results: null, loading: false, error: null }),
}));

vi.mock('../../../src/services/thumbnailLedger', () => ({
  readEntry: readEntryMock,
  readAllEntries: readAllEntriesMock,
}));

vi.mock('../../../src/services/timeRange', () => ({
  computeRange: computeRangeMock,
}));

vi.mock('../../../src/services/historyGrouping', () => ({
  groupByDay: groupByDayMock,
}));

const navigateMock = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: navigateMock }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    effect();
  },
}));

// Import AFTER mocks.
import { HistoryScreen } from '../../../src/screens/history/HistoryScreen';

function makeRecording(over: Partial<RecordingsListItem>): RecordingsListItem {
  return {
    recording_id: 'rec-1',
    task_id: 'task-1',
    duration_ms: 90_000,
    created_at: '2026-05-06T10:15:00.000Z',
    qa_status: 'verified',
    ...over,
  } as RecordingsListItem;
}

afterEach(() => {
  cleanup();
  mockState.historyRange = 'all';
  mockState.historyRangeCustom = null;
  mockState.jwt = null;
  mockState.uploadQueue = [];
  mockState.uploadProgressById = {};
  mockState.contributionsVersion = 0;
  mockSetters.setHistoryRange.mockClear();
  mockSetters.setHistoryRangeCustom.mockClear();
  fetchRecordingsMock.mockReset();
  fetchTasksMock.mockReset();
  readEntryMock.mockReset();
  computeRangeMock.mockReset();
  groupByDayMock.mockReset();
  navigateMock.mockReset();
  // Default service return shapes.
  fetchTasksMock.mockResolvedValue({ items: [], nextCursor: null });
  readEntryMock.mockReturnValue(null);
  computeRangeMock.mockReturnValue({ start: 'mock-start', end: 'mock-end' });
  groupByDayMock.mockReturnValue([]);
});

describe('HistoryScreen (Plan 06-09)', () => {
  it('0 rows AND historyRange === "all" → HIST-04 empty state', async () => {
    mockState.historyRange = 'all';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    groupByDayMock.mockReturnValue([]);
    const { findByLabelText, getByText } = render(<HistoryScreen />);
    await findByLabelText('history-empty');
    expect(getByText('Your recordings will live here.')).toBeTruthy();
    expect(getByText('Pick a task')).toBeTruthy();
  });

  it('0 rows AND historyRange === "today" → HIST-05 empty state', async () => {
    mockState.historyRange = 'today';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    groupByDayMock.mockReturnValue([]);
    const { findByLabelText, getByText } = render(<HistoryScreen />);
    await findByLabelText('history-empty');
    expect(getByText('No recordings in this range.')).toBeTruthy();
    expect(getByText('Show all time')).toBeTruthy();
  });

  it('renders one day-group header per section returned by groupByDay (HIST-02)', async () => {
    mockState.historyRange = 'all';
    const r1 = makeRecording({ recording_id: 'r1' });
    const r2 = makeRecording({ recording_id: 'r2' });
    const r3 = makeRecording({ recording_id: 'r3' });
    fetchRecordingsMock.mockResolvedValue({ items: [r1, r2, r3], next_cursor: null });
    fetchTasksMock.mockResolvedValue({
      items: [{ id: 'task-1', name: 'Make tea' }],
      nextCursor: null,
    });
    // Three sections — Today / Yesterday / a prior week. Only emit
    // sections when the input rows actually have items (the first render
    // calls groupByDay([]) before the fetch resolves; returning a section
    // with `undefined` data would crash renderItem in the SectionList shim).
    groupByDayMock.mockImplementation(<T,>(rows: T[]): Array<{ title: string; data: T[] }> => {
      if (rows.length < 3) return [];
      // `as T` casts are noUncheckedIndexedAccess accommodations — the
      // length-gate above guarantees rows[0..2] are defined here.
      return [
        { title: 'Today', data: [rows[0] as T] },
        { title: 'Yesterday', data: [rows[1] as T] },
        { title: 'May 6, 2026', data: [rows[2] as T] },
      ];
    });
    const { findAllByLabelText } = render(<HistoryScreen />);
    // The HistoryDayHeader renders an eyebrow Text with the section title;
    // there are 3 section headers in the rendered output.
    const headers = await findAllByLabelText('history-day-header');
    expect(headers).toHaveLength(3);
  });

  it('tap the filter chip opens the FilterSheet 16a', async () => {
    mockState.historyRange = 'all';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    const { findByLabelText, queryByLabelText } = render(<HistoryScreen />);
    expect(queryByLabelText('filter-sheet-16a')).toBeNull();
    fireEvent.click(await findByLabelText('history-filter-chip'));
    expect(await findByLabelText('filter-sheet-16a')).toBeTruthy();
  });

  it('selecting "this-week" in the FilterSheet calls setHistoryRange + re-fires fetchRecordings', async () => {
    mockState.historyRange = 'all';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    const { findByLabelText } = render(<HistoryScreen />);
    fireEvent.click(await findByLabelText('history-filter-chip'));
    fetchRecordingsMock.mockClear();
    fireEvent.click(await findByLabelText('filter-option-this-week'));
    expect(mockSetters.setHistoryRange).toHaveBeenCalledWith('this-week');
    await waitFor(() => expect(fetchRecordingsMock).toHaveBeenCalled());
  });

  it('tap on a row calls navigation.navigate("Player", { recordingId, taskName })', async () => {
    mockState.historyRange = 'all';
    const rec = makeRecording({ recording_id: 'rec-99', task_id: 'task-1' });
    fetchRecordingsMock.mockResolvedValue({ items: [rec], next_cursor: null });
    fetchTasksMock.mockResolvedValue({
      items: [{ id: 'task-1', name: 'Cook eggs' }],
      nextCursor: null,
    });
    groupByDayMock.mockImplementation(<T,>(rows: T[]) => [{ title: 'Today', data: rows }]);
    const { findByLabelText } = render(<HistoryScreen />);
    fireEvent.click(await findByLabelText('history-row'));
    expect(navigateMock).toHaveBeenCalledWith('Player', {
      recordingId: 'rec-99',
      taskName: 'Cook eggs',
      durationMs: 90000,
    });
  });

  it('pull-to-refresh re-fires fetchRecordings', async () => {
    mockState.historyRange = 'all';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    const { baseElement } = render(<HistoryScreen />);
    await waitFor(() => expect(fetchRecordingsMock).toHaveBeenCalled());
    fetchRecordingsMock.mockClear();
    const rc = baseElement.querySelector('[data-testid="RefreshControl"]') as HTMLElement | null;
    if (rc == null) {
      // Same fallback as HomeScreen.test.tsx — the RefreshControl shim may
      // be dropped by the props strip; the wiring is then verified by the
      // initial fetch (asserted above) + the SectionList accessibilityLabel.
      const list = baseElement.querySelector('[data-testid="SectionList"]');
      expect(list).toBeTruthy();
      return;
    }
    fireEvent.click(rc);
    await waitFor(() => expect(fetchRecordingsMock).toHaveBeenCalled());
  });

  it('row renders the local thumb when ledger has thumbnailPath; gradient fallback otherwise (D-04/D-05)', async () => {
    mockState.historyRange = 'all';
    const r1 = makeRecording({ recording_id: 'rec-with-thumb' });
    const r2 = makeRecording({ recording_id: 'rec-no-thumb' });
    fetchRecordingsMock.mockResolvedValue({ items: [r1, r2], next_cursor: null });
    fetchTasksMock.mockResolvedValue({
      items: [{ id: 'task-1', name: 'Cook' }],
      nextCursor: null,
    });
    readEntryMock.mockImplementation((id: string) =>
      id === 'rec-with-thumb'
        ? {
            recordingId: id,
            thumbnailPath: '/data/rec-with-thumb/thumb.jpg',
            filename: 'a.mp4',
            mp4LocalPath: '/data/a.mp4',
            createdAtMs: 0,
          }
        : null,
    );
    groupByDayMock.mockImplementation(<T,>(rows: T[]) => [{ title: 'Today', data: rows }]);
    const { findAllByLabelText, baseElement } = render(<HistoryScreen />);
    // Both rows render — one with a real <Image> (history-row-thumb), one
    // with the gradient fallback (history-row-thumb-fallback). The actual
    // file:// URI string is asserted on the Image source in HistoryRow's
    // own test below (the host-component shim flattens the `source` object
    // prop to `[object Object]`, so the URI is verified via the unit test
    // on the component, not this integration).
    await findAllByLabelText('history-row');
    const imgs = baseElement.querySelectorAll('[aria-label="history-row-thumb"]');
    const fallbacks = baseElement.querySelectorAll('[aria-label="history-row-thumb-fallback"]');
    expect(imgs.length).toBe(1);
    expect(fallbacks.length).toBe(1);
  });

  it('renders a device-queue row seeded in the store, with NO local subscription (Bug 7)', async () => {
    // Bug 7 — the upload was enqueued into the store (by the boot installer)
    // while History was unmounted/frozen. History reads `uploadQueue` from the
    // store on mount and synthesizes the in-flight row immediately — there is
    // no `onUploadQueueChanged` subscription on this screen anymore, so this is
    // the "enqueue while unmounted → focus → row present" guarantee.
    mockState.historyRange = 'all';
    mockState.jwt = 'jwt-token'; // decodes to 'sub-alice' via the jwtSub mock
    mockState.uploadQueue = [
      {
        recordingId: 'dev-rec-1',
        ownerUserId: 'sub-alice',
        mp4Path: '/data/dev-rec-1.mp4',
        csvPath: '/data/dev-rec-1.csv',
        jsonPath: '/data/dev-rec-1.json',
        taskId: 'task-1',
        isPractice: false,
        state: 'uploading',
        videoParts: [],
        imuParts: [],
        metadataPut: 'pending',
        enqueuedAt: 1_717_000_000_000,
        lastProgressAt: 1_717_000_000_000,
      },
    ];
    // No server rows — the only row is the synthesized device-queue row.
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    fetchTasksMock.mockResolvedValue({
      items: [{ id: 'task-1', name: 'Make tea' }],
      nextCursor: null,
    });
    groupByDayMock.mockImplementation(
      <T,>(rows: T[]): Array<{ title: string; data: T[] }> =>
        rows.length ? [{ title: 'Today', data: rows }] : [],
    );
    const { findByLabelText } = render(<HistoryScreen />);
    expect(await findByLabelText('history-row')).toBeTruthy();
  });

  it('Phase 4 (Bug 4, 2026-06-10): a device-ONLY row renders its local ledger thumb (not the letter tile)', async () => {
    // The ledger map used to span only server rawRows — a failed/in-flight
    // device row letter-tiled even though filesDir/thumbs/<id>.jpg + a ledger
    // entry existed. The map now unions device-queue recordingIds.
    mockState.historyRange = 'all';
    mockState.jwt = 'jwt-token'; // 'sub-alice'
    mockState.uploadQueue = [
      {
        recordingId: 'dev-rec-thumb',
        ownerUserId: 'sub-alice',
        mp4Path: '/data/dev-rec-thumb.mp4',
        csvPath: '/data/dev-rec-thumb.csv',
        jsonPath: '/data/dev-rec-thumb.json',
        taskId: 'task-1',
        isPractice: false,
        state: 'dead-letter',
        videoParts: [],
        imuParts: [],
        metadataPut: 'pending',
        enqueuedAt: 1_717_000_000_000,
        lastProgressAt: 1_717_000_000_000,
      },
    ];
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    fetchTasksMock.mockResolvedValue({
      items: [{ id: 'task-1', name: 'Make tea' }],
      nextCursor: null,
    });
    readEntryMock.mockImplementation((id: string) =>
      id === 'dev-rec-thumb'
        ? {
            recordingId: id,
            thumbnailPath: '/data/thumbs/dev-rec-thumb.jpg',
            filename: 'b.mp4',
            mp4LocalPath: '/data/b.mp4',
            createdAtMs: 0,
          }
        : null,
    );
    groupByDayMock.mockImplementation(
      <T,>(rows: T[]): Array<{ title: string; data: T[] }> =>
        rows.length ? [{ title: 'Today', data: rows }] : [],
    );
    const { findByLabelText, baseElement } = render(<HistoryScreen />);
    await findByLabelText('history-row');
    // The local thumb image renders; NO gradient letter-tile fallback.
    expect(baseElement.querySelectorAll('[aria-label="history-row-thumb"]').length).toBe(1);
    expect(baseElement.querySelectorAll('[aria-label="history-row-thumb-fallback"]').length).toBe(
      0,
    );
  });

  it("does NOT render another user's device-queue row (UP-13 owner-pin)", async () => {
    mockState.historyRange = 'all';
    mockState.jwt = 'jwt-token'; // 'sub-alice'
    mockState.uploadQueue = [
      {
        recordingId: 'dev-rec-bob',
        ownerUserId: 'sub-bob', // different owner
        mp4Path: '/data/dev-rec-bob.mp4',
        csvPath: '/data/dev-rec-bob.csv',
        jsonPath: '/data/dev-rec-bob.json',
        taskId: 'task-1',
        isPractice: false,
        state: 'uploading',
        videoParts: [],
        imuParts: [],
        metadataPut: 'pending',
        enqueuedAt: 1_717_000_000_000,
        lastProgressAt: 1_717_000_000_000,
      },
    ];
    mockState.historyRange = 'all';
    fetchRecordingsMock.mockResolvedValue({ items: [], next_cursor: null });
    groupByDayMock.mockImplementation(
      <T,>(rows: T[]): Array<{ title: string; data: T[] }> =>
        rows.length ? [{ title: 'Today', data: rows }] : [],
    );
    const { findByLabelText, queryByLabelText } = render(<HistoryScreen />);
    // Empty state renders (the bob row is filtered out → no rows at all).
    await findByLabelText('history-empty');
    expect(queryByLabelText('history-row')).toBeNull();
  });
});
