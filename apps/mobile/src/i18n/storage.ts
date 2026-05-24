/**
 * Locale state lives in a NEW non-secure MMKV instance per D-21.
 * Locale is NOT a secret — `secureMmkv` is reserved for tokens / telemetry
 * ring / PII-adjacent ledgers. See 07-CONTEXT.md decisions.
 *
 * Implementation note: react-native-mmkv v4 (Nitro modules) exports `MMKV`
 * as a TYPE only; the runtime constructor is the `createMMKV` factory.
 * Phase 1 auth.ts established this pattern (mirrored from
 * `apps/mobile/src/state/mmkv.ts`). Calling `new MMKV(...)` against the v4
 * type-only export would fail at runtime.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv';

export const localeMmkv: MMKV = createMMKV({
  id: 'humyn.locale',
  // No encryption — locale is not a secret (D-21). Compare with
  // `apps/mobile/src/state/mmkv.ts`'s `secureMmkv`, which carries the
  // app-wide encryption key for tokens / telemetry ring / PII-adjacent
  // ledgers.
});

/**
 * Literal MMKV keys for locale state per D-22. Two dotted keys:
 *   CODE       — BCP-47 tag (one of `SUPPORTED_LOCALES`)
 *   CHOSEN_AT  — ISO timestamp string (Date.toISOString())
 *
 * D-22 calls these out by literal string; we keep them unversioned (no
 * `.v1` suffix) per the CONTEXT spec. A future schema break would add a
 * new constant rather than mutate either of these in place.
 */
export const LOCALE_KEYS = {
  CODE: 'locale.code',
  CHOSEN_AT: 'locale.chosen_at',
} as const;

/**
 * The 8 BCP-47 locale tags this app ships (D-07 + D-18 ordering). Both
 * surfaces (ChooseLanguageScreen + Profile picker) render these in the
 * exact array order: English first (default), then LatAm (pt-BR before
 * es), then India by speaker count.
 */
export const SUPPORTED_LOCALES = [
  'en',
  'pt-BR',
  'es',
  'hi-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'mr-IN',
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
