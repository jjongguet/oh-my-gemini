# Live OMP Team E2E (Operator Runbook)

This runbook validates the **real tmux-backed OMP Team lifecycle** against this repository.

It complements `omp team run` by exercising the operator path:

1. `omp team ...` start
2. `omp team status ...` monitoring
3. `omp team shutdown ...` cleanup

## Preconditions

- Run from a tmux leader pane (`$TMUX` must be set)
- `omp`, `tmux`, and `rg` are available in PATH
- Repository dependencies are installed (`npm install`)

## One-command e2e

```bash
npm run team:e2e -- "oh-my-product live team smoke"
```

The script (`scripts/e2e-omx-team.sh`) prints:

- `Team started: <team-name>` startup evidence
- status snapshots for each poll
- shutdown outcome
- cleanup verification for `.omp/state/team/<team-name>`

## Tuning

Environment variables:

- `POLL_SECONDS` (default `8`)
- `MAX_POLLS` (default `20`)
- `OMX_E2E_WORKERS` (default `1`, range `1..8`)

Example:

```bash
POLL_SECONDS=5 MAX_POLLS=30 OMX_E2E_WORKERS=3 npm run team:e2e -- "longer live team smoke"
```

The script performs a tmux pane-budget preflight and fails early with guidance
if the current pane/window cannot host the requested worker count.

## Failure handling

If terminal task state is not reached before timeout, the script still attempts
graceful shutdown, then retries with `--force` when gate-blocked, so stale team
state is not left behind.

## Multi-worker analysis task contract

When using live OMP Team for analysis/review work (not just smoke e2e), define
the task contract before launching workers:

1. **Scope** — exactly which transcript/files/logs are in-bounds
2. **Ownership** — one worker per axis (avoid duplicated bootstrap/review work)
3. **Definition of Done** — required output fields, acceptance criteria, and
   stop condition
4. **Evidence rule** — every claim must cite file lines or command output
5. **Verification rule** — run only the checks that match the task type
   (analysis tasks should not require unrelated live e2e/lint unless explicitly requested)
