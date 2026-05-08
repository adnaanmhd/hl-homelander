// Phase 1 SignIn screen test — asserts that the button labelled
// "Continue with Google" is rendered, that pressing it calls
// signInWithGoogle(), that the Welcome view appears on success, and that
// thrown errors surface as visible error text. The auth service itself is
// mocked entirely so MMKV/GoogleSignin/Keychain transitively never load
// inside the test runtime.
//
// Implementation note: the React Native runtime (View/Text/Pressable) is
// stubbed in vitest.setup.ts so our SignIn component renders to plain DOM
// elements. We use @testing-library/react (the DOM variant) here, NOT
// @testing-library/react-native (which expects the real host-component
// infrastructure). aria-label / role attributes from the shim map to the
// DOM, so component contracts (accessibility) are still asserted.
import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/services/auth', () => ({
  signInWithGoogle: vi.fn(),
  getStoredJwt: vi.fn(() => undefined),
  clearStoredJwt: vi.fn(),
}));

import SignIn from '../src/screens/SignIn';
import { signInWithGoogle } from '../src/services/auth';

describe('SignIn screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders the Continue with Google button', () => {
    const { getByLabelText } = render(<SignIn />);
    expect(getByLabelText('Continue with Google')).toBeTruthy();
  });

  it('on button press → calls signInWithGoogle and shows Welcome on success', async () => {
    (signInWithGoogle as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      jwt: 'fake.jwt.token',
      user: {
        id: '01HVFAKE0000000000000000US',
        email: 'tester@example.com',
        name: 'Tester',
        avatarUrl: null,
      },
    });
    const { getByLabelText, findByText } = render(<SignIn />);
    fireEvent.click(getByLabelText('Continue with Google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(await findByText('Welcome, Tester')).toBeTruthy();
  });

  it('on signInWithGoogle rejection → shows error message', async () => {
    (signInWithGoogle as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('integrity-rooted'),
    );
    const { getByLabelText, findByText } = render(<SignIn />);
    fireEvent.click(getByLabelText('Continue with Google'));
    expect(await findByText('integrity-rooted')).toBeTruthy();
  });
});
