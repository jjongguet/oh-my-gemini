import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { discoverDesignMd } from '../../design/design-discovery.js';
import { parseDesignMd } from '../../design/parser.js';
import { extractDesignTokens } from '../../design/token-extractor.js';
import type { CliIo, CommandExecutionResult } from '../types.js';
import { hasFlag, parseCliArgs } from './arg-utils.js';

export interface DesignVerifyCommandContext {
  cwd: string;
  io: CliIo;
}

function printDesignVerifyHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp design verify [options]',
    '',
    'Verify code consistency with DESIGN.md tokens.',
    '',
    'Options:',
    '  --json    Output as JSON',
    '  --help    Show command help',
  ].join('\n'));
}

export async function executeDesignVerifyCommand(
  argv: string[],
  context: DesignVerifyCommandContext,
): Promise<CommandExecutionResult> {
  const { io, cwd } = context;
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printDesignVerifyHelp(io);
    return { exitCode: 0 };
  }

  const designPath = await discoverDesignMd(cwd);
  if (!designPath) {
    io.stderr('No DESIGN.md found. Run `omp design init` to create one.');
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

  const tokens = extractDesignTokens(system);
  const asJson = hasFlag(parsed.options, ['json']);

  if (asJson) {
    io.stdout(JSON.stringify({
      designFile: path.relative(cwd, designPath),
      tokenCount: tokens.length,
      tokens: tokens.map(t => ({ name: t.name, value: t.value, category: t.category })),
      categories: [...system.categories],
    }, null, 2));
  } else {
    io.stdout(`Design verification: ${path.relative(cwd, designPath)}`);
    io.stdout(`Tokens found: ${tokens.length}`);
    for (const token of tokens) {
      io.stdout(`  [${token.category}] ${token.name}: ${token.value}`);
    }
    if (tokens.length === 0) {
      io.stdout('No design tokens found. Add color, typography, or spacing values to DESIGN.md.');
    }
  }

  io.stdout(`\nCategories: ${[...system.categories].join(', ')}`);
  return { exitCode: 0 };
}
