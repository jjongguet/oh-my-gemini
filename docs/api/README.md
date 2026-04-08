# oh-my-product API Reference

This document provides a reference for the public API modules, CLI commands, configuration, and internal systems of oh-my-product.

## Table of Contents

- [Overview](#overview)
- [CLI Command Reference](#cli-command-reference)
- [Configuration Reference](#configuration-reference)
- [Notification System](#notification-system)
- [Team Orchestration API](#team-orchestration-api)
- [State Management](#state-management)

## Overview

oh-my-product is an orchestration layer for Gemini CLI workflows. It provides:

- **CLI tooling** (`omp`) for project setup, diagnostics, team orchestration, and verification
- **Team orchestration** with lifecycle management (plan, exec, verify, fix loop)
- **MCP server** exposing tools over the Model Context Protocol
- **Notification webhooks** for Slack, Discord, and Telegram
- **Persistent state** for team runs, worker heartbeats, tasks, and phase transitions
- **Skill system** for markdown-based prompt templates

### Public API Modules

| Module | Entry Point | Description |
|--------|-------------|-------------|
| `config` | `src/config/index.ts` | Configuration loading, model routing, feature flags |
| `team` | `src/team/team-orchestrator.ts` | Team orchestration engine |
| `team/control-plane` | `src/team/control-plane/index.ts` | Task and mailbox lifecycle management |
| `team/monitor` | `src/team/monitor.ts` | Health monitoring and watchdog evaluation |
| `state` | `src/state/` | Persisted state store (filesystem-backed) |
| `notifications` | `src/notifications/` | Webhook delivery (Slack, Discord, Telegram) |
| `skills` | `src/skills/dispatcher.ts` | Skill resolution and dispatch |
| `cli` | `src/cli/index.ts` | CLI entry point and command router |
| `mcp` | `src/mcp/` | MCP stdio server |

## CLI Command Reference

The CLI is invoked as `omp <command> [options]` (or `oh-my-product <command>`).

### Global Options

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Print help and exit |
| `--version`, `-V` | Print version and exit |

### Commands

#### `omp setup`

Configure project/user setup artifacts and persisted scope.

```bash
omp setup --scope project
```

#### `omp doctor`

Diagnose runtime, tooling, and state prerequisites with optional safe fixes.

```bash
omp doctor              # Interactive diagnostics
omp doctor --json       # Machine-readable JSON output
```

#### `omp extension path`

Resolve extension package asset paths (used by IDE integrations and packaging).

```bash
omp extension path
```

#### `omp team run`

Execute team orchestration with lifecycle management.

```bash
omp team run --task "description" --backend tmux --workers 3
omp team run --task "smoke" --dry-run
```

| Flag | Default | Description |
|------|---------|-------------|
| `--task` | (required) | Task description for the team |
| `--backend` | `tmux` | Runtime backend |
| `--workers` | `3` | Number of worker panes |
| `--dry-run` | `false` | Preview without execution |
| `--max-fix-loop` | `3` | Maximum fix-loop iterations |

#### `omp team status`

Inspect persisted team runtime, phase, and task health.

```bash
omp team status --team my-team
omp team status --team my-team --json
```

#### `omp team resume`

Resume team execution from persisted run metadata.

```bash
omp team resume --team my-team
omp team resume --team my-team --max-fix-loop 1
```

#### `omp team shutdown`

Shutdown a persisted runtime handle (graceful by default).

```bash
omp team shutdown --team my-team
omp team shutdown --team my-team --force --json
```

#### `omp worker run`

Worker bootstrap command that runs inside tmux panes. Not intended for direct user invocation.

#### `omp skill`

Invoke or list registered skills.

```bash
omp skill plan
omp skill verify "check all tests pass"
```

#### `omp tools`

Built-in MCP tools (file, git, http, process) management.

```bash
omp tools list              # List available tools
omp tools list --json       # JSON output
omp tools manifest --json   # Full tool manifest
```

#### `omp mcp serve`

Start the MCP stdio server (or inspect surfaces with `--dry-run`).

```bash
omp mcp serve
omp mcp serve --dry-run
```

#### `omp verify`

Run smoke, integration, and reliability verification suites.

```bash
omp verify
omp verify --tier thorough --json
```

#### `omp hud`

Render the heads-up display with team/session status.

```bash
omp hud
```

## Configuration Reference

### Config Schema (`OmpConfig`)

Configuration is loaded from `omp.config.ts` (or JSON/JSONC equivalents) via the config loader at `src/config/loader.ts`.

```typescript
interface OmpConfig {
  agents: Record<string, OmpAgentConfig>;
  features: OmpFeatureFlags;
  permissions: OmpPermissionConfig;
  routing: OmpRoutingConfig;
  providers: OmpProvidersConfig;
  externalModels: OmpExternalModelsConfig;
}
```

### Agent Configuration

```typescript
interface OmpAgentConfig {
  model: string;  // Model identifier for this agent
}
```

### Feature Flags

```typescript
interface OmpFeatureFlags {
  parallelExecution: boolean;         // Enable parallel task execution
  continuationEnforcement: boolean;   // Enforce continuation checks
  autoContextInjection: boolean;      // Auto-inject context into hooks
  commandTemplates: boolean;          // Enable command template expansion
  runtimePlugins: boolean;            // Enable runtime plugin loading
}
```

### Permissions

```typescript
interface OmpPermissionConfig {
  allowBash: boolean;           // Allow bash command execution
  allowEdit: boolean;           // Allow file editing
  allowWrite: boolean;          // Allow file writing
  maxBackgroundTasks: number;   // Maximum concurrent background tasks
}
```

### Routing

```typescript
type ComplexityTier = 'LOW' | 'MEDIUM' | 'HIGH';

interface OmpRoutingConfig {
  enabled: boolean;                                    // Enable model routing
  defaultTier: ComplexityTier;                         // Default complexity tier
  forceInherit: boolean;                               // Inherit tier from parent
  escalationEnabled: boolean;                          // Allow tier escalation
  maxEscalations: number;                              // Max escalations per run
  tierModels: Record<ComplexityTier, string>;          // Model per tier
  agentOverrides: Record<string, OmpRoutingOverride>;  // Per-agent overrides
  escalationKeywords: string[];                        // Keywords triggering escalation
  simplificationKeywords: string[];                    // Keywords triggering simplification
}
```

### Provider Configuration

```typescript
interface OmpProvidersConfig {
  gemini: OmpGeminiProviderConfig;
}

interface OmpGeminiRetryConfig {
  maxRetries?: number;       // Max retry attempts (default: 3)
  initialDelayMs?: number;   // Initial backoff delay in ms (default: 1000)
  maxDelayMs?: number;       // Maximum backoff delay in ms (default: 30000)
}

interface OmpGeminiProviderConfig {
  enabled: boolean;
  apiKeyEnvVar: string;          // e.g. "GEMINI_API_KEY"
  baseUrl?: string;              // Custom API endpoint
  defaultModel: string;          // Default Gemini model ID (default: "gemini-3.1-flash-lite-preview")
  apiVersion?: string;           // API version override
  requestTimeoutMs?: number;     // Request timeout in ms (default: 30000, 120000 for thinking models)
  retry?: OmpGeminiRetryConfig;  // Retry configuration with exponential backoff
}
```

#### Example: Custom Retry and Timeout

In `~/.config/oh-my-product/config.jsonc` or `.gemini/omp.jsonc`:

```jsonc
{
  "providers": {
    "gemini": {
      "enabled": true,
      "defaultModel": "gemini-3.1-flash-lite-preview",
      "requestTimeoutMs": 60000,
      "retry": {
        "maxRetries": 5,
        "initialDelayMs": 2000,
        "maxDelayMs": 60000
      }
    }
  }
}
```

Environment variable overrides:

| Variable | Description |
|----------|-------------|
| `OMP_REQUEST_TIMEOUT_MS` | Override request timeout (highest priority) |
| `GEMINI_REQUEST_TIMEOUT_MS` | Alternative request timeout env var |
| `OMP_RETRY_MAX_RETRIES` | Override max retry attempts |
| `OMP_RETRY_INITIAL_DELAY_MS` | Override initial backoff delay |
| `OMP_RETRY_MAX_DELAY_MS` | Override max backoff delay |

### External Models

```typescript
type ExternalModelProvider = 'gemini' | 'codex';

interface OmpExternalModelsConfig {
  defaults: {
    provider?: ExternalModelProvider;
    codexModel: string;
    geminiModel: string;
  };
  fallbackPolicy: {
    onModelFailure: 'provider_chain' | 'cross_provider' | 'gemini_only';
    allowCrossProvider: boolean;
    crossProviderOrder: ExternalModelProvider[];
  };
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OMP_TEAM_POLL_TIMEOUT_MS` | Poll timeout for worker completion (default: 600000) |
| `OMP_TEAM_WATCHDOG_MS` | Watchdog threshold for snapshot staleness (default: 90000) |
| `OMP_TEAM_NON_REPORTING_MS` | Threshold for non-reporting workers (default: 180000) |
| `OMP_LEGACY_RUNNING_SUCCESS` | Set `1` to treat `running` status as success (compat) |
| `OMP_LEGACY_VERIFY_GATE_PASS` | Set `1` to pass verify gate when signal is missing (compat) |
| `OMP_REQUEST_TIMEOUT_MS` | Override request timeout for all API calls (milliseconds) |
| `GEMINI_REQUEST_TIMEOUT_MS` | Alias for `OMP_REQUEST_TIMEOUT_MS` |
| `OMP_MODEL_HIGH` | Override the HIGH-tier model (default: `gemini-3.1-flash-lite-preview`) |
| `OMP_MODEL_MEDIUM` | Override the MEDIUM-tier model (default: `gemini-3.1-flash-lite-preview`) |
| `OMP_MODEL_LOW` | Override the LOW-tier model (default: `gemini-3.1-flash-lite-preview`) |
| `OMP_GEMINI_PROVIDER` | Force provider selection: `google-ai` or `vertex-ai` |
| `GEMINI_API_KEY` | Google AI API key (auto-selects `google-ai` provider) |

### Default Model Routing (Free Tier)

The built-in tier model map defaults to `gemini-3.1-flash-lite-preview` for all tiers and both providers:

```typescript
// google-ai and vertex-ai share the same defaults
const tierModels = {
  low:    'gemini-3.1-flash-lite-preview',  // 1M-2M context, free
  medium: 'gemini-3.1-flash-lite-preview',  // 1M-2M context, free
  high:   'gemini-3.1-flash-lite-preview',  // 1M-2M context, free
};
```

Override per-tier via environment variables:

```bash
export OMP_MODEL_HIGH="gemini-3.1-pro-preview"
export OMP_MODEL_MEDIUM="gemini-3.1-flash-lite-preview"
export OMP_MODEL_LOW="gemini-3.1-flash-lite-preview"
```

Provider-specific overrides are also supported:

```bash
export OMP_GEMINI_MODEL_GOOGLE_AI_HIGH="gemini-2.5-pro"
export OMP_GEMINI_MODEL_VERTEX_AI_HIGH="gemini-2.5-pro"
```

### Retry with Exponential Backoff

The `GeminiApiClient` retries transient failures automatically. Retryable conditions
are HTTP 429 (rate limit) and 5xx (server error) responses.

```typescript
import { createGeminiApiClient } from 'oh-my-product/providers/api-client';

const client = createGeminiApiClient({
  retry: {
    maxRetries: 3,        // default: 3
    initialDelayMs: 1000, // default: 1000
    maxDelayMs: 30000,    // default: 30000
  },
});
```

Backoff formula: `min(initialDelayMs * 2^attempt + jitter, maxDelayMs)`.
When the server returns a `Retry-After` header, the client sleeps for the indicated
duration (clamped to `maxDelayMs`) instead of computing backoff.

### Model-Aware Request Timeouts

Request timeouts adapt to the model. Thinking models (IDs containing `thinking` or
`think`) default to 120 s; all others default to 30 s.

```typescript
const client = createGeminiApiClient({
  requestTimeoutMs: 60000,  // explicit override (highest priority)
});
```

Resolution order:
1. Explicit `requestTimeoutMs` passed to the client constructor
2. Environment variable `OMP_REQUEST_TIMEOUT_MS` (or `GEMINI_REQUEST_TIMEOUT_MS`)
3. Model-aware default (30 s standard / 120 s thinking)

### File Locking

State writes are protected by advisory file locks. Two API surfaces are available:

#### Filesystem Store (async, recommended for state operations)

```typescript
import { withFileLock, writeJsonFile } from 'oh-my-product/state/filesystem';

// High-level: writeJsonFile acquires a lock automatically
await writeJsonFile('/path/to/state.json', { phase: 'exec' });

// Low-level: explicit lock around custom logic
await withFileLock('/path/to/data.json', async () => {
  // ... read-modify-write under lock ...
});
```

#### Library File Lock (sync + async, for shared-memory coordination)

```typescript
import {
  withFileLockSync,
  withFileLock,
} from 'oh-my-product/lib/file-lock';

// Synchronous (for notepad and sync state operations)
const result = withFileLockSync('/path/to/file.lock', () => {
  return readAndUpdateSync();
}, { timeoutMs: 5000, staleLockMs: 30000 });

// Asynchronous
const result = await withFileLock('/path/to/file.lock', async () => {
  return await readAndUpdateAsync();
}, { timeoutMs: 5000, staleLockMs: 30000 });
```

Lock mechanics:
- Acquisition uses `O_CREAT|O_EXCL` (kernel-guaranteed atomicity)
- Lock payload contains the owning PID and timestamp
- Stale locks (older than `staleLockMs` and held by a dead PID) are automatically reaped
- Default stale threshold: 30 s, default retry interval: 50 ms

### Copy-Pasteable Configuration Example

Minimal `omp.config.ts` with all runtime-relevant settings:

```typescript
import type { OmpConfig } from 'oh-my-product/config/types';

const config: OmpConfig = {
  agents: {
    executor:  { model: 'gemini-3-flash' },
    architect: { model: 'gemini-3-pro' },
    explorer:  { model: 'gemini-3-flash-lite' },
  },
  features: {
    parallelExecution: true,
    continuationEnforcement: true,
    autoContextInjection: true,
    commandTemplates: true,
    runtimePlugins: false,
  },
  permissions: {
    allowBash: true,
    allowEdit: true,
    allowWrite: true,
    maxBackgroundTasks: 5,
  },
  routing: {
    enabled: true,
    defaultTier: 'MEDIUM',
    forceInherit: false,
    escalationEnabled: true,
    maxEscalations: 2,
    tierModels: {
      LOW: 'gemini-3.1-flash-lite-preview',
      MEDIUM: 'gemini-3.1-flash-lite-preview',
      HIGH: 'gemini-3.1-flash-lite-preview',
    },
    agentOverrides: {},
    escalationKeywords: ['complex', 'architect', 'security'],
    simplificationKeywords: ['simple', 'quick', 'trivial'],
  },
  providers: {
    gemini: {
      enabled: true,
      apiKeyEnvVar: 'GEMINI_API_KEY',
      defaultModel: 'gemini-3.1-flash-lite-preview',
    },
  },
  externalModels: {
    defaults: {
      codexModel: 'gpt-5.4',
      geminiModel: 'gemini-3.1-flash-lite-preview',
    },
    fallbackPolicy: {
      onModelFailure: 'gemini_only',
      allowCrossProvider: false,
      crossProviderOrder: ['gemini'],
    },
  },
};

export default config;
```

Environment-only quick start (no config file needed):

```bash
export GEMINI_API_KEY="your-key-here"
export OMP_MODEL_HIGH="gemini-3.1-flash-lite-preview"
export OMP_MODEL_MEDIUM="gemini-3.1-flash-lite-preview"
export OMP_MODEL_LOW="gemini-3.1-flash-lite-preview"
export OMP_REQUEST_TIMEOUT_MS=60000

omp setup --scope project
omp verify
```

## Notification System

oh-my-product supports webhook-based notifications to three platforms. All webhook URLs must use HTTPS.

### Slack

```typescript
import { sendSlackWebhook } from 'oh-my-product/notifications/webhook';

await sendSlackWebhook({
  webhookUrl: 'https://hooks.slack.com/services/...',
  text: 'Team run completed',
  username: 'omp-bot',          // optional
  channel: '#deployments',      // optional
  iconEmoji: ':rocket:',        // optional
  mention: '@channel',          // optional — prepended to message
  timeoutMs: 10000,             // optional (default: 10000)
});
```

URL validation enforces `hooks.slack.com` hostname.

### Discord

```typescript
import { sendDiscordWebhook } from 'oh-my-product/notifications/discord';

await sendDiscordWebhook({
  webhookUrl: 'https://discord.com/api/webhooks/...',
  message: 'Team run completed',
  username: 'omp-bot',      // optional
  avatarUrl: 'https://...',  // optional
  mention: '<@&role-id>',   // optional — prepended to message
  timeoutMs: 10000,         // optional
});
```

URL validation enforces `discord.com` or `discordapp.com` hostname and `/api/webhooks/` path.
Messages are automatically truncated to Discord's 2000-character limit.

### Telegram

```typescript
import { sendTelegramBotMessage } from 'oh-my-product/notifications/telegram';

await sendTelegramBotMessage({
  botToken: '123456:ABC-DEF...',
  chatId: '-1001234567890',
  message: 'Team run completed',
  parseMode: 'MarkdownV2',        // optional: 'Markdown' | 'MarkdownV2' | 'HTML'
  disableNotification: false,      // optional
  disableWebPagePreview: true,     // optional
  timeoutMs: 10000,                // optional
});
```

Bot token format is validated (`/^[0-9]+:[A-Za-z0-9_-]+$/`).
Chat ID must be a numeric string (negative for groups).

### Generic JSON Webhook

```typescript
import { sendJsonWebhook } from 'oh-my-product/notifications/webhook';

await sendJsonWebhook({
  url: 'https://example.com/webhook',
  payload: { event: 'team.completed', team: 'my-team' },
  method: 'POST',                     // optional: 'POST' | 'PUT'
  headers: { Authorization: '...' },   // optional
  timeoutMs: 10000,                    // optional
});
```

All webhook functions return `WebhookDeliveryResult`:

```typescript
interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  body?: string;
  error?: string;
}
```

## Team Orchestration API

### TeamOrchestrator

The core orchestration engine at `src/team/team-orchestrator.ts` manages the full team lifecycle.

```typescript
import { TeamOrchestrator } from 'oh-my-product/team/team-orchestrator';

const orchestrator = new TeamOrchestrator({
  stateStore?: TeamStateStore,               // Custom state store
  backends?: RuntimeBackendRegistry,         // Custom runtime backends
  treatRunningAsSuccess?: boolean,           // Legacy compat flag
  healthMonitorDefaults?: TeamHealthMonitorOptions,
});
```

#### `orchestrator.run(input)`

Runs the full lifecycle: plan -> exec -> verify -> fix (loop) -> completed/failed.

```typescript
const result = await orchestrator.run({
  teamName: 'my-team',
  task: 'Implement feature X',
  cwd: '/path/to/project',
  backend: 'tmux',             // optional (default: 'tmux')
  workers: 3,                  // optional (default: 3)
  maxFixAttempts: 3,           // optional (default: 3)
  watchdogMs: 90000,           // optional
  nonReportingMs: 180000,      // optional
  subagents: ['executor'],     // optional
  env: {},                     // optional — extra env vars
  metadata: {},                // optional
});
```

Returns `TeamRunResult`:

```typescript
interface TeamRunResult {
  success: boolean;
  status: 'completed' | 'failed';
  phase: TeamLifecyclePhase;       // 'plan' | 'exec' | 'verify' | 'fix' | 'completed' | 'failed'
  attempts: number;
  backend: RuntimeBackendName;
  handle?: TeamHandle;
  snapshot?: TeamSnapshot;
  error?: string;
  issues?: string[];
}
```

#### `orchestrator.shutdown(handle, force?)`

Shuts down a running team by its handle.

### TeamControlPlane

Located at `src/team/control-plane/index.ts`, this provides task and mailbox lifecycle management for coordinating workers.

```typescript
import { TeamControlPlane } from 'oh-my-product/team/control-plane';

const controlPlane = new TeamControlPlane({
  rootDir: '/path/to/.omp',   // optional
  cwd: '/path/to/project',    // optional
});
```

#### Task Operations

```typescript
// Claim a task for a worker (with lease)
const claim = await controlPlane.claimTask({
  teamName: 'my-team',
  taskId: 'task-1',
  worker: 'worker-1',
});

// Transition task status
await controlPlane.transitionTaskStatus({
  teamName: 'my-team',
  taskId: 'task-1',
  worker: 'worker-1',
  claimToken: claim.claimToken,
  toStatus: 'completed',
});

// Release a task claim
await controlPlane.releaseTaskClaim({
  teamName: 'my-team',
  taskId: 'task-1',
  worker: 'worker-1',
  claimToken: claim.claimToken,
});
```

#### Mailbox Operations

```typescript
// Send a message between workers
await controlPlane.sendMailboxMessage({
  teamName: 'my-team',
  fromWorker: 'worker-1',
  toWorker: 'worker-2',
  body: 'Task completed, ready for review',
});

// List messages for a worker
const messages = await controlPlane.listMailboxMessages({
  teamName: 'my-team',
  worker: 'worker-2',
});

// Mark as delivered/notified
await controlPlane.markMailboxMessageDelivered({ messageId: msg.messageId });
await controlPlane.markMailboxMessageNotified({ messageId: msg.messageId });
```

### Health Monitor

Located at `src/team/monitor.ts`, evaluates snapshot health for reliability hardening.

```typescript
import { evaluateTeamHealth } from 'oh-my-product/team/monitor';

const report = evaluateTeamHealth(snapshot, {
  now: new Date(),
  watchdogMs: 90000,        // Snapshot staleness threshold
  nonReportingMs: 180000,   // Worker heartbeat threshold
});

// report: TeamHealthReport
// {
//   healthy: boolean,
//   deadWorkers: string[],
//   nonReportingWorkers: string[],
//   watchdogExpired: boolean,
//   snapshotAgeMs?: number,
//   summary: string,
// }
```

## State Management

State is persisted to the filesystem under `.omp/state/` (relative to the git worktree root). The `TeamStateStore` class (`src/state/`) provides the persistence layer.

### State Directory Layout

```
.omp/state/
  {teamName}/
    phase-state.json          # Current lifecycle phase and transitions
    phase-transitions.json    # Append-only phase transition log
    monitor-snapshot.json     # Latest team snapshot
    tasks/                    # Per-task records
    task-audit.json           # Task claim/transition/release events
    mailbox/                  # Inter-worker messages
    workers/
      {workerName}/
        heartbeat.json        # Worker liveness signal
        status.json           # Worker state (idle/in_progress/blocked/failed)
        identity.json         # Worker metadata (role, pane ID)
        done-signal.json      # Terminal completion signal
  sessions/
    {sessionId}/              # Session-scoped state
```

### Key Persisted Types

#### Worker Heartbeat

```typescript
interface PersistedWorkerHeartbeat {
  teamName: string;
  workerName: string;
  alive: boolean;
  pid?: number;
  turnCount?: number;
  currentTaskId?: string;
  updatedAt: string;
}
```

#### Task Record

```typescript
interface PersistedTaskRecord {
  id: string;
  subject: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  required?: boolean;
  owner?: string;
  dependsOn?: string[];
  claim?: { owner: string; token: string; leasedUntil: string };
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

#### Worker Done Signal

```typescript
interface PersistedWorkerDoneSignal {
  teamName: string;
  workerName: string;
  status: 'completed' | 'failed';
  completedAt: string;
  summary?: string;
  error?: string;
  taskId?: string;
}
```

#### Phase State

```typescript
interface PersistedTeamPhaseState {
  teamName: string;
  runId: string;
  currentPhase: 'plan' | 'exec' | 'verify' | 'fix' | 'completed' | 'failed';
  maxFixAttempts: number;
  currentFixAttempt: number;
  transitions: PersistedPhaseTransitionEvent[];
  updatedAt: string;
  lastError?: string;
}
```
