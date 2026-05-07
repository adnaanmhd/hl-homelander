#!/usr/bin/env bash
set -euo pipefail

# verify-merged-manifests.sh
#
# CI gate that confirms the Android manifest merger produces:
#   - apkRollout merged manifest CONTAINS REQUEST_INSTALL_PACKAGES
#   - playStore  merged manifest does NOT contain REQUEST_INSTALL_PACKAGES
#
# This is the canonical guard against accidentally leaking the in-app
# install-source permission into the Play Store APK — Play Console will
# auto-reject any APK that declares it without an approved declaration.
#
# T-1.9-01 mitigation (also paired with the Task 1 acceptance criterion that
# greps the BASE manifest at code-review time).

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
echo "[verify-manifests] PASS"
