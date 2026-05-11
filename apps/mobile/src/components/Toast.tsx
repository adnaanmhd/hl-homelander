// Toast — app-wide transient bottom-toast host (NET-NEW, plan 04-10).
//
// No toast primitive existed before Phase 4: RecordingScreen.tsx (plan 04-09)
// carries its own local `toast` state for the in-recording surface (a dark
// surface, REC namespace), and that stays. This Toast host is the *global*
// transient surface that floats over the navigation root so any screen can
// `showToast(...)` — its first consumer is `bootRecoveryListener` (D-LIFE-04,
// the Home "Recording recovered after force-quit — uploading." toast).
//
// Design: a bottom-anchored pill (`colors.toastBg` — the same dark pill the
// recording surface uses, aliased in tokens so non-rec surfaces don't reach
// into the rec* namespace) with white-ish text, auto-fading after
// `durationMs ?? DEFAULT_TOAST_MS`. Imperative API (`showToast`) + a
// `<ToastHost />` component mounted near the navigation root.
//
// Implementation: a tiny module-level subscriber list (lighter than an
// appStore slice — appStore carries no toast field and the toast is purely
// presentational, never persisted). `showToast` mutates the module-level
// `current` and notifies subscribers; `<ToastHost />` subscribes via
// `useSyncExternalStore` and re-renders. The fade-out is a single setTimeout
// keyed on a monotonically-increasing `seq` so a rapid second `showToast`
// cancels the prior fade.
//
// Tokens come from ../ui/tokens — NO hex literals (the no-hex gate scans
// src/components/). `accessibilityLabel="toast"` so tests can query it.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../ui/primitives/Text';
import { colors, spacing, radii } from '../ui/tokens';

/** Default visible duration when `showToast` is called without an override. */
export const DEFAULT_TOAST_MS = 2000;

interface ToastState {
  /** The toast text, or null when no toast is showing. */
  text: string | null;
  /** Monotonic id — bumps on every showToast so a stale fade-out for an
   *  earlier toast doesn't clobber a newer one. */
  seq: number;
}

let current: ToastState = { text: null, seq: 0 };
const subscribers = new Set<() => void>();
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const s of subscribers) s();
}

function setState(next: ToastState): void {
  current = next;
  emit();
}

/**
 * Show a transient bottom toast with `text`, auto-hiding after `durationMs`
 * (default {@link DEFAULT_TOAST_MS}). Safe to call from any screen or a boot
 * listener; if `<ToastHost />` isn't mounted yet the call is a no-op visually
 * (the module state still updates so a freshly-mounted host would pick it up,
 * but in practice the host mounts at app boot).
 */
export function showToast(text: string, durationMs: number = DEFAULT_TOAST_MS): void {
  const seq = current.seq + 1;
  setState({ text, seq });
  if (fadeTimer != null) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  fadeTimer = setTimeout(
    () => {
      fadeTimer = null;
      // Only clear if no newer toast superseded this one.
      if (current.seq === seq) setState({ text: null, seq });
    },
    Math.max(0, durationMs),
  );
}

/** Imperatively dismiss the current toast (used by tests / teardown). */
export function hideToast(): void {
  if (fadeTimer != null) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  setState({ text: null, seq: current.seq + 1 });
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): ToastState {
  return current;
}

/**
 * Mount this near the navigation root (App.tsx renders it as a sibling of
 * <NavigationContainer> so it floats over every screen). Renders the current
 * toast pill or nothing.
 */
export function ToastHost(): React.JSX.Element | null {
  const state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!state.text) return null;
  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityLabel="toast-host">
      <View style={styles.pill} accessibilityLabel="toast">
        <Text variant="caption" style={styles.text}>
          {state.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xxxxl,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: colors.toastBg,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    marginHorizontal: spacing.l,
  },
  text: {
    color: colors.recTextSecondary,
    textAlign: 'center',
  },
});

export default ToastHost;
