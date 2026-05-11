// Toast host — app-wide transient bottom-toast (plan 04-10, NET-NEW).
//
// Coverage:
//   1. <ToastHost /> renders nothing when no toast is showing.
//   2. showToast('hi') → <ToastHost /> renders 'hi' under the "toast" label.
//   3. After the default duration elapses (fake clock), the toast is gone.
//   4. A custom durationMs is respected.
//   5. A rapid second showToast supersedes the first (the first's fade-out
//      doesn't clobber the second).
//   6. hideToast() dismisses immediately.
//
// Pattern: testing-library/react under jsdom (RN host shim from vitest.setup),
// vi.useFakeTimers() to advance the auto-fade. cleanup() in afterEach (the
// project runs with globals: false, so auto-cleanup doesn't fire).

import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastHost, showToast, hideToast, DEFAULT_TOAST_MS } from '../../src/components/Toast';

describe('Toast host (plan 04-10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain any pending fade timer + reset module state via hideToast, then
    // restore real timers + unmount.
    act(() => {
      hideToast();
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('renders nothing when no toast is showing', () => {
    render(<ToastHost />);
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('renders the toast text after showToast', () => {
    render(<ToastHost />);
    act(() => {
      showToast('hello world');
    });
    const toast = screen.getByLabelText('toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('hello world');
  });

  it('auto-hides after the default duration', () => {
    render(<ToastHost />);
    act(() => {
      showToast('temporary');
    });
    expect(screen.getByLabelText('toast').textContent).toContain('temporary');
    act(() => {
      vi.advanceTimersByTime(DEFAULT_TOAST_MS + 1);
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('respects a custom durationMs', () => {
    render(<ToastHost />);
    act(() => {
      showToast('quick', 500);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByLabelText('toast').textContent).toContain('quick');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('a second showToast supersedes the first (no premature clear)', () => {
    render(<ToastHost />);
    act(() => {
      showToast('first', 1000);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // Replace before the first fades.
    act(() => {
      showToast('second', 1000);
    });
    // The first toast's fade-out (at +1000ms from its start = +200ms from now)
    // must NOT clear the second.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByLabelText('toast').textContent).toContain('second');
    // The second's own fade-out still runs.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });

  it('hideToast dismisses immediately', () => {
    render(<ToastHost />);
    act(() => {
      showToast('bye');
    });
    expect(screen.getByLabelText('toast')).toBeTruthy();
    act(() => {
      hideToast();
    });
    expect(screen.queryByLabelText('toast')).toBeNull();
  });
});
