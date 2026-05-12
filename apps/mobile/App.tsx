// Phase 2 root component — replaces the Phase 1 single-SignIn render with
// the full React Navigation v7 graph (D-NAV-01..04 + HOME-07/08).
//
// Boot sequence:
//   1. enableScreens(true) — react-native-screens primitives are enabled
//      before any navigator mounts (D-NAV-02).
//   2. hydrate() — synchronously reads MMKV into Zustand. MMKV is sync,
//      Zustand setState is sync, the whole call is microsecond-cheap and
//      never returns a promise.
//   3. installBootRecoveryListener() — D-LIFE-04 one-shot: subscribes to the
//      Phase-3 sweep's onCrashRecovery event and shows the Home "Recording
//      recovered after force-quit — uploading." toast (best-effort; no-op when
//      the native module isn't registered).
//   4. <NavigationContainer linking> wraps <RootNativeStack>. RootNativeStack
//      reads useAppStore.getState() at render to compute initialRouteName
//      via computeInitialRoute(state, currentSig). <ToastHost /> floats over
//      everything as a sibling so any screen / boot listener can showToast(...).
//
// SafeAreaProvider supplies real device-frame insets to ScreenContainer.

import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { hydrate } from './src/state/hydrate';
import { installBootRecoveryListener } from './src/boot/bootRecoveryListener';
import { installUploadReconcile } from './src/services/uploadReconcile';
import { ToastHost } from './src/components/Toast';
import RootNativeStack from './src/navigation/RootNativeStack';
import { linking } from './src/navigation/linking';

enableScreens(true);

// Sync hydrate before render — MMKV is sync, Zustand setState is sync.
hydrate();

// React Navigation's LinkingOptions is parameterised over the global
// ParamList — Phase 2 hasn't declared one yet (lands in plan 02-15). The
// linking.ts module hand-types its own NestedPathMap variant; cast at the
// container boundary to satisfy the v7 typings without polluting the
// linking.ts module with `any`.
import type { LinkingOptions } from '@react-navigation/native';

export default function App() {
  // D-LIFE-04 — install the one-shot crash-recovery boot listener AFTER the
  // first commit, so <ToastHost /> is already mounted when
  // getPendingRecovery() resolves and shows the Home toast (Phase-4 smoke
  // bug 3(a) — the toast was silently missing). Best-effort; swallows when
  // HumynCapture isn't registered (JSDOM / a build without it).
  React.useEffect(() => {
    const teardown = installBootRecoveryListener();
    // Plan 05-08 (VERIFY-06) — the upload reconciliation sweep: on cold start +
    // each AppState→active, GET /recordings/verified-ids and delete any
    // verified-but-still-local recording triples. try/catch-wrapped so a build
    // without HumynUpload / JSDOM (or a missing API base URL) never crashes boot
    // — mirrors the installBootRecoveryListener best-effort pattern.
    let uploadReconcileTeardown: (() => void) | undefined;
    try {
      uploadReconcileTeardown = installUploadReconcile();
    } catch {
      uploadReconcileTeardown = undefined;
    }
    return () => {
      teardown();
      uploadReconcileTeardown?.();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer linking={linking as unknown as LinkingOptions<Record<string, never>>}>
        <RootNativeStack />
      </NavigationContainer>
      {/* D-LIFE-04 — transient toast host floats over the whole app (sibling of
          the navigator) so any screen / the crash-recovery boot listener can
          showToast(...). */}
      <ToastHost />
    </SafeAreaProvider>
  );
}
