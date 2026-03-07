import { promises as fs } from 'node:fs';
import path from 'node:path';

import { mergeMarkedBlockInFile } from './merge-markers.js';
import {
  persistSetupScope,
  readPersistedSetupScope,
  resolveSetupScope,
  type ScopeSource,
  type SetupScope,
} from './scopes.js';
import { createDefaultSubagentCatalog } from '../team/subagents-blueprint.js';

export type SetupActionStatus = 'created' | 'updated' | 'unchanged' | 'skipped';

export interface SetupAction {
  id:
    | 'persist-scope'
    | 'gemini-settings'
    | 'gemini-managed-note'
    | 'sandbox-dockerfile'
    | 'subagents-catalog';
  status: SetupActionStatus;
  path: string;
  message: string;
}

export interface SetupResult {
  scope: SetupScope;
  scopeSource: ScopeSource;
  changed: boolean;
  persistenceFilePath: string;
  actions: SetupAction[];
}

export interface SetupOptions {
  cwd?: string;
  scope?: SetupScope;
  dryRun?: boolean;
  now?: () => Date;
  fsImpl?: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir' | 'stat'>;
}

interface JsonWriteResult {
  status: SetupActionStatus;
  message: string;
}

const SETUP_ACTION_STATUS_ORDER: readonly SetupActionStatus[] = [
  'created',
  'updated',
  'unchanged',
  'skipped',
];

const GEMINI_SETTINGS_RELATIVE_PATH = path.join('.gemini', 'settings.json');
const GEMINI_GUIDE_RELATIVE_PATH = path.join('.gemini', 'GEMINI.md');
const SANDBOX_DOCKERFILE_RELATIVE_PATH = path.join('.gemini', 'sandbox.Dockerfile');
const SUBAGENTS_CATALOG_RELATIVE_PATH = path.join(
  '.gemini',
  'agents',
  'catalog.json',
);

const GEMINI_CLI_TOOLS_MCP_SERVER_NAME = 'omg_cli_tools';
const GEMINI_CLI_TOOLS_MCP_SERVER_CONFIG = {
  [GEMINI_CLI_TOOLS_MCP_SERVER_NAME]: {
    command: 'oh-my-gemini',
    args: ['tools', 'serve'],
    transport: 'stdio',
    description: 'oh-my-gemini CLI tools MCP server (file/git/http/process)',
  },
} as const;

const SANDBOX_DOCKERFILE_TEMPLATE = [
  '# syntax=docker/dockerfile:1.7',
  'FROM node:20-bookworm-slim',
  '',
  '# Core runtime dependencies for Gemini sandbox smoke checks',
  'RUN apt-get update \\',
  '    && apt-get install -y --no-install-recommends bash ca-certificates curl git tmux \\',
  '    && rm -rf /var/lib/apt/lists/*',
  '',
  '# Gemini CLI is installed at runtime in host environments too; this image is a baseline.',
  'RUN npm install -g @google/gemini-cli@latest',
  '',
  'WORKDIR /workspace',
  '',
  '# Default shell used by smoke scripts',
  'CMD [\"bash\"]',
].join('\n');

