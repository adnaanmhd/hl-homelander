// TermsOfUseModal — quick task 260527-hkl Task 1.
//
// Behaviour matrix (7 tests, RED → GREEN per plan):
//   Test 1: visible=true → sticky banner (consent-scroll-banner) renders ABOVE
//           the scrollable body, with the localized "Scroll to the bottom and
//           tap on I Agree after reading." copy. Title "Terms of Use" present.
//   Test 2: Agree button starts disabled (opacity 0.4 + no onClick wired).
//   Test 3: firing onScroll on the inner ScrollView (consent-scroll-body) at
//           bottom (y + h >= contentSize - 4) enables Agree; a subsequent
//           scroll back up keeps it enabled (sticky).
//   Test 4: tapping Agree AFTER it's enabled invokes onAgree exactly once.
//   Test 5: pressing the Privacy Policy link calls
//           Linking.openURL('https://humynlabs.ai/privacy-policy') once.
//   Test 6: while visible=true, BackHandler.addEventListener is called and the
//           registered handler returns true (back blocked); when visible flips
//           to false the subscription is removed.
//   Test 7: no element with accessibilityLabel="close-button" or a button-role
//           "Close"/"X" renders (non-dismissable invariant).
//
// Plus the legacy invariants we must NOT regress:
//   - TERMS_OF_USE_TEXT export byte-identical (LEGAL-02 audit-trail constant).
//   - Bilingual D-32 underlay still renders on non-English locales.
//
// Tests run under JSDOM with the host-component shim from vitest.setup.ts; the
// RN <Modal> primitive collapses to a pass-through <div>. The shim's react-
// native mock above forwards Linking + BackHandler as no-op stubs; this file
// overrides them via vi.mocked() so we can spy on the calls.

import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as RN from 'react-native';

import { TermsOfUseModal, TERMS_OF_USE_TEXT } from '../../src/screens/signup/TermsOfUseModal';
import i18n from '../../src/i18n';

const CANONICAL_TEXT =
  'I consent and agree to upload videos of myself and/or others who consent to be recorded; ' +
  'performing certain daily activities/tasks. This content will be used to develop / train AI ' +
  'models and for research purposes. I confirm that I am 18 years or older and have the ' +
  'necessary permissions to share this content. I confirm that no one being recorded is a minor. ' +
  'I consent to my precise location (GPS coordinates) and IP address being captured alongside each recording. ' +
  "I understand that my data will be stored securely and used in accordance with Humyn's " +
  'Privacy Policy.';

