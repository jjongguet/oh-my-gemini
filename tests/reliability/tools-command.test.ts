import { describe, expect, test } from 'vitest';

import { executeToolsCommand } from '../../src/cli/commands/tools.js';
import { runCli } from '../../src/cli/index.js';
import {
  buildGeminiExtensionMcpServerConfig,
  CLI_TOOL_CATEGORIES,
  parseCliToolCategories,
} from '../../src/cli/tools/index.js';
import type { CliIo } from '../../src/cli/types.js';

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

describe('reliability: tools command + registry', () => {
  test('parseCliToolCategories validates and normalizes category input', () => {
    expect(parseCliToolCategories('file, git ,http')).toStrictEqual(['file', 'git', 'http']);
    expect(parseCliToolCategories('')).toStrictEqual([...CLI_TOOL_CATEGORIES]);
    expect(() => parseCliToolCategories('file,unknown')).toThrow(/Unknown tool category/i);
  });

  test('buildGeminiExtensionMcpServerConfig emits default registration snippet', () => {
    const config = buildGeminiExtensionMcpServerConfig();

    expect(config.omg_cli_tools).toBeDefined();
    expect(config.omg_cli_tools?.command).toBe('oh-my-gemini');
    expect(config.omg_cli_tools?.args).toStrictEqual(['tools', 'serve']);
  });

  test('tools list forwards parsed categories to injected list runner', async () => {
    const ioCapture = createIoCapture();
    let observedCategories: string[] | undefined;

    const result = await executeToolsCommand(['list', '--json', '--categories', 'file,git'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      listTools: ({ categories }) => {
        observedCategories = categories;
        return [
          {
            name: 'omg_file_read',
            category: 'file',
            description: 'read',
            inputSchema: { type: 'object', properties: {} },
          },
        ];
      },
    });

    expect(result.exitCode).toBe(0);
    expect(observedCategories).toStrictEqual(['file', 'git']);

    const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
      categories: string[];
      count: number;
    };

    expect(payload.categories).toStrictEqual(['file', 'git']);
    expect(payload.count).toBe(1);
  });

  test('tools serve forwards parsed categories to injected serve runner', async () => {
    const ioCapture = createIoCapture();
    let observedCategories: string[] | undefined;

    const result = await executeToolsCommand(['serve', '--categories', 'http,process'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      serveTools: async ({ categories }) => {
        observedCategories = categories;
      },
    });

    expect(result.exitCode).toBe(0);
    expect(observedCategories).toStrictEqual(['http', 'process']);
    expect(ioCapture.stderr).toStrictEqual([]);
  });

  test('tools manifest supports custom server/bin/categories', async () => {
    const ioCapture = createIoCapture();

    const result = await executeToolsCommand(
      [
        'manifest',
        '--json',
        '--categories',
        'file,process',
        '--bin',
        'omg',
        '--server-name',
        'custom_tools',
      ],
      {
        cwd: process.cwd(),
        io: ioCapture.io,
      },
    );

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(ioCapture.stdout.join('\n')) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(payload.mcpServers.custom_tools).toBeDefined();
    expect(payload.mcpServers.custom_tools?.command).toBe('omg');
    expect(payload.mcpServers.custom_tools?.args).toStrictEqual([
      'tools',
      'serve',
      '--categories',
      'file,process',
    ]);
  });

  test('runCli dispatches tools command via injected list runner', async () => {
    const ioCapture = createIoCapture();
    let observed = false;

    const exitCode = await runCli(['tools', 'list'], {
      cwd: process.cwd(),
      io: ioCapture.io,
      tools: {
        listTools: () => {
          observed = true;
          return [];
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(observed).toBe(true);
  });

  test('tools command rejects unknown options with usage exit code', async () => {
    const ioCapture = createIoCapture();

    const result = await executeToolsCommand(['list', '--bogus'], {
      cwd: process.cwd(),
      io: ioCapture.io,
    });

    expect(result.exitCode).toBe(2);
    expect(ioCapture.stderr.join('\n')).toMatch(/Unknown option/i);
  });
});
