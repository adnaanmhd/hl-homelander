// Plan 04-06 — Visual snapshot for PracticeIntroScreen (design-spec §6).
//
// The baseline catches:
//   - Centered text stack: heading "One quick try" + body + muted line
//   - "Start practice" btn-accent at the bottom of the screen
//
// Structural-render-tree PNG (see _utils/renderToImage). A regression that
// drops the muted line, moves the CTA, or removes the heading shifts the
// rendered rectangles and the diff fires. Baseline filename:
// `__image_snapshots__/practice-intro.png` (via customSnapshotIdentifier).

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    replace: vi.fn(),
    getParent: () => ({ replace: vi.fn() }),
    reset: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

import PracticeIntroScreen from '../../src/screens/tutorial/PracticeIntroScreen';
import { renderToImage } from './_utils/renderToImage';

describe('PracticeIntroScreen visual (plan 04-06 — design-spec §6)', () => {
  afterEach(() => cleanup());

  it('matches baseline (heading + body + muted line + Start practice CTA)', () => {
    const { container } = render(<PracticeIntroScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot({ customSnapshotIdentifier: 'practice-intro' });
  });
});
