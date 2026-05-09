// ProfileScreen — verifies design-spec §15 layout + PROF-01..05 contracts.
//
// Mocks: profileService (fetchMe / patchMe / fetchLifetimeContribution),
// AppFlavor native module (versionName/Code/flavor for the footer), and
// useNavigation (so the action rows' navigate calls are spy-assertable).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

const navigateFn = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: navigateFn }),
}));

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
});
