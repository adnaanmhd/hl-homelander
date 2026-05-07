// ESLint v9 flat config (eslint.config.js) — replaces legacy .eslintrc.json.
// Pulls in @typescript-eslint/recommended ruleset and applies project-wide
// ignore patterns + the same custom rules the .eslintrc.json carried.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/',
      '**/node_modules/',
      'dist/',
      '**/dist/',
      'build/',
      '**/build/',
      'coverage/',
      '**/coverage/',
      '**/*.d.ts',
      '.husky/',
      'apps/mobile/android/',
      'apps/mobile/ios/',
      'infra/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
