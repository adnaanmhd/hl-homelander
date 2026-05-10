// Plan 03-02 — local ambient declaration for pngjs, the PNG encoder
// used by `renderToImage.ts`. pngjs is a transitive dep of
// jest-image-snapshot (no top-level install needed) and ships no .d.ts;
// @types/pngjs exists on npm but adding it as a top-level devDep just
// for one private util feels heavy. Local ambient is sufficient because
// the only consumer is `__tests__/visual/_utils/renderToImage.ts`.
//
// This file MUST have no top-level imports/exports — it's a script-
// scope ambient declaration.

declare module 'pngjs' {
  export interface PNGOptions {
    width?: number;
    height?: number;
  }
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options?: PNGOptions);
    static sync: {
      write(png: PNG): Buffer;
      read(buf: Buffer): PNG;
    };
  }
}
