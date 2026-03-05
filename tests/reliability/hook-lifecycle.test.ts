import { describe, expect, test } from 'vitest';

import {
  processCancelHook,
  processLifecycleHook,
  processPreToolHook,
  processStopHook,
} from '../../src/hooks/index.js';
import type { HookContext } from '../../src/hooks/types.js';

function createContext(): HookContext {
  return {
    teamName: 'lifecycle-team',
    cwd: '/tmp/workspace',
    task: 'exercise lifecycle hooks',
    workers: 3,
    stateRoot: '/tmp/workspace/.omg/state',
  };
}

describe('reliability: hook lifecycle processors', () => {
  test('processPreToolHook emits OMC-style hookSpecificOutput context', () => {
    const result = processPreToolHook({
      context: createContext(),
      toolName: 'Edit',
      toolInput: { file_path: 'src/index.ts' },
      metadata: { phase: 'exec' },
    });

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(result.hookSpecificOutput?.additionalContext).toContain('event=pre-tool');
    expect(result.hookSpecificOutput?.additionalContext).toContain('tool=Edit');
    expect(result.hookSpecificOutput?.additionalContext).toContain('team=lifecycle-team');
  });

  test('processStopHook emits stop lifecycle context', () => {
    const result = processStopHook({
      context: createContext(),
      stopReason: 'operational_stop',
      metadata: { force: true },
    });

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('Stop');
    expect(result.hookSpecificOutput?.additionalContext).toContain('event=stop');
    expect(result.hookSpecificOutput?.additionalContext).toContain('reason=operational_stop');
  });

  test('processCancelHook emits cancel lifecycle context', () => {
    const result = processCancelHook({
      context: createContext(),
      cancelReason: 'runtime failed',
      cancelledBy: 'orchestrator',
      metadata: { attempts: 2 },
    });

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.hookEventName).toBe('Cancel');
    expect(result.hookSpecificOutput?.additionalContext).toContain('event=cancel');
    expect(result.hookSpecificOutput?.additionalContext).toContain('reason=runtime failed');
    expect(result.hookSpecificOutput?.additionalContext).toContain('cancelledBy');
  });

  test('processLifecycleHook routes pre-tool, stop, and cancel events', () => {
    const context = createContext();

    const preTool = processLifecycleHook({
      event: 'pre-tool',
      payload: {
        context,
        toolName: 'Bash',
      },
    });
    const stop = processLifecycleHook({
      event: 'stop',
      payload: {
        context,
      },
    });
    const cancel = processLifecycleHook({
      event: 'cancel',
      payload: {
        context,
      },
    });

    expect(preTool.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
    expect(stop.hookSpecificOutput?.hookEventName).toBe('Stop');
    expect(cancel.hookSpecificOutput?.hookEventName).toBe('Cancel');
  });
});
