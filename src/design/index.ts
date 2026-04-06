/**
 * Public API for the DESIGN.md design system module.
 *
 * This module is self-contained — it imports nothing from outside src/design/
 * except wrapUntrustedFileContent from src/agents/prompt-helpers.ts (in security.ts).
 */

// Types
export type {
  DesignCategory,
  DesignRule,
  DesignSection,
  DesignSystem,
  DesignToken,
  ValidationFinding,
  ValidationResult,
  ValidationSeverity,
} from './types.js';

// Parser
export { parseDesignMd } from './parser.js';

// Validator
export { validateDesignSystem, STITCH_CATEGORIES } from './validator.js';

// Discovery
export { discoverDesignMd } from './design-discovery.js';

// Token extraction
export { extractDesignTokens, extractDesignRules } from './token-extractor.js';

// Token budget
export { getInjectionTier, buildDesignSection, getDesignMaxTokens } from './token-budget.js';

// Security
export { sanitizeDesignContent, wrapDesignSection } from './security.js';

// Template generator
export type { DesignTemplateType } from './template-generator.js';
export { generateDesignTemplate } from './template-generator.js';

// Smart warning
export { detectUiTask, getDesignWarning } from './smart-warning.js';

// Load convenience (discovery + read + parse pipeline)
export type { LoadedDesignMd } from './load-design-md.js';
export { loadDesignMd } from './load-design-md.js';

// Stitch integration
export type { StitchDesignSystemResponse, StitchDesignToken, StitchValidationResult } from './stitch-types.js';
export { validateStitchResponse, MAX_STITCH_RESPONSE_SIZE } from './stitch-types.js';
export type { StitchBridgeResult, StitchBridgeError } from './stitch-bridge.js';
export { extractDesignSystemFromStitch, isStitchError } from './stitch-bridge.js';
