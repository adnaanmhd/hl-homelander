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
import { vi, expect } from 'vitest';
import * as React from 'react';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

// ---------------------------------------------------------------------------
// `__DEV__` global shim (Plan 04-01).
//
// React Native's bundler (Metro) defines the `__DEV__` global at build time;
// the jsdom test environment does not, so any component that reads `__DEV__`
// (e.g. HomeSkeletonScreen.tsx's dev-only debug block) crashes with
// `ReferenceError: __DEV__ is not defined` at render time — taking out the
// Home tab, the navigator boot, and every visual snapshot that renders it.
// Mirror Metro's default for a debug build. Tests that need the production
// branch can `vi.stubGlobal('__DEV__', false)` per-suite.
// ---------------------------------------------------------------------------
if (typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'undefined') {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
}

// ---------------------------------------------------------------------------
// Phase 3 Wave 1 — visual snapshot adapter (D-WAVE-06).
//
// jest-image-snapshot ships an `expect.extend`-shaped matcher that compares
// a PNG Buffer against a baseline PNG on disk; per-test PNG buffers are
// produced by Plan 03-02 / 03-03 via a screen-to-PNG renderer and asserted
// via `expect(png).toMatchImageSnapshot()`. Defaults: baselines live in
// `__image_snapshots__/` adjacent to each test file (Plan 03-01 commits the
// shared baseline directory `__tests__/visual/__image_snapshots__/.gitkeep`
// so the convention's well-known location is in-repo from day one).
//
// Extending vitest's `expect` here (not per-test) keeps the matcher visible
// to every test file that opts into visual baselines without a per-suite
// import. The `declare module 'vitest'` block below makes the matcher
// type-visible to Plan 03-02's TypeScript test files.
// ---------------------------------------------------------------------------
expect.extend({ toMatchImageSnapshot });

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toMatchImageSnapshot(opts?: Parameters<typeof toMatchImageSnapshot>[0]): T;
  }
  interface AsymmetricMatchersContaining {
    toMatchImageSnapshot(opts?: Parameters<typeof toMatchImageSnapshot>[0]): unknown;
  }
}

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
    // Phase 6 Plan 06-07 — TasksScreen uses FlatList numColumns={2} for the
    // 2-col task-card grid. Test shim renders the `data` array through the
    // `renderItem` callback so testing-library can query each rendered card
    // by its accessibility-label / text content. `keyExtractor` is honoured.
    // SectionList (Phase 6 06-09 History) follows the same pattern.
    FlatList: function FlatListShim<TItem>(props: {
      data?: readonly TItem[];
      renderItem?: (info: { item: TItem; index: number }) => React.ReactNode;
      keyExtractor?: (item: TItem, index: number) => string;
      ListEmptyComponent?: React.ReactNode | React.ComponentType;
      ListFooterComponent?: React.ReactNode | React.ComponentType;
      accessibilityLabel?: string;
    }) {
      const items = props.data ?? [];
      const children: React.ReactNode[] = [];
      if (items.length === 0 && props.ListEmptyComponent) {
        const E = props.ListEmptyComponent as React.ReactNode;
        children.push(typeof E === 'function' ? React.createElement(E as React.ComponentType) : E);
      } else {
        items.forEach((item, index) => {
          const key = props.keyExtractor ? props.keyExtractor(item, index) : String(index);
          if (props.renderItem) {
            children.push(
              React.createElement(
                React.Fragment,
                { key },
                props.renderItem({ item, index }) as React.ReactNode,
              ),
            );
          }
        });
      }
      if (props.ListFooterComponent) {
        const F = props.ListFooterComponent as React.ReactNode;
        children.push(typeof F === 'function' ? React.createElement(F as React.ComponentType) : F);
      }
      const dom: Record<string, unknown> = { 'data-testid': 'FlatList' };
      if (typeof props.accessibilityLabel === 'string')
        dom['aria-label'] = props.accessibilityLabel;
      return React.createElement('div', dom, children);
    },
    SectionList: function SectionListShim<TItem>(props: {
      sections?: ReadonlyArray<{ title?: string; data: readonly TItem[] }>;
      renderItem?: (info: { item: TItem; index: number; section: unknown }) => React.ReactNode;
      renderSectionHeader?: (info: { section: { title?: string } }) => React.ReactNode;
      keyExtractor?: (item: TItem, index: number) => string;
      ListEmptyComponent?: React.ReactNode | React.ComponentType;
      ListFooterComponent?: React.ReactNode | React.ComponentType;
      ListHeaderComponent?: React.ReactNode | React.ComponentType;
      accessibilityLabel?: string;
    }) {
      const sections = props.sections ?? [];
      const children: React.ReactNode[] = [];
      if (props.ListHeaderComponent) {
        const H = props.ListHeaderComponent as React.ReactNode;
        children.push(typeof H === 'function' ? React.createElement(H as React.ComponentType) : H);
      }
      if (sections.length === 0 && props.ListEmptyComponent) {
        const E = props.ListEmptyComponent as React.ReactNode;
        children.push(typeof E === 'function' ? React.createElement(E as React.ComponentType) : E);
      } else {
        sections.forEach((section, sIdx) => {
          if (props.renderSectionHeader) {
            children.push(
              React.createElement(
                React.Fragment,
                { key: `sh-${sIdx}` },
                props.renderSectionHeader({ section }) as React.ReactNode,
              ),
            );
          }
          section.data.forEach((item, iIdx) => {
            const key = props.keyExtractor ? props.keyExtractor(item, iIdx) : `s${sIdx}-i${iIdx}`;
            if (props.renderItem) {
              children.push(
                React.createElement(
                  React.Fragment,
                  { key },
                  props.renderItem({ item, index: iIdx, section }) as React.ReactNode,
                ),
              );
            }
          });
        });
      }
      if (props.ListFooterComponent) {
        const F = props.ListFooterComponent as React.ReactNode;
        children.push(typeof F === 'function' ? React.createElement(F as React.ComponentType) : F);
      }
      const dom: Record<string, unknown> = { 'data-testid': 'SectionList' };
      if (typeof props.accessibilityLabel === 'string')
        dom['aria-label'] = props.accessibilityLabel;
      return React.createElement('div', dom, children);
    },
    TextInput: makeTextInput(),
    Modal: makeComponent('Modal'),
    StatusBar: () => null,
    Image: makeComponent('Image'),
    // Plan 04-07 — GateRing renders an <ActivityIndicator> inside the ring
    // well while the camera is loading (HAND-06). Host-component shim: a
    // pass-through <div> like View; JSDOM never spins it.
    ActivityIndicator: makeComponent('ActivityIndicator'),
    // Phase 6 Wave 5 (Plan 06-09) — HomeScreen + HistoryScreen pass a
    // <RefreshControl/> through ScrollView.refreshControl / SectionList.
    // The host-component shim is a passthrough <div>; the pull-to-refresh
    // gesture path is exercised on-hardware (Detox), not in unit tests.
    // HomeScreen.test.tsx still ships its own per-file react-native re-mock
    // for fine-grained PTR introspection; this entry keeps the shared
    // setup self-sufficient for screens that don't need that level of
    // control (e.g. MainTabs which only needs the navigator to boot
    // without resolving RefreshControl as undefined).
    RefreshControl: makeComponent('RefreshControl'),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(s: T): T => s,
      flatten: <T>(s: T): T => s,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    NativeModules: {},
    // debug handgate-never-passes — RecordingScreen mounts the native
    // <HumynGateCameraView> (a Camera2-backed TextureView) via
    // `requireNativeComponent('HumynGateCameraView')`. Under jsdom there's no
    // native view registry, so this returns a pass-through host-component shim
    // (a <div> like View) keyed by name; JSDOM never renders a camera feed.
    requireNativeComponent: (name: string) => makeComponent(name),
    // Plan 04-09 — RecordingScreen mounts useRecordingLifecycle (plan 04-08),
    // whose HumynPhoneState / HumynBattery bindings construct a
    // NativeEventEmitter on first subscribe. The canonical react-native shim
    // didn't expose it; a tiny no-op emitter is enough for jsdom (no native
    // events fire). `addListener` returns the EmitterSubscription handle the
    // T-3.3-04 leak-mitigation contract expects.
    NativeEventEmitter: class {
      addListener() {
        return { remove: () => undefined };
      }
      removeAllListeners() {
        /* no-op */
      }
      removeSubscription() {
        /* no-op */
      }
    },
    Platform: {
      OS: 'android',
      select: <T>(o: { android?: T; ios?: T; default?: T }) => o.android ?? o.default,
    },
    // Plan 02-20 — ForceUpgradeScreen depends on BackHandler (hardware-back
    // override per D-NAV-04), Alert (integrity-check error copy per
    // D-UPG-02), and Linking (playStore market:// fallback). Each is
    // stubbed with a no-op implementation so screens can import them at
    // module-eval without failing under JSDOM. Per-test files override
    // these via `vi.mocked()` or per-test `vi.mock('react-native', ...)`.
    BackHandler: {
      addEventListener: () => ({ remove: () => undefined }),
      removeEventListener: () => undefined,
      exitApp: () => undefined,
    },
    Alert: {
      alert: () => undefined,
    },
    Linking: {
      openURL: () => Promise.resolve(),
      canOpenURL: () => Promise.resolve(true),
    },
    // Plan 02-10 / quick-260510-007 — PermissionsScreen subscribes to
    // AppState 'change' to re-check permission status when the user returns
    // from the Settings deep-link. Default stub returns a no-op subscription;
    // per-test files override via `vi.mocked(...)` or per-test mocks to
    // capture the listener and fire 'active' synthetically.
    AppState: {
      currentState: 'active' as const,
      addEventListener: () => ({ remove: () => undefined }),
    },
    // Plan 04-06 — PracticeCompleteScreen fires Vibration.vibrate([…]) on
    // enter (the [40,80,40]ms practice-done haptic, engineering-handoff
    // §6.2). Default stub is a no-op; per-test files override via
    // `vi.mocked(...)` or a per-test `vi.mock('react-native', …)` shim to
    // assert the call args.
    Vibration: {
      vibrate: () => undefined,
      cancel: () => undefined,
    },
    // Phase 6 Plan 06-10 — PlayerScreen's ScrubBar uses PanResponder for
    // drag-to-seek. JSDOM has no touch gesture system; the mock returns a
    // `panHandlers` object that test renderers can spread onto a View
    // without crashing useMemo/PanResponder.create(). Per-test files can
    // re-mock to assert handler invocations if needed.
    PanResponder: {
      create: () => ({ panHandlers: {} }),
    },
    // Animated — minimal stub so that CompatRing (plan 02-15 Task 2) can
    // call `Animated.createAnimatedComponent(Circle)` and
    // `Animated.timing(...).start()` at module-init time. JSDOM never
    // executes the actual animation; the AnimatedCircle just renders the
    // wrapped SVG primitive once.
    //
    // Plan 03-02 fix-forward (deferred-items.md handoff from 03-01):
    // SplashScreen + RootNativeStack tests were failing with
    // `Element type is invalid: ... got: undefined` because the splash
    // animation refactor (commits 5fe1443 + 5b9629c) introduced
    // `<Animated.View>` consumers but the mock here only stubbed the
    // imperative API surface (Value, timing, parallel, …). React resolved
    // `Animated.View` to undefined and threw at render time. Adding View
    // and Text host-component-shim siblings makes the screen render with
    // its animation wrappers in JSDOM (no actual animation executes — the
    // Animated.timing(...).start() chain is still a no-op).
    Animated: {
      View: makeComponent('AnimatedView'),
      Text: makeComponent('AnimatedText'),
      Image: makeComponent('AnimatedImage'),
      ScrollView: makeComponent('AnimatedScrollView'),
      Value: class AnimatedValueShim {
        _v: number;
        constructor(v: number) {
          this._v = v;
        }
        setValue(v: number) {
          this._v = v;
        }
        addListener() {
          return 'shim-id';
        }
        removeListener() {
          /* no-op */
        }
        removeAllListeners() {
          /* no-op */
        }
        stopAnimation() {
          /* no-op */
        }
        // RotatePrompt et al. do `value.interpolate({...})` then feed the result
        // into a style transform — return a fresh shim so the chain doesn't
        // throw; JSDOM never runs the actual interpolation.
        interpolate() {
          return new AnimatedValueShim(0);
        }
      },
      timing: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      spring: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      decay: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      sequence: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      parallel: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      stagger: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      loop: () => ({ start: () => undefined, stop: () => undefined }),
      delay: () => ({ start: (cb?: () => void) => cb?.(), stop: () => undefined }),
      createAnimatedComponent: <T>(c: T) => c,
    },
    Easing: {
      bezier: () => () => 0,
      linear: () => 0,
      ease: () => 0,
      quad: () => 0,
      cubic: () => 0,
      inOut: () => () => 0,
      out: () => () => 0,
      in: () => () => 0,
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
// @react-navigation/bottom-tabs — passthrough that ALSO invokes the `tabBar`
// callback prop with a synthetic state. Phase 2 plan 02-05's MainTabs test
// asserts that the tabBar (BottomNav) renders three Pressables with
// accessibilityLabel="{Name} tab"; without invoking the callback the labels
// never reach the DOM. State.routes is derived from the children's `name`
// prop so the mock is generic.
// ---------------------------------------------------------------------------
vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: (props: {
      children?: React.ReactNode;
      tabBar?: (
        p: Record<string, unknown> & {
          state: { index: number; routes: Array<{ name: string; key: string }> };
          navigation: { emit: () => { defaultPrevented: boolean }; navigate: () => void };
        },
      ) => React.ReactElement;
    }) => {
      // Build state.routes from the Screen children's `name` props.
      const childArray = React.Children.toArray(props.children) as Array<{
        props?: { name?: string };
      }>;
      const routes = childArray
        .filter((c) => typeof c.props?.name === 'string')
        .map((c) => ({ name: c.props!.name as string, key: c.props!.name as string }));
      const tabBarEl = props.tabBar
        ? props.tabBar({
            state: { index: 0, routes },
            navigation: {
              emit: () => ({ defaultPrevented: false }),
              navigate: () => undefined,
            },
          })
        : null;
      return React.createElement(React.Fragment, null, props.children as React.ReactNode, tabBarEl);
    },
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
      // Plan 06-04 — `getAllKeys()` is on the real react-native-mmkv@4.x
      // Nitro spec (`MMKV.nitro.d.ts:443`). thumbnailLedger.cleanupOpportunistic
      // (D-04a opportunistic cold-start GC) iterates every key and removes the
      // ones whose `pendingThumb.{id}.v1` recordingId is not in the server's
      // recent set. Add to the mock for parity with the production API.
      getAllKeys(): string[] {
        return Array.from(getStore(id).keys());
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
    getAllKeys: () => string[];
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
      this.getAllKeys = inst.getAllKeys;
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
//
// Vitest 4 ES-module namespace strictness: `import * as X` only sees the
// keys returned from the factory at call time. A bare Proxy with a `get`
// trap doesn't expose any named exports, so a consumer doing
// `LucideIcons[name]` after `import * as LucideIcons` gets `undefined`
// (the Proxy's `get` is never invoked through the namespace wrapper).
// We keep the Proxy as a fallback for unknown names but pre-populate every
// icon Phase 2 components reference so the namespace lookup resolves.
// ---------------------------------------------------------------------------
vi.mock('lucide-react-native', () => {
  function makeIcon(name: string) {
    const Component = (props: Record<string, unknown>) =>
      React.createElement('span', { 'data-icon': name, ...props });
    (Component as unknown as { displayName: string }).displayName = name;
    return Component;
  }
  // Pre-populated allow-list for Phase 2: BottomNav uses Home/ListTodo/History;
  // primitives.test.tsx may exercise others. Add to this list as plans land.
  const ICONS = [
    'Home',
    'ListTodo',
    'History',
    'User',
    'HelpCircle',
    'Settings',
    'ArrowLeft',
    'ChevronRight',
    // Phase 2 plan 02-18 — AccordionItem header chevron flips between
    // ChevronDown (collapsed) and ChevronUp (expanded). HelpCenterScreen
    // renders a stack of AccordionItems so both icons must resolve.
    'ChevronDown',
    'ChevronUp',
    'Camera',
    'Mic',
    'Check',
    'X',
    'AlertTriangle',
    'Info',
    // Phase 2 plan 02-10 — PermissionsScreen denied/partial state uses `Ban`
    // (Lucide equivalent of the design-spec §4.1.1 `block` icon).
    'Ban',
    // Plan 04-07 — RecordingScreen close button reuses `X` (above); the
    // RotatePrompt body shows a phone-rotate glyph (`RotateCw`).
    'RotateCw',
    // Phase 6 Plan 06-07 — Tasks tab icon names.
    // SearchInput: Search (leading) + X (clear, already in list above).
    // UniversalRulesBlock: HandMetal/Video/Lightbulb/LayoutGrid lucide stand-
    // ins for the Material Symbols (front_hand / videocam / lightbulb / apps).
    // TasksScreen no-results: SearchX (verified available in lucide@1.14.0).
    // SendRequestSheet sample-video tile: Paperclip.
    // TaskCard / TaskIcon fallback (design-system/task-icons): Sparkles.
    'Search',
    'SearchX',
    'HandMetal',
    'Video',
    'Lightbulb',
    'LayoutGrid',
    'Sparkles',
    'Paperclip',
    'Inbox',
    'WifiOff',
    // Phase 6 Plan 06-10 — PlayerScreen top bar (Lock = view-only badge,
    // §14) and the 64×64 round centered play overlay (Play = the paused-
    // state affordance). `X` is already in the list above (re-used as the
    // top-left close affordance).
    'Lock',
    'Play',
  ] as const;
  const exports: Record<string, unknown> = {};
  for (const name of ICONS) {
    exports[name] = makeIcon(name);
  }
  return exports;
});

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

// react-native-config — its index.js uses bare `export const X = require(...)`
// against a native codegen module that vitest cannot transform. Stub with an
// empty record; tests that need specific .env values can override with
// `vi.mocked(Config).XYZ = '...'` per-suite.
vi.mock('react-native-config', () => {
  const Config: Record<string, string> = {};
  return { default: Config, Config };
});

// @react-native-google-signin/google-signin — the package's lib/module/index.js
// re-exports through subpath files vitest cannot resolve under jsdom. Stub the
// surface auth.ts touches: GoogleSignin.{configure,signIn,signOut,getCurrentUser}.
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    hasPlayServices: vi.fn(() => Promise.resolve(true)),
  },
  statusCodes: {},
}));

