#!/usr/bin/env bash
# Build apkRolloutDebug once, install to both Pixels in parallel.
# Usage:  ./install.sh <pixel-10a-serial> <pixel-8a-serial>
# Run from repo root.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <pixel-10a-serial> <pixel-8a-serial>" >&2
  echo "  list serials with: adb devices" >&2
  exit 2
fi

P10A="$1"
P8A="$2"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/apps/mobile"

echo "[install] prebuild (help content + asset link)..."
npm run prebuild

echo "[install] assembleApkRolloutDebug..."
cd android && ./gradlew :app:assembleApkRolloutDebug
cd ..

APK="android/app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "[install] ERROR: expected APK not found at $APK" >&2
  exit 1
fi

echo "[install] pushing to Pixel 10a ($P10A) + Pixel 8a ($P8A) in parallel..."
adb -s "$P10A" install -r "$APK" &
PID_10A=$!
adb -s "$P8A"  install -r "$APK" &
PID_8A=$!
wait "$PID_10A" "$PID_8A"

echo "[install] verifying install:"
adb -s "$P10A" shell pm list packages | grep "ai.humynlabs.capture.apk" || echo "  10a: NOT FOUND"
adb -s "$P8A"  shell pm list packages | grep "ai.humynlabs.capture.apk" || echo "  8a:  NOT FOUND"

echo "[install] done. Next: per PROCEDURE.md §2, force-stop + sleep 120 + cold walk."
