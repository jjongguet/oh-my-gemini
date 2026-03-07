import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  resolveExtensionPath,
  type ResolveExtensionPathOptions,
} from '../cli/commands/extension-path.js';

export interface CommandTemplate {
  name: string;
  description: string;
  template: string;
  filePath: string;
}

export interface ExpandedCommand {
  name: string;
  description: string;
  prompt: string;
}

export interface CommandLookupOptions extends Pick<ResolveExtensionPathOptions, 'cwd' | 'env' | 'overridePath'> {}

function normalizeCommandName(input: string): string {
  return input
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function parseTomlCommand(content: string): { description: string; prompt: string } {
  const descriptionMatch = content.match(/^\s*description\s*=\s*"([^"]*)"\s*$/m);
  const promptMatch = content.match(/^\s*prompt\s*=\s*"""\s*\n?([\s\S]*?)\n?"""\s*$/m);

  if (!promptMatch) {
    throw new Error('Command prompt is missing TOML multiline `prompt = """..."""` block.');
  }

  return {
    description: descriptionMatch?.[1]?.trim() ?? '',
    prompt: promptMatch[1]?.trim() ?? '',
  };
}

async function walkTomlFiles(rootDir: string): Promise<string[]> {
  const found: string[] = [];

  async function visit(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.toml')) {
        found.push(fullPath);
      }
    }
  }

  await visit(rootDir);
  return found.sort((a, b) => a.localeCompare(b));
}

export async function getCommandsDir(options: CommandLookupOptions): Promise<string> {
  const extension = await resolveExtensionPath(options);
  return path.join(extension.path, 'commands');
}

export async function getCommand(
  name: string,
  options: CommandLookupOptions,
): Promise<CommandTemplate | null> {
  const normalizedName = normalizeCommandName(name);
  if (!normalizedName) {
    return null;
  }

  const commandsDir = await getCommandsDir(options);
  const filePath = path.join(commandsDir, `${normalizedName}.toml`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const parsed = parseTomlCommand(raw);

  return {
    name: normalizedName,
    description: parsed.description,
    template: parsed.prompt,
    filePath,
  };
}

export async function getAllCommands(options: CommandLookupOptions): Promise<CommandTemplate[]> {
  const commandsDir = await getCommandsDir(options);
  const files = await walkTomlFiles(commandsDir);

  const commands: CommandTemplate[] = [];
  for (const filePath of files) {
    const relative = path.relative(commandsDir, filePath);
    const name = relative.replace(/\.toml$/, '').replaceAll(path.sep, '/');
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseTomlCommand(content);
    commands.push({
      name,
      description: parsed.description,
      template: parsed.prompt,
      filePath,
    });
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCommands(options: CommandLookupOptions): Promise<string[]> {
  const commands = await getAllCommands(options);
  return commands.map((command) => command.name);
}

export async function commandExists(name: string, options: CommandLookupOptions): Promise<boolean> {
  const command = await getCommand(name, options);
  return command !== null;
}

function expandTemplate(template: string, args: string): string {
  return template
    .replaceAll(/\{\{\s*args\s*\}\}/g, args)
    .replaceAll('$ARGUMENTS', args);
}

export async function expandCommand(
  name: string,
  args: string,
  options: CommandLookupOptions,
): Promise<ExpandedCommand | null> {
  const command = await getCommand(name, options);
  if (!command) {
    return null;
  }

  return {
    name: command.name,
    description: command.description,
    prompt: expandTemplate(command.template, args).trim(),
  };
}

export async function expandCommandPrompt(
  name: string,
  args: string,
  options: CommandLookupOptions,
): Promise<string | null> {
  const expanded = await expandCommand(name, args, options);
  return expanded?.prompt ?? null;
}