// react-native-keychain — secure-credential storage; auth.ts uses get/set/reset.
vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn(() => Promise.resolve(false)),
  getGenericPassword: vi.fn(() => Promise.resolve(false)),
  resetGenericPassword: vi.fn(() => Promise.resolve(true)),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  ACCESS_CONTROL: {},
  AUTHENTICATION_TYPE: {},
  STORAGE_TYPE: {},
  SECURITY_LEVEL: {},
}));

// ===========================================================================
// Phase 4 — handdetector / recording-UX / practice / tutorial.
//
// Plan 04-01 added the locked Phase 4 RN library deps plus jsdom mocks so the
// Wave 2/3/4 plans can `import` + unit-test the recording surface without
// invoking any native bridge. The pre-record hand-gate originally ran on
// `react-native-vision-camera` (preview + `takePhoto()`); the debug session
// `handgate-never-passes` (2026-05) replaced it with the hand-rolled native
// Camera2 gate camera (`HumynGateCamera` / `<HumynGateCameraView>`), and
// `react-native-vision-camera` + its `react-native-worklets-core` peer were
// dropped from package.json. So there is no VisionCamera mock here anymore —
// the gate-camera native module is mocked via `vi.doMock('react-native', …)`
// in the recording-screen tests (the same per-file convention HumynCapture /
// HumynHandDetector use), and `<HumynGateCameraView>` is stubbed where
// `requireNativeComponent` is mocked (see above). The HEVC video pipeline is
// the hand-rolled HumynCapture native module (CLAUDE.md "Do NOT Use" — never
// VisionCamera for video).
// ===========================================================================

