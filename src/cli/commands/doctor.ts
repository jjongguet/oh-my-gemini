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

interface DoctorTmuxPaneHealth {
  paneIndex: number;
  paneId: string;
  dead: boolean;
  deadStatus: number;
  currentCommand?: string;
  activity?: string;
}

interface DoctorTmuxSessionHealth {
  exists: boolean;
  panes: DoctorTmuxPaneHealth[];
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
  team?: {
    enabled: boolean;
    stateRoot: string;
    inspectedTeams: string[];
  };
}

export interface DoctorCommandContext {
  io: CliIo;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  probeCommand?: (command: string, cwd: string) => Promise<boolean>;
  probeContainerRuntime?: (command: 'docker' | 'podman', cwd: string) => Promise<boolean>;
  probeTmuxSessionHealth?: (sessionName: string, cwd: string) => Promise<DoctorTmuxSessionHealth>;
}

const DOCTOR_CODE = {
  NODE: 'DOC_NODE_MISSING',
  NPM: 'DOC_NPM_MISSING',
  GEMINI: 'DOC_GEMINI_MISSING',
  TMUX: 'DOC_TMUX_MISSING',
  CONTAINER: 'DOC_CONTAINER_RUNTIME_UNHEALTHY',
  OMG_BINARY: 'DOC_OMG_BINARY_MISSING',
  SETUP_SCOPE: 'DOC_SETUP_SCOPE_INVALID',
  EXTENSION_MANIFEST: 'DOC_EXTENSION_MANIFEST',
  EXTENSION_COMMANDS: 'DOC_EXTENSION_COMMANDS',
  EXTENSION_SKILLS: 'DOC_EXTENSION_SKILLS',
  STATE_WRITE: 'DOC_STATE_WRITEABILITY',
  TEAM_PANE_HEALTH: 'DOC_TEAM_PANE_HEALTH',
  TEAM_STATE_INTEGRITY: 'DOC_TEAM_STATE_INTEGRITY',
  TEAM_PHASE_CONSISTENCY: 'DOC_TEAM_PHASE_CONSISTENCY',
} as const;

function printDoctorHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg doctor [--json] [--strict|--no-strict] [--fix] [--extension-path <path>] [--team <name>]',
    '',
    'Options:',
    '  --json         Print machine-readable report',
    '  --strict       Return non-zero when required dependency/check is missing (default)',
    '  --no-strict    Always return exit code 0 and print report only',
    '  --fix          Apply safe automatic fixes for supported checks and rerun diagnostics',
    '  --extension-path <path>   Explicit extension root path override',
    '  --team <name>   Run team-runtime diagnostics for the named team state namespace',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function isTerminalTeamPhase(value: unknown): boolean {
  return value === 'completed' || value === 'failed' || value === 'complete';
}

function isTerminalRuntimeStatus(value: unknown): boolean {
  return value === 'completed' || value === 'failed' || value === 'stopped';
}

async function defaultProbeTmuxSessionHealth(
  sessionName: string,
  cwd: string,
): Promise<DoctorTmuxSessionHealth> {
  return new Promise((resolve) => {
    const hasSession = spawn('tmux', ['has-session', '-t', sessionName], {
      cwd,
      stdio: 'ignore',
    });

    hasSession.on('error', (error) => {
      resolve({ exists: false, panes: [], error: error.message });
    });

    hasSession.on('close', (code) => {
      if (code !== 0) {
        resolve({ exists: false, panes: [] });
        return;
      }

      const listPanes = spawn(
        'tmux',
        [
          'list-panes',
          '-t',
          sessionName,
          '-F',
          '#{pane_index}\t#{pane_id}\t#{pane_dead}\t#{pane_dead_status}\t#{pane_current_command}\t#{pane_activity}',
        ],
        {
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let stdout = '';
      let stderr = '';
      listPanes.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      listPanes.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      listPanes.on('error', (error) => {
        resolve({ exists: true, panes: [], error: error.message });
      });
      listPanes.on('close', (listCode) => {
        if (listCode !== 0) {
          resolve({ exists: true, panes: [], error: stderr.trim() || 'Failed to list tmux panes.' });
          return;
        }

        const panes = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [paneIndexRaw, paneIdRaw, paneDeadRaw, paneDeadStatusRaw, paneCurrentCommandRaw, paneActivityRaw] = line.split('\t');
            return {
              paneIndex: Number.parseInt(paneIndexRaw ?? '', 10),
              paneId: paneIdRaw?.trim() || 'unknown',
              dead: paneDeadRaw?.trim() === '1',
              deadStatus: Number.parseInt(paneDeadStatusRaw ?? '0', 10),
              currentCommand: paneCurrentCommandRaw?.trim() || undefined,
              activity: paneActivityRaw?.trim() || undefined,
            } satisfies DoctorTmuxPaneHealth;
          });

        resolve({ exists: true, panes });
      });
    });
  });
}

