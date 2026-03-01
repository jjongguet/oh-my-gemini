#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${OMG_DOCKER_TEST_IMAGE:-node:20-bookworm}"
TASK="${OMG_DOCKER_TEAM_TASK:-docker-ci-smoke}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: bash scripts/docker-ci-smoke.sh [options]

Run a clean-room Docker validation for oh-my-gemini in an ephemeral container.

Options:
  --image <name>   Docker image to use (default: node:20-bookworm)
  --task <text>    Task text for integration-team-run.sh (default: docker-ci-smoke)
  --dry-run        Print resolved settings and exit without running Docker
  -h, --help       Show this help text
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-smoke] --image requires a value" >&2
        exit 2
      fi
      IMAGE="$2"
      shift 2
      ;;
    --task)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-smoke] --task requires a value" >&2
        exit 2
      fi
      TASK="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[docker-ci-smoke] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "[docker-ci-smoke] docker is required" >&2
  exit 1
fi

echo "[docker-ci-smoke] repo: $ROOT_DIR"
echo "[docker-ci-smoke] image: $IMAGE"
echo "[docker-ci-smoke] task: $TASK"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[docker-ci-smoke] dry-run: skipping docker execution"
  exit 0
fi

docker run --rm \
  -e CI=1 \
  -e OMG_DOCKER_TEAM_TASK="$TASK" \
  -v "$ROOT_DIR":/src:ro \
  -w /workspace \
  "$IMAGE" \
  bash -lc '
    set -euo pipefail

    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      tmux

    mkdir -p /workspace
    tar -C /src \
      --exclude=.git \
      --exclude=node_modules \
      --exclude=dist \
      --exclude=.omg \
      --exclude=.omx \
      --exclude=.omc \
      --exclude=.claude \
      --exclude=.gemini \
      -cf - . | tar -C /workspace -xf -

    cd /workspace

    npm ci
    npm run setup
    bash scripts/smoke-install.sh
    bash scripts/sandbox-smoke.sh --dry-run
    npm run test:smoke
    npm run test:integration
    npm run test:reliability
    bash scripts/integration-team-run.sh "$OMG_DOCKER_TEAM_TASK"
    npm run verify -- --json
  '

echo "[docker-ci-smoke] success"
