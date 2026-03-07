import { describe, expect, test } from 'vitest';

import {
  hasUnresolvedTemplateVariables,
  interpolateInstruction,
  wakeCommandGateway,
} from '../../src/openclaw/dispatcher.js';

describe('reliability: openclaw dispatcher templates', () => {
  test('detects unresolved template variables', () => {
    expect(hasUnresolvedTemplateVariables('run --event {{event}}')).toBe(true);
    expect(hasUnresolvedTemplateVariables('run --event session-start')).toBe(false);
  });

  test('interpolation leaves unknown variables unchanged', () => {
    const result = interpolateInstruction('event={{event}} tool={{toolName}}', {
      event: 'session-start',
      toolName: undefined,
    });

    expect(result).toBe('event=session-start tool={{toolName}}');
    expect(hasUnresolvedTemplateVariables(result)).toBe(true);
  });

  test('command gateway fails closed when template variables are unresolved', async () => {
    const outcome = await wakeCommandGateway(
      'local',
      {
        type: 'command',
        command: 'echo {{event}} {{missing}}',
      },
      {
        event: 'session-start',
      },
    );

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain('Unresolved command template variables');
  });

  test('unresolved variable detection is stable across repeated calls', () => {
    const template = 'one={{event}} two={{missing}}';

    expect(hasUnresolvedTemplateVariables(template)).toBe(true);
    expect(hasUnresolvedTemplateVariables(template)).toBe(true);
    expect(hasUnresolvedTemplateVariables('event=session-start')).toBe(false);
  });
});
