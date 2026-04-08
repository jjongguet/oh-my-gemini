import { describe, expect, test } from 'vitest';

import {
  buildGeminiInteropRequest,
  extractTextFromGeminiContent,
  geminiContentToInteropMessage,
  geminiFunctionResponseToTaskUpdate,
  interopMessageToGeminiContent,
  interopTaskToGeminiFunctionCall,
  isOmcTaskStatus,
  isOmpTaskStatus,
  omcStatusToOmp,
  omgStatusToOmc,
} from '../../src/interop/format-converters.js';

describe('reliability: interop format converters', () => {
  test('maps OMP blocked status to OMC pending with lossy annotation', () => {
    const mapped = omgStatusToOmc('blocked');

    expect(mapped.status).toBe('pending');
    expect(mapped.annotation.lossy).toBe(true);
    expect(mapped.annotation.originalSystem).toBe('omp');
    expect(mapped.annotation.originalStatus).toBe('blocked');
  });

  test('recovers OMP blocked status from lossy OMC annotation', () => {
    const mapped = omcStatusToOmp('pending', {
      _interop: {
        originalSystem: 'omp',
        originalStatus: 'blocked',
        mappedStatus: 'pending',
        mappedAt: new Date().toISOString(),
        lossy: true,
      },
    });

    expect(mapped).toBe('blocked');
  });

  test('validates OMC and OMP status values', () => {
    expect(isOmcTaskStatus('completed')).toBe(true);
    expect(isOmcTaskStatus('blocked')).toBe(false);

    expect(isOmpTaskStatus('blocked')).toBe(true);
    expect(isOmpTaskStatus('bogus')).toBe(false);
  });

  test('converts interop message to Gemini content with role mapping', () => {
    const content = interopMessageToGeminiContent({
      source: 'omp',
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
          target: 'omp',
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
      source: 'omp',
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
