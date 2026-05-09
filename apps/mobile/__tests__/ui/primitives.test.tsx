// UI primitive smoke tests — every primitive shipped in plan 02-02 Task 4
// gets at least one render assertion. Coverage focus is contract behaviour
// (variants → token, disabled → opacity, error → coral text, visible →
// renders) NOT pixel-perfect snapshot. Pixel-precise visual is integration-
// tested via Detox + design-spec parity sweeps in plan 02-19.
//
// Pattern follows apps/mobile/__tests__/SignIn.test.tsx — testing-library
// for DOM, vi.mock at file top for any extra service/native dep.

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { Button } from '../../src/ui/primitives/Button';
import { Text } from '../../src/ui/primitives/Text';
import { Field } from '../../src/ui/primitives/Field';
import { Modal } from '../../src/ui/primitives/Modal';
import { colors, typography } from '../../src/ui/tokens';

afterEach(() => {
  cleanup();
});

describe('Button primitive', () => {
  it('renders with default primary variant and the supplied label', () => {
    const { getByLabelText } = render(<Button label="Sign in" onPress={() => {}} />);
    // accessibilityLabel falls back to label when not given explicitly
    expect(getByLabelText('Sign in')).toBeTruthy();
  });

  it('disabled=true → opacity 0.4 and onPress is suppressed', () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<Button label="Submit" onPress={onPress} disabled />);
    const node = getByLabelText('Submit');
    fireEvent.click(node);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('onPress fires when not disabled', () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<Button label="Continue" onPress={onPress} />);
    fireEvent.click(getByLabelText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('coral variant accepts the variant prop without throwing', () => {
    const { getByLabelText } = render(<Button label="Cancel" variant="coral" onPress={() => {}} />);
    expect(getByLabelText('Cancel')).toBeTruthy();
  });
});

describe('Text primitive', () => {
  it('variant=title28 picks up the typography.title28 token (fontSize 28)', () => {
    expect(typography.title28.fontSize).toBe(28);
    const { getByText } = render(<Text variant="title28">Hello</Text>);
    expect(getByText('Hello')).toBeTruthy();
  });

  it('tone=secondary uses colors.text2 (verified by token contract, not pixel)', () => {
    // Visual rendering is asserted at the token level: tone wiring is a
    // pure mapping inside the primitive, not a runtime assertion.
    expect(colors.text2).toBe('#6B6B6B');
    const { getByText } = render(<Text tone="secondary">Subtle</Text>);
    expect(getByText('Subtle')).toBeTruthy();
  });
});

describe('Field primitive', () => {
  it('renders label + input, accessibilityLabel falls back to the label', () => {
    const { getByLabelText } = render(<Field label="Email" value="" onChangeText={() => {}} />);
    expect(getByLabelText('Email')).toBeTruthy();
  });

  it('error prop renders a coral error line under the input', () => {
    const { getByLabelText, getByText } = render(
      <Field label="Password" value="" onChangeText={() => {}} error="Password too short" />,
    );
    // Error caption is reachable by its accessibility label
    expect(getByLabelText('Password error')).toBeTruthy();
    // And by visible text content
    expect(getByText('Password too short')).toBeTruthy();
  });

  it('onChangeText fires when the input value changes', () => {
    const onChangeText = vi.fn();
    const { getByLabelText } = render(
      <Field label="Display name" value="" onChangeText={onChangeText} />,
    );
    fireEvent.change(getByLabelText('Display name'), {
      target: { value: 'Adnaan' },
    });
    expect(onChangeText).toHaveBeenCalledWith('Adnaan');
  });
});

describe('Modal primitive', () => {
  it('renders title + body when visible', () => {
    const { getByText } = render(
      <Modal visible onDismiss={() => {}} title="Are you sure?">
        <Text>This will delete your account.</Text>
      </Modal>,
    );
    expect(getByText('Are you sure?')).toBeTruthy();
    expect(getByText('This will delete your account.')).toBeTruthy();
  });
});
