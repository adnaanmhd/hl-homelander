/**
 * Plan 07-16 Task 2 — taskI18n.ts contract (G-18 / G-19 / G-25 keystone).
 *
 * The helper looks the server-returned canonical English task name up in
 * TASK_CATALOG_I18N (D-15 source of truth) and returns the active-locale
 * translation. Falls back gracefully to canonical English per D-12 when the
 * locale entry is missing or the canonical key is unknown.
 *
 * Test location follows the project convention `apps/mobile/__tests__/...`
 * (vitest.config.ts `include` glob — same Rule-3 deviation as 07-01).
 */
import { describe, it, expect } from 'vitest';
import {
  localizeTaskName,
  localizeTaskCategory,
  localizeTaskDescription,
  localizeTaskInstructions,
} from '../../src/i18n/taskI18n';
import { TASK_CATALOG_I18N } from '../../src/i18n/taskCatalog.i18n';
import { reverseSearch } from '../../src/i18n/reverseSearch';

describe('taskI18n.ts (G-18 / G-19 / G-25 keystone helper)', () => {
  // Read the canonical en+hi-IN+pt-BR truth from the catalog so the assertion
  // stays in lockstep with any future re-translation pass without re-authoring
  // the test (the catalog IS the source of truth per D-15).
  const COOKING_EN = TASK_CATALOG_I18N['Cooking a meal']?.en;
  const COOKING_HI = TASK_CATALOG_I18N['Cooking a meal']?.['hi-IN'];
  const COOKING_PT = TASK_CATALOG_I18N['Cooking a meal']?.['pt-BR'];

  it('localizeTaskName returns the hi-IN translation for "Cooking a meal"', () => {
    expect(COOKING_HI).toBeDefined();
    expect(localizeTaskName('Cooking a meal', 'hi-IN')).toBe(COOKING_HI!.name);
  });

  it('localizeTaskName returns the canonical English for locale=en', () => {
    expect(localizeTaskName('Cooking a meal', 'en')).toBe(COOKING_EN!.name);
  });

  it('localizeTaskName returns the pt-BR translation', () => {
    expect(COOKING_PT).toBeDefined();
    expect(localizeTaskName('Cooking a meal', 'pt-BR')).toBe(COOKING_PT!.name);
  });

  it('localizeTaskName falls back to canonical English when the canonical key is unknown (D-12)', () => {
    // Server may legitimately return a task name not in the catalog (e.g. a
    // freshly added taxonomy entry not yet bundled). Helper must not throw.
    expect(localizeTaskName('Unknown task name xyz', 'hi-IN')).toBe('Unknown task name xyz');
  });

  it('localizeTaskCategory routes through i18n.t — returns a string for hi-IN', () => {
    // The helper consults i18n's per-locale resource bundle for the
    // `tasks.category.cooking` key. Without the en.json keys landed first,
    // the value falls back to canonical English ('Cooking'). After Task 2
    // lands the en.json additions, i18n's hi-IN bundle (post-Task-5 regen)
    // will resolve to a translated Devanagari label.
    const out = localizeTaskCategory('Cooking', 'hi-IN');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('localizeTaskDescription returns the hi-IN description string', () => {
    expect(COOKING_HI).toBeDefined();
    expect(localizeTaskDescription('Cooking a meal', 'hi-IN')).toBe(COOKING_HI!.description);
  });

  it('localizeTaskInstructions returns the hi-IN instructions array (Devanagari, ≥1 item)', () => {
    const out = localizeTaskInstructions('Cooking a meal', 'hi-IN');
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]).toBe(COOKING_HI!.instructions[0]);
  });

  it('description + instructions fall back to en when canonical key unknown (D-12 fallback)', () => {
    // Empty-string / empty-array fallback for a completely unknown key.
    expect(localizeTaskDescription('Unknown task xyz', 'hi-IN')).toBe('');
    expect(localizeTaskInstructions('Unknown task xyz', 'hi-IN')).toEqual([]);
  });
});

describe('reverseSearch EN_TOKEN_ALIASES (G-13 closure, Plan 07-16 Task 3)', () => {
  // The curated alias map rewrites English derivational forms to the
  // canonical token the server's ts_vector index matches. Backend stays
  // unmodified per D-16 — this is purely the client-side bridge.

  it('reverseSearch("recyclable", "en") → "recyclables" (singular adjective form)', () => {
    expect(reverseSearch('recyclable', 'en')).toBe('recyclables');
  });

  it('reverseSearch is case-insensitive for the en alias lookup', () => {
    // The alias map uses .toLowerCase() before lookup, so "Recyclable" /
    // "RECYCLABLE" / "Recyclables" all hit.
    expect(reverseSearch('Recyclable', 'en')).toBe('recyclables');
    expect(reverseSearch('RECYCLABLE', 'en')).toBe('recyclables');
  });

  it('reverseSearch("recyclables", "en") → "recyclables" (identity passthrough)', () => {
    expect(reverseSearch('recyclables', 'en')).toBe('recyclables');
  });

  it('reverseSearch("recycle", "en") → "recyclables" (verb form)', () => {
    expect(reverseSearch('recycle', 'en')).toBe('recyclables');
  });

  it('reverseSearch("recycling", "en") → "recyclables" (gerund form)', () => {
    expect(reverseSearch('recycling', 'en')).toBe('recyclables');
  });

  it('reverseSearch("recyclable bottles", "en") → "recyclables bottles" (multi-token; "bottles" passes through)', () => {
    expect(reverseSearch('recyclable bottles', 'en')).toBe('recyclables bottles');
  });

  it('reverseSearch("cooking a meal", "en") → "cooking a meal" (no alias entries; tokens pass through)', () => {
    // All tokens are absent from the alias map → return unchanged. Stage-3
    // passthrough behaviour for en.
    expect(reverseSearch('cooking a meal', 'en')).toBe('cooking a meal');
  });
});
