// PermissionsScreen unit tests — design-spec §3a (Camera, Mic & Location) +
// §4.1.1 (Denied recovery state). Phase 2 plan 02-10, Task 2; Bug 3 / D4
// (2026-06-04) added precise Location as a third gated permission.
//
// Behaviour matrix:
//   1. Initial mount renders title / body / "Allow access" button verbatim.
//   2. Happy path → request CAMERA → RECORD_AUDIO (single) then location via
//      requestMultiple([FINE, COARSE]); FINE granted → setPermsGranted +
//      navigation.replace('Compat').
//   2b. BUG-1 (precise-only): a coarse-only "Approximate" grant (FINE denied,
//      COARSE granted) NO LONGER satisfies the gate → 'partial' recovery
//      naming Location (inverted from the old Bug-3 "coarse still passes").
//   3. All denied → 'denied' state with §4.1.1 recovery copy + "Open
//      Settings" CTA that calls openSettings().
//   4. Partial grants → 'partial' state naming the first missing permission
//      ("Microphone" / "Location").
//   5. BLOCKED is treated identically to DENIED (Open Settings is the only
//      recovery path).
//   6. Analytics: granted path fires *_granted events; denial fires *_denied
//      (camera / mic / location).
//
// Camera + Mic use `request(...)`; Location uses `requestMultiple([FINE, COARSE])`
// (Android needs both requested to show the Precise/Approximate dialog — BUG-1).
// Tests assert against the global `react-native-permissions` mock from
// vitest.setup.ts — overridden per-test with `mockResolvedValueOnce(...)`.

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import {
  request as rnpRequest,
  requestMultiple as rnpRequestMultiple,
  check as rnpCheck,
  openSettings as rnpOpenSettings,
  RESULTS,
  PERMISSIONS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';
import { AppState } from 'react-native';

// BUG-1 — the Android location-permission ids the screen's requestMultiple call
// targets (mirrors the real react-native-permissions PERMISSIONS.ANDROID values).
const FINE = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
const COARSE = PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION;

// ---------------------------------------------------------------------------
// Module-level mocks: navigation hook, app store action, analytics logger.
// ---------------------------------------------------------------------------
const mockReplace = vi.fn();
vi.mock('@react-navigation/native', async () => {
  // Keep the rest of the navigation surface (NavigationContainer, useRoute,
  // etc.) from vitest.setup.ts but override useNavigation to expose the
  // shared spy.
  //
  // BUG-1 — useNavigation MUST return a STABLE object across renders. The real
  // React Navigation useNavigation() memoizes its return value, so the screen's
  // useEffect([navigation, setPermsGranted]) runs once on mount (+ cleanup on
  // unmount), not on every render. A fresh object per render would flip the
  // [navigation] dep every render and spuriously re-run checkAndAdvance — which,
  // with the DENIED default check() mock, would clobber a freshly-set 'partial'
  // state into 'denied' (regressing Test 4's "names Microphone"). `nav` is built
  // lazily on first call (so `mockReplace` is initialized by then — no vi.mock
  // hoist TDZ) and memoized thereafter.
  let nav: Record<string, unknown> | undefined;
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      children as React.ReactElement,
    useNavigation: () =>
      (nav ??= {
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
// requestMultiple()'s real signature returns a FULL Record<Permission,
// PermissionStatus> (~200 Android perms). Our tests only supply the FINE/COARSE
// keys the screen reads, so re-type the mock to accept a PARTIAL map — avoids
// enumerating every permission in each mockResolvedValue literal below.
const requestMultipleMock = vi.mocked(rnpRequestMultiple) as unknown as MockedFunction<
  (perms: Permission[]) => Promise<Partial<Record<Permission, PermissionStatus>>>
>;
const checkMock = vi.mocked(rnpCheck);
const openSettingsMock = vi.mocked(rnpOpenSettings);

beforeEach(() => {
  mockReplace.mockReset();
  mockSetPermsGranted.mockReset();
  mockLogEvent.mockReset();
  requestMock.mockReset();
  // BUG-1 — location goes through requestMultiple now. Default: nothing granted
  // (an empty map → locResults[FINE] is undefined → not granted), overridden
  // per-test. Reset prevents a prior test's resolved value leaking.
  requestMultipleMock.mockReset().mockResolvedValue({});
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
    expect(titleNode.textContent).toBe('Camera, Mic\n& Location');

    const bodyNode = getByLabelText('permissions body');
    // Plan 03-11 (A1) — body tightened to a single runtime-tooltip line.
    expect(bodyNode.textContent).toBe('Used only while you hit record');

    // §3a CTA — verbatim, addressable by aria-label
    expect(getByLabelText('Allow access')).toBeTruthy();
  });

  it('Test 2: happy path — Camera + Mic + Precise Location granted → setPermsGranted + navigation.replace(Compat)', async () => {
    // Camera + Mic via request(); Location via requestMultiple([FINE, COARSE]).
    requestMock
      .mockResolvedValueOnce(RESULTS.GRANTED) // camera
      .mockResolvedValueOnce(RESULTS.GRANTED); // mic
    // "Precise" grant → both FINE + COARSE granted.
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.GRANTED,
      [COARSE]: RESULTS.GRANTED,
    });

    const { getByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('Compat');
    });

    // Sequential ordering: CAMERA → RECORD_AUDIO via request (modal OS prompt),
    // then Location via requestMultiple([FINE, COARSE]) (BUG-1 — both requested so
    // the OS shows the Precise/Approximate dialog; only FINE-granted passes).
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenNthCalledWith(1, PERMISSIONS.ANDROID.CAMERA);
    expect(requestMock).toHaveBeenNthCalledWith(2, PERMISSIONS.ANDROID.RECORD_AUDIO);
    expect(requestMultipleMock).toHaveBeenCalledTimes(1);
    expect(requestMultipleMock).toHaveBeenCalledWith([FINE, COARSE]);

    // Persisted via setPermsGranted with all three flags true + grantedAt ISO.
    expect(mockSetPermsGranted).toHaveBeenCalledTimes(1);
    const arg = mockSetPermsGranted.mock.calls[0]?.[0] as {
      camera: boolean;
      mic: boolean;
      location: boolean;
      grantedAt: string;
    };
    expect(arg.camera).toBe(true);
    expect(arg.mic).toBe(true);
    expect(arg.location).toBe(true);
    expect(typeof arg.grantedAt).toBe('string');
    // ISO 8601 round-trip
    expect(Number.isNaN(Date.parse(arg.grantedAt))).toBe(false);
  });

  it('Test 2b: BUG-1 (precise-only) — a coarse-only "Approximate" grant is REFUSED → partial recovery naming Location, NOT a pass', async () => {
    // Android 12+ "Approximate" pick: requestMultiple → FINE DENIED, COARSE
    // GRANTED. Pre-BUG-1 this satisfied the gate (location persisted true); now
    // it must NOT — only a FINE ("Precise") grant counts. Camera + Mic granted,
    // location coarse-only → the screen lands in 'partial' recovery naming
    // Location, does NOT navigate to Compat, and does NOT persist perms.
    requestMock
      .mockResolvedValueOnce(RESULTS.GRANTED) // camera
      .mockResolvedValueOnce(RESULTS.GRANTED); // mic
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.DENIED, // Precise refused
      [COARSE]: RESULTS.GRANTED, // only Approximate granted
    });

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // Partial recovery copy names Location (the only still-missing permission);
    // the gate did NOT pass.
    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toContain('Location');
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();
    // A coarse-only grant fires location_denied, not _granted.
    const events = mockLogEvent.mock.calls.map((c) => c[0]);
    expect(events).toContain('permission_location_denied');
    expect(events).not.toContain('permission_location_granted');
  });

  it('Test 3: all denied → §4.1.1 recovery copy + "Open Settings" CTA fires openSettings()', async () => {
    // Camera + Mic denied via request; Location denied via requestMultiple (both
    // FINE + COARSE denied) → the screen lands on the full-denial recovery copy.
    requestMock.mockResolvedValueOnce(RESULTS.DENIED).mockResolvedValueOnce(RESULTS.DENIED);
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.DENIED,
      [COARSE]: RESULTS.DENIED,
    });

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // After all denied results, the screen transitions to denied recovery
    // state — verify the body names all three (verbatim from §4.1.1), CTA is
    // "Open Settings", and navigation.replace was NOT called.
    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toBe(
      'Camera, Mic & Location are required. Open Settings to enable.',
    );

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

  it('Test 4: camera + location granted, mic denied → partial state names "Microphone"', async () => {
    // camera GRANTED, mic DENIED, location FINE GRANTED → partial; the first
    // still-missing permission (camera → mic → location) is the Microphone.
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.DENIED);
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.GRANTED,
      [COARSE]: RESULTS.GRANTED,
    });

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    const bodyNode = await findByLabelText('permissions body');
    // Partial state copy MUST name the missing permission so the user knows
    // which Settings toggle to flip. With camera+location granted + mic denied,
    // the missing one is the Microphone.
    expect(bodyNode.textContent).toContain('Microphone');
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();
  });

  it('Test 4b: camera + mic granted, location fully denied → partial state names "Location" (Bug 3 / D4)', async () => {
    // camera GRANTED, mic GRANTED, location fully denied (FINE + COARSE both
    // DENIED) → partial; the first still-missing permission is Location.
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.GRANTED);
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.DENIED,
      [COARSE]: RESULTS.DENIED,
    });

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toContain('Location');
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetPermsGranted).not.toHaveBeenCalled();
  });

  it('Test 5: BLOCKED is treated as denied — Open Settings is the only recovery', async () => {
    requestMock.mockResolvedValueOnce(RESULTS.BLOCKED).mockResolvedValueOnce(RESULTS.BLOCKED);
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.BLOCKED,
      [COARSE]: RESULTS.BLOCKED,
    });

    const { getByLabelText, findByLabelText } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));

    // BLOCKED on all three should land on the same full-denial recovery copy.
    const bodyNode = await findByLabelText('permissions body');
    expect(bodyNode.textContent).toBe(
      'Camera, Mic & Location are required. Open Settings to enable.',
    );
    expect(getByLabelText('Open Settings')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Test 6: analytics — granted path fires *_granted events; denial fires *_denied', async () => {
    // First: full grant → all three granted events (incl. location)
    requestMock.mockResolvedValueOnce(RESULTS.GRANTED).mockResolvedValueOnce(RESULTS.GRANTED);
    requestMultipleMock.mockResolvedValueOnce({
      [FINE]: RESULTS.GRANTED,
      [COARSE]: RESULTS.GRANTED,
    });

    const { getByLabelText, unmount } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText('Allow access'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());

    const eventNames = mockLogEvent.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain('permission_camera_requested');
    expect(eventNames).toContain('permission_camera_granted');
    expect(eventNames).toContain('permission_mic_requested');
    expect(eventNames).toContain('permission_mic_granted');
    expect(eventNames).toContain('permission_location_requested');
    expect(eventNames).toContain('permission_location_granted');
    expect(eventNames).not.toContain('permission_camera_denied');
    expect(eventNames).not.toContain('permission_mic_denied');
    expect(eventNames).not.toContain('permission_location_denied');

    // Reset and re-mount: full denial → all three denied events.
    unmount();
    mockLogEvent.mockReset();
    requestMock
      .mockReset()
      .mockResolvedValueOnce(RESULTS.DENIED)
      .mockResolvedValueOnce(RESULTS.BLOCKED);
    requestMultipleMock.mockReset().mockResolvedValueOnce({
      [FINE]: RESULTS.DENIED,
      [COARSE]: RESULTS.DENIED,
    });

    const { getByLabelText: getByLabelText2 } = render(<PermissionsScreen />);
    fireEvent.click(getByLabelText2('Allow access'));
    await waitFor(() => expect(mockLogEvent).toHaveBeenCalled());
    // Allow the third await (location) to resolve.
    await waitFor(() => {
      const names = mockLogEvent.mock.calls.map((c) => c[0]);
      expect(names).toContain('permission_location_denied');
    });

    const denyEventNames = mockLogEvent.mock.calls.map((c) => c[0]);
    expect(denyEventNames).toContain('permission_camera_denied');
    expect(denyEventNames).toContain('permission_mic_denied');
    expect(denyEventNames).toContain('permission_location_denied');
    expect(denyEventNames).not.toContain('permission_camera_granted');
    expect(denyEventNames).not.toContain('permission_mic_granted');
    expect(denyEventNames).not.toContain('permission_location_granted');
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

    // Step 1: user lands on screen, taps Allow, denies all three → 'denied'.
    requestMock
      .mockResolvedValueOnce(RESULTS.DENIED)
      .mockResolvedValueOnce(RESULTS.DENIED)
      .mockResolvedValueOnce(RESULTS.DENIED);
    // First check (mount) returns DENIED for all — user really hasn't
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
