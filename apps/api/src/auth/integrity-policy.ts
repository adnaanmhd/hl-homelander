import { isFlavorAllowed, type Flavor } from './flavor-allowlist.js';
import { shouldBypassInstallSource } from './install-source-bypass.js';

export interface TokenPayloadExternal {
  requestDetails: { requestPackageName: string; timestampMillis: string; nonce: string };
  appIntegrity: {
    appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNEVALUATED';
    packageName: string;
    certificateSha256Digest?: string[];
    versionCode?: string;
  };
  deviceIntegrity: {
    deviceRecognitionVerdict: Array<
      | 'MEETS_DEVICE_INTEGRITY'
      | 'MEETS_BASIC_INTEGRITY'
      | 'MEETS_STRONG_INTEGRITY'
      | 'MEETS_VIRTUAL_INTEGRITY'
    >;
  };
  accountDetails?: { appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNEVALUATED' };
}

export type IntegrityRejectReason =
  | 'flavor_app_id_mismatch'
  | 'integrity-nonce'
  | 'integrity-stale'
  | 'package_name_mismatch'
  | 'app_integrity_package_mismatch'
  | 'integrity-emulator'
  | 'integrity-rooted'
  | 'integrity-install-source';

export interface IntegrityCheckResult {
  pass: boolean;
  verdict: 'passed' | 'bypassed_apk';
  reason?: IntegrityRejectReason;
}

export async function evaluateIntegrity(opts: {
  flavor: Flavor;
  applicationId: string;
  payload: TokenPayloadExternal;
  expectedNonce: string;
}): Promise<IntegrityCheckResult> {
  const { flavor, applicationId, payload, expectedNonce } = opts;

  // 0. Allowlist cross-check (D-AUTH-01)
  if (!isFlavorAllowed(flavor, applicationId)) {
    return { pass: false, verdict: 'passed', reason: 'flavor_app_id_mismatch' };
  }

  // 1. Nonce match (replay protection)
  if (payload.requestDetails.nonce !== expectedNonce) {
    return { pass: false, verdict: 'passed', reason: 'integrity-nonce' };
  }

  // 2. Token freshness — reject tokens older than 10 minutes
  const ageMs = Date.now() - Number(payload.requestDetails.timestampMillis);
  if (ageMs < 0 || ageMs > 10 * 60 * 1000) {
    return { pass: false, verdict: 'passed', reason: 'integrity-stale' };
  }

  // 3. Package names must match the URL we called decode under
  if (payload.requestDetails.requestPackageName !== applicationId) {
    return { pass: false, verdict: 'passed', reason: 'package_name_mismatch' };
  }
  if (payload.appIntegrity.packageName !== applicationId) {
    return { pass: false, verdict: 'passed', reason: 'app_integrity_package_mismatch' };
  }

  // 4. Device integrity — emulator hard-reject
  const dvr = payload.deviceIntegrity.deviceRecognitionVerdict;
  if (dvr.includes('MEETS_VIRTUAL_INTEGRITY')) {
    return { pass: false, verdict: 'passed', reason: 'integrity-emulator' };
  }
  // Reject if NO acceptable integrity verdict — covers rooted devices that
  // produce empty / UNRECOGNIZED arrays per Google docs.
  if (
    !dvr.includes('MEETS_DEVICE_INTEGRITY') &&
    !dvr.includes('MEETS_BASIC_INTEGRITY') &&
    !dvr.includes('MEETS_STRONG_INTEGRITY')
  ) {
    return { pass: false, verdict: 'passed', reason: 'integrity-rooted' };
  }

  // 5. App integrity — installed-from-Play OR allowlisted apkRollout bypass
  if (payload.appIntegrity.appRecognitionVerdict === 'PLAY_RECOGNIZED') {
    return { pass: true, verdict: 'passed' };
  }
  if (payload.appIntegrity.appRecognitionVerdict === 'UNRECOGNIZED_VERSION') {
    const bypass = await shouldBypassInstallSource({ flavor, applicationId });
    if (bypass) {
      // Install-source bypass per D-AUTH-02. Both gates passed.
      return { pass: true, verdict: 'bypassed_apk' };
    }
  }

  return { pass: false, verdict: 'passed', reason: 'integrity-install-source' };
}
