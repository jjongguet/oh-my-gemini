<p align="center">
  <img src="docs/assets/omg_logo.png" alt="oh-my-gemini" width="240" />
</p>

# oh-my-gemini

[![npm version](https://img.shields.io/npm/v/oh-my-gemini-sisyphus?color=cb3837)](https://www.npmjs.com/package/oh-my-gemini-sisyphus)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-gemini?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-gemini/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **Sister projects:** [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) | [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)

**Multi-agent orchestration for Gemini CLI. Zero learning curve.**

[Quick Start](#quick-start) | [Team Mode](#team-mode) | [Commands](#commands) | [Docs](docs/)

---

## Quick Start

```bash
npm install -g oh-my-gemini-sisyphus
omg setup --scope project
gemini
```

After setup, restart Gemini CLI for `/omg:*` commands to appear.

```bash
omg doctor                                    # check prerequisites
omg team run --task "..." --workers 2         # parallel work
omg hud --watch                               # live status
```

---

## Team Mode

tmux-first multi-worker orchestration with persistent state and lifecycle controls.

```bash
omg team run --task "review src/ for reliability gaps" --workers 4
omg team status --team oh-my-gemini --json
omg team resume --team oh-my-gemini
omg team shutdown --team oh-my-gemini --force
```

Default backend: `tmux` | Optional: `subagents` for role-tagged runs

---

## Commands

### CLI

| Command | Description |
|---------|-------------|
| `omg` | Launch Gemini CLI with OMG extension |
| `omg team run` | Start orchestrated team run |
| `omg team status/resume/shutdown/cancel` | Team lifecycle |
| `omg doctor` | Diagnose prerequisites |
| `omg verify` | Run validation suites |
| `omg hud` | Live team status overlay |
| `omg skill` | List/print reusable skill prompts |

### Slash Commands (inside Gemini CLI)

| Command | Description |
|---------|-------------|
| `/omg:autopilot` | End-to-end autonomous execution |
| `/omg:plan` | Phased execution plan with gates |
| `/omg:execute` | Immediate task implementation |
| `/omg:review` | Structured code review |
| `/omg:verify` | Acceptance validation |
| `/omg:debug` | Root cause investigation |
| `/omg:status` | Progress summary |
| `/omg:cancel` | Graceful stop |
| `/omg:handoff` | Context transfer document |

Full command reference: [`docs/omg/commands.md`](docs/omg/commands.md)

---

## Requirements

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)** (`brew install tmux` / `apt install tmux`)

---

## Default Models (Gemini 3.1)

| Tier | Model | Context |
|------|-------|---------|
| HIGH | `gemini-3.1-pro-preview` | 1M |
| MEDIUM | `gemini-3.1-flash-lite-preview` | 1M |
| LOW | `gemini-3.1-flash-lite-preview` | 1M |

`omg` launch 시 기본 모델은 `gemini-3.1-flash-lite-preview`. `omg --pro`로 3.1 Pro 강제 선택 가능.

Override with `OMG_MODEL_HIGH`, `OMG_MODEL_MEDIUM`, `OMG_MODEL_LOW` env vars. Gemini 3 and 2.5 models remain available for backward compatibility.

---

## License

MIT

---

<div align="center">

**[oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)**

</div>

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-gemini&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-gemini&type=date&legend=top-left)

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)
