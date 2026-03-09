# Contributing to oh-my-gemini

Thank you for your interest in contributing to oh-my-gemini! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Structure](#code-structure)
- [Adding New CLI Commands](#adding-new-cli-commands)
- [Adding New Skills](#adding-new-skills)
- [Pull Request Guidelines](#pull-request-guidelines)

## Development Setup

### Prerequisites

- **Node.js** >= 20.10.0
- **npm** (bundled with Node.js)
- **tmux** (required for team orchestration runtime)
- **Git**

### Clone and Install

```bash
git clone https://github.com/jjongguet/oh-my-gemini.git
cd oh-my-gemini
npm install
```

### Build

```bash
npm run build          # Compile TypeScript (tsconfig.build.json)
npm run typecheck      # Type-check without emitting (tsconfig.json --noEmit)
```

The compiled output lands in `dist/`. The CLI entry point is `dist/cli/index.js`, exposed as the `omg` (and `oh-my-gemini`) binary.

### Running the CLI from Source

```bash
npm run omg -- <command> [options]
# Example:
npm run omg -- doctor --json
```

### Project Setup (Post-Install)

After cloning, bootstrap local project artifacts:

```bash
npm run setup          # Equivalent to: omg setup --scope project
```

## Running Tests

oh-my-gemini uses [Vitest](https://vitest.dev/) as its test runner. Tests are organized into tiers by scope and reliability:

```bash
# Run all unit tests (default)
npm test

# Individual test suites
npm run test:smoke          # Fast sanity checks (tests/smoke/)
npm run test:integration    # Cross-module integration (tests/integration/)
npm run test:reliability    # Watchdog, lifecycle, config edge cases (tests/reliability/)
npm run test:e2e            # End-to-end API lifecycle (tests/e2e/)

# Run all tiers (smoke + integration + reliability)
npm run test:all

# Verification-specific tests
npm run test:verification   # Verification tier selector, test runner, assertions

# Watch mode
npm run test:watch

# Built-in verification command
npm run verify              # omg verify — runs smoke/integration/reliability suites
npm run verify:ci           # CI-oriented: verification tests + verify --tier thorough --json
```

### Docker-based Testing

```bash
npm run test:docker         # Run smoke tests inside Docker
npm run test:docker:keep    # Same, but keep the container after exit
npm run test:docker:full    # Full test suite inside Docker
```

## Code Structure

```
src/
  cli/              CLI entry point and command handlers
    commands/       Individual command implementations (setup, doctor, team-run, etc.)
    tools/          Built-in MCP tool definitions
  team/             Team orchestration engine
    control-plane/  Task and mailbox lifecycle (TaskControlPlane, MailboxControlPlane)
    runtime/        Runtime backends (tmux)
  hud/              Heads-up display rendering
  notifications/    Webhook delivery (Slack, Discord, Telegram)
  state/            Persisted state store (phase, snapshots, heartbeats, tasks)
  config/           Configuration loading, model routing, feature flags
  skills/           Skill resolver and dispatcher (SKILL.md-based)
  hooks/            Hook context injection for workers
  mcp/              MCP server implementation
  agents/           Agent catalog and definitions
  commands/         Shared command utilities
  features/         Feature flag evaluation
  verification/     Verification tier logic
  openclaw/         OpenClaw runtime guard
  providers/        External model provider integration
  plugins/          Plugin system
  tools/            MCP tool implementations
  utils/            Shared utilities
  lib/              Core library helpers
  shared/           Cross-module shared types
  interop/          Interoperability adapters
  platform/         Platform detection
  prd/              PRD acceptance contract evaluation
  constants.ts      Global constants

tests/
  smoke/            Fast startup and contract sanity checks
  integration/      Cross-module integration tests
  reliability/      Edge-case and watchdog tests
  e2e/              End-to-end Gemini API lifecycle tests
  utils/            Shared test utilities

docs/               Documentation and analysis artifacts
scripts/            CI/CD and setup shell scripts
extensions/         Gemini CLI extension assets
omg-mcp/            MCP server package
omg-providers/      Provider adapters package
omg-tools/          Standalone tools package
```

## Adding New CLI Commands

CLI commands live in `src/cli/commands/`. Each command follows a consistent pattern:

1. **Create the command file** at `src/cli/commands/<name>.ts`:

```typescript
import type { CliIo } from '../types.js';

export interface MyCommandContext {
  cwd: string;
  io: CliIo;
  // Add injectable dependencies for testability
}

export async function executeMyCommand(
  args: string[],
  context: MyCommandContext,
): Promise<{ exitCode: number }> {
  // Parse args, execute logic, write output via context.io
  context.io.stdout('Done');
  return { exitCode: 0 };
}
```

2. **Register in the CLI router** at `src/cli/index.ts`:

```typescript
import { executeMyCommand, type MyCommandContext } from './commands/my-command.js';

// Add to CliDependencies interface
// Add case in the switch statement inside runCli()
// Add to printGlobalHelp()
```

3. **Write tests** in the appropriate tier (`tests/smoke/` or `tests/integration/`).

Key conventions:
- Commands receive a `CliIo` object (`stdout`/`stderr` callbacks) instead of writing directly to `console` — this enables testability.
- Dependencies are injected through a context object so tests can provide stubs.
- Commands return `{ exitCode: number }` rather than calling `process.exit()`.

## Adding New Skills

Skills are markdown-based prompt templates stored under `src/skills/<skill-name>/SKILL.md`. They are resolved at runtime by the skill dispatcher.

1. **Create the skill directory and prompt**:

```
src/skills/my-skill/SKILL.md
```

2. **Add frontmatter** at the top of `SKILL.md`:

```markdown
---
name: my-skill
aliases: ["/my-skill", "my skill alias"]
primaryRole: executor
description: Short description of what this skill does
---

# My Skill

Your prompt template content here...
```

3. **Skill resolution**: The dispatcher (`src/skills/resolver.ts`) scans skill directories for `SKILL.md` files, parses the YAML frontmatter, and matches by name or alias. No code changes are needed to register a new skill — simply adding the `SKILL.md` file is sufficient.

4. **Invoking skills**:
   - CLI: `omg skill my-skill [args...]`
   - From within the orchestration layer: the skill dispatcher resolves and returns the prompt content.

Existing skills for reference: `deep-interview`, `handoff`, `review`, `verify`.

## Pull Request Guidelines

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `test`, `ci`, `refactor`, `chore`, `perf`

**Scopes**: `cli`, `team`, `state`, `config`, `notifications`, `hud`, `skills`, `mcp`, `openclaw`, `verification`

Examples:
```
feat(team): add pre-claim task assignment for workers
fix(config): fail closed on invalid numeric env overrides
test(e2e): add Gemini API lifecycle integration tests
docs: add CONTRIBUTING.md and API documentation
```

### PR Description

Every PR should include:
- A summary of what changed and why
- Links to related issues (if applicable)
- A test plan describing how the changes were verified

### CI Checks

All PRs must pass:
- **Type checking**: `npm run typecheck` (zero errors)
- **Test suites**: `npm run test:all` (smoke + integration + reliability)
- **Verification**: `npm run verify` (built-in verification runner)

### Code Style

- TypeScript strict mode is enforced
- Prefer explicit types over `any`
- Use dependency injection for testability (context objects, not globals)
- Keep command handlers pure — side effects go through injected interfaces (`CliIo`, state stores)
- All HTTPS webhook URLs are validated before use (no HTTP allowed)
