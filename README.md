# oh-my-gemini

![oh-my-gemini logo](docs/assets/omg_logo.png)

Extension-first orchestration layer for Gemini CLI workflows.

`oh-my-gemini` provides:
- a CLI runtime (`oh-my-gemini`, alias `omg`),
- a Gemini extension package (`extensions/oh-my-gemini`),
- team orchestration with tmux default backend.

---

## Requirements

- Node.js `>=20.10.0`
- Gemini CLI (`@google/gemini-cli`)

Quick check:

```bash
node -v
gemini --version
```

---

## Install

```bash
npm install -g oh-my-gemini
```

---

## Quickstart

```bash
# 1) link packaged extension into Gemini CLI
EXT_PATH="$(oh-my-gemini extension path)"
gemini extensions link "$EXT_PATH"

# 2) initialize + diagnose
oh-my-gemini setup --scope project
oh-my-gemini doctor --fix --json --no-strict

# 3) verify + run smoke task
oh-my-gemini verify
oh-my-gemini team run --task "smoke" --workers 3
```

---

## Detailed references

- `omg` command reference: [`docs/omg/commands.md`](docs/omg/commands.md)
- README/docs boundary: [`docs/omg/docs-boundary.md`](docs/omg/docs-boundary.md)
- Project structure + npm scripts: [`docs/omg/project-map.md`](docs/omg/project-map.md)
