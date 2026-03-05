import { describe, expect, test } from 'vitest';

import {
  OmgToolRegistry,
  toGeminiFunctionDeclaration,
  toGeminiToolBundle,
  toMcpToolDefinition,
} from '../../src/tools/index.js';

describe('reliability: tool registry and adapters', () => {
  test('registers tools and lists by category', () => {
    const registry = new OmgToolRegistry();

    registry.register({
      name: 'file_read',
      description: 'Read a file',
      category: 'file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler() {
        return { text: 'ok' };
      },
    });

    registry.register({
      name: 'exec_run',
      description: 'Execute a command',
      category: 'exec',
      inputSchema: {
        type: 'object',
        properties: { command: { type: 'string' } },
      },
      handler() {
        return { text: 'done' };
      },
    });

    expect(registry.listNames()).toEqual(['exec_run', 'file_read']);
    expect(registry.listByCategory('file').map((tool) => tool.name)).toEqual(['file_read']);
  });

  test('rejects duplicate tool names', () => {
    const registry = new OmgToolRegistry();

    registry.register({
      name: 'file_read',
      description: 'Read a file',
      handler() {
        return { text: 'ok' };
      },
    });

    expect(() => {
      registry.register({
        name: 'file_read',
        description: 'Duplicate',
        handler() {
          return { text: 'ok' };
        },
      });
    }).toThrow(/already registered/i);
  });

  test('converts to Gemini function declarations', () => {
    const definition = {
      name: 'file_read',
      description: 'Read a file',
      inputSchema: {
        type: 'object' as const,
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      handler() {
        return { text: 'noop' };
      },
    };

    const declaration = toGeminiFunctionDeclaration(definition);
    expect(declaration).toEqual({
      name: 'file_read',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    });

    const bundle = toGeminiToolBundle([definition]);
    expect(bundle).toHaveLength(1);
    expect(bundle[0]?.functionDeclarations).toHaveLength(1);
    expect(bundle[0]?.functionDeclarations[0]?.name).toBe('file_read');
  });

  test('converts to MCP tool definition', async () => {
    const mcpTool = toMcpToolDefinition({
      name: 'exec_run',
      description: 'Run command',
      inputSchema: {
        type: 'object',
        properties: { command: { type: 'string' } },
      },
      handler(args, context) {
        return { text: `${String(args.command ?? 'none')}@${context.cwd}` };
      },
    });

    expect(mcpTool.name).toBe('exec_run');
    const result = await mcpTool.handler(
      { command: 'pwd' },
      {
        signal: new AbortController().signal,
        requestId: 'req-1',
        sessionId: 'sess-1',
      },
    );

    expect(typeof result).toBe('object');
    if (typeof result === 'object' && result && 'content' in result) {
      const first = result.content[0];
      if (first?.type === 'text') {
        expect(first.text).toContain('pwd@');
      }
    }
  });
});
