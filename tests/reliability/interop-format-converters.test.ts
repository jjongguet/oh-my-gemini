import { describe, expect, test } from 'vitest';

import {
  buildGeminiInteropRequest,
  extractTextFromGeminiContent,
  geminiContentToInteropMessage,
  geminiFunctionResponseToTaskUpdate,
  interopMessageToGeminiContent,
  interopTaskToGeminiFunctionCall,
  isOmcTaskStatus,
  isOmgTaskStatus,
  omcStatusToOmg,
  omgStatusToOmc,
} from '../../src/interop/format-converters.js';

describe('reliability: interop format converters', () => {
  test('maps OMG blocked status to OMC pending with lossy annotation', () => {
    const mapped = omgStatusToOmc('blocked');

    expect(mapped.status).toBe('pending');
    expect(mapped.annotation.lossy).toBe(true);
    expect(mapped.annotation.originalSystem).toBe('omg');
    expect(mapped.annotation.originalStatus).toBe('blocked');
  });

  test('recovers OMG blocked status from lossy OMC annotation', () => {
    const mapped = omcStatusToOmg('pending', {
      _interop: {
        originalSystem: 'omg',
        originalStatus: 'blocked',
        mappedStatus: 'pending',
        mappedAt: new Date().toISOString(),
        lossy: true,
      },
    });

    expect(mapped).toBe('blocked');
  });

  test('validates OMC and OMG status values', () => {
    expect(isOmcTaskStatus('completed')).toBe(true);
    expect(isOmcTaskStatus('blocked')).toBe(false);

    expect(isOmgTaskStatus('blocked')).toBe(true);
    expect(isOmgTaskStatus('bogus')).toBe(false);
  });

  test('converts interop message to Gemini content with role mapping', () => {
    const content = interopMessageToGeminiContent({
      source: 'omg',
      target: 'omc',
      content: 'Task complete.',
    });

    expect(content.role).toBe('model');
    expect(extractTextFromGeminiContent(content)).toContain('Task complete.');
  });

  test('converts interop task to Gemini functionCall payload', () => {
    const content = interopTaskToGeminiFunctionCall({
      id: 'task-5',
      type: 'implement',
      description: 'Port protocol adapter',
      status: 'in_progress',
      files: ['src/interop/protocol-adapters.ts'],
    });

    expect(content.parts).toHaveLength(1);
    const part = content.parts[0];
    expect(part).toBeDefined();
    if (!part || !('functionCall' in part)) {
      throw new Error('Expected functionCall part.');
    }

    expect(part.functionCall.name).toBe('interop_task');
    expect(part.functionCall.args.id).toBe('task-5');
    expect(part.functionCall.args.files).toEqual(['src/interop/protocol-adapters.ts']);
  });

  test('builds Gemini interop request with messages and tasks', () => {
    const request = buildGeminiInteropRequest({
      systemInstruction: 'Coordinate interoperability handoff.',
      messages: [
        {
          source: 'omc',
          target: 'omg',
          content: 'Please review the bridge layer.',
        },
      ],
      tasks: [
        {
          id: 'task-8',
          type: 'review',
          description: 'Review API bridge outputs.',
        },
      ],
    });

    expect(request.contents).toHaveLength(2);
    expect(request.systemInstruction?.parts[0]?.text).toContain('interoperability');
  });

  test('converts Gemini content back to interop message', () => {
    const message = geminiContentToInteropMessage({
      source: 'omg',
      target: 'omc',
      content: {
        role: 'model',
        parts: [{ text: 'Ready for next task.' }],
      },
      metadata: { run: 'alpha' },
    });

    expect(message.id).toMatch(/^msg-/);
    expect(message.content).toBe('Ready for next task.');
    expect(message.metadata?.run).toBe('alpha');
  });

  test('parses Gemini function response into task update', () => {
    const update = geminiFunctionResponseToTaskUpdate({
      functionResponse: {
        name: 'interop_task',
        response: {
          taskId: 'task-21',
          status: 'completed',
          result: 'Bridge merged successfully.',
        },
      },
    });

    expect(update).toEqual({
      taskId: 'task-21',
      status: 'completed',
      result: 'Bridge merged successfully.',
      error: undefined,
    });
  });

  test('returns null task update when response taskId is missing', () => {
    const update = geminiFunctionResponseToTaskUpdate({
      functionResponse: {
        name: 'interop_task',
        response: {
          status: 'completed',
        },
      },
    });

    expect(update).toBeNull();
  });
});
