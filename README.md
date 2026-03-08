**English** | [Korean](README.ko.md) | [Chinese (Simplified)](README.zh.md) | [Japanese](README.ja.md)

<p align="center">
  <img src="docs/assets/omg_logo.png" alt="oh-my-gemini" width="240" />
</p>

# oh-my-gemini

[![npm version](https://img.shields.io/npm/v/oh-my-gemini-sisyphus?color=cb3837)](https://www.npmjs.com/package/oh-my-gemini-sisyphus)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-gemini?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-gemini/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **Sister projects:** Prefer Claude Code or Codex? See [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) and [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex).

**Multi-agent orchestration for Gemini CLI. Zero learning curve.**

_Don't wrangle Gemini CLI. Just run OMG._

[Quick Start](#quick-start) • [Team Mode](#team-mode-recommended) • [Features](#features) • [CLI Reference](#cli-reference) • [Requirements](#requirements)

---

## Quick Start

**Step 1: Install**

```bash
npm install -g oh-my-gemini-sisyphus
```

**Step 2: Setup**

```bash
omg setup --scope project
```

**Step 3: Start Gemini**

```bash
omg
```

That's it.

`omg` launches Gemini CLI with the OMG extension loaded. If you're already inside tmux, it runs there. If not, OMG starts a fresh tmux session for you.

### Good next commands

```bash
omg doctor
omg verify
omg hud --watch
```

---

## Team Mode (Recommended)

OMG is tmux-first: `omg team run` coordinates real Gemini-powered worker sessions, persists state under `.omg/state/`, and gives you lifecycle commands for long-running work.

```bash
# parallel implementation or review
omg team run --task "review src/team and src/cli for reliability gaps" --workers 4

# explicit backend/role routing via task-prefix keywords
omg team run --task "/subagents $planner /review /verify ship the release checklist" --workers 3

# inspect or resume an existing run
omg team status --team oh-my-gemini --json
omg team resume --team oh-my-gemini --max-fix-loop 1

# stop cleanly when you're done
omg team shutdown --team oh-my-gemini --force
```

**Default backend:** `tmux`  
**Optional backend:** `subagents` for explicit role-tagged runs

---

## Why oh-my-gemini?

- **Gemini-native workflow** - built around Gemini CLI instead of bolting Gemini on as a secondary provider
- **Zero-learning-curve entrypoint** - `omg` launches an interactive session; no extension plumbing to memorize
- **Team-first orchestration** - coordinated worker execution with persistent lifecycle state and resumable runs
- **Verify-gated delivery** - `omg verify` bundles typecheck, smoke, integration, and reliability suites
- **Operational visibility** - HUD, doctor, and stateful lifecycle commands make runs observable and recoverable
- **Skill-aware runtime** - reusable skills like `deep-interview`, `review`, `verify`, and `handoff` stay available in both CLI and extension-first flows
- **Part of the OMC / OMX family** - the Gemini sibling to OMC (Claude Code) and OMX (Codex), adapted for Gemini-first workflows

---

## Features

### Orchestration Modes

| Feature | What it is | Use it for |
| ------- | ---------- | ---------- |
| **Team** | Multi-worker orchestration with persisted state, health checks, resume/shutdown/cancel controls, and tmux as the default runtime | Parallel implementation, reviews, and longer-running coordinated tasks |
| **Interactive Launch** | `omg` / `omg launch` starts Gemini CLI with the OMG extension loaded, inside your current tmux pane or a new tmux session | Day-to-day interactive Gemini development without setup churn |
| **Verify** | `omg verify` runs packaged validation tiers across `typecheck`, `smoke`, `integration`, and `reliability` suites | Release checks, confidence gates, and CI-friendly validation |
| **HUD** | `omg hud` renders a live status overlay from persisted team state | Monitoring active runs without spelunking through JSON state files |
| **Skills** | `omg skill` exposes reusable prompts like `deep-interview`, `review`, `verify`, `cancel`, and `handoff` | Repeatable workflows, guided execution, and operator handoffs |

### More developer leverage

- **Doctor command** for checking Node, Gemini CLI, tmux, extension assets, and `.omg/state` writeability
- **Deterministic state persistence** under `.omg/state` for resumable orchestration
- **Extension-first packaging** through `extensions/oh-my-gemini/`
- **Optional MCP/tooling surfaces** for deeper Gemini integrations when you need them

---

## Magic Keywords

Optional shortcuts for power users. OMG works great with normal CLI commands too.

| Keyword / Shortcut | Effect | Example |
| ------------------ | ------ | ------- |
| `/tmux` or `$tmux` | Force the tmux team backend | `omg team run --task "/tmux smoke"` |
| `/subagents` or `/agents` | Force the subagents backend | `omg team run --task "/subagents $planner /verify release dry run" --workers 2` |
| `$planner` or `$plan` | Assign the planner role at the start of a subagents task | `omg team run --task "$planner draft the implementation plan" --workers 1` |
| `/review` | Map to the code-reviewer role | `omg team run --task "/subagents /review inspect auth changes" --workers 1` |
| `/verify` | Map to the verifier role | `omg team run --task "/subagents /verify confirm the gate passes" --workers 1` |
| `/handoff` | Map to the writer role for handoff artifacts | `omg team run --task "/subagents /handoff summarize the release state" --workers 1` |
| `--madmax` | Expands interactive launch to `--yolo --sandbox=none` when starting Gemini | `omg --madmax` |

---

## CLI Reference

| Command | What it does | Example |
| ------- | ------------ | ------- |
| `omg` | Launch Gemini CLI interactively with the OMG extension loaded | `omg` |
| `omg launch` | Explicit version of the default interactive launch command | `omg launch --yolo` |
| `omg team run` | Start a new orchestrated team run | `omg team run --task "smoke" --workers 3` |
| `omg team status` | Inspect persisted phase, worker, and task health | `omg team status --team oh-my-gemini --json` |
| `omg team resume` | Resume a previous run from persisted metadata | `omg team resume --team oh-my-gemini --max-fix-loop 1` |
| `omg team shutdown` | Gracefully stop the persisted runtime handle | `omg team shutdown --team oh-my-gemini --force` |
| `omg team cancel` | Mark active tasks cancelled and stop lifecycle progress | `omg team cancel --team oh-my-gemini --force --json` |
| `omg doctor` | Diagnose local prerequisites and optionally auto-fix safe issues | `omg doctor --fix --json` |
| `omg verify` | Run verification suites or tiered validation plans | `omg verify --tier thorough` |
| `omg hud` | Render the live team HUD or watch it continuously | `omg hud --watch --interval-ms 1000` |
| `omg skill` | List or print reusable skill prompts | `omg skill list` |

Detailed command docs: [`docs/omg/commands.md`](docs/omg/commands.md)

---

## Requirements

### Required

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)**

Quick checks:

```bash
node -v
gemini --version
tmux -V
```

### tmux install hints

| Platform | Install |
| -------- | ------- |
| macOS | `brew install tmux` |
| Ubuntu / Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows (WSL2) | `sudo apt install tmux` |

### Optional

- **Docker or Podman** for isolated smoke checks, sandbox experiments, and some contributor workflows

OMG does **not** require Docker for normal installation, interactive use, or standard team orchestration.

---

## License

MIT

---

<div align="center">

**Sister projects:** [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) • [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)

**Gemini-native orchestration. Minimal ceremony.**

</div>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-gemini&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-gemini&type=date&legend=top-left)

## 💖 Support This Project

If oh-my-gemini improves your Gemini CLI workflow, consider sponsoring the project:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)

### Why sponsor?

- Keep Gemini-first orchestration development active
- Fund polish on team runtime, HUD, and verification workflows
- Help maintain open-source documentation, skills, and operator tooling
- Support the OMG / OMC / OMX ecosystem

### Other ways to help

- ⭐ Star the repo
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Contribute code or docs
