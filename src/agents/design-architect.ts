import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const DESIGN_ARCHITECT_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'specialist',
  cost: 'CHEAP',
  promptAlias: 'design-architect',
  triggers: [
    { domain: 'Design System', trigger: 'Design system structure, token hierarchy, extensibility review' },
  ],
  useWhen: [
    'Reviewing DESIGN.md structural completeness',
    'Analyzing design token hierarchy',
    'Evaluating theme extensibility',
  ],
  avoidWhen: [
    'UI code implementation',
    'Non-design architecture decisions',
  ],
};

export const designArchitectAgent: AgentConfig = {
  name: 'design-architect',
  description: 'Evaluate design system structural completeness, token consistency, and extensibility.',
  prompt: loadAgentPrompt('design-architect'),
  model: 'pro',
  defaultModel: 'pro',
  metadata: DESIGN_ARCHITECT_PROMPT_METADATA,
};
