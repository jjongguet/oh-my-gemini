export {
  autopilotMode,
  activateAutopilot,
  clearAutopilotState,
  executeAutopilotMode,
  readAutopilotState,
  writeAutopilotState,
  type AutopilotState,
} from './autopilot.js';
export {
  ralphMode,
  activateRalph,
  clearRalphState,
  executeRalphMode,
  readRalphState,
  writeRalphState,
  type RalphState,
} from './ralph.js';
export {
  ultraworkMode,
  activateUltrawork,
  clearUltraworkState,
  executeUltraworkMode,
  readUltraworkState,
  writeUltraworkState,
  type UltraworkState,
} from './ultrawork.js';
export type {
  ExecutionMode,
  ModeExecutionDependencies,
  ModeExecutionRequest,
  ModeExecutionResult,
} from './types.js';

import { MODE_NAMES, type ModeName } from '../lib/mode-names.js';
import { autopilotMode } from './autopilot.js';
import { ralphMode } from './ralph.js';
import { ultraworkMode } from './ultrawork.js';

export const EXECUTION_MODES = {
  [MODE_NAMES.AUTOPILOT]: autopilotMode,
  [MODE_NAMES.RALPH]: ralphMode,
  [MODE_NAMES.ULTRAWORK]: ultraworkMode,
} as const;

export function getExecutionMode(mode: ModeName) {
  return EXECUTION_MODES[mode as keyof typeof EXECUTION_MODES];
}
