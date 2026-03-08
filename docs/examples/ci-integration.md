# Example: Integrating `omg verify` into CI

This example shows a minimal GitHub Actions workflow that runs the same contributor checks expected before opening a PR.

## Recommended baseline

Run these commands locally first:

```bash
npm run typecheck
npm run test
npm run verify
```

## GitHub Actions example

Create `.github/workflows/omg-verify.yml` with the following content:

```yaml
name: omg-verify

on:
  pull_request:
    branches: [main]
  push:
    branches: [main, dev]

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install tmux
        run: sudo apt-get update && sudo apt-get install -y tmux

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Unit and integration tests
        run: npm run test

      - name: Verify command
        run: npm run verify -- --tier standard --json
```

## Why this works

- `npm ci` matches the repository's npm-first workflow.
- `tmux` is installed because team-related verification paths expect it to exist.
- `npm run verify -- --tier standard --json` gives you machine-readable output while still exercising the CLI verification surface.

## Useful variants

### Lighter PR checks

```bash
npm run omg -- verify --tier light --dry-run --json
```

### Thorough release-style checks

```bash
npm run omg -- verify --tier thorough --json
npm run test:reliability
```

## Local smoke test for the workflow commands

Before committing the workflow file, run the same command list locally:

```bash
npm ci
npm run typecheck
npm run test
npm run verify -- --tier standard --json
```
