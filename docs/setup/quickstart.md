# Quickstart (MVP)

This quickstart follows the extension-first, tmux-default roadmap for **oh-my-gemini**.

## npm migration note

This project now uses **npm** as the default package manager for onboarding and verification.
If you previously used `pnpm`, use the npm equivalents below:

| Previous | Current |
| --- | --- |
| `pnpm install` | `npm install` |
| `pnpm omg <args>` | `npm run omg -- <args>` |
| `pnpm test:<suite>` | `npm run test:<suite>` |

## 1) Prerequisites

Install required tools:

- Node.js 20+
- `npm`
- Gemini CLI (`@google/gemini-cli`)
- `tmux`
- Docker (or compatible container runtime)

Quick checks:

```bash
node -v
npm -v
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
npm run setup
npm run setup:subagents
npm run doctor
```

`npm run setup` now provisions:
- `.gemini/settings.json` sandbox baseline,
- managed `.gemini/GEMINI.md` guidance block,
- `.gemini/sandbox.Dockerfile`,
- `.gemini/agents/catalog.json` (oh-my-claudecode-inspired team subagents, unified model).

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
npm run verify
```

If verification fails, fix issues and rerun until success.

## 7) Team run smoke

```bash
scripts/integration-team-run.sh "smoke"
```

This should execute a minimal lifecycle and write state artifacts under `.omg/state/`.

Subagent keyword assignment shortcut (`$` or `/` prefixes):

```bash
npm run omg -- team run --task "$planner /executor implement migration smoke"
```

## 8) Reliability gate checks

```bash
npm run test:reliability
npm run omg -- verify --suite reliability
```

Optional threshold tuning for reliability troubleshooting:

```bash
npm run omg -- team run --task "reliability-smoke" --watchdog-ms 90000 --non-reporting-ms 180000
```

## 9) Optional live OMX Team e2e (operator path)

```bash
npm run team:e2e -- "oh-my-gemini live team smoke"
```

Use this when you need evidence for real `omx team` lifecycle operations
(`start -> status polling -> shutdown`).
