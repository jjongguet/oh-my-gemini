#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[e2e-omx-team] missing required command: $cmd" >&2
    exit 1
  fi
}

need_cmd omx
need_cmd tmux
need_cmd rg

if [[ -z "${TMUX:-}" ]]; then
  echo "[e2e-omx-team] TMUX is not set. Run this script from an active tmux leader pane." >&2
  exit 1
fi

TASK="${1:-oh-my-gemini team e2e smoke $(date +%s)}"
POLL_SECONDS="${POLL_SECONDS:-8}"
MAX_POLLS="${MAX_POLLS:-20}"

echo "[e2e-omx-team] starting team for task: $TASK"
START_OUTPUT="$(omx team 1:executor "$TASK")"
echo "$START_OUTPUT"

TEAM_NAME="$(printf '%s\n' "$START_OUTPUT" | sed -n 's/^Team started: //p' | head -n1 | tr -d '\r')"
if [[ -z "$TEAM_NAME" ]]; then
  echo "[e2e-omx-team] failed to parse team name from startup output" >&2
  exit 1
fi

echo "[e2e-omx-team] parsed team name: $TEAM_NAME"

terminal=0
for ((i = 1; i <= MAX_POLLS; i++)); do
  STATUS_OUTPUT="$(omx team status "$TEAM_NAME")"
  echo "[e2e-omx-team] poll=$i"
  echo "$STATUS_OUTPUT"

  if printf '%s\n' "$STATUS_OUTPUT" | rg -q 'pending=0.*in_progress=0.*failed=0'; then
    terminal=1
    break
  fi

  sleep "$POLL_SECONDS"
done

if [[ "$terminal" -ne 1 ]]; then
  echo "[e2e-omx-team] timeout waiting for terminal task state; initiating graceful shutdown" >&2
fi

echo "[e2e-omx-team] shutting down team: $TEAM_NAME"
omx team shutdown "$TEAM_NAME"

if [[ -d ".omx/state/team/$TEAM_NAME" ]]; then
  echo "[e2e-omx-team] warning: team state still present at .omx/state/team/$TEAM_NAME" >&2
else
  echo "[e2e-omx-team] cleanup verified: .omx/state/team/$TEAM_NAME removed"
fi

