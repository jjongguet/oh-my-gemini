# Contributing to oh-my-gemini

Thanks for contributing to `oh-my-gemini`. This repository ships both the `omg` CLI runtime and the Gemini extension assets that power setup, orchestration, and verification workflows.

This guide is intentionally practical: it focuses on the commands and file locations you will actually use while preparing a change.

## Prerequisites

Install these tools before you start:

- Node.js `>=20.10.0`
- `npm`
- Gemini CLI (`@google/gemini-cli`)
- `tmux` for team orchestration
- Docker or Podman for sandbox and container checks
- `gh` (optional, but recommended for opening pull requests from the terminal)

Quick checks:

```bash
node -v
npm -v
gemini --version
tmux -V
docker --version
# optional if you use Podman
podman --version
# optional if you create PRs from the CLI
gh --version
```

## Development setup

### 1) Clone and install dependencies

```bash
git clone https://github.com/jjongguet/oh-my-gemini.git
cd oh-my-gemini
npm install
```

You can also use the bootstrap helper if you want the repository baseline created for you:

```bash
scripts/bootstrap-dev.sh
```

### 2) Configure the local project

```bash
npm run setup
npm run doctor
```

If you plan to exercise the experimental subagents backend locally, also run:

```bash
npm run setup:subagents
```

### 3) Link the local extension into Gemini CLI

For contributor workflows inside a checkout, link the in-repo extension directly:

```bash
gemini extensions link ./extensions/oh-my-gemini
```

If you want to verify the resolved extension path through the CLI first:

```bash
npm run omg -- extension path
```

## Branch naming

Use short, descriptive branch names in the form:

```text
<type>/<topic>
```

Recommended prefixes:

- `feat/` - new functionality
- `fix/` - bug fixes
- `docs/` - documentation-only changes
- `refactor/` - internal restructuring without behavior changes
- `test/` - test-only updates
- `chore/` - tooling, housekeeping, or maintenance
- `ci/` - workflow and pipeline changes

Examples:

```text
feat/team-resume-health-checks
fix/verify-tier-json-output
docs/contributing-guide
test/hud-watch-regression
```

## Commit conventions

Use imperative, focused commit messages. Prefer this format:

```text
<type>(optional-scope): short summary
```

Common commit types in this repo:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `ci`
- `perf`

Examples:

```text
feat(team): persist resume thresholds in run metadata
fix(doctor): fail closed on missing extension manifest
docs: add team orchestration examples
test(hud): cover watch mode state refresh
```

Keep each commit to one logical change. If you touched code and docs, prefer documenting the behavior in the same change set that introduced it.

## Pull request process

1. Create your branch from the latest `main`.
2. Make the smallest change that solves the problem.
3. Run the required validation commands locally.
4. Push your branch.
5. Open a PR targeting `main`.
6. Include a concise summary, validation evidence, and any follow-up work.

Typical flow:

```bash
git checkout main
git pull --ff-only
git checkout -b feat/my-change

# make edits

npm run typecheck
npm run test
npm run verify

git status
git add <files>
git commit -m "feat(scope): describe the change"
git push -u origin feat/my-change
```

If you use GitHub CLI, open the PR with:

```bash
gh pr create \
  --base main \
  --head feat/my-change \
  --title "feat(scope): describe the change" \
  --body "## Summary
- what changed

## Validation
- npm run typecheck
- npm run test
- npm run verify"
```

### What to include in the PR description

- What changed
- Why the change was needed
- Exact commands you ran for validation
- Screenshots or terminal output snippets when UX or docs changed materially
- Any known limitations or follow-up work

## Testing requirements

For normal changes, run the baseline validation sequence:

```bash
npm run typecheck
npm run test
npm run verify
```

Useful targeted commands while iterating:

```bash
npm run test:smoke
npm run test:integration
npm run test:reliability
npm run omg -- verify --tier light --dry-run --json
npm run omg -- verify --tier standard --dry-run --json
npm run omg -- verify --tier thorough --dry-run --json
```

When you change orchestration, runtime lifecycle, worker health, or persistence behavior, also run:

