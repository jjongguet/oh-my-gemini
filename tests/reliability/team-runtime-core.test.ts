import { describe, expect, test, vi } from 'vitest';

import {
  createDefaultRuntimeBackendRegistry,
  RuntimeBackendRegistry,
} from '../../src/team/runtime/backend-registry.js';
import { runCommand, shellEscape } from '../../src/team/runtime/process-utils.js';
import type {
  RuntimeBackend,
  RuntimeBackendName,
} from '../../src/team/runtime/runtime-backend.js';
import type { TeamHandle, TeamSnapshot, TeamStartInput } from '../../src/team/types.js';

function createNoopBackend(name: RuntimeBackendName): RuntimeBackend {
  const handle: TeamHandle = {
    id: `handle-${name}`,
    teamName: `team-${name}`,
    backend: name,
    cwd: process.cwd(),
    startedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
    runtime: {},
  };

  const snapshot: TeamSnapshot = {
    handleId: handle.id,
    teamName: handle.teamName,
    backend: name,
    status: 'completed',
    updatedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
    workers: [],
  };

  return {
    name,
    probePrerequisites: async () => ({ ok: true, issues: [] }),
    startTeam: async (_input: TeamStartInput) => handle,
    monitorTeam: async (_handle: TeamHandle) => snapshot,
    shutdownTeam: async () => undefined,
  };
}

describe('reliability: runtime core contracts', () => {
  test('RuntimeBackendRegistry registers and resolves backends and reports unknown names', () => {
    const registry = new RuntimeBackendRegistry();
    const tmux = createNoopBackend('tmux');
    const subagents = createNoopBackend('subagents');

    registry.register(tmux);
    registry.register(subagents);

    expect(registry.list().sort()).toStrictEqual(['subagents', 'tmux']);
    expect(registry.get('tmux')).toBe(tmux);
    expect(registry.get('subagents')).toBe(subagents);

    expect(() => registry.get('unknown-backend' as RuntimeBackendName)).toThrow(
      /unknown runtime backend/i,
    );
  });

  test('createDefaultRuntimeBackendRegistry includes tmux and subagents backends', () => {
    const registry = createDefaultRuntimeBackendRegistry();
    const backends = registry.list().sort();

    expect(backends).toStrictEqual(['gemini-spawn', 'subagents', 'tmux']);
    expect(registry.get('gemini-spawn').name).toBe('gemini-spawn');
    expect(registry.get('tmux').name).toBe('tmux');
    expect(registry.get('subagents').name).toBe('subagents');
  });

  test('shellEscape strips null/newline characters and safely quotes apostrophes', () => {
    const escaped = shellEscape("line1\nline2\r\0it's");
    expect(escaped).toBe(`'line1line2it'"'"'s'`);
  });

  test('runCommand captures stdout/stderr and trims trailing newlines', async () => {
    const result = await runCommand(process.execPath, [
      '-e',
      "process.stdout.write('out\\n'); process.stderr.write('err\\n')",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
  });

  test('runCommand rejects on non-zero exit unless ignoreNonZero is set', async () => {
    await expect(
      runCommand(process.execPath, ['-e', "process.stderr.write('boom'); process.exit(2)"]),
    ).rejects.toThrow(/command failed/i);

    const tolerated = await runCommand(
      process.execPath,
      ['-e', "process.stderr.write('boom'); process.exit(2)"],
      { ignoreNonZero: true },
    );

    expect(tolerated.code).toBe(2);
    expect(tolerated.stderr).toBe('boom');
  });

  test('runCommand enforces timeout and kills long-running child process', async () => {
    const timerSpy = vi.spyOn(globalThis, 'setTimeout');

    try {
      await expect(
        runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], {
          timeoutMs: 50,
        }),
      ).rejects.toThrow(/timed out/i);

      expect(timerSpy).toHaveBeenCalled();
    } finally {
      timerSpy.mockRestore();
    }
  });
});
