# Quickstart (MVP)

This quickstart follows the extension-first, tmux-default roadmap for **oh-my-gemini**.

## 1) Prerequisites

Install required tools:

- Node.js 20+
- `pnpm`
- Gemini CLI (`@google/gemini-cli`)
- `tmux`
- Docker (or compatible container runtime)

Quick checks:

```bash
node -v
pnpm -v
gemini --version
tmux -V
docker --version
```

## 2) Bootstrap workspace

```bash
scripts/bootstrap-dev.sh
```

This script initializes baseline directories and default `.gemini/settings.json` (sandbox=docker).

## 3) Link extension (canonical control plane)

```bash
gemini extensions link ./extensions/oh-my-gemini
```

## 4) Setup + Doctor

```bash
pnpm omg setup --scope project
pnpm omg doctor
```

## 5) Sandbox smoke

```bash
scripts/sandbox-smoke.sh
```

Expected signal: command completes successfully and reports sandbox output.

If you only want to validate project wiring (without a live Gemini sandbox call):

```bash
scripts/sandbox-smoke.sh --dry-run
```

## 6) Verify harness

```bash
pnpm omg verify
```

If verification fails, fix issues and rerun until success.

## 7) Team run smoke

```bash
scripts/integration-team-run.sh "smoke"
```

This should execute a minimal lifecycle and write state artifacts under `.omg/state/`.

## 8) Reliability gate checks

```bash
pnpm test:reliability
pnpm omg verify --suite reliability
```

Optional threshold tuning for reliability troubleshooting:

```bash
pnpm omg team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
```
