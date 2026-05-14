// Synchronous MMKV → Zustand boot hydration. Called by App.tsx exactly
// once before the navigator mounts. MMKV is sync; Zustand setState is sync;
// this whole function is microsecond-cheap and never returns a promise.
//
// Each persisted blob is read defensively:
//   - Plain strings (jwt, installation_id) pass through directly.
//   - JSON-shaped values use safeParse() — a malformed blob (corruption,
//     version skew, deliberate tamper) hydrates as null + a warning rather
//     than crashing the app.
//   - The compat result additionally runs through CompatResultSchema.safeParse
//     so a JSON-valid-but-shape-invalid blob (e.g. an older schema from a
//     pre-migration build) ALSO degrades to null.
//
// D-STATE-02. Threat T-2.3-03 mitigation: jwt is read but never logged.

import { CompatResultSchema } from '@humyn/shared-types';

import { secureMmkv } from './mmkv';
import { KEYS } from './keys';
import {
  useAppStore,
  HOME_RANGE_KEY,
  HOME_RANGE_CUSTOM_KEY,
  HISTORY_RANGE_KEY,
  HISTORY_RANGE_CUSTOM_KEY,
} from './appStore';
import type {
  ConsentState,
  PermsState,
  CompatPassedState,
  AppVersionCacheEntry,
  RangeCustom,
} from './appStore';
import type { NamedRange } from '../services/timeRange';

function safeParseJson<T>(raw: string | undefined, label: string): T | null {
  if (raw === undefined || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`hydrate: malformed JSON for ${label}; degrading to null`);
    return null;
  }
}

export function hydrate(): void {
  const jwt = secureMmkv.getString(KEYS.AUTH_JWT) ?? null;
  const consent = safeParseJson<ConsentState>(
    secureMmkv.getString(KEYS.ONBOARDING_CONSENT),
    'onboarding.consent.v1',
  );
  const permsGranted = safeParseJson<PermsState>(
    secureMmkv.getString(KEYS.ONBOARDING_PERMS_GRANTED),
    'onboarding.permsGranted.v1',
  );
  const compatPassedRaw = safeParseJson<CompatPassedState>(
    secureMmkv.getString(KEYS.ONBOARDING_COMPAT_PASSED),
    'onboarding.compatPassed.v1',
  );

  // CompatResult gets BOTH a JSON.parse safety net AND a Zod shape check —
  // a tampered/version-skewed blob that happens to be valid JSON would
  // otherwise propagate a malformed object into every consumer.
  const compatLastRaw = secureMmkv.getString(KEYS.COMPAT_LAST_RESULT);
  let compatLastResult: ReturnType<typeof CompatResultSchema.parse> | null = null;
  if (compatLastRaw !== undefined && compatLastRaw !== '') {
    try {
      const parsed = CompatResultSchema.safeParse(JSON.parse(compatLastRaw));
      compatLastResult = parsed.success ? parsed.data : null;
      if (!parsed.success) {
        console.warn('hydrate: compat.lastResult.v1 failed schema validation; degrading to null');
      }
    } catch {
      console.warn('hydrate: malformed JSON for compat.lastResult.v1; degrading to null');
      compatLastResult = null;
    }
  }
  // If the full-result blob couldn't be parsed, the compat-passed summary
  // is suspect too — treat it as cleared regardless of its own JSON status.
  const compatPassed = compatLastResult === null && compatLastRaw ? null : compatPassedRaw;

  // tutorialDone is "any non-empty value" — Phase 1 stored
  // {doneAt, googleSub} as JSON, but we don't need to parse it for the gate.
  const tutorialDoneRaw = secureMmkv.getString(KEYS.ONBOARDING_TUTORIAL_DONE);
  const tutorialDone = !!tutorialDoneRaw;

  const installationId = secureMmkv.getString(KEYS.INSTALLATION_ID) ?? null;
  const appVersionCache = safeParseJson<AppVersionCacheEntry>(
    secureMmkv.getString(KEYS.APP_VERSION_CACHE),
    'appVersion.cache.v1',
  );

  // Phase 6 Wave 3 — Home / History range slices. MMKV stores the named
  // window as a plain string (one of `NamedRange`); the custom-pair sibling
  // is JSON-encoded. Both are validated defensively: an unknown string from
  // a tampered MMKV blob degrades to the store's default ('today' / 'all')
  // rather than crashing the gate-decision tree. Invariant: a hydrated
  // `*RangeCustom` only sticks when its companion `*Range === 'custom'` —
  // a mismatched pair (e.g. 'today' + a stale custom pair) drops the pair.
  const NAMED_RANGES: readonly NamedRange[] = [
    'today',
    'yesterday',
    'this-week',
    'this-month',
    'all',
    'custom',
  ] as const;
  function parseNamedRange(raw: string | undefined, fallback: NamedRange): NamedRange {
    if (raw === undefined) return fallback;
    return (NAMED_RANGES as readonly string[]).includes(raw) ? (raw as NamedRange) : fallback;
  }
  const homeRange = parseNamedRange(secureMmkv.getString(HOME_RANGE_KEY), 'today');
  const historyRange = parseNamedRange(secureMmkv.getString(HISTORY_RANGE_KEY), 'all');
  const homeRangeCustomRaw = safeParseJson<RangeCustom>(
    secureMmkv.getString(HOME_RANGE_CUSTOM_KEY),
    HOME_RANGE_CUSTOM_KEY,
  );
  const historyRangeCustomRaw = safeParseJson<RangeCustom>(
    secureMmkv.getString(HISTORY_RANGE_CUSTOM_KEY),
    HISTORY_RANGE_CUSTOM_KEY,
  );
  const homeRangeCustom = homeRange === 'custom' ? homeRangeCustomRaw : null;
  const historyRangeCustom = historyRange === 'custom' ? historyRangeCustomRaw : null;

  useAppStore.setState({
    jwt,
    consent,
    permsGranted,
    compatPassed,
    compatLastResult,
    tutorialDone,
    installationId,
    appVersionCache,
    homeRange,
    homeRangeCustom,
    historyRange,
    historyRangeCustom,
  });
}
