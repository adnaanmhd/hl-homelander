// Plan 04-06 — Visual snapshot for PracticeCompleteScreen (design-spec §8).
//
// The baseline catches:
//   - Centered stack: the 96×96 success badge (with the check glyph) +
//     the Confetti overlay layer (18 particles) + heading "You got it."
//   - "Continue" btn-primary at the bottom
//
// Captured at render() time — the badge scale-pop and the confetti rise both
// START in effects, so the rendered DOM at first paint is the static
// pre-animation frame, which is deterministic. Baseline filename:
// `__image_snapshots__/practice-complete-static.png` (via customSnapshotIdentifier).
//
// react-native-reanimated is already mocked to identity functions in
// vitest.setup.ts (Animated.View → a host stub; withTiming/withSequence →
// pass-through), so the animation wrappers render but never animate.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
// Bug 5 / D7 — mock profileService so PracticeCompleteScreen's server-write
// import doesn't pull the real api.ts → navigationRef chain (the local
// @react-navigation/native mock below omits createNavigationContainerRef).
vi.mock('../../src/services/profileService', () => ({
  postPracticeComplete: () => Promise.resolve({ practiceCompletedAt: '2026-06-04T00:00:00.000Z' }),
}));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: vi.fn(),
    getParent: () => ({ reset: vi.fn() }),
    replace: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));
vi.mock('../../src/state/appStore', () => {
  const state = { jwt: 'header.eyJzdWIiOiJhYmMifQ.sig', setPracticeDone: vi.fn() };
  function useAppStore<T>(selector: (s: typeof state) => T): T {
    return selector(state);
  }
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import PracticeCompleteScreen from '../../src/screens/tutorial/PracticeCompleteScreen';
import { renderToImage } from './_utils/renderToImage';

describe('PracticeCompleteScreen visual (plan 04-06 — design-spec §8)', () => {
  afterEach(() => cleanup());

  it('matches baseline (success badge + confetti + heading + Continue CTA)', () => {
    const { container } = render(<PracticeCompleteScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot({ customSnapshotIdentifier: 'practice-complete-static' });
  });
});
