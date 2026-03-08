import type { HookContext, HookResult, RegisteredHook } from '../types.js';

const SAFE_COMMAND_PATTERNS = [
  /^git (status|diff|rev-parse|branch)(\s|$)/,
  /^npm (test|run typecheck|run test|run verify)(\s|$)/,
  /^pnpm (test|typecheck|verify)(\s|$)/,
  /^node(\s|$)/,
  /^cat(\s|$)/,
  /^ls(\s|$)/,
  /^find(\s|$)/,
  /^rg(\s|$)/,
];

const DANGEROUS_TOKENS = /[;&|><`$]/;

export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || DANGEROUS_TOKENS.test(trimmed)) {
    return false;
  }

  return SAFE_COMMAND_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function processPermissionRequest(context: HookContext): HookResult {
  const request = context.permissionRequest ?? (typeof context.toolInput === 'string' ? context.toolInput : '');
  const command = String(request).trim();

  if (!command) {
    return { continue: true, message: 'No permission request payload was provided.' };
  }

  if (isSafeCommand(command)) {
    return {
      continue: true,
      message: `Auto-approved safe command: ${command}`,
      data: { approved: true, command },
    };
  }

  return {
    continue: true,
    warnings: [`Permission request requires manual review: ${command}`],
    data: { approved: false, command },
  };
}

export function createPermissionHandlerHook(): RegisteredHook {
  return {
    name: 'permission-handler',
    events: ['PreToolUse'],
    priority: 20,
    handler: async (context) => processPermissionRequest(context),
  };
}
