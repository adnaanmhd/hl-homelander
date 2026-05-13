// uploadToastBus — Plan 05-14 Task 9 / Wave-1.5 Item 5.
//
// One-shot deliver-on-Home holder for the post-recording contribution toast.
// RecordingScreen sets the message before `navigateToHome`; HomeSkeletonScreen
// drains it on mount and fires the global ToastHost via `showToast`.
//
// Coverage:
//   - set then drain returns the payload
//   - second drain returns null (one-shot)
//   - default duration is 5000 ms when omitted
//   - test hatch resets the bus state

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UPLOAD_TOAST_MS,
  drainPendingUploadToast,
  setPendingUploadToast,
  __test_resetUploadToastBus,
} from '../../src/state/uploadToastBus';

describe('uploadToastBus (Plan 05-14 — Wave-1.5 Item 5)', () => {
  beforeEach(() => {
    __test_resetUploadToastBus();
  });

  it('setPendingUploadToast then drainPendingUploadToast returns the payload', () => {
    setPendingUploadToast('foo', 5000);
    expect(drainPendingUploadToast()).toEqual({ text: 'foo', durationMs: 5000 });
  });

  it('a second drainPendingUploadToast returns null (one-shot)', () => {
    setPendingUploadToast('foo', 5000);
    drainPendingUploadToast();
    expect(drainPendingUploadToast()).toBeNull();
  });

  it('drainPendingUploadToast returns null when nothing was set', () => {
    expect(drainPendingUploadToast()).toBeNull();
  });

  it('default durationMs is DEFAULT_UPLOAD_TOAST_MS (5000) when omitted', () => {
    setPendingUploadToast('foo');
    const drained = drainPendingUploadToast();
    expect(drained?.durationMs).toBe(DEFAULT_UPLOAD_TOAST_MS);
    expect(drained?.durationMs).toBe(5_000);
  });

  it('__test_resetUploadToastBus clears any pending value', () => {
    setPendingUploadToast('foo', 5000);
    __test_resetUploadToastBus();
    expect(drainPendingUploadToast()).toBeNull();
  });

  it('a second set overwrites the first (last-write-wins until drain)', () => {
    setPendingUploadToast('first', 1000);
    setPendingUploadToast('second', 2000);
    expect(drainPendingUploadToast()).toEqual({ text: 'second', durationMs: 2000 });
  });
});
