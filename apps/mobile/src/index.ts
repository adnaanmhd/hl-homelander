// Phase 1 mobile entrypoint placeholder. The actual Sign-in screen and the
// AppRegistry.registerComponent('humyn-mobile', () => App) wiring lands in plan
// 01-13 (Wave 3); this file exists so tsc has source files to typecheck and so
// the AppFlavor wrapper has a guaranteed importer.

import { getFlavorContext } from './native/AppFlavor.js';

export function bootInfo() {
  return getFlavorContext();
}
