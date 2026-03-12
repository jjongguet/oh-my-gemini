#!/usr/bin/env bash
# Sync version from package.json → gemini-extension.json
# Run automatically via npm prepack to prevent version drift.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
EXT_FILE="$ROOT_DIR/gemini-extension.json"

if [ ! -f "$EXT_FILE" ]; then
  echo "ERROR: gemini-extension.json not found" >&2
  exit 1
fi

EXT_VERSION=$(node -p "require('$EXT_FILE').version")

if [ "$PKG_VERSION" != "$EXT_VERSION" ]; then
  node -e "
    const fs = require('fs');
    const ext = JSON.parse(fs.readFileSync('$EXT_FILE', 'utf8'));
    ext.version = '$PKG_VERSION';
    fs.writeFileSync('$EXT_FILE', JSON.stringify(ext, null, 2) + '\n');
  "
  echo "Synced gemini-extension.json version: $EXT_VERSION → $PKG_VERSION" >&2
else
  echo "gemini-extension.json version already in sync: $PKG_VERSION" >&2
fi
