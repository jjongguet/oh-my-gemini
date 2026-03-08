import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  createDefaultHookRegistry,
  createKeywordDetectorHook,
  findMatchingLearnedPatterns,
  mergeHookResults,
  processPermissionRequest,
  processPreCompact,
  processSessionEnd,
  processSubagentStart,
  processSubagentStop,
  readTrackingState,
  routePromptToMode,
  runHookPipeline,
  writeWorkerContext,
} from '../../src/hooks/index.js';
import {
  canStartMode,
  getActiveModes,
  listRegisteredModes,
} from '../../src/hooks/mode-registry/index.js';
import {
  executeAutopilotMode,
  executeRalphMode,
  executeUltraworkMode,
  readAutopilotState,
  readRalphState,
  readUltraworkState,
} from '../../src/modes/index.js';
import type { TeamRunResult } from '../../src/team/types.js';
import { createTempDir, removeDir } from '../utils/runtime.js';

describe('reliability: expanded hooks, modes, and learner integration', () => {
  test('default hook registry exposes the expanded hook surface', () => {
    const names = createDefaultHookRegistry().map((hook) => hook.name).sort();
    expect(names).toStrictEqual([
      'autopilot',
      'keyword-detector',
      'learner',
      'mode-registry',
      'permission-handler',
      'pre-compact',
      'project-memory',
      'ralph',
      'recovery',
      'session-end',
      'subagent-tracker',
      'ultrawork',
    ]);
    expect(listRegisteredModes().map((entry) => entry.name).sort()).toStrictEqual([
      'autopilot',
      'ralph',
      'ultrawork',
    ]);
  });

  test('keyword detector routes prompts to execution modes and worker counts', () => {
    expect(routePromptToMode('Please run autopilot end-to-end on this task').mode).toBe('autopilot');
    const ultraworkRoute = routePromptToMode('Use ultrawork with 8 agents for burst parallel fixes');
    expect(ultraworkRoute.mode).toBe('ultrawork');
    expect(ultraworkRoute.workerCount).toBe(8);
    expect(routePromptToMode("Ralph, don't stop until verified complete").mode).toBe('ralph');
  });

  test('permission handler auto-approves safe commands and flags unsafe ones', () => {
    expect(processPermissionRequest({ cwd: '/tmp', permissionRequest: 'git status' }).data?.approved).toBe(true);
    expect(processPermissionRequest({ cwd: '/tmp', permissionRequest: 'rm -rf /tmp/foo' }).data?.approved).toBe(false);
  });

  test('subagent tracker records worker lifecycle', async () => {
    const tempRoot = createTempDir('omg-subagent-track-');
    try {
      await processSubagentStart({ cwd: tempRoot, id: 'team/worker-1', type: 'worker', teamName: 'team' });
      await processSubagentStop({ cwd: tempRoot, id: 'team/worker-1', status: 'completed', summary: 'done' });
      const state = await readTrackingState(tempRoot);
      expect(state.agents['team/worker-1']?.status).toBe('completed');
      expect(state.agents['team/worker-1']?.summary).toBe('done');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('autopilot mode executes once, records learned skill, and enriches worker context', async () => {
    const tempRoot = createTempDir('omg-autopilot-mode-');
    try {
      const stubResult: TeamRunResult = {
        success: true,
        status: 'completed',
        phase: 'completed',
        attempts: 0,
        backend: 'tmux',
        snapshot: {
          handleId: 'handle-1',
          teamName: 'autopilot-task',
          backend: 'tmux',
          status: 'completed',
          updatedAt: new Date().toISOString(),
          workers: [],
          summary: 'Autopilot finished cleanly.',
        },
      };

      const result = await executeAutopilotMode({
        cwd: tempRoot,
        prompt: 'autopilot fix the failing release pipeline end-to-end',
        task: 'Fix the failing release pipeline',
        sessionId: 'session-autopilot',
      }, {
        runTeam: async () => stubResult,
      });

      expect(result.success).toBe(true);
      expect(result.learnedSkillId).toBeTruthy();
      expect(readAutopilotState(tempRoot, 'session-autopilot')?.phase).toBe('completed');
      expect(canStartMode('autopilot', tempRoot, 'session-autopilot')).toBe(true);

      const learnedDir = path.join(tempRoot, '.omg', 'learned-skills');
      expect(existsSync(learnedDir)).toBe(true);
      const matches = await findMatchingLearnedPatterns(tempRoot, 'fix release pipeline automatically');
      expect(matches.some((entry) => entry.pattern.mode === 'autopilot')).toBe(true);

      await writeWorkerContext({
        teamName: 'autopilot-task',
        task: 'Fix the failing release pipeline',
        cwd: tempRoot,
        workers: 1,
      });
      const geminiMd = await fs.readFile(path.join(tempRoot, '.gemini', 'GEMINI.md'), 'utf8');
      expect(geminiMd).toContain('## Learned Skills');
      expect(geminiMd).toContain('## Project Memory');
      expect(geminiMd).toContain(result.learnedSkillId!);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('ralph mode loops until verification passes', async () => {
    const tempRoot = createTempDir('omg-ralph-mode-');
    try {
      let attempts = 0;
      const result = await executeRalphMode({
        cwd: tempRoot,
        prompt: 'ralph keep fixing this until verified',
        task: 'Persistent fix loop',
        sessionId: 'session-ralph',
        maxIterations: 4,
      }, {
        runTeam: async () => ({
          success: true,
          status: 'completed',
          phase: 'completed',
          attempts: attempts,
          backend: 'tmux',
          snapshot: {
            handleId: `handle-${attempts}`,
            teamName: 'ralph-loop',
            backend: 'tmux',
            status: 'completed',
            updatedAt: new Date().toISOString(),
            workers: [],
            summary: `attempt ${attempts}`,
          },
        }),
        verifyResult: async () => {
          attempts += 1;
          return attempts >= 2;
        },
      });

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
      expect(readRalphState(tempRoot, 'session-ralph')?.phase).toBe('completed');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('ultrawork mode uses parallel worker count and persists state', async () => {
    const tempRoot = createTempDir('omg-ultrawork-mode-');
    try {
      const result = await executeUltraworkMode({
        cwd: tempRoot,
        prompt: 'ultrawork with 7 agents for burst parallel fixes',
        task: 'Burst fixes',
        sessionId: 'session-ulw',
      }, {
        runTeam: async (input) => ({
          success: true,
          status: 'completed',
          phase: 'completed',
          attempts: 0,
          backend: input.backend ?? 'tmux',
          snapshot: {
            handleId: 'handle-ulw',
            teamName: input.teamName,
            backend: input.backend ?? 'tmux',
            status: 'completed',
            updatedAt: new Date().toISOString(),
            workers: [],
            summary: `used ${input.workers} workers`,
          },
        }),
      });

      expect(result.success).toBe(true);
      expect(result.state.workers).toBe(7);
      expect(readUltraworkState(tempRoot, 'session-ulw')?.phase).toBe('completed');
    } finally {
      removeDir(tempRoot);
    }
  });

  test('pre-compact and session-end generate persisted summaries', async () => {
    const tempRoot = createTempDir('omg-compact-session-');
    try {
      const stubResult: TeamRunResult = {
        success: true,
        status: 'completed',
        phase: 'completed',
        attempts: 0,
        backend: 'tmux',
        snapshot: {
          handleId: 'handle-compact',
          teamName: 'compact-task',
          backend: 'tmux',
          status: 'completed',
          updatedAt: new Date().toISOString(),
          workers: [],
          summary: 'complete',
        },
      };
      await executeAutopilotMode({
        cwd: tempRoot,
        prompt: 'autopilot compact context for later',
        task: 'Compact context for later',
        sessionId: 'session-summary',
      }, { runTeam: async () => stubResult });

      const preCompact = await processPreCompact({ cwd: tempRoot, sessionId: 'session-summary', event: 'PreCompact' });
      expect(preCompact.systemMessage).toContain('Pre-compact checkpoint');
      const checkpointDir = path.join(tempRoot, '.omg', 'state', 'checkpoints');
      expect((await fs.readdir(checkpointDir)).length).toBeGreaterThan(0);

      const sessionEnd = await processSessionEnd({ cwd: tempRoot, sessionId: 'session-summary', event: 'SessionEnd' });
      expect(sessionEnd.message).toContain('Session summary exported');
      const summaryPath = path.join(tempRoot, '.omg', 'state', 'sessions', 'session-summary', 'summary.json');
      expect(existsSync(summaryPath)).toBe(true);
      const activeModes = getActiveModes(tempRoot, 'session-summary');
      expect(activeModes).toStrictEqual([]);
    } finally {
      removeDir(tempRoot);
    }
  });

  test('hook pipeline merges results consistently', async () => {
    const hookA = createKeywordDetectorHook();
    const hookB = {
      name: 'custom',
      events: ['UserPromptSubmit'] as const,
      handler: async () => ({ continue: true, message: 'custom', systemMessage: 'sys' }),
    };
    const results = await runHookPipeline({ cwd: '/tmp', event: 'UserPromptSubmit', prompt: 'autopilot this' }, [hookA, hookB]);
    const merged = mergeHookResults(results);
    expect(merged.continue).toBe(true);
    expect(merged.message).toContain('Keyword detector');
    expect(merged.message).toContain('custom');
    expect(merged.systemMessage).toContain('sys');
  });
});
