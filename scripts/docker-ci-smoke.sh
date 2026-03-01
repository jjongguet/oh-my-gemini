#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${OMG_DOCKER_TEST_IMAGE:-node:20-bookworm}"
TASK="${OMG_DOCKER_TEAM_TASK:-docker-ci-smoke}"
CONTAINER_NAME="${OMG_DOCKER_TEST_CONTAINER:-omg-test-container}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: bash scripts/docker-ci-smoke.sh [options]

Run a clean-room Docker validation for oh-my-gemini in an ephemeral container.

Options:
  --image <name>   Docker image to use (default: node:20-bookworm)
  --task <text>    Task text for integration-team-run.sh (default: docker-ci-smoke)
  --container-name <name>
                   Docker container name to use (default: omg-test-container)
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
    --container-name)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-smoke] --container-name requires a value" >&2
        exit 2
      fi
      CONTAINER_NAME="$2"
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
echo "[docker-ci-smoke] container: $CONTAINER_NAME"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[docker-ci-smoke] dry-run: skipping docker execution"
  exit 0
fi

if docker ps -a --format '{{.Names}}' | grep -Fx "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[docker-ci-smoke] removing stale container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker run --rm \
  --name "$CONTAINER_NAME" \
  -e CI=1 \
  -e OMG_DOCKER_TEAM_TASK="$TASK" \
  -v "$ROOT_DIR":/src:ro \
  -w /workspace \
  "$IMAGE" \
  bash -lc '
    set -euo pipefail
    failed_steps=""
    return_code=0

    run_step() {
      local current_step="$1"
      shift
      echo "[docker-ci-smoke][step] $current_step"
      if "$@"; then
        echo "[docker-ci-smoke][ok] $current_step"
      else
        failed_steps="${failed_steps}${current_step}\n"
        return_code=1
        echo "[docker-ci-smoke][error] step failed: ${current_step}" >&2
      fi
    }

    run_step "apt-get update" apt-get update
    run_step "install tmux" env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates \
      tmux

    run_step "copy repository into clean workspace" bash -lc "
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
    "

    cd /workspace

    run_step "npm ci" npm ci
    run_step "npm run setup" npm run setup
    run_step "smoke install" bash scripts/smoke-install.sh
    run_step "sandbox smoke dry-run" bash scripts/sandbox-smoke.sh --dry-run
    run_step "smoke tests" npm run test:smoke
    run_step "integration tests" npm run test:integration
    run_step "reliability tests" npm run test:reliability
    run_step "team lifecycle integration" bash scripts/integration-team-run.sh "$OMG_DOCKER_TEAM_TASK"
    run_step "verify baseline" npm run verify -- --json

    if [[ "$return_code" -ne 0 ]]; then
      echo "[docker-ci-smoke] failed steps:" >&2
      printf "%b" "$failed_steps" >&2
    fi

    exit "$return_code"
  '

echo "[docker-ci-smoke] success"
