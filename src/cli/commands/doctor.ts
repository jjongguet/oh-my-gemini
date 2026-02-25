import { spawn } from 'node:child_process';

import type { CliIo, CommandExecutionResult } from '../types.js';

import { hasFlag, parseCliArgs, readBooleanOption } from './arg-utils.js';

export type DoctorCheckStatus = 'ok' | 'missing';

export interface DoctorCheckResult {
  name: string;
  required: boolean;
  status: DoctorCheckStatus;
  details: string;
  hint?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheckResult[];
}

export interface DoctorCommandContext {
  io: CliIo;
  cwd: string;
  probeCommand?: (command: string, cwd: string) => Promise<boolean>;
}

function printDoctorHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg doctor [--json] [--strict|--no-strict]',
    '',
    'Options:',
    '  --json         Print machine-readable report',
    '  --strict       Return non-zero when required dependency is missing (default)',
    '  --no-strict    Always return exit code 0 and print report only',
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

async function probeContainerDaemon(command: 'docker' | 'podman', cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ['info'], {
      cwd,
      stdio: 'ignore',
    });

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function runDoctorChecks(
  cwd: string,
  probe: (command: string, cwd: string) => Promise<boolean>,
): Promise<DoctorReport> {
  const [hasGemini, hasTmux, hasDocker, hasPodman] = await Promise.all([
    probe('gemini', cwd),
    probe('tmux', cwd),
    probe('docker', cwd),
    probe('podman', cwd),
  ]);

  const [dockerReady, podmanReady] = await Promise.all([
    hasDocker ? probeContainerDaemon('docker', cwd) : Promise.resolve(false),
    hasPodman ? probeContainerDaemon('podman', cwd) : Promise.resolve(false),
  ]);

  const availableRuntimes = [
    hasDocker ? (dockerReady ? 'docker(daemon:ok)' : 'docker(daemon:down)') : '',
    hasPodman ? (podmanReady ? 'podman(daemon:ok)' : 'podman(daemon:down)') : '',
  ].filter(Boolean);

  const hasHealthyContainerRuntime = dockerReady || podmanReady;

  const checks: DoctorCheckResult[] = [
    {
      name: 'gemini-cli',
      required: true,
      status: hasGemini ? 'ok' : 'missing',
      details: hasGemini ? 'gemini command found' : 'gemini command not found in PATH',
      hint: 'Install: npm i -g @google/gemini-cli',
    },
    {
      name: 'tmux',
      required: true,
      status: hasTmux ? 'ok' : 'missing',
      details: hasTmux ? 'tmux command found' : 'tmux command not found in PATH',
      hint: 'Install: brew install tmux (macOS) or apt/yum equivalent.',
    },
    {
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

  return {
    ok: checks.every((check) => check.status === 'ok' || !check.required),
    checks,
  };
}

function formatDoctorReport(report: DoctorReport): string {
  const lines = ['Doctor report:', ''];

  for (const check of report.checks) {
    const label = check.status === 'ok' ? 'OK' : 'MISSING';
    lines.push(`- [${label}] ${check.name}: ${check.details}`);

    if (check.status === 'missing' && check.hint) {
      lines.push(`  hint: ${check.hint}`);
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

  const jsonOutput = hasFlag(parsed.options, ['json']);
  const strict = readBooleanOption(parsed.options, ['strict'], true);
  const probe = context.probeCommand ?? defaultProbeCommand;

  const report = await runDoctorChecks(context.cwd, probe);

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