async function assertSetupDirectory(
  dirPath: string,
  label: string,
  fsImpl: Pick<typeof fs, 'stat'>,
): Promise<void> {
  try {
    const stats = await fsImpl.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(
        `Setup path conflict: expected ${label} directory at ${dirPath}. ` +
          'Remove or rename the existing file and re-run setup.',
      );
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function readJsonFile(
  filePath: string,
  fsImpl: Pick<typeof fs, 'readFile'>,
): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await fsImpl.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object');
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return undefined;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON at ${filePath}: ${error.message}`);
    }

    throw error;
  }
}

async function ensureGeminiSettings(
  filePath: string,
  options: {
    fsImpl: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
    dryRun: boolean;
  },
): Promise<JsonWriteResult> {
  const existing = await readJsonFile(filePath, options.fsImpl);
  const next: Record<string, unknown> = existing ? structuredClone(existing) : {};

  const tools =
    next.tools && typeof next.tools === 'object' && !Array.isArray(next.tools)
      ? (next.tools as Record<string, unknown>)
      : {};

  if (typeof tools.sandbox !== 'string' || tools.sandbox.trim() === '') {
    tools.sandbox = 'docker';
  }

  next.tools = tools;

  const existingMcpServers =
    next.mcpServers && typeof next.mcpServers === 'object' && !Array.isArray(next.mcpServers)
      ? (next.mcpServers as Record<string, unknown>)
      : {};

  next.mcpServers = {
    ...existingMcpServers,
    ...GEMINI_CLI_TOOLS_MCP_SERVER_CONFIG,
  };

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const previousSerialized = existing ? `${JSON.stringify(existing, null, 2)}\n` : '';

  if (serialized === previousSerialized) {
    return {
      status: 'unchanged',
      message: 'sandbox baseline already configured',
    };
  }

  const writeStatus: 'created' | 'updated' = existing ? 'updated' : 'created';

  if (options.dryRun) {
    return {
      status: 'skipped',
      message: `dry-run: would ${writeStatus} settings to configure tools.sandbox=docker`,
    };
  }

  await options.fsImpl.mkdir(path.dirname(filePath), { recursive: true });
  await options.fsImpl.writeFile(filePath, serialized, 'utf8');

  return {
    status: writeStatus,
    message: 'configured tools.sandbox to docker when absent',
  };
}

async function ensureManagedGeminiNote(
  filePath: string,
  scope: SetupScope,
  options: {
    fsImpl: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
    dryRun: boolean;
  },
): Promise<JsonWriteResult> {
  const managedLines = [
    'This section is managed by oh-my-gemini setup.',
    '',
    `- Active setup scope: ${scope}`,
    '- Scope precedence: CLI flag > persisted (.omg/setup-scope.json) > default (project)',
    '- Run `oh-my-gemini doctor` (alias: `omg doctor`) after setup to validate dependencies.',
    '- Run `oh-my-gemini verify` (alias: `omg verify`) to execute typecheck/smoke/integration/reliability checks.',
  ];

  const result = await mergeMarkedBlockInFile(filePath, managedLines, {
    fsImpl: options.fsImpl,
    dryRun: options.dryRun,
  });

  if (!result.changed) {
    return {
      status: 'unchanged',
      message: 'managed setup guidance already up-to-date',
    };
  }

  const writeStatus: 'created' | 'updated' = result.hadMarkerSection ? 'updated' : 'created';

  if (options.dryRun) {
    return {
      status: 'skipped',
      message:
        writeStatus === 'updated'
          ? 'dry-run: would refresh managed setup guidance section'
          : 'dry-run: would add managed setup guidance section',
    };
  }

  return {
    status: writeStatus,
    message:
      writeStatus === 'updated'
        ? 'refreshed managed setup guidance section'
        : 'added managed setup guidance section',
  };
}

async function ensureSandboxDockerfile(
  filePath: string,
  options: {
    fsImpl: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
    dryRun: boolean;
  },
): Promise<JsonWriteResult> {
  try {
    await options.fsImpl.readFile(filePath, 'utf8');
    return {
      status: 'unchanged',
      message: 'sandbox Dockerfile already exists',
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to read sandbox Dockerfile at ${filePath}: ${err.message}`);
    }
  }

  if (!options.dryRun) {
    await options.fsImpl.mkdir(path.dirname(filePath), { recursive: true });
    await options.fsImpl.writeFile(filePath, `${SANDBOX_DOCKERFILE_TEMPLATE}\n`, 'utf8');
    return {
      status: 'created',
      message: 'created sandbox baseline Dockerfile template',
    };
  }

  return {
    status: 'skipped',
    message: 'dry-run: would create sandbox baseline Dockerfile template',
  };
}

