# Install Scopes and Precedence

`oh-my-gemini setup` supports scope-aware installation behavior. The default scope is **project**.

## Scope precedence

The resolved setup scope is determined in this strict order:

1. CLI flag (`--scope <value>`)
2. Persisted value (`.omg/setup-scope.json`)
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

Use the smoke script to validate:

```bash
scripts/smoke-install.sh
```
