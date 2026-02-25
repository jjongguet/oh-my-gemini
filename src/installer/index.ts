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

export type SetupActionStatus = 'created' | 'updated' | 'unchanged' | 'skipped';

export interface SetupAction {
  id:
    | 'persist-scope'
    | 'gemini-settings'
    | 'gemini-managed-note'
    | 'sandbox-dockerfile';
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
  fsImpl?: Pick<typeof fs, 'readFile' | 'writeFile' | 'mkdir'>;
}

interface JsonWriteResult {
  status: SetupActionStatus;
  message: string;
}

const GEMINI_SETTINGS_RELATIVE_PATH = path.join('.gemini', 'settings.json');
const GEMINI_GUIDE_RELATIVE_PATH = path.join('.gemini', 'GEMINI.md');
const SANDBOX_DOCKERFILE_RELATIVE_PATH = path.join('.gemini', 'sandbox.Dockerfile');

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

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const previousSerialized = existing ? `${JSON.stringify(existing, null, 2)}\n` : '';

  if (serialized === previousSerialized) {
    return {
      status: 'unchanged',
      message: 'sandbox baseline already configured',
    };
  }

  if (!options.dryRun) {
    await options.fsImpl.mkdir(path.dirname(filePath), { recursive: true });
    await options.fsImpl.writeFile(filePath, serialized, 'utf8');
  }

  return {
    status: existing ? 'updated' : 'created',
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
    '- Run `pnpm omg doctor` after setup to validate dependencies.',
    '- Run `pnpm omg verify` to execute smoke/integration checks.',
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

  return {
    status: result.hadMarkerSection ? 'updated' : 'created',
    message: result.hadMarkerSection
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
  }

  return {
    status: 'created',
    message: 'created sandbox baseline Dockerfile template',
  };
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const fsImpl = options.fsImpl ?? fs;
  const dryRun = options.dryRun ?? false;

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
    if (!dryRun) {
      await persistSetupScope(resolvedScope.scope, {
        cwd,
        now,
        fsImpl,
      });
    }

    persistScopeAction = {
      id: 'persist-scope',
      status: persistedBefore ? 'updated' : 'created',
      path: resolvedScope.persistenceFilePath,
      message: `persisted setup scope as ${resolvedScope.scope}`,
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
  const header = [
    `Setup scope: ${result.scope} (source: ${result.scopeSource})`,
    `Persistence file: ${result.persistenceFilePath}`,
    `Changes applied: ${result.changed ? 'yes' : 'no'}`,
  ];

  const actionLines = result.actions.map(
    (action) => `- [${action.status}] ${action.id}: ${action.path} (${action.message})`,
  );

  return [...header, '', ...actionLines].join('\n');
}
