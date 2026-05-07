// Minimal `react-native` ambient declaration for the Phase 1 mobile scaffold.
//
// The real `react-native` package (and its bundled types) is installed in plan
// 01-13 as part of the full RN 0.83 + Hermes new-architecture wiring. Until
// then, this shim declares only the surface this scaffold uses
// (NativeModules) so `tsc --noEmit` is meaningful and the AppFlavor JS wrapper
// has compile-time safety. Plan 13 will delete this file when @types from the
// real react-native install take over.

declare module 'react-native' {
  /**
   * Minimal NativeModules facade — real RN types are richer; we only consume
   * the dynamic `AppFlavor` entry which our Kotlin module registers.
   */
  export const NativeModules: Record<string, unknown>;
}
