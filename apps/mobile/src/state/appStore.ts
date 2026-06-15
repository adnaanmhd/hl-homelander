// Zustand app store — D-STATE-02. Single in-memory source of truth for the
// shell. Hydrated synchronously from MMKV at boot via `hydrate.ts`. Action
// methods write through to the secure MMKV singleton so external callers
// never touch persistent storage directly.
//
// Persistence model:
//   - "Onboarding" flags (jwt, consent, permsGranted, compatPassed,
//     tutorialDone, installationId) round-trip to MMKV on every set.
//   - Transient flags (softUpgradeAvailable, forceUpgradeBlocked) live
//     in-memory only — every cold boot recomputes them from the upstream
//     versionService response.
//   - compatLastResult is the full CompatResult blob (for the fail-screen
//     diagnostic UI); compatPassed is the smaller signature/runAt summary
//     used by the gate-decision tree.

import { create } from 'zustand';
import type { CompatResult } from '@humyn/shared-types';
import { secureMmkv } from './mmkv';
import { KEYS, practiceDoneKey } from './keys';
import type { NamedRange } from '../services/timeRange';
// Bug 7 + Bug 11 (2026-06-04) — type-only import so the store carries the
// upload-queue row shape WITHOUT a runtime require cycle (HumynUpload.ts pulls
// only react-native; it never imports the store). `import type` is fully
// erased at compile.
import type { UploadQueueRow } from '../native/HumynUpload';

export interface ConsentState {
  acceptedAt: string; // ISO datetime
  consentVersion: string; // FNV-1a 32-bit hash of the canonical consent text (client bookkeeping stamp; the server SHA-256 is the legal source of truth)
}

export interface PermsState {
  camera: boolean;
  mic: boolean;
  // Bug 3 / D3 + D4 (2026-06-04) — precise Location is now a gated onboarding
  // permission alongside Camera + Mic (block-until-granted). Overrides the
  // formerly-LOCKED coarse-only constraint. BUG-1 (2026-06-09 — precise-only):
  // True ONLY when FINE ("Precise") was granted; a coarse-only "Approximate"
  // grant is insufficient and keeps the user in the permissions recovery state.
  location: boolean;
  grantedAt: string; // ISO datetime
}

export interface CompatPassedState {
  signature: string;
  runAt: string;
}

export interface AppVersionCacheEntry {
  response: unknown; // typed once versionService lands (plan 02-08)
  fetchedAt: number; // epoch ms
}

// Phase 6 Wave 3 — Home / History filter range. The named windows are the
// six options the Filter sheet (design-spec §16) shows: Today, Yesterday,
// This week, This month, All, Custom. When `homeRange === 'custom'` the
// `homeRangeCustom` blob holds the explicit ISO-date pair the picker emits.
// Defaults: HomeScreen tile-pair = 'today' (06-UI-SPEC §Home tile-pair
// default); HistoryScreen filter chip = 'all' (06-UI-SPEC §History default
// "All time ▾"). Persisted to MMKV under `app.homeRange.v1` /
// `app.historyRange.v1` (+ the `*.custom.v1` siblings for the date pair) so
// the chip survives cold start (HOME-04 / HIST-03).
//
// MMKV keys are inlined here rather than added to state/keys.ts because
// Plan 06-04 modifies that file in the same wave (avoid cross-plan churn).
export interface RangeCustom {
  start: string;
  end: string;
}
export const HOME_RANGE_KEY = 'app.homeRange.v1';
export const HOME_RANGE_CUSTOM_KEY = 'app.homeRangeCustom.v1';
export const HISTORY_RANGE_KEY = 'app.historyRange.v1';
export const HISTORY_RANGE_CUSTOM_KEY = 'app.historyRangeCustom.v1';

/**
 * Display-only user payload populated from sign-in or `/me`. Used by TopBar
 * (Google avatar in MainTabs) and any future surface that needs name / email
 * outside ProfileScreen's local fetch. NOT persisted across app launches —
 * sign-in (or first ProfileScreen mount) repopulates it; signOut clears it.
 */
export interface UserDisplay {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AppState {
  // ---------------------------------------------------------------------
  // Persisted (round-tripped to MMKV)
  // ---------------------------------------------------------------------
  jwt: string | null;
  consent: ConsentState | null;
  permsGranted: PermsState | null;
  compatPassed: CompatPassedState | null;
  compatLastResult: CompatResult | null;
  tutorialDone: boolean;
  installationId: string | null;
  appVersionCache: AppVersionCacheEntry | null;

