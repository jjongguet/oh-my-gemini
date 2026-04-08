#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${OMP_DOCKER_TEST_IMAGE:-node:20-bookworm}"
TASK="${OMP_DOCKER_TEAM_TASK:-docker-ci-full}"
CONTAINER_NAME="${OMP_DOCKER_TEST_CONTAINER:-omp-test-container}"
PROMPT="${OMP_DOCKER_FULL_SMOKE_PROMPT:-Reply with the exact token docker-full-smoke-ok}"
EXPECTED_TOKEN="${OMP_DOCKER_FULL_EXPECT_TOKEN:-docker-full-smoke-ok}"
GEMINI_CLI_VERSION="${OMP_DOCKER_GEMINI_CLI_VERSION:-latest}"
LIVE_TIMEOUT_SECONDS="${OMP_DOCKER_FULL_TIMEOUT_SECONDS:-180}"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: bash scripts/docker-ci-full.sh [options]

Run clean-room Docker validation + in-container Gemini CLI live smoke.
Requires API key auth for Gemini CLI (`GEMINI_API_KEY`).

Options:
  --image <name>            Docker image to use (default: node:20-bookworm)
  --task <text>             Task text for integration-team-run.sh (default: docker-ci-full)
  --container-name <name>   Docker container name (default: omp-test-container)
  --prompt <text>           Live smoke prompt for gemini -p
  --expected-token <text>   Token expected in live smoke output (default: docker-full-smoke-ok)
  --gemini-cli-version <v>  npm version/tag for @google/gemini-cli (default: latest)
  --timeout-seconds <n>     Timeout for live smoke call (default: 180)
  --dry-run                 Print resolved settings and exit without running Docker
  -h, --help                Show this help text
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --image requires a value" >&2
        exit 2
      fi
      IMAGE="$2"
      shift 2
      ;;
    --task)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --task requires a value" >&2
        exit 2
      fi
      TASK="$2"
      shift 2
      ;;
    --container-name)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --container-name requires a value" >&2
        exit 2
      fi
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --prompt)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --prompt requires a value" >&2
        exit 2
      fi
      PROMPT="$2"
      shift 2
      ;;
    --expected-token)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --expected-token requires a value" >&2
        exit 2
      fi
      EXPECTED_TOKEN="$2"
      shift 2
      ;;
    --gemini-cli-version)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --gemini-cli-version requires a value" >&2
        exit 2
      fi
      GEMINI_CLI_VERSION="$2"
      shift 2
      ;;
    --timeout-seconds)
      if [[ $# -lt 2 ]]; then
        echo "[docker-ci-full] --timeout-seconds requires a value" >&2
        exit 2
      fi
      LIVE_TIMEOUT_SECONDS="$2"
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
      echo "[docker-ci-full] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "[docker-ci-full] docker is required" >&2
  exit 1
fi

AUTH_MODE="none"
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  AUTH_MODE="gemini-api-key"
fi

echo "[docker-ci-full] repo: $ROOT_DIR"
echo "[docker-ci-full] image: $IMAGE"
echo "[docker-ci-full] task: $TASK"
echo "[docker-ci-full] container: $CONTAINER_NAME"
echo "[docker-ci-full] gemini-cli: @google/gemini-cli@$GEMINI_CLI_VERSION"
echo "[docker-ci-full] auth mode: $AUTH_MODE"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[docker-ci-full] dry-run: skipping docker execution"
  exit 0
fi

if [[ "$AUTH_MODE" == "none" ]]; then
  echo "[docker-ci-full] missing API key. Set GEMINI_API_KEY" >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -Fx "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[docker-ci-full] removing stale container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker run --rm \
  --name "$CONTAINER_NAME" \
  -e CI=1 \
  -e OMP_DOCKER_TEAM_TASK="$TASK" \
  -e OMP_DOCKER_FULL_SMOKE_PROMPT="$PROMPT" \
  -e OMP_DOCKER_FULL_EXPECT_TOKEN="$EXPECTED_TOKEN" \
  -e OMP_DOCKER_GEMINI_CLI_VERSION="$GEMINI_CLI_VERSION" \
  -e OMP_DOCKER_FULL_TIMEOUT_SECONDS="$LIVE_TIMEOUT_SECONDS" \
  -e GEMINI_API_KEY \
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
      echo "[docker-ci-full][step] $current_step"
      if "$@"; then
        echo "[docker-ci-full][ok] $current_step"
      else
        failed_steps="${failed_steps}${current_step}\n"
        return_code=1
        echo "[docker-ci-full][error] step failed: ${current_step}" >&2
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
        --exclude=.omp \
        --exclude=.omx \
        --exclude=.claude \
        --exclude=.gemini \
        -cf - . | tar -C /workspace -xf -
    "

    cd /workspace

    run_step "npm ci" npm ci
    run_step "npm run setup" npm run setup
    run_step "install @google/gemini-cli" npm install -g "@google/gemini-cli@${OMP_DOCKER_GEMINI_CLI_VERSION}"
    run_step "gemini --version" gemini --version
    run_step "gemini live smoke (key-based)" bash -lc "
      if command -v timeout >/dev/null 2>&1; then
        output=\$(timeout \"${OMP_DOCKER_FULL_TIMEOUT_SECONDS}\"s gemini -p \"${OMP_DOCKER_FULL_SMOKE_PROMPT}\")
      elif command -v gtimeout >/dev/null 2>&1; then
        output=\$(gtimeout \"${OMP_DOCKER_FULL_TIMEOUT_SECONDS}\"s gemini -p \"${OMP_DOCKER_FULL_SMOKE_PROMPT}\")
      else
        output=\$(gemini -p \"${OMP_DOCKER_FULL_SMOKE_PROMPT}\")
      fi

      printf \"%s\\n\" \"\$output\"
      printf \"%s\\n\" \"\$output\" | grep -F \"${OMP_DOCKER_FULL_EXPECT_TOKEN}\" >/dev/null
    "
    run_step "smoke install" bash scripts/smoke-install.sh
    run_step "sandbox smoke dry-run" bash scripts/sandbox-smoke.sh --dry-run
    run_step "smoke tests" npm run test:smoke
    run_step "integration tests" npm run test:integration
    run_step "reliability tests" npm run test:reliability
    run_step "team lifecycle integration" bash scripts/integration-team-run.sh "$OMP_DOCKER_TEAM_TASK"
    run_step "verify baseline" npm run verify -- --json

    if [[ "$return_code" -ne 0 ]]; then
      echo "[docker-ci-full] failed steps:" >&2
      printf "%b" "$failed_steps" >&2
    fi

    exit "$return_code"
  '

echo "[docker-ci-full] success"
