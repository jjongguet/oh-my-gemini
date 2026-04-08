import { describe, expect, test } from 'vitest';

import { cliEntrypointExists, runOmp } from '../utils/runtime.js';

describe('integration: tools command', () => {
  test.runIf(cliEntrypointExists())('lists built-in tools as json', () => {
    const result = runOmp(['tools', 'list', '--json']);

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);

    const payload = JSON.parse(result.stdout.trim()) as {
      categories: string[];
      tools: Array<{ name: string; category: string }>;
    };

    expect(payload.categories).toContain('file');
    expect(payload.categories).toContain('git');
    expect(payload.categories).toContain('http');
    expect(payload.categories).toContain('process');
    expect(payload.tools.some((tool) => tool.name === 'omp_file_read')).toBe(true);
    expect(payload.tools.some((tool) => tool.name === 'omp_git_status')).toBe(true);
    expect(payload.tools.some((tool) => tool.name === 'omp_http_request')).toBe(true);
    expect(payload.tools.some((tool) => tool.name === 'omp_process_run')).toBe(true);
  });

  test.runIf(cliEntrypointExists())('prints extension registration manifest snippet', () => {
    const result = runOmp(['tools', 'manifest', '--json']);

    expect(result.status, [result.stderr, result.stdout].join('\n')).toBe(0);

    const payload = JSON.parse(result.stdout.trim()) as {
      mcpServers?: Record<string, { command: string; args: string[] }>;
    };

    const toolsServer = payload.mcpServers?.omp_cli_tools;
    expect(toolsServer).toBeDefined();

    if (!toolsServer) {
      throw new Error('Expected omp_cli_tools server registration.');
    }

    expect(toolsServer.command).toBe('oh-my-product');
    expect(toolsServer.args).toStrictEqual(['tools', 'serve']);
  });
});
