// ProfileScreen — verifies design-spec §15 layout + PROF-01..05 contracts.
//
// Mocks: profileService (fetchMe / patchMe / fetchLifetimeContribution),
// AppFlavor native module (versionName/Code/flavor for the footer), and
// useNavigation (so the action rows' navigate calls are spy-assertable).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

const navigateFn = vi.fn();
vi.mock('@react-navigation/native', async () => {
  // Bug 10 — ProfileScreen now loads via useFocusEffect (refetch-on-focus so a
  // transient /contributions failure self-heals). The real useFocusEffect runs
  // its callback in a POST-render effect; mirror that with React.useEffect so a
  // callback that setState synchronously (loadLifetime → setLifetimeStatus)
  // doesn't loop. `cb` is useCallback-stable, so it runs once per focus.
  const ReactM = await import('react');
  return {
    useNavigation: () => ({ navigate: navigateFn }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactM.useEffect(() => cb(), [cb]);
    },
  };
});

// AppFlavor native module — supply a known (versionName, versionCode, flavor)
// triple so the PROF-05 footer string is deterministic.
vi.mock('../../src/native/AppFlavor', () => ({
  getFlavorContext: () => ({
    flavor: 'apkRollout',
    applicationId: 'ai.humynlabs.capture.apk',
    versionName: '0.1.0',
    versionCode: 1,
    deviceModel: 'Test',
  }),
}));

const fetchMeMock = vi.fn();
const patchMeMock = vi.fn();
const fetchContribMock = vi.fn();
vi.mock('../../src/services/profileService', () => ({
  fetchMe: (...a: unknown[]) => fetchMeMock(...a),
  patchMe: (...a: unknown[]) => patchMeMock(...a),
  fetchLifetimeContribution: (...a: unknown[]) => fetchContribMock(...a),
}));

import { ProfileScreen } from '../../src/screens/profile/ProfileScreen';

const ME_FIXTURE = {
  id: '1',
  email: 'a@b.c',
  name: 'Adnaan',
  age: 28,
  gender: null,
  avatarUrl: null,
  consentVersion: 'v1',
  flavor: 'apkRollout' as const,
  applicationId: 'ai.humynlabs.capture.apk',
  deletedAt: null,
  deleteGraceUntil: null,
  createdAt: '2026-05-01T00:00:00Z',
};

