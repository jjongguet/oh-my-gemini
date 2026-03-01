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

need_cmd npm

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
  npm install
else
  echo "[bootstrap] warning: package.json not found yet; skipping npm install"
fi

cat <<'MSG'
[bootstrap] complete.

Suggested next steps (Installed-user mode):
  1) oh-my-gemini setup --scope project
  2) EXT_PATH="$(oh-my-gemini extension path)"
  3) gemini extensions link "$EXT_PATH"
  4) oh-my-gemini doctor
  5) oh-my-gemini verify

Contributor mode (repo-local workflow):
  1) npm run setup
  2) npm run setup:subagents
  3) npm run doctor
  4) scripts/sandbox-smoke.sh
  5) npm run verify
MSG