// ---------------------------------------------------------------------------
// react-native-tts — default export object; mirrors the idea-brief §13 voice
// fallback chain (en-IN female → en-IN any → en-US female → first en-*). The
// `voices()` stub returns en-IN + en-US so the picker resolves a real choice;
// `getInitStatus` resolves 'success' so the TTS bootstrap code's happy path
// fires. Event listeners return a `{ remove }` subscription handle.
// ---------------------------------------------------------------------------
vi.mock('react-native-tts', () => {
  const Tts = {
    getInitStatus: vi.fn().mockResolvedValue('success'),
    voices: vi.fn().mockResolvedValue([
      { id: 'en-in-x-ene-local', language: 'en-IN', quality: 300, notInstalled: false },
      { id: 'en-us-x-tpf-local', language: 'en-US', quality: 300, notInstalled: false },
    ]),
    setDefaultVoice: vi.fn().mockResolvedValue(undefined),
    setDefaultRate: vi.fn(),
    setDefaultPitch: vi.fn(),
    setDefaultLanguage: vi.fn(),
    setIgnoreSilentSwitch: vi.fn(),
    setDucking: vi.fn(),
    speak: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    removeAllListeners: vi.fn(),
  };
  return { default: Tts, ...Tts };
});

// ---------------------------------------------------------------------------
// react-native-fs — exported BOTH as named exports and a default object
// (consumers use `import RNFS from 'react-native-fs'` AND `import { mkdir }
// from 'react-native-fs'`). `exists` defaults false; `getFSInfo` returns a
// healthy 64 GB / 32 GB free so the storage-headroom guard's happy path runs.
// ---------------------------------------------------------------------------
vi.mock('react-native-fs', () => {
  const RNFS = {
    CachesDirectoryPath: '/tmp/mock-caches',
    DocumentDirectoryPath: '/tmp/mock-docs',
    TemporaryDirectoryPath: '/tmp/mock-tmp',
    ExternalDirectoryPath: '/tmp/mock-external',
    mkdir: vi.fn().mockResolvedValue(undefined),
    moveFile: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    readDir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 0, isFile: () => true, isDirectory: () => false }),
    getFSInfo: vi.fn().mockResolvedValue({ totalSpace: 64 * 1e9, freeSpace: 32 * 1e9 }),
    hash: vi.fn().mockResolvedValue('0'.repeat(64)),
  };
  return { default: RNFS, ...RNFS };
});

