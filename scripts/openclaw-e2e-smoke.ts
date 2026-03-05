import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const sinkFile = process.env.OPENCLAW_SINK_FILE ?? '/tmp/omx-openclaw-agent.jsonl';
const sentinelFile = '/tmp/omx-openclaw-agent-pwned';
const injectionSessionId = 'openclaw-e2e-$(touch /tmp/omx-openclaw-agent-pwned)';
const instructionStart = 'openclaw-e2e:session-start';
const instructionEnd = 'openclaw-e2e:session-end';

function readLineCount(path: string): number {
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, 'utf-8').trimEnd();
  if (!content) return 0;
  return content.split('\n').length;
}

function readTailLines(path: string, count: number): string[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8').trimEnd();
  if (!content) return [];
  const lines = content.split('\n');
  return lines.slice(-count);
}

async function main(): Promise<void> {
  if (existsSync(sentinelFile)) {
    unlinkSync(sentinelFile);
  }

  const beforeCount = readLineCount(sinkFile);

  const configPath = join(tmpdir(), `omg-openclaw-e2e-${Date.now()}.json`);
  const sinkScript = join(process.cwd(), 'scripts', 'openclaw-e2e-sink.mjs');

  const config = {
    enabled: true,
    gateways: {
      ci: {
        type: 'command',
        command: `node ${sinkScript} --event {{event}} --session-id {{sessionId}} --instruction {{instruction}}`,
      },
    },
    hooks: {
      'session-start': {
        gateway: 'ci',
        instruction: instructionStart,
        enabled: true,
      },
      'session-end': {
        gateway: 'ci',
        instruction: instructionEnd,
        enabled: true,
      },
    },
  };

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  process.env.OMG_OPENCLAW = '1';
  process.env.OMG_OPENCLAW_CONFIG = configPath;
  process.env.OPENCLAW_SINK_FILE = sinkFile;

  const { resetOpenClawConfigCache, wakeOpenClaw } = await import('../src/openclaw/index.ts');

  resetOpenClawConfigCache();

  const context = {
    sessionId: injectionSessionId,
    projectPath: process.cwd(),
    contextSummary: 'OpenClaw E2E smoke',
  };

  await wakeOpenClaw('session-start', context);
  await wakeOpenClaw('session-end', {
    ...context,
    contextSummary: 'OpenClaw E2E smoke end',
  });

  const afterCount = readLineCount(sinkFile);
  const delta = afterCount - beforeCount;

  if (delta !== 2) {
    throw new Error(`Expected 2 new OpenClaw lines, saw ${delta}`);
  }

  const lines = readTailLines(sinkFile, 2);
  if (lines.length < 2) {
    throw new Error('Missing OpenClaw log lines for session start/end');
  }

  const parsed = lines.map((line) => JSON.parse(line));
  const [startEntry, endEntry] = parsed;

  if (startEntry.event !== 'session-start' || endEntry.event !== 'session-end') {
    throw new Error('OpenClaw markers missing session-start/session-end');
  }

  if (startEntry.instruction !== instructionStart || endEntry.instruction !== instructionEnd) {
    throw new Error('OpenClaw instruction markers mismatch');
  }

  if (startEntry.sessionId !== injectionSessionId || endEntry.sessionId !== injectionSessionId) {
    throw new Error('OpenClaw sessionId was not preserved (shell escaping failure?)');
  }

  if (existsSync(sentinelFile)) {
    throw new Error('Shell injection sentinel file detected; command escaping failed.');
  }

  console.log('[openclaw-e2e] ok: session markers + safe shell handling validated');
}

main().catch((error) => {
  console.error('[openclaw-e2e] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
