// ReportProblemSheet — Plan 07-16 Task 4c G-22 (WARNING 12).
//
// Pins the en.json i18n keys + the WARNING-12 testID/accessibilityLabel split:
//   testID            = `category-{c}`        — stays English (server contract + test ID)
//   accessibilityLabel = `t(report.category.X)` — translates per active locale
//
// The full render test (chip presence by testID) lives in the existing
// `__tests__/components/ReportProblemSheet.test.tsx`; this file covers the
// i18n key shape.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { ReportProblemSheet } from '../../src/components/ReportProblemSheet';
import i18n from '../../src/i18n';
import enJson from '../../src/i18n/locales/en.json';

describe('ReportProblemSheet — Plan 07-16 G-22 (i18n + a11y split)', () => {
  afterEach(() => {
    cleanup();
  });

  it('en.json carries the 8 report.category.* keys with the expected UX-simpler labels', () => {
    expect(enJson.report.category.appCrashed).toBe('App crashed');
    expect(enJson.report.category.taskDoesntStart).toBe("Task doesn't start");
    expect(enJson.report.category.uploadStuck).toBe('Upload stuck');
    expect(enJson.report.category.loginIssue).toBe('Login issue');
    expect(enJson.report.category.videoQualityIssue).toBe('Video quality issue');
    // WARNING 8: imu-issue intentionally becomes "Sensor issue" (UX clarity)
    expect(enJson.report.category.imuIssue).toBe('Sensor issue');
    // WARNING 8: thermal-issue intentionally becomes "Device overheating"
    expect(enJson.report.category.thermalIssue).toBe('Device overheating');
    expect(enJson.report.category.other).toBe('Other');
  });

  it('testID stays English; accessibilityLabel carries translated text (WARNING 12)', () => {
    void i18n.changeLanguage('en');
    const { getByTestId } = render(<ReportProblemSheet onClose={() => undefined} />);
    const chip = getByTestId('category-app-crashed');
    expect(chip).toBeTruthy();
    // The accessibilityLabel in jsdom serializes to `aria-label` on the host
    // <div>. Confirm the en-resolved label is what TalkBack would speak.
    expect(chip.getAttribute('aria-label')).toBe('App crashed');
  });
});
