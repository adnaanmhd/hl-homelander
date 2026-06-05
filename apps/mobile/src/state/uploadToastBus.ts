// uploadToastBus — one-shot message holder for the post-recording contribution
// toast (Wave-1.5 Item 5).
//
// The contribution toast — `"{Hh Mm} added to your contribution."` — was being
// killed by the RecordingScreen → Home transition because RecordingScreen
// renders its OWN in-screen toast component (a `useState` + `setTimeout(3000)`
// host, see `RecordingScreen.tsx:195-203`). When `navigateToHome` unmounts
// the screen, the toast goes with it; the global `<ToastHost />`
// (`App.tsx:78`, the sibling of `NavigationContainer`) never sees the call.
//
// Fix: defer the call until AFTER `navigateToHome` resolves and the global
// `<ToastHost />` is what renders the toast. Pattern mirrors
// `bootRecoveryListener.ts`'s deliver-on-Home pattern: `RecordingScreen` sets
// the pending message before `navigateToHome`; `HomeSkeletonScreen` drains
// it on mount via a one-shot effect and calls the global `showToast(text,
// durationMs)`.
//
// Module-level state (not Zustand) — we don't need re-renders to fan out, just
// a set/drain pair that's accessible from anywhere. Trivially testable via
// the `__test_resetUploadToastBus` hatch.

export type PendingUploadToast = {
  text: string;
  durationMs: number;
};

/** Default lifetime when `setPendingUploadToast` is called without an override. */
export const DEFAULT_UPLOAD_TOAST_MS = 5_000;

let pending: PendingUploadToast | null = null;

/**
 * Set the next contribution toast. RecordingScreen calls this in the ≥3min
 * stop branch BEFORE `navigateToHome(navigation)`; HomeSkeletonScreen drains
 * it on mount and fires the global ToastHost via
 * `showToast(text, durationMs)`. Default duration is 5 s (Wave-1.5 Item 5 —
 * the runbook §2 contract calls for a toast that survives the screen
 * transition for ≥5 s).
 */
export function setPendingUploadToast(
  text: string,
  durationMs: number = DEFAULT_UPLOAD_TOAST_MS,
): void {
  pending = { text, durationMs };
}

/**
 * Drain the pending toast. Returns the message or `null`. One-shot: a second
 * call after a drain returns `null` until another set. HomeSkeletonScreen
 * calls this in a mount-only `useEffect`.
 */
export function drainPendingUploadToast(): PendingUploadToast | null {
  const taken = pending;
  pending = null;
  return taken;
}

/** Test hatch — used by Vitest tests via `beforeEach` to isolate state. */
export function __test_resetUploadToastBus(): void {
  pending = null;
}
