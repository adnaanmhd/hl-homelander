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

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppStore } from '../state/appStore';
import { fetchMe } from '../services/profileService';

export function useForegroundUserRehydrate(): void {
  useEffect(() => {
    const rehydrate = async () => {
      const { user, jwt, setUser } = useAppStore.getState();
      if (user == null && jwt != null) {
        try {
          const me = await fetchMe();
          setUser({
            id: me.id,
            email: me.email,
            name: me.name,
            avatarUrl: me.avatarUrl,
          });
        } catch {
          /* swallow — next ProfileScreen mount retries */
        }
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
