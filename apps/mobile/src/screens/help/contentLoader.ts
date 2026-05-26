/**
 * Help Center content loader — plan 07-13 Task 1 (G-10 / D-03 closure).
 *
 * The en source-of-truth lives at `content.json` (UNCHANGED at MVP). Seven
 * non-English locales each have a sibling `content.{locale}.json` produced
 * by `pnpm i18n:help-content:generate` (tools/i18n/help-content-generate.ts).
 *
 * `loadHelpContent(locale)` selects the right sibling at runtime; falls
 * back to en for the 'en' locale itself, for unknown locales, AND for
 * sibling files whose `accordions: []` is still in the Task-1 stub state
 * (or where an LLM regen quietly produced an empty payload). The
 * empty-array guard prevents a blank Help Center mid-deploy.
 *
 * Tree-shake-ability: static imports per locale so Metro can dead-code
 * eliminate unused locales at bundle time. The 7 sibling files MUST exist
 * (even as Task-1 stubs) for the static imports to resolve; the regen in
 * Task 2 overwrites them with real translated content.
 */
import enContent from './content.json';
import ptContent from './content.pt-BR.json';
import esContent from './content.es.json';
import hiContent from './content.hi-IN.json';
import bnContent from './content.bn-IN.json';
import taContent from './content.ta-IN.json';
import teContent from './content.te-IN.json';
import mrContent from './content.mr-IN.json';

export type HelpContent = typeof enContent;

const REGISTRY: Record<string, HelpContent> = {
  en: enContent,
  'pt-BR': ptContent as HelpContent,
  es: esContent as HelpContent,
  'hi-IN': hiContent as HelpContent,
  'bn-IN': bnContent as HelpContent,
  'ta-IN': taContent as HelpContent,
  'te-IN': teContent as HelpContent,
  'mr-IN': mrContent as HelpContent,
};

export function loadHelpContent(locale: string): HelpContent {
  const candidate = REGISTRY[locale] ?? REGISTRY.en!;
  // POST-CHECKER-REV (plan 07-13 WARNING #3): guard against partial-regen
  // failure mode. If the sibling file has accordions: [] (Task-1 stub, OR
  // an LLM regen that silently produced empty output — quota error, schema
  // drift, prompt failure), fall back to en so the operator sees content
  // instead of a blank Help Center.
  if (candidate.accordions.length === 0) return REGISTRY.en!;
  return candidate;
}
