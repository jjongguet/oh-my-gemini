/**
 * Stitch integration bridge.
 *
 * Architecture:
 * 1st: MCP path (zero deps, uses existing OmgMcpClient if available)
 * 2nd: SDK path (dynamic import of @google/stitch-sdk, optional)
 * Both unavailable: clear error with setup instructions
 *
 * STITCH_API_KEY is read from env only, never logged.
 */

import type { StitchDesignSystemResponse } from './stitch-types.js';
import { validateStitchResponse } from './stitch-types.js';

export interface StitchBridgeResult {
  readonly source: 'mcp' | 'sdk';
  readonly designSystem: StitchDesignSystemResponse;
}

export interface StitchBridgeError {
  readonly error: string;
  readonly setupInstructions: string;
}

/**
 * Attempt to extract a design system via Stitch MCP server.
 * Returns null if MCP is not configured or connection fails.
 */
async function tryMcpPath(url: string): Promise<StitchDesignSystemResponse | null> {
  try {
    // Dynamic import to avoid hard dependency on mcp client
    const { OmgMcpClient } = await import('../mcp/client.js');
    const client = new OmgMcpClient();

    const result = await client.callTool('extract_design_system', { url });
    const validation = validateStitchResponse(result);

    if (!validation.valid || !validation.data) {
      return null;
    }

    return validation.data;
  } catch {
    return null;
  }
}

/**
 * Attempt to extract a design system via @google/stitch-sdk.
 * Returns null if SDK is not installed or connection fails.
 */
async function trySdkPath(url: string): Promise<StitchDesignSystemResponse | null> {
  try {
    const apiKey = process.env['STITCH_API_KEY'];
    if (!apiKey) return null;

    // Dynamic import — graceful null if not installed
    // @ts-expect-error Dynamic import of optional dependency
    const stitchModule = await import('@google/stitch-sdk').catch(() => null);
    if (!stitchModule) return null;

    const client = stitchModule.stitch ?? stitchModule.default;
    if (!client) return null;

    const result = await client.extractDesignSystem({ url, apiKey });
    const validation = validateStitchResponse(result);

    if (!validation.valid || !validation.data) {
      return null;
    }

    return validation.data;
  } catch {
    return null;
  }
}

/**
 * Extract a design system from the given URL via Stitch.
 * Tries MCP first, then SDK fallback.
 */
export async function extractDesignSystemFromStitch(
  url: string,
): Promise<StitchBridgeResult | StitchBridgeError> {
  // Try MCP path first (zero additional dependencies)
  const mcpResult = await tryMcpPath(url);
  if (mcpResult) {
    return { source: 'mcp', designSystem: mcpResult };
  }

  // Try SDK fallback
  const sdkResult = await trySdkPath(url);
  if (sdkResult) {
    return { source: 'sdk', designSystem: sdkResult };
  }

  // Both unavailable
  return {
    error: 'Stitch connection unavailable. Neither MCP server nor SDK could connect.',
    setupInstructions: [
      'Option 1 (MCP): Configure a Stitch MCP server in your settings.json mcpServers.',
      'Option 2 (SDK): npm install @google/stitch-sdk && export STITCH_API_KEY=your-key',
    ].join('\n'),
  };
}

/** Type guard for error result */
export function isStitchError(result: StitchBridgeResult | StitchBridgeError): result is StitchBridgeError {
  return 'error' in result;
}
