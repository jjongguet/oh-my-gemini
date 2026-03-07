/**
 * OpenClaw Configuration Reader for Oh-My-Gemini
 *
 * Reads OpenClaw config from ~/.gemini/omg_config.openclaw.json.
 * Config is cached after first read.
 * Config file path can be overridden via OMG_OPENCLAW_CONFIG env var.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  OpenClawConfig,
  OpenClawHookEvent,
  OpenClawGatewayConfig,
  OpenClawCommandGatewayConfig,
} from './types.js';

function getGeminiConfigDir(): string {
  return process.env.GEMINI_CONFIG_DIR ?? join(homedir(), '.gemini');
}

const CONFIG_FILE =
  process.env.OMG_OPENCLAW_CONFIG ??
  join(getGeminiConfigDir(), 'omg_config.openclaw.json');

/** Cached config (null = not yet read, undefined = read but file missing/invalid) */
let _cachedConfig: OpenClawConfig | undefined | null = null;

/**
 * Read and cache the OpenClaw configuration.
 *
 * Returns null when:
 * - OMG_OPENCLAW env var is not "1"
 * - Config file does not exist
 * - Config file is invalid JSON
 * - Config has enabled: false
 */
export function getOpenClawConfig(): OpenClawConfig | null {
  if (process.env.OMG_OPENCLAW !== '1') {
    return null;
  }

  if (_cachedConfig !== null) {
    return _cachedConfig ?? null;
  }

  if (!existsSync(CONFIG_FILE)) {
    _cachedConfig = undefined;
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as OpenClawConfig;
    if (!raw.enabled || !raw.gateways || !raw.hooks) {
      _cachedConfig = undefined;
      return null;
    }
    _cachedConfig = raw;
    return raw;
  } catch {
    _cachedConfig = undefined;
    return null;
  }
}

/**
 * Resolve gateway config for a specific hook event.
 */
export function resolveGateway(
  config: OpenClawConfig,
  event: OpenClawHookEvent,
): { gatewayName: string; gateway: OpenClawGatewayConfig; instruction: string } | null {
  const mapping = config.hooks[event];
  if (!mapping || !mapping.enabled) {
    return null;
  }

  const gateway = config.gateways[mapping.gateway];
  if (!gateway) {
    return null;
  }

  if ((gateway as OpenClawCommandGatewayConfig).type === 'command') {
    if (!(gateway as OpenClawCommandGatewayConfig).command) return null;
  } else {
    if (!('url' in gateway) || !gateway.url) return null;
  }

  return { gatewayName: mapping.gateway, gateway, instruction: mapping.instruction };
}

/**
 * Reset the config cache (for testing only).
 */
export function resetOpenClawConfigCache(): void {
  _cachedConfig = null;
}
