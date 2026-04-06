import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { generateDesignTemplate } from '../../design/template-generator.js';
import type { DesignTemplateType } from '../../design/template-generator.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import { getStringOption, hasFlag, parseCliArgs } from './arg-utils.js';

export interface DesignInitCommandContext {
  cwd: string;
  io: CliIo;
}

function printDesignInitHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg design init [options]',
    '',
    'Create a DESIGN.md file in the current directory.',
    '',
    'Options:',
    '  --template <type>  Template type: minimal | full (default: full)',
    '  --help             Show command help',
  ].join('\n'));
}

export async function executeDesignInitCommand(
  argv: string[],
  context: DesignInitCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printDesignInitHelp(io);
    return { exitCode: 0 };
  }

  const templateStr = getStringOption(parsed.options, ['template', 't']) ?? 'full';
  if (templateStr !== 'minimal' && templateStr !== 'full') {
    io.stderr(`Invalid template type: ${templateStr}. Use "minimal" or "full".`);
    return { exitCode: 1 };
  }
  const template: DesignTemplateType = templateStr;

  const outputPath = path.join(cwd, 'DESIGN.md');

  // Check if DESIGN.md already exists
  const force = hasFlag(parsed.options, ['force', 'f']);
  try {
    await access(outputPath);
    if (!force) {
      io.stderr(`DESIGN.md already exists at ${outputPath}. Use --force to overwrite.`);
      return { exitCode: 1 };
    }
  } catch {
    // File doesn't exist — proceed
  }

  const content = generateDesignTemplate({ template });

  try {
    await writeFile(outputPath, content, 'utf8');
    io.stdout(`Created ${outputPath} (template: ${template})`);
    return { exitCode: 0 };
  } catch (error) {
    io.stderr(`Failed to create DESIGN.md: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
