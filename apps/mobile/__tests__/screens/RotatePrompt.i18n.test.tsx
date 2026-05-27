// 07-11 G-03 closure — RotatePrompt no longer renders the hardcoded English
// "Rotate to landscape and mount on rig" literal; it reads
// `t('recording.rotatePrompt')`. Two structural checks:
//
//   Test 1: render <RotatePrompt /> under the i18n bootstrap; the rendered
//           text matches en.json's recording.rotatePrompt value.
//   Test 2: source-grep gate — RotatePrompt.tsx has zero non-comment
//           occurrences of the historical English literal.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import enCatalog from '../../src/i18n/locales/en.json';
import { RotatePrompt } from '../../src/screens/recording/components/RotatePrompt';

describe('RotatePrompt — 07-11 G-03', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the translated `recording.rotatePrompt` string from en.json', () => {
    render(<RotatePrompt />);
    // i18n singleton is bootstrapped from vitest.setup.ts (it imports the
    // i18n module synchronously via initImmediate:false), so `t()` resolves
    // to the English value on first render.
    expect(screen.getByText(enCatalog.recording.rotatePrompt)).toBeTruthy();
  });

  it('source file contains zero non-comment occurrences of the historical English literal', () => {
    const path = resolve(
      import.meta.dirname,
      '../../src/screens/recording/components/RotatePrompt.tsx',
    );
    const source = readFileSync(path, 'utf8');
    // Strip block + line comments so the JSDoc reference doesn't count.
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(stripped).not.toContain('Rotate to landscape and mount on rig');
  });
});
