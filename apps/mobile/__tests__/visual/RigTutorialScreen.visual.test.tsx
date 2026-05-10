// Plan 03-02 — Visual snapshot for RigTutorialScreen.
//
// The baseline catches:
//   - Rig illustration Image (Plan 03-01 placeholder, real artwork
//     deferred — when artwork lands the baseline will need re-baking
//     once and the diff at that PR will surface the asset arrival).
//   - Heading + body + "Don't have a rig yet?" link
//   - Next CTA at the bottom of the centered group
//
// Off-ramp Sheet does NOT render in the baseline (offRampOpen starts
// false); a regression that opens it on mount would shift the PNG.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('../../src/state/appStore', () => {
  type Sel<T> = (s: Record<string, unknown>) => T;
  const stub = {
    setTutorialDone: () => undefined,
    jwt: null,
  } as Record<string, unknown>;
  function useAppStore<T>(selector: Sel<T>): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

import RigTutorialScreen from '../../src/screens/tutorial/RigTutorialScreen';
import { renderToImage } from './_utils/renderToImage';

describe('RigTutorialScreen visual', () => {
  afterEach(() => cleanup());

  it('matches baseline (illustration + heading + body + Next CTA)', () => {
    const { container } = render(<RigTutorialScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
