// Plan 03-02 — Visual snapshot for PermissionsScreen.
//
// The baseline catches:
//   - Camera icon (Lucide) + title + body + CTA in ONE centered group
//   - CTA at content-driven width (alignSelf:'center')
//
// Layout regression (CTA pinned to bottom via space-between, contentWell
// flex:1 spacer re-introduced) shifts the rendered Pressable and the
// diff fires.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../src/util/analytics', () => ({ logEvent: () => undefined }));
vi.mock('../../src/state/appStore', () => {
  type Sel<T> = (s: Record<string, unknown>) => T;
  const stub = { setPermsGranted: () => undefined } as Record<string, unknown>;
  function useAppStore<T>(selector: Sel<T>): T {
    return selector(stub);
  }
  (useAppStore as unknown as { getState: () => typeof stub }).getState = () => stub;
  return { useAppStore };
});

import PermissionsScreen from '../../src/screens/permissions/PermissionsScreen';
import { renderToImage } from './_utils/renderToImage';

describe('PermissionsScreen visual', () => {
  afterEach(() => cleanup());

  it('matches baseline (icon + title + body + content-driven CTA)', () => {
    const { container } = render(<PermissionsScreen />);
    const png = renderToImage(container);
    expect(png).toMatchImageSnapshot();
  });
});
