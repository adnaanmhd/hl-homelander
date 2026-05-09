// Stubbed in plan 02-05; real implementation lands in plan 02-16.
//
// Returns the synchronous compat signature read used by RootNativeStack to
// decide whether the persisted compatPassed.signature is still valid for
// THIS device + install. AUTH-11 only trips when this returns a non-null
// value that disagrees with the persisted signature; null means the gate
// trusts the stored pass (offline-boot caveat — see initialRoute.ts).
export function computeCompatSignatureSync(): string | null {
  return null;
}
