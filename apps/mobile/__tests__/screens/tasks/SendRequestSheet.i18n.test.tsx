// SendRequestSheet — Plan 07-16 Task 4c G-24.
//
// Pins the i18n key shape for the 11 category chips + the Indoor/Outdoor
// segmented toggle + the form eyebrows (CATEGORY / SETTING / TASK NAME).
// The accessibilityLabel `send-request-category-{c}` stays English-canonical
// (existing tests query by it; per WARNING 12 the testID-equivalent identifier
// pattern is preserved).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { SendRequestSheet } from '../../../src/screens/tasks/SendRequestSheet';
import i18n from '../../../src/i18n';
import enJson from '../../../src/i18n/locales/en.json';

describe('SendRequestSheet — Plan 07-16 G-24 (i18n)', () => {
  afterEach(() => {
    cleanup();
  });

  it('en.json carries tasks.setting.{indoor,outdoor} + the 4 form-eyebrow keys', () => {
    expect(enJson.tasks.setting.indoor).toBe('Indoor');
    expect(enJson.tasks.setting.outdoor).toBe('Outdoor');
    expect(enJson.sendRequest.labelTaskName).toBe('Task name');
    expect(enJson.sendRequest.labelDescriptionEyebrow).toBe('Description');
    expect(enJson.sendRequest.labelCategory).toBe('Category');
    expect(enJson.sendRequest.labelSetting).toBe('Setting');
  });

  it('renders the 11 category chips by their canonical accessibilityLabel', () => {
    void i18n.changeLanguage('en');
    const { getByLabelText } = render(<SendRequestSheet visible onDismiss={() => undefined} />);
    // The accessibilityLabel stays English-canonical for test stability.
    expect(getByLabelText('send-request-category-Cooking')).toBeTruthy();
    expect(getByLabelText('send-request-category-Dishwashing')).toBeTruthy();
    expect(getByLabelText('send-request-category-Other')).toBeTruthy();
  });

  it('renders the Indoor + Outdoor segmented toggle controls', () => {
    void i18n.changeLanguage('en');
    const { getByLabelText } = render(<SendRequestSheet visible onDismiss={() => undefined} />);
    expect(getByLabelText('send-request-setting-indoor')).toBeTruthy();
    expect(getByLabelText('send-request-setting-outdoor')).toBeTruthy();
  });
});
