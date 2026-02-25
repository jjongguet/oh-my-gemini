#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[smoke-install] pnpm is required" >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "[smoke-install] package.json not found" >&2
  exit 1
fi

snapshot_tree() {
  {
    [[ -d .gemini ]] && find .gemini -type f
    [[ -d .omg ]] && find .omg -type f ! -path ".omg/logs/*"
  } | LC_ALL=C sort | while IFS= read -r file; do
    shasum "$file"
  done
}

echo "[smoke-install] first setup run"
pnpm omg setup --scope project

before_second="$(mktemp)"
after_second="$(mktemp)"
trap 'rm -f "$before_second" "$after_second"' EXIT

snapshot_tree > "$before_second"

echo "[smoke-install] second setup run (idempotency check)"
pnpm omg setup --scope project

snapshot_tree > "$after_second"

if diff -u "$before_second" "$after_second" >/dev/null; then
  echo "[smoke-install] idempotency check passed"
else
  echo "[smoke-install] idempotency check failed; diff:" >&2
  diff -u "$before_second" "$after_second" || true
  exit 1
fi

