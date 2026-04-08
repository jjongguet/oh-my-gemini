/**
 * Agent Types for Oh-My-Product
 *
 * Defines types for agent configuration and metadata used in dynamic prompt generation.
 * Ported from OMC's agent type system, adapted for Gemini API.
 */

/**
 * Model type tiers for Gemini
 */
export type ModelType = 'flash' | 'pro' | 'ultra' | 'flash-thinking' | 'pro-thinking';

/**
 * Cost tier for agent usage
 * Used to guide when to invoke expensive vs cheap agents
 */
export type AgentCost = 'FREE' | 'CHEAP' | 'EXPENSIVE';

/**
 * Agent category for routing and grouping
 */
export type AgentCategory =
  | 'exploration'    // Code search and discovery
  | 'specialist'     // Domain-specific implementation
  | 'advisor'        // Strategic consultation (read-only)
  | 'utility'        // General purpose helpers
  | 'orchestration'  // Multi-agent coordination
  | 'planner'        // Strategic planning
  | 'reviewer';      // Plan/work review

/**
 * Trigger condition for delegation
 */
export interface DelegationTrigger {
  /** Domain or area this trigger applies to */
  domain: string;
  /** Condition that triggers delegation */
  trigger: string;
}

/**
 * Metadata about an agent for dynamic prompt generation
 */
export interface AgentPromptMetadata {
  /** Agent category */
  category: AgentCategory;
  /** Cost tier */
  cost: AgentCost;
  /** Short alias for prompts */
  promptAlias?: string;
  /** Conditions that trigger delegation to this agent */
  triggers: DelegationTrigger[];
  /** When to use this agent */
  useWhen?: string[];
  /** When NOT to use this agent */
  avoidWhen?: string[];
  /** Description for dynamic prompt building */
  promptDescription?: string;
  /** Tools this agent uses (for tool selection guidance) */
  tools?: string[];
}

/**
 * Base agent configuration
 */
export interface AgentConfig {
  /** Agent name/identifier */
  name: string;
  /** Short description for agent selection */
  description: string;
  /** System prompt for the agent */
  prompt: string;
  /** Tools the agent can use */
  tools?: string[];
  /** Tools explicitly disallowed for this agent */
  disallowedTools?: string[];
  /** Model to use (defaults to pro) */
  model?: ModelType;
  /** Default model for this agent */
  defaultModel?: ModelType;
  /** Optional metadata for dynamic prompt generation */
  metadata?: AgentPromptMetadata;
}

/**
 * Extended agent config with all optional fields
 */
export interface FullAgentConfig extends AgentConfig {
  /** Temperature setting */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Thinking configuration (for Gemini thinking models) */
  thinking?: {
    type: 'enabled' | 'disabled';
    budgetTokens?: number;
  };
  /** Tool restrictions */
  toolRestrictions?: string[];
}

/**
 * Agent override configuration for customization
 */
export interface AgentOverrideConfig {
  /** Override model */
  model?: string;
  /** Enable/disable agent */
  enabled?: boolean;
  /** Append to prompt */
  prompt_append?: string;
  /** Override temperature */
  temperature?: number;
}

/**
 * Map of agent overrides
 */
export type AgentOverrides = Partial<Record<string, AgentOverrideConfig>>;

/**
 * Factory function signature for creating agents
 */
export type AgentFactory = (model?: string) => AgentConfig;

/**
 * Available agent descriptor for OMP prompt building
 */
export interface AvailableAgent {
  name: string;
  description: string;
  metadata: AgentPromptMetadata;
}

/**
 * Check if a model ID is a Gemini model
 */
export function isGeminiModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('gemini');
}

/**
 * Get default model for a category (Gemini-adapted)
 */
export function getDefaultModelForCategory(category: AgentCategory): ModelType {
  switch (category) {
    case 'exploration':
      return 'flash'; // Fast, cheap
    case 'specialist':
      return 'pro'; // Balanced
    case 'advisor':
      return 'pro-thinking'; // High quality reasoning
    case 'utility':
      return 'flash'; // Fast, cheap
    case 'orchestration':
      return 'pro'; // Balanced
    case 'planner':
      return 'pro-thinking'; // Needs reasoning
    case 'reviewer':
      return 'pro'; // Balanced
    default:
      return 'pro';
  }
}
