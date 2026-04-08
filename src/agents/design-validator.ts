import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const DESIGN_VALIDATOR_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'specialist',
  cost: 'CHEAP',
  promptAlias: 'design-validator',
  triggers: [
    { domain: 'Design Validation', trigger: 'UI code vs DESIGN.md consistency check' },
  ],
  useWhen: [
    'Checking UI code against DESIGN.md tokens',
    'Detecting design drift in CSS/components',
    'Verifying Do/Don\'t rule compliance',
  ],
  avoidWhen: [
    'Design system creation or planning',
    'Non-UI code review',
  ],
};

export const designValidatorAgent: AgentConfig = {
  name: 'design-validator',
  description: 'Verify UI code consistency with DESIGN.md design tokens and rules.',
  prompt: loadAgentPrompt('design-validator'),
  model: 'pro',
  defaultModel: 'pro',
  metadata: DESIGN_VALIDATOR_PROMPT_METADATA,
};
