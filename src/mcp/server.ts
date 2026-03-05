import { promises as fs } from 'node:fs';
import path from 'node:path';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type GetPromptResult,
  type Implementation,
  type PromptMessage,
  type ReadResourceResult,
  type ServerNotification,
  type ServerRequest,
  type TextContent,
} from '@modelcontextprotocol/sdk/types.js';

import {
  TeamStateStore,
  type PersistedTaskRecord,
  type PersistedTeamPhaseState,
  type PersistedTeamSnapshot,
} from '../state/index.js';
import { TeamControlPlane } from '../team/control-plane/index.js';
import { normalizeTeamNameCanonical } from '../common/team-name.js';
import { listSkills } from '../skills/dispatcher.js';
import { createDefaultOmgToolRegistry, toMcpToolDefinitions } from '../tools/index.js';
import { createInteropMcpTools } from '../interop/api-bridges.js';

import type {
  McpJsonSchema,
  McpPromptDefinition,
  McpPromptHandlerResult,
  McpRequestContext,
  McpResourceDefinition,
  McpResourceHandlerResult,
  McpToolDefinition,
  McpToolHandlerResult,
  OmgMcpPromptDescriptor,
  OmgMcpResourceDescriptor,
  OmgMcpServerOptions,
  OmgMcpToolCallResult,
  OmgMcpToolDescriptor,
} from './types.js';

export interface DefaultOmgMcpServerOptions {
  cwd?: string;
  teamName?: string;
  skillsDir?: string;
  serverInfo?: Implementation;
}

interface TeamStatusPayload {
  teamName: string;
  stateRoot: string;
  phase: PersistedTeamPhaseState | null;
  snapshot: PersistedTeamSnapshot | null;
  tasks: PersistedTaskRecord[];
}

const DEFAULT_SERVER_INFO: Implementation = {
  name: 'oh-my-gemini-mcp',
  version: '0.1.0',
};

const EMPTY_OBJECT_SCHEMA: McpJsonSchema = {
  type: 'object',
  properties: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRequestContext(
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
): McpRequestContext {
  return {
    signal: extra.signal,
    requestId: extra.requestId,
    sessionId: extra.sessionId,
  };
}

function textContent(text: string): TextContent {
  return {
    type: 'text',
    text,
  };
}

function normalizeToolResult(result: McpToolHandlerResult): OmgMcpToolCallResult {
  if (typeof result === 'string') {
    return {
      content: [textContent(result)],
    };
  }

  return result;
}

function createToolErrorResult(error: unknown): OmgMcpToolCallResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [textContent(message)],
    isError: true,
  };
}

function isInlineTextResourcePayload(
  value: unknown,
): value is { text: string; mimeType?: string } {
  return isRecord(value) && typeof value.text === 'string';
}

function normalizeResourceResult(
  uri: string,
  result: McpResourceHandlerResult,
): ReadResourceResult {
  if (typeof result === 'string') {
    return {
      contents: [{ uri, text: result }],
    };
  }

  if (isInlineTextResourcePayload(result)) {
    return {
      contents: [
        {
          uri,
          text: result.text,
          mimeType: result.mimeType,
        },
      ],
    };
  }

  return result;
}

function normalizePromptResult(result: McpPromptHandlerResult): GetPromptResult {
  if (typeof result === 'string') {
    return {
      messages: [
        {
          role: 'user',
          content: textContent(result),
        },
      ],
    };
  }

  if (Array.isArray(result)) {
    return {
      messages: result,
    };
  }

  return result;
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTaskId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('taskId cannot be empty.');
  }

  return trimmed.startsWith('task-') ? trimmed.slice('task-'.length) : trimmed;
}

function normalizeJsonObjectArg(
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${key} must be an object.`);
  }

  return value;
}

function getStringArrayArg(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array of strings.`);
  }

  const normalized = value
    .map((entry) => {
      if (typeof entry !== 'string') {
        throw new Error(`${key} entries must be strings.`);
      }
      return entry.trim();
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function safeParseInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }
  return value;
}

