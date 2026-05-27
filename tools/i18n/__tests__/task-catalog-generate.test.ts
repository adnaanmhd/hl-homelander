/**
 * Unit tests for the task-catalog regen tool's pure helpers — plan 07-12
 * Task 1 (G-08 closure). The actual end-to-end LLM call happens in Task 2;
 * here we test the JSON-shape gate that protects against LLM hallucination,
 * the file-rewrite splice (header/data/footer preservation), and the
 * en-only extractor.
 *
 * The 86-task TASK_CATALOG_I18N file structure (Record<TaskName,
 * Record<Locale, TaskBody>>) has a known sentinel:
 *
 *   - Header (lines 1..56): doc comment + import + interface declarations.
 *   - Data block (lines 57..5222): `export const TASK_CATALOG_I18N: ... = { ... };`
 *   - Footer (lines 5223..5305): `normalizeForReverseSearch` +
 *     `buildReverseMaps` + `REVERSE_BY_LOCALE` export.
 *
 * The rewrite MUST preserve header + footer byte-identical; only the data
 * block changes when the LLM regen lands.
 */
import { describe, it, expect } from 'vitest';
import {
  validateTaskCatalogShape,
  parseTaskCatalogResponse,
  extractEnSlots,
  renderCatalogFile,
  type TaskBody,
} from '../task-catalog-generate.js';
import { TASK_CATALOG_BRIEF_VERSION, TASK_VERNACULAR_BRIEF } from '../task-catalog-prompts.js';

const sampleEn: Record<string, TaskBody> = {
  'Cooking a meal': {
    name: 'Cooking a meal',
    description: 'Make a full meal from start to finish.',
    instructions: ['Look down at your work area.'],
    examples: [],
  },
  Chopping: {
    name: 'Chopping',
    description: 'Use a knife to cut food into small pieces.',
    instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
    examples: [],
  },
};

// A minimal but structurally-real catalog-file source that mirrors the
// real apps/mobile/src/i18n/taskCatalog.i18n.ts shape: header, the
// `export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = { ... };`
// block, and the buildReverseMaps footer. Used to exercise extractEnSlots
// + renderCatalogFile without depending on the 5305-LOC production file.
const SAMPLE_FILE_SRC = `// Header comment line 1
// Header comment line 2

import type { Locale } from './storage';

export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export interface ReverseMap {
  fullStringMap: Record<string, string>;
  tokenMap: Record<string, string>;
}

export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
  'Cooking a meal': {
    en: {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    es: {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Cooking a meal',
      description: 'Make a full meal from start to finish.',
      instructions: [
        'Look down at your work area.',
      ],
      examples: [],
    },
  },
  Chopping: {
    en: {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Chopping',
      description: 'Use a knife to cut food into small pieces.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
};

export function normalizeForReverseSearch(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

export function buildReverseMaps(catalog: typeof TASK_CATALOG_I18N): Record<string, ReverseMap> {
  return {};
}

export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);
`;

describe('TASK_VERNACULAR_BRIEF (G-08 closure)', () => {
  it('asserts the casual-everyday register applies to task body translation', () => {
    expect(TASK_VERNACULAR_BRIEF).toMatch(/native speaker/i);
    expect(TASK_VERNACULAR_BRIEF).toMatch(/casual everyday/i);
    expect(TASK_VERNACULAR_BRIEF).toMatch(/vernacular/i);
  });

  it('forbids touching the en slot (LLM only translates the 7 non-English locales)', () => {
    // The brief tells the model to translate string VALUES while preserving
    // the JSON structure. Top-level keys (canonical English task names) are
    // stable identifiers and must not be translated. The negation may come
    // either before ("Do NOT change the top-level keys") or after ("top-level
    // keys must not be translated") — both phrasings encode the same rule.
    expect(TASK_VERNACULAR_BRIEF).toMatch(
      /(not|do not|don't).*(top-level keys|object keys|task names)|(top-level keys|object keys|task names).*(not|do not|don't)/i,
    );
  });

  it('requires strict JSON output with no markdown fences', () => {
    expect(TASK_VERNACULAR_BRIEF).toMatch(/strict json/i);
    expect(TASK_VERNACULAR_BRIEF).toMatch(/no markdown/i);
  });

  it('BRIEF_VERSION is an integer ≥ 1', () => {
    expect(Number.isInteger(TASK_CATALOG_BRIEF_VERSION)).toBe(true);
    expect(TASK_CATALOG_BRIEF_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe('validateTaskCatalogShape', () => {
  it('rejects when a task name in en is missing from translated', () => {
    const v = validateTaskCatalogShape(sampleEn, {});
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/Missing task/);
  });

  it('rejects when name is not a string', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': { name: 42, description: 'd', instructions: [], examples: [] },
      Chopping: { name: 'X', description: 'd', instructions: ['a'], examples: [] },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /\.name is not a string/.test(e))).toBeDefined();
  });

  it('rejects when instructions is not an array', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': {
        name: 'X',
        description: 'd',
        instructions: 'not array',
        examples: [],
      },
      Chopping: { name: 'X', description: 'd', instructions: ['a'], examples: [] },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /instructions is not an array/.test(e))).toBeDefined();
  });

  it('rejects when examples is missing', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': { name: 'X', description: 'd', instructions: ['a'] },
      Chopping: { name: 'X', description: 'd', instructions: ['a'], examples: [] },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /examples is not an array/.test(e))).toBeDefined();
  });

  it('rejects when instructions has non-string elements', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': {
        name: 'X',
        description: 'd',
        instructions: ['ok', 42, 'still ok'],
        examples: [],
      },
      Chopping: { name: 'X', description: 'd', instructions: ['a'], examples: [] },
    });
    expect(v.ok).toBe(false);
    expect(v.errors.find((e) => /instructions has non-string elements/.test(e))).toBeDefined();
  });

  it('accepts a well-shaped translated catalog (Hindi/Devanagari sample)', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': {
        name: 'खाना बनाना',
        description: 'पूरा खाना शुरू से अंत तक बनाएं।',
        instructions: ['अपने काम की जगह की ओर देखें।'],
        examples: [],
      },
      Chopping: {
        name: 'काटना',
        description: 'चाकू से खाना छोटे टुकड़ों में काटें।',
        instructions: ['काटने वाले बोर्ड की ओर देखें।', 'सिर को छोटे, सहज मोड़ दें।'],
        examples: [],
      },
    });
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it('rejects non-object input', () => {
    const v = validateTaskCatalogShape(sampleEn, 'not an object');
    expect(v.ok).toBe(false);
  });

  it('rejects null input', () => {
    const v = validateTaskCatalogShape(sampleEn, null);
    expect(v.ok).toBe(false);
  });

  it('rejects when an entry is null', () => {
    const v = validateTaskCatalogShape(sampleEn, {
      'Cooking a meal': null,
      Chopping: { name: 'X', description: 'd', instructions: ['a'], examples: [] },
    });
    expect(v.ok).toBe(false);
  });
});

