// HistoryRow — Phase 6 Wave 5 (Plan 06-09) Task 3.
//
// Behavior matrix (HIST-06 + HIST-11):
//   Test 1: Renders task name + a meta line (duration · date · time).
//   Test 2: chip-success when qa_status === 'verified'  (UploadStatusChip
//           ships variant=success → accessibilityLabel "upload-status-chip-success").
//   Test 3: chip-failed when qa_status === 'hash-mismatch'.
//   Test 4: chip-paused-no-wifi when offline === true AND qa_status === 'pending'
//           (UploadStatusChip variant=paused-offline → a11y "upload-status-chip-paused-offline").
//   Test 5: "Feedback (coming soon)" slot renders + is NOT pressable
//           (rendered as plain Text, accessibilityRole !== 'button', no onPress).
//   Test 6: Tap on the row fires onTap(row).
//
// `HistoryRow` is a pure component — no service mocks needed; the canonical
// vitest.setup react-native shim covers View/Text/Pressable/Image/StyleSheet.
// The conceptual chip variant strings (chip-success, chip-failed, etc.) are
// kept verbatim in the component module so the plan-level grep can find
// them; this test grids over the conceptual variants and asserts the
// resulting UploadStatusChip base-variant a11y label.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HistoryRow, type HistoryRowItem } from '../../src/components/HistoryRow';
import type { ThumbnailLedgerEntry } from '../../src/services/thumbnailLedger';

// `react-native-svg` is unmocked in the canonical vitest.setup.ts — the
// fallback thumbnail path renders an <Svg> with <Defs>/<LinearGradient>/<Rect>
// and JSDOM doesn't know those host components. Stub the entire module to a
// tiny passthrough set so the gradient-fallback branch renders cleanly.
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

// Re-mock react-native so the `<Image>` host-component surfaces the `source`
// object's URI as a `data-uri` attribute we can inspect. The canonical
// vitest.setup shim spreads `source={{uri}}` verbatim, which the DOM
// stringifies to `[object Object]`. The rest of the shim mirrors the
// canonical setup (View / Text / Pressable / StyleSheet / etc.); the
// per-file override is just to extract the URI for D-05 verification.
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
        style,
        source,
        numberOfLines: _nol,
        ...rest
      } = props as Record<string, unknown> & {
        source?: { uri?: string } | number;
        children?: React.ReactNode;
      };
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      // Image: surface source.uri as a `data-uri` attribute for tests.
      if (name === 'Image' && source && typeof source === 'object' && 'uri' in source) {
        dom['data-uri'] = (source as { uri?: string }).uri ?? '';
      }
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return ReactModule.createElement('div', dom, children as React.ReactNode);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    Image: makeComponent('Image'),
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select: (o: { android?: unknown; default?: unknown }) => o.android ?? o.default,
    },
  };
});

function makeRow(over: Partial<HistoryRowItem>): HistoryRowItem {
  return {
    id: 'rec-1',
    taskName: 'Make tea',
    durationMs: 90_000,
    createdAt: '2026-05-06T10:15:00.000Z',
    qaStatus: 'verified',
    verifiedAtIso: null,
    ...over,
  };
}

function makeLedgerEntry(thumbnailPath: string | null): ThumbnailLedgerEntry {
  return {
    recordingId: 'rec-1',
    thumbnailPath,
    filename: '20260506_101500_001.mp4',
    mp4LocalPath: '/data/20260506_101500_001.mp4',
    createdAtMs: 0,
  };
}

afterEach(() => {
  cleanup();
});

describe('HistoryRow (Plan 06-09)', () => {
  it('renders the task name + a meta line (duration · date · time)', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeRow({ taskName: 'Make tea', durationMs: 90_000 })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('history-row-name').textContent).toBe('Make tea');
    const meta = getByLabelText('history-row-meta').textContent ?? '';
    // The meta string carries the middle-dot separator and a YYYY year stamp.
    expect(meta).toMatch(/·/);
    expect(meta).toMatch(/2026/);
  });

  it('chip-success when qa_status === "verified"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeRow({ qaStatus: 'verified' })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    // chip-success → UploadStatusChip variant=success
    expect(getByLabelText('upload-status-chip-success')).toBeTruthy();
  });

  it('chip-failed when qa_status === "hash-mismatch"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeRow({ qaStatus: 'hash-mismatch' })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    // chip-failed → UploadStatusChip variant=failed
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
  });

  it('chip-paused-no-wifi when offline === true AND qa_status === "pending"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeRow({ qaStatus: 'pending' })}
        ledgerEntry={null}
        offline={true}
        onTap={() => undefined}
      />,
    );
    // chip-paused-no-wifi → UploadStatusChip variant=paused-offline
    expect(getByLabelText('upload-status-chip-paused-offline')).toBeTruthy();
  });

  it('progress chip when qa_status === "pending" AND online (not paused)', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeRow({ qaStatus: 'pending' })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('upload-status-chip-progress')).toBeTruthy();
  });

  it('"Feedback (coming soon)" slot renders + is NOT pressable (HIST-11)', () => {
    const { getByLabelText } = render(
      <HistoryRow row={makeRow({})} ledgerEntry={null} offline={false} onTap={() => undefined} />,
    );
    const slot = getByLabelText('history-row-feedback-coming-soon');
    expect(slot.textContent).toBe('Feedback (coming soon)');
    // NOT pressable — rendered as a plain Text node; role must not be "button".
    expect(slot.getAttribute('role')).not.toBe('button');
    // No onClick handler wired through onPress.
    expect((slot as HTMLElement & { onclick: unknown }).onclick).toBeNull();
  });

  it('tap on the row fires onTap(row)', () => {
    const onTap = vi.fn();
    const row = makeRow({ id: 'rec-99' });
    const { getByLabelText } = render(
      <HistoryRow row={row} ledgerEntry={null} offline={false} onTap={onTap} />,
    );
    fireEvent.click(getByLabelText('history-row'));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(row);
  });

  it('uses file:// URI for the thumb image when ledgerEntry.thumbnailPath is present (D-05)', () => {
    const ledger = makeLedgerEntry('/data/recordings/rec-1/thumb.jpg');
    const { getByLabelText, queryByLabelText } = render(
      <HistoryRow row={makeRow({})} ledgerEntry={ledger} offline={false} onTap={() => undefined} />,
    );
    const img = getByLabelText('history-row-thumb');
    // The per-file react-native re-mock above surfaces source.uri as
    // `data-uri` so the URI is inspectable from the rendered DOM.
    const uri = img.getAttribute('data-uri') ?? '';
    expect(uri).toContain('file://');
    expect(uri).toContain('/data/recordings/rec-1/thumb.jpg');
    expect(queryByLabelText('history-row-thumb-fallback')).toBeNull();
  });

  it('renders the gradient + first-letter fallback when the ledger entry is null (D-04)', () => {
    const { getByLabelText, queryByLabelText } = render(
      <HistoryRow
        row={makeRow({ taskName: 'Cook' })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('history-row-thumb-fallback')).toBeTruthy();
    expect(getByLabelText('history-row-thumb-letter').textContent).toBe('C');
    expect(queryByLabelText('history-row-thumb')).toBeNull();
  });
});