// ---------------------------------------------------------------------------
// react-native-orientation-locker — default export object + named exports
// (`OrientationType` const map, `OrientationLocker` no-op component). Phase 4
// `RecordingScreen` is the ONLY landscape-locked surface — `lockToLandscape`
// on mount, `unlockAllOrientations` on unmount. All listener APIs are no-op
// spies; the getters resolve PORTRAIT (irrelevant in jsdom — device-frame
// orientation is integration-tested on hardware, not unit tests).
// ---------------------------------------------------------------------------
vi.mock('react-native-orientation-locker', () => {
  // orientation-locker's OrientationType enum — the five canonical strings.
  // Object keys containing a dash MUST be quoted.
  const ENUM = {
    PORTRAIT: 'PORTRAIT',
    'LANDSCAPE-LEFT': 'LANDSCAPE-LEFT',
    'LANDSCAPE-RIGHT': 'LANDSCAPE-RIGHT',
    'PORTRAIT-UPSIDEDOWN': 'PORTRAIT-UPSIDEDOWN',
    UNKNOWN: 'UNKNOWN',
  };
  const Orientation = {
    lockToLandscape: vi.fn(),
    lockToLandscapeLeft: vi.fn(),
    lockToLandscapeRight: vi.fn(),
    lockToPortrait: vi.fn(),
    unlockAllOrientations: vi.fn(),
    getOrientation: vi.fn((cb: (o: string) => void) => cb('PORTRAIT')),
    getDeviceOrientation: vi.fn((cb: (o: string) => void) => cb('PORTRAIT')),
    getInitialOrientation: vi.fn(() => 'PORTRAIT'),
    addOrientationListener: vi.fn(),
    removeOrientationListener: vi.fn(),
    addDeviceOrientationListener: vi.fn(),
    removeDeviceOrientationListener: vi.fn(),
    addLockListener: vi.fn(),
    removeLockListener: vi.fn(),
    configure: vi.fn(),
  };
  const OrientationLocker = () => null;
  return { default: Orientation, OrientationType: ENUM, OrientationLocker };
});

