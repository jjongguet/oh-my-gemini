import { renderHud, readHudConfig, readHudContext, type HudRenderContext, type HudPreset } from '../../hud/index.js';
import type { CliIo, CommandExecutionResult } from '../types.js';

import {
  findUnknownOptions,
  getStringOption,
  hasFlag,
  parseCliArgs,
} from './arg-utils.js';
import { normalizeTeamName } from './team-command-shared.js';

interface HudCommandInput {
  cwd: string;
  teamName: string;
  env: NodeJS.ProcessEnv;
}

export interface HudCommandContext {
  cwd: string;
  io: CliIo;
  env: NodeJS.ProcessEnv;
  readHudContextFn?: (input: HudCommandInput) => Promise<HudRenderContext>;
  readHudConfigFn?: (cwd: string) => Promise<{ preset: HudPreset }>;
  renderHudFn?: (context: HudRenderContext, preset: HudPreset) => string;
}

function printHudHelp(io: CliIo): void {
  io.stdout([
    'Usage: omg hud [--team <name>] [--preset <minimal|focused|full>] [--json]',
    '',
    'Options:',
    '  --team <name>     Team namespace to visualize (default: oh-my-gemini)',
    '  --preset <name>   Render preset (minimal | focused | full)',
    '  --json            Print raw HUD context JSON',
    '  --help            Show command help',
  ].join('\n'));
}

function parsePreset(value: string | undefined): HudPreset | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'minimal' || value === 'focused' || value === 'full') {
    return value;
  }

  return undefined;
}

export async function executeHudCommand(
  argv: string[],
  context: HudCommandContext,
): Promise<CommandExecutionResult> {
  const parsed = parseCliArgs(argv);

  if (hasFlag(parsed.options, ['help', 'h'])) {
    printHudHelp(context.io);
    return { exitCode: 0 };
  }

  const unknownOptions = findUnknownOptions(parsed.options, [
    'team',
    'preset',
    'json',
    'help',
    'h',
  ]);

  if (unknownOptions.length > 0) {
    context.io.stderr(`Unknown option(s): ${unknownOptions.map((key) => `--${key}`).join(', ')}`);
    return { exitCode: 2 };
  }

  if (parsed.positionals.length > 0) {
    context.io.stderr(`Unexpected positional arguments: ${parsed.positionals.join(' ')}`);
    return { exitCode: 2 };
  }

  let teamName: string;
  try {
    teamName = normalizeTeamName(getStringOption(parsed.options, ['team']));
  } catch (error) {
    context.io.stderr((error as Error).message);
    return { exitCode: 2 };
  }

  const presetRaw = getStringOption(parsed.options, ['preset']);
  const preset = parsePreset(presetRaw);
  if (presetRaw !== undefined && !preset) {
    context.io.stderr(`Invalid --preset value: ${presetRaw}. Expected: minimal | focused | full`);
    return { exitCode: 2 };
  }

  const readContext = context.readHudContextFn ?? readHudContext;
  const readConfig = context.readHudConfigFn ?? readHudConfig;
  const render = context.renderHudFn ?? renderHud;

  const hudContext = await readContext({
    cwd: context.cwd,
    teamName,
    env: context.env,
  });

  if (hasFlag(parsed.options, ['json'])) {
    context.io.stdout(JSON.stringify(hudContext, null, 2));
    return { exitCode: 0 };
  }

  const config = await readConfig(context.cwd);
  const resolvedPreset = preset ?? config.preset;
  context.io.stdout(render(hudContext, resolvedPreset));
  return { exitCode: 0 };
}
