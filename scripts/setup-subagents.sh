#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CATALOG_PATH=".gemini/agents/catalog.json"

if [[ -f "$CATALOG_PATH" ]]; then
  echo "[setup-subagents] unchanged: $CATALOG_PATH already exists"
  exit 0
fi

echo "[setup-subagents] catalog missing; running managed setup to provision subagents catalog..."
npm run omg -- setup --scope project

if [[ ! -f "$CATALOG_PATH" ]]; then
  echo "[setup-subagents] failed: expected $CATALOG_PATH after setup" >&2
  exit 1
fi

echo "[setup-subagents] created: $CATALOG_PATH"