async function readSafeTeamContext(
  cwd: string,
): Promise<string | null> {
  const contextPath = path.join(cwd, '.gemini', 'GEMINI.md');
  try {
    return await fs.readFile(contextPath, 'utf8');
  } catch {
    return null;
  }
}

export class OmgMcpServer {
  private readonly tools = new Map<string, McpToolDefinition>();
  private readonly resources = new Map<string, McpResourceDefinition>();
  private readonly prompts = new Map<string, McpPromptDefinition>();
  private readonly server: Server;
  private connected = false;

  constructor(options: OmgMcpServerOptions = {}) {
    this.server = new Server(options.serverInfo ?? DEFAULT_SERVER_INFO, {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
    });

    this.registerRequestHandlers();

    for (const tool of options.tools ?? []) {
      this.registerTool(tool);
    }

    for (const resource of options.resources ?? []) {
      this.registerResource(resource);
    }

    for (const prompt of options.prompts ?? []) {
      this.registerPrompt(prompt);
    }
  }

  get rawServer(): Server {
    return this.server;
  }

  listTools(): OmgMcpToolDescriptor[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema ?? EMPTY_OBJECT_SCHEMA,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    }));
  }

  listResources(): OmgMcpResourceDescriptor[] {
    return [...this.resources.values()].map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
      annotations: resource.annotations,
    }));
  }

  listPrompts(): OmgMcpPromptDescriptor[] {
    return [...this.prompts.values()].map((prompt) => ({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  registerTool(definition: McpToolDefinition): void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('MCP tool name cannot be empty.');
    }
    if (this.tools.has(name)) {
      throw new Error(`MCP tool already registered: ${name}`);
    }

    this.tools.set(name, {
      ...definition,
      name,
    });
    this.notifyToolListChanged();
  }

  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name.trim());
    if (removed) {
      this.notifyToolListChanged();
    }
    return removed;
  }

  registerResource(definition: McpResourceDefinition): void {
    const uri = definition.uri.trim();
    if (!uri) {
      throw new Error('MCP resource URI cannot be empty.');
    }
    if (this.resources.has(uri)) {
      throw new Error(`MCP resource already registered: ${uri}`);
    }

    this.resources.set(uri, {
      ...definition,
      uri,
    });
    this.notifyResourceListChanged();
  }

  unregisterResource(uri: string): boolean {
    const removed = this.resources.delete(uri.trim());
    if (removed) {
      this.notifyResourceListChanged();
    }
    return removed;
  }

  registerPrompt(definition: McpPromptDefinition): void {
    const name = definition.name.trim();
    if (!name) {
      throw new Error('MCP prompt name cannot be empty.');
    }
    if (this.prompts.has(name)) {
      throw new Error(`MCP prompt already registered: ${name}`);
    }

    this.prompts.set(name, {
      ...definition,
      name,
    });
    this.notifyPromptListChanged();
  }

  unregisterPrompt(name: string): boolean {
    const removed = this.prompts.delete(name.trim());
    if (removed) {
      this.notifyPromptListChanged();
    }
    return removed;
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
    this.connected = true;
  }

  async connectStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
    this.connected = false;
  }

  private registerRequestHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.listTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const tool = this.tools.get(request.params.name);
      if (!tool) {
        return createToolErrorResult(`Unknown tool: ${request.params.name}`);
      }

      const args = isRecord(request.params.arguments)
        ? request.params.arguments
        : {};

      try {
        const result = await tool.handler(args, toRequestContext(extra));
        return normalizeToolResult(result);
      } catch (error) {
        return createToolErrorResult(error);
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.listResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      const resource = this.resources.get(request.params.uri);
      if (!resource) {
        throw new Error(`Unknown resource URI: ${request.params.uri}`);
      }

      const result = await resource.handler({
        ...toRequestContext(extra),
        uri: request.params.uri,
      });

      return normalizeResourceResult(request.params.uri, result);
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.listPrompts(),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
      const prompt = this.prompts.get(request.params.name);
      if (!prompt) {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }

      const argumentsRecord: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.params.arguments ?? {})) {
        if (typeof value === 'string') {
          argumentsRecord[key] = value;
        }
      }

      const result = await prompt.handler(argumentsRecord, toRequestContext(extra));
      return normalizePromptResult(result);
    });
  }

  private notifyToolListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendToolListChanged().catch(() => undefined);
  }

  private notifyResourceListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendResourceListChanged().catch(() => undefined);
  }

  private notifyPromptListChanged(): void {
    if (!this.connected) {
      return;
    }

    void this.server.sendPromptListChanged().catch(() => undefined);
  }
}

