// Pattern 72 — fires `/me` when the JS context rehydrates on Android process
// kill: appStore.user is transient (Pattern 64; not MMKV-backed by design —
// staleness-vs-backend trade-off). When MMKV restores jwt but the user slice
// rehydrates as null, every avatar surface (Home / Tasks / History TopBar,
// Profile) shows 'U' until ProfileScreen mount fires fetchMe() — the tab
// TopBars NEVER fire it, so the regression from 02-COSMETIC-GAPS.md
// "Profile screen" item 2 persists across the whole tab surface.
//
// Hook fires on:
//   1. Mount (cold boot) when user==null && jwt!=null.
//   2. AppState change to 'active' when same condition holds (Android
//      foreground from Recents after process kill).
//
// Errors are swallowed — the next ProfileScreen mount will retry.
//
// T-3.2-03 mitigation: the `user == null && jwt != null` guard short-circuits
// rapid AppState 'active' thrash once `setUser` populates the slice; backend
// /me's per-user 60/min rate limit is the backstop.
//
// Wire-shape adapter (mirrors ProfileScreen.tsx mount path): MeResponse
// returned by fetchMe() carries the full /me payload (id, email, name, age,
// gender, avatarUrl, …); we project to UserDisplay before calling setUser
// so the store slice keeps its narrow shape.

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppStore } from '../state/appStore';
import { fetchMe } from '../services/profileService';
import { coalesceDisplayName } from '../lib/userDisplayName';
import { logEvent } from '../util/analytics';

/**
 * Phase 2 item 1 (2026-06-10) — minimum gap between foreground session pings.
 * An evicted device should land on Signup "within seconds of being looked
 * at", but rapid background↔active thrash must not hammer /me (its per-user
 * rate limit is 60/min; one ping a minute is plenty for eviction latency).
 */
const SESSION_PING_MIN_INTERVAL_MS = 60_000;

export function useForegroundUserRehydrate(): void {
  const lastPingAtRef = useRef(0);
  useEffect(() => {
    const rehydrate = async () => {
      const { user, jwt, setUser } = useAppStore.getState();
      if (jwt == null) return;
      if (user == null) {
        try {
          lastPingAtRef.current = Date.now();
          const me = await fetchMe();
          setUser({
            id: me.id,
            email: me.email,
            name: coalesceDisplayName(me.name, me.email),
            avatarUrl: me.avatarUrl,
          });
        } catch (e) {
          // WR-10 fix — silent swallow stripped the diagnostic signal for
          // a permanently-failing rehydrate (network down, server-side
          // revoked JWT, hours-suspended JS context). Emit a telemetry
          // event so the help-pull diagnostic snapshot shows why the
          // user-side avatar stayed at 'U'. Next ProfileScreen mount
          // still retries; the catch remains non-throwing.
          logEvent('rehydrate_user_failed', {
            reason: e instanceof Error ? e.name : 'unknown',
          });
        }
        return;
      }
      // Phase 2 item 1 (2026-06-10, Bug 3) — foreground SESSION PING. The
      // single-device eviction is pull-based (no FCM — LOCKED): before this,
      // an evicted device that only browsed cached screens never made an
      // authed call and stayed "signed in" indefinitely. Now every foreground
      // (throttled to one per 60 s) fires a cheap authed GET /me; on a 401
      // with the device-evicted / reauth-required slug the API client's
      // maybeHandleEviction clears the session + routes to Signup. The
      // response body is deliberately ignored — this is a liveness probe.
      const now = Date.now();
      if (now - lastPingAtRef.current < SESSION_PING_MIN_INTERVAL_MS) return;
      lastPingAtRef.current = now;
      try {
        await fetchMe();
      } catch {
        // Eviction is handled inside the API client; a network error here
        // means nothing (the next foreground retries).
      }
    };
    void rehydrate();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void rehydrate();
    });
    return () => sub.remove();
  }, []);
}

export default useForegroundUserRehydrate;
