#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${OMG_DOCKER_TEST_IMAGE:-node:20-bookworm}"
TASK="${OMG_DOCKER_TEAM_TASK:-docker-ci-smoke}"
CONTAINER_NAME="${OMG_DOCKER_TEST_CONTAINER:-omg-test-container}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: bash scripts/docker-ci-keep.sh [options]

Run the clean-room Docker validation, but keep the container alive afterward
for manual inspection.

Options:
  --image <name>          Docker image to use (default: node:20-bookworm)
  --task <text>           Task text for integration-team-run.sh (default: docker-ci-smoke)
  --container-name <name> Docker container name to keep (default: omg-test-container)
  --dry-run               Print resolved settings and exit without running Docker
  -h, --help              Show this help text
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-keep] --image requires a value" >&2
        exit 2
      fi
      IMAGE="$2"
      shift 2
      ;;
    --task)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-keep] --task requires a value" >&2
        exit 2
      fi
      TASK="$2"
      shift 2
      ;;
    --container-name)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-keep] --container-name requires a value" >&2
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
      echo "[docker-ci-keep] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "[docker-ci-keep] docker is required" >&2
  exit 1
fi

echo "[docker-ci-keep] repo: $ROOT_DIR"
echo "[docker-ci-keep] image: $IMAGE"
echo "[docker-ci-keep] task: $TASK"
echo "[docker-ci-keep] container: $CONTAINER_NAME"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[docker-ci-keep] dry-run: skipping docker execution"
  exit 0
fi

if docker ps -a --format '{{.Names}}' | grep -Fx "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[docker-ci-keep] removing stale container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  -e CI=1 \
  -e OMG_DOCKER_TEAM_TASK="$TASK" \
  -v "$ROOT_DIR":/src:ro \
  -w /workspace \
  "$IMAGE" \
  bash -lc 'tail -f /dev/null' >/dev/null

FAILED_STEP=""
RETURN_CODE=0

run_step() {
  local label="$1"
  local script="$2"

  echo "[docker-ci-keep][step] $label"
  if docker exec "$CONTAINER_NAME" bash -lc "$script"; then
    echo "[docker-ci-keep][ok] $label"
  else
    FAILED_STEP="$label"
    echo "[docker-ci-keep][error] step failed: $label" >&2
    return 1
  fi
}

run_or_flag() {
  if ! run_step "$1" "$2"; then
    RETURN_CODE=1
  fi
}

copy_repo_script=$'set -euo pipefail\nmkdir -p /workspace\ntar -C /src \\\n  --exclude=.git \\\n  --exclude=node_modules \\\n  --exclude=dist \\\n  --exclude=.omg \\\n  --exclude=.omx \\\n  --exclude=.omc \\\n  --exclude=.claude \\\n  --exclude=.gemini \\\n  -cf - . | tar -C /workspace -xf -'

run_or_flag "apt-get update" $'set -euo pipefail\napt-get update'
run_or_flag "install tmux" $'set -euo pipefail\nDEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates tmux'
run_or_flag "copy repository into clean workspace" "$copy_repo_script"
run_or_flag "npm ci" $'set -euo pipefail\ncd /workspace\nnpm ci'
run_or_flag "npm run setup" $'set -euo pipefail\ncd /workspace\nnpm run setup'
run_or_flag "smoke install" $'set -euo pipefail\ncd /workspace\nbash scripts/smoke-install.sh'
run_or_flag "sandbox smoke dry-run" $'set -euo pipefail\ncd /workspace\nbash scripts/sandbox-smoke.sh --dry-run'
run_or_flag "smoke tests" $'set -euo pipefail\ncd /workspace\nnpm run test:smoke'
run_or_flag "integration tests" $'set -euo pipefail\ncd /workspace\nnpm run test:integration'
run_or_flag "reliability tests" $'set -euo pipefail\ncd /workspace\nnpm run test:reliability'
run_or_flag "team lifecycle integration" $'set -euo pipefail\ncd /workspace\nbash scripts/integration-team-run.sh "$OMG_DOCKER_TEAM_TASK"'
run_or_flag "verify baseline" $'set -euo pipefail\ncd /workspace\nnpm run verify -- --json'

echo "[docker-ci-keep] container kept for inspection: $CONTAINER_NAME"
echo "[docker-ci-keep] shell: docker exec -it $CONTAINER_NAME bash"
echo "[docker-ci-keep] cleanup: docker rm -f $CONTAINER_NAME"

if [[ "$RETURN_CODE" -ne 0 ]]; then
  echo "[docker-ci-keep] one or more steps failed (last failed step: ${FAILED_STEP})" >&2
fi

exit "$RETURN_CODE"
