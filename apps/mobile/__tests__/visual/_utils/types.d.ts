// Plan 03-02 — vitest matcher augmentation for the visual-snapshot
// stack. jest-image-snapshot's `toMatchImageSnapshot` augmentation
// lives in vitest.setup.ts but the setup file isn't in the tsconfig
// include list, so the augmentation isn't visible to `tsc --noEmit`.
// This file re-declares the augmentation in an *.d.ts that IS in the
// include list (under __tests__/visual/_utils/) so editors + tsc both
// see the matcher.
//
// pngjs ambient declaration lives in a sibling file (`pngjs.d.ts`)
// because ambient `declare module 'foo'` only works in files that have
// no top-level imports/exports — and this file imports 'vitest' to
// interface-merge the matcher.

import 'vitest';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = unknown> {
    toMatchImageSnapshot(opts?: Record<string, unknown>): T;
  }
  interface AsymmetricMatchersContaining {
    toMatchImageSnapshot(opts?: Record<string, unknown>): unknown;
  }
}
