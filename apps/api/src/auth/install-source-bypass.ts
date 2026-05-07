import { isFlavorAllowed, type Flavor } from './flavor-allowlist.js';

// Remote Config key shape per planner discretion exercised in this plan:
//   auth.apk_install_source_bypass.<applicationId> -> boolean
//
// HARD-CODED here — the playStore applicationId is structurally `false`.
// This is the policy-level allowlist that protects against a misconfigured
// Remote Config (operator typing the wrong applicationId by mistake).
//
// playStore APK literally cannot read the Remote Config key for `.apk` because
// the key is namespaced by applicationId — the playStore APK fetches Remote
// Config under `ai.humynlabs.capture` and never sees
// `auth.apk_install_source_bypass.ai.humynlabs.capture.apk`.
const STATIC_BYPASS_ALLOWED: Record<string, boolean> = {
  'ai.humynlabs.capture.apk': true, // apkRollout — bypass eligible
  'ai.humynlabs.capture': false, // playStore + iosAppStore — bypass forbidden
};

// Remote Config fetch — at MVP we read from a config file shipped with the API
// container (or env var REMOTE_CONFIG_JSON in dev). When Phase 5 adds Firebase
// Admin SDK, this function calls Remote Config server-side. For Phase 1 the
// CONTEXT.md "Specifics" note allows this to be a server-side-only allowlist;
// the Remote Config wiring on Android lives in plan 09's mobile flavor work.
export async function fetchRemoteConfigBypass(applicationId: string): Promise<boolean> {
  // Read from REMOTE_CONFIG_JSON env (set by ECS task definition) at MVP
  const raw = process.env.REMOTE_CONFIG_JSON;
  if (!raw) return false;
  try {
    const cfg = JSON.parse(raw) as Record<string, boolean | undefined>;
    const key = `auth.apk_install_source_bypass.${applicationId}`;
    return cfg[key] === true;
  } catch {
    return false;
  }
}

// Double-gate per D-AUTH-02 truths.
// Returns true ONLY when:
//   1. The static allowlist marks this applicationId as bypass-eligible AND
//   2. The Remote Config key for this applicationId returns true AND
//   3. The (flavor, applicationId) pair is in the flavor allowlist.
export async function shouldBypassInstallSource(opts: {
  flavor: Flavor;
  applicationId: string;
}): Promise<boolean> {
  if (!STATIC_BYPASS_ALLOWED[opts.applicationId]) return false;
  if (!isFlavorAllowed(opts.flavor, opts.applicationId)) return false;
  if (opts.flavor !== 'apkRollout') return false;
  return await fetchRemoteConfigBypass(opts.applicationId);
}
