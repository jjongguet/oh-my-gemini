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

interface HudWatchInput {
  cwd: string;
  teamName: string;
  env: NodeJS.ProcessEnv;
  preset?: HudPreset;
  intervalMs: number;
}

type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface HudCommandContext {
  cwd: string;
  io: CliIo;
  env: NodeJS.ProcessEnv;
  readHudContextFn?: (input: HudCommandInput) => Promise<HudRenderContext>;
  readHudConfigFn?: (cwd: string) => Promise<{ preset: HudPreset }>;
  renderHudFn?: (context: HudRenderContext, preset: HudPreset) => string;
  runWatchModeFn?: (input: HudWatchInput) => Promise<void>;
}

function printHudHelp(io: CliIo): void {
  io.stdout([
    'Usage: omp hud [--team <name>] [--preset <minimal|focused|full>] [--json] [--watch]',
    '',
    'Options:',
    '  --team <name>     Team namespace to visualize (default: oh-my-product)',
    '  --preset <name>   Render preset (minimal | focused | full)',
    '  --json            Print raw HUD context JSON',
    '  --watch, -w       Re-render continuously with 1s interval',
    '  --interval-ms <n> Watch interval in milliseconds (default: 1000)',
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

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));

    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function watchRenderLoop(
  render: () => Promise<void>,
  options: {
    intervalMs: number;
    signal: AbortSignal;
    sleepFn?: SleepFn;
    onError?: (error: unknown) => void;
  },
): Promise<void> {
  const sleepFn = options.sleepFn ?? sleep;

  while (!options.signal.aborted) {
    const startedAt = Date.now();
    try {
      await render();
    } catch (error) {
      options.onError?.(error);
    }

    if (options.signal.aborted) {
      break;
    }

    const elapsedMs = Date.now() - startedAt;
    const delayMs = Math.max(0, options.intervalMs - elapsedMs);
    await sleepFn(delayMs, options.signal);
  }
}

async function runWatchMode(
  input: HudWatchInput,
  dependencies: {
    readContext: (input: HudCommandInput) => Promise<HudRenderContext>;
    readConfig: (cwd: string) => Promise<{ preset: HudPreset }>;
    render: (context: HudRenderContext, preset: HudPreset) => string;
    writeStdout?: (message: string) => void;
    writeStderr?: (message: string) => void;
    isTty?: boolean;
    registerSigint?: (handler: () => void) => void;
    removeSigint?: (handler: () => void) => void;
    watchRenderLoopFn?: typeof watchRenderLoop;
  },
): Promise<void> {
  const writeStdout = dependencies.writeStdout ?? ((message: string) => process.stdout.write(message));
  const writeStderr = dependencies.writeStderr ?? ((message: string) => process.stderr.write(message));
  const isTty = dependencies.isTty ?? Boolean(process.stdout.isTTY);

  if (!isTty && !input.env.CI) {
    throw new Error('HUD watch mode requires a TTY.');
  }

  const registerSigint = dependencies.registerSigint ?? ((handler: () => void) => process.on('SIGINT', handler));
  const removeSigint = dependencies.removeSigint ?? ((handler: () => void) => process.off('SIGINT', handler));
  const loop = dependencies.watchRenderLoopFn ?? watchRenderLoop;
  const abortController = new AbortController();
  const onSigint = () => {
    abortController.abort();
  };

  registerSigint(onSigint);
  writeStdout('\u001B[?25l');

  let firstFrame = true;
  const renderFrame = async () => {
    const [context, config] = await Promise.all([
      dependencies.readContext({
        cwd: input.cwd,
        teamName: input.teamName,
        env: input.env,
      }),
      dependencies.readConfig(input.cwd),
    ]);

    if (firstFrame) {
      writeStdout('\u001B[2J\u001B[H');
      firstFrame = false;
    } else {
      writeStdout('\u001B[H');
    }

    const preset = input.preset ?? config.preset;
    const line = dependencies.render(context, preset);
    writeStdout(`${line}\u001B[K\n\u001B[J`);
  };

  try {
    await loop(renderFrame, {
      intervalMs: input.intervalMs,
      signal: abortController.signal,
      onError(error) {
        const message = error instanceof Error ? error.message : String(error);
        writeStderr(`HUD watch render failed: ${message}\n`);
        abortController.abort();
      },
    });
  } finally {
    removeSigint(onSigint);
    writeStdout('\u001B[?25h\u001B[2J\u001B[H');
  }
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
    'watch',
    'w',
    'interval-ms',
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

  const watchMode = hasFlag(parsed.options, ['watch', 'w']);
  const jsonMode = hasFlag(parsed.options, ['json']);
  if (watchMode && jsonMode) {
    context.io.stderr('Cannot combine --watch with --json.');
    return { exitCode: 2 };
  }

  const intervalRaw = getStringOption(parsed.options, ['interval-ms']);
  let intervalMs = 1000;
  if (intervalRaw !== undefined) {
    if (!/^\d+$/.test(intervalRaw) || intervalRaw === '0') {
      context.io.stderr(`Invalid --interval-ms value: ${intervalRaw}. Expected a positive integer.`);
      return { exitCode: 2 };
    }
    intervalMs = Number.parseInt(intervalRaw, 10);
  }

  const readContext = context.readHudContextFn ?? readHudContext;
  const readConfig = context.readHudConfigFn ?? readHudConfig;
  const render = context.renderHudFn ?? renderHud;

  if (watchMode) {
    const runner = context.runWatchModeFn ?? ((input: HudWatchInput) =>
      runWatchMode(input, {
        readContext,
        readConfig,
        render,
      }));

    try {
      await runner({
        cwd: context.cwd,
        teamName,
        env: context.env,
        preset,
        intervalMs,
      });
      return { exitCode: 0 };
    } catch (error) {
      context.io.stderr((error as Error).message);
      return { exitCode: 1 };
    }
  }

  const hudContext = await readContext({
    cwd: context.cwd,
    teamName,
    env: context.env,
  });

  if (jsonMode) {
    context.io.stdout(JSON.stringify(hudContext, null, 2));
    return { exitCode: 0 };
  }

  const config = await readConfig(context.cwd);
  const resolvedPreset = preset ?? config.preset;
  context.io.stdout(render(hudContext, resolvedPreset));
  return { exitCode: 0 };
}
