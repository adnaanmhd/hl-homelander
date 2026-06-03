// Button primitive overflow guards — Plan 07-17 Task 3 G-22.
//
// Pins the cross-cutting Button primitive change that adds numberOfLines={1}
// + adjustsFontSizeToFit + minimumFontScale={0.75} to the internal Text
// element. Every Button consumer (ReportProblemSheet + ~30 other call sites)
// inherits these overflow guards so hi-IN `रद्द करें` and similar long
// Devanagari labels render without truncating to `रद`.
//
// Mirrors the test infra pattern in __tests__/components/LanguageSheet.test.tsx
// (render → query by accessibilityLabel).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Button } from '../../src/ui/primitives/Button';

const BUTTON_SOURCE = readFileSync(
  resolve(import.meta.dirname, '../../src/ui/primitives/Button.tsx'),
  'utf8',
);

describe('Button primitive overflow guards — Plan 07-17 G-22 (cross-cutting)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Button.tsx source includes the 3 overflow-guard props on the internal Text', () => {
    // Source-level grep is sufficient — the props pass through Text → the
    // jsdom RN shim → the DOM, but the prop forwarding is unit-test territory
    // for the shim, not for this consumer. The grep proves the wire is in
    // place; the operator hardware walk validates the visual result.
    expect(BUTTON_SOURCE).toContain('numberOfLines={1}');
    expect(BUTTON_SOURCE).toContain('adjustsFontSizeToFit');
    expect(BUTTON_SOURCE).toContain('minimumFontScale={0.75}');
  });

  it('renders a long Devanagari label without throwing (smoke test)', () => {
    // `रद्द करें` × 3 ≈ 30 Devanagari chars. With the overflow guards in
    // place, the Text auto-shrinks to fit. Without them, the test still
    // passes (jsdom doesn't enforce width limits), but the source-grep test
    // above is the load-bearing assertion.
    const longLabel = 'रद्द करें रद्द करें रद्द करें';
    const { getByLabelText } = render(
      <Button label={longLabel} variant="primary" onPress={() => undefined} />,
    );
    expect(getByLabelText(longLabel)).toBeTruthy();
  });

  it('renders a short English label without regression', () => {
    const { getByLabelText } = render(
      <Button label="Cancel" variant="outline" onPress={() => undefined} />,
    );
    expect(getByLabelText('Cancel')).toBeTruthy();
  });

  it('preserves the existing accessibilityLabel override pattern', () => {
    const { getByLabelText } = render(
      <Button label="रद्द करें" accessibilityLabel="cancel-cta" onPress={() => undefined} />,
    );
    expect(getByLabelText('cancel-cta')).toBeTruthy();
  });
});
