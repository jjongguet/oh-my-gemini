import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createInteropMcpTools } from '../../src/interop/api-bridges.js';
import { createDefaultOmpMcpServer } from '../../src/mcp/server.js';
import type { McpToolHandlerResult } from '../../src/mcp/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

function toCallToolResult(result: McpToolHandlerResult): {
  content: Array<{ type: string; text?: string }> ;
  isError?: boolean;
} {
  if (typeof result === 'string') {
    return {
      content: [{ type: 'text', text: result }],
    };
  }

  return result;
}

function readToolText(result: McpToolHandlerResult): string {
  return toCallToolResult(result).content
    .filter((entry): entry is { type: 'text'; text: string } => entry.type === 'text' && typeof entry.text === 'string')
    .map((entry) => entry.text)
    .join('\n');
}

function getTool(
  tools: ReturnType<typeof createInteropMcpTools>,
  name: string,
) {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool ${name}`);
  }
  return tool;
}

const context = {
  signal: new AbortController().signal,
  requestId: 'test-request',
};

describe('reliability: interop MCP API bridges', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = createTempDir('omp-interop-api-bridge-');
  });

  afterEach(() => {
    removeDir(tempRoot);
  });

  test('exposes interop tools through default OMP MCP server', () => {
    const server = createDefaultOmpMcpServer({ cwd: tempRoot });
    const names = server.listTools().map((tool) => tool.name);

    expect(names).toContain('interop_send_task');
    expect(names).toContain('interop_build_gemini_request');
  });

  test('interop send/read task bridge stores shared queue records', async () => {
    const tools = createInteropMcpTools({ cwd: tempRoot });
    const sendTask = getTool(tools, 'interop_send_task');
    const readResults = getTool(tools, 'interop_read_results');

    const sendResult = await sendTask.handler(
      {
        target: 'omp',
        type: 'implement',
        description: 'Port API bridge handlers.',
      },
      context,
    );

    expect(toCallToolResult(sendResult).isError).not.toBe(true);
    const sendText = readToolText(sendResult);
    expect(sendText).toContain('Task Sent to OMP');

    const readResult = await readResults.handler(
      {
        source: 'omc',
      },
      context,
    );

    expect(toCallToolResult(readResult).isError).not.toBe(true);
    const readText = readToolText(readResult);
    expect(readText).toContain('Port API bridge handlers.');
  });

  test('interop OMP direct message bridge is fail-closed when disabled', async () => {
    const tools = createInteropMcpTools({
      cwd: tempRoot,
      env: {
        OMP_OMC_INTEROP_ENABLED: '0',
        OMP_INTEROP_TOOLS_ENABLED: '0',
        OMP_OMC_INTEROP_MODE: 'off',
      },
    });

    const sendMessage = getTool(tools, 'interop_send_omp_message');

    const result = await sendMessage.handler(
      {
        teamName: 'alpha',
        fromWorker: 'worker-1',
        toWorker: 'worker-2',
        body: 'blocked',
      },
      context,
    );

    expect(toCallToolResult(result).isError).toBe(true);
    expect(readToolText(result).toLowerCase()).toContain('disabled');
  });

  test('builds and parses Gemini API bridge payloads', async () => {
    const tools = createInteropMcpTools({ cwd: tempRoot });
    const buildRequest = getTool(tools, 'interop_build_gemini_request');
    const parseResponse = getTool(tools, 'interop_parse_gemini_response');

    const requestResult = await buildRequest.handler(
      {
        source: 'omc',
        target: 'omp',
        message: 'Please review interop queue.',
        task: {
          id: 'task-17',
          type: 'review',
          description: 'Review bridge payloads.',
        },
        systemInstruction: 'Use deterministic Gemini tool formatting.',
      },
      context,
    );

    expect(toCallToolResult(requestResult).isError).not.toBe(true);
    const requestPayload = JSON.parse(readToolText(requestResult)) as {
      contents?: unknown[];
      systemInstruction?: { parts?: Array<{ text?: string }> };
    };

    expect(requestPayload.contents?.length).toBe(2);
    expect(requestPayload.systemInstruction?.parts?.[0]?.text).toContain('Gemini');

    const responseResult = await parseResponse.handler(
      {
        functionResponsePart: {
          functionResponse: {
            name: 'interop_task',
            response: {
              taskId: 'task-17',
              status: 'completed',
              result: 'Reviewed',
            },
          },
        },
        content: {
          role: 'model',
          parts: [{ text: 'Interop bridge response received.' }],
        },
        source: 'omp',
        target: 'omc',
      },
      context,
    );

    expect(toCallToolResult(responseResult).isError).not.toBe(true);
    const responsePayload = JSON.parse(readToolText(responseResult)) as {
      taskUpdate?: { taskId?: string; status?: string };
      message?: { content?: string };
    };

    expect(responsePayload.taskUpdate?.taskId).toBe('task-17');
    expect(responsePayload.taskUpdate?.status).toBe('completed');
    expect(responsePayload.message?.content).toContain('response received');
  });
});
