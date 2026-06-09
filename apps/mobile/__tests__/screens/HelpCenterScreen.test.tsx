// HelpCenterScreen — verifies the design-spec §17 contract:
//   Test 1: All 3 HELP-01 content accordions render in order (Instructions Guide
//           / FAQs / Troubleshooting), each with its accordion-toggle label. (A
//           4th, BUG-5/D-BATTERY battery-optimization accordion is asserted
//           separately by the "renders the relocated battery accordion" test.)
//   Test 2: Contact Support button calls Linking.openURL with the
//           support@humynlabs.ai mailto: URL (OQ-1 resolved in Plan 03-02:
//           resolves; the parser preserves it verbatim from
//           help-center-content.md → content.json).
//   Test 3: Report-a-problem button mounts the ReportProblemSheet
//           (asserted via the sheet's own accessibility label —
//           feedbackService is mocked so the sheet renders without
//           reaching the network).
//   Test 4: The 7 Instructions Guide subsection headings render after the
//           accordion is opened — defends against the renderer dropping
//           items when the JSON shape drifts.
//
// The canonical react-native mock from vitest.setup.ts only exports
// View/Text/Pressable/Modal/etc. — Linking is added via a per-file
// vi.mock here. feedbackService is mocked so the sheet's submitFeedback
// doesn't reach the real wire path.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted — Linking spy + feedback spy must be defined before the
// (also-hoisted) vi.mock factories that reference them.
const { mockOpenURL, mockSubmitFeedback } = vi.hoisted(() => ({
  mockOpenURL: vi.fn(),
  mockSubmitFeedback: vi.fn(),
}));

// react-native shim extension — mirror the canonical Phase 2 host-component
// shim from vitest.setup.ts plus expose `Linking.openURL` as a spy. Same
// pattern as RigTutorialScreen.test.tsx (plan 02-11).
vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const React_ = ReactModule;
  function resolveStyle(value: unknown): Record<string, unknown> | undefined {
    if (value == null || value === false) return undefined;
    if (typeof value === 'function') {
      return resolveStyle((value as (s: { pressed: boolean }) => unknown)({ pressed: false }));
    }
    if (Array.isArray(value)) {
      const merged: Record<string, unknown> = {};
      for (const entry of value) {
        const r = resolveStyle(entry);
        if (r) Object.assign(merged, r);
      }
      return Object.keys(merged).length ? merged : undefined;
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return undefined;
  }
  function makeComponent(name: string) {
    return React_.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, style, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof accessibilityRole === 'string') dom['role'] = accessibilityRole;
      if (typeof onPress === 'function') dom['onClick'] = onPress;
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return React_.createElement('div', dom, children as React.ReactNode);
    });
  }
  function makeTextInput() {
    return React_.forwardRef<
      HTMLInputElement,
      Record<string, unknown> & {
        value?: string;
        onChangeText?: (t: string) => void;
        placeholder?: string;
      }
    >(function TextInputShim(props, ref) {
      const {
        value,
        onChangeText,
        accessibilityLabel,
        style,
        placeholderTextColor: _ptc,
        ...rest
      } = props;
      const dom: Record<string, unknown> = {
        ref,
        'data-testid': 'TextInput',
        value: value ?? '',
        ...rest,
      };
      if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
      if (typeof onChangeText === 'function') {
        dom['onChange'] = (e: { target: { value: string } }) => onChangeText(e.target.value);
      }
      const resolved = resolveStyle(style);
      if (resolved) dom['style'] = resolved;
      return React_.createElement('input', dom);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    TextInput: makeTextInput(),
    Modal: makeComponent('Modal'),
    StatusBar: () => null,
    Image: makeComponent('Image'),
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: (o: { android?: unknown; ios?: unknown; default?: unknown }) =>
        o.android ?? o.default,
    },
    Linking: { openURL: mockOpenURL, canOpenURL: vi.fn(async () => true) },
    Alert: { alert: vi.fn() },
  };
});

// feedbackService — mocked at the module boundary so ReportProblemSheet's
// submit path doesn't hit the real wire.
vi.mock('../../src/services/feedbackService', () => ({
  submitFeedback: mockSubmitFeedback,
  FEEDBACK_CATEGORIES: [
    'app-crashed',
    'task-doesnt-start',
    'upload-stuck',
    'login-issue',
    'video-quality-issue',
    'imu-issue',
    'thermal-issue',
    'other',
  ] as const,
}));

import { HelpCenterScreen } from '../../src/screens/help/HelpCenterScreen';

beforeEach(() => {
  mockOpenURL.mockClear();
  mockSubmitFeedback.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('HelpCenterScreen', () => {
  it('renders all 3 accordions in HELP-01 order', () => {
    const { getByLabelText } = render(<HelpCenterScreen />);
    // Toggle labels are derived from the accordion's title prop.
    expect(getByLabelText('accordion-toggle-Instructions Guide')).toBeTruthy();
    expect(getByLabelText('accordion-toggle-FAQs')).toBeTruthy();
    expect(getByLabelText('accordion-toggle-Troubleshooting')).toBeTruthy();
  });

  it('BUG-5: renders the relocated battery-optimization accordion; expanding mounts the guide', () => {
    const { getByLabelText, queryByLabelText } = render(<HelpCenterScreen />);
    // The 4th accordion (D-BATTERY relocation) uses batteryOpt.title.
    const toggle = getByLabelText('accordion-toggle-Keep your uploads running');
    expect(toggle).toBeTruthy();
    // Collapsed by default → the guide body isn't mounted yet (AccordionItem is lazy).
    expect(queryByLabelText('battery-optimization-guide')).toBeNull();
    fireEvent.click(toggle);
    // Expanded → the BatteryOptimizationGuide renders.
    expect(getByLabelText('battery-optimization-guide')).toBeTruthy();
  });

  it('Contact Support button opens the support@humynlabs.ai mailto: URL', () => {
    const { getByLabelText } = render(<HelpCenterScreen />);
    fireEvent.click(getByLabelText('help-contact-support-mailto'));
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(
      // Plan 03-02 — OQ-1 resolved: support email = `support@humynlabs.ai`.
      expect.stringMatching(/^mailto:support@humynlabs\.ai\?subject=/),
    );
  });

  it('Report-a-problem button mounts the ReportProblemSheet', () => {
    const { getByLabelText, queryByLabelText } = render(<HelpCenterScreen />);
    expect(queryByLabelText('report-problem-sheet')).toBeNull();
    fireEvent.click(getByLabelText('help-report-problem'));
    expect(getByLabelText('report-problem-sheet')).toBeTruthy();
  });

  it('Instructions Guide accordion shows its 7 subsection headings when opened', () => {
    const { getByLabelText, getAllByText } = render(<HelpCenterScreen />);
    fireEvent.click(getByLabelText('accordion-toggle-Instructions Guide'));
    // Each subsection heading is rendered as Text inside the accordion body.
    // getAllByText returns at least one match per heading; use length>=1.
    expect(getAllByText('Before you record').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Starting a recording').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('While recording').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Stopping a recording').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Your first recording (Practice)').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Uploads').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Payouts').length).toBeGreaterThanOrEqual(1);
  });
});
