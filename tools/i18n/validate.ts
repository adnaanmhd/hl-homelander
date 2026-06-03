/**
 * Shape-parity validator per D-12 + 07-RESEARCH §"Output Validation".
 * Walks en.json + each locale JSON recursively and reports
 * - keys present in en but missing in the locale
 * - keys present in the locale but absent in en (LLM hallucinated)
 * Returns dotted paths; intended for the post-generate gate
 * (the runtime fallback handles missing keys, but we want to know).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TARGET_LOCALES } from './locale-config.js';

type Catalog = { [key: string]: string | Catalog };

export function validateShapeParity(
  en: Catalog,
  locale: Catalog,
): { missing: string[]; extra: string[] } {
  const missing: string[] = [];
  const extra: string[] = [];
  walk(en, locale, '', missing, extra);
  return { missing, extra };
}

function walk(
  en: Catalog | string,
  loc: Catalog | string,
  prefix: string,
  missing: string[],
  extra: string[],
): void {
  if (typeof en === 'string' || typeof loc === 'string') {
    if (typeof en !== typeof loc) {
      // type mismatch counts as both missing and extra at the same path
      missing.push(prefix);
      extra.push(prefix);
    }
    return;
  }
  for (const k of Object.keys(en)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in loc)) {
      missing.push(path);
    } else {
      walk(en[k] as Catalog | string, loc[k] as Catalog | string, path, missing, extra);
    }
  }
  for (const k of Object.keys(loc)) {
    if (!(k in en)) {
      extra.push(prefix ? `${prefix}.${k}` : k);
    }
  }
}

// Allow `tsx tools/i18n/validate.ts` as a CLI gate.
if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = resolve(import.meta.dirname, '..', '..');
  const localesDir = resolve(repoRoot, 'apps/mobile/src/i18n/locales');
  const en = JSON.parse(readFileSync(resolve(localesDir, 'en.json'), 'utf8')) as Catalog;
  let exit = 0;
  for (const loc of TARGET_LOCALES) {
    const data = JSON.parse(readFileSync(resolve(localesDir, `${loc}.json`), 'utf8')) as Catalog;
    const { missing, extra } = validateShapeParity(en, data);
    if (missing.length || extra.length) {
      console.error(`[validate] ${loc}: missing=${missing.length} extra=${extra.length}`);
      missing.slice(0, 10).forEach((p) => console.error(`  - missing: ${p}`));
      extra.slice(0, 10).forEach((p) => console.error(`  + extra:   ${p}`));
      exit = 1;
    } else {
      console.log(`[validate] ${loc}: OK`);
    }
  }
  process.exit(exit);
}
