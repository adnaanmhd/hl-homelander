/**
 * Synchronous MMKV read at app startup per D-23. Called BEFORE
 * `i18n.init({ lng })` so the first render is in the correct locale.
 * Must never throw — best-effort fall-back to 'en'.
 *
 * Defense in depth (D-21 / D-22): the stored value is validated against
 * the SUPPORTED_LOCALES allowlist before being returned. An unknown stored
 * value (e.g. 'fr', 'xx-YY' — catalog drift) resolves to 'en' rather than
 * being passed through to i18next.
 */
import { localeMmkv, LOCALE_KEYS, SUPPORTED_LOCALES, type Locale } from './storage';

export function localeBootstrap(): Locale {
  try {
    const stored = localeMmkv.getString(LOCALE_KEYS.CODE);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // MMKV read failures fall through to default — never block boot.
  }
  return 'en';
}
