// Quick task 260517-p5g CAPTURE-QA-05 — HistoryRow canceled-segment rendering.
//
// Mirror of `__tests__/components/HistoryRow.test.tsx`'s shim pattern; covers
// the new `cancel` payload branch:
//
//   Test A — `cancel.reason === 'fps_dropped'` renders the
//            "Canceled — frame rate dropped" copy + chip-failed visual.
//   Test B — `cancel.reason === 'resolution_dropped'` renders
//            "Canceled — resolution dropped".
//   Test C — `cancel.reason === 'insufficient_frames'` renders
//            "Canceled — recording too short".
//   Test D — Canceled rows render NO Retry affordance (no
//            history-row-failed-retry a11y label).
//   Test E — Canceled row's chip variant is chip-failed regardless of
//            qaStatus (override).
//   Test F — A non-canceled row (no `cancel` payload) renders the
//            existing chip-failed Retry affordance — regression guard.
//   Test G — Pure-fn `cancelReasonLabel` returns the three strings.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  HistoryRow,
  cancelReasonLabel,
  chipVariant,
  type HistoryRowItem,
} from '../../../src/components/HistoryRow';

// react-native-svg stub — the gradient-fallback path uses it.
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

// react-native shim — same pattern as the canonical HistoryRow test.
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

function makeCanceledRow(
  reason: 'fps_dropped' | 'resolution_dropped' | 'insufficient_frames' | 'too_short',
  over: Partial<HistoryRowItem> = {},
): HistoryRowItem {
  return {
    id: '01JCANCELED-ROW-XXXXXXXXX',
    taskName: 'Chopping',
    durationMs: 4_500,
    createdAt: '2026-05-17T12:00:00.000Z',
    // qaStatus is a placeholder for canceled rows — the chip variant is
    // overridden by `cancel`.
    qaStatus: 'rejected',
    verifiedAtIso: null,
    cancel: { reason },
    ...over,
  };
}

afterEach(() => {
  cleanup();
});

describe('HistoryRow canceled-segment rendering (CAPTURE-QA-05)', () => {
  it('Test A — cancel.reason="fps_dropped" renders "Canceled — frame rate dropped"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('fps_dropped')}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    const label = getByLabelText('history-row-canceled-reason');
    expect(label.textContent).toBe('Canceled — frame rate dropped');
    // chip-failed visual variant (UploadStatusChip a11y).
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
  });

  it('Test B — cancel.reason="resolution_dropped" renders "Canceled — resolution dropped"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('resolution_dropped')}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('history-row-canceled-reason').textContent).toBe(
      'Canceled — resolution dropped',
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
  });

  it('Test C — cancel.reason="insufficient_frames" renders "Canceled — recording too short"', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('insufficient_frames')}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('history-row-canceled-reason').textContent).toBe(
      'Canceled — recording too short',
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
  });

  it('Test C2 — cancel.reason="too_short" renders "Canceled — recording too short" (Bug 8 + Enh 1 / D6)', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('too_short')}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('history-row-canceled-reason').textContent).toBe(
      'Canceled — recording too short',
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
  });

  it('Test D — canceled rows render NO Retry affordance', () => {
    const onRetry = vi.fn();
    const { queryByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('fps_dropped')}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
        onRetry={onRetry}
      />,
    );
    // The Retry affordance is rendered ONLY for non-canceled chip-failed
    // rows (existing hash-mismatch / rejected qa_status path).
    expect(queryByLabelText('history-row-failed-retry')).toBeNull();
  });

  it('Test E — canceled row overrides any qaStatus (chip-failed)', () => {
    // Even with qa_status === 'verified' (impossible in production but
    // a defensive contract assertion), the cancel marker wins.
    const { getByLabelText, queryByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('fps_dropped', { qaStatus: 'verified' })}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
      />,
    );
    expect(getByLabelText('upload-status-chip-failed')).toBeTruthy();
    // No success label, no progress label.
    expect(queryByLabelText('history-row-uploaded-at')).toBeNull();
    expect(queryByLabelText('history-row-progress')).toBeNull();
  });

  it('Test E2 — canceled row does NOT render in-progress / paused-no-wifi labels', () => {
    const { queryByLabelText } = render(
      <HistoryRow
        row={makeCanceledRow('fps_dropped', { qaStatus: 'pending' })}
        ledgerEntry={null}
        offline={true} // would normally trigger paused-no-wifi
        onTap={() => undefined}
      />,
    );
    expect(queryByLabelText('history-row-paused')).toBeNull();
    expect(queryByLabelText('history-row-progress')).toBeNull();
  });

  it('Test F — non-canceled chip-failed row STILL renders the Retry affordance (regression)', () => {
    const { getByLabelText } = render(
      <HistoryRow
        row={{
          id: 'rec-failed',
          taskName: 'Chopping',
          durationMs: 90_000,
          createdAt: '2026-05-17T12:00:00.000Z',
          qaStatus: 'hash-mismatch',
          verifiedAtIso: null,
        }}
        ledgerEntry={null}
        offline={false}
        onTap={() => undefined}
        onRetry={() => undefined}
      />,
    );
    // Existing chip-failed Retry copy untouched.
    expect(getByLabelText('history-row-failed-retry').textContent).toBe('Upload failed — Retry');
  });
});

describe('cancelReasonLabel (pure-fn)', () => {
  it('returns the reason-specific strings (CAPTURE-QA-05 + Bug 8 / D6)', () => {
    expect(cancelReasonLabel('fps_dropped')).toBe('Canceled — frame rate dropped');
    expect(cancelReasonLabel('resolution_dropped')).toBe('Canceled — resolution dropped');
    expect(cancelReasonLabel('insufficient_frames')).toBe('Canceled — recording too short');
    // too_short (3-min floor) shares the "recording too short" copy.
    expect(cancelReasonLabel('too_short')).toBe('Canceled — recording too short');
  });
});

describe('chipVariant (cancel override)', () => {
  it('returns chip-failed when row.cancel is set, regardless of other inputs', () => {
    expect(chipVariant('verified', false, undefined, { reason: 'fps_dropped' })).toBe(
      'chip-failed',
    );
    expect(chipVariant('pending', true, 'uploading', { reason: 'resolution_dropped' })).toBe(
      'chip-failed',
    );
    expect(chipVariant('rejected', false, 'dead-letter', { reason: 'insufficient_frames' })).toBe(
      'chip-failed',
    );
  });

  it('returns the existing variant decision when cancel is undefined (regression)', () => {
    expect(chipVariant('verified', false)).toBe('chip-success');
    expect(chipVariant('hash-mismatch', false)).toBe('chip-failed');
    expect(chipVariant('pending', true)).toBe('chip-paused-no-wifi');
  });
});
