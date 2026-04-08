#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "[integration-team-run] npm is required" >&2
  exit 1
fi

TASK="${1:-smoke}"
WORKERS="${OMP_INTEGRATION_TEAM_WORKERS:-3}"

echo "[integration-team-run] running team task: $TASK (workers=$WORKERS)"
npm run omp -- team run --task "$TASK" --workers "$WORKERS"

if [[ ! -d .omp/state ]]; then
  echo "[integration-team-run] missing .omp/state after team run" >&2
  exit 1
fi

if grep -R -E 'team-plan|team-exec|team-verify|"plan"|"exec"|"verify"|"completed"|"failed"' .omp/state >/dev/null 2>&1; then
  echo "[integration-team-run] lifecycle markers detected in .omp/state"
else
  echo "[integration-team-run] could not find lifecycle markers in .omp/state" >&2
  exit 1
fi

echo "[integration-team-run] success"
