// Plan 03-02 — Visual snapshot for HomeSkeletonScreen.
//
// The baseline catches:
//   - TopBar (logo + avatar) at the top
//   - Skeleton body text well below the TopBar
//   - SoftUpgradeBanner slot is empty (softUpgradeAvailable=null) — its
//     reappearance after a Plan 03-03 nav-graph change would shift the
//     baseline and surface in PR review.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/state/appStore', () => {
  type Sel<T> = (s: Record<string, unknown>) => T;
  const stub = {
    softUpgradeAvailable: null,
    user: null,
  } as Record<string, unknown>;
  function useAppStore<T>(selector: Sel<T>): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

import HomeSkeletonScreen from '../../src/screens/home/HomeSkeletonScreen';
import { renderToImage } from './_utils/renderToImage';

describe('HomeSkeletonScreen visual', () => {
  afterEach(() => cleanup());

  it('matches baseline (TopBar + skeleton body, no soft-upgrade banner)', () => {
    const { container } = render(<HomeSkeletonScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