  // Phase 6 Wave 3 — Home / History range filter slices (persisted).
  //   homeRange       : the active named window for the HomeScreen tile pair.
  //                     Default 'today' (06-UI-SPEC §Home tile-pair default).
  //   historyRange    : the active named window for the HistoryScreen list.
  //                     Default 'all' (06-UI-SPEC §History default "All time ▾").
  //   *RangeCustom    : the explicit ISO-date pair when the named window is
  //                     'custom'. Both bounds are 'YYYY-MM-DD' in local tz
  //                     (D-03b — server converts via Accept-Timezone header).
  homeRange: NamedRange;
  homeRangeCustom: RangeCustom | null;
  historyRange: NamedRange;
  historyRangeCustom: RangeCustom | null;

  // ---------------------------------------------------------------------
  // Transient (computed every boot — never persisted)
  // ---------------------------------------------------------------------
  softUpgradeAvailable: { latest: string } | null;
  forceUpgradeBlocked: boolean;
  user: UserDisplay | null;
  // Bug 4 / D2 (2026-06-04) — set true when an authed request 401s with the
  // `device-evicted` slug (this device was superseded by a newer sign-in). The
  // SignupScreen reads it once on mount to show the "used on another device"
  // notice, then clears it. Transient — never persisted.
  deviceEvicted: boolean;
  // Distinguishes a genuine eviction ('evicted' — superseded by a newer sign-in
  // on another device) from a forced re-sign-in of a legacy no-claim token
  // ('reauth'). SignupScreen picks the notice copy from it. Null when not flagged.
  deviceEvictedReason: 'evicted' | 'reauth' | null;

