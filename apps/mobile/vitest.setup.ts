// Vitest setup file for the Phase 1 SignIn test. Stubs the React Native
// runtime so a JSDOM environment can render the SignIn component tree
// without invoking any native bridge calls. The auth service itself is
// mocked at the test file level (`vi.mock('../src/services/auth', ...)`),
// so the transitive native modules (MMKV, GoogleSignin, Keychain) are never
// imported even after this stub runs.
import { vi } from 'vitest';
import * as React from 'react';

vi.mock('react-native', () => {
  // Build a tiny set of host-style components: each renders its children
  // through a passthrough <div>. Props are forwarded so testing-library's
  // queries (accessibilityLabel, accessibilityRole) keep working — react
  // attributes on a JSDOM <div> are visible via getAttribute.
  function makeComponent(name: string) {
    return React.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, ...rest } = props;
      const dom: Record<string, unknown> = { ref, 'data-testid': name, ...rest };
      if (typeof accessibilityLabel === 'string') {
        dom['aria-label'] = accessibilityLabel;
      }
      if (typeof accessibilityRole === 'string') {
        dom['role'] = accessibilityRole;
      }
      if (typeof onPress === 'function') {
        dom['onClick'] = onPress;
      }
      return React.createElement('div', dom, children as React.ReactNode);
    });
  }
  return {
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    SafeAreaView: makeComponent('SafeAreaView'),
    StatusBar: () => null,
    Image: makeComponent('Image'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(s: T): T => s,
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: <T>(o: { android?: T; ios?: T; default?: T }) => o.android ?? o.default,
    },
  };
});
