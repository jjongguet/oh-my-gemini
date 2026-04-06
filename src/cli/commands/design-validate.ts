import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { discoverDesignMd } from '../../design/design-discovery.js';
import { parseDesignMd } from '../../design/parser.js';
import { validateDesignSystem } from '../../design/validator.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import { hasFlag, parseCliArgs } from './arg-utils.js';

export interface DesignValidateCommandContext {
  cwd: string;
  io: CliIo;
}

function printDesignValidateHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg design validate [options]',
    '',
    'Validate a DESIGN.md file against Google Stitch format.',
    '',
    'Options:',
    '  --strict   Require all 9 Stitch categories to be present',
    '  --help     Show command help',
  ].join('\n'));
}

export async function executeDesignValidateCommand(
  argv: string[],
  context: DesignValidateCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printDesignValidateHelp(io);
    return { exitCode: 0 };
  }

  const strict = hasFlag(parsed.options, ['strict']);

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
    io.stderr(`Failed to parse ${designPath}. The file may be empty or contain invalid markdown.`);
    return { exitCode: 1 };
  }

  const result = validateDesignSystem(system, { strict });

  for (const finding of result.findings) {
    const prefix = finding.severity === 'error' ? 'ERROR' : finding.severity === 'warning' ? 'WARN' : 'INFO';
    io.stdout(`[${prefix}] ${finding.message}`);
  }

  if (result.valid) {
    io.stdout(`\nValidation passed: ${path.relative(cwd, designPath)}`);
    return { exitCode: 0 };
  }

  io.stderr(`\nValidation failed: ${path.relative(cwd, designPath)}`);
  return { exitCode: 1 };
}
