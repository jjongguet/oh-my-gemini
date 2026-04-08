<p align="center">
  <img src="docs/assets/omp_logo.png" alt="oh-my-product" width="240" />
</p>

# oh-my-product

[![npm version](https://img.shields.io/npm/v/oh-my-product?color=cb3837)](https://www.npmjs.com/package/oh-my-product)
[![GitHub stars](https://img.shields.io/github/stars/jjongguet/oh-my-product?style=flat&color=yellow)](https://github.com/jjongguet/oh-my-product/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=flat&logo=github)](https://github.com/sponsors/jjongguet)

> **Sister projects:** [oh-my-claudecode (OMC)](https://github.com/Yeachan-Heo/oh-my-claudecode) | [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)

**Multi-agent orchestration for Gemini CLI. Zero learning curve.**

[Quick Start](#quick-start) | [Team Mode](#team-mode) | [Commands](#commands) | [Docs](docs/)

---

## Quick Start

```bash
npm install -g oh-my-product
omp setup --scope project
gemini
```

After setup, restart Gemini CLI for `/omp:*` commands to appear.

```bash
omp doctor                                    # check prerequisites
omp team run --task "..." --workers 2         # parallel work
omp hud --watch                               # live status
```

---

## Team Mode

tmux-first multi-worker orchestration with persistent state and lifecycle controls.

```bash
omp team run --task "review src/ for reliability gaps" --workers 4
omp team status --team oh-my-product --json
omp team resume --team oh-my-product
omp team shutdown --team oh-my-product --force
```

Default backend: `tmux` | Optional: `subagents` for role-tagged runs

---

## Commands

### CLI

| Command | Description |
|---------|-------------|
| `omp` | Launch Gemini CLI with the oh-my-product extension |
| `omp team run` | Start orchestrated team run |
| `omp team status/resume/shutdown/cancel` | Team lifecycle |
| `omp doctor` | Diagnose prerequisites |
| `omp verify` | Run validation suites |
| `omp hud` | Live team status overlay |
| `omp skill` | List/print reusable skill prompts |

### Slash Commands (inside Gemini CLI)

| Command | Description |
|---------|-------------|
| `/omp:autopilot` | End-to-end autonomous execution |
| `/omp:plan` | Phased execution plan with gates |
| `/omp:execute` | Immediate task implementation |
| `/omp:review` | Structured code review |
| `/omp:verify` | Acceptance validation |
| `/omp:debug` | Root cause investigation |
| `/omp:status` | Progress summary |
| `/omp:cancel` | Graceful stop |
| `/omp:handoff` | Context transfer document |

Full command reference: [`docs/omp/commands.md`](docs/omp/commands.md)

---

## Compatibility Note

User-facing command and documentation surfaces now use `omp` / `oh-my-product`.

Some internal compatibility identifiers intentionally remain unchanged for now:

- legacy hidden state and artifact paths
- legacy environment variable names
- legacy internal interop identifiers
- legacy internal type/class names

Those internal names are deferred to a later migration to avoid breaking state, protocol, and compatibility contracts.

---

## Requirements

- **Node.js 20+**
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**
- **[tmux](https://github.com/tmux/tmux)** (`brew install tmux` / `apt install tmux`)

---

## Default Model

| Model | Free (OAuth) | Free (API Key) |
|-------|--------------|----------------|
| `gemini-3.1-flash-lite-preview` (default) | Yes | Yes |
| `gemini-3.1-pro-preview` (`--pro`) | Yes | Yes |

Default model on `omp` launch is `gemini-3.1-flash-lite-preview`. Use `omp --pro` for `gemini-3.1-pro-preview`.

All defaults work without a paid Gemini CLI coding plan — just log in via OAuth (Google Account) or use an API key. Override with `OMP_MODEL_HIGH`, `OMP_MODEL_MEDIUM`, `OMP_MODEL_LOW` env vars. Gemini 3.1, 3, and 2.5 models are all available via `-m` flag.

### Emergency Model Override

If a default model becomes unavailable, override immediately without code changes:

```bash
export OMP_MODEL_HIGH=<working-model>
export OMP_MODEL_MEDIUM=<working-model>
export OMP_MODEL_LOW=<working-model>
```

---

## License

MIT

---

<div align="center">

**[oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)**

</div>

[![Star History Chart](https://api.star-history.com/svg?repos=jjongguet/oh-my-product&type=date&legend=top-left)](https://www.star-history.com/#jjongguet/oh-my-product&type=date&legend=top-left)

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4%EF%B8%8F-red?style=for-the-badge&logo=github)](https://github.com/sponsors/jjongguet)