// ---------------------------------------------------------------------------
// NativeModules — canonical Phase 4 native-module stub shapes.
//
// CONTRACT (preserved from Phase 3): the `react-native` mock above leaves
// `NativeModules` as `{}`. Per-file tests that need a specific native module
// `vi.doMock('react-native', () => ({ NativeModules: { HumynX: { ... } }, ... }))`
// — see __tests__/native/HumynCapture.test.ts and HumynCompat.test.ts. Plan
// 04-01 does NOT change that contract; it documents the canonical stub shapes
// here so per-file mocks across the Phase 4 plans stay consistent. The five
// new in-house Kotlin native modules (D-WAVE-01) and their JS stub shapes:
//
//   HumynHandDetector  — MediaPipe HandLandmarker IMAGE mode, hand-count only:
//     { detectHands: vi.fn().mockResolvedValue(0),
//       cleanup: vi.fn().mockResolvedValue(undefined) }
//   HumynPhoneState    — AudioManager.OnAudioFocusChangeListener ONLY (no
//                        READ_PHONE_STATE / TelephonyManager — corrected
//                        RESEARCH D-LIFE-02):
//     { start: vi.fn().mockResolvedValue(undefined),
//       stop:  vi.fn().mockResolvedValue(undefined) }
//   HumynBattery       — ACTION_BATTERY_CHANGED broadcast bridge:
//     { start: vi.fn().mockResolvedValue(undefined),
//       stop:  vi.fn().mockResolvedValue(undefined) }
//   HumynScreenBrightness — per-window brightness override (NOT Settings.System):
//     { set: vi.fn().mockResolvedValue(undefined) }
//   HumynBeep          — SoundPool over a pre-baked .wav:
//     { playTone: vi.fn().mockResolvedValue(undefined) }
//
// Each is also exposed via NativeEventEmitter where it emits events; bindings
// must return the EmitterSubscription (`{ remove }`) so callers can unsubscribe
// (the T-3.3-04 leak-mitigation contract — mirrored from HumynCapture).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// @react-native-firebase/remote-config — Plan 04-09's HAND-11 gate-config
// reads (`readGateConfig`). The package's lib/index.js is a native-codegen
// module vitest cannot transform under jsdom; stub the surface readGateConfig
// touches: `remoteConfig().{setDefaults,fetchAndActivate,getValue(...).asNumber()}`.
// Default returns 0 from asNumber() so readGateConfig falls back to its
// hard-coded Android defaults (5/400/0.5). Per-test files override via
// `vi.mock('@react-native-firebase/remote-config', …)` for branch coverage.
// ---------------------------------------------------------------------------
vi.mock('@react-native-firebase/remote-config', () => {
  const instance = {
    setDefaults: vi.fn().mockResolvedValue(true),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: (_key: string) => ({ asNumber: (): number => 0 }),
  };
  return { default: () => instance };
});
