export type {
  GeminiContent,
  GeminiFunctionCallPart,
  GeminiFunctionResponsePart,
  GeminiGenerateContentRequest,
  GeminiInteropTaskUpdate,
  GeminiPart,
  GeminiTextPart,
  InteropMessagePayload,
  InteropTaskPayload,
  OmgTaskStatus,
  OmcTaskStatus,
  StatusMappingAnnotation,
} from './format-converters.js';

export {
  buildGeminiInteropRequest,
  extractTextFromGeminiContent,
  geminiContentToInteropMessage,
  geminiFunctionResponseToTaskUpdate,
  interopMessageToGeminiContent,
  interopTaskToGeminiFunctionCall,
  isOmcTaskStatus,
  isOmgTaskStatus,
  omcStatusToOmg,
  omgStatusToOmc,
} from './format-converters.js';

export type {
  InteropConfig,
  InteropMode,
  InteropSystem,
  OmgTeamConfig,
  OmgTeamMailboxMessage,
  OmgTeamTask,
  OmgWorkerInfo,
  ReadSharedMessagesFilter,
  ReadSharedTasksFilter,
  SharedInteropMessage,
  SharedInteropTask,
} from './protocol-adapters.js';

export {
  addSharedMessage,
  addSharedTask,
  broadcastOmgMessage,
  canUseOmgDirectWriteBridge,
  cleanupInterop,
  getInteropDir,
  getInteropMode,
  initInteropSession,
  listOmgMailboxMessages,
  listOmgTasks,
  listOmgTeams,
  markMessageAsRead,
  readInteropConfig,
  readOmgMailbox,
  readOmgTeamConfig,
  readSharedMessages,
  readSharedTasks,
  sendOmgDirectMessage,
  updateSharedTask,
} from './protocol-adapters.js';

export type {
  InteropApiBridgeOptions,
} from './api-bridges.js';

export {
  createInteropMcpTools,
} from './api-bridges.js';