export function createPromptTextMessage(text: string): PromptMessage {
  return {
    role: 'user',
    content: textContent(text),
  };
}

export function createToolTextResult(
  text: string,
  options: { isError?: boolean } = {},
): OmgMcpToolCallResult {
  return {
    content: [textContent(text)],
    isError: options.isError,
  };
}

async function buildTeamStatusPayload(
  stateStore: TeamStateStore,
  teamName: string,
): Promise<TeamStatusPayload> {
  const normalizedTeamName = normalizeTeamNameCanonical(teamName);

  const [phase, snapshot, tasks] = await Promise.all([
    stateStore.readPhaseState(normalizedTeamName),
    stateStore.readMonitorSnapshot(normalizedTeamName),
    stateStore.listTasks(normalizedTeamName),
  ]);

  return {
    teamName: normalizedTeamName,
    stateRoot: stateStore.rootDir,
    phase,
    snapshot,
    tasks,
  };
}

function createTeamStatusResource(
  stateStore: TeamStateStore,
  teamName: string,
): McpResourceDefinition {
  const uri = `omg://team/${teamName}/status`;

  return {
    uri,
    name: `${teamName}-status`,
    description: `Persisted status snapshot for team ${teamName}.`,
    mimeType: 'application/json',
    async handler() {
      const status = await buildTeamStatusPayload(stateStore, teamName);
      return {
        text: JSON.stringify(status, null, 2),
        mimeType: 'application/json',
      };
    },
  };
}

function createTeamStatusTool(
  stateStore: TeamStateStore,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_status',
    description: 'Read persisted team phase, runtime snapshot, and task summary.',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: `Team namespace (defaults to ${defaultTeamName}).`,
        },
      },
    },
    async handler(args) {
      const teamName = getStringArg(args, 'team') ?? defaultTeamName;
      const status = await buildTeamStatusPayload(stateStore, teamName);
      return {
        content: [
          textContent(JSON.stringify(status, null, 2)),
        ],
      };
    },
  };
}

function createTeamClaimTaskTool(
  controlPlane: TeamControlPlane,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_claim_task',
    description: 'Claim a task for a worker using control-plane lease semantics.',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        taskId: { type: 'string' },
        worker: { type: 'string' },
        leaseMs: { type: 'integer' },
      },
      required: ['taskId', 'worker'],
    },
    async handler(args) {
      const taskId = getStringArg(args, 'taskId');
      const worker = getStringArg(args, 'worker');
      if (!taskId || !worker) {
        throw new Error('taskId and worker are required.');
      }

      const leaseMs = safeParseInteger(args.leaseMs);

      const result = await controlPlane.claimTask({
        teamName: getStringArg(args, 'team') ?? defaultTeamName,
        taskId: normalizeTaskId(taskId),
        worker,
        leaseMs,
      });

      return {
        content: [
          textContent(JSON.stringify(result, null, 2)),
        ],
      };
    },
  };
}

function createTeamTransitionTaskTool(
  controlPlane: TeamControlPlane,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_transition_task',
    description: 'Transition task status under active claim token guard.',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        taskId: { type: 'string' },
        worker: { type: 'string' },
        claimToken: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        result: { type: 'string' },
        error: { type: 'string' },
      },
      required: ['taskId', 'worker', 'claimToken', 'from', 'to'],
    },
    async handler(args) {
      const taskId = getStringArg(args, 'taskId');
      const worker = getStringArg(args, 'worker');
      const claimToken = getStringArg(args, 'claimToken');
      const from = getStringArg(args, 'from');
      const to = getStringArg(args, 'to');

      if (!taskId || !worker || !claimToken || !from || !to) {
        throw new Error('taskId, worker, claimToken, from, and to are required.');
      }

      const result = await controlPlane.transitionTaskStatus({
        teamName: getStringArg(args, 'team') ?? defaultTeamName,
        taskId: normalizeTaskId(taskId),
        worker,
        claimToken,
        from: from as PersistedTaskRecord['status'],
        to: to as PersistedTaskRecord['status'],
        result: getStringArg(args, 'result'),
        error: getStringArg(args, 'error'),
      });

      return {
        content: [textContent(JSON.stringify(result, null, 2))],
      };
    },
  };
}

