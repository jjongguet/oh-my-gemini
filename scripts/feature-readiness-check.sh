#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[feature-readiness] missing required command: $cmd" >&2
    exit 1
  fi
}

need_cmd npm
need_cmd npx

mkdir -p .omx/reports
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_ID="${TIMESTAMP}-$$"
REPORT_PATH=".omx/reports/feature-readiness-${RUN_ID}.md"
DRY_RUN=0
FEATURE_FILTER="all"
TOTAL_CHECKS=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--dry-run] [--feature <team|hook|skill|setup|core|all>]

Options:
  --dry-run               실행 없이 점검 항목/명령만 보고서로 출력
  --feature <value>       특정 기능 축만 실행
                          team  = Feature 1 (Team Orchestration)
                          hook  = Feature 2 (Hook System)
                          skill = Feature 3 (Agent Skill/Role)
                          setup = Feature 4 (Setup/Doctor)
                          core  = Feature 5 (Core Commands)
                          all   = 전체 실행 (기본값)
  -h, --help              도움말 출력
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --feature)
      if [[ $# -lt 2 ]]; then
        echo "[feature-readiness] --feature requires a value" >&2
        usage >&2
        exit 1
      fi
      FEATURE_FILTER="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[feature-readiness] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$FEATURE_FILTER" in
  team|hook|skill|setup|core|all)
    ;;
  *)
    echo "[feature-readiness] invalid --feature value: $FEATURE_FILTER" >&2
    usage >&2
    exit 1
    ;;
esac

passes=0
fails=0

should_run_feature() {
  local feature="$1"
  [[ "$FEATURE_FILTER" == "all" || "$FEATURE_FILTER" == "$feature" ]]
}

append_section() {
  local title="$1"
  local status="$2"
  local command="$3"
  local output_file="$4"

  {
    echo "## ${title}"
    echo ""
    echo "- status: ${status}"
    echo "- command: \`${command}\`"
    echo "- output_tail:"
    echo '```text'
    tail -n 40 "$output_file"
    echo '```'
    echo ""
  } >> "$REPORT_PATH"
}

run_check() {
  local title="$1"
  shift
  local cmd=("$@")
  local command_text="${cmd[*]}"
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if [[ "$DRY_RUN" -eq 1 ]]; then
    {
      echo "## ${title}"
      echo ""
      echo "- status: DRY_RUN"
      echo "- command: \`${command_text}\`"
      echo ""
    } >> "$REPORT_PATH"
    return 0
  fi

  local output_file
  output_file="$(mktemp)"

  set +e
  "${cmd[@]}" >"$output_file" 2>&1
  local exit_code=$?
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    passes=$((passes + 1))
    append_section "$title" "PASS" "$command_text" "$output_file"
  else
    fails=$((fails + 1))
    append_section "$title" "FAIL(exit=${exit_code})" "$command_text" "$output_file"
  fi

  rm -f "$output_file"
}

{
  echo "# Feature Readiness Check"
  echo ""
  echo "- generated_at_utc: ${TIMESTAMP}"
  echo "- purpose: 오픈베타 핵심 기능을 기능 축별로 점검"
  echo "- selected_feature: ${FEATURE_FILTER}"
  echo ""
} > "$REPORT_PATH"

if should_run_feature "team"; then
  run_check "Feature 1: Team Orchestration command contract" \
    npm run omg -- team run --task "feature readiness dry run" --dry-run --json
  run_check "Feature 1: Team Orchestration focused tests" \
    npx vitest run \
    tests/integration/team-lifecycle-commands.test.ts \
    tests/reliability/team-control-plane.test.ts \
    tests/reliability/team-status-command.test.ts \
    tests/reliability/team-shutdown-command.test.ts
fi

if should_run_feature "hook"; then
  run_check "Feature 2: Hook System integration test" \
    npx vitest run tests/integration/hook-context-e2e.test.ts
fi

if should_run_feature "skill"; then
  run_check "Feature 3: Agent Skill/Role integration + reliability tests" \
    npx vitest run \
    tests/integration/skill-runtime-integration.test.ts \
    tests/reliability/role-output-contract.test.ts \
    tests/reliability/role-skill-mapping.test.ts
fi

if should_run_feature "setup"; then
  run_check "Feature 4: Setup/Doctor command help contract" \
    npx vitest run tests/smoke/setup-contract-help.test.ts tests/reliability/doctor-command.test.ts
fi

if should_run_feature "core"; then
  run_check "Feature 5: Core command smoke (verify/extension/skill)" \
    npm run omg -- verify --help
  run_check "Feature 5: Extension path command" \
    npm run omg -- extension path
  run_check "Feature 5: Skill list command" \
    npm run omg -- skill list
  run_check "Feature 5: Verify command reliability suite" \
    npx vitest run tests/reliability/verify-command-package-manager.test.ts
  run_check "Feature 5: Full verify gate" \
    npm run verify
fi

{
  echo "## Summary"
  echo ""
  echo "- selected_feature: ${FEATURE_FILTER}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "- mode: dry-run"
  fi
  echo "- checks_total: ${TOTAL_CHECKS}"
  echo "- pass: ${passes}"
  echo "- fail: ${fails}"
  echo "- report: ${REPORT_PATH}"
  echo ""
} >> "$REPORT_PATH"

cat "$REPORT_PATH"

if [[ "$fails" -gt 0 ]]; then
  echo "[feature-readiness] one or more checks failed" >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[feature-readiness] dry-run completed"
else
  echo "[feature-readiness] all checks passed"
fi
