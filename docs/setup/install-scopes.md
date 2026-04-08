# Install Scopes and Precedence

`oh-my-product setup` supports scope-aware installation behavior. The default scope is **project**.

## Scope precedence

The resolved setup scope is determined in this strict order:

1. CLI flag (`--scope <value>`)
2. Persisted value (`.omp/setup-scope.json`)
3. Default value (`project`)

## Supported scopes

- `project`: writes configuration within the current repository (recommended default)
- `user`: persisted as user intent for future expansion; MVP still writes managed files in the current repository.

> Note: in MVP, both scopes use repository-local managed files while preserving the
> precedence contract (`CLI flag > persisted > default`).

## Idempotency requirement

Running setup repeatedly with the same resolved scope must be safe:

- no duplicate marker blocks
- no destructive overwrite of user-managed sections
- no unexpected drift in managed files

## Setup action status reporting

`omp setup` prints explicit per-action statuses and a status summary line:

- `created`: setup created a missing managed file/value
- `updated`: setup changed an existing managed file/value
- `unchanged`: setup validated a managed target and found no drift
- `skipped`: setup intentionally skipped writes (for example `--dry-run`)

The plain-text output includes:

- `Changes applied: yes|no`
- `Action statuses: created=<n>, updated=<n>, unchanged=<n>, skipped=<n>`
- one line per managed action (scope persistence, `.gemini/settings.json`, managed
  `.gemini/GEMINI.md` block, `.gemini/sandbox.Dockerfile`, and
  `.gemini/agents/catalog.json`)

Use the smoke script to validate:

```bash
scripts/smoke-install.sh
```

If `.omp/setup-scope.json` becomes invalid JSON or has an invalid `scope` value,
`omp doctor --fix` rewrites the file back to a managed default (`project`).