function createTeamReleaseTaskTool(
  controlPlane: TeamControlPlane,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_release_task',
    description: 'Release active claim ownership for a task.',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        taskId: { type: 'string' },
        worker: { type: 'string' },
        claimToken: { type: 'string' },
        toStatus: { type: 'string' },
      },
      required: ['taskId', 'worker', 'claimToken'],
    },
    async handler(args) {
      const taskId = getStringArg(args, 'taskId');
      const worker = getStringArg(args, 'worker');
      const claimToken = getStringArg(args, 'claimToken');
      if (!taskId || !worker || !claimToken) {
        throw new Error('taskId, worker, and claimToken are required.');
      }

      const toStatusRaw = getStringArg(args, 'toStatus');
      const toStatus =
        toStatusRaw === 'blocked' || toStatusRaw === 'unknown'
          ? toStatusRaw
          : 'pending';

      const result = await controlPlane.releaseTaskClaim({
        teamName: getStringArg(args, 'team') ?? defaultTeamName,
        taskId: normalizeTaskId(taskId),
        worker,
        claimToken,
        toStatus,
      });

      return {
        content: [textContent(JSON.stringify(result, null, 2))],
      };
    },
  };
}

function createMailboxSendTool(
  controlPlane: TeamControlPlane,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_mailbox_send',
    description: 'Send a mailbox message from one worker to another.',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        fromWorker: { type: 'string' },
        toWorker: { type: 'string' },
        body: { type: 'string' },
        messageId: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['fromWorker', 'toWorker', 'body'],
    },
    async handler(args) {
      const fromWorker = getStringArg(args, 'fromWorker');
      const toWorker = getStringArg(args, 'toWorker');
      const body = getStringArg(args, 'body');
      if (!fromWorker || !toWorker || !body) {
        throw new Error('fromWorker, toWorker, and body are required.');
      }

      const result = await controlPlane.sendMailboxMessage({
        teamName: getStringArg(args, 'team') ?? defaultTeamName,
        fromWorker,
        toWorker,
        body,
        messageId: getStringArg(args, 'messageId'),
        metadata: normalizeJsonObjectArg(args, 'metadata'),
      });

      return {
        content: [textContent(JSON.stringify(result, null, 2))],
      };
    },
  };
}

function createMailboxListTool(
  controlPlane: TeamControlPlane,
  defaultTeamName: string,
): McpToolDefinition {
  return {
    name: 'team_mailbox_list',
    description: 'List mailbox messages for a worker.',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        worker: { type: 'string' },
        includeDelivered: { type: 'boolean' },
      },
      required: ['worker'],
    },
    async handler(args) {
      const worker = getStringArg(args, 'worker');
      if (!worker) {
        throw new Error('worker is required.');
      }

      const includeDelivered = args.includeDelivered !== false;

      const result = await controlPlane.listMailboxMessages({
        teamName: getStringArg(args, 'team') ?? defaultTeamName,
        worker,
        includeDelivered,
      });

      return {
        content: [textContent(JSON.stringify(result, null, 2))],
      };
    },
  };
}

function createSkillCatalogResource(skillsDir?: string): McpResourceDefinition {
  const uri = 'omg://skills/catalog';

  return {
    uri,
    name: 'skills-catalog',
    description: 'Resolved extension skill catalog as JSON.',
    mimeType: 'application/json',
    async handler() {
      const skills = await listSkills(skillsDir);
      const payload = skills.map((skill) => ({
        name: skill.name,
        aliases: skill.aliases,
        primaryRole: skill.primaryRole,
        description: skill.description,
        skillPath: skill.skillPath,
      }));

      return {
        text: JSON.stringify(payload, null, 2),
        mimeType: 'application/json',
      };
    },
  };
}

