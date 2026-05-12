// bootRecoveryListener — Phase-5 D-07 regression coverage.
//
// D-07 reverted the crash-recovery toast duration from the 15s smoke-walk
// workaround back to 5s. These tests pin:
//   1. when recovery actually happened, the toast fires with the 5s duration
//      (RECOVERY_TOAST_MS === 5_000 — observed via the showToast mock arg);
//   2. an EMPTY `recovered` list ([]) → the listener no-ops cleanly (no toast,
//      no throw) — which, post-D-03, is the only thing CaptureLaunchSweep ever
//      reports, so this listener is effectively dead code kept as a safety net.
//
// HumynCapture + Toast are mocked so this is a plain non-React unit test —
// the broader two-channel / Toast-host behaviour is covered by
// __tests__/screens/recording/crashRecoveryToast.test.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockShowToast, mockGetPendingRecovery, mockOnCrashRecovery, eventListenerRef } = vi.hoisted(
  () => ({
    mockShowToast: vi.fn(),
    mockGetPendingRecovery: vi.fn<() => Promise<{ recovered: unknown }>>(),
    mockOnCrashRecovery: vi.fn((listener: (e: { recovered: unknown }) => void) => {
      eventListenerRef.current = listener;
      return { remove: vi.fn() };
    }),
    eventListenerRef: { current: null as null | ((e: { recovered: unknown }) => void) },
  }),
);

vi.mock('../../src/native/HumynCapture', () => ({
  getPendingRecovery: mockGetPendingRecovery,
  onCrashRecovery: mockOnCrashRecovery,
}));

vi.mock('../../src/components/Toast', () => ({
  showToast: mockShowToast,
}));

import {
  installBootRecoveryListener,
  CRASH_RECOVERY_TOAST,
} from '../../src/boot/bootRecoveryListener';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  eventListenerRef.current = null;
});

describe('bootRecoveryListener — D-07 (5s toast duration)', () => {
  it('recovery happened → showToast fires with the recovery copy and a 5_000 ms duration (RECOVERY_TOAST_MS reverted from 15_000)', async () => {
    mockGetPendingRecovery.mockResolvedValue({ recovered: ['20260512_001'] });

    const teardown = installBootRecoveryListener();
    await flush();

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(CRASH_RECOVERY_TOAST, 5_000);
    teardown();
  });

  it('empty recovered list ([]) → no toast, no throw (post-D-03 this is the only thing CaptureLaunchSweep ever reports — dead-code safety net)', async () => {
    mockGetPendingRecovery.mockResolvedValue({ recovered: [] });

    const teardown = installBootRecoveryListener();
    await flush();

    expect(mockShowToast).not.toHaveBeenCalled();
    // The legacy event channel also reporting [] must not toast either.
    eventListenerRef.current?.({ recovered: [] });
    await flush();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(() => teardown()).not.toThrow();
  });

  it('a malformed recovered payload (not a string[]) → no toast', async () => {
    mockGetPendingRecovery.mockResolvedValue({ recovered: [1, 2, 3] });

    const teardown = installBootRecoveryListener();
    await flush();

    expect(mockShowToast).not.toHaveBeenCalled();
    teardown();
  });

  it("getPendingRecovery rejecting (native module not registered) → boot doesn't crash, event channel still wired", async () => {
    mockGetPendingRecovery.mockRejectedValue(new Error('HumynCapture not registered'));

    const teardown = installBootRecoveryListener();
    await flush();

    expect(mockShowToast).not.toHaveBeenCalled();
    // The one-shot event channel is the fallback — drive it with a real recovery.
    eventListenerRef.current?.({ recovered: ['20260512_002'] });
    await flush();
    expect(mockShowToast).toHaveBeenCalledWith(CRASH_RECOVERY_TOAST, 5_000);
    teardown();
  });
});
