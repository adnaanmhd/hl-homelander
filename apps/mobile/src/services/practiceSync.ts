// practiceSync — Phase 3 (2026-06-10, Bug 2): durable practice-completion POST.
//
// PracticeCompleteScreen used to fire `void postPracticeComplete().catch(() =>
// undefined)` — a completion that happened offline (or against the stale
// staging API whose /me/practice-complete 404'd) was silently LOST, and the
// user got re-gated through the tutorial on their next reinstall/device.
//
// New shape: the screen marks a per-sub pending flag BEFORE the POST attempt
// and clears it on success; this module flushes any pending flag on boot +
// every AppState→'active' (installed in App.tsx beside installUploadReconcile).
// The flag survives process kills (MMKV). Cleared on 2xx OR a 409/conflict
// (server already has it — the route is idempotent set-if-NULL, but be
// liberal in what we accept). Kept on 401/network so a later flush (post
// re-sign-in / back online) retries. The local `practiceDoneKey` seed is
// untouched — instant UX stays.

import { AppState, type AppStateStatus } from 'react-native';
import { secureMmkv } from '../state/mmkv';
import { KEYS, practicePendingServerPostKey } from '../state/keys';
import { decodeGoogleSubFromJwt } from '../lib/jwtSub';
import { postPracticeComplete } from './profileService';
import { apiErrorStatus } from './api';

/** Mark the signed-in account's completion as not-yet-persisted server-side. */
export function markPracticeServerPostPending(sub: string): void {
  try {
    secureMmkv.set(practicePendingServerPostKey(sub), true);
  } catch {
    /* best-effort — losing the marker degrades to the old fire-and-forget */
  }
}

/** Clear the pending marker (server confirmed, or already set). */
export function clearPracticeServerPostPending(sub: string): void {
  try {
    secureMmkv.remove(practicePendingServerPostKey(sub));
  } catch {
    /* best-effort */
  }
}

/**
 * Attempt the completion POST once and settle the pending flag: cleared on
 * 2xx OR a 409/conflict (the server already has a non-null
 * practice_completed_at, or an idempotency-key conflict on a duplicate
 * in-flight POST — either way the server state is what we wanted); kept on
 * anything else (offline, 401 pre-re-sign-in, 5xx, the stale 404 server) so
 * a later flush retries. Never throws. Shared by PracticeCompleteScreen's
 * immediate attempt and [flushPracticeServerPost] (review extraction
 * 2026-06-10 — the two copies of this classifier had to change in lockstep).
 * Status is read from the typed ApiError (`apiErrorStatus`) — the old
 * /failed: 409/ message regex also matched body text.
 */
export async function attemptPracticeServerPost(sub: string): Promise<void> {
  try {
    await postPracticeComplete();
    clearPracticeServerPostPending(sub);
  } catch (e) {
    if (apiErrorStatus(e) === 409) {
      clearPracticeServerPostPending(sub);
    }
  }
}

/** Single-flight guard — boot + a fast AppState flap must not double-POST. */
let flushInFlight = false;

/**
 * Flush the CURRENT account's pending completion POST, if any. Safe to call
 * any time: no-op without a JWT, without a pending flag, or while another
 * flush is in flight. Never throws.
 */
export async function flushPracticeServerPost(): Promise<void> {
  if (flushInFlight) return;
  flushInFlight = true;
  try {
    const jwt = secureMmkv.getString(KEYS.AUTH_JWT) ?? null;
    if (!jwt) return;
    const sub = decodeGoogleSubFromJwt(jwt);
    if (!sub) return;
    if (secureMmkv.getBoolean(practicePendingServerPostKey(sub)) !== true) return;
    await attemptPracticeServerPost(sub);
  } finally {
    flushInFlight = false;
  }
}

/**
 * Install the flush triggers: once at boot + on every AppState→'active'.
 * Returns a teardown. Installed from App.tsx beside installUploadReconcile
 * (same best-effort try/catch there).
 */
export function installPracticeSyncFlush(): () => void {
  void flushPracticeServerPost();
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void flushPracticeServerPost();
  });
  return () => sub.remove();
}

export default installPracticeSyncFlush;
