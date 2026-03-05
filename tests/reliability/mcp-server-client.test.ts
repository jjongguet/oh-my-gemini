import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, test } from 'vitest';

import { OmgMcpClient } from '../../src/mcp/client.js';
import { OmgMcpServer } from '../../src/mcp/server.js';

async function closeQuietly(
  closable: { close(): Promise<void> },
): Promise<void> {
  try {
    await closable.close();
  } catch {
    // Ignore close failures in tests.
  }
}

describe('reliability: MCP server/client integration', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const close = cleanup.pop();
      if (!close) {
        continue;
      }
      await close();
    }
  });

  test('supports tools, resources, and prompts via in-memory transport', async () => {
    const server = new OmgMcpServer();
    const client = new OmgMcpClient();

    cleanup.push(async () => {
      await closeQuietly(client);
      await closeQuietly(server);
    });

    server.registerTool({
      name: 'echo',
      description: 'Echo text back to the caller.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
      handler(args) {
        const text = typeof args.text === 'string' ? args.text : '';
        return {
          content: [{ type: 'text', text }],
        };
      },
    });

    server.registerResource({
      uri: 'omg://team/status',
      name: 'team-status',
      description: 'Current team status snapshot.',
      mimeType: 'application/json',
      handler() {
        return {
          text: JSON.stringify({ status: 'ok' }),
          mimeType: 'application/json',
        };
      },
    });

    server.registerPrompt({
      name: 'handoff-summary',
      description: 'Builds handoff summary prompt text.',
      arguments: [
        {
          name: 'team',
          description: 'Team name',
          required: true,
        },
      ],
      handler(args) {
        return `Summarize the current handoff state for ${args.team ?? 'unknown-team'}.`;
      },
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    expect(tools.some((tool) => tool.name === 'echo')).toBe(true);

    const toolResult = await client.callTool('echo', { text: 'hello-mcp' });
    expect(toolResult.isError).not.toBe(true);
    const firstToolContent = toolResult.content[0];
    expect(firstToolContent).toBeDefined();
    expect(firstToolContent?.type).toBe('text');
    if (firstToolContent?.type === 'text') {
      expect(firstToolContent.text).toBe('hello-mcp');
    }

    const resources = await client.listResources();
    expect(resources.some((resource) => resource.uri === 'omg://team/status')).toBe(true);

    const resourceResult = await client.readResource('omg://team/status');
    const firstResource = resourceResult.contents[0];
    expect(firstResource).toBeDefined();
    expect(firstResource?.uri).toBe('omg://team/status');
    if (firstResource && 'text' in firstResource) {
      expect(firstResource.text).toContain('"status":"ok"');
    }

    const prompts = await client.listPrompts();
    expect(prompts.some((prompt) => prompt.name === 'handoff-summary')).toBe(true);

    const promptResult = await client.getPrompt('handoff-summary', {
      team: 'core-team',
    });
    const firstMessage = promptResult.messages[0];
    expect(firstMessage).toBeDefined();
    if (firstMessage?.content.type === 'text') {
      expect(firstMessage.content.text).toContain('core-team');
    }
  });

  test('returns MCP tool error payload for unknown tool names', async () => {
    const server = new OmgMcpServer();
    const client = new OmgMcpClient();

    cleanup.push(async () => {
      await closeQuietly(client);
      await closeQuietly(server);
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool('missing-tool', {});
    expect(result.isError).toBe(true);

    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Unknown tool');
    }
  });
});
