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
import i18n from '../../src/i18n';

const CANONICAL_TEXT =
  'I consent and agree to upload videos of myself and/or others who consent to be recorded; ' +
  'performing certain daily activities/tasks. This content will be used to develop / train AI ' +
  'models and for research purposes. I confirm that I am 18 years or older and have the ' +
  'necessary permissions to share this content. I confirm that no one being recorded is a minor. ' +
  'I consent to my approximate location and IP address being captured alongside each recording. ' +
  "I understand that my data will be stored securely and used in accordance with Humyn's " +
  'Privacy Policy.';

describe('TermsOfUseModal (plan 02-09 Task 1 + plan 07-05 Task 3 bilingual)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to English between tests — the bilingual locale-switch test below
    // would otherwise leak hi-IN into Test 2's English-only assertion.
    await i18n.changeLanguage('en');
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

  // Plan 07-05 Task 3 — bilingual rendering per D-32 / D-33. The canonical
  // `TERMS_OF_USE_TEXT` byte sequence is unchanged (D-33 — the legal record
  // stays English on the server). When the active locale is non-English the
  // modal renders TWO Text blocks: translated body on top, English underlay
  // below at ~70% opacity.
  it('Test 5 (D-32): renders only the English body when active locale is en', () => {
    const { queryByLabelText } = render(<TermsOfUseModal visible onClose={() => {}} />);
    expect(queryByLabelText('Terms of Use body')).toBeTruthy();
    expect(queryByLabelText('Terms of Use English underlay')).toBeFalsy();
  });

  it('Test 6 (D-32): renders translated body on top + English underlay below when locale != en', async () => {
    await i18n.changeLanguage('hi-IN');
    const { queryByLabelText } = render(<TermsOfUseModal visible onClose={() => {}} />);
    // Both blocks present (translated on top, English underlay below at 70% opacity).
    expect(queryByLabelText('Terms of Use body')).toBeTruthy();
    expect(queryByLabelText('Terms of Use English underlay')).toBeTruthy();
    // The English underlay is byte-equal to the canonical constant (D-33).
    const underlay = queryByLabelText('Terms of Use English underlay');
    expect(underlay?.textContent).toBe(CANONICAL_TEXT);
  });

  it('Test 7 (D-33): en.json `terms.consent.body` is byte-equal to TERMS_OF_USE_TEXT', () => {
    // The English value in the i18n catalog must match the legal canonical
    // constant exactly — the plan's parity assertion (no drift between the
    // legal record and the localized catalog).
    expect(i18n.getFixedT('en')('terms.consent.body')).toBe(TERMS_OF_USE_TEXT);
  });
});