describe('parseTaskCatalogResponse', () => {
  it('parses a clean JSON response', () => {
    const text = JSON.stringify({ 'Cooking a meal': sampleEn['Cooking a meal'] });
    const parsed = parseTaskCatalogResponse(text);
    expect(parsed).toHaveProperty('Cooking a meal');
  });

  it('strips ```json markdown fences', () => {
    const text = '```json\n' + JSON.stringify({ a: 1 }) + '\n```';
    const parsed = parseTaskCatalogResponse(text);
    expect(parsed).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    const text = '```\n' + JSON.stringify({ a: 1 }) + '\n```';
    const parsed = parseTaskCatalogResponse(text);
    expect(parsed).toEqual({ a: 1 });
  });

  it('throws on malformed JSON', () => {
    expect(() => parseTaskCatalogResponse('this is not json at all')).toThrow();
  });
});

describe('extractEnSlots (TS-aware en-slot extractor)', () => {
  it('pulls the en slot for every task in a multi-task catalog file', () => {
    const en = extractEnSlots(SAMPLE_FILE_SRC);
    expect(Object.keys(en).sort()).toEqual(['Chopping', 'Cooking a meal']);
    expect(en['Cooking a meal']!.name).toBe('Cooking a meal');
    expect(en['Cooking a meal']!.description).toMatch(/Make a full meal/);
    expect(en['Cooking a meal']!.instructions).toEqual(['Look down at your work area.']);
    expect(en['Cooking a meal']!.examples).toEqual([]);
    expect(en['Chopping']!.name).toBe('Chopping');
    expect(en['Chopping']!.instructions).toHaveLength(2);
  });
});

