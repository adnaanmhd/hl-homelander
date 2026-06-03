/**
 * Plan 07-06 Task 2 — taskCatalog.i18n.ts contract (I18N-10 / D-01 / D-15).
 *
 * Pins five runtime invariants:
 *   1. TASK_CATALOG_I18N covers every task in `task-taxonomy.md` (currently
 *      86 tasks after the 2026-05-24 +21 US-oriented additive commit
 *      `2fbb65e feat(taxonomy): add 21 US-oriented tasks`). The plan body
 *      called for 65, the SPEC line 79 says "65-task catalog" — both are
 *      stale wording captured before the taxonomy expansion landed the
 *      same morning. Source of truth = task-taxonomy.md + mapping.json
 *      (both 86 rows), NOT the SPEC literal. See SUMMARY.md for the
 *      reconciliation note.
 *   2. Every English entry has a non-empty `description` AND at least one
 *      `instruction` (non-placeholder gate per the plan body).
 *   3. Every task has exactly the 8 SUPPORTED_LOCALES locale entries.
 *   4. REVERSE_BY_LOCALE covers all 7 non-English locales (the en locale
 *      is the canonical identity — no reverse map needed).
 *   5. buildReverseMaps is idempotent (callable from tests).
 *
 * Test location follows the project convention `apps/mobile/__tests__/...`
 * (vitest.config.ts `include` glob — same Rule-3 deviation as 07-01).
 */
import { describe, it, expect } from 'vitest';

import {
  TASK_CATALOG_I18N,
  REVERSE_BY_LOCALE,
  buildReverseMaps,
} from '../../src/i18n/taskCatalog.i18n';
import { SUPPORTED_LOCALES } from '../../src/i18n/storage';

const EXPECTED_TASK_COUNT = 86;
const EXPECTED_NON_EN_LOCALES = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'];

describe('TASK_CATALOG_I18N (I18N-10 / D-01 / D-15)', () => {
  it(`contains every task in task-taxonomy.md (currently ${EXPECTED_TASK_COUNT} after the 2026-05-24 +21 US-oriented additive commit)`, () => {
    expect(Object.keys(TASK_CATALOG_I18N).length).toBe(EXPECTED_TASK_COUNT);
  });

  it('every English entry has a non-empty description AND ≥1 instruction (non-placeholder gate)', () => {
    for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
      const en = byLocale.en;
      expect(en, `${canonical}/en body present`).toBeTruthy();
      expect(en.description.length, `${canonical}/en description non-empty`).toBeGreaterThan(0);
      expect(en.description, `${canonical}/en description not a sketch literal`).not.toBe('...');
      expect(en.instructions.length, `${canonical}/en ≥1 instruction`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every task has exactly the 8 SUPPORTED_LOCALES entries (full-body D-01)', () => {
    const expected = [...SUPPORTED_LOCALES].sort();
    for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
      const actual = Object.keys(byLocale).sort();
      expect(actual, `task=${canonical}`).toEqual(expected);
      // Cast through `Record<string, TaskBody>` because `Object.keys` returns
      // `string[]` (loses the `Locale` tag on `expected`), but every entry IS
      // a TaskBody per the runtime assertion three lines down.
      const byLocaleRec = byLocale as unknown as Record<
        string,
        import('../../src/i18n/taskCatalog.i18n').TaskBody
      >;
      for (const loc of expected) {
        const body = byLocaleRec[loc];
        expect(body, `${canonical}/${loc} body present`).toBeTruthy();
        if (!body) continue;
        expect(typeof body.name, `${canonical}/${loc} name`).toBe('string');
        expect(typeof body.description, `${canonical}/${loc} description`).toBe('string');
        expect(Array.isArray(body.instructions), `${canonical}/${loc} instructions`).toBe(true);
        expect(Array.isArray(body.examples), `${canonical}/${loc} examples`).toBe(true);
      }
    }
  });

  it('REVERSE_BY_LOCALE covers all 7 non-English locales', () => {
    expect(Object.keys(REVERSE_BY_LOCALE).sort()).toEqual([...EXPECTED_NON_EN_LOCALES].sort());
  });

  it('every locale reverse map has a fullStringMap and tokenMap', () => {
    for (const loc of EXPECTED_NON_EN_LOCALES) {
      const map = REVERSE_BY_LOCALE[loc];
      expect(map, `reverse map for ${loc}`).toBeTruthy();
      expect(typeof map?.fullStringMap, `${loc}.fullStringMap`).toBe('object');
      expect(typeof map?.tokenMap, `${loc}.tokenMap`).toBe('object');
    }
  });

  it('buildReverseMaps is idempotent (callable from tests)', () => {
    const fresh = buildReverseMaps(TASK_CATALOG_I18N);
    expect(Object.keys(fresh).sort()).toEqual([...EXPECTED_NON_EN_LOCALES].sort());
  });

  it('English name in TASK_CATALOG_I18N matches the canonical key (catalog self-consistency)', () => {
    for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
      expect(byLocale.en.name, `${canonical}/en name = canonical key`).toBe(canonical);
    }
  });
});
