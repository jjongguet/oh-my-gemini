import type { HookContext } from './types.js';

function stringifyMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '{}';
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return '{}';
  }
}

export function formatInjectedHookContext(params: {
  event: 'pre-tool' | 'stop' | 'cancel';
  context: HookContext;
  now?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}): string {
  const now = params.now ?? new Date();

  return [
    `event=${params.event}`,
    `team=${params.context.teamName}`,
    `task=${params.context.task}`,
    `workers=${params.context.workers}`,
    `stateRoot=${params.context.stateRoot}`,
    `cwd=${params.context.cwd}`,
    `timestamp=${now.toISOString()}`,
    `reason=${params.reason ?? 'n/a'}`,
    `metadata=${stringifyMetadata(params.metadata)}`,
  ].join(' | ');
}

export function parseInjectedHookContext(raw: string): Record<string, string> {
  return raw
    .split(' | ')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, segment) => {
      const separatorIndex = segment.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (!key) {
        return acc;
      }

      acc[key] = value;
      return acc;
    }, {});
}