beforeEach(() => {
  navigateFn.mockClear();
  fetchMeMock.mockReset();
  patchMeMock.mockReset();
  fetchContribMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ProfileScreen', () => {
  it('renders fetched name + lifetime numeric + Payments verbatim copy + footer', async () => {
    fetchMeMock.mockResolvedValue(ME_FIXTURE);
    fetchContribMock.mockResolvedValue({ totalSeconds: 7440, taskCount: 12 });
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByLabelText('Profile screen')).toBeTruthy());
    // PROF-03 — formatted lifetime via durationFormatter (7440s = 2h 4m).
    expect(screen.getByText('2h 4m')).toBeTruthy();
    expect(screen.getByText('Across 12 tasks')).toBeTruthy();
    // PROF-02 — Payments title + verbatim body.
    expect(screen.getByText('Payments & Earnings')).toBeTruthy();
    expect(screen.getByText(/Payouts process offline/)).toBeTruthy();
    // PROF-05 — footer is queryable by label.
    expect(screen.getByLabelText('profile-footer')).toBeTruthy();
  });

  it('tapping Help Center entry navigates to HelpCenter (PROF-04)', async () => {
    fetchMeMock.mockResolvedValue({ ...ME_FIXTURE, age: null });
    fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
    render(<ProfileScreen />);
    await waitFor(() => screen.getByLabelText('profile-action-help'));
    fireEvent.click(screen.getByLabelText('profile-action-help'));
    expect(navigateFn).toHaveBeenCalledWith('HelpCenter');
  });

  it('tapping Logout opens LogoutModal route (PROF-04)', async () => {
    fetchMeMock.mockResolvedValue({ ...ME_FIXTURE, age: null });
    fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
    render(<ProfileScreen />);
    await waitFor(() => screen.getByLabelText('profile-action-logout'));
    fireEvent.click(screen.getByLabelText('profile-action-logout'));
    expect(navigateFn).toHaveBeenCalledWith('LogoutModal');
  });

  it('tapping Delete account opens DeleteAccountModal route (PROF-04 / AUTH-09)', async () => {
    fetchMeMock.mockResolvedValue({ ...ME_FIXTURE, age: null });
    fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
    render(<ProfileScreen />);
    await waitFor(() => screen.getByLabelText('profile-action-delete'));
    fireEvent.click(screen.getByLabelText('profile-action-delete'));
    expect(navigateFn).toHaveBeenCalledWith('DeleteAccountModal');
  });

  // ---------------------------------------------------------------------
  // Bug 10 — profile no longer all-or-nothing: `/me` renders the screen
  // immediately; the lifetime block loads independently with a deadline.
  // ---------------------------------------------------------------------

  it('renders off /me immediately while /contributions is still loading — spinner, not a whole-screen stall (Bug 10)', async () => {
    fetchMeMock.mockResolvedValue(ME_FIXTURE);
    // /contributions never resolves during the test.
    fetchContribMock.mockReturnValue(new Promise<never>(() => {}));
    render(<ProfileScreen />);
    // The full screen renders off /me (the Payments card only exists past the
    // whole-screen loading gate).
    expect(await screen.findByText('Payments & Earnings')).toBeTruthy();
    // The lifetime block shows its own spinner...
    expect(screen.getByLabelText('profile-lifetime-loading')).toBeTruthy();
    // ...and the whole-screen "Loading…" gate is gone (no infinite stall).
    expect(screen.queryByLabelText('profile-loading')).toBeNull();
  });

  it('a /contributions failure shows error + Retry; Retry refetches and renders the numeric (Bug 10)', async () => {
    fetchMeMock.mockResolvedValue(ME_FIXTURE);
    fetchContribMock.mockRejectedValueOnce(new Error('boom'));
    render(<ProfileScreen />);
    // Error + Retry shown in the lifetime block (never an infinite spinner).
    expect(await screen.findByLabelText('profile-lifetime-error')).toBeTruthy();
    expect(screen.getByLabelText('profile-lifetime-retry')).toBeTruthy();
    expect(screen.queryByLabelText('profile-loading')).toBeNull();
    // Retry with a now-successful fetch → the numeric appears (7440s = 2h 4m).
    fetchContribMock.mockResolvedValueOnce({ totalSeconds: 7440, taskCount: 12 });
    fireEvent.click(screen.getByLabelText('profile-lifetime-retry'));
    expect(await screen.findByText('2h 4m')).toBeTruthy();
  });

  it('a hanging /contributions hits the 13s deadline → error + Retry (Bug 10)', async () => {
    vi.useFakeTimers();
    try {
      const { act } = await import('@testing-library/react');
      fetchMeMock.mockResolvedValue(ME_FIXTURE);
      fetchContribMock.mockReturnValue(new Promise<never>(() => {})); // hangs forever
      render(<ProfileScreen />);
      // Flush the /me microtask so the screen renders off /me.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByLabelText('profile-lifetime-loading')).toBeTruthy();
      // Advance past the 13s UX deadline → the block flips to error + Retry.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(13_000);
      });
      expect(screen.getByLabelText('profile-lifetime-error')).toBeTruthy();
      expect(screen.getByLabelText('profile-lifetime-retry')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches the lifetime block when contributionsVersion bumps (Bug 11)', async () => {
    vi.useFakeTimers();
    try {
      const { act } = await import('@testing-library/react');
      const { useAppStore } = await import('../../src/state/appStore');
      fetchMeMock.mockResolvedValue(ME_FIXTURE);
      fetchContribMock.mockResolvedValue({ totalSeconds: 0, taskCount: 0 });
      render(<ProfileScreen />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(fetchContribMock).toHaveBeenCalledTimes(1);
      // Simulate an upload-queue mutation: bump the version. The debounced
      // effect (~1.5s) then refetches the lifetime aggregate.
      fetchContribMock.mockResolvedValue({ totalSeconds: 7440, taskCount: 12 });
      await act(async () => {
        useAppStore.getState().bumpContributionsVersion();
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(fetchContribMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('2h 4m')).toBeTruthy();
    } finally {
      // Reset the bumped store counter so other tests start clean.
      const { useAppStore } = await import('../../src/state/appStore');
      useAppStore.setState({ contributionsVersion: 0 });
      vi.useRealTimers();
    }
  });
});
