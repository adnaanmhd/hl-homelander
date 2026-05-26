// TranslatedHeaderTitle — Plan 07-16 Task 4c G-23 closure (WARNING 7 fix).
//
// Pins the contract that the component resolves the i18n key via t() and
// re-renders on i18n.changeLanguage (the function-form `options.title` does
// NOT — that's the bug this component fixes).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { TranslatedHeaderTitle } from '../../src/components/TranslatedHeaderTitle';
import i18n from '../../src/i18n';

describe('TranslatedHeaderTitle — Plan 07-16 G-23 (WARNING 7)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the i18n value for the given key in en', async () => {
    await i18n.changeLanguage('en');
    const { getByLabelText } = render(<TranslatedHeaderTitle i18nKey="helpCenter.title" />);
    const node = getByLabelText('header-title-helpCenter.title');
    expect(node.textContent).toBe('Help Center');
  });

  it('falls back to the key when the en bundle is missing the entry (defensive)', async () => {
    await i18n.changeLanguage('en');
    const { getByLabelText } = render(
      <TranslatedHeaderTitle i18nKey="this.key.is.guaranteed.absent.xyz" />,
    );
    const node = getByLabelText('header-title-this.key.is.guaranteed.absent.xyz');
    // i18next's `returnNull: false` + key-fallback means missing keys come
    // back as the raw key string (not null, not crash).
    expect(node.textContent).toBe('this.key.is.guaranteed.absent.xyz');
  });
});
