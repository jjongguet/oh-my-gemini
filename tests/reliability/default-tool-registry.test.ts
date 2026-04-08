import { describe, expect, test } from 'vitest';

import {
  createDefaultGeminiTools,
  createDefaultOmpToolRegistry,
  toMcpToolDefinitions,
} from '../../src/tools/index.js';

describe('reliability: default tool registry', () => {
  test('includes file and exec tools by default', () => {
    const registry = createDefaultOmpToolRegistry({ cwd: process.cwd() });
    const names = registry.listNames();

    expect(names).toContain('file_read');
    expect(names).toContain('file_write');
    expect(names).toContain('file_list');
    expect(names).toContain('file_stat');
    expect(names).toContain('exec_run');
  });

  test('adapts default tools to Gemini function declarations', () => {
    const geminiTools = createDefaultGeminiTools({ cwd: process.cwd() });
    expect(geminiTools).toHaveLength(1);
    const declarations = geminiTools[0]?.functionDeclarations ?? [];
    const names = declarations.map((entry) => entry.name);

    expect(names).toContain('file_read');
    expect(names).toContain('exec_run');
  });

  test('adapts default tools to MCP definitions', () => {
    const registry = createDefaultOmpToolRegistry({ cwd: process.cwd() });
    const mcpTools = toMcpToolDefinitions(registry.list(), { cwd: process.cwd() });
    const names = mcpTools.map((entry) => entry.name);

    expect(names).toContain('file_read');
    expect(names).toContain('exec_run');
  });
});
