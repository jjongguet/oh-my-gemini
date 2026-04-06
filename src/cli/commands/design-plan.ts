import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { discoverDesignMd } from '../../design/design-discovery.js';
import { parseDesignMd } from '../../design/parser.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import { hasFlag, parseCliArgs } from './arg-utils.js';

export interface DesignPlanCommandContext {
  cwd: string;
  io: CliIo;
}

function printDesignPlanHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg design plan [options]',
    '',
    'Generate a UI implementation plan based on DESIGN.md.',
    '',
    'Options:',
    '  --output <path>  Output path (default: IMPLEMENTATION.md)',
    '  --help           Show command help',
  ].join('\n'));
}

export async function executeDesignPlanCommand(
  argv: string[],
  context: DesignPlanCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printDesignPlanHelp(io);
    return { exitCode: 0 };
  }

  const designPath = await discoverDesignMd(cwd);
  if (!designPath) {
    io.stderr('No DESIGN.md found. Run `omg design init` to create one.');
    return { exitCode: 1 };
  }

  let content: string;
  try {
    content = await readFile(designPath, 'utf8');
  } catch (error) {
    io.stderr(`Failed to read ${designPath}: ${(error as Error).message}`);
    return { exitCode: 1 };
  }

  const system = parseDesignMd(content);
  if (!system) {
    io.stderr(`Failed to parse ${designPath}.`);
    return { exitCode: 1 };
  }

  // Build implementation plan from design system sections
  const planLines: string[] = [
    '# Implementation Plan',
    '',
    `Generated from: ${path.relative(cwd, designPath)}`,
    `Categories: ${[...system.categories].join(', ')}`,
    '',
  ];

  for (const section of system.sections) {
    planLines.push(`## ${section.heading}`);
    planLines.push('');
    planLines.push(`Implementation tasks for ${section.category}:`);
    planLines.push(`- Review and implement tokens from this section`);
    planLines.push(`- Ensure consistency with existing UI code`);
    planLines.push('');
  }

  const outputPath = path.join(cwd, 'IMPLEMENTATION.md');
  try {
    await writeFile(outputPath, planLines.join('\n'), 'utf8');
    io.stdout(`Implementation plan generated: ${outputPath}`);
    io.stdout(`${system.sections.length} sections, ${[...system.categories].length} categories`);
    return { exitCode: 0 };
  } catch (error) {
    io.stderr(`Failed to write plan: ${(error as Error).message}`);
    return { exitCode: 1 };
  }
}
