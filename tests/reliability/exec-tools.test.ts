import { describe, expect, test } from 'vitest';

import { createExecTools } from '../../src/tools/exec-tools.js';
import type { OmpToolDefinition, OmpToolRequestContext } from '../../src/tools/types.js';

function makeContext(): OmpToolRequestContext {
  return {
    cwd: process.cwd(),
    signal: new AbortController().signal,
    requestId: 'test',
    sessionId: 'session',
  };
}

function findTool(tools: OmpToolDefinition[], name: string): OmpToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }

  return tool;
}

describe('reliability: exec tools', () => {
  test('exec_run executes command with argv and returns structured payload', async () => {
    const tools = createExecTools({ outputLimit: 1024 });
    const execRun = findTool(tools, 'exec_run');

    const resultRaw = await execRun.handler(
      {
        command: 'node',
        args: ['-e', 'process.stdout.write("ok")'],
      },
      makeContext(),
    );

    const result = JSON.parse(typeof resultRaw === 'string' ? resultRaw : resultRaw.text) as {
      code: number;
      stdout: string;
      stderr: string;
      args: string[];
    };

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('ok');
    expect(result.stderr).toBe('');
    expect(result.args).toEqual(['-e', 'process.stdout.write("ok")']);
  });

  test('exec_run flags non-zero exits as tool errors', async () => {
    const tools = createExecTools();
    const execRun = findTool(tools, 'exec_run');

    const result = await execRun.handler(
      {
        command: 'node',
        args: ['-e', 'process.exit(3)'],
      },
      makeContext(),
    );

    if (typeof result === 'string') {
      throw new Error('expected structured result');
    }

    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.text) as { code: number };
    expect(parsed.code).toBe(3);
  });

  test('exec_run truncates oversized output', async () => {
    const tools = createExecTools({ outputLimit: 20 });
    const execRun = findTool(tools, 'exec_run');

    const result = await execRun.handler(
      {
        command: 'node',
        args: ['-e', 'process.stdout.write("0123456789ABCDEFGHIJZZZZ")'],
      },
      makeContext(),
    );

    if (typeof result === 'string') {
      throw new Error('expected structured result');
    }

    const parsed = JSON.parse(result.text) as { stdoutTruncated: boolean; stdout: string };
    expect(parsed.stdoutTruncated).toBe(true);
    expect(parsed.stdout).toContain('<truncated>');
  });
});
