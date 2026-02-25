#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
PROMPT="${OMG_SANDBOX_SMOKE_PROMPT:-Run a minimal sandbox check and print exactly: sandbox-ok}"
TIMEOUT_SECONDS="${OMG_SANDBOX_TIMEOUT_SECONDS:-120}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --prompt)
      if [[ $# -lt 2 ]]; then
        echo "[sandbox-smoke] --prompt requires a value" >&2
        exit 2
      fi
      PROMPT="$2"
      shift 2
      ;;
    *)
      PROMPT="$1"
      shift
      ;;
  esac
done

if [[ "$DRY_RUN" == "1" ]]; then
  if [[ ! -f .gemini/sandbox.Dockerfile ]]; then
    echo "[sandbox-smoke] dry-run failed: .gemini/sandbox.Dockerfile is missing" >&2
    exit 1
  fi

  echo "[sandbox-smoke] dry-run: sandbox Dockerfile and script wiring are present"
  exit 0
fi

if ! command -v gemini >/dev/null 2>&1; then
  echo "[sandbox-smoke] gemini CLI is required but not installed." >&2
  exit 1
fi

if [[ "${BUILD_SANDBOX:-0}" == "1" ]]; then
  echo "[sandbox-smoke] BUILD_SANDBOX=1 enabled"
fi

echo "[sandbox-smoke] running: gemini -s -p \"$PROMPT\""
if command -v timeout >/dev/null 2>&1; then
  timeout "${TIMEOUT_SECONDS}"s gemini -s -p "$PROMPT"
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout "${TIMEOUT_SECONDS}"s gemini -s -p "$PROMPT"
else
  gemini -s -p "$PROMPT"
fi

echo "[sandbox-smoke] success"
