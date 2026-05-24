/**
 * Locale display metadata per D-18 + D-19 (07-CONTEXT.md).
 *
 * Two strict-typed display tables + a canonical ordering, consumed by
 *   - LanguageList.tsx (shared 8-row renderer)
 *   - ChooseLanguageScreen.tsx (design carve-out #2, D-20)
 *   - LanguageSheet.tsx (Profile picker, D-17)
 *   - ProfileScreen.tsx (Language row label — shows the current locale's
 *     native name on the right side per D-19's row presentation rule)
 *
 * D-18 ordering: English first (default + fallback), then LatAm (pt-BR
 * before es because Brazil is the bigger MVP geo by volume), then India by
 * speaker count (hi-IN > bn-IN > ta-IN > te-IN > mr-IN).
 *
 * D-19 row presentation: native name (left, primary tone) + English name
 * (right, secondary/tertiary tone) — never a flag emoji.
 *
 * Schema-parity invariant: every Locale literal in `SUPPORTED_LOCALES`
 * (apps/mobile/src/i18n/storage.ts) MUST have an entry in both
 * `LOCALE_NATIVE_NAMES` AND `LOCALE_ENGLISH_NAMES` — TypeScript enforces
 * this at compile time via the `Record<Locale, string>` shape.
 */
import type { Locale } from './storage';

/** D-18 — strict ordering for both display surfaces. */
export const LOCALE_DISPLAY_ORDER: readonly Locale[] = [
  'en',
  'pt-BR',
  'es',
  'hi-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'mr-IN',
] as const;

/** Native name as the speakers write it (left column, D-19). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  'hi-IN': 'हिन्दी',
  'bn-IN': 'বাংলা',
  'ta-IN': 'தமிழ்',
  'te-IN': 'తెలుగు',
  'mr-IN': 'मराठी',
};

/** English label (right column, secondary tone, D-19). */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Portuguese (Brazil)',
  es: 'Spanish',
  'hi-IN': 'Hindi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'mr-IN': 'Marathi',
};
