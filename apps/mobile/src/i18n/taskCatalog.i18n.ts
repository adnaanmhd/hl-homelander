// Task catalog — full-body translations for the 86-task taxonomy across
// 8 BCP-47 locales (D-01 / D-15 / I18N-10). Plan 07-06 Task 2.
//
// COUNT RECONCILIATION (2026-05-24): 07-SPEC line 79 and the plan body
// both say "65-task catalog". As of commit 2fbb65e (2026-05-24
// "feat(taxonomy): add 21 US-oriented tasks") the canonical task-taxonomy.md
// + design-system/task-icons/mapping.json carry 86 tasks. The SPEC literal
// is stale by hours. Backend seeds 86 from the same canonical taxonomy
// (apps/api/scripts/parse-taxonomy.ts joinTaxonomyWithMapping). Shipping
// only 65 of 86 would silently drop the 21 new US-oriented tasks from
// non-English locale search — that's the correctness failure mode we
// rejected. See SUMMARY.md "Deviations from Plan" for the Rule-2 trail.
//
// SOURCE OF TRUTH (D-15): this file IS the source of truth for both the
// UI surfaces that render task names/descriptions in the user's locale
// AND the per-locale reverse-search maps consumed by services/tasksApi.ts
// (see reverseSearch.ts).
//
// ENGLISH ENTRIES are hand-authored verbatim from a row of
// task-taxonomy.md (Task column → name; Description column → description;
// Instructions column split on <br> → instructions[]). `examples` is []
// for every task because the source TaskDetailsSheet (Phase 6) does not
// surface per-task examples — the field is reserved for a future
// authoring pass and ships empty across all locales for parity.
//
// NON-ENGLISH ENTRIES are CURRENTLY SKELETON copies of the English body
// (verbatim, mirroring the i18n runtime placeholder pattern from
// plan 07-01). Plan 07-02-extension OR a sibling tools/i18n/generate-tasks.ts
// reads this file, calls Claude Opus 4.7 with the I18N-05 vernacular
// brief, and overwrites the 7 non-English locale objects with real
// translations. Until that regen runs, reverseSearch() Stage-1 lookups
// resolve as identity (localized name === English name), which is the
// gracefully-degraded state, not a bug. The runtime contract (TaskBody
// shape, REVERSE_BY_LOCALE shape) is unchanged across the LLM regen
// boundary — only the string VALUES change.
//
// Generated via the inline node script in plan 07-06 Task 2. Re-run that
// script after task-taxonomy.md changes; the LLM regen tool stages
// translation runs on the output.

import type { Locale } from './storage';

export interface TaskBody {
  name: string;
  description: string;
  instructions: string[];
  examples: string[];
}

export interface ReverseMap {
  /** NFC-lowercase-trimmed localized full-string → canonical English task name. */
  fullStringMap: Record<string, string>;
  /** NFC-lowercase-trimmed localized token → English token (for Stage 2 fallback). */
  tokenMap: Record<string, string>;
}

