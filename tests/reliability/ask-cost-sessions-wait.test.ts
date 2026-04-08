import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { executeAskCommand } from '../../src/cli/commands/ask.js';
import { executeCostCommand } from '../../src/cli/commands/cost.js';
import { executeSessionsCommand } from '../../src/cli/commands/sessions.js';
import { detectGeminiRateLimitFromOutput, executeWaitCommand } from '../../src/cli/commands/wait.js';
import { runCli } from '../../src/cli/index.js';
import { recordSession, recordTokenUsage } from '../../src/state/index.js';
import type { CliIo } from '../../src/cli/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function createIoCapture(): { io: CliIo; stdout: string[]; stderr: string[] } {
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

describe('reliability: ask/cost/sessions/wait commands', () => {
  test('ask command writes artifact and session/token tracking', async () => {
    const tempRoot = createTempDir('omp-ask-command-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeAskCommand(['gemini', '--prompt', 'hello world'], {
        cwd: tempRoot,
        io: ioCapture.io,
        env: {} as NodeJS.ProcessEnv,
        createSessionId: () => 'ask-session-1',
        now: () => new Date('2026-03-08T12:00:00.000Z'),
        runAskPrompt: async () => ({
          exitCode: 0,
          stdout: 'advisor output',
          stderr: '',
        }),
      });

      expect(result.exitCode).toBe(0);
      const artifactDir = path.join(tempRoot, '.omp', 'artifacts', 'ask');
      const artifacts = await fs.readdir(artifactDir);
      expect(artifacts.length).toBe(1);

      const sessionLog = await fs.readFile(path.join(tempRoot, '.omp', 'state', 'sessions', 'registry.ndjson'), 'utf8');
      expect(sessionLog).toContain('ask-session-1');
      const tokenLog = await fs.readFile(path.join(tempRoot, '.omp', 'state', 'tokens', 'usage.ndjson'), 'utf8');
      expect(tokenLog).toContain('ask-session-1');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('cost command summarizes recorded token usage', async () => {
    const tempRoot = createTempDir('omp-cost-command-');
    const ioCapture = createIoCapture();

    try {
      await recordTokenUsage(tempRoot, {
        sessionId: 'sess-1',
        command: 'ask',
        provider: 'gemini',
        promptTokens: 100,
        responseTokens: 50,
        totalTokens: 150,
        estimatedCostUsd: 0.12,
        startedAt: '2026-03-08T10:00:00.000Z',
        completedAt: '2026-03-08T10:01:00.000Z',
      });

      const result = await executeCostCommand(['daily', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
        now: () => new Date('2026-03-08T12:00:00.000Z'),
      });

      expect(result.exitCode).toBe(0);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as { totalTokens: number; totalEstimatedCostUsd: number };
      expect(payload.totalTokens).toBe(150);
      expect(payload.totalEstimatedCostUsd).toBe(0.12);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('sessions command lists recorded sessions', async () => {
    const tempRoot = createTempDir('omp-sessions-command-');
    const ioCapture = createIoCapture();

    try {
      await recordSession(tempRoot, {
        id: 'sess-1',
        command: 'ask',
        cwd: tempRoot,
        status: 'completed',
        startedAt: '2026-03-08T10:00:00.000Z',
        completedAt: '2026-03-08T10:01:00.000Z',
        provider: 'gemini',
        summary: 'completed fine',
      });

      const result = await executeSessionsCommand(['--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(0);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as { count: number; sessions: Array<{ id: string }> };
      expect(payload.count).toBe(1);
      expect(payload.sessions[0]?.id).toBe('sess-1');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('sessions --limit rejects decimal values', async () => {
    const tempRoot = createTempDir('omp-sessions-limit-decimal-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeSessionsCommand(['--limit', '1.5'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(2);
      expect(ioCapture.stderr[0]).toContain('Invalid --limit value: 1.5');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('sessions --limit rejects mixed-string values', async () => {
    const tempRoot = createTempDir('omp-sessions-limit-mixed-');
    const ioCapture = createIoCapture();

    try {
      const result = await executeSessionsCommand(['--limit', '10abc'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      expect(result.exitCode).toBe(2);
      expect(ioCapture.stderr[0]).toContain('Invalid --limit value: 10abc');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('wait command toggles daemon state and detects rate limit from usage snapshot', async () => {
    const tempRoot = createTempDir('omp-wait-command-');
    const ioCapture = createIoCapture();

    try {
      await fs.mkdir(path.join(tempRoot, '.gemini'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, '.gemini', 'usage.json'),
        JSON.stringify({ status: 429, error: 'rate limit exceeded', updatedAt: '2026-03-08T12:00:00.000Z' }),
        'utf8',
      );

      const startResult = await executeWaitCommand(['--start', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
        now: () => new Date('2026-03-08T12:00:00.000Z'),
      });

      expect(startResult.exitCode).toBe(0);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as { rateLimited: boolean; daemonEnabled: boolean };
      expect(payload.rateLimited).toBe(true);
      expect(payload.daemonEnabled).toBe(true);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('rate limit detector recognizes Gemini CLI output markers', () => {
    expect(detectGeminiRateLimitFromOutput('Error: rate limit exceeded (429)')).toBe(true);
    expect(detectGeminiRateLimitFromOutput('resource exhausted, please retry later')).toBe(true);
    expect(detectGeminiRateLimitFromOutput('normal output')).toBe(false);
  });

  test('runCli dispatches ask/cost/sessions/wait commands', async () => {
    const tempRoot = createTempDir('omp-cli-new-commands-');
    try {
      let askCalled = false;
      const askExit = await runCli(['ask', 'gemini', '--prompt', 'hi'], {
        cwd: tempRoot,
        io: createIoCapture().io,
        ask: {
          runAskPrompt: async () => {
            askCalled = true;
            return { exitCode: 0, stdout: 'ok', stderr: '' };
          },
          createSessionId: () => 'cli-ask-1',
          now: () => new Date('2026-03-08T12:00:00.000Z'),
        },
      });
      expect(askExit).toBe(0);
      expect(askCalled).toBe(true);

      const costExit = await runCli(['cost', 'daily', '--json'], {
        cwd: tempRoot,
        io: createIoCapture().io,
        cost: { now: () => new Date('2026-03-08T12:00:00.000Z') },
      });
      expect(costExit).toBe(0);

      const sessionsExit = await runCli(['sessions', '--json'], {
        cwd: tempRoot,
        io: createIoCapture().io,
      });
      expect(sessionsExit).toBe(0);

      const waitExit = await runCli(['wait', '--json'], {
        cwd: tempRoot,
        io: createIoCapture().io,
        wait: { now: () => new Date('2026-03-08T12:00:00.000Z') },
      });
      expect(waitExit).toBe(0);
    } finally {
      removeDir(tempRoot);
    }
  });
});
