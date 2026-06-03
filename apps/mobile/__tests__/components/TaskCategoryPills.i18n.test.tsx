// TaskCategoryPills — Plan 07-16 Task 4a G-17 closure.
//
// Pins the i18n contract: the const STAYS English (the canonical state /
// server-side filter value), but the rendered LABEL routes through
// `tasks.category.*` keys. The 11 enum values all map to a non-null en key.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { TaskCategoryPills, TASK_CATEGORY_PILLS } from '../../src/components/TaskCategoryPills';
import i18n from '../../src/i18n';

describe('TaskCategoryPills — Plan 07-16 G-17 (i18n)', () => {
  afterEach(() => {
    cleanup();
  });

  it('TASK_CATEGORY_PILLS const stays English-canonical (11 entries, "all" first)', () => {
    expect(TASK_CATEGORY_PILLS).toHaveLength(11);
    expect(TASK_CATEGORY_PILLS[0]).toBe('all');
    // Spot-check 2 more (the const must NOT have been translated)
    expect(TASK_CATEGORY_PILLS.includes('Cooking')).toBe(true);
    expect(TASK_CATEGORY_PILLS.includes('Pet Care')).toBe(true);
  });

  it('every pill value has a non-null en i18n value (`tasks.category.*`)', () => {
    void i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    // Map each enum value to its key the same way the component does.
    const KEY: Record<string, string> = {
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
    };
    for (const value of TASK_CATEGORY_PILLS) {
      const v = t(KEY[value]!);
      expect(v.length, `${value} resolves to non-empty en string`).toBeGreaterThan(0);
      expect(v, `${value} not the raw key`).not.toBe(KEY[value]);
    }
  });

  it('renders 11 pill rows with their accessibility labels intact', () => {
    const { getByLabelText } = render(
      <TaskCategoryPills selected="all" onSelect={() => undefined} />,
    );
    for (const value of TASK_CATEGORY_PILLS) {
      expect(getByLabelText(`pill-${value}`)).toBeTruthy();
    }
  });
});
