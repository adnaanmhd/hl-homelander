#!/usr/bin/env bash
# Pull the 6 most-recent recordings from one device's internal storage.
# Uses `adb exec-out` (8-bit clean) + `run-as` + tar streaming so the
# binary MP4s survive intact.
#
# Usage:  ./pull.sh <serial> <device-label>
#   <device-label> is "10a" or "8a" — controls the output subdir.
# Run from repo root.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <serial> <device-label>" >&2
  exit 2
fi

SERIAL="$1"
LABEL="$2"
PKG="ai.humynlabs.capture.apk"

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/.planning/debug/early-session-imu-video-drift/walk-260523/$LABEL"
mkdir -p "$OUT_DIR"

echo "[pull] listing recordings on $SERIAL (newest first)..."
LISTING=$(adb -s "$SERIAL" exec-out "run-as $PKG ls -1t files/recordings/" \
  | tr -d '\r')
if [[ -z "$LISTING" ]]; then
  echo "[pull] ERROR: empty listing. run-as may have failed (production-signed APK?)." >&2
  echo "[pull] try: adb -s $SERIAL shell 'run-as $PKG ls files/recordings/'" >&2
  exit 1
fi

# Group by recording base (strip extension); take 6 most-recent unique bases.
BASES=$(echo "$LISTING" \
  | grep -E '\.(mp4|csv|metadata\.json|sidecar\.json)$' \
  | sed -E 's/\.(mp4|csv|metadata\.json|sidecar\.json)$//' \
  | awk '!seen[$0]++' \
  | head -6)

if [[ -z "$BASES" ]]; then
  echo "[pull] ERROR: no recording files found in files/recordings/" >&2
  exit 1
fi

COUNT=$(echo "$BASES" | wc -l | tr -d ' ')
echo "[pull] pulling $COUNT recordings to $OUT_DIR/"

# Build the list of files to tar in a single round-trip.
i=0
declare -a SEG_NAMES
declare -a FILES_TO_TAR
while IFS= read -r BASE; do
  i=$((i + 1))
  SEG_NAMES+=("seg-$i-${BASE}")
  for EXT in mp4 csv metadata.json sidecar.json; do
    FILES_TO_TAR+=("${BASE}.${EXT}")
  done
done <<< "$BASES"

# Pull all files in ONE tar stream. `run-as PKG sh -c "..."` lets the in-app
# user expand the file list (tar runs as the app uid, can read files/).
# `adb exec-out` keeps the byte stream 8-bit clean.
TMP_TAR=$(mktemp -t drift-walk.XXXXXX.tar)
trap 'rm -f "$TMP_TAR"' EXIT

QUOTED_FILES=$(printf '%q ' "${FILES_TO_TAR[@]}")

echo "[pull] streaming $(echo "${FILES_TO_TAR[@]}" | wc -w | tr -d ' ') files via tar..."
adb -s "$SERIAL" exec-out "run-as $PKG sh -c 'cd files/recordings && tar -cf - $QUOTED_FILES 2>/dev/null'" \
  > "$TMP_TAR"

if [[ ! -s "$TMP_TAR" ]]; then
  echo "[pull] ERROR: tar stream empty. Check that files/recordings/ has the expected files." >&2
  exit 1
fi

# Untar to a staging dir, then rearrange into seg-N-<base>/ folders.
STAGING=$(mktemp -d -t drift-walk.XXXXXX)
trap 'rm -rf "$STAGING" "$TMP_TAR"' EXIT
tar -xf "$TMP_TAR" -C "$STAGING"

i=0
while IFS= read -r BASE; do
  i=$((i + 1))
  SEG_DIR="$OUT_DIR/seg-$i-${BASE}"
  mkdir -p "$SEG_DIR"
  for EXT in mp4 csv metadata.json sidecar.json; do
    if [[ -f "$STAGING/${BASE}.${EXT}" ]]; then
      mv "$STAGING/${BASE}.${EXT}" "$SEG_DIR/${BASE}.${EXT}"
    fi
  done
  echo "[pull]   seg $i: $BASE → $(ls $SEG_DIR | wc -l | tr -d ' ') files"
done <<< "$BASES"

# Integrity check — sha256 each mp4 against the metadata.json's file_sha256.
echo "[pull] verifying mp4 sha256 against metadata.json..."
FAIL=0
for SEG_DIR in "$OUT_DIR"/seg-*; do
  META=$(ls "$SEG_DIR"/*.metadata.json 2>/dev/null | head -1)
  MP4=$(ls "$SEG_DIR"/*.mp4 2>/dev/null | head -1)
  if [[ -z "$META" || -z "$MP4" ]]; then continue; fi
  EXPECTED=$(python3 -c "import json,sys; print(json.load(open('$META'))['metadata']['file_sha256'])")
  ACTUAL=$(shasum -a 256 "$MP4" | awk '{print $1}')
  if [[ "$EXPECTED" != "$ACTUAL" ]]; then
    echo "  MISMATCH: $(basename $SEG_DIR)  expected=$EXPECTED  actual=$ACTUAL"
    FAIL=1
  else
    echo "  ok: $(basename $SEG_DIR)"
  fi
done

if [[ $FAIL -eq 1 ]]; then
  echo "[pull] ERROR: at least one mp4 sha mismatched — pulled bytes don't match what the device finalized." >&2
  exit 1
fi

echo "[pull] done. Next: ./analyze.py walk-260523/$LABEL"
