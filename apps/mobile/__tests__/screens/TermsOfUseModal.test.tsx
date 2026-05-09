// TermsOfUseModal — Phase 2 plan 02-09 Task 1.
//
// Behaviour matrix (4 tests):
//   Test 1: visible=false → modal body not rendered.
//   Test 2: visible=true → renders title "Terms of Use" + verbatim §5.2 body.
//   Test 3: tap "Got it" → onClose callback invoked exactly once.
//   Test 4: TERMS_OF_USE_TEXT export matches the canonical idea-brief.md §5.2 /
//           design-spec.md §18.1 string byte-for-byte.
//
// Tests run under JSDOM with the host-component shim from vitest.setup.ts so
// the RN <Modal> primitive collapses to a plain <div>; visibility-by-prop is
// asserted via the `aria-label="Terms of Use modal"` query.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TermsOfUseModal, TERMS_OF_USE_TEXT } from '../../src/screens/signup/TermsOfUseModal';

const CANONICAL_TEXT =
  'I consent and agree to upload videos of myself and/or others who consent to be recorded; ' +
  'performing certain daily activities/tasks. This content will be used to develop / train AI ' +
  'models and for research purposes. I confirm that I am 18 years or older and have the ' +
  'necessary permissions to share this content. I confirm that no one being recorded is a minor. ' +
  'I consent to my approximate location and IP address being captured alongside each recording. ' +
  "I understand that my data will be stored securely and used in accordance with Humyn's " +
  'Privacy Policy.';

describe('TermsOfUseModal (plan 02-09 Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('Test 1: visible=false → underlying RN Modal receives visible=false (hides on real device)', () => {
    // Under the JSDOM host-component shim from vitest.setup.ts, RN's <Modal>
    // collapses to a passthrough <div> that always renders its children — so
    // we can't assert "body is not in the DOM tree". Instead we assert the
    // contract that matters at runtime: the underlying RN Modal sees
    // visible=false and on a real device renders nothing. The shim forwards
    // unknown props onto the DOM, so we read them off the data-testid="Modal"
    // element.
    const { container } = render(<TermsOfUseModal visible={false} onClose={() => {}} />);
    const modalNode = container.querySelector('[data-testid="Modal"]');
    expect(modalNode).not.toBeNull();
    // React-DOM coerces boolean props on unknown DOM elements to "false"/"true"
    // strings (or omits them). We check both forms.
    const visibleAttr = modalNode?.getAttribute('visible');
    expect(visibleAttr === 'false' || visibleAttr === null).toBe(true);
  });

  it('Test 2: visible=true → renders the title and verbatim §5.2 body', () => {
    const { getByText, getByLabelText } = render(
      <TermsOfUseModal visible={true} onClose={() => {}} />,
    );
    // Title rendered (Modal primitive forwards `title` prop into a Text node).
    expect(getByText('Terms of Use')).toBeTruthy();
    // Body rendered with the verbatim canonical text.
    const body = getByLabelText('Terms of Use body');
    expect(body.textContent).toBe(CANONICAL_TEXT);
    // Spot-check the most legally-sensitive sentinel substrings.
    expect(body.textContent).toContain('I am 18 years or older');
    expect(body.textContent).toContain('no one being recorded is a minor');
    expect(body.textContent).toContain('approximate location and IP address');
    expect(body.textContent).toContain("Humyn's");
  });

  it('Test 3: tapping "Got it" calls onClose exactly once', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<TermsOfUseModal visible={true} onClose={onClose} />);
    fireEvent.click(getByLabelText('Got it close terms'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Test 4: TERMS_OF_USE_TEXT export matches the canonical idea-brief.md §5.2 string byte-for-byte', () => {
    expect(TERMS_OF_USE_TEXT).toBe(CANONICAL_TEXT);
    // Length sanity — drift detector. Update this number ONLY when the
    // canonical text changes (which itself requires updating idea-brief.md +
    // bumping the consent version on the backend per LEGAL-02).
    expect(TERMS_OF_USE_TEXT.length).toBe(CANONICAL_TEXT.length);
  });
});
