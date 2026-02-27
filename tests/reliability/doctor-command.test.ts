import path from 'node:path';
import { promises as fs } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
  executeDoctorCommand,
  type DoctorReport,
} from '../../src/cli/commands/doctor.js';
import type { CliIo } from '../../src/cli/types.js';
import {
  createTempDir,
  removeDir,
} from '../utils/runtime.js';

function createIoCapture(): {
  io: CliIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout(message: string) {
        stdout.push(message);
      },
      stderr(message: string) {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

function createProbeStub(availableCommands: ReadonlySet<string>) {
  return async (command: string): Promise<boolean> => availableCommands.has(command);
}

async function ensureFile(rootDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeValidSetupScope(rootDir: string): Promise<void> {
  await ensureFile(
    rootDir,
    path.join('.omg', 'setup-scope.json'),
    `${JSON.stringify(
      {
        version: 1,
        scope: 'project',
        updatedAt: new Date('2026-02-27T00:00:00.000Z').toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function createValidExtensionFixture(rootDir: string): Promise<void> {
  await ensureFile(
    rootDir,
    path.join('extensions', 'oh-my-gemini', 'gemini-extension.json'),
    `${JSON.stringify(
      {
        name: 'oh-my-gemini',
        version: '0.1.0',
        description: 'fixture',
        contextFileName: 'GEMINI.md',
      },
      null,
      2,
    )}\n`,
  );

  await ensureFile(
    rootDir,
    path.join('extensions', 'oh-my-gemini', 'GEMINI.md'),
    '# fixture\n',
  );

  const commandFiles = [
    path.join('extensions', 'oh-my-gemini', 'commands', 'setup.toml'),
    path.join('extensions', 'oh-my-gemini', 'commands', 'doctor.toml'),
    path.join('extensions', 'oh-my-gemini', 'commands', 'team', 'run.toml'),
    path.join('extensions', 'oh-my-gemini', 'commands', 'team', 'live.toml'),
    path.join('extensions', 'oh-my-gemini', 'commands', 'team', 'subagents.toml'),
    path.join('extensions', 'oh-my-gemini', 'commands', 'team', 'verify.toml'),
  ];

  for (const commandFile of commandFiles) {
    await ensureFile(rootDir, commandFile, 'description = "fixture"\n');
  }

  await ensureFile(
    rootDir,
    path.join('extensions', 'oh-my-gemini', 'skills', 'plan', 'SKILL.md'),
    '# fixture\n',
  );
}

function parseSingleJsonReport(stdout: string[]): DoctorReport {
  expect(stdout).toHaveLength(1);
  const [raw] = stdout;
  expect(raw).toBeTypeOf('string');
  return JSON.parse(raw ?? '{}') as DoctorReport;
}

function getCheck(report: DoctorReport, name: string) {
  return report.checks.find((check) => check.name === name);
}

describe('reliability: doctor command hardening', () => {
  test('doctor --fix remediates setup-scope and state writeability issues', async () => {
    const cwd = createTempDir('omg-doctor-fix-');
    const ioCapture = createIoCapture();

    try {
      await createValidExtensionFixture(cwd);
      await ensureFile(cwd, path.join('.omg', 'setup-scope.json'), '{ not-valid-json\n');

      const result = await executeDoctorCommand(
        ['--json', '--fix', '--no-strict'],
        {
          cwd,
          io: ioCapture.io,
          probeCommand: createProbeStub(new Set(['node', 'npm', 'gemini', 'tmux'])),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(ioCapture.stderr).toStrictEqual([]);

      const report = parseSingleJsonReport(ioCapture.stdout);

      expect(getCheck(report, 'setup-scope')?.status).toBe('ok');
      expect(getCheck(report, 'omg-state-writeability')?.status).toBe('ok');

      expect(
        report.fixes.some(
          (fix) => fix.name === 'setup-scope' && fix.status === 'applied',
        ),
      ).toBe(true);
      expect(
        report.fixes.some(
          (fix) =>
            fix.name === 'omg-state-writeability' &&
            fix.status === 'applied',
        ),
      ).toBe(true);

      const persistedScopeRaw = await fs.readFile(
        path.join(cwd, '.omg', 'setup-scope.json'),
        'utf8',
      );
      const persistedScope = JSON.parse(persistedScopeRaw) as {
        scope?: string;
        version?: number;
      };

      expect(persistedScope.scope).toBe('project');
      expect(persistedScope.version).toBe(1);

      await fs.access(path.join(cwd, '.omg', 'state'));
    } finally {
      removeDir(cwd);
    }
  });

  test('doctor reports extension integrity failures when required metadata is missing', async () => {
    const cwd = createTempDir('omg-doctor-extension-');
    const ioCapture = createIoCapture();

    try {
      await writeValidSetupScope(cwd);
      await fs.mkdir(path.join(cwd, '.omg', 'state'), { recursive: true });

      const result = await executeDoctorCommand(
        ['--json', '--no-strict'],
        {
          cwd,
          io: ioCapture.io,
          probeCommand: createProbeStub(new Set(['node', 'npm', 'gemini', 'tmux'])),
        },
      );

      expect(result.exitCode).toBe(0);
      expect(ioCapture.stderr).toStrictEqual([]);

      const report = parseSingleJsonReport(ioCapture.stdout);

      expect(getCheck(report, 'extension-manifest')?.status).toBe('missing');
      expect(getCheck(report, 'extension-commands')?.status).toBe('missing');
      expect(getCheck(report, 'extension-skills')?.status).toBe('missing');
      expect(getCheck(report, 'setup-scope')?.status).toBe('ok');
      expect(getCheck(report, 'omg-state-writeability')?.status).toBe('ok');
    } finally {
      removeDir(cwd);
    }
  });
});
