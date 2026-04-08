import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, test } from 'vitest';

import { OmpMcpClient } from '../../src/mcp/client.js';
import { createCliToolsMcpServer } from '../../src/cli/tools/server.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

async function closeQuietly(
  closable: { close(): Promise<void> },
): Promise<void> {
  try {
    await closable.close();
  } catch {
    // ignore
  }
}

describe('reliability: cli tools MCP server', () => {
  test('registers selected categories and executes file tool handlers', async () => {
    const cwd = createTempDir('omp-cli-tools-mcp-');
    const server = createCliToolsMcpServer({
      defaultCwd: cwd,
      categories: ['file'],
    });
    const client = new OmpMcpClient();

    try {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      const tools = await client.listTools();
      const toolNames = tools.map((tool) => tool.name);

      expect(toolNames).toContain('omp_file_read');
      expect(toolNames).toContain('omp_file_write');
      expect(toolNames).not.toContain('omp_git_status');

      const writeResult = await client.callTool('omp_file_write', {
        path: 'note.txt',
        content: 'hello-tools',
      });

      expect(writeResult.isError).not.toBe(true);

      const readResult = await client.callTool('omp_file_read', {
        path: 'note.txt',
      });

      expect(readResult.isError).not.toBe(true);
      const first = readResult.content[0];
      expect(first).toBeDefined();
      if (first?.type === 'text') {
        const payload = JSON.parse(first.text) as {
          content: string;
        };
        expect(payload.content).toContain('hello-tools');
      }
    } finally {
      await closeQuietly(client);
      await closeQuietly(server);
      removeDir(cwd);
    }
  });
});
