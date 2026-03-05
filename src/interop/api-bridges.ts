import {
  buildGeminiInteropRequest,
  geminiContentToInteropMessage,
  geminiFunctionResponseToTaskUpdate,
  type GeminiContent,
  type GeminiFunctionResponsePart,
  type InteropTaskPayload,
} from './format-converters.js';
import {
  addSharedMessage,
  addSharedTask,
  broadcastOmgMessage,
  canUseOmgDirectWriteBridge,
  listOmgMailboxMessages,
  listOmgTasks,
  listOmgTeams,
  markMessageAsRead,
  readSharedMessages,
  readSharedTasks,
  readOmgTeamConfig,
  sendOmgDirectMessage,
  type InteropSystem,
  type SharedInteropTask,
} from './protocol-adapters.js';
import type {
  McpRequestContext,
  McpToolDefinition,
  OmgMcpToolCallResult,
} from '../mcp/types.js';

function textResult(
  text: string,
  options: { isError?: boolean } = {},
): OmgMcpToolCallResult {
  return {
    content: [{ type: 'text', text }],
    isError: options.isError,
  };
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getBooleanArg(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getNumberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function getObjectArg(
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = args[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getStringArrayArg(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function resolveCwd(args: Record<string, unknown>, fallbackCwd: string): string {
  return getStringArg(args, 'workingDirectory') ?? fallbackCwd;
}

function isInteropSystem(value: unknown): value is InteropSystem {
  return value === 'omc' || value === 'omg';
}

function normalizeInteropTarget(
  args: Record<string, unknown>,
): InteropSystem {
  const target = getStringArg(args, 'target');
  if (!isInteropSystem(target)) {
    throw new Error('target is required and must be one of: omc | omg.');
  }

  return target;
}

function normalizeInteropTaskType(
  args: Record<string, unknown>,
): SharedInteropTask['type'] {
  const value = getStringArg(args, 'type');
  if (
    value !== 'analyze' &&
    value !== 'implement' &&
    value !== 'review' &&
    value !== 'test' &&
    value !== 'custom'
  ) {
    throw new Error(
      'type is required and must be one of: analyze | implement | review | test | custom.',
    );
  }

  return value;
}

function sourceForTarget(target: InteropSystem): InteropSystem {
  return target === 'omg' ? 'omc' : 'omg';
}

function summarizeSharedTask(task: SharedInteropTask): string {
  const lines = [
    `### ${task.id}`,
    `- **Type:** ${task.type}`,
    `- **Source:** ${task.source.toUpperCase()} → **Target:** ${task.target.toUpperCase()}`,
    `- **Status:** ${task.status}`,
    `- **Description:** ${task.description}`,
    `- **Created:** ${task.createdAt}`,
  ];

  if (task.files?.length) {
    lines.push(`- **Files:** ${task.files.join(', ')}`);
  }

  if (task.result) {
    lines.push(`- **Result:** ${task.result}`);
  }

  if (task.error) {
    lines.push(`- **Error:** ${task.error}`);
  }

  if (task.completedAt) {
    lines.push(`- **Completed:** ${task.completedAt}`);
  }

  return lines.join('\n');
}

export interface InteropApiBridgeOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function createInteropMcpTools(
  options: InteropApiBridgeOptions = {},
): McpToolDefinition[] {
  const defaultCwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  const withHandler = (
    handler: (
      args: Record<string, unknown>,
      context: McpRequestContext,
    ) => Promise<OmgMcpToolCallResult>,
  ): McpToolDefinition['handler'] => {
    return async (args, context) => {
      try {
        return await handler(args, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return textResult(message, { isError: true });
      }
    };
  };

  const interopSendTaskTool: McpToolDefinition = {
    name: 'interop_send_task',
    description:
      'Send a task to the other tool (OMC ↔ OMG) via shared interop state queue.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Target tool. Must be "omc" or "omg".',
        },
        type: {
          type: 'string',
          description:
            'Task type: analyze | implement | review | test | custom.',
        },
        description: { type: 'string', description: 'Task description.' },
        context: { type: 'object', description: 'Optional task context object.' },
        files: {
          type: 'array',
          description: 'Optional list of related file paths.',
          items: { type: 'string' },
        },
        workingDirectory: {
          type: 'string',
          description: 'Interop state root working directory.',
        },
      },
      required: ['target', 'type', 'description'],
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const target = normalizeInteropTarget(args);
      const type = normalizeInteropTaskType(args);
      const description = getStringArg(args, 'description');

      if (!description) {
        throw new Error('description is required.');
      }

      const task = addSharedTask(cwd, {
        source: sourceForTarget(target),
        target,
        type,
        description,
        context: getObjectArg(args, 'context'),
        files: getStringArrayArg(args, 'files'),
      });

      return textResult(
        [
          `## Task Sent to ${target.toUpperCase()}`,
          '',
          `**Task ID:** ${task.id}`,
          `**Type:** ${task.type}`,
          `**Status:** ${task.status}`,
          `**Created:** ${task.createdAt}`,
        ].join('\n'),
      );
    }),
  };

  const interopReadResultsTool: McpToolDefinition = {
    name: 'interop_read_results',
    description:
      'Read shared interop tasks and optionally filter by source/status.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Filter by source system (omc|omg).' },
        status: {
          type: 'string',
          description: 'Filter by task status (pending|in_progress|completed|failed).',
        },
        limit: { type: 'number', description: 'Maximum tasks to return (default 10).' },
        workingDirectory: { type: 'string' },
      },
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const source = getStringArg(args, 'source');
      const status = getStringArg(args, 'status');
      const limit = getNumberArg(args, 'limit') ?? 10;

      const tasks = readSharedTasks(cwd, {
        source: isInteropSystem(source) ? source : undefined,
        status:
          status === 'pending' ||
          status === 'in_progress' ||
          status === 'completed' ||
          status === 'failed'
            ? status
            : undefined,
      });

      const limited = tasks.slice(0, Math.max(1, Math.floor(limit)));

      if (limited.length === 0) {
        return textResult('## No Tasks Found\n\nNo tasks match the specified filters.');
      }

      return textResult(
        [
          `## Tasks (${limited.length}${tasks.length > limited.length ? ` of ${tasks.length}` : ''})`,
          '',
          ...limited.map((task) => summarizeSharedTask(task)),
        ].join('\n\n'),
      );
    }),
  };

  const interopSendMessageTool: McpToolDefinition = {
    name: 'interop_send_message',
    description:
      'Send a coordination message to the other system via shared interop state.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target system: omc|omg.' },
        content: { type: 'string', description: 'Message body.' },
        metadata: { type: 'object', description: 'Optional metadata payload.' },
        workingDirectory: { type: 'string' },
      },
      required: ['target', 'content'],
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const target = normalizeInteropTarget(args);
      const content = getStringArg(args, 'content');
      if (!content) {
        throw new Error('content is required.');
      }

      const message = addSharedMessage(cwd, {
        source: sourceForTarget(target),
        target,
        content,
        metadata: getObjectArg(args, 'metadata'),
      });

      return textResult(
        [
          `## Message Sent to ${target.toUpperCase()}`,
          '',
          `**Message ID:** ${message.id}`,
          `**Timestamp:** ${message.timestamp}`,
          `**Content:** ${message.content}`,
        ].join('\n'),
      );
    }),
  };

  const interopReadMessagesTool: McpToolDefinition = {
    name: 'interop_read_messages',
    description:
      'Read shared interop messages and optionally mark retrieved records as read.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source filter (omc|omg).' },
        unreadOnly: { type: 'boolean', description: 'Return unread messages only.' },
        markAsRead: { type: 'boolean', description: 'Mark returned messages as read.' },
        limit: { type: 'number', description: 'Maximum messages to return (default 10).' },
        workingDirectory: { type: 'string' },
      },
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const source = getStringArg(args, 'source');
      const unreadOnly = getBooleanArg(args, 'unreadOnly') ?? false;
      const markAsRead = getBooleanArg(args, 'markAsRead') ?? false;
      const limit = getNumberArg(args, 'limit') ?? 10;

      const messages = readSharedMessages(cwd, {
        source: isInteropSystem(source) ? source : undefined,
        unreadOnly,
      });

      const limited = messages.slice(0, Math.max(1, Math.floor(limit)));

      if (markAsRead) {
        for (const message of limited) {
          markMessageAsRead(cwd, message.id);
        }
      }

      if (limited.length === 0) {
        return textResult('## No Messages Found\n\nNo messages match the specified filters.');
      }

      const lines = [`## Messages (${limited.length})`, ''];

      for (const message of limited) {
        lines.push(`### ${message.id}`);
        lines.push(
          `- **From:** ${message.source.toUpperCase()} → **To:** ${message.target.toUpperCase()}`,
        );
        lines.push(`- **Read:** ${message.read ? 'Yes' : 'No'}`);
        lines.push(`- **Timestamp:** ${message.timestamp}`);
        lines.push(`- **Content:** ${message.content}`);

        if (message.metadata) {
          lines.push(`- **Metadata:** ${JSON.stringify(message.metadata)}`);
        }

        lines.push('');
      }

      return textResult(lines.join('\n'));
    }),
  };

  const interopListOmgTeamsTool: McpToolDefinition = {
    name: 'interop_list_omg_teams',
    description:
      'List active OMG teams from .omg/state/team with high-level run metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        workingDirectory: { type: 'string' },
      },
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const teamNames = await listOmgTeams(cwd);

      if (teamNames.length === 0) {
        return textResult('## No OMG Teams Found\n\nNo active teams were detected.');
      }

      const lines = [`## OMG Teams (${teamNames.length})`, ''];

      for (const teamName of teamNames) {
        const config = await readOmgTeamConfig(teamName, cwd);

        if (!config) {
          lines.push(`### ${teamName}`);
          lines.push('- config unavailable');
          lines.push('');
          continue;
        }

        lines.push(`### ${teamName}`);
        lines.push(`- **Task:** ${config.task}`);
        lines.push(`- **Backend:** ${config.backend}`);
        lines.push(`- **Workers:** ${config.worker_count}`);
        lines.push(`- **Created:** ${config.created_at}`);
        lines.push(
          `- **Worker Names:** ${config.workers.map((worker) => worker.name).join(', ') || 'none'}`,
        );
        lines.push('');
      }

      return textResult(lines.join('\n'));
    }),
  };

  const interopSendOmgMessageTool: McpToolDefinition = {
    name: 'interop_send_omg_message',
    description:
      'Send direct or broadcast mailbox messages to an OMG team worker set.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        fromWorker: { type: 'string' },
        toWorker: { type: 'string' },
        body: { type: 'string' },
        broadcast: { type: 'boolean' },
        workingDirectory: { type: 'string' },
      },
      required: ['teamName', 'fromWorker', 'body'],
    },
    handler: withHandler(async (args) => {
      if (!canUseOmgDirectWriteBridge(env)) {
        return textResult(
          'Direct OMG mailbox writes are disabled. Enable OMG_OMC_INTEROP_ENABLED=1, OMG_INTEROP_TOOLS_ENABLED=1, and set OMG_OMC_INTEROP_MODE=active.',
          { isError: true },
        );
      }

      const cwd = resolveCwd(args, defaultCwd);
      const teamName = getStringArg(args, 'teamName');
      const fromWorker = getStringArg(args, 'fromWorker');
      const body = getStringArg(args, 'body');

      if (!teamName || !fromWorker || !body) {
        throw new Error('teamName, fromWorker, and body are required.');
      }

      const broadcast = getBooleanArg(args, 'broadcast') ?? false;

      if (broadcast) {
        const messages = await broadcastOmgMessage(teamName, fromWorker, body, cwd);
        return textResult(
          [
            `## Broadcast Sent to OMG Team: ${teamName}`,
            '',
            `**From:** ${fromWorker}`,
            `**Recipients:** ${messages.length}`,
            `**Message IDs:** ${messages.map((message) => message.message_id).join(', ') || 'none'}`,
          ].join('\n'),
        );
      }

      const toWorker = getStringArg(args, 'toWorker');
      if (!toWorker) {
        throw new Error('toWorker is required when broadcast=false.');
      }

      const message = await sendOmgDirectMessage(
        teamName,
        fromWorker,
        toWorker,
        body,
        cwd,
      );

      return textResult(
        [
          `## Message Sent to OMG Worker`,
          '',
          `**Team:** ${teamName}`,
          `**From:** ${message.from_worker}`,
          `**To:** ${message.to_worker}`,
          `**Message ID:** ${message.message_id}`,
        ].join('\n'),
      );
    }),
  };

  const interopReadOmgMessagesTool: McpToolDefinition = {
    name: 'interop_read_omg_messages',
    description: 'Read mailbox messages for a specific OMG team worker.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        workerName: { type: 'string' },
        limit: { type: 'number' },
        workingDirectory: { type: 'string' },
      },
      required: ['teamName', 'workerName'],
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const teamName = getStringArg(args, 'teamName');
      const workerName = getStringArg(args, 'workerName');
      const limit = getNumberArg(args, 'limit') ?? 20;

      if (!teamName || !workerName) {
        throw new Error('teamName and workerName are required.');
      }

      const messages = await listOmgMailboxMessages(teamName, workerName, cwd);
      const limited = messages.slice(-Math.max(1, Math.floor(limit)));

      if (limited.length === 0) {
        return textResult(`## No Messages\n\nNo messages in ${workerName}'s mailbox.`);
      }

      const lines = [
        `## OMG Mailbox: ${workerName} @ ${teamName} (${limited.length})`,
        '',
      ];

      for (const message of limited) {
        lines.push(`### ${message.message_id}`);
        lines.push(`- **From:** ${message.from_worker}`);
        lines.push(`- **To:** ${message.to_worker}`);
        lines.push(`- **Created:** ${message.created_at}`);
        lines.push(`- **Body:** ${message.body}`);
        lines.push('');
      }

      return textResult(lines.join('\n'));
    }),
  };

  const interopReadOmgTasksTool: McpToolDefinition = {
    name: 'interop_read_omg_tasks',
    description: 'Read tasks for an OMG team and optionally filter by task status.',
    inputSchema: {
      type: 'object',
      properties: {
        teamName: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number' },
        workingDirectory: { type: 'string' },
      },
      required: ['teamName'],
    },
    handler: withHandler(async (args) => {
      const cwd = resolveCwd(args, defaultCwd);
      const teamName = getStringArg(args, 'teamName');
      const status = getStringArg(args, 'status');
      const limit = getNumberArg(args, 'limit') ?? 20;

      if (!teamName) {
        throw new Error('teamName is required.');
      }

      let tasks = await listOmgTasks(teamName, cwd);
      if (status) {
        tasks = tasks.filter((task) => task.status === status);
      }

      const limited = tasks.slice(0, Math.max(1, Math.floor(limit)));
      if (limited.length === 0) {
        return textResult('## No Tasks\n\nNo tasks matched the requested filters.');
      }

      const lines = [`## OMG Tasks: ${teamName} (${limited.length})`, ''];

      for (const task of limited) {
        lines.push(`### Task ${task.id}: ${task.subject}`);
        lines.push(`- **Status:** ${task.status}`);
        lines.push(`- **Description:** ${task.description}`);
        lines.push(`- **Created:** ${task.created_at}`);
        if (task.owner) {
          lines.push(`- **Owner:** ${task.owner}`);
        }
        if (task.result) {
          lines.push(`- **Result:** ${task.result}`);
        }
        if (task.error) {
          lines.push(`- **Error:** ${task.error}`);
        }
        lines.push('');
      }

      return textResult(lines.join('\n'));
    }),
  };

  const interopBuildGeminiRequestTool: McpToolDefinition = {
    name: 'interop_build_gemini_request',
    description:
      'Build a Gemini generateContent request payload from interop messages/tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target system for single message mode.' },
        source: { type: 'string', description: 'Source system for single message mode.' },
        message: { type: 'string', description: 'Single message content.' },
        task: { type: 'object', description: 'Single interop task payload.' },
        systemInstruction: { type: 'string' },
        generationConfig: { type: 'object' },
      },
    },
    handler: withHandler(async (args) => {
      const message = getStringArg(args, 'message');
      const source = getStringArg(args, 'source') ?? 'omg';
      const target = getStringArg(args, 'target') ?? 'omc';
      const task = getObjectArg(args, 'task');

      const request = buildGeminiInteropRequest({
        messages:
          message && isInteropSystem(source) && isInteropSystem(target)
            ? [
                {
                  source,
                  target,
                  content: message,
                },
              ]
            : undefined,
        tasks: task
          ? [
              {
                id: typeof task.id === 'string' ? task.id : 'task-1',
                type: typeof task.type === 'string' ? task.type : 'custom',
                description:
                  typeof task.description === 'string'
                    ? task.description
                    : 'interop task',
                status: typeof task.status === 'string' ? task.status : undefined,
                context: getObjectArg({ task }, 'task')?.context as
                  | Record<string, unknown>
                  | undefined,
                files: Array.isArray(task.files)
                  ? task.files.filter(
                      (entry): entry is string => typeof entry === 'string',
                    )
                  : undefined,
              } satisfies InteropTaskPayload,
            ]
          : undefined,
        systemInstruction: getStringArg(args, 'systemInstruction'),
        generationConfig: getObjectArg(args, 'generationConfig'),
      });

      return textResult(JSON.stringify(request, null, 2));
    }),
  };

  const interopParseGeminiResponseTool: McpToolDefinition = {
    name: 'interop_parse_gemini_response',
    description:
      'Parse Gemini response content/functionResponse into interop message/task updates.',
    inputSchema: {
      type: 'object',
      properties: {
        functionResponsePart: { type: 'object' },
        content: { type: 'object' },
        source: { type: 'string' },
        target: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    handler: withHandler(async (args) => {
      const parsed: Record<string, unknown> = {};

      const functionResponsePart = getObjectArg(args, 'functionResponsePart');
      if (functionResponsePart) {
        const update = geminiFunctionResponseToTaskUpdate(
          functionResponsePart as unknown as GeminiFunctionResponsePart,
        );
        parsed.taskUpdate = update;
      }

      const content = getObjectArg(args, 'content');
      if (content) {
        const source = getStringArg(args, 'source');
        const target = getStringArg(args, 'target');

        if (!isInteropSystem(source) || !isInteropSystem(target)) {
          throw new Error('source and target are required when content is provided.');
        }

        parsed.message = geminiContentToInteropMessage({
          source,
          target,
          content: content as unknown as GeminiContent,
          metadata: getObjectArg(args, 'metadata'),
        });
      }

      if (Object.keys(parsed).length === 0) {
        throw new Error('Provide functionResponsePart and/or content to parse.');
      }

      return textResult(JSON.stringify(parsed, null, 2));
    }),
  };

  return [
    interopSendTaskTool,
    interopReadResultsTool,
    interopSendMessageTool,
    interopReadMessagesTool,
    interopListOmgTeamsTool,
    interopSendOmgMessageTool,
    interopReadOmgMessagesTool,
    interopReadOmgTasksTool,
    interopBuildGeminiRequestTool,
    interopParseGeminiResponseTool,
  ];
}
