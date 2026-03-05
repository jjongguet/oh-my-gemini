#!/usr/bin/env node
import { appendFileSync } from 'fs';

const args = process.argv.slice(2);

function readArg(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

const event = readArg('--event');
const sessionId = readArg('--session-id');
const instruction = readArg('--instruction');
const sinkFile = process.env.OPENCLAW_SINK_FILE ?? '/tmp/omx-openclaw-agent.jsonl';

if (!event || !instruction) {
  console.error('[openclaw-e2e-sink] missing required arguments');
  process.exit(1);
}

const payload = {
  event,
  sessionId,
  instruction,
  timestamp: new Date().toISOString(),
};

appendFileSync(sinkFile, `${JSON.stringify(payload)}\n`);
