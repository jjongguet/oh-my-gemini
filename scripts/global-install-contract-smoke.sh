#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d)"
NPM_CACHE_DIR="$TMP_DIR/npm-cache"
GLOBAL_PREFIX="$TMP_DIR/global-prefix"
WRITE_WORKSPACE="$TMP_DIR/workspace-write"
DRY_RUN_WORKSPACE="$TMP_DIR/workspace-dry-run"
TARBALL_PATH=""

cleanup() {
  if [[ -n "$TARBALL_PATH" && -f "$TARBALL_PATH" ]]; then
    rm -f "$TARBALL_PATH"
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

need_cmd() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[global-install-contract] missing required command: $command_name" >&2
    exit 1
  fi
}

need_cmd npm
need_cmd node
need_cmd bash

REQUIRED_SETUP_ARTIFACTS=(
  ".omp/setup-scope.json"
  ".gemini/settings.json"
  ".gemini/GEMINI.md"
  ".gemini/sandbox.Dockerfile"
)

validate_setup_result() {
  local payload_json="$1"
  local workspace="$2"
  local context_label="$3"
  local expected_changed="$4"
  local expected_status="$5"

  node -e '
const fs = require("node:fs");
const path = require("node:path");
const payload = JSON.parse(process.argv[1]);
const workspace = process.argv[2];
const contextLabel = process.argv[3];
const expectedChanged = process.argv[4] === "true";
const expectedStatus = process.argv[5];
const workspaceRoot = (() => {
  try {
    return fs.realpathSync.native(workspace);
  } catch {
    return path.resolve(workspace);
  }
})();

if (payload.scope !== "project") {
  console.error(`[global-install-contract] ${contextLabel}: setup scope mismatch:`, payload.scope);
  process.exit(1);
}

if (payload.changed !== expectedChanged) {
  console.error(
    `[global-install-contract] ${contextLabel}: expected changed=${expectedChanged} but got ${payload.changed}`,
  );
  process.exit(1);
}

const expected = {
  "persist-scope": ".omp/setup-scope.json",
  "gemini-settings": ".gemini/settings.json",
  "gemini-managed-note": ".gemini/GEMINI.md",
  "sandbox-dockerfile": ".gemini/sandbox.Dockerfile",
  "subagents-catalog": ".gemini/agents/catalog.json",
};

const actions = Array.isArray(payload.actions) ? payload.actions : [];

for (const [id, relPath] of Object.entries(expected)) {
  const action = actions.find((entry) => entry && entry.id === id);
  if (!action) {
    console.error(`[global-install-contract] ${contextLabel}: missing required action id:`, id);
    process.exit(1);
  }

  const expectedPath = path.join(workspaceRoot, relPath);
  if (action.path !== expectedPath) {
    console.error(`[global-install-contract] ${contextLabel}: action path mismatch for`, id);
    console.error("  expected:", expectedPath);
    console.error("  actual:  ", action.path);
    process.exit(1);
  }

  // subagents-catalog always returns "skipped" (native agents/*.md files replace catalog.json)
  const actionExpectedStatus = id === "subagents-catalog" ? "skipped" : expectedStatus;
  if (action.status !== actionExpectedStatus) {
    console.error(
      `[global-install-contract] ${contextLabel}: expected status ${actionExpectedStatus} for ${id}, got ${action.status}`,
    );
    process.exit(1);
  }
}
' "$payload_json" "$workspace" "$context_label" "$expected_changed" "$expected_status"
}

snapshot_required_artifacts() {
  local workspace="$1"

  node -e '
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const workspace = process.argv[1];
const required = [
  ".omp/setup-scope.json",
  ".gemini/settings.json",
  ".gemini/GEMINI.md",
  ".gemini/sandbox.Dockerfile",
];

const snapshot = {};
for (const relPath of required) {
  const artifactPath = path.join(workspace, relPath);
  const content = fs.readFileSync(artifactPath);
  snapshot[relPath] = crypto.createHash("sha256").update(content).digest("hex");
}

process.stdout.write(JSON.stringify(snapshot));
' "$workspace"
}

assert_required_artifacts_unchanged() {
  local before_snapshot_json="$1"
  local workspace="$2"

  node -e '
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const before = JSON.parse(process.argv[1]);
const workspace = process.argv[2];

for (const [relPath, previousHash] of Object.entries(before)) {
  const artifactPath = path.join(workspace, relPath);
  const nextHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(artifactPath))
    .digest("hex");

  if (nextHash !== previousHash) {
    console.error("[global-install-contract] write idempotency mismatch for", relPath);
    process.exit(1);
  }
}
' "$before_snapshot_json" "$workspace"
}

echo "[global-install-contract] root: $ROOT_DIR"

pack_output_json="$(npm_config_cache="$NPM_CACHE_DIR" npm pack --json)"
tarball_name="$(node -e "const payload = JSON.parse(process.argv[1]); const first = Array.isArray(payload) ? payload[0] : null; if (!first || !first.filename) { process.exit(1); } process.stdout.write(first.filename);" "$pack_output_json")"

if [[ -z "$tarball_name" ]]; then
  echo "[global-install-contract] failed to resolve tarball name from npm pack output" >&2
  exit 1
fi

