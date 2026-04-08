import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';

export interface VersionCommandContext {
  cwd: string;
  io: CliIo;
  probeVersion?: (command: string, args: string[], cwd: string) => Promise<string | null>;
  resolveOmpVersion?: () => Promise<string>;
}

interface VersionReport {
  omp: string;
  node: string;
  tmux: string;
  gemini: string;
}

function printVersionHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp version [--json]',
    '',
    'Options:',
    '  --json    Print machine-readable version output',
    '  --help    Show command help',
  ].join('\n'));
}

function normalizeTmuxVersion(raw: string | null): string {
  if (!raw) {
    return 'unknown';
  }
  const match = raw.match(/(\d+(?:\.\d+)+)/);
  return match?.[1] ?? (raw.trim() || 'unknown');
}

function normalizeGeminiVersion(raw: string | null): string {
  if (!raw) {
    return 'unknown';
  }
  const match = raw.match(/(\d+(?:\.\d+)+(?:-[\w.-]+)?)/);
  return match?.[1] ?? (raw.trim() || 'unknown');
}

function normalizeNodeVersion(raw: string | null): string {
  if (!raw) {
    return 'unknown';
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return 'unknown';
  }
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

async function defaultProbeVersion(command: string, args: string[], cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    let output = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      output += chunk.toString();
    });

    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
      resolve(firstLine.trim() || null);
    });
  });
}

async function defaultResolveOmpVersion(): Promise<string> {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../../package.json') as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function collectVersionReport(context: VersionCommandContext): Promise<VersionReport> {
  const probeVersion = context.probeVersion ?? defaultProbeVersion;
  const resolveOmpVersion = context.resolveOmpVersion ?? defaultResolveOmpVersion;

  const [omp, nodeRaw, tmuxRaw, geminiRaw] = await Promise.all([
    resolveOmpVersion(),
    probeVersion('node', ['--version'], context.cwd),
    probeVersion('tmux', ['-V'], context.cwd),
    probeVersion('gemini', ['--version'], context.cwd),
  ]);

  return {
    omp,
    node: normalizeNodeVersion(nodeRaw),
    tmux: normalizeTmuxVersion(tmuxRaw),
    gemini: normalizeGeminiVersion(geminiRaw),
  };
}

export async function executeVersionCommand(
  argv: string[],
  context: VersionCommandContext,
): Promise<CommandExecutionResult> {
  const { io } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printVersionHelp(io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, ['help', 'h', 'json']);
  if (unknownOptions.length > 0) {
    io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    printVersionHelp(io);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    printVersionHelp(io);
    return { exitCode: 2 };
  }

  const report = await collectVersionReport(context);

  if (hasFlag(parsed.options, ['json'])) {
    io.stdout(JSON.stringify({
      name: 'oh-my-product',
      version: report.omp,
      node: report.node,
      tmux: report.tmux,
      gemini: report.gemini,
    }, null, 2));
    return { exitCode: 0 };
  }

  io.stdout([
    `oh-my-product v${report.omp}`,
    `  node:    ${report.node}`,
    `  tmux:    ${report.tmux}`,
    `  gemini:  ${report.gemini}`,
  ].join('\n'));

  return { exitCode: 0 };
}