  // Bug 7 + Bug 11 (2026-06-04) — single app-lifetime reactive upload-queue
  // source. Fed by ONE `onUploadQueueChanged` / `onUploadProgress` subscription
  // installed at boot (`services/uploadQueueStore.ts`, next to
  // `installUploadReconcile()` in App.tsx), seeded once from `getQueueSafe()`.
  // Living outside the navigator it survives tab lazy-mount / freezeOnBlur, so
  // History / Home / PendingUploads no longer each subscribe (and no longer
  // miss an enqueue that fired while they were unmounted — Bug 7). Each screen
  // reads `uploadQueue` and filters to its own `ownerUserId === currentSub`
  // (UP-13 owner-pin) reactively, so a row enqueued during a null-`sub` window
  // is NOT lost — the raw queue persists here and re-filters the moment `sub`
  // resolves. All three are transient (never persisted).
  //   - uploadQueue          : the full, unfiltered native queue snapshot.
  //   - uploadProgressById    : recordingId → upload percent (0..100).
  //   - contributionsVersion  : a monotonic counter bumped on every queue
  //                             mutation. Home + Profile key a debounced
  //                             contributions refetch on it (Bug 11) — a queue
  //                             mutation correlates with the server-side count
  //                             change at `/recordings/init`.
  uploadQueue: UploadQueueRow[];
  uploadProgressById: Record<string, number>;
  contributionsVersion: number;

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  setJwt(jwt: string | null): void;
  signOut(): void;
  // Bug 4 / D2 — clear the session (JWT + user) and flag the eviction so the
  // Signup screen can explain it. Onboarding flags are intentionally KEPT so a
  // same-device re-sign-in is friction-free (newest-wins ping-pong is common).
  notifyDeviceEvicted(reason?: 'evicted' | 'reauth'): void;
  clearDeviceEvicted(): void;
  setConsent(c: ConsentState): void;
  setPermsGranted(p: PermsState): void;
  setCompatResult(r: CompatResult): void;
  clearCompatPassed(): void;
  setTutorialDone(googleSub: string): void;
  setPracticeDone(sub: string): void;
  setInstallationId(id: string): void;
  setAppVersionCache(c: AppVersionCacheEntry): void;
  setSoftUpgradeAvailable(s: { latest: string } | null): void;
  setForceUpgradeBlocked(b: boolean): void;
  setUser(u: UserDisplay | null): void;
  // Bug 7 + Bug 11 — upload-queue reactive setters (fed by the boot installer).
  //   setUploadQueue          : replace the queue snapshot wholesale (the native
  //                             event always carries the full queue).
  //   setUploadProgress       : merge one recording's percent into the map.
  //   bumpContributionsVersion: ++contributionsVersion (Bug 11 invalidation).
  setUploadQueue(rows: UploadQueueRow[]): void;
  setUploadProgress(recordingId: string, pct: number): void;
  bumpContributionsVersion(): void;
  // Phase 6 Wave 3 — Home / History range setters. Each setter persists the
  // new value to MMKV through `secureMmkv.set`. Setting `homeRange` to any
  // non-'custom' window also clears `homeRangeCustom` (the custom pair is
  // meaningless once a named window is selected); ditto for history. The
  // custom-pair setter forces the named range to 'custom' atomically.
  setHomeRange(r: NamedRange): void;
  setHomeRangeCustom(start: string, end: string): void;
  setHistoryRange(r: NamedRange): void;
  setHistoryRangeCustom(start: string, end: string): void;
}

export const useAppStore = create<AppState>((set) => ({
  jwt: null,
  consent: null,
  permsGranted: null,
  compatPassed: null,
  compatLastResult: null,
  tutorialDone: false,
  installationId: null,
  appVersionCache: null,
  softUpgradeAvailable: null,
  forceUpgradeBlocked: false,
  user: null,
  deviceEvicted: false,
  deviceEvictedReason: null,
  // Bug 7 + Bug 11 — reactive upload-queue defaults (transient).
  uploadQueue: [],
  uploadProgressById: {},
  contributionsVersion: 0,
  // Phase 6 Wave 3 — Home / History range defaults.
  homeRange: 'today',
  homeRangeCustom: null,
  historyRange: 'all',
  historyRangeCustom: null,

  setJwt: (jwt) => {
    if (jwt === null) {
      secureMmkv.remove(KEYS.AUTH_JWT);
    } else {
      secureMmkv.set(KEYS.AUTH_JWT, jwt);
    }
    set({ jwt });
  },

  signOut: () => {
    secureMmkv.remove(KEYS.AUTH_JWT);
    set({ jwt: null, user: null });
  },

  notifyDeviceEvicted: (reason = 'evicted') => {
    // Drop the JWT (this device is no longer the bound device) and flag the
    // eviction. `reason` distinguishes a genuine eviction ('evicted' — used on
    // another device) from a forced re-sign-in of a legacy no-claim token
    // ('reauth') so SignupScreen shows the right copy. Onboarding flags are kept
    // — a same-device re-sign-in skips the gate-decision tree. Navigation to
    // Signup is driven by the api.ts caller.
    secureMmkv.remove(KEYS.AUTH_JWT);
    set({ jwt: null, user: null, deviceEvicted: true, deviceEvictedReason: reason });
  },

  clearDeviceEvicted: () => set({ deviceEvicted: false, deviceEvictedReason: null }),

  setConsent: (consent) => {
    secureMmkv.set(KEYS.ONBOARDING_CONSENT, JSON.stringify(consent));
    set({ consent });
  },

  setPermsGranted: (permsGranted) => {
    secureMmkv.set(KEYS.ONBOARDING_PERMS_GRANTED, JSON.stringify(permsGranted));
    set({ permsGranted });
  },

  setCompatResult: (r) => {
    // Always persist the full result for the fail-screen diagnostic UI.
    secureMmkv.set(KEYS.COMPAT_LAST_RESULT, JSON.stringify(r));
    if (r.passed) {
      const compatPassed: CompatPassedState = {
        signature: r.signature,
        runAt: r.runAt,
      };
      secureMmkv.set(KEYS.ONBOARDING_COMPAT_PASSED, JSON.stringify(compatPassed));
      set({ compatLastResult: r, compatPassed });
    } else {
      secureMmkv.remove(KEYS.ONBOARDING_COMPAT_PASSED);
      set({ compatLastResult: r, compatPassed: null });
    }
  },

  clearCompatPassed: () => {
    secureMmkv.remove(KEYS.ONBOARDING_COMPAT_PASSED);
    set({ compatPassed: null });
  },

  setTutorialDone: (googleSub) => {
    const payload = { doneAt: new Date().toISOString(), googleSub };
    secureMmkv.set(KEYS.ONBOARDING_TUTORIAL_DONE, JSON.stringify(payload));
    set({ tutorialDone: true });
  },

  /**
   * ONB-08 — writes the per-account practice-tutorial-done flag (keyed by the
   * Google account `sub`). Read by computeInitialRoute at boot. No in-memory
   * state field: the flag is consumed directly from MMKV by the gate-decision
   * tree, not via this store. Idempotent. Never logs the `sub` (T-4.3-03).
   */
  setPracticeDone: (sub) => {
    secureMmkv.set(practiceDoneKey(sub), true);
  },

  setInstallationId: (id) => {
    secureMmkv.set(KEYS.INSTALLATION_ID, id);
    set({ installationId: id });
  },

  setAppVersionCache: (c) => {
    secureMmkv.set(KEYS.APP_VERSION_CACHE, JSON.stringify(c));
    set({ appVersionCache: c });
  },

  setSoftUpgradeAvailable: (s) => set({ softUpgradeAvailable: s }),
  setForceUpgradeBlocked: (b) => set({ forceUpgradeBlocked: b }),
  setUser: (user) => set({ user }),

  // Bug 7 + Bug 11 — reactive upload-queue setters. Transient (no MMKV write):
  // the native queue is the durable source of truth; this slice is a live
  // mirror reseeded from `getQueueSafe()` on every cold boot.
  setUploadQueue: (rows) =>
    set((s) => {
      // GC progress entries whose recording left the queue (a completed upload
      // drops from the native queue) so `uploadProgressById` can't grow
      // unbounded over a session. Only allocate a new map when something is
      // actually pruned — otherwise keep the reference stable so progress
      // consumers don't re-render on an unrelated queue mutation.
      const liveIds = new Set(rows.map((r) => r.recordingId));
      let pruned = false;
      const next: Record<string, number> = {};
      for (const id in s.uploadProgressById) {
        if (liveIds.has(id)) next[id] = s.uploadProgressById[id]!;
        else pruned = true;
      }
      return pruned ? { uploadQueue: rows, uploadProgressById: next } : { uploadQueue: rows };
    }),
  setUploadProgress: (recordingId, pct) =>
    set((s) => ({ uploadProgressById: { ...s.uploadProgressById, [recordingId]: pct } })),
  bumpContributionsVersion: () =>
    set((s) => ({ contributionsVersion: s.contributionsVersion + 1 })),

  // Phase 6 Wave 3 — Home / History range setters.
  //
  // Switching to any non-'custom' named window clears the persisted custom
  // pair so a later cold start re-hydrates with a clean slot (otherwise a
  // user who picks 'today' after a custom range would still carry the stale
  // bounds in MMKV — no functional harm but invariant violation: the pair
  // only has meaning while named === 'custom').
  //
  // The custom-pair setter atomically flips the named window to 'custom' AND
  // writes the pair so the caller doesn't have to remember the two-step
  // dance + the persisted state always stays in agreement with the named
  // window.
  setHomeRange: (homeRange) => {
    secureMmkv.set(HOME_RANGE_KEY, homeRange);
    if (homeRange !== 'custom') {
      secureMmkv.remove(HOME_RANGE_CUSTOM_KEY);
      set({ homeRange, homeRangeCustom: null });
    } else {
      set({ homeRange });
    }
  },
  setHomeRangeCustom: (start, end) => {
    const pair: RangeCustom = { start, end };
    secureMmkv.set(HOME_RANGE_KEY, 'custom');
    secureMmkv.set(HOME_RANGE_CUSTOM_KEY, JSON.stringify(pair));
    set({ homeRange: 'custom', homeRangeCustom: pair });
  },
  setHistoryRange: (historyRange) => {
    secureMmkv.set(HISTORY_RANGE_KEY, historyRange);
    if (historyRange !== 'custom') {
      secureMmkv.remove(HISTORY_RANGE_CUSTOM_KEY);
      set({ historyRange, historyRangeCustom: null });
    } else {
      set({ historyRange });
    }
  },
  setHistoryRangeCustom: (start, end) => {
    const pair: RangeCustom = { start, end };
    secureMmkv.set(HISTORY_RANGE_KEY, 'custom');
    secureMmkv.set(HISTORY_RANGE_CUSTOM_KEY, JSON.stringify(pair));
    set({ historyRange: 'custom', historyRangeCustom: pair });
  },
}));