async function ensureSubagentsCatalog(
  filePath: string,
  options: {
    fsImpl: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
    dryRun: boolean;
  },
): Promise<JsonWriteResult> {
  try {
    await options.fsImpl.readFile(filePath, 'utf8');
    return {
      status: 'unchanged',
      message: 'subagents catalog already exists',
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to read subagents catalog at ${filePath}: ${err.message}`);
    }
  }

  if (options.dryRun) {
    return {
      status: 'skipped',
      message: 'dry-run: would create default subagents catalog',
    };
  }

  await options.fsImpl.mkdir(path.dirname(filePath), { recursive: true });
  await options.fsImpl.writeFile(
    filePath,
    `${JSON.stringify(createDefaultSubagentCatalog(), null, 2)}\n`,
    'utf8',
  );

  return {
    status: 'created',
    message:
      'created default subagents catalog from oh-my-claudecode-inspired team roles',
  };
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const fsImpl = options.fsImpl ?? fs;
  const dryRun = options.dryRun ?? false;

  await assertSetupDirectory(path.join(cwd, '.omg'), 'setup state (.omg)', fsImpl);
  await assertSetupDirectory(path.join(cwd, '.gemini'), 'Gemini config (.gemini)', fsImpl);
  await assertSetupDirectory(
    path.join(cwd, '.gemini', 'agents'),
    'Gemini subagents catalog (.gemini/agents)',
    fsImpl,
  );

  const resolvedScope = await resolveSetupScope({
    cwd,
    cliScope: options.scope,
    fsImpl,
  });

  const persistedBefore = await readPersistedSetupScope(cwd, fsImpl);
  let persistScopeAction: SetupAction;

  if (persistedBefore === resolvedScope.scope) {
    persistScopeAction = {
      id: 'persist-scope',
      status: 'unchanged',
      path: resolvedScope.persistenceFilePath,
      message: 'persisted setup scope already matches resolved scope',
    };
  } else {
    const persistStatus: 'created' | 'updated' = persistedBefore ? 'updated' : 'created';

    if (!dryRun) {
      await persistSetupScope(resolvedScope.scope, {
        cwd,
        now,
        fsImpl,
      });
    }

    persistScopeAction = {
      id: 'persist-scope',
      status: dryRun ? 'skipped' : persistStatus,
      path: resolvedScope.persistenceFilePath,
      message: dryRun
        ? `dry-run: would persist setup scope as ${resolvedScope.scope}`
        : `persisted setup scope as ${resolvedScope.scope}`,
    };
  }

  const geminiSettingsPath = path.join(cwd, GEMINI_SETTINGS_RELATIVE_PATH);
  const geminiSettingsResult = await ensureGeminiSettings(geminiSettingsPath, {
    fsImpl,
    dryRun,
  });

  const geminiGuidePath = path.join(cwd, GEMINI_GUIDE_RELATIVE_PATH);
  const geminiGuideResult = await ensureManagedGeminiNote(geminiGuidePath, resolvedScope.scope, {
    fsImpl,
    dryRun,
  });

  const sandboxDockerfilePath = path.join(cwd, SANDBOX_DOCKERFILE_RELATIVE_PATH);
  const sandboxDockerfileResult = await ensureSandboxDockerfile(sandboxDockerfilePath, {
    fsImpl,
    dryRun,
  });

  const subagentsCatalogPath = path.join(cwd, SUBAGENTS_CATALOG_RELATIVE_PATH);
  const subagentsCatalogResult = await ensureSubagentsCatalog(subagentsCatalogPath, {
    fsImpl,
    dryRun,
  });

  const actions: SetupAction[] = [
    persistScopeAction,
    {
      id: 'gemini-settings',
      status: geminiSettingsResult.status,
      path: geminiSettingsPath,
      message: geminiSettingsResult.message,
    },
    {
      id: 'gemini-managed-note',
      status: geminiGuideResult.status,
      path: geminiGuidePath,
      message: geminiGuideResult.message,
    },
    {
      id: 'sandbox-dockerfile',
      status: sandboxDockerfileResult.status,
      path: sandboxDockerfilePath,
      message: sandboxDockerfileResult.message,
    },
    {
      id: 'subagents-catalog',
      status: subagentsCatalogResult.status,
      path: subagentsCatalogPath,
      message: subagentsCatalogResult.message,
    },
  ];

  const changed = actions.some((action) => action.status === 'created' || action.status === 'updated');

  return {
    scope: resolvedScope.scope,
    scopeSource: resolvedScope.source,
    changed,
    persistenceFilePath: resolvedScope.persistenceFilePath,
    actions,
  };
}

export function formatSetupResult(result: SetupResult): string {
  const statusCounts: Record<SetupActionStatus, number> = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
  };

  for (const action of result.actions) {
    statusCounts[action.status] += 1;
  }

  const header = [
    `Setup scope: ${result.scope} (source: ${result.scopeSource})`,
    `Persistence file: ${result.persistenceFilePath}`,
    `Changes applied: ${result.changed ? 'yes' : 'no'}`,
    `Action statuses: ${SETUP_ACTION_STATUS_ORDER.map(
      (status) => `${status}=${statusCounts[status]}`,
    ).join(', ')}`,
  ];

  const actionLines = result.actions.map(
    (action) => `- [${action.status}] ${action.id}: ${action.path} (${action.message})`,
  );

  return [...header, '', ...actionLines].join('\n');
}