async function listPersistedTeams(stateRoot: string): Promise<string[]> {
  const teamsDir = path.join(stateRoot, 'team');
  try {
    const entries = await fs.readdir(teamsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readJsonIntegrity(filePath: string): Promise<{ exists: boolean; parsed?: unknown; error?: string }> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return { exists: true, parsed: JSON.parse(raw) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { exists: false };
    }
    return { exists: true, error: (error as Error).message };
  }
}

async function runTeamDoctorChecks(
  cwd: string,
  probeTmuxSessionHealth: (sessionName: string, cwd: string) => Promise<DoctorTmuxSessionHealth>,
  requestedTeamName?: string,
): Promise<Pick<DoctorReport, 'team'> & { checks: DoctorCheckResult[] }> {
  const stateRoot = path.join(cwd, '.omg', 'state');
  const discoveredTeamNames = await listPersistedTeams(stateRoot);
  const teamNames = requestedTeamName ? [requestedTeamName] : discoveredTeamNames;

  if (teamNames.length === 0) {
    return {
      checks: [
        {
          code: 'DOC_TEAM_STATE_INTEGRITY_OK',
          name: 'team-runtime-state-integrity',
          required: true,
          status: 'ok',
          details: requestedTeamName
            ? `no persisted team run found for ${requestedTeamName} under ${stateRoot}`
            : `no persisted team runs found under ${stateRoot}`,
        },
        {
          code: 'DOC_TEAM_PHASE_CONSISTENCY_OK',
          name: 'team-runtime-phase-consistency',
          required: true,
          status: 'ok',
          details: 'no persisted team runs found to validate',
        },
        {
          code: 'DOC_TEAM_PANE_HEALTH_OK',
          name: 'team-runtime-pane-health',
          required: true,
          status: 'ok',
          details: 'no tmux-backed team sessions found to inspect',
        },
      ],
      team: {
        enabled: true,
        stateRoot,
        inspectedTeams: [],
      },
    };
  }

  const integrityIssues: string[] = [];
  const consistencyIssues: string[] = [];
  const paneHealthIssues: string[] = [];
  let inspectedTmuxSessions = 0;

  for (const teamName of teamNames) {
    const teamDir = path.join(stateRoot, 'team', teamName);
    const phaseResult = await readJsonIntegrity(path.join(teamDir, 'phase.json'));
    const snapshotResult = await readJsonIntegrity(path.join(teamDir, 'monitor-snapshot.json'));

    if (phaseResult.error) {
      integrityIssues.push(`${teamName}: invalid phase.json (${phaseResult.error})`);
    }
    if (snapshotResult.error) {
      integrityIssues.push(`${teamName}: invalid monitor-snapshot.json (${snapshotResult.error})`);
    }

    const phase = isRecord(phaseResult.parsed) ? phaseResult.parsed : undefined;
    const snapshot = isRecord(snapshotResult.parsed) ? snapshotResult.parsed : undefined;

    if (phase && typeof phase.currentFixAttempt === 'number' && typeof phase.maxFixAttempts === 'number') {
      if (phase.currentFixAttempt > phase.maxFixAttempts) {
        consistencyIssues.push(`${teamName}: currentFixAttempt exceeds maxFixAttempts`);
      }
    }

    if (phase && snapshot) {
      const currentPhase = phase.currentPhase;
      const snapshotStatus = snapshot.status;
      if (currentPhase === 'completed' && snapshotStatus !== 'completed') {
        consistencyIssues.push(`${teamName}: phase=completed but snapshot.status=${String(snapshotStatus)}`);
      }
      if (currentPhase === 'failed' && snapshotStatus === 'completed') {
        consistencyIssues.push(`${teamName}: phase=failed but snapshot.status=completed`);
      }
    }

    if (!snapshot) {
      continue;
    }

    const backend = typeof snapshot.backend === 'string' ? snapshot.backend : '';
    const runtime = isRecord(snapshot.runtime) ? snapshot.runtime : undefined;
    const sessionName = typeof runtime?.sessionName === 'string' ? runtime.sessionName : '';
    const phaseIsTerminal = isTerminalTeamPhase(phase?.currentPhase);
    const snapshotIsTerminal = isTerminalRuntimeStatus(snapshot.status);

    if (backend !== 'tmux') {
      continue;
    }

    if (!sessionName) {
      if (!phaseIsTerminal && !snapshotIsTerminal) {
        paneHealthIssues.push(`${teamName}: tmux snapshot is missing runtime.sessionName for a non-terminal run`);
      }
      continue;
    }

    inspectedTmuxSessions += 1;
    const health = await probeTmuxSessionHealth(sessionName, cwd);

    if (!health.exists) {
      if (!phaseIsTerminal && !snapshotIsTerminal) {
        paneHealthIssues.push(`${teamName}: tmux session ${sessionName} is missing while run is non-terminal`);
      }
      continue;
    }

    if (health.error) {
      paneHealthIssues.push(`${teamName}: ${health.error}`);
      continue;
    }

    if (health.panes.length === 0) {
      paneHealthIssues.push(`${teamName}: tmux session ${sessionName} has no worker panes`);
      continue;
    }

    const deadPanes = health.panes.filter((pane) => pane.dead);
    if (!phaseIsTerminal && !snapshotIsTerminal && deadPanes.length === health.panes.length) {
      paneHealthIssues.push(`${teamName}: all ${deadPanes.length} worker panes are dead in non-terminal run`);
    }
  }

  const checks: DoctorCheckResult[] = [
    integrityIssues.length === 0
      ? {
          code: 'DOC_TEAM_STATE_INTEGRITY_OK',
          name: 'team-runtime-state-integrity',
          required: true,
          status: 'ok',
          details: `validated ${teamNames.length} persisted team director${teamNames.length === 1 ? 'y' : 'ies'}`,
        }
      : {
          code: DOCTOR_CODE.TEAM_STATE_INTEGRITY,
          name: 'team-runtime-state-integrity',
          required: true,
          status: 'missing',
          details: integrityIssues.join('; '),
          hint: 'Repair invalid team state JSON before resuming affected runs.',
        },
    consistencyIssues.length === 0
      ? {
          code: 'DOC_TEAM_PHASE_CONSISTENCY_OK',
          name: 'team-runtime-phase-consistency',
          required: true,
          status: 'ok',
          details: `phase/snapshot consistency verified for ${teamNames.length} persisted team${teamNames.length === 1 ? '' : 's'}`,
        }
      : {
          code: DOCTOR_CODE.TEAM_PHASE_CONSISTENCY,
          name: 'team-runtime-phase-consistency',
          required: true,
          status: 'missing',
          details: consistencyIssues.join('; '),
          hint: 'Reconcile phase.json and monitor-snapshot.json before resume or verification.',
        },
    paneHealthIssues.length === 0
      ? {
          code: 'DOC_TEAM_PANE_HEALTH_OK',
          name: 'team-runtime-pane-health',
          required: true,
          status: 'ok',
          details: inspectedTmuxSessions > 0
            ? `tmux pane health verified for ${inspectedTmuxSessions} active or historical session${inspectedTmuxSessions === 1 ? '' : 's'}`
            : 'no tmux-backed team sessions required live inspection',
        }
      : {
          code: DOCTOR_CODE.TEAM_PANE_HEALTH,
          name: 'team-runtime-pane-health',
          required: true,
          status: 'missing',
          details: paneHealthIssues.join('; '),
          hint: 'Restore tmux worker panes or mark the affected run terminal before resume.',
        },
  ];

  return {
    checks,
    team: {
      enabled: true,
      stateRoot,
      inspectedTeams: teamNames,
    },
  };
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
          hint: `Set ${OMG_EXTENSION_PATH_ENV}=<path> or run doctor from a repository containing gemini-extension.json at the package root.`,
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
    path.join(extensionRoot, 'commands', 'omg', 'setup.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'doctor.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'hud.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'tools.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'team', 'run.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'team', 'live.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'team', 'subagents.toml'),
    path.join(extensionRoot, 'commands', 'omg', 'team', 'verify.toml'),
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
  probeTmuxSessionHealth: (sessionName: string, cwd: string) => Promise<DoctorTmuxSessionHealth>,
  options: {
    extensionPathOverride?: string;
    env?: NodeJS.ProcessEnv;
    teamName?: string;
  },
): Promise<DoctorReport> {
  const [
    hasNode,
    hasNpm,
    hasGemini,
    hasTmux,
    hasDocker,
    hasPodman,
    hasOmgBinary,
  ] = await Promise.all([
    probe('node', cwd),
    probe('npm', cwd),
    probe('gemini', cwd),
    probe('tmux', cwd),
    probe('docker', cwd),
    probe('podman', cwd),
    probe('oh-my-gemini', cwd),
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
      required: false,
      status: hasHealthyContainerRuntime ? 'ok' : 'missing',
      details:
        availableRuntimes.length > 0
          ? `runtime(s): ${availableRuntimes.join(', ')}`
          : 'Neither docker nor podman found in PATH',
      hint:
        availableRuntimes.length > 0
          ? 'Optional: needed only if using Gemini sandbox mode. Use --sandbox=none to skip.'
          : 'Optional: needed only if using Gemini sandbox mode. Use --sandbox=none to skip.',
    },
    {
      code: hasOmgBinary ? 'DOC_OMG_BINARY_OK' : DOCTOR_CODE.OMG_BINARY,
      name: 'omg-binary',
      required: false,
      status: hasOmgBinary ? 'ok' : 'missing',
      details: hasOmgBinary
        ? 'oh-my-gemini command found in PATH'
        : 'oh-my-gemini command not found in PATH (MCP tools will be unavailable inside Gemini extension)',
      hint: 'Install globally: npm install -g oh-my-gemini-sisyphus',
    },
  ];

  const [setupScopeCheck, extensionResult, stateWriteCheck, teamRuntime] = await Promise.all([
    checkSetupScopeValidity(cwd),
    checkExtensionIntegrity(cwd, {
      extensionPathOverride: options.extensionPathOverride,
      env: options.env,
    }),
    checkStateWriteability(cwd),
    options.teamName
      ? runTeamDoctorChecks(cwd, probeTmuxSessionHealth, options.teamName)
      : Promise.resolve({ checks: [], team: undefined }),
  ]);

  const checks = [
    ...staticChecks,
    setupScopeCheck,
    ...extensionResult.checks,
    stateWriteCheck,
    ...teamRuntime.checks,
  ];

  return {
    ok: checks.every((check) => check.status === 'ok' || !check.required),
    checks,
    fixes: [],
    extension: extensionResult.resolution,
    team: teamRuntime.team,
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
  if (report.team?.enabled) {
    lines.push(`Team diagnostics: stateRoot=${report.team.stateRoot}, teams=${report.team.inspectedTeams.length}`);
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
    'team',
  ]);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printDoctorHelp(io);
    return { exitCode: 2 };
  }

  const jsonOutput = hasFlag(parsed.options, ['json']);
  const strict = readBooleanOption(parsed.options, ['strict'], true);
  const fix = hasFlag(parsed.options, ['fix']);
  const teamDiagnostics = hasFlag(parsed.options, ['team']);
  if (parsed.options.get('extension-path') === true) {
    io.stderr('--extension-path requires a value');
    printDoctorHelp(io);
    return { exitCode: 2 };
  }
  if (parsed.options.get('team') === true) {
    io.stderr('--team requires a value');
    printDoctorHelp(io);
    return { exitCode: 2 };
  }
  const extensionPathOverride = getStringOption(parsed.options, ['extension-path']);
  const teamName = getStringOption(parsed.options, ['team']);
  const probe = context.probeCommand ?? defaultProbeCommand;
  const probeContainerRuntime =
    context.probeContainerRuntime ?? defaultProbeContainerRuntime;
  const probeTmuxSessionHealth =
    context.probeTmuxSessionHealth ?? defaultProbeTmuxSessionHealth;
  const env = context.env ?? process.env;

  let report = await runDoctorChecks(
    context.cwd,
    probe,
    probeContainerRuntime,
    probeTmuxSessionHealth,
    {
      extensionPathOverride,
      env,
      teamName,
    },
  );

  if (fix) {
    const fixes = await applyDoctorFixes(context.cwd, report.checks);
    const rerun = await runDoctorChecks(
      context.cwd,
      probe,
      probeContainerRuntime,
      probeTmuxSessionHealth,
      {
        extensionPathOverride,
        env,
        teamName,
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
