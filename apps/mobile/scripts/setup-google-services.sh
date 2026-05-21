#!/usr/bin/env bash
# Copy Firebase google-services.json into the apkRollout flavor source set.
# The real file is gitignored — obtain it from Firebase Console or a teammate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/apkRollout/google-services.json"
EXAMPLE="$ROOT/android/app/src/apkRollout/google-services.json.example"

usage() {
  cat <<EOF
Usage: bash scripts/setup-google-services.sh <path-to-google-services.json>

Downloads (Firebase Console):
  Project homelander-24045 (GCP #130483521533)
  → Project settings → Your apps → Android app "ai.humynlabs.capture.apk"
  → Download google-services.json

Then run:
  bash scripts/setup-google-services.sh ~/Downloads/google-services.json

Or set GOOGLE_SERVICES_JSON to the downloaded file path and re-run without args.
EOF
}

SRC="${1:-${GOOGLE_SERVICES_JSON:-}}"

if [[ -z "$SRC" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "error: file not found: $SRC" >&2
  exit 1
fi

if ! grep -q '"package_name": "ai.humynlabs.capture.apk"' "$SRC"; then
  echo "error: $SRC does not contain package_name ai.humynlabs.capture.apk" >&2
  echo "       Download the config for the apkRollout Android app, not playStore." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Installed → $DEST"
