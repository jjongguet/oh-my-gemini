import { describe, expect, test } from 'vitest';

import { renderHud } from '../../src/hud/render.js';
import type { HudRenderContext } from '../../src/hud/types.js';

function createContext(overrides: Partial<HudRenderContext> = {}): HudRenderContext {
  return {
    version: '0.1.0',
    gitBranch: 'oh-my-gemini/dev',
    generatedAt: '2026-03-05T00:00:00.000Z',
    team: {
      teamName: 'oh-my-gemini',
      hasState: true,
      phase: 'exec',
      runtimeStatus: 'running',
      updatedAt: '2026-03-05T00:00:00.000Z',
      tasks: {
        total: 10,
        completed: 6,
        inProgress: 2,
        percent: 60,
      },
      workers: {
        total: 4,
        running: 2,
        done: 2,
        failed: 0,
        percent: 50,
      },
    },
    gemini: {
      model: 'gemini-2.5-pro',
      keySource: 'env',
      windowPercent: 22,
      quotaPercent: 45,
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('reliability: hud renderer', () => {
  test('renders task and worker progress bars in focused preset', () => {
    const output = renderHud(createContext(), 'focused');

    expect(output).toContain('tasks:6/10');
    expect(output).toContain('[#####---] 60%');
    expect(output).toContain('workers:2/4 done,2 active');
    expect(output).toContain('[####----] 50%');
  });

  test('renders Gemini metadata in full preset', () => {
    const output = renderHud(createContext(), 'full');

    expect(output).toContain('model:gemini-2.5-pro');
    expect(output).toContain('api:env');
    expect(output).toContain('window:22%,quota:45%');
  });

  test('reports no persisted team state when team state is absent', () => {
    const output = renderHud(createContext({
      team: {
        teamName: 'oh-my-gemini',
        hasState: false,
        phase: 'unknown',
        runtimeStatus: 'missing',
        tasks: {
          total: 0,
          completed: 0,
          inProgress: 0,
          percent: 0,
        },
        workers: {
          total: 0,
          running: 0,
          done: 0,
          failed: 0,
          percent: 0,
        },
      },
    }), 'focused');

    expect(output).toMatch(/no persisted team state/i);
  });
});
