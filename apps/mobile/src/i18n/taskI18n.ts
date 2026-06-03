// taskI18n — client-side localization helpers for the 86-task catalog
// (G-18 / G-19 / G-25 keystone closure, plan 07-16 Task 2).
//
// The 86×8 `TASK_CATALOG_I18N` shipped by plan 07-12 carries the
// Devanagari/Bengali/Tamil/Telugu/Marathi/pt-BR/es translations for every
// task — BUT no rendering site currently looks them up. TasksScreen +
// TaskDetailsSheet + RecordingScreen + HistoryRow each read the server-
// returned canonical English `task.name` / `task.category` / `task.description`
// directly. This helper bridges that gap: every render site wraps the
// server-returned string through one of these four functions.
//
// Per D-12 (i18next key-fallback), all four functions degrade gracefully
// to the canonical English when:
//   - the canonical key is not in the catalog (e.g. a freshly-seeded
//     taxonomy entry not yet bundled), OR
//   - the catalog has the entry but the active-locale slot is missing.
//
// Per D-16 the server is unchanged — `Task.name` / `Task.category` /
// `Task.description` arrive in English, and we look them up locally.
//
// The category helper consults i18n.t against `tasks.category.*` keys
// (added to en.json by Task 2 + LLM-regen'd by Task 5) rather than the
// catalog — the 11 category enum values are screen-wide labels, not
// per-task strings, so keeping them in the locale JSON (next to
// `tasks.category.all`, etc.) groups them with their pill-rendering
// siblings in `TaskCategoryPills.tsx`.

import { TASK_CATALOG_I18N } from './taskCatalog.i18n';
import type { Locale } from './storage';
import i18n from './';

/**
 * Resolve canonical-English task name to active-locale display name.
 * Returns the canonical English when the locale entry is missing or the
 * canonical key is unknown (D-12 fallback).
 */
export function localizeTaskName(canonicalEn: string, locale: string): string {
  const entry = TASK_CATALOG_I18N[canonicalEn]?.[locale as Locale];
  return entry?.name ?? canonicalEn;
}

/**
 * Resolve canonical-English category enum ('Cooking', 'Dishwashing', ...,
 * including the lowercase 'all' sentinel) to active-locale label.
 * Categories live in en.json + the 7 regen'd locale catalogs under
 * `tasks.category.*` (NOT in TASK_CATALOG_I18N). Falls back to the canonical
 * input when the enum is not in the keyMap.
 *
 * KEEP IN SYNC with `TaskCategoryPills.tsx pillLabel()` keyMap.
 */
export function localizeTaskCategory(category: string, locale: string): string {
  const keyMap: Record<string, string> = {
    all: 'tasks.category.all',
    Cooking: 'tasks.category.cooking',
    Dishwashing: 'tasks.category.dishwashing',
    Kitchen: 'tasks.category.kitchen',
    Cleaning: 'tasks.category.cleaning',
    Tidying: 'tasks.category.tidying',
    Laundry: 'tasks.category.laundry',
    Gardening: 'tasks.category.gardening',
    'Pet Care': 'tasks.category.petCare',
    'Home Maintenance': 'tasks.category.homeMaintenance',
    Hobby: 'tasks.category.hobby',
    Other: 'tasks.category.other',
  };
  const key = keyMap[category];
  if (!key) return category;
  return i18n.getFixedT(locale)(key, { defaultValue: category });
}

/**
 * Resolve canonical-English task description to active-locale text.
 * Falls back to the canonical English description when the locale entry is
 * missing; falls back to empty string when the canonical key is unknown.
 */
export function localizeTaskDescription(canonicalEn: string, locale: string): string {
  const entry = TASK_CATALOG_I18N[canonicalEn];
  if (!entry) return '';
  return entry[locale as Locale]?.description ?? entry.en.description ?? '';
}

/**
 * Resolve canonical-English task instructions array to active-locale.
 * Falls back to the canonical English instructions when the locale entry is
 * missing; falls back to empty array when the canonical key is unknown.
 */
export function localizeTaskInstructions(canonicalEn: string, locale: string): string[] {
  const entry = TASK_CATALOG_I18N[canonicalEn];
  if (!entry) return [];
  return entry[locale as Locale]?.instructions ?? entry.en.instructions ?? [];
}
