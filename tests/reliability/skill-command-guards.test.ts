import { describe, expect, test } from 'vitest';

import { executeSkillCommand } from '../../src/cli/commands/skill.js';

function createIoCapture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
    },
  };
}

describe('reliability: skill command guards', () => {
  test('rejects /prompts:* invocations in skill command with actionable guidance', async () => {
    const ioCapture = createIoCapture();

    const result = await executeSkillCommand(['/prompts:architect'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/not a skill/i);
    expect(ioCapture.stderr.join('\n')).toMatch(/use the prompts catalog directly/i);
  });
});
