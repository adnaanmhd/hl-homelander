// Plan 03-03 — Visual snapshot for TasksPlaceholderScreen with the
// Pattern 71 useTabTopBarProps() avatar wiring (Plan 03-03 Task 1).
//
// The baseline catches:
//   - TopBar wordmark + avatar Pressable on the right
//   - "Tasks — coming in Phase 6." body copy
//   - Avatar Image element (avatarUrl set on appStore.user) — pre-fix this
//     screen rendered the 'U' fallback regardless of the user slice
//     (02-COSMETIC-GAPS.md § Profile screen item 1)
//
// react-native mock shape: per-test inline shim (Pattern 69).

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { MOCK_USER } = vi.hoisted(() => ({
  MOCK_USER: {
    id: 'u1',
    email: 'alice@x.com',
    name: 'Alice',
    avatarUrl: 'https://example.com/a.jpg',
  },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    replace: vi.fn(),
    reset: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

vi.mock('../../src/state/appStore', () => {
  const stub = { user: MOCK_USER };
  function useAppStore<T>(selector: (s: typeof stub) => T): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

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
      for (const e of value) {
        const r = resolveStyle(e);
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
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    ScrollView: makeComponent('ScrollView'),
    Image: makeComponent('Image'),
    StyleSheet: {
      create<T extends Record<string, unknown>>(s: T): T {
        return s;
      },
      flatten<T>(s: T): T {
        return s;
      },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Platform: {
      OS: 'android',
      select<T>(o: { android?: T; default?: T }): T | undefined {
        return o.android ?? o.default;
      },
    },
  };
});

import TasksPlaceholderScreen from '../../src/screens/tasks/TasksPlaceholderScreen';
import { renderToImage } from './_utils/renderToImage';

describe('TasksPlaceholderScreen visual (Plan 03-03 Task 1 / Pattern 71)', () => {
  // Plan 04-08 added a `__DEV__`-gated debug long-press wrapper around the
  // heading. Production (`apkRollout`/`playStore`) builds set `__DEV__===false`
  // → Metro dead-code-eliminates that wrapper, so the visual baseline pins the
  // production rendering (the plain heading, no Pressable). `vitest.setup.ts`
  // defaults `__DEV__` truthy; stub it false here so the baseline is stable.
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('matches baseline (TopBar wordmark + Google avatar + body copy)', () => {
    const { container } = render(<TasksPlaceholderScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
