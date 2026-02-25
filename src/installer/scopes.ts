import { promises as fs } from 'node:fs';
import path from 'node:path';

export type SetupScope = 'project' | 'user';

export const DEFAULT_SETUP_SCOPE: SetupScope = 'project';
export const SETUP_SCOPE_FILE_RELATIVE_PATH = path.join('.omg', 'setup-scope.json');

export interface PersistedSetupScope {
  version: 1;
  scope: SetupScope;
  updatedAt: string;
}

export type ScopeSource = 'cli' | 'persisted' | 'default';

export interface ScopeResolverOptions {
  cwd?: string;
  cliScope?: SetupScope;
  fsImpl?: Pick<typeof fs, 'readFile'>;
}

export interface ResolveSetupScopeResult {
  scope: SetupScope;
  source: ScopeSource;
  persistenceFilePath: string;
}

export interface PersistScopeOptions {
  cwd?: string;
  now?: () => Date;
  fsImpl?: Pick<typeof fs, 'mkdir' | 'writeFile'>;
}

export function isSetupScope(value: unknown): value is SetupScope {
  return value === 'project' || value === 'user';
}

export function getSetupScopeFilePath(cwd: string = process.cwd()): string {
  return path.join(cwd, SETUP_SCOPE_FILE_RELATIVE_PATH);
}

export async function readPersistedSetupScope(
  cwd: string = process.cwd(),
  fsImpl: Pick<typeof fs, 'readFile'> = fs,
): Promise<SetupScope | undefined> {
  const scopeFilePath = getSetupScopeFilePath(cwd);

  try {
    const raw = await fsImpl.readFile(scopeFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedSetupScope>;

    if (!isSetupScope(parsed.scope)) {
      return undefined;
    }

    return parsed.scope;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return undefined;
    }

    throw new Error(`Failed to read persisted setup scope at ${scopeFilePath}: ${err.message}`);
  }
}

export async function resolveSetupScope(options: ScopeResolverOptions = {}): Promise<ResolveSetupScopeResult> {
  const cwd = options.cwd ?? process.cwd();
  const fsImpl = options.fsImpl ?? fs;
  const persistenceFilePath = getSetupScopeFilePath(cwd);

  if (options.cliScope) {
    return {
      scope: options.cliScope,
      source: 'cli',
      persistenceFilePath,
    };
  }

  const persisted = await readPersistedSetupScope(cwd, fsImpl);
  if (persisted) {
    return {
      scope: persisted,
      source: 'persisted',
      persistenceFilePath,
    };
  }

  return {
    scope: DEFAULT_SETUP_SCOPE,
    source: 'default',
    persistenceFilePath,
  };
}

export async function persistSetupScope(
  scope: SetupScope,
  options: PersistScopeOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const fsImpl = options.fsImpl ?? fs;
  const scopeFilePath = getSetupScopeFilePath(cwd);

  const payload: PersistedSetupScope = {
    version: 1,
    scope,
    updatedAt: now().toISOString(),
  };

  await fsImpl.mkdir(path.dirname(scopeFilePath), { recursive: true });
  await fsImpl.writeFile(scopeFilePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  return scopeFilePath;
}