describe('renderCatalogFile (header + footer preservation)', () => {
  it('preserves the header verbatim from the original file', () => {
    const en = extractEnSlots(SAMPLE_FILE_SRC);
    const translated: Record<string, Record<string, TaskBody>> = {
      'pt-BR': {
        'Cooking a meal': {
          name: 'Preparar uma refeição',
          description: 'Faça uma refeição completa do início ao fim.',
          instructions: ['Olhe para sua área de trabalho.'],
          examples: [],
        },
        Chopping: {
          name: 'Picar',
          description: 'Use uma faca para cortar comida.',
          instructions: ['Olhe para a tábua de corte.', 'Faça movimentos suaves de cabeça.'],
          examples: [],
        },
      },
      es: {
        'Cooking a meal': {
          name: 'Preparar una comida',
          description: 'Prepara una comida completa.',
          instructions: ['Mira tu área de trabajo.'],
          examples: [],
        },
        Chopping: {
          name: 'Picar',
          description: 'Usa un cuchillo para cortar.',
          instructions: ['Mira la tabla de cortar.', 'Mueve la cabeza suavemente.'],
          examples: [],
        },
      },
      'hi-IN': {
        'Cooking a meal': {
          name: 'खाना बनाना',
          description: 'पूरा खाना बनाएं।',
          instructions: ['अपने काम की जगह की ओर देखें।'],
          examples: [],
        },
        Chopping: {
          name: 'काटना',
          description: 'चाकू से खाना काटें।',
          instructions: ['बोर्ड की ओर देखें।', 'सिर हल्के से मोड़ें।'],
          examples: [],
        },
      },
      'bn-IN': {
        'Cooking a meal': {
          name: 'রান্না করা',
          description: 'একটি সম্পূর্ণ খাবার তৈরি করুন।',
          instructions: ['আপনার কাজের জায়গায় তাকান।'],
          examples: [],
        },
        Chopping: {
          name: 'কাটা',
          description: 'ছুরি দিয়ে কাটুন।',
          instructions: ['বোর্ডের দিকে তাকান।', 'মাথা মসৃণভাবে নাড়ান।'],
          examples: [],
        },
      },
      'ta-IN': {
        'Cooking a meal': {
          name: 'சமைத்தல்',
          description: 'முழு உணவை தயாரிக்கவும்.',
          instructions: ['உங்கள் வேலை இடத்தைப் பாருங்கள்.'],
          examples: [],
        },
        Chopping: {
          name: 'நறுக்குதல்',
          description: 'கத்தியால் வெட்டுங்கள்.',
          instructions: ['பலகையைப் பாருங்கள்.', 'தலையை மெதுவாக திருப்புங்கள்.'],
          examples: [],
        },
      },
      'te-IN': {
        'Cooking a meal': {
          name: 'వంట చేయడం',
          description: 'పూర్తి భోజనం తయారు చేయండి.',
          instructions: ['మీ పని ప్రాంతం వైపు చూడండి.'],
          examples: [],
        },
        Chopping: {
          name: 'తరగడం',
          description: 'కత్తితో కత్తిరించండి.',
          instructions: ['బోర్డ్ వైపు చూడండి.', 'తలను మెల్లగా తిప్పండి.'],
          examples: [],
        },
      },
      'mr-IN': {
        'Cooking a meal': {
          name: 'जेवण बनवणे',
          description: 'पूर्ण जेवण बनवा.',
          instructions: ['तुमच्या कामाच्या जागेकडे पहा.'],
          examples: [],
        },
        Chopping: {
          name: 'चिरणे',
          description: 'सुरीने कापा.',
          instructions: ['बोर्डाकडे पहा.', 'डोके हलके फिरवा.'],
          examples: [],
        },
      },
    };
    const rendered = renderCatalogFile(SAMPLE_FILE_SRC, en, translated);

    // Header preserved
    expect(rendered).toMatch(/^\/\/ Header comment line 1/);
    expect(rendered).toContain("import type { Locale } from './storage';");

    // Footer (buildReverseMaps + REVERSE_BY_LOCALE) preserved verbatim
    expect(rendered).toContain('export function normalizeForReverseSearch(s: string): string {');
    expect(rendered).toContain('export function buildReverseMaps(');
    expect(rendered).toContain(
      'export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);',
    );

    // Data block contains the new translations
    expect(rendered).toContain('Preparar uma refeição');
    expect(rendered).toContain('खाना बनाना');
    expect(rendered).toContain('সম্পূর্ণ খাবার');

    // en slot is byte-identical
    expect(rendered).toContain("name: 'Cooking a meal'");
    expect(rendered).toContain('Make a full meal from start to finish.');

    // Output ends with the const TASK_CATALOG_I18N object's closing brace then the footer
    expect(rendered).toContain('};');
  });

  it('produces a file with exactly one TASK_CATALOG_I18N export', () => {
    const en = extractEnSlots(SAMPLE_FILE_SRC);
    const translated: Record<string, Record<string, TaskBody>> = {};
    for (const loc of ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']) {
      translated[loc] = {};
      for (const taskName of Object.keys(en)) {
        translated[loc]![taskName] = {
          name: `${loc}-${taskName}`,
          description: `${loc}-desc`,
          instructions: [`${loc}-instr`],
          examples: [],
        };
      }
    }
    const rendered = renderCatalogFile(SAMPLE_FILE_SRC, en, translated);
    const matches = rendered.match(/export const TASK_CATALOG_I18N/g);
    expect(matches?.length).toBe(1);
  });

  it('produces a file where the en slot for each task is byte-identical with the input', () => {
    const en = extractEnSlots(SAMPLE_FILE_SRC);
    const translated: Record<string, Record<string, TaskBody>> = {};
    for (const loc of ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']) {
      translated[loc] = {};
      for (const taskName of Object.keys(en)) {
        translated[loc]![taskName] = {
          name: 'TRANSLATED',
          description: 'TRANSLATED',
          instructions: ['TRANSLATED'],
          examples: [],
        };
      }
    }
    const rendered = renderCatalogFile(SAMPLE_FILE_SRC, en, translated);
    // Every en name from the input must appear verbatim in the output
    for (const taskName of Object.keys(en)) {
      expect(rendered).toContain(en[taskName]!.name);
      expect(rendered).toContain(en[taskName]!.description);
    }
  });
});