describe('TermsOfUseModal (quick 260527-hkl Task 1 — auto-open + scroll-gated Agree)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  // ---------------------------------------------------------------------------
  // Test 1 — sticky banner renders above the scrollable body
  // ---------------------------------------------------------------------------
  it('Test 1: visible=true → renders title "Terms of Use" + sticky scroll banner above body', () => {
    const { getByText, getByLabelText } = render(
      <TermsOfUseModal visible={true} onAgree={() => {}} />,
    );
    expect(getByText('Terms of Use')).toBeTruthy();
    const banner = getByLabelText('consent-scroll-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Scroll to the bottom and tap on I Agree after reading.');
    // The banner must precede the scrollable body in document order (sticky
    // above the scroll area).
    const body = getByLabelText('consent-scroll-body');
    const compare = banner.compareDocumentPosition(body);
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(compare & 4).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // Test 2 — Agree button starts disabled (opacity 0.4 + no onClick wired)
  // ---------------------------------------------------------------------------
  it('Test 2: Agree button starts disabled (opacity ≈0.4 + click is a no-op)', () => {
    const onAgree = vi.fn();
    const { getByLabelText } = render(<TermsOfUseModal visible={true} onAgree={onAgree} />);
    const agreeBtn = getByLabelText('consent-agree-button');
    // The host-component shim resolves the style array; the Button primitive
    // applies opacity:0.4 when disabled. The wrapping Pressable receives the
    // computed style.
    const styleAttr = agreeBtn.getAttribute('style') ?? '';
    expect(styleAttr).toMatch(/opacity:\s*0\.4/);
    // Click is a no-op (Button passes `onPress={disabled ? undefined : onPress}`
    // so the shim never installs onClick on the DOM).
    fireEvent.click(agreeBtn);
    expect(onAgree).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Test 3 — onScroll to bottom enables Agree; back-up scroll keeps it enabled
  // ---------------------------------------------------------------------------
  it('Test 3: scrolling to bottom enables Agree; sticky once enabled', () => {
    const onAgree = vi.fn();
    const { getByLabelText } = render(<TermsOfUseModal visible={true} onAgree={onAgree} />);
    const body = getByLabelText('consent-scroll-body');
    // Fire the bottom-reached scroll: y + h >= contentSize.height - 4. The
    // standard DOM Event constructor doesn't preserve arbitrary EventInit
    // props, so we manually build a scroll Event and attach the RN-shape
    // payload directly (the jsdom shim hands the React `onScroll` prop the
    // raw DOM event; the modal's handler is shaped to accept both RN
    // SyntheticEvent and plain DOM event payloads).
    const fireScroll = (y: number) => {
      act(() => {
        const evt = new Event('scroll', { bubbles: true });
        Object.assign(evt, {
          contentOffset: { y },
          layoutMeasurement: { height: 400 },
          contentSize: { height: 1198 },
        });
        body.dispatchEvent(evt);
      });
    };
    fireScroll(800); // 800 + 400 = 1200 ≥ 1198 - 4 → enable
    const agreeBtn = getByLabelText('consent-agree-button');
    // Once enabled, the opacity:0.4 style is removed (Button primitive applies
    // opacity:1 when disabled=false).
    let styleAttr = agreeBtn.getAttribute('style') ?? '';
    expect(styleAttr).not.toMatch(/opacity:\s*0\.4/);
    // Tapping fires onAgree.
    fireEvent.click(agreeBtn);
    expect(onAgree).toHaveBeenCalledTimes(1);
    // Scroll back up — Agree must stay enabled (sticky).
    fireScroll(0);
    styleAttr = agreeBtn.getAttribute('style') ?? '';
    expect(styleAttr).not.toMatch(/opacity:\s*0\.4/);
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Agree click after enabled invokes onAgree exactly once
  // (combined with Test 3's click; this one isolates the click contract).
  // ---------------------------------------------------------------------------
  it('Test 4: tapping Agree once after enable invokes onAgree exactly once', () => {
    const onAgree = vi.fn();
    const { getByLabelText } = render(<TermsOfUseModal visible={true} onAgree={onAgree} />);
    const body = getByLabelText('consent-scroll-body');
    act(() => {
      const evt = new Event('scroll', { bubbles: true });
      Object.assign(evt, {
        contentOffset: { y: 800 },
        layoutMeasurement: { height: 400 },
        contentSize: { height: 1198 },
      });
      body.dispatchEvent(evt);
    });
    fireEvent.click(getByLabelText('consent-agree-button'));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Test 5 — Privacy Policy link calls Linking.openURL('https://humynlabs.ai/privacy-policy')
  // ---------------------------------------------------------------------------
  it('Test 5: tapping the Privacy Policy link calls Linking.openURL with the canonical URL', () => {
    const openSpy = vi.spyOn(RN.Linking, 'openURL').mockResolvedValue(undefined as never);
    const { getByLabelText } = render(<TermsOfUseModal visible={true} onAgree={() => {}} />);
    fireEvent.click(getByLabelText('privacy-policy-link'));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://humynlabs.ai/privacy-policy');
  });

  // ---------------------------------------------------------------------------
  // Test 6 — BackHandler is registered while visible=true and returns true.
  // ---------------------------------------------------------------------------
  it('Test 6: BackHandler.addEventListener registers a true-returning handler while visible; subscription removed when visible flips false', () => {
    const removeSpy = vi.fn();
    const addSpy = vi.spyOn(RN.BackHandler, 'addEventListener').mockImplementation(((
      _event: string,
      _handler: () => boolean,
    ) => ({
      remove: removeSpy,
    })) as unknown as typeof RN.BackHandler.addEventListener);
    const { rerender } = render(<TermsOfUseModal visible={true} onAgree={() => {}} />);
    expect(addSpy).toHaveBeenCalled();
    const lastCall = addSpy.mock.calls[addSpy.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe('hardwareBackPress');
    const handler = lastCall?.[1] as () => boolean;
    expect(typeof handler).toBe('function');
    expect(handler()).toBe(true);
    // When visible flips to false, the cleanup runs and remove() is called.
    rerender(<TermsOfUseModal visible={false} onAgree={() => {}} />);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Test 7 — no close affordance is rendered (non-dismissable invariant)
  // ---------------------------------------------------------------------------
  it('Test 7: no close-button / "X" / "Close" affordance is rendered (non-dismissable)', () => {
    const { queryByLabelText, queryByText } = render(
      <TermsOfUseModal visible={true} onAgree={() => {}} />,
    );
    expect(queryByLabelText('close-button')).toBeNull();
    expect(queryByLabelText('Got it close terms')).toBeNull();
    expect(queryByText('Close')).toBeNull();
    expect(queryByText('X')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Legal-constants invariants (regression coverage for LEGAL-02)
  // ---------------------------------------------------------------------------
  it('Invariant A: TERMS_OF_USE_TEXT export is byte-identical to the canonical §5.2 string', () => {
    expect(TERMS_OF_USE_TEXT).toBe(CANONICAL_TEXT);
    expect(TERMS_OF_USE_TEXT.length).toBe(CANONICAL_TEXT.length);
  });

  it('Invariant B (D-32): bilingual underlay renders for non-English locale', async () => {
    await i18n.changeLanguage('hi-IN');
    const { queryByLabelText } = render(<TermsOfUseModal visible onAgree={() => {}} />);
    expect(queryByLabelText('Terms of Use body')).toBeTruthy();
    expect(queryByLabelText('Terms of Use English underlay')).toBeTruthy();
  });
});
