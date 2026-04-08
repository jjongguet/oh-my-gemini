import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { OmpToolDefinition, OmpToolRequestContext } from './types.js';

const DEFAULT_LIST_LIMIT = 200;
const DEFAULT_READ_MAX_BYTES = 256 * 1024;

export interface FileToolsOptions {
  rootDir?: string;
  listLimit?: number;
  readMaxBytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFinitePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveRoot(context: OmpToolRequestContext, options: FileToolsOptions): string {
  return path.resolve(options.rootDir ?? context.cwd);
}

function resolvePathWithinRoot(
  targetPath: string,
  context: OmpToolRequestContext,
  options: FileToolsOptions,
): string {
  if (targetPath.includes('\0')) {
    throw new Error('Path cannot contain null bytes.');
  }

  const rootDir = resolveRoot(context, options);
  const resolvedTarget = path.resolve(rootDir, targetPath);
  const relativeToRoot = path.relative(rootDir, resolvedTarget);

  if (
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error('Path escapes allowed root directory.');
  }

  return resolvedTarget;
}

function formatJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

async function runList(
  args: Record<string, unknown>,
  context: OmpToolRequestContext,
  options: FileToolsOptions,
): Promise<string> {
  const inputPath = getStringArg(args, 'path') ?? '.';
  const includeHidden = args.includeHidden === true;
  const limit = toFinitePositiveInt(args.limit) ?? options.listLimit ?? DEFAULT_LIST_LIMIT;

  const targetPath = resolvePathWithinRoot(inputPath, context, options);
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  const payload = entries
    .filter((entry) => includeHidden || !entry.name.startsWith('.'))
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    }));

  return formatJson({
    path: path.relative(resolveRoot(context, options), targetPath) || '.',
    count: payload.length,
    entries: payload,
  });
}

async function runRead(
  args: Record<string, unknown>,
  context: OmpToolRequestContext,
  options: FileToolsOptions,
): Promise<string> {
  const inputPath = getStringArg(args, 'path');
  if (!inputPath) {
    throw new Error('path is required.');
  }

  const maxBytes = toFinitePositiveInt(args.maxBytes) ?? options.readMaxBytes ?? DEFAULT_READ_MAX_BYTES;
  const targetPath = resolvePathWithinRoot(inputPath, context, options);

  const fileHandle = await fs.open(targetPath, 'r');
  try {
    const stat = await fileHandle.stat();
    const bytesToRead = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await fileHandle.read(buffer, 0, bytesToRead, 0);

    return formatJson({
      path: path.relative(resolveRoot(context, options), targetPath) || path.basename(targetPath),
      truncated: stat.size > bytesToRead,
      size: stat.size,
      content: buffer.toString('utf8'),
    });
  } finally {
    await fileHandle.close();
  }
}

async function runWrite(
  args: Record<string, unknown>,
  context: OmpToolRequestContext,
  options: FileToolsOptions,
): Promise<string> {
  const inputPath = getStringArg(args, 'path');
  if (!inputPath) {
    throw new Error('path is required.');
  }

  const content = args.content;
  if (typeof content !== 'string') {
    throw new Error('content must be a string.');
  }

  const append = args.append === true;
  const createDirs = args.createDirs !== false;
  const targetPath = resolvePathWithinRoot(inputPath, context, options);

  if (createDirs) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  }

  if (append) {
    await fs.appendFile(targetPath, content, 'utf8');
  } else {
    await fs.writeFile(targetPath, content, 'utf8');
  }

  const stat = await fs.stat(targetPath);

  return formatJson({
    path: path.relative(resolveRoot(context, options), targetPath) || path.basename(targetPath),
    bytes: Buffer.byteLength(content, 'utf8'),
    size: stat.size,
    append,
  });
}

async function runStat(
  args: Record<string, unknown>,
  context: OmpToolRequestContext,
  options: FileToolsOptions,
): Promise<string> {
  const inputPath = getStringArg(args, 'path');
  if (!inputPath) {
    throw new Error('path is required.');
  }

  const targetPath = resolvePathWithinRoot(inputPath, context, options);
  const stat = await fs.stat(targetPath);

  return formatJson({
    path: path.relative(resolveRoot(context, options), targetPath) || path.basename(targetPath),
    type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    mode: stat.mode,
  });
}

function createFileTool(
  name: string,
  description: string,
  inputSchema: OmpToolDefinition['inputSchema'],
  handler: (
    args: Record<string, unknown>,
    context: OmpToolRequestContext,
    options: FileToolsOptions,
  ) => Promise<string>,
  options: FileToolsOptions,
): OmpToolDefinition {
  return {
    name,
    description,
    category: 'file',
    inputSchema,
    async handler(args, context) {
      if (!isRecord(args)) {
        throw new Error('Arguments must be an object.');
      }
      return handler(args, context, options);
    },
  };
}

export function createFileTools(options: FileToolsOptions = {}): OmpToolDefinition[] {
  return [
    createFileTool(
      'file_list',
      'List files and directories under a safe project root.',
      {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to root.' },
          includeHidden: { type: 'boolean' },
          limit: { type: 'integer' },
        },
      },
      runList,
      options,
    ),
    createFileTool(
      'file_read',
      'Read a UTF-8 file under a safe project root.',
      {
        type: 'object',
        properties: {
          path: { type: 'string' },
          maxBytes: { type: 'integer' },
        },
        required: ['path'],
      },
      runRead,
      options,
    ),
    createFileTool(
      'file_write',
      'Write UTF-8 content to a file under a safe project root.',
      {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          append: { type: 'boolean' },
          createDirs: { type: 'boolean' },
        },
        required: ['path', 'content'],
      },
      runWrite,
      options,
    ),
    createFileTool(
      'file_stat',
      'Read metadata for a file or directory under a safe project root.',
      {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      runStat,
      options,
    ),
  ];
}
