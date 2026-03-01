import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_SETUP_SCOPE,
  getSetupScopeFilePath,
  isSetupScope,
  persistSetupScope,
} from '../../installer/scopes.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
  readBooleanOption,
} from './arg-utils.js';
import {
  OMG_EXTENSION_PATH_ENV,
  resolveExtensionPath,
  type ExtensionPathSource,
} from './extension-path.js';

export type DoctorCheckStatus = 'ok' | 'missing';

export interface DoctorCheckResult {
  code: string;
  name: string;
  required: boolean;
  status: DoctorCheckStatus;
  details: string;
  hint?: string;
  fixable?: boolean;
}

export interface DoctorFixResult {
  code: string;
  name: string;
  applied: boolean;
  status: 'applied' | 'failed';
  details: string;
  error?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheckResult[];
  fixes: DoctorFixResult[];
  extension: {
    source: ExtensionPathSource | 'unresolved';
    path: string | null;
    manifestPath: string | null;
    details?: string;
  };
}

export interface DoctorCommandContext {
  io: CliIo;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  probeCommand?: (command: string, cwd: string) => Promise<boolean>;
  probeContainerRuntime?: (command: 'docker' | 'podman', cwd: string) => Promise<boolean>;
}

const DOCTOR_CODE = {
  NODE: 'DOC_NODE_MISSING',
  NPM: 'DOC_NPM_MISSING',
  GEMINI: 'DOC_GEMINI_MISSING',
  TMUX: 'DOC_TMUX_MISSING',
  CONTAINER: 'DOC_CONTAINER_RUNTIME_UNHEALTHY',
  SETUP_SCOPE: 'DOC_SETUP_SCOPE_INVALID',
  EXTENSION_MANIFEST: 'DOC_EXTENSION_MANIFEST',
  EXTENSION_COMMANDS: 'DOC_EXTENSION_COMMANDS',
  EXTENSION_SKILLS: 'DOC_EXTENSION_SKILLS',
  STATE_WRITE: 'DOC_STATE_WRITEABILITY',
} as const;

function printDoctorHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg doctor [--json] [--strict|--no-strict] [--fix] [--extension-path <path>]',
    '',
    'Options:',
    '  --json         Print machine-readable report',
    '  --strict       Return non-zero when required dependency/check is missing (default)',
    '  --no-strict    Always return exit code 0 and print report only',
    '  --fix          Apply safe automatic fixes for supported checks and rerun diagnostics',
    '  --extension-path <path>   Explicit extension root path override',
    `  $${OMG_EXTENSION_PATH_ENV}           Environment extension root override`,
    '  --help         Show command help',
  ].join('\n'));
}

