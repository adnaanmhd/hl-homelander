// Vitest setup file. Stubs the React Native runtime + every RN-ecosystem
// dependency that Phase 2 plans rely on, so a JSDOM environment can render
// component trees without invoking any native bridge.
//
// Phase 1 contributed the `react-native` host-component shim. Phase 2
// (plan 02-02) extended this file with mocks for: @react-navigation/native,
// @react-navigation/native-stack, @react-navigation/bottom-tabs,
// react-native-screens, react-native-safe-area-context, react-native-mmkv,
// react-native-reanimated, react-native-haptic-feedback,
// react-native-permissions, lucide-react-native, react-native-svg.
//
// Service-level mocks (e.g. `vi.mock('../src/services/auth', ...)`) still
// happen at the test-file level — these vi.mock calls only stub the
// platform/library modules so transitive imports never reach native code.
import { vi } from 'vitest';
import * as React from 'react';

// ---------------------------------------------------------------------------
// react-native (Phase 1 host-component shim — DO NOT alter without re-running
// Phase 1's SignIn.test.tsx; those queries depend on the data-testid + role +
// aria-label mapping below)
// ---------------------------------------------------------------------------
// Resolve an RN-style prop into a plain DOM-friendly style object.
// RN accepts: object, array of objects/falsy, or (Pressable only) a function
// (state) => array. JSDOM/React-DOM accepts only an object. This helper
// collapses every RN shape into a flat object so the shim's <div>/<input>
// receives a valid `style`. Falsy entries (null/undefined/false) are skipped.
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
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}

vi.mock('react-native', () => {
  // Build a tiny set of host-style components: each renders its children
  // through a passthrough <div>. Props are forwarded so testing-library's
  // queries (accessibilityLabel, accessibilityRole) keep working — react
  // attributes on a JSDOM <div> are visible via getAttribute. `style` is
  // resolved through `resolveStyle` so RN's array-of-objects / function
  // (Pressable) shapes don't choke React-DOM.
  function makeComponent(name: string) {
    return React.forwardRef<
      HTMLDivElement,
      Record<string, unknown> & { children?: React.ReactNode }
    >(function HostComponent(props, ref) {
      const { children, accessibilityLabel, accessibilityRole, onPress, style, ...rest } = props;
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
      const resolved = resolveStyle(style);
      if (resolved) {
        dom['style'] = resolved;
      }
      return React.createElement('div', dom, children as React.ReactNode);
    });
  }
  // TextInput needs a value/onChangeText shim that maps to <input> so Field
  // primitive tests (plan 02-02 Task 4) can drive value changes via
  // fireEvent.change. Keep the same accessibility-attribute forwarding.
  function makeTextInput() {
    return React.forwardRef<
      HTMLInputElement,
      Record<string, unknown> & {
        value?: string;
        onChangeText?: (text: string) => void;
        placeholder?: string;
      }
    >(function TextInputShim(props, ref) {
      const {
        value,
        onChangeText,
        accessibilityLabel,
        accessibilityRole,
        style,
        // RN-only props that don't map to <input> — drop them so React-DOM
        // doesn't warn about unknown attributes.
        placeholderTextColor: _ptc,
        secureTextEntry: _ste,
        keyboardType: _kt,
        ...rest
      } = props;
      const dom: Record<string, unknown> = {
        ref,
        'data-testid': 'TextInput',
        value: value ?? '',
        ...rest,
      };
      if (typeof accessibilityLabel === 'string') {
        dom['aria-label'] = accessibilityLabel;
      }
      if (typeof accessibilityRole === 'string') {
        dom['role'] = accessibilityRole;
      }
      if (typeof onChangeText === 'function') {
        dom['onChange'] = (e: { target: { value: string } }) => onChangeText(e.target.value);
      }
      const resolved = resolveStyle(style);
      if (resolved) {
        dom['style'] = resolved;
      }
      return React.createElement('input', dom);
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
      create: <T extends Record<string, unknown>>(s: T): T => s,
      flatten: <T>(s: T): T => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    Platform: {
      OS: 'android',
      select: <T>(o: { android?: T; ios?: T; default?: T }) => o.android ?? o.default,
    },
  };
});

// ---------------------------------------------------------------------------
// @react-navigation/native — NavigationContainer is a passthrough; navigation
// hooks return spy-able stub fns so screen tests can assert on
// useNavigation().replace / .reset / etc.
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children as React.ReactElement,
  useNavigation: () => ({
    replace: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
    pop: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
  useIsFocused: () => true,
}));

// ---------------------------------------------------------------------------
// @react-navigation/native-stack — Navigator and Screen are passthroughs that
// let a Phase 2 navigation tree render its initial route without React Native's
// real screen lifecycle plumbing.
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
    Screen: ({ component: Component }: { component?: React.ComponentType }) =>
      Component ? React.createElement(Component) : null,
  }),
}));

// ---------------------------------------------------------------------------
// @react-navigation/bottom-tabs — same passthrough shape.
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
    Screen: ({ component: Component }: { component?: React.ComponentType }) =>
      Component ? React.createElement(Component) : null,
  }),
}));

// ---------------------------------------------------------------------------
// react-native-screens — enableScreens is a no-op in JSDOM.
// ---------------------------------------------------------------------------
vi.mock('react-native-screens', () => ({
  enableScreens: () => null,
  enableFreeze: () => null,
}));

