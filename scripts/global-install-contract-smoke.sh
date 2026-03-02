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

BIN_OMG="$GLOBAL_PREFIX/bin/omg"
BIN_MAIN="$GLOBAL_PREFIX/bin/oh-my-gemini"

if [[ ! -x "$BIN_OMG" ]]; then
  echo "[global-install-contract] missing global alias bin: $BIN_OMG" >&2
  exit 1
fi

if [[ ! -x "$BIN_MAIN" ]]; then
  echo "[global-install-contract] missing global main bin: $BIN_MAIN" >&2
  exit 1
fi

echo "[global-install-contract] validating global bin provenance"
resolved_omg="$(PATH="$GLOBAL_PREFIX/bin:$PATH" command -v omg || true)"
resolved_main="$(PATH="$GLOBAL_PREFIX/bin:$PATH" command -v oh-my-gemini || true)"

if [[ "$resolved_omg" != "$BIN_OMG" ]]; then
  echo "[global-install-contract] omg does not resolve to temp global prefix bin" >&2
  echo "  expected: $BIN_OMG" >&2
  echo "  actual:   ${resolved_omg:-<empty>}" >&2
  exit 1
fi

if [[ "$resolved_main" != "$BIN_MAIN" ]]; then
  echo "[global-install-contract] oh-my-gemini does not resolve to temp global prefix bin" >&2
  echo "  expected: $BIN_MAIN" >&2
  echo "  actual:   ${resolved_main:-<empty>}" >&2
  exit 1
fi

"$BIN_OMG" --help >/dev/null
"$BIN_MAIN" --help >/dev/null

echo "[global-install-contract] running setup (write mode) via omg"
cd "$WRITE_WORKSPACE"
setup_write_json="$("$BIN_OMG" setup --scope project --json)"

node -e '
const fs = require("node:fs");
const path = require("node:path");
const payload = JSON.parse(process.argv[1]);
const workspace = process.argv[2];
const workspaceRoot = (() => {
  try {
    return fs.realpathSync.native(workspace);
  } catch {
    return path.resolve(workspace);
  }
})();

if (payload.scope !== "project") {
  console.error("[global-install-contract] setup scope mismatch:", payload.scope);
  process.exit(1);
}
if (payload.changed !== true) {
  console.error("[global-install-contract] expected changed=true on first setup run");
  process.exit(1);
}

const expected = {
  "persist-scope": ".omg/setup-scope.json",
  "gemini-settings": ".gemini/settings.json",
  "gemini-managed-note": ".gemini/GEMINI.md",
  "sandbox-dockerfile": ".gemini/sandbox.Dockerfile",
  "subagents-catalog": ".gemini/agents/catalog.json",
};

const actions = Array.isArray(payload.actions) ? payload.actions : [];
if (actions.length !== Object.keys(expected).length) {
  console.error("[global-install-contract] unexpected action count:", actions.length);
  process.exit(1);
}

for (const [id, relPath] of Object.entries(expected)) {
  const action = actions.find((entry) => entry && entry.id === id);
  if (!action) {
    console.error("[global-install-contract] missing setup action id:", id);
    process.exit(1);
  }

  const expectedPath = path.join(workspaceRoot, relPath);
  if (action.path !== expectedPath) {
    console.error("[global-install-contract] setup action path mismatch for", id);
    console.error("  expected:", expectedPath);
    console.error("  actual:  ", action.path);
    process.exit(1);
  }

  if (action.status !== "created") {
    console.error("[global-install-contract] expected created status for", id, "got", action.status);
    process.exit(1);
  }
}
' "$setup_write_json" "$WRITE_WORKSPACE"

for relative_path in \
  ".omg/setup-scope.json" \
  ".gemini/settings.json" \
  ".gemini/GEMINI.md" \
  ".gemini/sandbox.Dockerfile" \
  ".gemini/agents/catalog.json"; do
  if [[ ! -f "$WRITE_WORKSPACE/$relative_path" ]]; then
    echo "[global-install-contract] missing setup artifact: $relative_path" >&2
    exit 1
  fi
done

node -e '
const fs = require("node:fs");
const path = require("node:path");
const workspace = process.argv[1];

const setupScope = JSON.parse(fs.readFileSync(path.join(workspace, ".omg/setup-scope.json"), "utf8"));
if (setupScope.scope !== "project") {
  console.error("[global-install-contract] .omg/setup-scope.json must contain scope=project");
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(path.join(workspace, ".gemini/settings.json"), "utf8"));
if (!settings.tools || settings.tools.sandbox !== "docker") {
  console.error("[global-install-contract] .gemini/settings.json must set tools.sandbox=docker");
  process.exit(1);
}

JSON.parse(fs.readFileSync(path.join(workspace, ".gemini/agents/catalog.json"), "utf8"));

const geminiGuide = fs.readFileSync(path.join(workspace, ".gemini/GEMINI.md"), "utf8");
if (!geminiGuide.includes("This section is managed by oh-my-gemini setup.")) {
  console.error("[global-install-contract] managed setup marker missing from .gemini/GEMINI.md");
  process.exit(1);
}
' "$WRITE_WORKSPACE"

echo "[global-install-contract] running setup (dry-run mode) via oh-my-gemini"
cd "$DRY_RUN_WORKSPACE"
setup_dry_run_json="$("$BIN_MAIN" setup --scope project --dry-run --json)"

node -e '
const fs = require("node:fs");
const path = require("node:path");
const payload = JSON.parse(process.argv[1]);
const workspace = process.argv[2];
const workspaceRoot = (() => {
  try {
    return fs.realpathSync.native(workspace);
  } catch {
    return path.resolve(workspace);
  }
})();

if (payload.scope !== "project") {
  console.error("[global-install-contract] dry-run scope mismatch:", payload.scope);
  process.exit(1);
}

const expected = {
  "persist-scope": ".omg/setup-scope.json",
  "gemini-settings": ".gemini/settings.json",
  "gemini-managed-note": ".gemini/GEMINI.md",
  "sandbox-dockerfile": ".gemini/sandbox.Dockerfile",
  "subagents-catalog": ".gemini/agents/catalog.json",
};

const actions = Array.isArray(payload.actions) ? payload.actions : [];
if (actions.length !== Object.keys(expected).length) {
  console.error("[global-install-contract] dry-run action count mismatch:", actions.length);
  process.exit(1);
}

for (const [id, relPath] of Object.entries(expected)) {
  const action = actions.find((entry) => entry && entry.id === id);
  if (!action) {
    console.error("[global-install-contract] missing dry-run action id:", id);
    process.exit(1);
  }

  const expectedPath = path.join(workspaceRoot, relPath);
  if (action.path !== expectedPath) {
    console.error("[global-install-contract] dry-run action path mismatch for", id);
    console.error("  expected:", expectedPath);
    console.error("  actual:  ", action.path);
    process.exit(1);
  }

  if (action.status !== "skipped") {
    console.error("[global-install-contract] expected skipped status for", id, "got", action.status);
    process.exit(1);
  }
}
' "$setup_dry_run_json" "$DRY_RUN_WORKSPACE"

for relative_path in \
  ".omg/setup-scope.json" \
  ".gemini/settings.json" \
  ".gemini/GEMINI.md" \
  ".gemini/sandbox.Dockerfile" \
  ".gemini/agents/catalog.json"; do
  if [[ -e "$DRY_RUN_WORKSPACE/$relative_path" ]]; then
    echo "[global-install-contract] dry-run must not create artifact: $relative_path" >&2
    exit 1
  fi
done

cd "$ROOT_DIR"
echo "[global-install-contract] success"