```bash
npm run test:reliability
```

When you change documentation, verify that every command example still matches the current npm script or CLI surface.

## Code style and repository conventions

### TypeScript and CLI conventions

- Keep the project ESM-compatible.
- Use NodeNext-friendly imports with explicit `.js` suffixes in source files.
- Put CLI entrypoint behavior under `src/cli/`.
- Put reusable helpers in `src/common/` or the relevant library module instead of duplicating logic.
- Keep runtime behavior backend-driven; `tmux` is the default backend and `subagents` remains opt-in.

### Generated and managed files

Do not hand-edit generated or managed runtime artifacts unless the task is explicitly about them:

- `dist/`
- `.omg/`
- `.omx/`

### Documentation style

- Prefer copy/paste-able commands over abstract descriptions.
- Keep README-level guidance short and task-oriented.
- Put deeper walkthroughs under `docs/`.
- Update docs in the same PR when command names or workflows change.

## Contributing skills and prompts

`oh-my-gemini` has two related contribution surfaces:

- `src/skills/` for repo-local skill runtime behavior used by `npm run omg -- skill ...`
- `extensions/oh-my-gemini/skills/` for extension-facing packaged skills
- `src/prompts/` for role prompts used by orchestration workers

There is currently no separate `omg skill register` command. In practice, "registering" a skill means adding a discoverable `SKILL.md` file in the correct catalog directory and then validating it with `omg skill list` or `omg skill <name>`.

### Add a repo-local skill

Create a new directory under `src/skills/<name>/` with a `SKILL.md` file.

Example:

```bash
mkdir -p src/skills/release-check
cat > src/skills/release-check/SKILL.md <<'SKILL'
---
name: release-check
aliases: ["release prep"]
primaryRole: writer
description: Prepare a release checklist for this repository.
---

# Release Check

1. Confirm `npm run typecheck`
2. Confirm `npm run test`
3. Confirm `npm run verify`
4. Summarize blockers and next commands.

Task: {{ARGUMENTS}}
SKILL
```

Then validate it locally:

```bash
npm run omg -- skill list
npm run omg -- skill release-check "prepare the next release candidate"
```

### Ship the same skill through the Gemini extension

If the skill should also be visible from the extension surface, mirror it into the extension catalog and relink the extension:

```bash
mkdir -p extensions/oh-my-gemini/skills/release-check
cp src/skills/release-check/SKILL.md extensions/oh-my-gemini/skills/release-check/SKILL.md
gemini extensions link ./extensions/oh-my-gemini
```

### Add or update a worker role prompt

Role prompts live under `src/prompts/`.

Use the existing prompt files as templates:

```bash
ls src/prompts
sed -n '1,120p' src/prompts/plan.md
sed -n '1,120p' src/prompts/review.md
```

When changing prompts, keep them concise, role-specific, and aligned with existing orchestration behavior.

## Running team orchestration locally

Use these commands when you want to exercise the tmux-backed runtime in a real repository checkout.

### Dry-run the launch configuration

```bash
npm run omg -- team run --task "review src/team lifecycle behavior" --workers 4 --dry-run --json
```

### Start a local run

```bash
npm run omg -- team run --task "review src/team lifecycle behavior" --workers 4
```

### Monitor progress

```bash
npm run omg -- hud --team oh-my-gemini --preset focused
npm run omg -- hud --watch --interval-ms 1000
npm run omg -- team status --team oh-my-gemini --json
```

### Resume or stop a run

```bash
npm run omg -- team resume --team oh-my-gemini --max-fix-loop 1
npm run omg -- team shutdown --team oh-my-gemini --force --json
```

If you want a quick integration-style smoke instead of a manual task, use the helper script:

```bash
scripts/integration-team-run.sh "smoke"
```

## Additional examples

- [`docs/examples/code-review-workflow.md`](docs/examples/code-review-workflow.md)
- [`docs/examples/ci-integration.md`](docs/examples/ci-integration.md)
- [`docs/examples/custom-skill-guide.md`](docs/examples/custom-skill-guide.md)
