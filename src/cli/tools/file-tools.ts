import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CliToolDefinition } from './types.js';
import {
  createJsonResult,
  readBoolean,
  readNumber,
  readString,
  resolveWorkingDirectory,
  truncateText,
} from './common.js';

interface FileToolFactoryOptions {
  defaultCwd?: string;
}

const FILE_TOOLS_MAX_ENTRIES = 5_000;

function resolveTargetPath(
  args: Record<string, unknown>,
  defaultCwd: string,
): { cwd: string; targetPath: string } {
  const cwd = resolveWorkingDirectory(args, defaultCwd);
  const target = readString(args, 'path', { required: true });
  const targetPath = path.resolve(cwd, target ?? '');

  return { cwd, targetPath };
}

export function createFileTools(options: FileToolFactoryOptions = {}): CliToolDefinition[] {
  const defaultCwd = options.defaultCwd ?? process.cwd();

  return [
    {
      category: 'file',
      name: 'omg_file_read',
      description: 'Read UTF-8 text from a file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read.' },
          workingDirectory: { type: 'string', description: 'Optional working directory base path.' },
          maxBytes: {
            type: 'number',
            description: 'Maximum UTF-8 bytes returned in the response (default: 1000000).',
          },
        },
        required: ['path'],
      },
      async handler(args) {
        const safeArgs = args;
        const { targetPath } = resolveTargetPath(safeArgs, defaultCwd);
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });

        const content = await readFile(targetPath, 'utf8');
        const truncated = truncateText(content, maxBytes);

        return createJsonResult({
          path: targetPath,
          content: truncated,
          truncated: truncated !== content,
          bytes: Buffer.byteLength(content, 'utf8'),
        });
      },
    },
    {
      category: 'file',
      name: 'omg_file_write',
      description: 'Write UTF-8 text content to a file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write.' },
          content: { type: 'string', description: 'Text content to write.' },
          append: { type: 'boolean', description: 'Append content instead of replacing file.' },
          createDirectories: { type: 'boolean', description: 'Create parent directories when missing.' },
          workingDirectory: { type: 'string', description: 'Optional working directory base path.' },
        },
        required: ['path', 'content'],
      },
      async handler(args) {
        const safeArgs = args;
        const { targetPath } = resolveTargetPath(safeArgs, defaultCwd);
        const content = readString(safeArgs, 'content', { required: true, trim: false }) ?? '';
        const append = readBoolean(safeArgs, 'append', false);
        const createDirectories = readBoolean(safeArgs, 'createDirectories', true);

        if (createDirectories) {
          await mkdir(path.dirname(targetPath), { recursive: true });
        }

        if (append) {
          await writeFile(targetPath, content, {
            encoding: 'utf8',
            flag: 'a',
          });
        } else {
          await writeFile(targetPath, content, 'utf8');
        }

        const fileStats = await stat(targetPath);
        return createJsonResult({
          path: targetPath,
          bytes: fileStats.size,
          appended: append,
          updatedAt: fileStats.mtime.toISOString(),
        });
      },
    },
    {
      category: 'file',
      name: 'omg_file_list',
      description: 'List files/directories from a target path.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (defaults to working directory).' },
          recursive: { type: 'boolean', description: 'Recursively walk nested directories.' },
          includeHidden: { type: 'boolean', description: 'Include entries that begin with a dot.' },
          maxEntries: { type: 'number', description: `Maximum entries returned (default: 200, max: ${FILE_TOOLS_MAX_ENTRIES}).` },
          workingDirectory: { type: 'string', description: 'Optional working directory base path.' },
        },
      },
      async handler(args) {
        const safeArgs = args;
        const cwd = resolveWorkingDirectory(safeArgs, defaultCwd);
        const rawPath = readString(safeArgs, 'path') ?? '.';
        const rootPath = path.resolve(cwd, rawPath);
        const recursive = readBoolean(safeArgs, 'recursive', false);
        const includeHidden = readBoolean(safeArgs, 'includeHidden', false);
        const maxEntries = readNumber(safeArgs, 'maxEntries', {
          defaultValue: 200,
          min: 1,
          max: FILE_TOOLS_MAX_ENTRIES,
          integer: true,
        });

        const queue: string[] = [rootPath];
        const entries: Array<{
          path: string;
          type: 'file' | 'directory' | 'other';
          size: number;
        }> = [];

        while (queue.length > 0 && entries.length < maxEntries) {
          const current = queue.shift();
          if (!current) {
            break;
          }

          const dirEntries = await readdir(current, { withFileTypes: true });
          for (const entry of dirEntries) {
            if (!includeHidden && entry.name.startsWith('.')) {
              continue;
            }

            const absolutePath = path.join(current, entry.name);
            const relativePath = path.relative(rootPath, absolutePath) || '.';
            const fileStats = await stat(absolutePath);

            entries.push({
              path: relativePath,
              type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
              size: fileStats.size,
            });

            if (recursive && entry.isDirectory()) {
              queue.push(absolutePath);
            }

            if (entries.length >= maxEntries) {
              break;
            }
          }
        }

        return createJsonResult({
          rootPath,
          entries,
          truncated: entries.length >= maxEntries,
        });
      },
    },
  ];
}
