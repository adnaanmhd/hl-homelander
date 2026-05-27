// 07-11 G-05 closure — HomeHero renders the greeting (and the empty/returning
// hero chrome) through `t()` calls under `home.hero.*`. Three structural
// checks:
//
//   Test 1: empty variant renders the translated eyebrow/title/sub/CTA.
//   Test 2: returning variant with `showGreeting + firstName='Adnaan'`
//           renders the interpolated greeting "Hi Adnaan" (from en.json's
//           `home.hero.greetingNamed = "Hi {{name}}"`).
//   Test 3: source-grep — HomeHero.tsx no longer carries the hardcoded
//           greeting templates (`'Hi '`, `'Hi there'`, `\`Hi ${...}\``).

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import enCatalog from '../../src/i18n/locales/en.json';
import { HomeHero } from '../../src/components/HomeHero';

describe('HomeHero — 07-11 G-05', () => {
  afterEach(() => {
    cleanup();
  });

  it('empty variant renders translated eyebrow/title/sub from home.hero.empty.*', () => {
    render(<HomeHero variant="empty" onStartRecording={() => undefined} />);
    expect(screen.getByText(enCatalog.home.hero.empty.eyebrow)).toBeTruthy();
    expect(screen.getByText(enCatalog.home.hero.empty.title)).toBeTruthy();
    expect(screen.getByText(enCatalog.home.hero.empty.sub)).toBeTruthy();
    expect(screen.getByText(enCatalog.home.hero.startRecording)).toBeTruthy();
  });

  it('returning + showGreeting + firstName renders interpolated "Hi Adnaan"', () => {
    render(
      <HomeHero
        variant="returning"
        lifetimeMs={3_600_000}
        taskCount={3}
        showGreeting
        firstName="Adnaan"
        onStartRecording={() => undefined}
      />,
    );
    // en.json has `home.hero.greetingNamed = "Hi {{name}}"` — i18next
    // interpolation should produce "Hi Adnaan".
    expect(screen.getByText('Hi Adnaan')).toBeTruthy();
    expect(screen.getByText(enCatalog.home.hero.returning.eyebrow)).toBeTruthy();
  });

  it('source file contains zero hardcoded English greeting templates', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../../src/components/HomeHero.tsx'),
      'utf8',
    );
    // Strip block comments so the JSDoc reference doesn't trigger.
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');
    expect(stripped).not.toMatch(/'Hi there'/);
    expect(stripped).not.toMatch(/`Hi \$\{/);
    expect(stripped).not.toMatch(/'Hi '/);
  });
});
