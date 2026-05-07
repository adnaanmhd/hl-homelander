// Unit tests for the markdown-table taxonomy parser. The parser handles the
// real shape of task-taxonomy.md (a single | Category | Task | Setting | ... |
// table); fixtures here exercise it against synthesized small inputs.

import { describe, it, expect } from 'vitest';
import {
  parseTaxonomy,
  normalizeName,
  loadIconMapping,
  joinTaxonomyWithMapping,
} from '../../scripts/parse-taxonomy.js';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function withTempFile(content: string, ext = '.md') {
  const dir = await mkdtemp(join(tmpdir(), 'humyn-parse-'));
  const file = join(dir, `taxonomy${ext}`);
  await writeFile(file, content, 'utf8');
  return file;
}

describe('parseTaxonomy', () => {
  it('parses a single-row markdown table', async () => {
    const file = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking  | Make Tea | Indoor | Boil water and brew a cup of tea. | • Boil water<br>• Add tea leaves<br>• Pour into cup |',
      ].join('\n'),
    );
    const tasks = await parseTaxonomy(file);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual({
      name: 'Make Tea',
      description: 'Boil water and brew a cup of tea.',
      category: 'Cooking',
      setting: 'indoor',
      instructions: ['Boil water', 'Add tea leaves', 'Pour into cup'],
    });
  });

  it('parses multiple rows in document order', async () => {
    const file = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Slicing | Indoor | Slice food. | • Look down. |',
        '| Cleaning | Sweeping | Indoor | Sweep floor. | • Walk slowly. |',
        '| Gardening | Watering | Outdoor | Water plants. | • Look at each plant. |',
      ].join('\n'),
    );
    const tasks = await parseTaxonomy(file);
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.name)).toEqual(['Slicing', 'Sweeping', 'Watering']);
    expect(tasks[2]?.setting).toBe('outdoor');
  });

  it('rejects task with > 3 instructions', async () => {
    const file = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Overinstructed | Indoor | Too many. | • one<br>• two<br>• three<br>• four |',
      ].join('\n'),
    );
    await expect(parseTaxonomy(file)).rejects.toThrow(/max is 3/);
  });

  it('rejects task with no instructions', async () => {
    const file = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Empty | Indoor | No steps. |  |',
      ].join('\n'),
    );
    await expect(parseTaxonomy(file)).rejects.toThrow(/no instructions/);
  });

  it('rejects task with invalid setting', async () => {
    const file = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Bad | Sometimes | Description. | • step |',
      ].join('\n'),
    );
    await expect(parseTaxonomy(file)).rejects.toThrow(/setting must be/);
  });
});

describe('normalizeName', () => {
  it('strips parenthetical suffixes', () => {
    expect(normalizeName('Cooking a meal (full session)')).toBe('Cooking a meal');
    expect(normalizeName('Post-washing laundry (sort → fold → store)')).toBe(
      'Post-washing laundry',
    );
  });
  it('returns input unchanged when no parens', () => {
    expect(normalizeName('Folding clothes')).toBe('Folding clothes');
  });
});

describe('loadIconMapping + joinTaxonomyWithMapping', () => {
  it('joins taxonomy rows to mapping entries by normalized name', async () => {
    const taxonomyFile = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Cooking a meal | Indoor | Make a meal. | • Look down. |',
      ].join('\n'),
    );
    const mappingFile = await withTempFile(
      JSON.stringify({
        tasks: [
          {
            id: 'cooking-meal',
            name: 'Cooking a meal (full session)',
            category: 'Cooking',
            setting: 'indoor',
            icon: 'ChefHat',
          },
        ],
      }),
      '.json',
    );
    const tasks = await parseTaxonomy(taxonomyFile);
    const mapping = await loadIconMapping(mappingFile);
    const seed = joinTaxonomyWithMapping(tasks, mapping);
    expect(seed).toHaveLength(1);
    expect(seed[0]?.slug).toBe('cooking-meal');
    expect(seed[0]?.iconKey).toBe('ChefHat');
    expect(seed[0]?.name).toBe('Cooking a meal'); // taxonomy form preserved
  });

  it('throws when a taxonomy row has no mapping entry', async () => {
    const taxonomyFile = await withTempFile(
      [
        '| Category | Task | Setting | Description | Instructions |',
        '| -------- | ---- | ------- | ----------- | ------------ |',
        '| Cooking | Unknown task | Indoor | Description. | • step |',
      ].join('\n'),
    );
    const mappingFile = await withTempFile(JSON.stringify({ tasks: [] }), '.json');
    const tasks = await parseTaxonomy(taxonomyFile);
    const mapping = await loadIconMapping(mappingFile);
    expect(() => joinTaxonomyWithMapping(tasks, mapping)).toThrow(/no entry in mapping.json/);
  });
});
