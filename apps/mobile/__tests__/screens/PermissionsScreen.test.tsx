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
  check as rnpCheck,
  openSettings as rnpOpenSettings,
  RESULTS,
  PERMISSIONS,
} from 'react-native-permissions';
import { AppState } from 'react-native';

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
const checkMock = vi.mocked(rnpCheck);
const openSettingsMock = vi.mocked(rnpOpenSettings);

beforeEach(() => {
  mockReplace.mockReset();
  mockSetPermsGranted.mockReset();
  mockLogEvent.mockReset();
  requestMock.mockReset();
  openSettingsMock.mockReset();
  // quick-260510-007 — useEffect calls check() on mount + on AppState
  // 'change'. Default to DENIED so existing tests (which never grant via
  // Settings) don't trigger the auto-advance path; tests that exercise the
  // Settings-round-trip override per-test with mockResolvedValueOnce.
  checkMock.mockReset().mockResolvedValue(RESULTS.DENIED);
});

afterEach(() => {
  cleanup();
});

describe('PermissionsScreen', () => {
  it('Test 1: initial mount renders verbatim §3a copy + "Allow access" CTA', () => {
    const { getByLabelText } = render(<PermissionsScreen />);
    // §3a Title — newline-joined per design-spec. testing-library's text
    // matcher normalizes whitespace, so query by aria-label and assert on
    // raw textContent to preserve the embedded \n.
    const titleNode = getByLabelText('permissions title');
    expect(titleNode.textContent).toBe('Camera & Mic\nPermissions');

    const bodyNode = getByLabelText('permissions body');
    // Plan 03-11 (A1) — body tightened to a single runtime-tooltip line.
    expect(bodyNode.textContent).toBe('Used only while you hit record');

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

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // After both denied results, the screen transitions to denied recovery
    // state — verify the body says Camera & Mic are required (verbatim from
    // §4.1.1), CTA is "Open Settings", and navigation.replace was NOT called.
    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toBe('Camera & Mic are required. Open Settings to enable.');

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

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    const bodyNode = await findByLabelText('permissions body');
    // Partial state copy MUST name the missing permission so the user knows
    // which Settings toggle to flip. With camera granted + mic denied, the
    // missing one is the Microphone.
    expect(bodyNode.textContent).toContain('Microphone');
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();
  });

  it('Test 5: BLOCKED is treated as denied — Open Settings is the only recovery', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.BLOCKED).mockResolvedValueOnce(RESULTS.BLOCKED);

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // BLOCKED on both should land on the same denied-recovery copy as DENIED.
    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toBe('Camera & Mic are required. Open Settings to enable.');
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

  // quick-260510-007 — Settings round-trip re-check.
  //
  // The original bug: handlePress called openSettings() and returned without
  // any path back. Once the user came back from Android Settings (where they
  // granted what they had previously denied), the screen stayed in 'denied'
  // / 'partial' state with the "Open Settings" button — they never advanced
  // to Compat. Fix: AppState 'change' listener re-checks both perms via
  // check() and auto-advances on both-granted.
  //
  // Test asserts:
  //   - Initial mount also calls check() (covers Path B/C cold-start gates
  //     where the user lands here with perms already granted from a prior
  //     Settings round-trip).
  //   - On 'active' AppState transition, check() runs again.
  //   - When both perms read GRANTED post-foreground, setPermsGranted +
  //     navigation.replace('Compat') fire — the same advance contract as
  //     the happy-path flow.
  it('Test 7 (quick-260510-007): foreground re-check after Settings round-trip auto-advances when both perms now granted', async () => {
    // Capture the AppState listener so we can fire 'active' synthetically.
    // Use `unknown` then narrow at the call site — RN's AppState typing is
    // strict (AppStateStatus type), but we only need the runtime contract:
    // `addEventListener('change', cb)` returns an object with `.remove()`.
    let appStateListener: ((next: string) => void) | undefined;
    const addEventListenerSpy = vi.spyOn(AppState, 'addEventListener').mockImplementation(((
      event: unknown,
      listener: unknown,
    ) => {
      if (event === 'change') appStateListener = listener as (n: string) => void;
      return { remove: () => undefined };
    }) as unknown as typeof AppState.addEventListener);

    // Step 1: user lands on screen, taps Allow, denies both → 'denied' state.
    requestMock.mockResolvedValueOnce(RESULTS.DENIED).mockResolvedValueOnce(RESULTS.DENIED);
    // First check (mount) returns DENIED for both — user really hasn't
    // granted yet, so no auto-advance, screen stays mounted.
    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));
    await findByLabelText('Open Settings');
    expect(mockReplace).not.toHaveBeenCalled();

    // Step 2: user taps Open Settings → openSettings() fires.
    fireEvent.click(getByLabelText('Open Settings'));
    await waitFor(() => expect(openSettingsMock).toHaveBeenCalledTimes(1));

    // Reset call counts to scope the assertion to the specific bug we are
    // fixing — the foreground re-check after the Settings round-trip. Mount-
    // time check + any strict-mode double-mount artifacts are irrelevant to
    // the property under test here.
    mockSetPermsGranted.mockClear();
    mockReplace.mockClear();

    // Step 3: user grants Camera + Mic via Android Settings, returns to app.
    // AppState fires 'change' → 'active'. The mocked check() now returns
    // GRANTED for both. The listener re-checks, both granted → setPermsGranted
    // + navigation.replace('Compat'). This is the exact path that was broken
    // pre-fix (where openSettings() returned and the screen stayed locked).
    checkMock.mockResolvedValue(RESULTS.GRANTED);
    expect(appStateListener).toBeDefined();
    appStateListener?.('active');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Compat'));
    expect(mockSetPermsGranted).toHaveBeenCalled();
    const arg = mockSetPermsGranted.mock.calls[0]?.[0] as {
      camera: boolean;
      mic: boolean;
    };
    expect(arg.camera).toBe(true);
    expect(arg.mic).toBe(true);

    addEventListenerSpy.mockRestore();
  });

  it('Test 8 (quick-260510-007): initial mount auto-advances when perms are already granted (cold-start gate B/C)', async () => {
    // Cold-start path: user previously granted both via Settings, killed
    // the app, then re-launched. Splash routed them here (e.g. permsGranted
    // MMKV key was never set on the original deny). useEffect on mount
    // re-checks; both granted → auto-advance to Compat without requiring
    // another button tap.
    checkMock.mockResolvedValue(RESULTS.GRANTED);
    render(<PermissionsScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('Compat'));
    expect(mockSetPermsGranted).toHaveBeenCalledTimes(1);
    // request() was NOT called — auto-advance bypasses the OS prompt
    // entirely since the perms are already granted.
    expect(requestMock).not.toHaveBeenCalled();
  });
});
