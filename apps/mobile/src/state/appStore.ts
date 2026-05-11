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

export interface ConsentState {
  acceptedAt: string; // ISO datetime
  consentVersion: string; // sha256 of canonical text — Phase 1 LEGAL constant
}

export interface PermsState {
  camera: boolean;
  mic: boolean;
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

  // ---------------------------------------------------------------------
  // Transient (computed every boot — never persisted)
  // ---------------------------------------------------------------------
  softUpgradeAvailable: { latest: string } | null;
  forceUpgradeBlocked: boolean;
  user: UserDisplay | null;

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  setJwt(jwt: string | null): void;
  signOut(): void;
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
}));
