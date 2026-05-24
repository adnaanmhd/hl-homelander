/**
 * i18n runtime — Phase 7 Plan 07-01 Task 2 (I18N-01).
 *
 * Side-effect module: importing this file runs `i18n.init({ lng, resources })`
 * at module-load (NOT inside a hook / useEffect) per D-23, so the FIRST React
 * render is already in the correct locale and `useTranslation()` resolves
 * keys synchronously from the very first frame.
 *
 * Boot order at apps/mobile/App.tsx:
 *   1. enableScreens(true)                   (existing)
 *   2. hydrate()                             (existing — Zustand from MMKV)
 *   3. import './src/i18n'                   ← triggers this module
 *        → localeBootstrap()                   sync MMKV read
 *        → i18n.use(initReactI18next).init    sync resolve (no initImmediate)
 *   4. <I18nextProvider i18n={i18n}>         wraps <NavigationContainer>
 *
 * All 8 catalogs are static-imported (no `i18next-http-backend` — bundles at
 * build time per D-07). The 7 non-English placeholder JSONs currently mirror
 * en.json verbatim; plan 07-02 regenerates them via Claude Opus 4.7.
 *
 * Pitfalls from 07-RESEARCH:
 *   - `compatibilityJSON: 'v4'` is set explicitly to suppress the i18next 26
 *     console warning on pt-BR/es plural rule differences (Pitfall 5).
 *   - `interpolation.escapeValue: false` because React already escapes (the
 *     standard react-i18next setting; double-escaping mangles non-ASCII).
 *   - `useSuspense: false` is the react-i18next 17 default; no Suspense
 *     boundary needed at App.tsx.
 *   - `returnNull: false` so missing keys resolve to the key string (a
 *     developer signal) rather than `null` (a runtime hazard).
 *   - `fallbackLng: 'en'` for D-12 key-fallback (a missing translated key
 *     resolves to the English value rather than rendering the raw key).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeBootstrap } from './bootstrap';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';
import hiIN from './locales/hi-IN.json';
import bnIN from './locales/bn-IN.json';
import taIN from './locales/ta-IN.json';
import teIN from './locales/te-IN.json';
import mrIN from './locales/mr-IN.json';

const lng = localeBootstrap();

void i18n.use(initReactI18next).init({
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
  returnNull: false,
  // initImmediate:false forces i18next to load resources synchronously at
  // module init (per D-23, plan 07-05) — without this, useTranslation() in a
  // freshly-mounted screen tree returns the raw key string until the next
  // microtask, which trips screen-level vitest renders that assert against
  // the resolved English copy. Resources are bundled (no http backend) so
  // the "sync" load is in-memory. The `initImmediate` option is a valid
  // i18next runtime option but the bundled @types/i18next stripped it from
  // InitOptions a few minor versions back — cast to keep TS clean.
  initImmediate: false,
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
    es: { translation: es },
    'hi-IN': { translation: hiIN },
    'bn-IN': { translation: bnIN },
    'ta-IN': { translation: taIN },
    'te-IN': { translation: teIN },
    'mr-IN': { translation: mrIN },
  },
} as Parameters<typeof i18n.init>[0]);

export default i18n;
