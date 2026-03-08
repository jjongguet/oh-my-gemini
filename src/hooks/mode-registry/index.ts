import path from 'node:path';

import { MODE_NAMES, type ModeName } from '../../lib/mode-names.js';
import { clearModeStateFile, readModeState } from '../../lib/mode-state-io.js';
import { getOmcRoot } from '../../lib/worktree-paths.js';
import type { HookContext, HookResult, RegisteredHook } from '../types.js';

export interface ExecutionModeRegistration {
  name: ModeName;
  description: string;
  hookName: string;
  exclusive: boolean;
  defaultWorkers: number;
}

const DEFAULT_REGISTRATIONS: ExecutionModeRegistration[] = [
  {
    name: MODE_NAMES.AUTOPILOT,
    description: 'Autonomous end-to-end execution.',
    hookName: 'autopilot',
    exclusive: true,
    defaultWorkers: 1,
  },
  {
    name: MODE_NAMES.RALPH,
    description: 'Persistent verify/fix loop until complete.',
    hookName: 'ralph',
    exclusive: true,
    defaultWorkers: 1,
  },
  {
    name: MODE_NAMES.ULTRAWORK,
    description: 'Maximum parallelism for burst fixes.',
    hookName: 'ultrawork',
    exclusive: true,
    defaultWorkers: 6,
  },
];

const registrationMap = new Map<ModeName, ExecutionModeRegistration>(
  DEFAULT_REGISTRATIONS.map((entry) => [entry.name, entry]),
);

export function registerExecutionMode(registration: ExecutionModeRegistration): void {
  registrationMap.set(registration.name, registration);
}

export function listRegisteredModes(): ExecutionModeRegistration[] {
  return [...registrationMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function getModeMarkerPath(mode: ModeName, cwd: string, sessionId?: string): string {
  const baseDir = sessionId
    ? path.join(getOmcRoot(cwd), 'state', 'sessions', sessionId)
    : path.join(getOmcRoot(cwd), 'state');
  return path.join(baseDir, `${mode}.marker`);
}

export function getActiveModes(cwd: string, sessionId?: string): ModeName[] {
  return listRegisteredModes()
    .map((entry) => entry.name)
    .filter((mode) => {
      const state = readModeState<Record<string, unknown>>(mode, cwd, sessionId);
      if (!state) {
        return false;
      }
      const active = state.active;
      return active === undefined || active === true;
    });
}

export function isModeActive(mode: ModeName, cwd: string, sessionId?: string): boolean {
  return getActiveModes(cwd, sessionId).includes(mode);
}

export function getActiveExclusiveMode(cwd: string, sessionId?: string): ModeName | null {
  const exclusives = new Set(listRegisteredModes().filter((entry) => entry.exclusive).map((entry) => entry.name));
  return getActiveModes(cwd, sessionId).find((mode) => exclusives.has(mode)) ?? null;
}

export function canStartMode(mode: ModeName, cwd: string, sessionId?: string): boolean {
  const activeExclusive = getActiveExclusiveMode(cwd, sessionId);
  return activeExclusive === null || activeExclusive === mode;
}

export function clearModeState(mode: ModeName, cwd: string, sessionId?: string): void {
  clearModeStateFile(mode, cwd, sessionId);
}

export function clearAllModeStates(cwd: string, sessionId?: string): void {
  for (const mode of listRegisteredModes().map((entry) => entry.name)) {
    clearModeState(mode, cwd, sessionId);
  }
}

export async function processModeRegistryHook(context: HookContext): Promise<HookResult> {
  const activeModes = getActiveModes(context.cwd, context.sessionId);
  return {
    continue: true,
    message: activeModes.length > 0
      ? `Active execution modes: ${activeModes.join(', ')}`
      : 'No execution modes are currently active.',
    data: {
      activeModes,
      registeredModes: listRegisteredModes(),
    },
  };
}

export function createModeRegistryHook(): RegisteredHook {
  return {
    name: 'mode-registry',
    events: ['SessionStart', 'UserPromptSubmit', 'SessionEnd'],
    priority: 1,
    handler: processModeRegistryHook,
  };
}
