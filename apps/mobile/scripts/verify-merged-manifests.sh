#!/usr/bin/env bash
set -euo pipefail

# verify-merged-manifests.sh
#
# CI gate that confirms the Android manifest merger produces:
#   - apkRollout merged manifest CONTAINS REQUEST_INSTALL_PACKAGES
#   - playStore  merged manifest does NOT contain REQUEST_INSTALL_PACKAGES
#
# Additionally (Phase 2 — PERM-04):
#   - BOTH merged manifests CONTAIN every entry in REQUIRED_BASE_PERMS
#     (Camera + Mic + foreground-service surfaces + wake lock + INTERNET / NETWORK_STATE).
#   - BOTH merged manifests do NOT contain any entry in FORBIDDEN_BASE_PERMS
#     EXCEPT REQUEST_INSTALL_PACKAGES on the apkRollout flavor where it is
#     intentionally flavor-scoped.
#
# This is the canonical guard against accidentally:
#   1. Leaking the in-app install-source permission into the Play Store APK
#      (Play Console auto-rejects).
#   2. Smuggling POST_NOTIFICATIONS into either flavor (PROJECT.md hard rule —
#      no notifications channel at MVP).
#   3. Smuggling ACCESS_FINE_LOCATION into either flavor (PROJECT.md hard rule —
#      coarse only). ACCESS_COARSE_LOCATION (PERM-03) is intentionally declared
#      in the base manifest as of plan 02-14; the runtime prompt is gated to
#      Phase 4's first-recording flow via apps/mobile/src/services/locationPermission.ts.
#
# T-1.9-01 + T-2.10-01 + T-2.10-02 + T-2.10-03 mitigation (also paired with
# acceptance criteria that grep the BASE manifest at code-review time).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
cd "$ANDROID_DIR"

echo "[verify-manifests] Building merged manifests for both flavors ..."
./gradlew :app:processApkRolloutDebugManifest :app:processPlayStoreDebugManifest

# AGP places the merged manifest at one of these paths depending on version.
# Try each in turn; pick whichever exists.
find_merged() {
  local flavor_build="$1"
  local candidates=(
    "app/build/intermediates/merged_manifest/${flavor_build}/AndroidManifest.xml"
    "app/build/intermediates/merged_manifests/${flavor_build}/processManifest/AndroidManifest.xml"
    "app/build/intermediates/merged_manifests/${flavor_build}/AndroidManifest.xml"
  )
  for path_template in "${candidates[@]}"; do
    if [[ -f "$path_template" ]]; then
      echo "$path_template"
      return 0
    fi
  done
  echo "[verify-manifests] ERROR: cannot locate merged manifest for ${flavor_build}" >&2
  echo "[verify-manifests] candidates searched:" >&2
  printf '  %s\n' "${candidates[@]}" >&2
  exit 1
}

apk_manifest=$(find_merged apkRolloutDebug)
ps_manifest=$(find_merged playStoreDebug)

echo "[verify-manifests] apkRollout merged: $apk_manifest"
echo "[verify-manifests] playStore  merged: $ps_manifest"

apk_count=$(grep -c "REQUEST_INSTALL_PACKAGES" "$apk_manifest" || true)
ps_count=$(grep -c "REQUEST_INSTALL_PACKAGES" "$ps_manifest" || true)

echo "[verify-manifests] apkRollout REQUEST_INSTALL_PACKAGES count: $apk_count (expected: >=1)"
echo "[verify-manifests] playStore  REQUEST_INSTALL_PACKAGES count: $ps_count (expected: 0)"

if (( apk_count < 1 )); then
  echo "[verify-manifests] FAIL: apkRollout merged manifest must declare REQUEST_INSTALL_PACKAGES" >&2
  exit 1
fi
if (( ps_count != 0 )); then
  echo "[verify-manifests] FAIL: playStore merged manifest leaked REQUEST_INSTALL_PACKAGES — Play Store will reject this APK" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Phase 2 (PERM-04) — required-base + forbidden-base permission assertions.
# ---------------------------------------------------------------------------
# REQUIRED_BASE_PERMS must appear in BOTH merged manifests (declared in the
# base manifest, inherited by every flavor at merge time).
REQUIRED_BASE_PERMS=(
  "android.permission.CAMERA"
  "android.permission.RECORD_AUDIO"
  "android.permission.WAKE_LOCK"
  "android.permission.FOREGROUND_SERVICE"
  "android.permission.FOREGROUND_SERVICE_CAMERA"
  "android.permission.FOREGROUND_SERVICE_MICROPHONE"
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC"
  "android.permission.INTERNET"
  "android.permission.ACCESS_NETWORK_STATE"
  # PERM-03 (plan 02-14) — coarse-only location declaration. Runtime prompt
  # is gated to Phase 4's first-recording flow via locationPermission.ts.
  "android.permission.ACCESS_COARSE_LOCATION"
)

# FORBIDDEN_BASE_PERMS must NOT appear in either merged manifest. Note:
# REQUEST_INSTALL_PACKAGES is permitted ONLY on the apkRollout flavor via
# its dedicated source-set; the per-flavor REQUEST_INSTALL_PACKAGES checks
# above already cover that case, so this list deliberately excludes it.
FORBIDDEN_BASE_PERMS=(
  "android.permission.POST_NOTIFICATIONS"
  "android.permission.ACCESS_FINE_LOCATION"
  # ACCESS_COARSE_LOCATION (PERM-03) is intentionally allowed as of plan 02-14;
  # see apps/mobile/src/services/locationPermission.ts for the helper that
  # Phase 4's first-recording flow will call.
)

# Match only on actual <uses-permission ...> lines (scope away from XML
# comments and other prose text that may legitimately mention the permission
# string for documentation purposes).
assert_required_perms() {
  local label="$1"
  local manifest="$2"
  for perm in "${REQUIRED_BASE_PERMS[@]}"; do
    if ! grep -q "<uses-permission[^>]*${perm}[^>]*/>" "$manifest"; then
      echo "[verify-manifests] FAIL: ${label} merged manifest is missing required permission ${perm}" >&2
      exit 1
    fi
  done
  echo "[verify-manifests] ${label} required-perms check: OK (${#REQUIRED_BASE_PERMS[@]} entries)"
}

assert_forbidden_perms() {
  local label="$1"
  local manifest="$2"
  for perm in "${FORBIDDEN_BASE_PERMS[@]}"; do
    if grep -q "<uses-permission[^>]*${perm}[^>]*/>" "$manifest"; then
      echo "[verify-manifests] FAIL: ${label} merged manifest declares forbidden permission ${perm} — PROJECT.md hard rule violation" >&2
      exit 1
    fi
  done
  echo "[verify-manifests] ${label} forbidden-perms check: OK (${#FORBIDDEN_BASE_PERMS[@]} entries asserted absent)"
}

assert_required_perms "apkRollout" "$apk_manifest"
assert_required_perms "playStore"  "$ps_manifest"
assert_forbidden_perms "apkRollout" "$apk_manifest"
assert_forbidden_perms "playStore"  "$ps_manifest"

# ---------------------------------------------------------------------------
# Plan 02-22 — wave 5 will further extend this script with route-invariant
# checks (e.g., asserting that the JS-side RootNativeStack name maps to a
# corresponding intent-filter for deep-link handling). The contract that
# 02-22 inherits from this revision: this script returns 0 on success and
# exits non-zero on any single violation, so the CI gate composes cleanly.
# ---------------------------------------------------------------------------

echo "[verify-manifests] PASS"
