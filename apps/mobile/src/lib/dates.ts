// Locale-aware date formatting per I18N-09 / D-36 / D-37.
//
// `formatDate(date, locale)` wraps `Intl.DateTimeFormat` and forces
// `numberingSystem: 'latn'` so digits stay 0-9 across all 8 MVP locales
// (D-37) — Devanagari month names render fine on hi-IN, but the numerals
// stay Latin 0-9, which the design + Profile/History "Joined" surface
// relies on.
//
// `HAS_INTL` is a module-init guard per D-36. Hermes ships ICU so the
// guard is expected to pass; the check catches a degenerate runtime
// (e.g. a Node test runner without full-ICU) and falls back to English
// `toLocaleDateString`. The helper never throws — degenerate locales fall
// back to English; if even that fails, the ISO `YYYY-MM-DD` slice is the
// last-resort return so call sites can always render *something*.
//
// Pure module — no React, no native modules. Mirrors the `lib/` convention
// established by `durationFormat.ts` (analog: a one-purpose pure-function
// helper module).
//
// Consumers in plan 07-05 will migrate the existing `toLocaleDateString`
// call sites in ProfileScreen + HistoryScreen onto this helper.

/**
 * One-shot Intl availability check at module load (D-36). Hermes ships ICU,
 * so this is true under both RN-Hermes and Node test environments. The
 * fallback path is only reached if a future runtime ships without `Intl` —
 * we keep the guard so the helper degrades cleanly instead of throwing.
 */
export const HAS_INTL: boolean =
  typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined';

/**
 * Format a `Date` for the given BCP-47 locale tag.
 *
 * Output is the ICU "medium" date format with Latin digits forced (D-37).
 * Examples on a `2026-05-13` sample:
 *   - `en`     → `"May 13, 2026"`
 *   - `pt-BR`  → `"13 de mai. de 2026"`
 *   - `hi-IN`  → `"13 मई 2026"` (Devanagari month name, Latin digits)
 *
 * @param date   - The `Date` instance to format.
 * @param locale - A BCP-47 locale tag (e.g. `'en'`, `'pt-BR'`, `'hi-IN'`).
 * @returns      A formatted date string; never throws.
 */
export function formatDate(date: Date, locale: string): string {
  if (!HAS_INTL) {
    try {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      // Force Latin digits across all 8 locales (D-37 / SPEC I18N-09).
      numberingSystem: 'latn',
    } as Intl.DateTimeFormatOptions).format(date);
  } catch {
    // Locale unsupported or option set rejected — fall back to en-US medium.
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
      } as Intl.DateTimeFormatOptions).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}
