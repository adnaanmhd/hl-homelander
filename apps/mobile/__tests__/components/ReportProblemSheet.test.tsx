// ReportProblemSheet — verifies design-spec §18 modal-sheet HELP-05 contract:
//   Test 1: All 8 FEEDBACK_CATEGORIES render as category chips, each with
//           accessibilityLabel `category-{value}` so users / tests pick by
//           canonical name.
//   Test 2: Cancel button calls onClose (no submit, no Alert).
//   Test 3: Tapping Submit without a category fires Alert (no submitFeedback
//           call).
//   Test 4: Picking a category + typing a message + tapping Submit calls
//           submitFeedback with the trimmed message + selected category.
//   Test 5: submitFeedback rejection surfaces via Alert and the sheet stays
//           open (onClose not called).
//
// react-native is mocked per-file (mirrors RigTutorialScreen + SignupScreen
// pattern) so we can spy on Alert.alert. feedbackService is mocked at the
// module boundary; the per-call assertion drives the Idempotency-Key
// contract end-to-end (the service test covers the FormData shape).

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSubmitFeedback, mockAlert } = vi.hoisted(() => ({
  mockSubmitFeedback: vi.fn(),
  mockAlert: vi.fn(),
}));

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
    Alert: { alert: mockAlert },
  };
});

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

import { ReportProblemSheet } from '../../src/components/ReportProblemSheet';

beforeEach(() => {
  mockSubmitFeedback.mockReset();
  mockAlert.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('ReportProblemSheet', () => {
  it('renders all 8 FEEDBACK_CATEGORIES as chips', () => {
    const { getByLabelText } = render(<ReportProblemSheet onClose={() => undefined} />);
    expect(getByLabelText('category-app-crashed')).toBeTruthy();
    expect(getByLabelText('category-task-doesnt-start')).toBeTruthy();
    expect(getByLabelText('category-upload-stuck')).toBeTruthy();
    expect(getByLabelText('category-login-issue')).toBeTruthy();
    expect(getByLabelText('category-video-quality-issue')).toBeTruthy();
    expect(getByLabelText('category-imu-issue')).toBeTruthy();
    expect(getByLabelText('category-thermal-issue')).toBeTruthy();
    expect(getByLabelText('category-other')).toBeTruthy();
  });

  it('Cancel button calls onClose without submitting', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<ReportProblemSheet onClose={onClose} />);
    fireEvent.click(getByLabelText('report-problem-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockSubmitFeedback).not.toHaveBeenCalled();
  });

  it('Submit without a selected category triggers Alert and does NOT call submitFeedback', () => {
    const { getByLabelText } = render(<ReportProblemSheet onClose={() => undefined} />);
    fireEvent.click(getByLabelText('report-problem-submit'));
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockSubmitFeedback).not.toHaveBeenCalled();
  });

  it('Pick category + type message + submit → submitFeedback called with trimmed message', async () => {
    mockSubmitFeedback.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { getByLabelText } = render(<ReportProblemSheet onClose={onClose} />);
    fireEvent.click(getByLabelText('category-upload-stuck'));
    const textarea = getByLabelText('report-problem-message');
    fireEvent.change(textarea, { target: { value: '  My upload is stuck  ' } });
    fireEvent.click(getByLabelText('report-problem-submit'));
    await waitFor(() => expect(mockSubmitFeedback).toHaveBeenCalledTimes(1));
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      category: 'upload-stuck',
      message: 'My upload is stuck',
    });
    // Successful submit fires the "Sent" Alert and closes the sheet.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('submitFeedback rejection surfaces via Alert; sheet stays open (onClose NOT called)', async () => {
    mockSubmitFeedback.mockRejectedValue(new Error('feedback_invalid_category:bad'));
    const onClose = vi.fn();
    const { getByLabelText } = render(<ReportProblemSheet onClose={onClose} />);
    fireEvent.click(getByLabelText('category-other'));
    const textarea = getByLabelText('report-problem-message');
    fireEvent.change(textarea, { target: { value: 'x' } });
    fireEvent.click(getByLabelText('report-problem-submit'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
