#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_DIR="$(mktemp -d)"
NPM_CACHE_DIR="$TMP_DIR/npm-cache"
CONSUMER_DIR="$TMP_DIR/consumer"
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
    echo "[consumer-contract] missing required command: $command_name" >&2
    exit 1
  fi
}

need_cmd npm
need_cmd node
need_cmd bash

echo "[consumer-contract] root: $ROOT_DIR"

pack_output_json="$(npm_config_cache="$NPM_CACHE_DIR" npm pack --json)"
tarball_name="$(node -e "const payload = JSON.parse(process.argv[1]); const first = Array.isArray(payload) ? payload[0] : null; if (!first || !first.filename) { process.exit(1); } process.stdout.write(first.filename);" "$pack_output_json")"

if [[ -z "$tarball_name" ]]; then
  echo "[consumer-contract] failed to resolve tarball name from npm pack output" >&2
  exit 1
fi

TARBALL_PATH="$ROOT_DIR/$tarball_name"
if [[ ! -f "$TARBALL_PATH" ]]; then
  echo "[consumer-contract] expected tarball not found: $TARBALL_PATH" >&2
  exit 1
fi

echo "[consumer-contract] tarball: $TARBALL_PATH"

mkdir -p "$CONSUMER_DIR"
cd "$CONSUMER_DIR"

npm_config_cache="$NPM_CACHE_DIR" npm init -y >/dev/null 2>&1
npm_config_cache="$NPM_CACHE_DIR" npm install --no-audit --no-fund "$TARBALL_PATH" >/dev/null

BIN_MAIN="./node_modules/.bin/oh-my-gemini"
BIN_ALIAS="./node_modules/.bin/omg"

if [[ ! -x "$BIN_MAIN" ]]; then
  echo "[consumer-contract] missing executable bin: $BIN_MAIN" >&2
  exit 1
fi

if [[ ! -x "$BIN_ALIAS" ]]; then
  echo "[consumer-contract] missing executable bin: $BIN_ALIAS" >&2
  exit 1
fi

echo "[consumer-contract] validating local package bins"
"$BIN_MAIN" --help >/dev/null
"$BIN_ALIAS" --help >/dev/null
npx --no-install omg --help >/dev/null

echo "[consumer-contract] running setup and extension path checks"
"$BIN_ALIAS" setup --scope project >/dev/null

extension_path_json="$("$BIN_ALIAS" extension path --json)"
extension_path="$(node -e "const payload = JSON.parse(process.argv[1]); process.stdout.write(payload.path ?? '');" "$extension_path_json")"
manifest_path="$(node -e "const payload = JSON.parse(process.argv[1]); process.stdout.write(payload.manifestPath ?? '');" "$extension_path_json")"

if [[ -z "$extension_path" || ! -d "$extension_path" ]]; then
  echo "[consumer-contract] invalid extension path from omg extension path: $extension_path" >&2
  exit 1
fi

if [[ -z "$manifest_path" || ! -f "$manifest_path" ]]; then
  echo "[consumer-contract] invalid manifest path from omg extension path: $manifest_path" >&2
  exit 1
fi

echo "[consumer-contract] verifying default suite contract"
verify_report="$("$BIN_ALIAS" verify --dry-run --json)"
node -e "
const report = JSON.parse(process.argv[1]);
const suites = Array.isArray(report.suites) ? report.suites.map((entry) => entry?.suite) : [];
const expected = ['typecheck', 'smoke', 'integration', 'reliability'];
for (const suite of expected) {
  if (!suites.includes(suite)) {
    console.error('[consumer-contract] missing default suite:', suite);
    process.exit(1);
  }
}
" "$verify_report"

echo "[consumer-contract] running doctor in consumer workspace"
doctor_report="$("$BIN_ALIAS" doctor --json --no-strict)"
node -e "
const report = JSON.parse(process.argv[1]);
if (!report.extension || typeof report.extension.path !== 'string' || report.extension.path.length === 0) {
  console.error('[consumer-contract] doctor report missing extension path metadata');
  process.exit(1);
}
" "$doctor_report"

cd "$ROOT_DIR"

echo "[consumer-contract] enforcing deterministic invocation policy"
if rg -n -P "\\bnpx(?!\\s+--no-install)\\s+omg\\b" \
  README.md \
  docs \
  extensions \
  scripts \
  tests \
  .github/workflows \
  package.json \
  --glob '!scripts/consumer-contract-smoke.sh' \
  >/tmp/consumer-contract-npx-plain.txt; then
  echo "[consumer-contract] plain npx omg usage detected (use local bin or npx --no-install)." >&2
  cat /tmp/consumer-contract-npx-plain.txt >&2
  rm -f /tmp/consumer-contract-npx-plain.txt
  exit 1
fi
rm -f /tmp/consumer-contract-npx-plain.txt

echo "[consumer-contract] success"
