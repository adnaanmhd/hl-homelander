export const TARGET_LOCALES = ['pt-BR', 'es', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN'] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const LOCALE_NAMES: Record<TargetLocale, string> = {
  'pt-BR': 'Brazilian Portuguese',
  es: 'Spanish',
  'hi-IN': 'Hindi (India)',
  'bn-IN': 'Bengali (India)',
  'ta-IN': 'Tamil (India)',
  'te-IN': 'Telugu (India)',
  'mr-IN': 'Marathi (India)',
};