export const TASK_CATALOG_I18N: Record<string, Record<Locale, TaskBody>> = {
  'Cooking a meal': {
    en: {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    es: {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Cooking a meal',
      description:
        'Make a full meal from start to finish. This can include washing, cutting, cooking on the stove, and putting food on plates.',
      instructions: [
        'Look down at your work area.',
        "Keep working — don't stand idle.",
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
  },
  Chopping: {
    en: {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Chopping',
      description:
        'Use a knife to cut food into small pieces on a cutting board. Make pieces the size you need.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  Dicing: {
    en: {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Dicing',
      description: 'Use a knife to cut food into small, even cubes on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  Slicing: {
    en: {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Slicing',
      description: 'Use a knife to cut food into thin, flat pieces on a cutting board.',
      instructions: ['Look down at the cutting board.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  Peeling: {
    en: {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Peeling',
      description: 'Remove the outer skin from fruits or vegetables using a peeler or knife.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Kneading or rolling dough': {
    en: {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    es: {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Kneading or rolling dough',
      description:
        'Press, fold, and push dough with your hands. Use a rolling pin to flatten it if needed.',
      instructions: ['Look down at the dough.', "Keep your hands moving — don't pause."],
      examples: [],
    },
  },
  'Plating or serving food/drinks': {
    en: {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    es: {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'te-IN': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Plating or serving food/drinks',
      description:
        'Move cooked food or drinks from pots and pans onto plates, bowls, or glasses for eating.',
      instructions: ['Look down at what you are serving.', 'Move smoothly between items.'],
      examples: [],
    },
  },
  'Reheating food': {
    en: {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    es: {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Reheating food',
      description: 'Warm up food that is already cooked using a microwave, stove, or oven.',
      instructions: ['Look at the appliance and the food.', 'Move smoothly between steps.'],
      examples: [],
    },
  },
  'Packing food': {
    en: {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    es: {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Packing food',
      description: 'Put food into boxes, containers, or bags so it can be carried or stored.',
      instructions: ['Look down at the food and container.', "Keep packing — don't pause."],
      examples: [],
    },
  },
  'Brewing drip coffee': {
    en: {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    es: {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Brewing drip coffee',
      description:
        'Fill the coffee maker with water, add ground coffee to the filter basket, and start the machine to brew a pot.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between steps.'],
      examples: [],
    },
  },
  'Brewing single-cup coffee (pod machine)': {
    en: {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    es: {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Brewing single-cup coffee (pod machine)',
      description:
        'Place a coffee pod into a single-cup brewer, set a mug under the spout, and press the button to brew one cup.',
      instructions: ['Look at the machine while you work.', 'Move slowly between steps.'],
      examples: [],
    },
  },
  'Grilling on a BBQ': {
    en: {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    es: {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'te-IN': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Grilling on a BBQ',
      description:
        'Light the BBQ grill, place food on the grates, and use tongs or a spatula to flip and check it until cooked.',
      instructions: ['Look at the grill while cooking.', 'Move smoothly between flips and checks.'],
      examples: [],
    },
  },
  'Baking on a sheet pan': {
    en: {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    es: {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Baking on a sheet pan',
      description:
        'Arrange food on a baking sheet, place it in the oven, and remove it when done using oven mitts.',
      instructions: [
        'Look down at the sheet pan while arranging.',
        'Move slowly when opening and closing the oven.',
      ],
      examples: [],
    },
  },
  'Washing dishes': {
    en: {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    es: {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'te-IN': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Washing dishes',
      description:
        'Clean used plates, bowls, glasses, and utensils with soap and water. Rinse them well and place them aside to dry.',
      instructions: ['Look down at the sink.', 'Keep working through the stack.'],
      examples: [],
    },
  },
  'Drying or wiping dishes': {
    en: {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    es: {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Drying or wiping dishes',
      description: 'Use a clean, dry cloth to remove water from washed dishes and place them away.',
      instructions: ['Look down at your hands.', "Keep wiping — don't pause."],
      examples: [],
    },
  },
  'Loading a dishwasher': {
    en: {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    es: {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'te-IN': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Loading a dishwasher',
      description:
        'Place dirty dishes, glasses, and utensils into the dishwasher racks in an organized way. Add detergent and close the door.',
      instructions: ['Look at the rack you are loading.', 'Move smoothly between dishes.'],
      examples: [],
    },
  },
  'Unloading a dishwasher': {
    en: {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    es: {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'te-IN': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Unloading a dishwasher',
      description:
        'Take clean dishes, glasses, and utensils out of the dishwasher and put each item in its right place in cabinets or drawers.',
      instructions: ['Look at the rack you are unloading.', 'Move smoothly between items.'],
      examples: [],
    },
  },
  'Organizing kitchen cabinets or drawers': {
    en: {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    es: {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing kitchen cabinets or drawers',
      description:
        'Take items out of cabinets or drawers, sort them, and put them back in a neat way.',
      instructions: ['Look at the cabinet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
  },
  'Organizing spice rack': {
    en: {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    es: {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing spice rack',
      description: 'Arrange spice jars and bottles on a rack or shelf in a neat order.',
      instructions: ['Look at the rack while arranging.', 'Move smoothly between jars.'],
      examples: [],
    },
  },
  'Setting a table': {
    en: {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    es: {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'te-IN': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Setting a table',
      description: 'Place plates, glasses, spoons, forks, and napkins on the table for a meal.',
      instructions: ['Look down at the table while placing items.', 'Move smoothly between items.'],
      examples: [],
    },
  },
  'Clearing a table': {
    en: {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    es: {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Clearing a table',
      description: 'Remove plates, glasses, leftover food, and trash from the table after a meal.',
      instructions: [
        'Look down at the table while clearing.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
  },
  'Organizing or stocking fridge': {
    en: {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    es: {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing or stocking fridge',
      description:
        'Place food and drinks inside the fridge in a neat way. Move old items and fit new ones in.',
      instructions: [
        'Open the fridge fully and look inside.',
        "Keep moving items — don't stand idle.",
      ],
      examples: [],
    },
  },
  'Unpacking or sorting groceries': {
    en: {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    es: {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Unpacking or sorting groceries',
      description: 'Take groceries out of bags and sort them. Place each item in its right place.',
      instructions: ['Look down at the bags and items.', "Keep unpacking — don't pause."],
      examples: [],
    },
  },
  'Using a garbage disposal': {
    en: {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    es: {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Using a garbage disposal',
      description:
        'Scrape food scraps into the sink drain, run cold water, and switch on the in-sink disposal to grind the waste.',
      instructions: ['Look down at the sink.', 'Move slowly between steps.'],
      examples: [],
    },
  },
  'Cleaning kitchen counter-top': {
    en: {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Cleaning kitchen counter-top',
      description:
        'Wipe the kitchen counter with a cloth and cleaner to remove dirt, food, and stains.',
      instructions: ['Look down at the counter.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Cleaning appliances': {
    en: {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Cleaning appliances',
      description:
        'Wipe and clean appliances like the microwave, stove, or fridge from outside and inside.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  Sweeping: {
    en: {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    es: {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Sweeping',
      description:
        'Use a broom to push dirt and dust on the floor into one spot. Then collect it in a dustpan.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
  },
  Mopping: {
    en: {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    es: {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Mopping',
      description:
        'Use a wet mop to clean the floor. Dip the mop in soapy water, wring it out, and wipe the floor in sections until it is clean.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
  },
  Vacuuming: {
    en: {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    es: {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Vacuuming',
      description:
        'Use a vacuum cleaner to suck up dust and dirt from the floor, carpet, or furniture.',
      instructions: [
        'Look down at the area you are cleaning.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
  },
  Dusting: {
    en: {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    es: {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'te-IN': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Dusting',
      description: 'Use a cloth or duster to wipe dust off shelves, tables, and other surfaces.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between surfaces.'],
      examples: [],
    },
  },
  'Spraying and wiping surfaces': {
    en: {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Spraying and wiping surfaces',
      description: 'Spray cleaner on a surface and wipe it clean with a cloth.',
      instructions: ['Look at the surface while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  'Bathroom cleaning': {
    en: {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Bathroom cleaning',
      description: 'Clean the toilet, sink, shower, and tiles using cleaner, brush, and cloth.',
      instructions: ['Look at the part you are cleaning.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  'Cleaning windows and mirrors': {
    en: {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Cleaning windows and mirrors',
      description: 'Spray cleaner on glass and wipe it with a cloth or paper until it is clear.',
      instructions: ['Look at the glass while wiping.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  'Emptying or replacing trash bag': {
    en: {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Emptying or replacing trash bag',
      description:
        'Take the full trash bag out of the bin, tie it, and put a new bag inside the bin.',
      instructions: ['Look down at the bin while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Taking out trash': {
    en: {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    es: {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Taking out trash',
      description:
        'Carry the tied trash bag from the house and place it in the outdoor bin or pickup spot.',
      instructions: [
        'Look ahead and at the bin while placing the bag.',
        'Walk slowly and steadily.',
      ],
      examples: [],
    },
  },
  'Sweeping outdoor area': {
    en: {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    es: {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Sweeping outdoor area',
      description:
        'Use a broom to clear leaves, dust, and dirt from outdoor floors like a porch or driveway.',
      instructions: ['Look down at the floor.', 'Walk slowly with small head turns.'],
      examples: [],
    },
  },
  'Sorting recyclables': {
    en: {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    es: {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'te-IN': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Sorting recyclables',
      description:
        'Separate cans, bottles, paper, and cardboard from regular trash into the right recycling bins.',
      instructions: ['Look at each item before sorting.', 'Move smoothly between bins.'],
      examples: [],
    },
  },
  'Shoveling snow': {
    en: {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    es: {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Shoveling snow',
      description:
        'Use a snow shovel to lift and move snow off a driveway, walkway, or porch into a pile to the side.',
      instructions: [
        'Look down at the area you are clearing.',
        'Walk slowly with small head turns.',
      ],
      examples: [],
    },
  },
  'Organizing a desk': {
    en: {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    es: {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing a desk',
      description: 'Arrange papers, books, pens, and other items on a desk in a neat way.',
      instructions: ['Look down at the desk.', "Keep moving items — don't stand idle."],
      examples: [],
    },
  },
  'Organizing a closet or drawer': {
    en: {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    es: {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing a closet or drawer',
      description:
        'Take out clothes or items from a closet or drawer, sort them, and put them back neatly.',
      instructions: ['Look at the closet or drawer.', "Keep moving items — don't stand idle."],
      examples: [],
    },
  },
  'Organizing a room': {
    en: {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    es: {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Organizing a room',
      description:
        'Pick up things in a room, put them in their right place, and make the room neat.',
      instructions: [
        'Look at what you are picking up or placing.',
        "Keep moving — don't stand idle.",
      ],
      examples: [],
    },
  },
  'Changing sheets or covers': {
    en: {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Changing sheets or covers',
      description:
        'Remove old sheets, pillow covers, or blankets from the bed and put on fresh ones.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Making a bed': {
    en: {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Making a bed',
      description:
        'Smooth the fitted sheet, spread the top sheet and comforter or blanket evenly, and arrange the pillows at the head of the bed.',
      instructions: ['Look down at the bed while you work.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Loading or unloading washing machine': {
    en: {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    es: {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'te-IN': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Loading or unloading washing machine',
      description:
        'Put dirty clothes into the washing machine, or take clean clothes out after washing.',
      instructions: ['Look at the machine while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
  },
  'Hanging clothes to dry': {
    en: {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    es: {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'te-IN': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Hanging clothes to dry',
      description: 'Hang wet clothes on a line, rack, or rod so they can dry in the air.',
      instructions: ['Look at the line or rack while hanging.', 'Move smoothly between clothes.'],
      examples: [],
    },
  },
  'Removing clothes from drying line': {
    en: {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    es: {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'te-IN': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Removing clothes from drying line',
      description: 'Take dry clothes off the line or rack and place them in a basket.',
      instructions: ['Look at the line while removing clothes.', 'Move smoothly between clothes.'],
      examples: [],
    },
  },
  'Sorting clothes or fabrics': {
    en: {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    es: {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Sorting clothes or fabrics',
      description:
        'Separate clothes and fabrics into groups, like by color, type, or who they belong to.',
      instructions: ['Look down at the clothes while sorting.', "Keep sorting — don't pause."],
      examples: [],
    },
  },
  'Folding clothes': {
    en: {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    es: {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Folding clothes',
      description:
        'Take clean, dry clothes and fold each one neatly. Make small, even folds so the clothes are easy to stack or store.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        "Keep folding — don't pause.",
      ],
      examples: [],
    },
  },
  'Folding towels or bedsheets': {
    en: {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    es: {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Folding towels or bedsheets',
      description:
        'Fold large pieces of cloth like towels and bedsheets into neat squares or rectangles.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
  },
  'Ironing clothes': {
    en: {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Ironing clothes',
      description: 'Use an iron to press clothes flat and remove wrinkles.',
      instructions: ['Look down at the cloth while ironing.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Post-washing laundry (sort → fold → store)': {
    en: {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    es: {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Post-washing laundry (sort → fold → store)',
      description:
        'Take dry clothes, sort them, fold each one, and place them where they belong, like in a closet or drawer.',
      instructions: ['Look down at the clothes while you work.', "Keep working — don't pause."],
      examples: [],
    },
  },
  'Loading or unloading clothes dryer': {
    en: {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    es: {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'te-IN': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Loading or unloading clothes dryer',
      description:
        'Move wet clothes from the washer into the dryer, or take dry clothes out of the dryer into a basket.',
      instructions: ['Look at the dryer while you work.', 'Move smoothly between clothes.'],
      examples: [],
    },
  },
  'Cleaning the dryer lint trap': {
    en: {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Cleaning the dryer lint trap',
      description:
        'Pull out the lint screen from the dryer, remove the layer of lint with your fingers, and slide the screen back in.',
      instructions: ['Look down at the lint screen.', 'Move slowly and steadily.'],
      examples: [],
    },
  },
  'Folding a fitted sheet': {
    en: {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    es: {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Folding a fitted sheet',
      description:
        'Tuck the corners of a fitted sheet into each other and fold it into a flat rectangle.',
      instructions: [
        'Sit or stand in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
  },
  'Watering plants': {
    en: {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    es: {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'te-IN': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Watering plants',
      description:
        'Pour water on plants using a can, hose, or bottle. Give each plant enough water so the soil is wet but not flooded.',
      instructions: ['Look at each plant while you water it.', 'Walk slowly between plants.'],
      examples: [],
    },
  },
  'Planting or repotting': {
    en: {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Planting or repotting',
      description:
        'Place a plant or seed into soil in a pot or in the ground. Pack soil around it firmly.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Pruning or trimming': {
    en: {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Pruning or trimming',
      description:
        'Use scissors or shears to cut off extra leaves, stems, or branches from plants.',
      instructions: ['Look at the part you are cutting.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  Hoeing: {
    en: {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Hoeing',
      description: 'Use a hoe to break up soil, remove weeds, or shape the ground.',
      instructions: ['Look down at the soil.', 'Move smoothly and steadily.'],
      examples: [],
    },
  },
  'Mowing the lawn': {
    en: {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Mowing the lawn',
      description: 'Use a lawn mower to cut the grass on the ground to an even, short height.',
      instructions: ['Look down at the grass in front of you.', 'Walk slowly and steadily.'],
      examples: [],
    },
  },
  'Raking leaves': {
    en: {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Raking leaves',
      description: 'Use a rake to pull fallen leaves on the ground into a pile.',
      instructions: ['Look down at the leaves and the rake.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Harvesting fruits or vegetables': {
    en: {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    es: {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Harvesting fruits or vegetables',
      description:
        'Pick fruits or vegetables from plants by hand or with a tool, and place them in a basket or bag.',
      instructions: [
        'Look at the fruit or vegetable as you pick it.',
        'Move smoothly between picks.',
      ],
      examples: [],
    },
  },
  'Coiling a hose': {
    en: {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Coiling a hose',
      description: 'Roll up a garden hose neatly into a circle so it can be stored.',
      instructions: ['Look down at your hands.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Bagging leaves': {
    en: {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Bagging leaves',
      description:
        'Gather raked piles of leaves with your hands or a scoop and put them into yard-waste bags.',
      instructions: ['Look down at the leaves.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Pulling weeds by hand': {
    en: {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    es: {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'te-IN': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Pulling weeds by hand',
      description:
        'Grip weeds at the base and pull them out of the soil, root and all, then place them in a pile or bag.',
      instructions: ['Look down at the soil.', 'Move slowly between weeds.'],
      examples: [],
    },
  },
  'Filling a feeding bowl': {
    en: {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Filling a feeding bowl',
      description: "Pour pet food into the pet's bowl and place it where the pet eats.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Emptying or cleaning feeding bowl': {
    en: {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Emptying or cleaning feeding bowl',
      description: 'Throw out leftover food, then wash the bowl with soap and water.',
      instructions: ['Look down at the bowl while you clean.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Clearing a litter box': {
    en: {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Clearing a litter box',
      description:
        'Scoop out used litter from the litter box and put it in the trash. Add fresh litter if needed.',
      instructions: ['Look down at the box while you scoop.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Refilling water bowl': {
    en: {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Refilling water bowl',
      description: "Empty old water from the pet's bowl and pour fresh water into it.",
      instructions: ['Look down at the bowl while pouring.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Brushing or grooming a pet': {
    en: {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Brushing or grooming a pet',
      description:
        "Use a brush to comb your pet's fur. Move the brush gently from head to tail to remove loose hair and tangles.",
      instructions: ['Look at the pet while brushing.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Bathing a pet': {
    en: {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Bathing a pet',
      description: 'Wash your pet using water and pet shampoo. Rinse well and dry with a towel.',
      instructions: ['Look at the pet while washing.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Walking a pet': {
    en: {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    es: {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'te-IN': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Walking a pet',
      description: 'Take your pet outside on a leash for a walk.',
      instructions: ['Look ahead and at the pet while walking.', 'Walk at a steady pace.'],
      examples: [],
    },
  },
  'Filling a bird feeder': {
    en: {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Filling a bird feeder',
      description: 'Take down the bird feeder, pour bird seed into it, and hang it back up.',
      instructions: ['Look at the feeder while filling.', 'Move slowly and steadily.'],
      examples: [],
    },
  },
  'Picking up after a dog': {
    en: {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Picking up after a dog',
      description:
        'Use a plastic bag to pick up dog waste during a walk, tie the bag, and carry it to a trash bin.',
      instructions: ['Look down at the waste while picking up.', 'Move slowly and steadily.'],
      examples: [],
    },
  },
  'Assembling furniture': {
    en: {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'pt-BR': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    es: {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'hi-IN': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'bn-IN': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'ta-IN': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'te-IN': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
    'mr-IN': {
      name: 'Assembling furniture',
      description:
        'Put together furniture parts using screws, bolts, and tools by following the steps.',
      instructions: ['Look down at your hands while you work.', "Keep working — don't pause."],
      examples: [],
    },
  },
  'Using hand tools (screwdriver, hammer, etc.)': {
    en: {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    es: {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'te-IN': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Using hand tools (screwdriver, hammer, etc.)',
      description:
        'Use simple tools to fix or build something. For example, turn screws with a screwdriver or hit nails with a hammer.',
      instructions: ['Look down at your hands while working.', 'Move slowly between actions.'],
      examples: [],
    },
  },
  'Painting a wall or surface': {
    en: {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Painting a wall or surface',
      description: 'Use a brush or roller to apply paint evenly on a wall or surface.',
      instructions: ['Look at the part you are painting.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  'Minor plumbing repair': {
    en: {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    es: {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'te-IN': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Minor plumbing repair',
      description: 'Fix small problems like a leaking tap or a loose pipe using basic tools.',
      instructions: ['Look down at your hands while you work.', 'Move slowly between actions.'],
      examples: [],
    },
  },
  'Washing or cleaning a vehicle': {
    en: {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    es: {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'te-IN': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Washing or cleaning a vehicle',
      description:
        'Use water, soap, and a cloth or sponge to clean the outside of a car, bike, or scooter.',
      instructions: ['Look at the part you are washing.', 'Move smoothly between sections.'],
      examples: [],
    },
  },
  'Replacing an air filter': {
    en: {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    es: {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Replacing an air filter',
      description:
        'Open the air filter slot on the furnace or return vent, slide the old filter out, and slide a fresh filter in.',
      instructions: ['Look at the filter slot while you work.', 'Move slowly between steps.'],
      examples: [],
    },
  },
  'Replacing a smoke detector battery': {
    en: {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    es: {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'te-IN': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Replacing a smoke detector battery',
      description:
        'Open the smoke detector, take out the old battery, put in a fresh one, and close the cover.',
      instructions: ['Look up at the detector.', 'Move slowly between steps.'],
      examples: [],
    },
  },
  'Changing a light bulb': {
    en: {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    es: {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'te-IN': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Changing a light bulb',
      description:
        'Turn off the light, unscrew the old bulb from the fixture, and screw in a new bulb.',
      instructions: ['Look up at the fixture.', 'Move slowly and steadily.'],
      examples: [],
    },
  },
  'Sewing or mending clothes': {
    en: {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    es: {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Sewing or mending clothes',
      description: 'Use a needle and thread to fix tears or sew pieces of cloth together.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while sewing.',
        'Make small, smooth head turns.',
      ],
      examples: [],
    },
  },
  'Threading a needle': {
    en: {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    es: {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Threading a needle',
      description: 'Pass a thread through the small hole at the top of a needle.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands.',
        'Move slowly and steadily.',
      ],
      examples: [],
    },
  },
  'Knitting or crocheting': {
    en: {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    es: {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Knitting or crocheting',
      description: 'Use needles or a hook with yarn to make cloth, scarves, or other items.',
      instructions: [
        'Sit in a stable spot.',
        'Look down at your hands while you work.',
        "Keep working — don't pause.",
      ],
      examples: [],
    },
  },
  'Gift wrapping': {
    en: {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'pt-BR': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    es: {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'hi-IN': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'bn-IN': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'ta-IN': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'te-IN': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
    'mr-IN': {
      name: 'Gift wrapping',
      description:
        'Wrap a gift in paper, fold the edges neatly, and stick tape or ribbon to hold it together.',
      instructions: ['Look down at your hands while wrapping.', 'Make small, smooth head turns.'],
      examples: [],
    },
  },
  'Hanging holiday string lights': {
    en: {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'pt-BR': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    es: {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'hi-IN': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'bn-IN': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'ta-IN': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'te-IN': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
    'mr-IN': {
      name: 'Hanging holiday string lights',
      description:
        'Unwind a strand of string lights and hang them along a railing, roof line, or tree.',
      instructions: [
        'Look at where you are hanging the lights.',
        'Move smoothly between sections.',
      ],
      examples: [],
    },
  },
};

/**
 * NFC-normalize + strip combining marks (accent-stripping for Latin scripts
 * per 07-RESEARCH Pitfall 7) + lowercase + trim. Used by both the
 * fullStringMap build pass below AND by reverseSearch.ts at call time —
 * the two MUST use the same normalize() to guarantee Stage-1 hits.
 */
export function normalizeForReverseSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .trim();
}

// English content-word filter for the Stage-2 token map. We skip these so a
// generic article/preposition in the localized text doesn't pollute the
// reverse table. The English side of the map is the rebuild target, so
// dropping them on the localized side too is symmetric.
const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'for',
  'with',
  'in',
  'on',
  'and',
  'or',
  'at',
  'by',
]);

/**
 * Build per-locale reverse maps from the catalog at module load (D-15 —
 * derived, not pre-built JSON). Stage-1 maps the fully-normalized localized
 * name to the canonical English name. Stage-2 maps each NORMALIZED localized
 * TOKEN to the corresponding ENGLISH token when the two name strings tokenize
 * to the same length (a fragile heuristic — English is the rebuild target,
 * so the result is "good enough" passed to the backend ts_vector index).
 */
export function buildReverseMaps(catalog: typeof TASK_CATALOG_I18N): Record<string, ReverseMap> {
  const out: Record<string, ReverseMap> = {};
  for (const loc of ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']) {
    const fullStringMap: Record<string, string> = {};
    const tokenMap: Record<string, string> = {};

    for (const [canonical, byLocale] of Object.entries(catalog)) {
      const body = byLocale[loc as Locale];
      const localized = body?.name;
      if (!localized) continue;

      const normalizedLocalized = normalizeForReverseSearch(localized);
      if (normalizedLocalized) {
        // Stage 1
        fullStringMap[normalizedLocalized] = canonical;
      }

      // Stage 2: 1:1 token alignment WHEN counts match. The skeleton phase
      // (localized === English) makes this an identity map for every task
      // until the LLM regen runs.
      const enTokens = canonical.split(/\s+/).map(normalizeForReverseSearch).filter(Boolean);
      const locTokens = localized.split(/\s+/).map(normalizeForReverseSearch).filter(Boolean);
      if (enTokens.length === locTokens.length && enTokens.length > 0) {
        for (let i = 0; i < enTokens.length; i++) {
          const enTok = enTokens[i];
          const locTok = locTokens[i];
          if (!enTok || !locTok) continue;
          if (ENGLISH_STOPWORDS.has(enTok)) continue;
          tokenMap[locTok] = enTok;
        }
      }
    }

    out[loc] = { fullStringMap, tokenMap };
  }
  return out;
}

export const REVERSE_BY_LOCALE: Record<string, ReverseMap> = buildReverseMaps(TASK_CATALOG_I18N);
