/**
 * Plan 07-12 Task 2 — body-translation gate for TASK_CATALOG_I18N
 * (G-08 closure / D-01 / D-15).
 *
 * The pre-Plan-07-12 state (documented in 07-06 SUMMARY + verified in
 * 07-HUMAN-UAT §6) had identical English values across every non-en
 * locale slot for every task — the catalog shipped as a skeleton waiting
 * on the LLM regen. After plan 07-12 ships, every non-en slot should be
 * a real translation, and this test enforces that.
 *
 * The check is two-layer:
 *   1. For each of the 7 non-English locales, at most PROPER_NOUN_TOLERANCE
 *      task entries may have all three of `body.name === en.name` AND
 *      `body.description === en.description` AND
 *      `body.instructions[0] === en.instructions[0]` (the 3-axis skeleton-
 *      English gate). The LLM may legitimately keep an English value for
 *      proper-noun-like task names; the 3-axis gate ensures that even when
 *      the name carries over, the body content gets translated.
 *   2. Every task body has a non-empty description AND at least one
 *      instruction. This catches regressions where the LLM dropped fields
 *      that the shape validator would have rejected at regen time — a
 *      defense-in-depth check at the file-on-disk layer.
 *
 * Finally, the test exercises the REVERSE_BY_LOCALE Stage-1 path: at least
 * one fullStringMap entry per non-en locale must map a translated name back
 * to a canonical English task name in TASK_CATALOG_I18N. This is the
 * functional G-13 / §6 reverse-search gate the operator's hi-IN walk
 * explicitly demands.
 */
import { describe, it, expect } from 'vitest';

import { TASK_CATALOG_I18N, REVERSE_BY_LOCALE } from '../../src/i18n/taskCatalog.i18n';
import type { TaskBody } from '../../src/i18n/taskCatalog.i18n';

const NON_EN_LOCALES = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;

// PLAN-DEFINED TOLERANCE per the body's POST-CHECKER-REV WARNING #4 — at
// most 2 task entries per locale may match en on all three axes (name +
// description + instructions[0]). This is much harder to slip through than
// a name-only check; a task only counts as skeleton-English if literally
// every prose axis is byte-identical with en.
const PROPER_NOUN_TOLERANCE = 2;

describe('TASK_CATALOG_I18N body translation (G-08 closure)', () => {
  for (const loc of NON_EN_LOCALES) {
    it(`${loc}: at most ${PROPER_NOUN_TOLERANCE} tasks are skeleton-English across name+description+instructions[0]`, () => {
      const total = Object.keys(TASK_CATALOG_I18N).length;
      const skeletonTasks: string[] = [];
      for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
        const body = byLocale[loc] as TaskBody | undefined;
        const en = byLocale.en;
        expect(body, `${canonical}.${loc} body missing`).toBeDefined();
        if (!body) continue;
        const nameEn = body.name === en.name;
        const descEn = body.description === en.description;
        const instEn = (body.instructions?.[0] ?? '') === (en.instructions?.[0] ?? '');
        if (nameEn && descEn && instEn) skeletonTasks.push(canonical);
      }
      expect(
        skeletonTasks.length,
        `${loc}: ${skeletonTasks.length}/${total} tasks still skeleton-English (name+description+instructions[0] all match en); examples: ${skeletonTasks.slice(0, 5).join(', ')}`,
      ).toBeLessThanOrEqual(PROPER_NOUN_TOLERANCE);
    });

    it(`${loc}: every task body has non-empty description + ≥1 instruction`, () => {
      for (const [canonical, byLocale] of Object.entries(TASK_CATALOG_I18N)) {
        const body = byLocale[loc] as TaskBody | undefined;
        expect(body, `${canonical}.${loc} body present`).toBeDefined();
        if (!body) continue;
        expect(
          body.description.length,
          `${canonical}.${loc} description non-empty`,
        ).toBeGreaterThan(0);
        expect(Array.isArray(body.instructions), `${canonical}.${loc} instructions array`).toBe(
          true,
        );
        expect(
          body.instructions.length,
          `${canonical}.${loc} ≥1 instruction`,
        ).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('REVERSE_BY_LOCALE Stage 1: every non-en locale has populated fullStringMap with translated names', () => {
    for (const loc of NON_EN_LOCALES) {
      const map = REVERSE_BY_LOCALE[loc];
      expect(map, `reverse map for ${loc}`).toBeDefined();
      if (!map) continue;
      // Stage 1 should carry at least the bulk of the 86 entries — even with
      // some proper-noun carve-outs the fullStringMap should be >50 entries.
      expect(
        Object.keys(map.fullStringMap).length,
        `${loc} fullStringMap entry count`,
      ).toBeGreaterThan(50);
      // Every mapped value must point back to a canonical English task name
      // that actually exists in TASK_CATALOG_I18N.
      for (const canonical of Object.values(map.fullStringMap)) {
        expect(
          TASK_CATALOG_I18N[canonical],
          `${loc} fullStringMap value '${canonical}' is a real task`,
        ).toBeDefined();
      }
    }
  });
});