async function defaultProbeCommand(command: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-lc', `command -v ${command}`], {
      cwd,
      stdio: 'ignore',
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function defaultProbeContainerRuntime(command: 'docker' | 'podman', cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ['info'], {
      cwd,
      stdio: 'ignore',
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

function formatPathForDoctor(cwd: string, absolutePath: string): string {
  const relativePath = path.relative(cwd, absolutePath);
  if (!relativePath || relativePath.startsWith('..')) {
    return absolutePath;
  }
  return relativePath;
}

async function checkSetupScopeValidity(cwd: string): Promise<DoctorCheckResult> {
  const scopePath = getSetupScopeFilePath(cwd);

  try {
    const raw = await fs.readFile(scopePath, 'utf8');
    const parsed = JSON.parse(raw) as { scope?: unknown };

    if (!isSetupScope(parsed.scope)) {
      return {
        code: DOCTOR_CODE.SETUP_SCOPE,
        name: 'setup-scope',
        required: true,
        status: 'missing',
        details: `invalid scope payload at ${scopePath}`,
        hint: 'Run `omg doctor --fix` to rewrite this file with a valid managed scope.',
        fixable: true,
      };
    }

    return {
      code: 'DOC_SETUP_SCOPE_VALID',
      name: 'setup-scope',
      required: true,
      status: 'ok',
      details: `valid persisted scope (${parsed.scope}) at ${scopePath}`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return {
        code: 'DOC_SETUP_SCOPE_ABSENT',
        name: 'setup-scope',
        required: true,
        status: 'ok',
        details: `scope file not present (${scopePath}); default scope will apply`,
      };
    }

    if (error instanceof SyntaxError) {
      return {
        code: DOCTOR_CODE.SETUP_SCOPE,
        name: 'setup-scope',
        required: true,
        status: 'missing',
        details: `invalid JSON at ${scopePath}: ${error.message}`,
        hint: 'Run `omg doctor --fix` to rewrite this file with a valid managed scope.',
        fixable: true,
      };
    }

    return {
      code: DOCTOR_CODE.SETUP_SCOPE,
      name: 'setup-scope',
      required: true,
      status: 'missing',
      details: `failed to read ${scopePath}: ${(error as Error).message}`,
      hint: 'Fix file permissions and rerun doctor.',
      fixable: false,
    };
  }
}

async function checkExtensionIntegrity(
  cwd: string,
  options: {
    extensionPathOverride?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<{
  checks: DoctorCheckResult[];
  resolution: DoctorReport['extension'];
}> {
  let resolved: Awaited<ReturnType<typeof resolveExtensionPath>>;

  try {
    resolved = await resolveExtensionPath({
      cwd,
      env: options.env,
      overridePath: options.extensionPathOverride,
    });
  } catch (error) {
    const details = (error as Error).message;
    return {
      resolution: {
        source: 'unresolved',
        path: null,
        manifestPath: null,
        details,
      },
      checks: [
        {
          code: DOCTOR_CODE.EXTENSION_MANIFEST,
          name: 'extension-manifest',
          required: true,
          status: 'missing',
          details: `unable to resolve extension path: ${details}`,
          hint: `Set ${OMG_EXTENSION_PATH_ENV}=<path> or run doctor from a repository containing extensions/oh-my-gemini.`,
        },
        {
          code: DOCTOR_CODE.EXTENSION_COMMANDS,
          name: 'extension-commands',
          required: true,
          status: 'missing',
          details: 'extension manifest unavailable; cannot validate command prompt files',
          hint: 'Restore extension manifest first, then rerun doctor.',
        },
        {
          code: DOCTOR_CODE.EXTENSION_SKILLS,
          name: 'extension-skills',
          required: true,
          status: 'missing',
          details: 'extension manifest unavailable; cannot validate skill files',
          hint: 'Restore extension manifest first, then rerun doctor.',
        },
      ],
    };
  }

  const extensionRoot = resolved.path;
  const manifestPath = resolved.manifestPath;
  const resolution: DoctorReport['extension'] = {
    source: resolved.source,
    path: extensionRoot,
    manifestPath,
  };

  let manifest: { contextFileName?: unknown };

  try {
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(manifestRaw) as { contextFileName?: unknown };
  } catch (error) {
    return {
      resolution: {
        ...resolution,
        details: `failed to read extension manifest: ${(error as Error).message}`,
      },
      checks: [
        {
          code: DOCTOR_CODE.EXTENSION_MANIFEST,
          name: 'extension-manifest',
          required: true,
          status: 'missing',
          details: `failed to read extension manifest: ${(error as Error).message}`,
          hint: 'Repair extension manifest JSON and rerun doctor.',
        },
        {
          code: DOCTOR_CODE.EXTENSION_COMMANDS,
          name: 'extension-commands',
          required: true,
          status: 'missing',
          details: 'extension manifest unavailable; cannot validate command prompt files',
          hint: 'Restore extension manifest first, then rerun doctor.',
        },
        {
          code: DOCTOR_CODE.EXTENSION_SKILLS,
          name: 'extension-skills',
          required: true,
          status: 'missing',
          details: 'extension manifest unavailable; cannot validate skill files',
          hint: 'Restore extension manifest first, then rerun doctor.',
        },
      ],
    };
  }

  const contextFileName =
    typeof manifest.contextFileName === 'string' && manifest.contextFileName.trim()
      ? manifest.contextFileName
      : 'GEMINI.md';

  const contextPath = path.join(extensionRoot, contextFileName);
  const manifestCheck: DoctorCheckResult = {
    code: 'DOC_EXTENSION_MANIFEST_OK',
    name: 'extension-manifest',
    required: true,
    status: 'ok',
    details: `extension manifest present: ${formatPathForDoctor(cwd, manifestPath)} (source: ${resolved.source})`,
  };

  try {
    await fs.access(contextPath);
  } catch {
    manifestCheck.code = DOCTOR_CODE.EXTENSION_MANIFEST;
    manifestCheck.status = 'missing';
    manifestCheck.details = `missing extension context file: ${formatPathForDoctor(cwd, contextPath)}`;
    manifestCheck.hint = 'Restore extension context file and rerun doctor.';
  }

  const commandFiles = [
    path.join(extensionRoot, 'commands', 'setup.toml'),
    path.join(extensionRoot, 'commands', 'doctor.toml'),
    path.join(extensionRoot, 'commands', 'team', 'run.toml'),
    path.join(extensionRoot, 'commands', 'team', 'live.toml'),
    path.join(extensionRoot, 'commands', 'team', 'subagents.toml'),
    path.join(extensionRoot, 'commands', 'team', 'verify.toml'),
  ];
  const skillFiles = [
    path.join(extensionRoot, 'skills', 'plan', 'SKILL.md'),
  ];

  const missingCommands: string[] = [];
  await Promise.all(
    commandFiles.map(async (filePath) => {
      try {
        await fs.access(filePath);
      } catch {
        missingCommands.push(formatPathForDoctor(cwd, filePath));
      }
    }),
  );

  const missingSkills: string[] = [];
  await Promise.all(
    skillFiles.map(async (filePath) => {
      try {
        await fs.access(filePath);
      } catch {
        missingSkills.push(formatPathForDoctor(cwd, filePath));
      }
    }),
  );

  const commandsCheck: DoctorCheckResult = missingCommands.length > 0
    ? {
        code: DOCTOR_CODE.EXTENSION_COMMANDS,
        name: 'extension-commands',
        required: true,
        status: 'missing',
        details: `missing extension command files: ${missingCommands.join(', ')}`,
        hint: 'Restore missing extension command prompt files.',
      }
    : {
        code: 'DOC_EXTENSION_COMMANDS_OK',
        name: 'extension-commands',
        required: true,
        status: 'ok',
        details: 'required extension command prompt files are present',
      };

  const skillsCheck: DoctorCheckResult = missingSkills.length > 0
    ? {
        code: DOCTOR_CODE.EXTENSION_SKILLS,
        name: 'extension-skills',
        required: true,
        status: 'missing',
        details: `missing extension skill files: ${missingSkills.join(', ')}`,
        hint: 'Restore missing extension skill files.',
      }
    : {
        code: 'DOC_EXTENSION_SKILLS_OK',
        name: 'extension-skills',
        required: true,
        status: 'ok',
        details: 'required extension skill files are present',
      };

  return {
    checks: [manifestCheck, commandsCheck, skillsCheck],
    resolution,
  };
}

async function checkStateWriteability(cwd: string): Promise<DoctorCheckResult> {
  const stateDir = path.join(cwd, '.omg', 'state');

  try {
    await fs.access(stateDir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return {
        code: DOCTOR_CODE.STATE_WRITE,
        name: 'omg-state-writeability',
        required: true,
        status: 'missing',
        details: `state directory is missing: ${stateDir}`,
        hint: 'Run `omg doctor --fix` to create the managed state directory.',
        fixable: true,
      };
    }

    return {
      code: DOCTOR_CODE.STATE_WRITE,
      name: 'omg-state-writeability',
      required: true,
      status: 'missing',
      details: `cannot access ${stateDir}: ${(error as Error).message}`,
      hint: 'Run `omg doctor --fix` or adjust filesystem permissions.',
      fixable: true,
    };
  }

  try {
    const probePath = path.join(
      stateDir,
      `.doctor-writeability-${process.pid}-${Date.now()}.tmp`,
    );
    await fs.writeFile(probePath, 'ok\n', 'utf8');
    await fs.rm(probePath, { force: true });

    return {
      code: 'DOC_STATE_WRITEABILITY_OK',
      name: 'omg-state-writeability',
      required: true,
      status: 'ok',
      details: `state path writable: ${stateDir}`,
    };
  } catch (error) {
    return {
      code: DOCTOR_CODE.STATE_WRITE,
      name: 'omg-state-writeability',
      required: true,
      status: 'missing',
      details: `cannot write to ${stateDir}: ${(error as Error).message}`,
      hint: 'Run `omg doctor --fix` to create the directory, then adjust permissions if needed.',
      fixable: true,
    };
  }
}

async function runDoctorChecks(
  cwd: string,
  probe: (command: string, cwd: string) => Promise<boolean>,
  probeContainerRuntime: (command: 'docker' | 'podman', cwd: string) => Promise<boolean>,
  options: {
    extensionPathOverride?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<DoctorReport> {
  const [
    hasNode,
    hasNpm,
    hasGemini,
    hasTmux,
    hasDocker,
    hasPodman,
  ] = await Promise.all([
    probe('node', cwd),
    probe('npm', cwd),
    probe('gemini', cwd),
    probe('tmux', cwd),
    probe('docker', cwd),
    probe('podman', cwd),
  ]);

  const [dockerReady, podmanReady] = await Promise.all([
    hasDocker ? probeContainerRuntime('docker', cwd) : Promise.resolve(false),
    hasPodman ? probeContainerRuntime('podman', cwd) : Promise.resolve(false),
  ]);

  const availableRuntimes = [
    hasDocker ? (dockerReady ? 'docker(daemon:ok)' : 'docker(daemon:down)') : '',
    hasPodman ? (podmanReady ? 'podman(daemon:ok)' : 'podman(daemon:down)') : '',
  ].filter(Boolean);

  const hasHealthyContainerRuntime = dockerReady || podmanReady;

  const staticChecks: DoctorCheckResult[] = [
    {
      code: hasNode ? 'DOC_NODE_OK' : DOCTOR_CODE.NODE,
      name: 'node',
      required: true,
      status: hasNode ? 'ok' : 'missing',
      details: hasNode ? 'node command found' : 'node command not found in PATH',
      hint: 'Install Node.js 20+ and ensure it is in PATH.',
    },
    {
      code: hasNpm ? 'DOC_NPM_OK' : DOCTOR_CODE.NPM,
      name: 'npm',
      required: true,
      status: hasNpm ? 'ok' : 'missing',
      details: hasNpm ? 'npm command found' : 'npm command not found in PATH',
      hint: 'Install npm (bundled with Node.js) and ensure it is in PATH.',
    },
    {
      code: hasGemini ? 'DOC_GEMINI_OK' : DOCTOR_CODE.GEMINI,
      name: 'gemini-cli',
      required: true,
      status: hasGemini ? 'ok' : 'missing',
      details: hasGemini ? 'gemini command found' : 'gemini command not found in PATH',
      hint: 'Install: npm i -g @google/gemini-cli',
    },
    {
      code: hasTmux ? 'DOC_TMUX_OK' : DOCTOR_CODE.TMUX,
      name: 'tmux',
      required: true,
      status: hasTmux ? 'ok' : 'missing',
      details: hasTmux ? 'tmux command found' : 'tmux command not found in PATH',
      hint: 'Install: brew install tmux (macOS) or apt/yum equivalent.',
    },
    {
      code: hasHealthyContainerRuntime ? 'DOC_CONTAINER_RUNTIME_OK' : DOCTOR_CODE.CONTAINER,
      name: 'container-runtime',
      required: true,
      status: hasHealthyContainerRuntime ? 'ok' : 'missing',
      details:
        availableRuntimes.length > 0
          ? `runtime(s): ${availableRuntimes.join(', ')}`
          : 'Neither docker nor podman found in PATH',
      hint:
        availableRuntimes.length > 0
          ? 'Start Docker Desktop or Podman machine, then rerun `omg doctor`.'
          : 'Install Docker Desktop or Podman for sandbox support.',
    },
  ];

  const [setupScopeCheck, extensionResult, stateWriteCheck] = await Promise.all([
    checkSetupScopeValidity(cwd),
    checkExtensionIntegrity(cwd, {
      extensionPathOverride: options.extensionPathOverride,
      env: options.env,
    }),
    checkStateWriteability(cwd),
  ]);

  const checks = [
    ...staticChecks,
    setupScopeCheck,
    ...extensionResult.checks,
    stateWriteCheck,
  ];

  return {
    ok: checks.every((check) => check.status === 'ok' || !check.required),
    checks,
    fixes: [],
    extension: extensionResult.resolution,
  };
}

async function applyDoctorFixes(
  cwd: string,
  checks: DoctorCheckResult[],
): Promise<DoctorFixResult[]> {
  const fixes: DoctorFixResult[] = [];

  for (const check of checks) {
    if (check.status === 'ok' || !check.fixable) {
      continue;
    }

    if (check.code === DOCTOR_CODE.SETUP_SCOPE) {
      try {
        const targetPath = await persistSetupScope(DEFAULT_SETUP_SCOPE, { cwd });
        fixes.push({
          code: check.code,
          name: check.name,
          applied: true,
          status: 'applied',
          details: `rewrote setup scope file with default scope (${DEFAULT_SETUP_SCOPE}) at ${targetPath}`,
        });
      } catch (error) {
        fixes.push({
          code: check.code,
          name: check.name,
          applied: false,
          status: 'failed',
          details: 'failed to rewrite setup scope file',
          error: (error as Error).message,
        });
      }
      continue;
    }

    if (check.code === DOCTOR_CODE.STATE_WRITE) {
      try {
        const stateDir = path.join(cwd, '.omg', 'state');
        await fs.mkdir(stateDir, { recursive: true });
        fixes.push({
          code: check.code,
          name: check.name,
          applied: true,
          status: 'applied',
          details: `ensured state directory exists: ${stateDir}`,
        });
      } catch (error) {
        fixes.push({
          code: check.code,
          name: check.name,
          applied: false,
          status: 'failed',
          details: 'failed to create .omg/state directory',
          error: (error as Error).message,
        });
      }
    }
  }

  return fixes;
}

function formatDoctorReport(report: DoctorReport): string {
  const lines = ['Doctor report:', ''];

  lines.push(
    `Extension resolution: source=${report.extension.source}, path=${report.extension.path ?? 'unresolved'}`,
  );
  if (report.extension.details) {
    lines.push(`  details: ${report.extension.details}`);
  }
  lines.push('');

  for (const check of report.checks) {
    const label = check.status === 'ok' ? 'OK' : 'MISSING';
    lines.push(`- [${label}] ${check.name} (${check.code}): ${check.details}`);

    if (check.status === 'missing' && check.hint) {
      lines.push(`  hint: ${check.hint}`);
    }
  }

  if (report.fixes.length > 0) {
    lines.push('', 'Fix actions:');
    for (const fix of report.fixes) {
      lines.push(
        `- [${fix.status.toUpperCase()}] ${fix.name} (${fix.code}): ${fix.details}${fix.error ? ` (${fix.error})` : ''}`,
      );
    }
  }

  lines.push('', `Overall: ${report.ok ? 'healthy' : 'issues detected'}`);

  return lines.join('\n');
}

export async function executeDoctorCommand(
  argv: string[],
  context: DoctorCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printDoctorHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'help',
    'h',
    'json',
    'strict',
    'fix',
    'extension-path',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printDoctorHelp(io);
    return { exitCode: 2 };
  }

  const jsonOutput = hasFlag(parsed.options, ['json']);
  const strict = readBooleanOption(parsed.options, ['strict'], true);
  const fix = hasFlag(parsed.options, ['fix']);
  if (parsed.options.get('extension-path') === true) {
    io.stderr('--extension-path requires a value');
    printDoctorHelp(io);
    return { exitCode: 2 };
  }
  const extensionPathOverride = getStringOption(parsed.options, ['extension-path']);
  const probe = context.probeCommand ?? defaultProbeCommand;
  const probeContainerRuntime =
    context.probeContainerRuntime ?? defaultProbeContainerRuntime;
  const env = context.env ?? process.env;

  let report = await runDoctorChecks(
    context.cwd,
    probe,
    probeContainerRuntime,
    {
      extensionPathOverride,
      env,
    },
  );

  if (fix) {
    const fixes = await applyDoctorFixes(context.cwd, report.checks);
    const rerun = await runDoctorChecks(
      context.cwd,
      probe,
      probeContainerRuntime,
      {
        extensionPathOverride,
        env,
      },
    );
    report = {
      ...rerun,
      fixes,
    };
  }

  if (jsonOutput) {
    io.stdout(JSON.stringify(report, null, 2));
  } else {
    io.stdout(formatDoctorReport(report));
  }

  if (!report.ok && strict) {
    return { exitCode: 1 };
  }

  return { exitCode: 0 };
}