TARBALL_PATH="$ROOT_DIR/$tarball_name"
if [[ ! -f "$TARBALL_PATH" ]]; then
  echo "[global-install-contract] expected tarball not found: $TARBALL_PATH" >&2
  exit 1
fi

mkdir -p "$GLOBAL_PREFIX" "$WRITE_WORKSPACE" "$DRY_RUN_WORKSPACE"

npm_config_cache="$NPM_CACHE_DIR" npm install --no-audit --no-fund -g --prefix "$GLOBAL_PREFIX" "$TARBALL_PATH" >/dev/null

BIN_OMP="$GLOBAL_PREFIX/bin/omp"
BIN_MAIN="$GLOBAL_PREFIX/bin/oh-my-product"

if [[ ! -x "$BIN_OMP" ]]; then
  echo "[global-install-contract] missing global alias bin: $BIN_OMP" >&2
  exit 1
fi

if [[ ! -x "$BIN_MAIN" ]]; then
  echo "[global-install-contract] missing global main bin: $BIN_MAIN" >&2
  exit 1
fi

echo "[global-install-contract] validating global bin provenance"
resolved_omp="$(PATH="$GLOBAL_PREFIX/bin:$PATH" command -v omp || true)"
resolved_main="$(PATH="$GLOBAL_PREFIX/bin:$PATH" command -v oh-my-product || true)"

if [[ "$resolved_omp" != "$BIN_OMP" ]]; then
  echo "[global-install-contract] omp does not resolve to temp global prefix bin" >&2
  echo "  expected: $BIN_OMP" >&2
  echo "  actual:   ${resolved_omp:-<empty>}" >&2
  exit 1
fi

if [[ "$resolved_main" != "$BIN_MAIN" ]]; then
  echo "[global-install-contract] oh-my-product does not resolve to temp global prefix bin" >&2
  echo "  expected: $BIN_MAIN" >&2
  echo "  actual:   ${resolved_main:-<empty>}" >&2
  exit 1
fi

"$BIN_OMP" --help >/dev/null
"$BIN_MAIN" --help >/dev/null

echo "[global-install-contract] running setup (write mode, first pass) via omp"
cd "$WRITE_WORKSPACE"
setup_write_first_json="$("$BIN_OMP" setup --scope project --json)"
validate_setup_result "$setup_write_first_json" "$WRITE_WORKSPACE" "write/omp/first" "true" "created"

for relative_path in "${REQUIRED_SETUP_ARTIFACTS[@]}"; do
  if [[ ! -f "$WRITE_WORKSPACE/$relative_path" ]]; then
    echo "[global-install-contract] missing setup artifact: $relative_path" >&2
    exit 1
  fi
done

node -e '
const fs = require("node:fs");
const path = require("node:path");
const workspace = process.argv[1];

const setupScope = JSON.parse(fs.readFileSync(path.join(workspace, ".omp/setup-scope.json"), "utf8"));
if (setupScope.scope !== "project") {
  console.error("[global-install-contract] .omp/setup-scope.json must contain scope=project");
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(path.join(workspace, ".gemini/settings.json"), "utf8"));
const validSandboxValues = ["docker", "sandbox-exec"];
if (!settings.tools || !validSandboxValues.includes(settings.tools.sandbox)) {
  console.error("[global-install-contract] .gemini/settings.json must set tools.sandbox to docker or sandbox-exec, got: " + (settings.tools && settings.tools.sandbox));
  process.exit(1);
}

const geminiGuide = fs.readFileSync(path.join(workspace, ".gemini/GEMINI.md"), "utf8");
if (!geminiGuide.includes("This section is managed by oh-my-product setup.")) {
  console.error("[global-install-contract] managed setup marker missing from .gemini/GEMINI.md");
  process.exit(1);
}
' "$WRITE_WORKSPACE"

write_snapshot_before_second_run="$(snapshot_required_artifacts "$WRITE_WORKSPACE")"

echo "[global-install-contract] running setup (write mode, second pass) via oh-my-product"
setup_write_second_json="$("$BIN_MAIN" setup --scope project --json)"
validate_setup_result "$setup_write_second_json" "$WRITE_WORKSPACE" "write/oh-my-product/second" "false" "unchanged"
assert_required_artifacts_unchanged "$write_snapshot_before_second_run" "$WRITE_WORKSPACE"

echo "[global-install-contract] running setup (dry-run mode, first pass) via oh-my-product"
cd "$DRY_RUN_WORKSPACE"
setup_dry_run_main_json="$("$BIN_MAIN" setup --scope project --dry-run --json)"
validate_setup_result "$setup_dry_run_main_json" "$DRY_RUN_WORKSPACE" "dry-run/oh-my-product/first" "false" "skipped"

echo "[global-install-contract] running setup (dry-run mode, second pass) via omp"
setup_dry_run_alias_json="$("$BIN_OMP" setup --scope project --dry-run --json)"
validate_setup_result "$setup_dry_run_alias_json" "$DRY_RUN_WORKSPACE" "dry-run/omp/second" "false" "skipped"

for relative_path in "${REQUIRED_SETUP_ARTIFACTS[@]}"; do
  if [[ -e "$DRY_RUN_WORKSPACE/$relative_path" ]]; then
    echo "[global-install-contract] dry-run must not create artifact: $relative_path" >&2
    exit 1
  fi
done

cd "$ROOT_DIR"
echo "[global-install-contract] success"
