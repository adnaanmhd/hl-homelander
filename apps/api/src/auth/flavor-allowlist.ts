// Permanent contract per D-AUTH-01. Changing requires code review + deploy.
// DO NOT move to DB or Remote Config — see CONTEXT.md "Specifics".
export type Flavor = 'apkRollout' | 'playStore' | 'iosAppStore';

const ALLOWLIST: ReadonlyArray<{ flavor: Flavor; applicationId: string }> = [
  { flavor: 'apkRollout', applicationId: 'ai.humynlabs.capture.apk' },
  { flavor: 'playStore', applicationId: 'ai.humynlabs.capture' },
  { flavor: 'iosAppStore', applicationId: 'ai.humynlabs.capture' },
] as const;

export function isFlavorAllowed(flavor: string, applicationId: string): boolean {
  return ALLOWLIST.some((e) => e.flavor === flavor && e.applicationId === applicationId);
}

// W6 — Phase 1 does NOT support iOS attestation. Phase 7 ships App Attest + the iOS
// scheme wiring. Until then, /auth/google with flavor='iosAppStore' must hard-reject
// with RFC 7807 problem-detail at the slug catalog's `integrity-flavor-not-supported`.
// Throwing UnsupportedFlavorError early lets the route handler emit the correct
// problem-detail without scattering branch logic.
export class UnsupportedFlavorError extends Error {
  constructor(public readonly flavor: Flavor) {
    super(`Flavor '${flavor}' is not supported in Phase 1 (Phase 7 will ship iOS attestation).`);
    this.name = 'UnsupportedFlavorError';
  }
}

export function gatePhase1Flavor(flavor: Flavor): void {
  if (flavor === 'iosAppStore') {
    throw new UnsupportedFlavorError(flavor);
  }
}