// ---------------------------------------------------------------------------
// react-native-safe-area-context — provider is a passthrough; insets are
// always zero in JSDOM (real device-frame insets are integration-tested on
// device, not in unit tests).
// ---------------------------------------------------------------------------
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children as React.ReactElement,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ---------------------------------------------------------------------------
// react-native-mmkv — in-memory store keyed by `id`. Both surfaces are
// exported because:
//   - Phase 1 auth.ts uses `createMMKV({ id, encryptionKey })` (factory)
//   - Future Phase 2 services may use `new MMKV({ id })` (class form per
//     react-native-mmkv docs)
// Both forms hit the same shared in-memory store.
// ---------------------------------------------------------------------------
vi.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  function getStore(id: string) {
    if (!stores.has(id)) stores.set(id, new Map());
    return stores.get(id)!;
  }
  function makeInstance(id: string) {
    return {
      id,
      set(k: string, v: string | number | boolean) {
        getStore(id).set(k, String(v));
      },
      getString(k: string) {
        return getStore(id).get(k);
      },
      getNumber(k: string) {
        const v = getStore(id).get(k);
        return v === undefined ? undefined : Number(v);
      },
      getBoolean(k: string) {
        const v = getStore(id).get(k);
        return v === 'true';
      },
      delete(k: string) {
        getStore(id).delete(k);
      },
      remove(k: string) {
        getStore(id).delete(k);
      },
      contains(k: string) {
        return getStore(id).has(k);
      },
      clearAll() {
        getStore(id).clear();
      },
    };
  }
  class MMKV {
    id: string;
    set: (k: string, v: string | number | boolean) => void;
    getString: (k: string) => string | undefined;
    getNumber: (k: string) => number | undefined;
    getBoolean: (k: string) => boolean;
    delete: (k: string) => void;
    remove: (k: string) => void;
    contains: (k: string) => boolean;
    clearAll: () => void;
    constructor(opts: { id?: string } = {}) {
      const i = opts.id ?? 'default';
      const inst = makeInstance(i);
      this.id = inst.id;
      this.set = inst.set;
      this.getString = inst.getString;
      this.getNumber = inst.getNumber;
      this.getBoolean = inst.getBoolean;
      this.delete = inst.delete;
      this.remove = inst.remove;
      this.contains = inst.contains;
      this.clearAll = inst.clearAll;
    }
  }
  function createMMKV(opts: { id?: string; encryptionKey?: string } = {}) {
    return makeInstance(opts.id ?? 'default');
  }
  return { MMKV, createMMKV };
});

// ---------------------------------------------------------------------------
// react-native-reanimated — animated APIs collapse to identity functions in
// JSDOM. Only the subset of functions Phase 2 imports is stubbed; add more
// as plans land.
// ---------------------------------------------------------------------------
vi.mock('react-native-reanimated', () => ({
  default: { View: 'View', Text: 'Text' },
  useSharedValue: <T>(v: T) => ({ value: v }),
  useAnimatedStyle: (cb: () => Record<string, unknown>) => cb(),
  useAnimatedProps: (cb: () => Record<string, unknown>) => cb(),
  useDerivedValue: <T>(cb: () => T) => ({ value: cb() }),
  withTiming: <T>(v: T) => v,
  withSequence: <T>(...vs: T[]) => vs[vs.length - 1],
  withSpring: <T>(v: T) => v,
  withDelay: <T>(_d: number, v: T) => v,
  Easing: {
    inOut: () => () => 0,
    linear: () => 0,
    bezier: () => () => 0,
  },
  runOnJS: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  runOnUI: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// ---------------------------------------------------------------------------
// react-native-haptic-feedback — trigger is a spy-able no-op.
// ---------------------------------------------------------------------------
vi.mock('react-native-haptic-feedback', () => ({
  default: { trigger: vi.fn() },
  trigger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// react-native-permissions — every call defaults to "granted" so screens that
// use react-native-permissions inside useEffect render their happy-path UI.
// Tests can `vi.mocked(check).mockResolvedValueOnce('blocked')` etc. for
// per-test branch coverage.
// ---------------------------------------------------------------------------
vi.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      MICROPHONE: 'ios.permission.MICROPHONE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
  request: vi.fn(async () => 'granted'),
  check: vi.fn(async () => 'granted'),
  requestMultiple: vi.fn(async () => ({})),
  checkMultiple: vi.fn(async () => ({})),
  openSettings: vi.fn(),
}));

// ---------------------------------------------------------------------------
// lucide-react-native — every icon lookup returns a stub component that
// renders <span data-icon={name} />. Lets primitive tests assert the right
// icon was rendered without importing every icon explicitly.
// ---------------------------------------------------------------------------
vi.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (typeof prop !== 'string') return undefined;
          const name = String(prop);
          const Component = (props: Record<string, unknown>) =>
            React.createElement('span', { 'data-icon': name, ...props });
          (Component as unknown as { displayName: string }).displayName = name;
          return Component;
        },
      },
    ),
);

// ---------------------------------------------------------------------------
// react-native-svg — primitives map to plain SVG DOM elements. testing-library
// queries (getByLabelText) work directly because aria-labels propagate.
// ---------------------------------------------------------------------------
vi.mock('react-native-svg', () => ({
  default: ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('svg', rest, children as React.ReactNode),
  Svg: ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('svg', rest, children as React.ReactNode),
  Circle: (props: Record<string, unknown>) => React.createElement('circle', props),
  Path: (props: Record<string, unknown>) => React.createElement('path', props),
  G: ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('g', rest, children as React.ReactNode),
  Rect: (props: Record<string, unknown>) => React.createElement('rect', props),
  Line: (props: Record<string, unknown>) => React.createElement('line', props),
}));