function createGeminiContextResource(cwd: string): McpResourceDefinition {
  const uri = 'omg://context/gemini';

  return {
    uri,
    name: 'gemini-context',
    description: 'Current .gemini/GEMINI.md content for worker context.',
    mimeType: 'text/markdown',
    async handler() {
      const content = await readSafeTeamContext(cwd);
      return {
        text: content ?? '# No GEMINI.md context file found\n',
        mimeType: 'text/markdown',
      };
    },
  };
}

function createPlanPrompt(defaultTeamName: string): McpPromptDefinition {
  return {
    name: 'team_plan',
    description: 'Prompt template for planning the next team execution wave.',
    arguments: [
      {
        name: 'team',
        description: `Team namespace (defaults to ${defaultTeamName}).`,
      },
      {
        name: 'task',
        description: 'Task objective for planning.',
        required: true,
      },
    ],
    handler(args) {
      const team = args.team?.trim() || defaultTeamName;
      const task = args.task?.trim() || 'unspecified task';

      return [
        createPromptTextMessage([
          `You are coordinating the team \"${team}\".`,
          `Plan the next execution wave for task: ${task}.`,
          'Return a concise checklist with owners, expected artifacts, and verification steps.',
        ].join('\n')),
      ];
    },
  };
}

function createStatusPrompt(defaultTeamName: string): McpPromptDefinition {
  return {
    name: 'team_status_summary',
    description: 'Prompt template for summarizing persisted team status.',
    arguments: [
      {
        name: 'team',
        description: `Team namespace (defaults to ${defaultTeamName}).`,
      },
    ],
    handler(args) {
      const team = args.team?.trim() || defaultTeamName;

      return [
        createPromptTextMessage([
          `Summarize current status for team \"${team}\" using omg://team/${team}/status.`,
          'Highlight phase, runtime state, blocked tasks, and next remediation action.',
          'Keep the summary under 10 bullet points.',
        ].join('\n')),
      ];
    },
  };
}

function createSkillPrompt(): McpPromptDefinition {
  return {
    name: 'skill_execution',
    description: 'Prompt template to execute a named oh-my-gemini skill.',
    arguments: [
      {
        name: 'skill',
        description: 'Skill name or alias to execute.',
        required: true,
      },
      {
        name: 'objective',
        description: 'Execution objective passed to the skill.',
      },
    ],
    handler(args) {
      const skill = args.skill?.trim() || 'plan';
      const objective = args.objective?.trim() || 'No objective provided.';

      return [
        createPromptTextMessage([
          `Run skill: omg skill ${skill} "${objective}"`,
          'After execution, report evidence artifacts and unresolved blockers.',
        ].join('\n')),
      ];
    },
  };
}

export function createDefaultOmgMcpServer(
  options: DefaultOmgMcpServerOptions = {},
): OmgMcpServer {
  const cwd = options.cwd ?? process.cwd();
  const teamName = normalizeTeamNameCanonical(options.teamName ?? 'oh-my-gemini');

  const stateStore = new TeamStateStore({ cwd });
  const controlPlane = new TeamControlPlane({ stateStore });
  const toolRegistry = createDefaultOmgToolRegistry({ cwd });
  const sharedTools = toMcpToolDefinitions(toolRegistry.list(), { cwd });

  const server = new OmgMcpServer({
    serverInfo: options.serverInfo,
    tools: [
      ...sharedTools,
      createTeamStatusTool(stateStore, teamName),
      createTeamClaimTaskTool(controlPlane, teamName),
      createTeamTransitionTaskTool(controlPlane, teamName),
      createTeamReleaseTaskTool(controlPlane, teamName),
      createMailboxSendTool(controlPlane, teamName),
      createMailboxListTool(controlPlane, teamName),
      ...createInteropMcpTools({
        cwd,
      }),
    ],
    resources: [
      createTeamStatusResource(stateStore, teamName),
      createSkillCatalogResource(options.skillsDir),
      createGeminiContextResource(cwd),
    ],
    prompts: [
      createPlanPrompt(teamName),
      createStatusPrompt(teamName),
      createSkillPrompt(),
    ],
  });

  return server;
}

export type {
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
};
