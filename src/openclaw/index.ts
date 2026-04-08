/**
 * OpenClaw Integration - Public API for Oh-My-Product
 *
 * Wakes OpenClaw gateways on hook events. Non-blocking, fire-and-forget.
 */

export type {
  OpenClawCommandGatewayConfig,
  OpenClawConfig,
  OpenClawContext,
  OpenClawGatewayConfig,
  OpenClawHookEvent,
  OpenClawHookMapping,
  OpenClawHttpGatewayConfig,
  OpenClawPayload,
  OpenClawResult,
} from './types.js';

export {
  getOpenClawConfig,
  resolveGateway,
  resetOpenClawConfigCache,
} from './config.js';

export {
  wakeGateway,
  wakeCommandGateway,
  interpolateInstruction,
  isCommandGateway,
  shellEscapeArg,
} from './dispatcher.js';

import type {
  OpenClawHookEvent,
  OpenClawContext,
  OpenClawResult,
} from './types.js';
import { getOpenClawConfig, resolveGateway } from './config.js';
import {
  wakeGateway,
  wakeCommandGateway,
  interpolateInstruction,
  isCommandGateway,
} from './dispatcher.js';
import { basename } from 'path';

/** Whether debug logging is enabled */
const DEBUG = process.env.OMP_OPENCLAW_DEBUG === '1';

/**
 * Build a whitelisted context object from the input context.
 */
function buildWhitelistedContext(context: OpenClawContext): OpenClawContext {
  const result: OpenClawContext = {};
  if (context.sessionId !== undefined) result.sessionId = context.sessionId;
  if (context.projectPath !== undefined) result.projectPath = context.projectPath;
  if (context.tmuxSession !== undefined) result.tmuxSession = context.tmuxSession;
  if (context.toolName !== undefined) result.toolName = context.toolName;
  if (context.prompt !== undefined) result.prompt = context.prompt;
  if (context.contextSummary !== undefined) result.contextSummary = context.contextSummary;
  if (context.reason !== undefined) result.reason = context.reason;
  if (context.question !== undefined) result.question = context.question;
  if (context.tmuxTail !== undefined) result.tmuxTail = context.tmuxTail;
  if (context.replyChannel !== undefined) result.replyChannel = context.replyChannel;
  if (context.replyTarget !== undefined) result.replyTarget = context.replyTarget;
  if (context.replyThread !== undefined) result.replyThread = context.replyThread;
  return result;
}

/**
 * Detect current tmux session name from environment.
 */
function detectTmuxSession(): string | undefined {
  if (!process.env.TMUX) return undefined;
  try {
    const { execSync } = require('child_process');
    return execSync('tmux display-message -p "#S"', { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wake the OpenClaw gateway mapped to a hook event.
 *
 * Non-blocking, swallows all errors. Returns null if OpenClaw
 * is not configured or the event is not mapped.
 */
export async function wakeOpenClaw(
  event: OpenClawHookEvent,
  context: OpenClawContext,
): Promise<OpenClawResult | null> {
  try {
    const config = getOpenClawConfig();
    if (!config) return null;

    const resolved = resolveGateway(config, event);
    if (!resolved) return null;

    const { gatewayName, gateway, instruction } = resolved;

    const now = new Date().toISOString();

    const tmuxSession = context.tmuxSession ?? detectTmuxSession();

    // Read reply channel context from environment variables
    const replyChannel = context.replyChannel ?? process.env.OPENCLAW_REPLY_CHANNEL ?? undefined;
    const replyTarget = context.replyTarget ?? process.env.OPENCLAW_REPLY_TARGET ?? undefined;
    const replyThread = context.replyThread ?? process.env.OPENCLAW_REPLY_THREAD ?? undefined;

    // Enrich context with reply channel from env vars
    const enrichedContext: OpenClawContext = {
      ...context,
      ...(replyChannel && { replyChannel }),
      ...(replyTarget && { replyTarget }),
      ...(replyThread && { replyThread }),
    };

    // Build template variables
    const variables: Record<string, string | undefined> = {
      sessionId: context.sessionId,
      projectPath: context.projectPath,
      projectName: context.projectPath ? basename(context.projectPath) : undefined,
      tmuxSession,
      toolName: context.toolName,
      prompt: context.prompt,
      contextSummary: context.contextSummary,
      reason: context.reason,
      question: context.question,
      tmuxTail: context.tmuxTail,
      event,
      timestamp: now,
      replyChannel,
      replyTarget,
      replyThread,
    };

    const interpolatedInstruction = interpolateInstruction(instruction, variables);
    variables.instruction = interpolatedInstruction;

    let result: OpenClawResult;

    if (isCommandGateway(gateway)) {
      result = await wakeCommandGateway(gatewayName, gateway, variables);
    } else {
      const payload = {
        event,
        instruction: interpolatedInstruction,
        timestamp: now,
        sessionId: context.sessionId,
        projectPath: context.projectPath,
        projectName: context.projectPath ? basename(context.projectPath) : undefined,
        tmuxSession,
        tmuxTail: context.tmuxTail,
        ...(replyChannel && { channel: replyChannel }),
        ...(replyTarget && { to: replyTarget }),
        ...(replyThread && { threadId: replyThread }),
        context: buildWhitelistedContext(enrichedContext),
      };
      result = await wakeGateway(gatewayName, gateway, payload);
    }

    if (DEBUG) {
      console.error(
        `[openclaw] wake ${event} -> ${gatewayName}: ${result.success ? 'ok' : result.error}`,
      );
    }

    return result;
  } catch (error) {
    if (DEBUG) {
      console.error(
        '[openclaw] wakeOpenClaw error:',
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}
