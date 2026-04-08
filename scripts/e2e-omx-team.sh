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

TASK="${1:-oh-my-product team e2e smoke $(date +%s)}"
POLL_SECONDS="${POLL_SECONDS:-8}"
MAX_POLLS="${MAX_POLLS:-20}"
WORKERS="${OMX_E2E_WORKERS:-1}"

if ! [[ "$WORKERS" =~ ^[0-9]+$ ]] || (( WORKERS < 1 || WORKERS > 8 )); then
  echo "[e2e-omx-team] OMX_E2E_WORKERS must be an integer in range 1..8 (current: $WORKERS)" >&2
  exit 2
fi

estimate_tmux_max_panes() {
  local session_name
  local window_id
  local pane_count=1

  session_name="$(tmux display-message -p '#S')"
  window_id="$(tmux new-window -d -P -F '#{window_id}' -t "${session_name}:")"

  while tmux split-window -d -t "$window_id" >/dev/null 2>&1; do
    pane_count=$((pane_count + 1))
  done

  tmux kill-window -t "$window_id" >/dev/null 2>&1 || true
  printf '%s' "$pane_count"
}

CURRENT_PANE_SIZE="$(tmux display-message -p '#{pane_width}x#{pane_height}')"
MAX_PANES="$(estimate_tmux_max_panes)"
REQUIRED_PANES=$((WORKERS + 2))

echo "[e2e-omx-team] pane preflight: current=$CURRENT_PANE_SIZE, requested_workers=$WORKERS, max_panes=$MAX_PANES, required_panes~=$REQUIRED_PANES"

if (( MAX_PANES < REQUIRED_PANES )); then
  echo "[e2e-omx-team] insufficient pane budget for workers=$WORKERS in current tmux pane (need ~=${REQUIRED_PANES}, can split to ${MAX_PANES})." >&2
  echo "[e2e-omx-team] enlarge tmux window/pane or lower OMX_E2E_WORKERS and retry." >&2
  exit 1
fi

echo "[e2e-omx-team] starting team for task: $TASK"
START_OUTPUT="$(omx team "${WORKERS}:executor" "$TASK")"
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
if ! omx team shutdown "$TEAM_NAME"; then
  if [[ "$terminal" -ne 1 ]]; then
    echo "[e2e-omx-team] graceful shutdown blocked after timeout; retrying with --force" >&2
    omx team shutdown "$TEAM_NAME" --force
  else
    echo "[e2e-omx-team] shutdown failed even though terminal state was reached" >&2
    exit 1
  fi
fi

if [[ -d ".omx/state/team/$TEAM_NAME" ]]; then
  echo "[e2e-omx-team] warning: team state still present at .omx/state/team/$TEAM_NAME" >&2
else
  echo "[e2e-omx-team] cleanup verified: .omx/state/team/$TEAM_NAME removed"
fi
