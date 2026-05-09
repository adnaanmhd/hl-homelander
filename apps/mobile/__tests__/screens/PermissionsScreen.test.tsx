// PermissionsScreen unit tests — design-spec §3a (Camera & Mic) + §4.1.1
// (Denied recovery state). Phase 2 plan 02-10, Task 2.
//
// Behaviour matrix:
//   1. Initial mount renders title / body / "Allow access" button verbatim.
//   2. Happy path → request CAMERA then RECORD_AUDIO sequentially; both
//      granted → setPermsGranted persisted + navigation.replace('Compat').
//   3. Camera denied → 'denied' state with §4.1.1 recovery copy + "Open
//      Settings" CTA that calls openSettings().
//   4. Camera granted but mic denied → 'partial' state — copy specifies the
//      missing permission ("Microphone").
//   5. BLOCKED is treated identically to DENIED (Open Settings is the only
//      recovery path).
//   6. Analytics: granted path fires *_granted events; denial fires *_denied.
//
// The screen is the *only* call site of `request(PERMISSIONS.ANDROID.CAMERA)`
// + `request(PERMISSIONS.ANDROID.RECORD_AUDIO)` in the Phase 2 codebase, so
// tests assert against the global `react-native-permissions` mock from
// vitest.setup.ts — overridden per-test with `vi.mocked(request)
// .mockResolvedValueOnce(...)`.

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  request as rnpRequest,
  openSettings as rnpOpenSettings,
  RESULTS,
  PERMISSIONS,
} from 'react-native-permissions';

// ---------------------------------------------------------------------------
// Module-level mocks: navigation hook, app store action, analytics logger.
// ---------------------------------------------------------------------------
const mockReplace = vi.fn();
vi.mock('@react-navigation/native', async () => {
  // Keep the rest of the navigation surface (NavigationContainer, useRoute,
  // etc.) from vitest.setup.ts but override useNavigation to expose the
  // shared spy.
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    useNavigation: () => ({
      replace: mockReplace,
      reset: vi.fn(),
      navigate: vi.fn(),
      goBack: vi.fn(),
      push: vi.fn(),
      pop: vi.fn(),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: (cb: () => void) => cb(),
    useIsFocused: () => true,
  };
});

const mockSetPermsGranted = vi.fn();
vi.mock('../../src/state/appStore', () => ({
  useAppStore: (selector: (s: { setPermsGranted: typeof mockSetPermsGranted }) => unknown) =>
    selector({ setPermsGranted: mockSetPermsGranted }),
}));

const mockLogEvent = vi.fn();
vi.mock('../../src/util/analytics', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  EVENT_NAMES: [],
}));

// Import the screen AFTER vi.mock declarations so the mocked modules win.
import PermissionsScreen from '../../src/screens/permissions/PermissionsScreen';

const requestMock = vi.mocked(rnpRequest);
const openSettingsMock = vi.mocked(rnpOpenSettings);

beforeEach(() => {
  mockReplace.mockReset();
  mockSetPermsGranted.mockReset();
  mockLogEvent.mockReset();
  requestMock.mockReset();
  openSettingsMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('PermissionsScreen', () => {
  it('Test 1: initial mount renders verbatim §3a copy + "Allow access" CTA', () => {
    const { getByText, getByLabelText } = render(<PermissionsScreen />);
    // §3a Title — newline-joined per design-spec
    expect(getByText('Camera & Mic\nPermissions')).toBeTruthy();
    // §3a Body — verbatim
    expect(
      getByText(
        'Used only while you hit record. Nothing leaves your phone until you stop and we encrypt-upload.',
      ),
    ).toBeTruthy();
    // §3a CTA — verbatim, addressable by aria-label
    expect(getByLabelText('Allow access')).toBeTruthy();
  });

  it('Test 2: happy path — Camera + Mic granted sequentially → setPermsGranted + navigation.replace(Compat)', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.GRANTED);

    const { getByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('Compat');
    });

    // Sequential ordering: CAMERA before RECORD_AUDIO (the OS prompt is
    // modal — they can't be requested concurrently).
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(1, PERMISSIONS.ANDROID.CAMERA);
    expect(requestMock).toHaveBeenNthCalledWith(2, PERMISSIONS.ANDROID.RECORD_AUDIO);

    // Persisted via setPermsGranted with both flags true + grantedAt ISO string.
    expect(mockSetPermsGranted).toHaveBeenCalledTimes(1);
    const arg = mockSetPermsGranted.mock.calls[0]?.[0] as {
      camera: boolean;
      mic: boolean;
      grantedAt: string;
    };
    expect(arg.camera).toBe(true);
    expect(arg.mic).toBe(true);
    expect(typeof arg.grantedAt).toBe('string');
    // ISO 8601 round-trip
    expect(Number.isNaN(Date.parse(arg.grantedAt))).toBe(false);
  });

  it('Test 3: camera denied → §4.1.1 recovery copy + "Open Settings" CTA fires openSettings()', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.DENIED).mockResolvedValueOnce(RESULTS.DENIED);

    const { getByLabelText, findByText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // After both denied results, the screen transitions to denied recovery
    // state — verify the body says Camera & Mic are required, CTA is "Open
    // Settings", and navigation.replace was NOT called.
    await findByText(/Camera & Mic are required/i);
    const settingsBtn = getByLabelText('Open Settings');
    expect(settingsBtn).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();

    // Tap "Open Settings" → calls openSettings().
    fireEvent.click(settingsBtn);
    await waitFor(() => {
      expect(openSettingsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('Test 4: camera granted, mic denied → partial state names "Microphone" as the missing perm', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.DENIED);

    const { getByLabelText, findByText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    await findByText(/Microphone/);
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();
  });

  it('Test 5: BLOCKED is treated as denied — Open Settings is the only recovery', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.BLOCKED).mockResolvedValueOnce(RESULTS.BLOCKED);

    const { getByLabelText, findByText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    await findByText(/Camera & Mic are required/i);
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Test 6: analytics — granted path fires *_granted events; denial fires *_denied', async () => {
    // First: full grant → both granted events
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.GRANTED);

    const { getByLabelText, unmount } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    const eventNames = mockLogEvent.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain('permission_camera_requested');
    expect(eventNames).toContain('permission_camera_granted');
    expect(eventNames).toContain('permission_mic_requested');
    expect(eventNames).toContain('permission_mic_granted');
    expect(eventNames).not.toContain('permission_camera_denied');
    expect(eventNames).not.toContain('permission_mic_denied');

    // Reset and re-mount: full denial → both denied events.
    unmount();
    mockLogEvent.mockReset();
    requestMock
      .mockReset()
      .mockResolvedValueOnce(RESULTS.DENIED)
      .mockResolvedValueOnce(RESULTS.BLOCKED);

    const { getByLabelText: getByLabelText2 } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText2('Allow access'));
    await waitFor(() => expect(mockLogEvent).toHaveBeenCalled());
    // Allow the second await (mic) to resolve.
    await waitFor(() => {
      const names = mockLogEvent.mock.calls.map((c) => c[0]);
      expect(names).toContain('permission_mic_denied');
    });

    const denyEventNames = mockLogEvent.mock.calls.map((c) => c[0]);
    expect(denyEventNames).toContain('permission_camera_denied');
    expect(denyEventNames).toContain('permission_mic_denied');
    expect(denyEventNames).not.toContain('permission_camera_granted');
    expect(denyEventNames).not.toContain('permission_mic_granted');
  });
});
