// HistoryDayHeader — Plan 07-16 Task 4b G-28 part 3 (WARNING 9 decision).
//
// `title.toUpperCase()` STAYS on the render — the casing is intentional:
//   - Latin locales (pt-BR / es) get the uppercase form ("HOJE", "HOY")
//   - Devanagari / Bengali / Tamil / Telugu / Marathi locales: .toUpperCase()
//     is a no-op on these scripts, so the section name renders as-is.
//
// This test pins both behaviors at the render level.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { HistoryDayHeader } from '../../src/components/HistoryDayHeader';

describe('HistoryDayHeader — Plan 07-16 G-28 part 3 (WARNING 9)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the en title in UPPERCASE (Latin casing)', () => {
    const { getByLabelText } = render(<HistoryDayHeader title="Today" />);
    const node = getByLabelText('history-day-header-title');
    expect(node.textContent).toBe('TODAY');
  });

  it('renders the pt-BR title in UPPERCASE', () => {
    const { getByLabelText } = render(<HistoryDayHeader title="Hoje" />);
    const node = getByLabelText('history-day-header-title');
    expect(node.textContent).toBe('HOJE');
  });

  it('Devanagari titles are case-invariant — `.toUpperCase()` is a no-op', () => {
    const hindi = 'आज';
    const { getByLabelText } = render(<HistoryDayHeader title={hindi} />);
    const node = getByLabelText('history-day-header-title');
    expect(node.textContent).toBe(hindi);
  });
});
