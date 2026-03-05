import { promises as fs } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { executePrdCommand } from '../../src/cli/commands/prd.js';
import type { CliIo } from '../../src/cli/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

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

describe('reliability: prd command', () => {
  test('prints help for empty argv', async () => {
    const ioCapture = createIoCapture();
    const result = await executePrdCommand([], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(0);
    expect(ioCapture.stdout.join('\n')).toMatch(/Usage: omg prd/i);
  });

  test('init -> validate -> next flow works with json output', async () => {
    const tempRoot = createTempDir('omg-prd-command-');
    const ioCapture = createIoCapture();

    try {
      const initResult = await executePrdCommand(
        ['init', '--task', 'Implement PRD command flow', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );
      expect(initResult.exitCode).toBe(0);

      const prdPath = path.join(tempRoot, 'prd.json');
      const prdRaw = await fs.readFile(prdPath, 'utf8');
      expect(prdRaw).toContain('"US-001"');

      ioCapture.stdout.length = 0;
      const validateResult = await executePrdCommand(['validate', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });
      expect(validateResult.exitCode).toBe(0);

      const validatePayload = JSON.parse(ioCapture.stdout.join('\n')) as {
        ok?: boolean;
        validation?: { valid?: boolean };
      };
      expect(validatePayload.ok).toBe(true);
      expect(validatePayload.validation?.valid).toBe(true);

      ioCapture.stdout.length = 0;
      const nextResult = await executePrdCommand(['next', '--json'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });
      expect(nextResult.exitCode).toBe(0);

      const nextPayload = JSON.parse(ioCapture.stdout.join('\n')) as {
        nextStory?: { id?: string };
      };
      expect(nextPayload.nextStory?.id).toBe('US-001');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('complete blocks when acceptance criteria evidence is missing', async () => {
    const tempRoot = createTempDir('omg-prd-command-complete-fail-');
    const ioCapture = createIoCapture();

    try {
      await executePrdCommand(['init', '--task', 'Missing criteria case'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });
      ioCapture.stdout.length = 0;

      const result = await executePrdCommand(
        ['complete', '--story', 'US-001', '--criteria', '{"AC-US-001-1":"PASS"}', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );

      expect(result.exitCode).toBe(1);
      const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
        ok?: boolean;
        message?: string;
      };
      expect(payload.ok).toBe(false);
      expect(payload.message).toMatch(/acceptance criteria/i);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('complete and reopen update story status', async () => {
    const tempRoot = createTempDir('omg-prd-command-complete-pass-');
    const ioCapture = createIoCapture();

    try {
      await executePrdCommand(['init', '--task', 'Completion flow'], {
        cwd: tempRoot,
        io: ioCapture.io,
      });

      ioCapture.stdout.length = 0;
      const completeResult = await executePrdCommand(
        [
          'complete',
          '--story',
          'US-001',
          '--criteria',
          '{"AC-US-001-1":"PASS","AC-US-001-2":"PASS","AC-US-001-3":"PASS","AC-US-001-4":"PASS"}',
          '--json',
        ],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );
      expect(completeResult.exitCode).toBe(0);

      const afterComplete = JSON.parse(
        await fs.readFile(path.join(tempRoot, 'prd.json'), 'utf8'),
      ) as {
        userStories?: Array<{ id?: string; passes?: boolean }>;
      };
      expect(afterComplete.userStories?.[0]?.passes).toBe(true);

      ioCapture.stdout.length = 0;
      const reopenResult = await executePrdCommand(
        ['reopen', '--story', 'US-001', '--json'],
        {
          cwd: tempRoot,
          io: ioCapture.io,
        },
      );
      expect(reopenResult.exitCode).toBe(0);

      const afterReopen = JSON.parse(
        await fs.readFile(path.join(tempRoot, 'prd.json'), 'utf8'),
      ) as {
        userStories?: Array<{ id?: string; passes?: boolean }>;
      };
      expect(afterReopen.userStories?.[0]?.passes).toBe(false);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('unknown options return usage error', async () => {
    const ioCapture = createIoCapture();
    const result = await executePrdCommand(['status', '--bogus'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/unknown option/i);
  });
});
