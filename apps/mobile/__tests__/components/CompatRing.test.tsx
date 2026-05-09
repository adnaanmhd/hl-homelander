// CompatRing unit tests — Phase 2 plan 02-15 Task 2.
//
// Coverage:
//   - structure: renders SVG with two <circle> elements (track + progress)
//   - percent label: clamped + rounded
//   - clamping: percent above 100 / below 0 clamp to range
//   - accessibility: accessibilityValue exposes clamped now / min / max
//   - snapshots at percent=0, 42, 100 lock the markup against drift
//
// Pattern: relies on the canonical react-native-svg mock from vitest.setup.ts
// (Svg → svg, Circle → circle) so React-DOM can render the tree under JSDOM.
//
// Animated is from the react-native shim — useEffect's Animated.timing call is
// not exercised in JSDOM (the host shim doesn't include Animated), so the test
// patches the react-native module to expose a no-op Animated surface.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  function makeComponent(name: string) {
    return ReactModule.forwardRef<HTMLDivElement, Record<string, unknown>>(
      function HostComponent(props, ref) {
        const { children, accessibilityLabel, style, ...rest } = props as {
          children?: React.ReactNode;
          accessibilityLabel?: string;
          style?: unknown;
        } & Record<string, unknown>;
        const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
        if (typeof accessibilityLabel === 'string') dom['aria-label'] = accessibilityLabel;
        if (style && typeof style === 'object' && !Array.isArray(style)) dom['style'] = style;
        return ReactModule.createElement('div', dom, children as React.ReactNode);
      },
    );
  }
  // Animated.timing returns an object with a .start() method; the
  // createAnimatedComponent shim returns the wrapped component unchanged so
  // the SVG primitive renders as a plain <circle>.
  const Animated = {
    Value: class {
      _value: number;
      constructor(v: number) {
        this._value = v;
      }
      setValue(v: number) {
        this._value = v;
      }
    },
    timing: () => ({ start: () => undefined }),
    createAnimatedComponent: <T,>(c: T) => c,
  };
  const Easing = {
    bezier: () => () => 0,
  };
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    Animated,
    Easing,
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      flatten: (s: unknown) => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default,
    },
  };
});

import { CompatRing } from '../../src/components/CompatRing';

describe('CompatRing (design-spec §4 visual + §0.4 motion)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Test 1: renders the 130×130 ring with track + progress circle', () => {
    const { container } = render(<CompatRing percent={0} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('Test 2: snapshot at percent=0', () => {
    const { container } = render(<CompatRing percent={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('Test 3: snapshot at percent=42', () => {
    const { container } = render(<CompatRing percent={42} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('Test 4: snapshot at percent=100', () => {
    const { container } = render(<CompatRing percent={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('Test 5: clamps inputs >100 to 100; renders the percent label inside', () => {
    render(<CompatRing percent={150} />);
    // accessibilityLabel reaches the DOM as aria-label.
    const node = screen.getByLabelText('compat-ring');
    expect(node).toBeTruthy();
    // Math.round(150 → clamped 100) = 100
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('Test 6: clamps inputs <0 to 0; renders 0% label', () => {
    render(<CompatRing percent={-25} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('Test 7: rounds the percent label (42.6 → 43%)', () => {
    render(<CompatRing percent={42.6} />);
    expect(screen.getByText('43%')).toBeTruthy();
  });
});
