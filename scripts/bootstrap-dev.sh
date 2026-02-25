#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[bootstrap] missing required command: $cmd" >&2
    return 1
  fi
}

need_cmd pnpm

if command -v gemini >/dev/null 2>&1; then
  echo "[bootstrap] gemini detected: $(gemini --version 2>/dev/null || echo unknown)"
else
  echo "[bootstrap] warning: gemini CLI not found. Install @google/gemini-cli before running sandbox checks."
fi

mkdir -p .omg/state .gemini

if [[ ! -f .gemini/settings.json ]]; then
  cat > .gemini/settings.json <<'JSON'
{
  "tools": {
    "sandbox": "docker"
  }
}
JSON
  echo "[bootstrap] created .gemini/settings.json"
fi

if [[ -f package.json ]]; then
  echo "[bootstrap] installing node dependencies..."
  pnpm install
else
  echo "[bootstrap] warning: package.json not found yet; skipping pnpm install"
fi

cat <<'MSG'
[bootstrap] complete.

Suggested next steps:
  1) pnpm omg setup --scope project
  2) pnpm omg doctor
  3) scripts/sandbox-smoke.sh
  4) pnpm omg verify
MSG
